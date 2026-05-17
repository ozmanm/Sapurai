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

import { collection, doc, writeBatch, deleteDoc } from 'firebase/firestore';
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
  newData: any,
  prevData?: any,
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
    var arr: any[] = Array.isArray(newData[spec.key]) ? newData[spec.key] : [];
    var prevArr: any[] = prevData && Array.isArray(prevData[spec.key]) ? prevData[spec.key] : [];

    try {
      // Step 1 : ecrire / mettre a jour tous les items de newData
      var collRef = collection(db, 'companies', companyId, spec.path);
      for (var off = 0; off < arr.length; off += BATCH_CHUNK) {
        var slice = arr.slice(off, off + BATCH_CHUNK);
        var batch = writeBatch(db);
        slice.forEach(function (item: any) {
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
        arr.forEach(function (item: any) {
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
            } catch (e: any) {
              stats.errors.push(spec.path + '/' + oldId + ' delete : ' + (e.message || 'unknown'));
            }
          }
        }
      }
    } catch (e: any) {
      stats.ok = false;
      stats.errors.push(spec.path + ' : ' + (e.message || 'unknown'));
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
