import { fetchCMA, mapCMAToPatches } from '../services/cma';
import { reconcileDossierState } from '../domain/invariants';
import { mid } from '../utils/id.js';
import { isNewArrival, generateArrivalStubsWithIds } from '../utils/stub';
import type { Dossier, Conteneur, Depense } from '../types.js';

/**
 * Synchronisation CMA-CGM (un seul dossier a la fois — pas de Sync All
 * a cause du quota strict 20/h).
 *
 * Pattern identique a useDPWorldSync :
 *  - Appelle le Worker cma-proxy (Cloudflare)
 *  - Mappe la reponse via mapCMAToPatches
 *  - Patche dos + tcs + cree stubs si nouvelle arrivee
 *  - Logue dans wLog
 */

export interface CMASyncDeps {
  db: any;
  sv: (data: any) => void;
  wLog: (data: any, did: string, action: string, detail?: string) => any;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void;
  dos: Dossier[];
  tcs: Conteneur[];
}

export default function useCMASync(p: CMASyncDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf;
  var dos = p.dos, tcs = p.tcs;

  async function syncCMA(dosId: string): Promise<void> {
    var d = dos.find(function (x) { return x.id === dosId; });
    if (!d || !d.bl) { nf('Pas de BL pour ce dossier', 'error'); return; }
    if (!d.cp || d.cp.toUpperCase().indexOf('CMA') < 0) {
      nf('Ce dossier n\'est pas chez CMA-CGM', 'error');
      return;
    }
    try {
      nf('Sync CMA-CGM...');
      var result = await fetchCMA({ bl: d.bl });
      if (!result.ok) {
        nf('Erreur CMA: ' + (result.error || 'inconnu'), 'error');
        return;
      }
      var dosTcs = tcs.filter(function (t) { return t.did === dosId; });
      var patch = mapCMAToPatches(result.data, dosTcs, d);
      if (Object.keys(patch.dosPatches).length === 0 && patch.tcUpdates.length === 0) {
        nf(result.cached ? 'Aucune nouveaute CMA (cache)' : 'Aucune nouveaute CMA');
        return;
      }
      var patchedDos = Object.assign({}, d, patch.dosPatches) as Dossier;
      var newDos = dos.map(function (x) { return x.id === dosId ? patchedDos : x; });
      var tcIdMap: Record<string, any> = {};
      patch.tcUpdates.forEach(function (u) { tcIdMap[u.id] = u; });
      var newTcs = tcs.map(function (c) { return tcIdMap[c.id] ? Object.assign({}, c, tcIdMap[c.id]) : c; });

      // Auto-stub Depenses si CMA pose une date d'arrivee pour la 1ere fois
      var existingDep: Depense[] = (db && db.dep) ? db.dep : [];
      var newDep = existingDep;
      var stubSummary = '';
      if (isNewArrival(d, patchedDos)) {
        var stubs = generateArrivalStubsWithIds(patchedDos, existingDep, mid);
        if (stubs.length > 0) {
          newDep = existingDep.concat(stubs);
          stubSummary = ' +' + stubs.length + ' factures en attente';
        }
      }
      // Sprint 41 F41.4 - reconcile au save (cf. useDPWorldSync)
      var reconciled = reconcileDossierState(newDos, newTcs);
      sv(wLog(Object.assign({}, db, { dos: reconciled.dos, tcs: reconciled.tcs, dep: newDep }), dosId, 'SYNC_CMA', patch.summary + stubSummary));
      nf(patch.summary + stubSummary + (result.cached ? ' (cache)' : ''), 'ok');
    } catch (e: any) {
      nf('Erreur CMA: ' + (e.message || 'reseau'), 'error');
    }
  }

  return { syncCMA };
}
