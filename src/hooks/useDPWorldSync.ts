/**
 * Synchronisation DPWorld (un dossier ou tous). Extraite de useAppLogic dans
 * le refactor E.
 *
 * Lot 1 : sync par TC individuel, predicat base sur champs dpw* (pas tc.st).
 */

import { fetchDPWorld, mapDPWorldToPatches, mapTcDPWorld, detectTcConflict } from '../services/dpworld.js';
import { mid } from '../utils/id.js';
import { isNewArrival, generateArrivalStubsWithIds } from '../utils/stub';
import type { Dossier, Conteneur, Depense } from '../types.js';

/**
 * Indique si une compagnie maritime decharge a Dakar via le terminal DPWorld.
 * Les armateurs RO-RO (Grimaldi) ont leur propre terminal et ne sont pas
 * indexes dans DPWorld -> sync inutile et bruyante.
 */
function isDPWorldEligibleCarrier(cp: string | undefined | null): boolean {
  if (!cp) return true;
  var c = String(cp).toUpperCase();
  if (c.indexOf('GRIMALDI') >= 0) return false;
  return true;
}

export interface DPWorldSyncDeps {
  db: any;
  sv: (data: any) => void;
  wLog: (data: any, did: string, action: string, detail?: string) => any;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void;
  dos: Dossier[];
  tcs: Conteneur[];
}

export interface SyncReportItem {
  dosId: string;
  cl: string;
  bl: string;
  changes: string[];
  stubCount: number;
  errored?: boolean;
}

export interface SyncReport {
  items: SyncReportItem[];
  totalChanges: number;
  totalStubs: number;
  errorsBL: string[];
}

/**
 * needsDPWorldSync — predicat individuel par TC.
 * NE depend PAS de tc.st local mais uniquement des champs dpw*.
 */
function needsDPWorldSync(tc: Conteneur): boolean {
  if (!tc.dpwSyncedAt) return true;
  if (tc.dpwConflict) return true;
  if (tc.dpwVisitState === '3DEPARTED' && tc.dpwTimeOut) return false;
  return true;
}

export default function useDPWorldSync(p: DPWorldSyncDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf, setMl = p.setMl;
  var dos = p.dos, tcs = p.tcs;

  /**
   * syncTcDPWorld — synchronisation chirurgicale d'un TC individuel.
   * Interroge DPWorld par numero TC, ne touche pas au dossier pere.
   */
  async function syncTcDPWorld(tcid: string, opts?: { force?: boolean }): Promise<void> {
    var tc = tcs.find(function (c) { return c.id === tcid; });
    if (!tc || !tc.n) { nf("TC sans numero", "error"); return; }
    var d = dos.find(function (x) { return x.id === tc.did; });
    if (!d) { nf("Dossier introuvable", "error"); return; }
    if (!isDPWorldEligibleCarrier(d.cp)) {
      nf("Compagnie non DPWorld", "ok"); return;
    }
    if (!opts?.force && !needsDPWorldSync(tc)) {
      nf("TC deja confirme par DPWorld", "ok"); return;
    }

    try {
      nf("Sync TC " + tc.n + "...");
      var result = await fetchDPWorld(tc.n);
      var dpTc = (result.data || []).find(function (x: any) {
        return x.id.toUpperCase().replace(/[\s\-]/g, '') === tc.n!.toUpperCase().replace(/[\s\-]/g, '');
      });
      if (!dpTc) {
        // Persister NOT_FOUND
        var now = new Date().toISOString();
        var newTcsNotFound = tcs.map(function (c) {
          return c.id === tcid ? Object.assign({}, c, { dpwSyncedAt: now, dpwConflict: { type: 'NOT_FOUND', note: 'TC introuvable chez DPWorld', at: now } }) : c;
        });
        sv(wLog(Object.assign({}, db, { tcs: newTcsNotFound }), tc.did || "", "SYNC_TC_DPWORLD", tc.n + " introuvable"));
        nf(tc.n + " introuvable chez DPWorld", "warning");
        return;
      }

      var patch = mapTcDPWorld(tc, dpTc);
      var merged = Object.assign({}, tc, patch);
      var conflict = detectTcConflict(merged, dpTc);
      var newConflict = conflict ?? null;
      var currentConflict = tc.dpwConflict ?? null;

      var fullPatch: Record<string, any> = { id: tcid, dpwSyncedAt: patch.dpwSyncedAt };
      // Appliquer st/dsp si present
      if (patch.st) fullPatch.st = patch.st;
      if (patch.dsp) fullPatch.dsp = patch.dsp;
      // Toujours appliquer les champs dpw bruts
      if (patch.dpwAta !== undefined) fullPatch.dpwAta = patch.dpwAta;
      if (patch.dpwDischarge !== undefined) fullPatch.dpwDischarge = patch.dpwDischarge;
      if (patch.dpwTimeIn !== undefined) fullPatch.dpwTimeIn = patch.dpwTimeIn;
      if (patch.dpwTimeOut !== undefined) fullPatch.dpwTimeOut = patch.dpwTimeOut;
      if (patch.dpwVisitState !== undefined) fullPatch.dpwVisitState = patch.dpwVisitState;
      // dpwConflict seulement si changement
      if (currentConflict !== newConflict) fullPatch.dpwConflict = newConflict;

      var newTcs = tcs.map(function (c) { return c.id === tcid ? Object.assign({}, c, fullPatch) : c; });
      var detail = tc.n + ": " + (patch.changes.length > 0 ? patch.changes.join(", ") : "pas de changement") + (conflict ? " (conflit)" : "");
      sv(wLog(Object.assign({}, db, { tcs: newTcs }), tc.did || "", "SYNC_TC_DPWORLD", detail));
      nf(detail, conflict ? "warning" : "ok");
    } catch (e: any) {
      nf("Erreur DPWorld: " + (e.message || "reseau"), "error");
    }
  }

  /**
   * syncDPWorld — synchronisation d'un dossier entier.
   * Un appel fetchDPWorld(bl), puis traitement TC par TC.
   * Seuls les TC ayant besoin de sync (needsDPWorldSync) sont traites.
   */
  async function syncDPWorld(dosId: string, opts?: { force?: boolean }): Promise<void> {
    var d = dos.find(function (x) { return x.id === dosId; });
    if (!d || !d.bl) { nf("Pas de BL pour ce dossier", "error"); return; }
    if (!isDPWorldEligibleCarrier(d.cp)) return;

    var dosTcs = tcs.filter(function (t) { return t.did === dosId; });
    var tcsToSync = opts?.force ? dosTcs : dosTcs.filter(needsDPWorldSync);

    if (tcsToSync.length === 0) {
      nf("Tous les TC sont confirmes par DPWorld", "ok");
      return;
    }

    try {
      nf("Sync DPWorld...");
      var result = await fetchDPWorld(d.bl);
      var patch = mapDPWorldToPatches(result.data, tcsToSync, d);

      // Si conflits detectes, les propager dans les TC
      var conflictMap: Record<string, any> = {};
      patch.conflicts.forEach(function (c) { conflictMap[c.tcid] = c.conflict; });

      var patchedDos = Object.assign({}, d, patch.dosPatches) as Dossier;
      var newDos = dos.map(function (x) {
        return x.id === dosId ? patchedDos : x;
      });

      var tcIdMap: Record<string, any> = {};
      patch.tcUpdates.forEach(function (u) { tcIdMap[u.id] = u; });
      var newTcs = tcs.map(function (c) {
        var base = tcIdMap[c.id] ? Object.assign({}, c, tcIdMap[c.id]) : c;
        // Propager conflit si pas deja dans tcUpdates
        if (conflictMap[c.id] && !tcIdMap[c.id]) {
          return Object.assign({}, base, { dpwConflict: conflictMap[c.id] });
        }
        return base;
      });

      if (Object.keys(patch.dosPatches).length === 0 && patch.tcUpdates.length === 0 && Object.keys(conflictMap).length === 0) {
        nf("Aucune nouveaute DPWorld"); return;
      }

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

      var summary = patch.summary + stubSummary;
      sv(wLog(Object.assign({}, db, { dos: newDos, tcs: newTcs, dep: newDep }), dosId, "SYNC_DPWORLD", summary));
      nf(summary, "ok");
    } catch (e: any) {
      nf("Erreur DPWorld: " + (e.message || "reseau"), "error");
    }
  }

  /**
   * syncAllDPWorld — batch tous les dossiers actifs avec BL.
   */
  async function syncAllDPWorld(): Promise<void> {
    var actifs = dos.filter(function (d) {
      if (!d.bl || d.st === "CLOTURE" || d.st === "ARCHIVE") return false;
      if (!isDPWorldEligibleCarrier(d.cp)) return false;
      return true;
    });
    if (actifs.length === 0) { nf("Aucun dossier actif avec BL", "error"); return; }
    nf("Sync DPWorld: " + actifs.length + " dossier(s)...");

    var allDosPatches: Record<string, Record<string, any>> = {};
    var allTcUpdates: Record<string, any> = {};
    var allConflicts: Record<string, any> = {};
    var changesByDos: Record<string, string[]> = {};
    var erroredBL: string[] = [];
    var totalChanges = 0;
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
        var tcsToSync = dosTcs.filter(needsDPWorldSync);
        var patch = mapDPWorldToPatches(apiData, tcsToSync, d);

        if (Object.keys(patch.dosPatches).length > 0) {
          allDosPatches[d.id] = patch.dosPatches;
        }
        if (patch.changes.length > 0) {
          changesByDos[d.id] = patch.changes;
        }
        patch.tcUpdates.forEach(function (u) { allTcUpdates[u.id] = u; });
        patch.conflicts.forEach(function (c) { allConflicts[c.tcid] = c.conflict; });
        totalChanges += Object.keys(patch.dosPatches).length + patch.tcUpdates.length + patch.conflicts.length;
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
      var base = allTcUpdates[c.id] ? Object.assign({}, c, allTcUpdates[c.id]) : c;
      if (allConflicts[c.id] && !allTcUpdates[c.id]) {
        return Object.assign({}, base, { dpwConflict: allConflicts[c.id] });
      }
      return base;
    });

    // Auto-stub
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

    // Rapport
    var reportItems: SyncReportItem[] = [];
    newDos.forEach(function (x) {
      if (!allDosPatches[x.id] && !stubCountByDos[x.id] && !changesByDos[x.id]) return;
      reportItems.push({
        dosId: x.id,
        cl: x.cl || "",
        bl: x.bl || "",
        changes: changesByDos[x.id] || [],
        stubCount: stubCountByDos[x.id] || 0,
      });
    });
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
    setMl({ t: "syncreport", report: report });
  }

  return { syncDPWorld, syncAllDPWorld, syncTcDPWorld };
}
