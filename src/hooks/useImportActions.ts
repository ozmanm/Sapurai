import { mid } from '../utils/id.js';
import { today } from '../utils/date.js';
import type { Dossier, Conteneur, Depense, Chauffeur } from '../types.js';

/**
 * Import bulk de dossiers + depenses + chauffeurs.
 * Extraite de useAppLogic dans le refactor E.
 */

export interface ImportActionsDeps {
  db: any;
  sv: (data: any) => void;
  nf: (m: string, t?: string) => void;
  dos: Dossier[];
  tcs: Conteneur[];
  chs: Chauffeur[];
  dep: Depense[];
  logs: any[];
}

export default function useImportActions(p: ImportActionsDeps) {
  var db = p.db, sv = p.sv, nf = p.nf;
  var dos = p.dos, tcs = p.tcs, chs = p.chs, dep = p.dep, logs = p.logs;

  function bulkImport(dossiers: any[], deps2?: any[], chs2?: any[]): void {
    var todayStr = today();
    var newDos = dos.slice(), newTcs = tcs.slice(), newDep = dep.slice(), newChs = chs.slice();
    var newLogs = (logs || []).slice();
    var blToId: Record<string, string> = {};
    // Index des BL et TC existants pour detection doublons
    var existingBlMap: Record<string, string> = {};
    dos.forEach(function (d) { if (d.bl) existingBlMap[d.bl.toUpperCase()] = d.id; });
    var existingTcNums: Record<string, boolean> = {};
    newTcs.forEach(function (c) { if (c.n) existingTcNums[c.n.toUpperCase()] = true; });
    var nCreated = 0, nSkippedBl = 0, nSkippedTc = 0, nMergedTc = 0;
    dossiers.forEach(function (d) {
      var blKey = (d.bl || "").toUpperCase();
      var existingId = existingBlMap[blKey];
      if (existingId) {
        // BL existe deja — fusionner les nouveaux TCs au dossier existant
        blToId[d.bl] = existingId;
        nSkippedBl++;
        var tcArr = d.tcs || [];
        var addedTc = 0;
        tcArr.forEach(function (t: any) {
          if (t.n && !existingTcNums[t.n.toUpperCase()]) {
            newTcs.push({ id: mid(), did: existingId, n: t.n, ty: t.ty || "20GP", po: t.po || 0, st: d.da && d.da > todayStr ? "ATTENDU" : "PORT" });
            existingTcNums[t.n.toUpperCase()] = true;
            addedTc++;
            nMergedTc++;
          } else if (t.n) {
            nSkippedTc++;
          }
        });
        if (addedTc > 0) {
          newLogs.push({ id: mid(), did: existingId, dt: new Date().toISOString(), ac: "FUSION_IMPORT", ds: (d.bl || "") + " — " + String(addedTc) + " TC ajoutes [import fusion]" });
        }
      } else {
        // Nouveau dossier
        var id = mid();
        blToId[d.bl] = id;
        existingBlMap[blKey] = id;
        var nd = Object.assign({}, d, { id: id, st: "INITIALISE" });
        delete nd.tcs; delete nd.nbTc; delete nd.defType; delete nd.comment; delete nd.status;
        newDos.push(nd);
        var tcArr2 = d.tcs || [];
        tcArr2.forEach(function (t: any) {
          if (t.n && !existingTcNums[t.n.toUpperCase()]) {
            newTcs.push({ id: mid(), did: id, n: t.n, ty: t.ty || "20GP", po: t.po || 0, st: d.da && d.da > todayStr ? "ATTENDU" : "PORT" });
            existingTcNums[t.n.toUpperCase()] = true;
          } else if (t.n) {
            nSkippedTc++;
          }
        });
        newLogs.push({ id: mid(), did: id, dt: new Date().toISOString(), ac: "CREATION", ds: (d.cl || "") + " - " + (d.bl || "") + " (" + String(tcArr2.filter(function (t: any) { return t.n; }).length) + " TC) [import]" });
        nCreated++;
      }
    });
    if (deps2 && deps2.length > 0) {
      deps2.forEach(function (f: any) {
        var did = blToId[f.bl] || "";
        if (!did) return;
        newDep.push({ id: mid(), did: did, tp: f.tp || "AUTRE", nf: f.nf || "", ht: f.ht || 0, mt: f.mt || f.ht || 0, dt: f.dt || "", s: f.s || "ATT", ds: f.ds || "" });
      });
    }
    if (chs2 && chs2.length > 0) {
      chs2.forEach(function (c: any) {
        if (!newChs.some(function (x) { return x.nm === c.nm && x.cm === c.cm; })) {
          newChs.push({ id: mid(), nm: c.nm, cm: c.cm || "", tl: c.tl || "", pm: c.pm || 0, tty: c.tty || [] });
        }
      });
    }
    if (newLogs.length > 500) newLogs = newLogs.slice(newLogs.length - 500);
    sv(Object.assign({}, db, { dos: newDos, tcs: newTcs, dep: newDep, chs: newChs, logs: newLogs }));
    // Notification detaillee
    var parts: string[] = [];
    if (nCreated > 0) parts.push(String(nCreated) + " crees");
    if (nSkippedBl > 0) parts.push(String(nSkippedBl) + " doublon(s) BL");
    if (nMergedTc > 0) parts.push(String(nMergedTc) + " TC fusionnes");
    if (nSkippedTc > 0) parts.push(String(nSkippedTc) + " TC doublon(s) ignores");
    nf(parts.join(", ") || "Import termine");
  }

  return { bulkImport };
}
