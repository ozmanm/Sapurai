import { fetchCarrier, mapCarrierToPatches, detectCarrier, CARRIER_LABELS } from '../services/carriers';
import { mid } from '../utils/id.js';
import { isNewArrival, generateArrivalStubsWithIds } from '../utils/stub';
import type { Dossier, Conteneur, Depense } from '../types.js';

/**
 * Synchronisation generique armateur : un seul bouton, detection auto.
 * Scope minimal : juste la date d'arrivee + ajout TC manquants.
 *
 * Pour les BAD/BAE/Pregate, l'utilisateur doit toujours faire Sync DPWorld
 * (donnees specifiques au port de Dakar, pas dispo cote armateur).
 */

export interface CarrierSyncDeps {
  db: any;
  sv: (data: any) => void;
  wLog: (data: any, did: string, action: string, detail?: string) => any;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void;
  dos: Dossier[];
  tcs: Conteneur[];
}

export default function useCarrierSync(p: CarrierSyncDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf;
  var dos = p.dos, tcs = p.tcs;

  async function syncCarrier(dosId: string): Promise<void> {
    var d = dos.find(function (x) { return x.id === dosId; });
    if (!d || !d.bl) { nf('Pas de BL pour ce dossier', 'error'); return; }
    var carrier = detectCarrier(d.bl, d.cp);
    if (!carrier) {
      nf('Armateur non detecte. Renseignez la compagnie sur le dossier.', 'error');
      return;
    }
    try {
      nf('Sync ' + (CARRIER_LABELS[carrier] || carrier) + '...');
      var resp = await fetchCarrier(d.bl, d.cp);
      if (!resp.ok) {
        nf('Erreur : ' + (resp.error || 'inconnu'), 'error');
        return;
      }
      var dosTcs = tcs.filter(function (t) { return t.did === dosId; });
      var patches = mapCarrierToPatches(resp, dosTcs, d);
      // Poser lastCarrierSync meme si rien n'a change pour eviter de re-bruler
      // le quota CMA (20/h). On enregistre toujours l'horodatage de la sync reussie.
      patches.dosPatches.lastCarrierSync = new Date().toISOString();
      if (Object.keys(patches.dosPatches).length === 1 && patches.newTcs.length === 0) {
        // Rien d'autre que lastCarrierSync : on persiste juste le tampon temporel
        // sans creer un log SYNC_CARRIER bruyant, mais on notifie l'agent.
        var newDosListLight = dos.map(function (x) { return x.id === dosId ? Object.assign({}, x, patches.dosPatches) : x; });
        sv(Object.assign({}, db, { dos: newDosListLight }));
        nf(patches.summary || 'Aucune nouveaute');
        return;
      }
      var patchedDos = Object.assign({}, d, patches.dosPatches) as Dossier;
      var newDosList = dos.map(function (x) { return x.id === dosId ? patchedDos : x; });

      // Ajout des TC manquants detectes par le carrier
      var newTcsCreated = patches.newTcs.map(function (nt: any) {
        return {
          id: mid(),
          did: dosId,
          n: nt.n,
          ty: nt.ty || '20GP',
          po: 0,
          st: patchedDos.da && patchedDos.da > new Date().toISOString().slice(0, 10) ? 'ATTENDU' : 'PORT',
        };
      });
      var newTcsList = tcs.concat(newTcsCreated);

      // Auto-stub Depenses si la sync pose la 1ere date d'arrivee
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

      sv(wLog(
        Object.assign({}, db, { dos: newDosList, tcs: newTcsList, dep: newDep }),
        dosId,
        'SYNC_CARRIER',
        (CARRIER_LABELS[carrier] || carrier) + ' : ' + patches.summary + stubSummary,
      ));
      nf((CARRIER_LABELS[carrier] || carrier) + ' : ' + patches.summary + stubSummary + (resp.cached ? ' (cache)' : ''), 'ok');
    } catch (e: any) {
      nf('Erreur sync : ' + (e.message || 'reseau'), 'error');
    }
  }

  return { syncCarrier };
}
