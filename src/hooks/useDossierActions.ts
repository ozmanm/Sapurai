import { mid } from '../utils/id.js';
import { today } from '../utils/date.js';
import { DL } from '../constants/statuts.js';
import { isNewArrival, generateArrivalStubsWithIds } from '../utils/stub';
import type { Dossier, Conteneur, Depense } from '../types.js';

/**
 * Actions CRUD sur les dossiers + gestion caution.
 * Extraite de useAppLogic dans le refactor E (split).
 */

export interface DossierActionsDeps {
  db: any;
  sv: (data: any) => void;
  wLog: (data: any, did: string, action: string, detail?: string) => any;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void;
  sendNotif?: (to: string, msg: string) => void;
  dos: Dossier[];
  tcs: Conteneur[];
  dep: Depense[];
  ml: any;
}

export default function useDossierActions(p: DossierActionsDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf, setMl = p.setMl, sendNotif = p.sendNotif;
  var dos = p.dos, tcs = p.tcs, dep = p.dep, ml = p.ml;

  function deleteDos(id: string): void {
    var d = dos.find(function (x) { return x.id === id; });
    sv(wLog(Object.assign({}, db, {
      dos: dos.filter(function (x) { return x.id !== id; }),
      tcs: tcs.filter(function (c) { return c.did !== id; }),
      dep: dep.filter(function (f) { return f.did !== id; })
    }), id, "SUPPR_DOSSIER", (d ? d.cl + " - " + d.bl : "")));
    nf("Dossier + TC + depenses supprimes", "error");
    if (ml && ml.t === "det" && ml.did === id) setMl(null);
  }

  function bulkDeleteDos(ids: string[]): void {
    var idsSet = new Set(ids);
    sv(wLog(Object.assign({}, db, {
      dos: dos.filter(function (x) { return !idsSet.has(x.id); }),
      tcs: tcs.filter(function (c) { return !idsSet.has(c.did); }),
      dep: dep.filter(function (f) { return !idsSet.has(f.did); })
    }), ids.join(","), "SUPPR_BULK", ids.length + " dossiers"));
    nf(ids.length + " dossier" + (ids.length > 1 ? "s" : "") + " supprimes", "error");
    if (ml && ml.t === "det" && idsSet.has(ml.did)) setMl(null);
  }

  function addDos(f: any, tcl: any[]): void {
    if (f.bl && dos.some(function (d) { return d.bl && d.bl.toUpperCase() === f.bl.toUpperCase(); })) {
      nf("Ce BL existe deja (" + f.bl + ")", "error");
      return;
    }
    var todayStr = today();
    var id = mid();
    var tokId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    var nd = Object.assign({}, f, { id: id, st: "INITIALISE", tokId: tokId });
    var tcSt = f.da && f.da > todayStr ? "ATTENDU" : "PORT";
    var existingNums: Record<string, boolean> = {};
    tcs.forEach(function (c) { if (c.n) existingNums[c.n.toUpperCase()] = true; });
    var unique = tcl.filter(function (t) { return t.n && !existingNums[t.n.toUpperCase()]; });
    var dupes = tcl.filter(function (t) { return t.n && existingNums[t.n.toUpperCase()]; });
    var nt = unique.map(function (t) { return { id: mid(), did: id, n: t.n, ty: t.ty, po: t.po, st: tcSt }; });
    sv(wLog(Object.assign({}, db, { dos: dos.concat([nd]), tcs: tcs.concat(nt) }), id, "CREATION", (f.cl || "") + " - " + (f.bl || "") + " (" + String(nt.length) + " TC)"));
    if (dupes.length > 0) nf(String(dupes.length) + " TC doublon(s) ignore(s)", "warning");
    nf("Dossier cree"); setMl(null);
  }

  function editDos(id: string, f: any, tcl: any[]): void {
    var todayStr = today();
    var kept = tcs.filter(function (c) { return c.did !== id || (c.st !== "PORT" && c.st !== "ATTENDU"); });
    var editTcSt = f.da && f.da > todayStr ? "ATTENDU" : "PORT";
    var newP = tcl.filter(function (t) { return t.n; }).map(function (t) { return { id: mid(), did: id, n: t.n, ty: t.ty, po: t.po, st: editTcSt }; });

    // Auto-stub Depenses si arrivee nouvellement renseignee (da absent → present)
    var oldDos = dos.find(function (d) { return d.id === id; });
    var newDos = Object.assign({}, oldDos || {}, f);
    var newDosList = dos.map(function (d) { return d.id === id ? newDos : d; });
    var newDep = dep;
    if (isNewArrival(oldDos, newDos as Dossier)) {
      var stubs = generateArrivalStubsWithIds(newDos as Dossier, dep, mid);
      if (stubs.length > 0) {
        newDep = dep.concat(stubs);
      }
    } else if (oldDos && oldDos.da && newDos.da && oldDos.da !== newDos.da) {
      // Bug 6 : si la date d'arrivee change, recaler le dt des stubs auto
      // (en_attente_facture, mt=0) sur la nouvelle date pour eviter les rappels obsoletes.
      newDep = dep.map(function (e) {
        if (e.did !== id) return e;
        if (!e.auto || e.status !== "en_attente_facture" || (e.mt || 0) > 0) return e;
        return Object.assign({}, e, { dt: newDos.da });
      });
    }

    sv(wLog(Object.assign({}, db, { dos: newDosList, tcs: kept.concat(newP), dep: newDep }), id, "MODIF_DOSSIER", (f.cl || "") + " - " + (f.bl || "")));
    // Notify agents if new tasks were assigned
    if (sendNotif && f.itv) {
      var oldDos = dos.find(function (d) { return d.id === id; });
      var oldItv: any[] = oldDos ? (oldDos.itv || []) : [];
      (f.itv || []).forEach(function (iv: any) {
        var oldIv = oldItv.find(function (o: any) { return o.id === iv.id; });
        var oldTaches = oldIv ? (oldIv.taches || []) : [];
        var added = (iv.taches || []).filter(function (t: any) { return oldTaches.indexOf(t) < 0; });
        if (added.length > 0) sendNotif(iv.nm, "Nouvelles taches sur : " + (f.cl || ""));
      });
    }
    nf("Dossier modifie"); setMl(null);
  }

  function closeDos(dosId: string): void {
    var d = dos.find(function (x) { return x.id === dosId; });
    sv(wLog(Object.assign({}, db, { dos: dos.map(function (x) { return x.id === dosId ? Object.assign({}, x, { st: "CLOTURE" }) : x; }) }), dosId, "CLOTURE", (d ? d.cl + " - " + d.bl : "")));
    nf("Dossier cloture"); setMl(null);
  }

  function archiveDos(dosId: string): void {
    var d = dos.find(function (x) { return x.id === dosId; });
    sv(wLog(Object.assign({}, db, { dos: dos.map(function (x) { return x.id === dosId ? Object.assign({}, x, { st: "ARCHIVE" }) : x; }) }), dosId, "ARCHIVE", (d ? d.cl + " - " + d.bl : "")));
    nf("Dossier archive"); setMl(null);
  }

  function setDosSt(dosId: string, ns: string): void {
    sv(wLog(Object.assign({}, db, { dos: dos.map(function (x) { return x.id === dosId ? Object.assign({}, x, { st: ns }) : x; }) }), dosId, "STATUT", DL[ns] || ns));
    nf("Statut -> " + (DL[ns] || ns));
  }

  function patchDos(dosId: string, fields: Record<string, any>): void {
    var d = dos.find(function (x) { return x.id === dosId; });
    var newDos = d ? Object.assign({}, d, fields) : null;
    var newDosList = dos.map(function (x) { return x.id === dosId ? Object.assign({}, x, fields) : x; });

    // Auto-stub Depenses si patch pose une date arrivee sur un dossier qui n'en avait pas
    var newDep = dep;
    if (d && newDos && isNewArrival(d, newDos as Dossier)) {
      var stubs = generateArrivalStubsWithIds(newDos as Dossier, dep, mid);
      if (stubs.length > 0) {
        newDep = dep.concat(stubs);
      }
    } else if (d && d.da && newDos && newDos.da && d.da !== newDos.da) {
      // Bug 6 : recaler dt des stubs auto sur la nouvelle date d'arrivee
      newDep = dep.map(function (e) {
        if (e.did !== dosId) return e;
        if (!e.auto || e.status !== "en_attente_facture" || (e.mt || 0) > 0) return e;
        return Object.assign({}, e, { dt: newDos.da });
      });
    }

    sv(wLog(Object.assign({}, db, { dos: newDosList, dep: newDep }), dosId, "MODIF_DOSSIER", Object.keys(fields).join(", ") + " — " + (d ? d.cl + " " + d.bl : "")));
  }

  function updateGarantie(dosId: string, statut: string): void {
    var d = dos.find(function (x) { return x.id === dosId; });
    var newDosList = dos.map(function (x) {
      if (x.id !== dosId) return x;
      return Object.assign({}, x, { gar_statut: statut });
    });

    // Sprint D.3 : auto-creer les Depenses caution + lettre quand statut passe a VERSEE
    var newDep = dep;
    if (d && statut === "VERSEE" && d.gar_statut !== "VERSEE") {
      var todayStr = today();
      var alreadyHasCaut = dep.some(function (e: any) { return e.did === dosId && e.categorie === "caution"; });
      var alreadyHasGarantie = dep.some(function (e: any) { return e.did === dosId && e.categorie === "lettre_garantie"; });
      var newEntries: any[] = [];
      if (!alreadyHasCaut && (d.gar_caution || 0) > 0) {
        newEntries.push({
          id: mid(), did: dosId, tp: "CAUTION",
          mt: d.gar_caution, ht: d.gar_caution,
          dt: todayStr,
          ds: "Caution versee" + (d.gar_contact ? " (" + d.gar_contact + ")" : ""),
          s: "PAYE",
          status: "payee",
          auto: true,
          categorie: "caution",
        });
      }
      if (!alreadyHasGarantie && (d.gar_frais || 0) > 0) {
        newEntries.push({
          id: mid(), did: dosId, tp: "GARANTIE",
          mt: d.gar_frais, ht: d.gar_frais,
          dt: todayStr,
          ds: "Lettre de garantie" + (d.gar_contact ? " (" + d.gar_contact + ")" : ""),
          s: "PAYE",
          status: "payee",
          auto: true,
          categorie: "lettre_garantie",
        });
      }
      if (newEntries.length > 0) newDep = dep.concat(newEntries);
    }

    sv(Object.assign({}, db, { dos: newDosList, dep: newDep }));
    nf("Statut caution mis a jour");
  }

  function markTaskDone(dosId: string, itvId: string, taskKey: string, done: boolean): void {
    var newDos = dos.map(function (d) {
      if (d.id !== dosId) return d;
      var newItv = (d.itv || []).map(function (iv: any) {
        if (iv.id !== itvId) return iv;
        var td: string[] = iv.tachesDone ? iv.tachesDone.slice() : [];
        if (done) { if (td.indexOf(taskKey) < 0) td = td.concat([taskKey]); }
        else { td = td.filter(function (k: string) { return k !== taskKey; }); }
        return Object.assign({}, iv, { tachesDone: td });
      });
      return Object.assign({}, d, { itv: newItv });
    });
    sv(Object.assign({}, db, { dos: newDos }));
    nf(done ? "Tache marquee OK" : "Tache repassee en attente");
  }

  return {
    deleteDos, bulkDeleteDos, addDos, editDos,
    closeDos, archiveDos, setDosSt, patchDos, updateGarantie,
    markTaskDone,
  };
}
