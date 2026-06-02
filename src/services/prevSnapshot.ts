// src/services/prevSnapshot.ts
//
// Sprint 46 hotfix beta (backlog G) : extraction testable de la resolution du
// prevSnapshot pour le dual-write. Avant, cette logique etait inline dans
// useData.ts:save() -> aucune barriere CI (les 6 tests dualwrite.test.ts protegent
// le MIRROR, pas le sourcing de prev). Ici on isole la logique dans un module pur,
// testable independamment du hook React (3 chemins : getDoc OK / timeout / throw).
//
// Invariant critique (incident 2026-05-24) : prev DOIT venir de Firestore (verite),
// jamais du React state qui peut etre EMPTY/stale (pre-hydratation, closure figee).
// Sinon mirror Step 2 voit prevArr=[] et skip les deletes silencieusement (orphelins
// sub, dual_write_errors=0).

import { doc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { persistMirrorErrors } from './dualwrite';

// Timeout du read prev : ne pas prendre setDoc (ecriture autoritative) en otage
// sur connexion mobile pourrie (Dakar/Bamako terrain).
export var PREV_READ_TIMEOUT_MS = 2000;

/**
 * Resout le snapshot precedent pour la detection des deletes du dual-write.
 *
 * @param db Firestore instance
 * @param companyId
 * @param fallback Valeur de repli si le read echoue/timeout (typiquement le React
 *   state courant). JAMAIS `{}` : un fallback vide re-introduit le skip silencieux
 *   des deletes (cf. incident 2026-05-24). Floor = data, jamais pire que pre-fix.
 *
 * @returns Le doc Firestore si lu a temps, sinon `fallback`. NE THROW JAMAIS.
 *   Echec read (timeout ou erreur) -> log via persistMirrorErrors (dedup 60s) +
 *   retourne fallback.
 */
export async function resolvePrevSnapshot(
  db: Firestore,
  companyId: string,
  fallback: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    var snap = await Promise.race([
      getDoc(doc(db, 'companies', companyId)),
      new Promise<never>(function (_, reject) {
        setTimeout(function () { reject(new Error('getDoc-prev timeout')); }, PREV_READ_TIMEOUT_MS);
      }),
    ]);
    if (snap.exists()) {
      return snap.data() as Record<string, unknown>;
    }
    return fallback;
  } catch (e) {
    var msg = e instanceof Error ? e.message : 'fail';
    persistMirrorErrors(db, companyId, {
      ok: false, written: 0, deleted: 0,
      errors: ['prevRead/getDoc : ' + msg], durationMs: 0,
    });
    return fallback;
  }
}
