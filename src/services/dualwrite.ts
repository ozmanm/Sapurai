/**
 * Sprint 43 Phase A - Dual-write Firestore mono-doc -> sous-collections.
 *
 * Stratégie (cf. MIGRATION-SUBCOLLECTIONS.md) :
 *  - L'app continue d'ecrire dans le doc single (`/companies/{cid}`) comme avant
 *  - EN PLUS, on miroir vers les sous-collections `/companies/{cid}/{coll}/{id}`
 *  - Fire-and-forget : un echec mirror ne bloque pas l'utilisateur
 *  - Idempotent : on `setDoc` pour ecraser, pas `addDoc`
 *
 * Limite batch Firestore : 500 writes par batch, on chunke a 400 par securite.
 *
 * Phase A : ce code tourne en prod en parallele du save() existant.
 * Phase B : script de backfill `scripts/backfill-subcollections.mjs` complete
 *   les docs existants. A executer une fois quand Phase A est stable.
 * Phase C (Sprint 44) : on switch les listeners pour LIRE depuis les sous-collections.
 * Phase D (Sprint 45) : cleanup, suppression du dual-write.
 */

import { collection, doc, writeBatch, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export interface MirrorStats {
  ok: boolean;
  written: number;
  deleted: number;
  errors: string[];
  durationMs: number;
}

interface SubcollectionSpec {
  key: 'dos' | 'tcs' | 'chs' | 'dep' | 'logs';
  path: string;     // chemin sous /companies/{cid}/
  idField: string;  // champ qui sert d'ID dans la sous-collection
}

var SUBCOLLECTIONS: SubcollectionSpec[] = [
  { key: 'dos', path: 'dossiers', idField: 'id' },
  { key: 'tcs', path: 'tcs', idField: 'id' },
  { key: 'chs', path: 'chs', idField: 'id' },
  { key: 'dep', path: 'dep', idField: 'id' },
  { key: 'logs', path: 'logs', idField: 'id' },
];

var BATCH_CHUNK = 400;  // marge sur la limite Firestore 500

/**
 * Miroir d'un snapshot complet vers les sous-collections.
 *
 * @param db Firestore instance
 * @param companyId
 * @param newData Le doc clean a miroir (post-sanitize)
 * @param prevData Le doc precedent (pour detecter les suppressions). Optionnel —
 *   si fourni, on supprime les sous-docs qui ne sont plus dans newData.
 *
 * Retourne des stats. NE THROW JAMAIS (fire-and-forget).
 */
export async function mirrorToSubcollections(
  db: Firestore,
  companyId: string,
  newData: Record<string, unknown>,
  prevData?: Record<string, unknown>,
): Promise<MirrorStats> {
  var start = Date.now();
  var stats: MirrorStats = { ok: true, written: 0, deleted: 0, errors: [], durationMs: 0 };

  if (!companyId || !newData) {
    stats.ok = false;
    stats.errors.push('companyId ou newData manquant');
    stats.durationMs = Date.now() - start;
    return stats;
  }

  for (var i = 0; i < SUBCOLLECTIONS.length; i++) {
    var spec = SUBCOLLECTIONS[i];
    var arr = (Array.isArray(newData[spec.key]) ? newData[spec.key] : []) as Array<Record<string, unknown>>;
    var prevArr = (prevData && Array.isArray(prevData[spec.key]) ? prevData[spec.key] : []) as Array<Record<string, unknown>>;

    try {
      // Step 1 : ecrire / mettre a jour tous les items de newData
      var collRef = collection(db, 'companies', companyId, spec.path);

      // Sprint 45 fix : pour les logs (append-only via rules), ne re-mirror
      // que les items NOUVEAUX (absents de prevArr). Sinon `batch.set()` sur
      // un log existant declenche rule `update: super-admin only` qui rejette
      // tout le batch (perte des nouveaux logs du meme commit).
      var workingArr = arr;
      if (spec.key === 'logs' && prevArr.length > 0) {
        var prevIds: Record<string, true> = {};
        prevArr.forEach(function (item: Record<string, unknown>) {
          if (item && item[spec.idField]) prevIds[String(item[spec.idField])] = true;
        });
        workingArr = arr.filter(function (item) {
          var id = item && item[spec.idField];
          return !!id && !prevIds[String(id)];
        });
      }

      for (var off = 0; off < workingArr.length; off += BATCH_CHUNK) {
        var slice = workingArr.slice(off, off + BATCH_CHUNK);
        var batch = writeBatch(db);
        slice.forEach(function (item: Record<string, unknown>) {
          var id = item && item[spec.idField];
          if (!id) return;
          batch.set(doc(collRef, String(id)), item);
        });
        await batch.commit();
        stats.written += slice.length;
      }

      // Step 2 : si prevData fourni, supprimer les ids qui ne sont plus dans newData
      if (prevArr.length > 0) {
        var newIds: Record<string, true> = {};
        arr.forEach(function (item: Record<string, unknown>) {
          if (item && item[spec.idField]) newIds[String(item[spec.idField])] = true;
        });
        for (var j = 0; j < prevArr.length; j++) {
          var oldItem = prevArr[j];
          var oldId = oldItem && oldItem[spec.idField];
          if (!oldId) continue;
          if (!newIds[String(oldId)]) {
            // Supprime du miroir
            try {
              await deleteDoc(doc(collRef, String(oldId)));
              stats.deleted++;
            } catch (e) {
              var msg = e instanceof Error ? e.message : 'unknown';
              stats.errors.push(spec.path + '/' + oldId + ' delete : ' + msg);
            }
          }
        }
      }
    } catch (e) {
      stats.ok = false;
      var emsg = e instanceof Error ? e.message : 'unknown';
      stats.errors.push(spec.path + ' : ' + emsg);
    }
  }

  stats.durationMs = Date.now() - start;
  return stats;
}

/**
 * Helper pour logguer le resultat de facon discrete (Phase A).
 * Phase C+, on consommera ces stats pour des metriques plus serieuses.
 */
export function logMirrorResult(companyId: string, stats: MirrorStats): void {
  if (stats.errors.length > 0) {
    // eslint-disable-next-line no-console -- volontaire pour debug Phase A
    console.warn(
      '[dualwrite] companyId=' + companyId + ' written=' + stats.written +
      ' deleted=' + stats.deleted + ' duration=' + stats.durationMs + 'ms errors=',
      stats.errors,
    );
  } else if (stats.written > 0 || stats.deleted > 0) {
    // Log discret en debug uniquement (un toggle de status ferait beaucoup de logs)
    // console.debug('[dualwrite] ok', companyId, stats);
  }
}


/**
 * Sprint 44 - Cache de dedoublonnage des erreurs (60s).
 * Si la meme (entity, entityId, errorMessage) a deja ete loggee dans les
 * 60 dernieres secondes, on skip pour eviter de spammer la collection
 * dual_write_errors en cas de boucle d'erreurs (mirror qui retente sans cesse).
 */
var ERROR_DEDUP_TTL_MS = 60 * 1000;
var errorDedupCache: Map<string, number> = new Map();

function shouldLogError(entity: string, entityId: string, errorMessage: string): boolean {
  var key = entity + '|' + entityId + '|' + errorMessage.slice(0, 100);
  var now = Date.now();
  var last = errorDedupCache.get(key);
  if (last !== undefined && (now - last) < ERROR_DEDUP_TTL_MS) {
    return false;
  }
  errorDedupCache.set(key, now);
  // Cleanup periodique : si la map grossit trop, on jette les vieilles entrees
  if (errorDedupCache.size > 200) {
    for (var [k, ts] of errorDedupCache.entries()) {
      if ((now - ts) > ERROR_DEDUP_TTL_MS) errorDedupCache.delete(k);
    }
  }
  return true;
}

/**
 * Sprint 44 (instrumentation observabilite) - persiste les erreurs de mirror
 * dans `companies/{cid}/dual_write_errors/{auto_id}`.
 *
 * Permet d'auditer apres-coup les echecs silencieux du dual-write (Phase A)
 * sans dependre de console.warn qui disparait apres rafraichissement.
 *
 * Fire-and-forget : si la persistance des erreurs echoue elle-meme, on silence
 * (le mono-doc reste source de verite, on ne bloque pas l'utilisateur).
 */
export async function persistMirrorErrors(
  db: Firestore,
  companyId: string,
  stats: MirrorStats,
): Promise<void> {
  if (!stats.errors.length) return;
  try {
    var auth = getAuth();
    var uid = (auth && auth.currentUser && auth.currentUser.uid) || 'anon';
    var collRef = collection(db, 'companies', companyId, 'dual_write_errors');
    // On persiste un doc par erreur pour pouvoir filtrer/agreger plus tard
    var session = Math.random().toString(36).slice(2, 10);
    for (var i = 0; i < stats.errors.length; i++) {
      var msg = stats.errors[i];
      // Parse legere : "dossiers/abc : error message" -> entity + msg
      var entity = 'unknown';
      var entityId = '';
      var errorMessage = msg;
      var parts = msg.split(' : ');
      if (parts.length >= 2) {
        var pathParts = parts[0].split('/');
        entity = pathParts[0] || 'unknown';
        entityId = pathParts.length > 1 ? pathParts.slice(1).join('/') : '';
        errorMessage = parts.slice(1).join(' : ');
      }
      // Dedoublonnage 60s : evite de spammer la collection si meme erreur recurrente
      if (!shouldLogError(entity, entityId, String(errorMessage))) continue;
      try {
        await addDoc(collRef, {
          ts: serverTimestamp(),
          entity: entity,
          entityId: entityId,
          mirrorTarget: parts[0] || '',
          errorMessage: String(errorMessage).slice(0, 500),
          uid: uid,
          sessionId: session,
          durationMs: stats.durationMs,
        });
      } catch (_inner) {
        // Si l'ecriture observabilite elle-meme echoue (rules, network), on continue
        // sans bloquer. C'est par definition fire-and-forget.
      }
    }
  } catch (_e) {
    // silence total : observabilite ne doit jamais empecher l'app de fonctionner
  }
}