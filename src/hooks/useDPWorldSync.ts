import { fetchDPWorld, mapDPWorldToPatches } from '../services/dpworld.js';
import { mid } from '../utils/id.js';
import { isNewArrival, generateArrivalStubsWithIds } from '../utils/stub';
import type { Dossier, Conteneur, Depense } from '../types.js';

/**
 * Synchronisation DPWorld (un dossier ou tous). Extraite de useAppLogic dans
 * le refactor E.
 */

export interface DPWorldSyncDeps {
  db: any;
  sv: (data: any) => void;
  wLog: (data: any, did: string, action: string, detail?: string) => any;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void;
  dos: Dossier[];
  tcs: Conteneur[];
}

/**
 * Un element du rapport de sync batch. Decrit les changements sur un dossier
 * precis pour que l'utilisateur puisse identifier ce qui a bouge.
 */
export interface SyncReportItem {
  dosId: string;
  cl: string;
  bl: string;
  changes: string[];       // libelles humains des modifications (ex: "Date arrivee 10/04")
  stubCount: number;       // nombre de factures en attente creees auto
  errored?: boolean;       // BL non trouve chez DPWorld
}

export interface SyncReport {
  items: SyncReportItem[];
  totalChanges: number;
  totalStubs: number;
  errorsBL: string[];      // BLs qui ont erreur
}

export default function useDPWorldSync(p: DPWorldSyncDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf, setMl = p.setMl;
  var dos = p.dos, tcs = p.tcs;

  async function syncDPWorld(dosId: string): Promise<void> {
    var d = dos.find(function (x) { return x.id === dosId; });
    if (!d || !d.bl) { nf("Pas de BL pour ce dossier", "error"); return; }
    try {
      nf("Sync DPWorld...");
      var result = await fetchDPWorld(d.bl);
      var dosTcs = tcs.filter(function (t) { return t.did === dosId; });
      var patch = mapDPWorldToPatches(result.data, dosTcs, d);
      if (Object.keys(patch.dosPatches).length === 0 && patch.tcUpdates.length === 0) {
        nf("Aucune nouveaute DPWorld"); return;
      }
      var patchedDos = Object.assign({}, d, patch.dosPatches) as Dossier;
      var newDos = dos.map(function (x) {
        return x.id === dosId ? patchedDos : x;
      });
      var tcIdMap: Record<string, any> = {};
      patch.tcUpdates.forEach(function (u) { tcIdMap[u.id] = u; });
      var newTcs = tcs.map(function (c) {
        return tcIdMap[c.id] ? Object.assign({}, c, tcIdMap[c.id]) : c;
      });
      // Auto-stub Depenses si DPWorld vient de poser une date d'arrivee
      var existingDep: Depense[] = (db && db.dep) ? db.dep : [];
      var newDep = existingDep;
      var stubSummary = "";
      if (isNewArrival(d, patchedDos)) {
        var stubs = generateArrivalStubsWithIds(patchedDos, existingDep, mid);
        if (stubs.length > 0) {
          newDep = existingDep.concat(stubs);
          stubSummary = " +" + stubs.length + " factures en attente";
        }
      }
      sv(wLog(Object.assign({}, db, { dos: newDos, tcs: newTcs, dep: newDep }), dosId, "SYNC_DPWORLD", patch.summary + stubSummary));
      nf(patch.summary + stubSummary, "ok");
    } catch (e: any) {
      nf("Erreur DPWorld: " + (e.message || "reseau"), "error");
    }
  }

  async function syncAllDPWorld(): Promise<void> {
    var actifs = dos.filter(function (d) { return d.bl && d.st !== "CLOTURE" && d.st !== "ARCHIVE"; });
    if (actifs.length === 0) { nf("Aucun dossier actif avec BL", "error"); return; }
    nf("Sync DPWorld: " + actifs.length + " dossier(s)...");
    var allDosPatches: Record<string, Record<string, any>> = {};
    var allTcUpdates: Record<string, any> = {};
    var changesByDos: Record<string, string[]> = {};  // pour rapport detaille
    var erroredBL: string[] = [];
    var totalChanges = 0;
    // BLs uniques (plusieurs dossiers peuvent avoir le meme BL)
    var blDone: Record<string, any[]> = {};
    for (var i = 0; i < actifs.length; i++) {
      var d = actifs[i];
      try {
        var apiData: any[];
        if (blDone[d.bl]) {
          apiData = blDone[d.bl];
        } else {
          var result = await fetchDPWorld(d.bl);
          apiData = result.data;
          blDone[d.bl] = apiData;
        }
        var dosTcs = tcs.filter(function (t) { return t.did === d.id; });
        var patch = mapDPWorldToPatches(apiData, dosTcs, d);
        if (Object.keys(patch.dosPatches).length > 0) {
          allDosPatches[d.id] = patch.dosPatches;
        }
        if (patch.changes.length > 0) {
          changesByDos[d.id] = patch.changes;
        }
        patch.tcUpdates.forEach(function (u) { allTcUpdates[u.id] = u; });
        totalChanges += Object.keys(patch.dosPatches).length + patch.tcUpdates.length;
      } catch (_e) {
        if (erroredBL.indexOf(d.bl) < 0) erroredBL.push(d.bl);
      }
    }
    if (totalChanges === 0) {
      nf("Aucune nouveaute DPWorld" + (erroredBL.length > 0 ? " (" + erroredBL.length + " BL non trouves)" : ""));
      return;
    }
    var newDos = dos.map(function (x) {
      return allDosPatches[x.id] ? Object.assign({}, x, allDosPatches[x.id]) : x;
    });
    var newTcs = tcs.map(function (c) {
      return allTcUpdates[c.id] ? Object.assign({}, c, allTcUpdates[c.id]) : c;
    });
    // Auto-stub : pour chaque dossier qui vient de recevoir une date d'arrivee
    var existingDep: Depense[] = (db && db.dep) ? db.dep : [];
    var accumulatedDep = existingDep;
    var totalStubs = 0;
    var stubCountByDos: Record<string, number> = {};
    newDos.forEach(function (newX) {
      if (!allDosPatches[newX.id]) return;
      var old = dos.find(function (y) { return y.id === newX.id; });
      if (old && isNewArrival(old, newX)) {
        var stubs = generateArrivalStubsWithIds(newX, accumulatedDep, mid);
        if (stubs.length > 0) {
          accumulatedDep = accumulatedDep.concat(stubs);
          totalStubs += stubs.length;
          stubCountByDos[newX.id] = stubs.length;
        }
      }
    });

    // Construire le rapport detaille pour la modale
    var reportItems: SyncReportItem[] = [];
    newDos.forEach(function (x) {
      if (!allDosPatches[x.id] && !stubCountByDos[x.id]) return;
      reportItems.push({
        dosId: x.id,
        cl: x.cl || "",
        bl: x.bl || "",
        changes: changesByDos[x.id] || [],
        stubCount: stubCountByDos[x.id] || 0,
      });
    });
    // Trier par nombre de changements decroissant
    reportItems.sort(function (a, b) {
      return (b.changes.length + b.stubCount) - (a.changes.length + a.stubCount);
    });
    var report: SyncReport = {
      items: reportItems,
      totalChanges: totalChanges,
      totalStubs: totalStubs,
      errorsBL: erroredBL,
    };

    var summary = reportItems.length + " dossier(s) synchronise(s)" + (totalStubs > 0 ? " +" + totalStubs + " facture(s) en attente" : "") + (erroredBL.length > 0 ? " (" + erroredBL.length + " BL non trouve(s))" : "");
    sv(wLog(Object.assign({}, db, { dos: newDos, tcs: newTcs, dep: accumulatedDep }), "", "SYNC_DPWORLD_ALL", summary));
    nf(summary, "ok");
    // Ouvrir la modale rapport pour que l'utilisateur identifie les dossiers modifies
    setMl({ t: "syncreport", report: report });
  }

  return { syncDPWorld, syncAllDPWorld };
}
