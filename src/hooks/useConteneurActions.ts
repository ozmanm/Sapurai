import { mid } from '../utils/id.js';
import { today } from '../utils/date.js';
import { fm, tcSum } from '../utils/format.js';
import { SL } from '../constants/statuts.js';
import { TPHASES } from '../constants/depenses.js';
import { applyAutoStatus } from '../utils/dossierStatus';
import { getFranchiseRetourVide, joursSurestariesPort, joursDetention } from '../utils/franchise';
import { canTcTransition } from '../domain/tcStateMachine';
import { canDispatchTc, canAdvanceTc, canAssignTc } from '../domain/invariants';
import type { Dossier, Conteneur, Depense, Config, Chauffeur } from '../types.js';

/**
 * Actions sur les conteneurs (dispatch, advance, updateTcDate) + helpers derives
 * (humanPhrase, tcFranchise). Extraite de useAppLogic dans le refactor E.
 */

export interface ConteneurActionsDeps {
  db: any;
  sv: (data: any) => void;
  wLog: (data: any, did: string, action: string, detail?: string) => any;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void;
  dos: Dossier[];
  tcs: Conteneur[];
  dep: Depense[];
  chs: Chauffeur[];
  cfg: Config;
}

export default function useConteneurActions(p: ConteneurActionsDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf, setMl = p.setMl;
  var dos = p.dos, tcs = p.tcs, dep = p.dep, chs = p.chs, cfg = p.cfg;

  /**
   * Dispatch d'un TC vers un chauffeur.
   *
   * Si `newChData` est fourni (mode "creation inline" depuis DispForm), le
   * chauffeur est cree dans la meme transaction sv() que le dispatch — evite
   * les races sur `db` capture en closure (deux sv() successifs ecraseraient
   * la creation du ch).
   */
  /**
   * Sprint 46 : ASSIGNATION du camion sans chargement (PORT -> ASSIGNE).
   * Pose `dassign` mais PAS `dsp`. Le TC reste physiquement au port,
   * la franchise port continue de courir. L'avance est versee a ce moment
   * (cash chauffeur pour gasoil/route avant le chargement effectif).
   */
  function assignTc(tid: string, ch: any, avance: number, budget: number, dassignDate?: string, prixConvenu?: number, newChData?: any): void {
    var tc = tcs.find(function (c) { return c.id === tid; });
    var d = tc ? dos.find(function (x) { return x.id === tc.did; }) : null;
    var check = canAssignTc(tc, d);
    if (!check.ok) { nf(check.reason || "Assignation refusee", "error"); return; }

    var actualCh = ch;
    var newChs = chs;
    if (newChData) {
      var freshCh: Chauffeur = Object.assign({}, newChData, {
        id: mid(),
        pm: parseInt(newChData.pm) || 0,
        tty: newChData.tty || ["20GP", "40GP", "40HC"],
      });
      newChs = chs.concat([freshCh]);
      actualCh = freshCh;
    }

    var up: Record<string, any> = { st: "ASSIGNE", ch: actualCh.nm, cm: actualCh.cm, dassign: dassignDate || today() };
    if (budget > 0) up.budget = budget;
    if (prixConvenu && prixConvenu > 0) up.pc = prixConvenu;
    var nc = tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, up) : c; });
    var nd: Depense[] = dep;
    if (avance > 0) {
      nd = dep.concat([{ id: mid(), did: tc ? tc.did : "", tp: "TRANSPORT", ht: avance, mt: avance, s: "ATT", ph: "AVANCE_DK", tcid: tid, ds: "Avance assignation - " + (tc ? tc.n : "?") + " - " + actualCh.nm, dt: today() }]);
    }
    var newDos = applyAutoStatus(dos, nc);
    var patch: any = { dos: newDos, tcs: nc, dep: nd };
    if (newChData) patch.chs = newChs;
    var detail = (tc ? tc.n : "?") + " -> " + actualCh.nm + " (" + actualCh.cm + ")" + (newChData ? " [nouveau ch]" : "");
    sv(wLog(Object.assign({}, db, patch), tc ? tc.did : "", "ASSIGN", detail));
    nf(newChData ? "Assigne (chauffeur cree)" : "Camion assigne"); setMl(null);
  }

  /**
   * Sprint 46 : CHARGEMENT effectif (ASSIGNE -> DISPATCHE).
   * Pose `dsp` (date sortie terminal). Permet un complement de paiement optionnel.
   */
  function loadTc(tid: string, dspDate?: string, extraPayment?: number): void {
    var tc = tcs.find(function (c) { return c.id === tid; });
    var d = tc ? dos.find(function (x) { return x.id === tc.did; }) : null;
    var check = canDispatchTc(tc, d);
    if (!check.ok) { nf(check.reason || "Chargement refuse", "error"); return; }

    var up: Record<string, any> = { st: "DISPATCHE", dsp: dspDate || today() };
    var nc = tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, up) : c; });
    var nd: Depense[] = dep;
    if (extraPayment && extraPayment > 0) {
      nd = dep.concat([{ id: mid(), did: tc ? tc.did : "", tp: "TRANSPORT", ht: extraPayment, mt: extraPayment, s: "ATT", ph: "AVANCE_DK", tcid: tid, ds: "Complement chargement - " + (tc ? tc.n : "?"), dt: today() }]);
    }
    var newDos = applyAutoStatus(dos, nc);
    var detail = (tc ? tc.n : "?") + " charge a " + (dspDate || today());
    sv(wLog(Object.assign({}, db, { dos: newDos, tcs: nc, dep: nd }), tc ? tc.did : "", "LOAD", detail));
    nf("TC charge");
    setMl(null);
  }

  function dispatch(tid: string, ch: any, avance: number, budget: number, dspDate?: string, prixConvenu?: number, newChData?: any): void {
    var tc = tcs.find(function (c) { return c.id === tid; });
    var d = tc ? dos.find(function (x) { return x.id === tc.did; }) : null;
    // Sprint 40 F40.5 - validation centralisee via canDispatchTc
    // (verifie tc.st === 'PORT', dos.da pas dans le futur, BAE/Pregate).
    var dispatchCheck = canDispatchTc(tc, d);
    if (!dispatchCheck.ok) { nf(dispatchCheck.reason || "Dispatch refuse", "error"); return; }

    // Creation inline du chauffeur si demandee
    var actualCh = ch;
    var newChs = chs;
    if (newChData) {
      var freshCh: Chauffeur = Object.assign({}, newChData, {
        id: mid(),
        pm: parseInt(newChData.pm) || 0,
        tty: newChData.tty || ["20GP", "40GP", "40HC"],
      });
      newChs = chs.concat([freshCh]);
      actualCh = freshCh;
    }

    // Sprint 46 : chargement immediat = assignation + chargement atomiques
    var date = dspDate || today();
    var up: Record<string, any> = { st: "DISPATCHE", ch: actualCh.nm, cm: actualCh.cm, dassign: date, dsp: date };
    if (budget > 0) up.budget = budget;
    if (prixConvenu && prixConvenu > 0) up.pc = prixConvenu;
    var nc = tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, up) : c; });
    var nd: Depense[] = dep;
    if (avance > 0) {
      nd = dep.concat([{ id: mid(), did: tc ? tc.did : "", tp: "TRANSPORT", ht: avance, mt: avance, s: "ATT", ph: "AVANCE_DK", tcid: tid, ds: "Avance depart - " + (tc ? tc.n : "?") + " - " + actualCh.nm, dt: today() }]);
    }
    // Sprint B.1 : statut dossier auto selon l'etat des TC apres mise a jour
    var newDos = applyAutoStatus(dos, nc);
    var patch: any = { dos: newDos, tcs: nc, dep: nd };
    if (newChData) patch.chs = newChs;
    var detail = (tc ? tc.n : "?") + " -> " + actualCh.nm + " (" + actualCh.cm + ")" + (newChData ? " [nouveau ch]" : "");
    sv(wLog(Object.assign({}, db, patch), tc ? tc.did : "", "DISPATCH", detail));
    nf(newChData ? "Dispatche (chauffeur cree)" : "Dispatche"); setMl(null);
  }

  function addTcPayment(tcid: string, ph: string, mt: number, note?: string): void {
    var tc = tcs.find(function (c) { return c.id === tcid; });
    if (!tc) return;
    var exp: Depense = { id: mid(), did: tc.did, tp: "TRANSPORT", ht: mt, mt: mt, s: "ATT", ph: ph, tcid: tcid, ds: (TPHASES[ph] || ph) + " - " + (tc.n || "?") + (note ? " - " + note : ""), dt: today() };
    sv(wLog(Object.assign({}, db, { dep: dep.concat([exp]) }), tc.did, "AJOUT_DEPENSE", (TPHASES[ph] || ph) + " " + fm(mt)));
    nf("Versement enregistre"); setMl(null);
  }

  function advance(tid: string, ns: string, dt?: string): void {
    // Sprint 40 F40.5 - validation centralisee via canAdvanceTc.
    // Combine machine d'etat (Sprint 38B) + regle dos.da pas dans le futur pour PORT/DISPATCHE.
    var currentTc = tcs.find(function (c) { return c.id === tid; });
    var currentDos = currentTc ? dos.find(function (x) { return x.id === currentTc.did; }) : null;
    var transitionCheck = canAdvanceTc(currentTc, currentDos, ns);
    if (!transitionCheck.ok) {
      nf("Transition refusee : " + (transitionCheck.reason || "non autorisee"), "error");
      return;
    }
    var d = dt || today();
    var up: Record<string, any> = { st: ns };
    if (ns === "TRANSIT") up.dtk = d;
    if (ns === "KATI") up.dak = d;
    if (ns === "BAMAKO") up.dab = d;
    if (ns === "RETURNED") up.dr = d;
    var tc = tcs.find(function (c) { return c.id === tid; });
    var newTcs = tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, up) : c; });

    // Auto-cloture : si dernier TC passe RETURNED, cloturer le dossier
    // SAUF si jours detention > franchise → bloquer + alerter (Sprint B.2)
    if (ns === "RETURNED" && tc) {
      var dtcs = newTcs.filter(function (c) { return c.did === tc!.did; });
      var allRet = dtcs.length > 0 && dtcs.every(function (c) { return c.st === "RETURNED"; });
      var dossier = dos.find(function (x) { return x.id === tc!.did; });
      if (allRet && dossier && dossier.st !== "CLOTURE" && dossier.st !== "ARCHIVE") {
        // Calcul jours detention sur tous les TC pour determiner si on doit alerter
        var maxDetentionJours = 0;
        var franchiseRt = getFranchiseRetourVide(dossier);
        dtcs.forEach(function (c: any) {
          if (c.dsp && c.dr) {
            var dsp = new Date(c.dsp); dsp.setHours(0, 0, 0, 0);
            var dr = new Date(c.dr); dr.setHours(0, 0, 0, 0);
            var diff = Math.floor((dr.getTime() - dsp.getTime()) / 864e5);
            if (diff > maxDetentionJours) maxDetentionJours = diff;
          }
        });
        if (maxDetentionJours > franchiseRt) {
          // Detention detectee : on garde le dossier ouvert et on alerte
          var depassement = maxDetentionJours - franchiseRt;
          var newDosBlocked = applyAutoStatus(dos, newTcs);
          sv(wLog(Object.assign({}, db, { tcs: newTcs, dos: newDosBlocked }), tc.did, "TC_STATUT", (tc.n || "?") + " -> " + (SL[ns] || ns) + " (detention " + maxDetentionJours + "j)"));
          nf("Detention detectee : " + depassement + " jour(s) au-dela de la franchise. Reglez la facture detention avant cloture.", "warning");
          setMl({ t: "detention", did: tc.did, jours: maxDetentionJours, depassement: depassement, franchise: franchiseRt });
          return;
        }
        var newDos = dos.map(function (x) { return x.id === tc!.did ? Object.assign({}, x, { st: "CLOTURE" }) : x; });
        var newDb = Object.assign({}, db, { tcs: newTcs, dos: newDos });
        sv(wLog(newDb, tc.did, "CLOTURE", "Auto-cloture: tous les TCs retournes"));
        nf("Tous retournes — dossier cloture automatiquement", "ok");
        return;
      }
    }
    // Sprint B.1 : statut auto a chaque changement TC
    var newDosAuto = applyAutoStatus(dos, newTcs);
    sv(wLog(Object.assign({}, db, { tcs: newTcs, dos: newDosAuto }), tc ? tc.did : "", "TC_STATUT", (tc ? tc.n : "?") + " -> " + (SL[ns] || ns)));
    nf("-> " + ns);
  }

  function deleteTc(tid: string): void {
    var tc = tcs.find(function (c) { return c.id === tid; });
    if (!tc) return;
    // Supprimer le TC + les depenses liees (avances chauffeur, etc.)
    var newTcs = tcs.filter(function (c) { return c.id !== tid; });
    var newDep = dep.filter(function (e) { return e.tcid !== tid; });
    sv(wLog(Object.assign({}, db, { tcs: newTcs, dep: newDep }), tc.did, "SUPPR_TC", (tc.n || "?") + " (TC supprime du dossier)"));
    nf("Conteneur supprime", "error");
  }

  function updateTcDate(tid: string, field: string, val: string): void {
    var up: Record<string, string> = {};
    up[field] = val;
    sv(Object.assign({}, db, { tcs: tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, up) : c; }) }));
    nf("Date mise a jour");
  }

  // Sprint D.2 — patch generique d'un TC (utilise pour gar_recup notamment)
  function patchTc(tid: string, fields: Record<string, unknown>): void {
    sv(Object.assign({}, db, { tcs: tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, fields) : c; }) }));
  }

  // Bug 2 fix — modifier les infos identite d'un TC (n, ty, po) sans toucher
  // a l'historique transit (st, dsp, dtk, dak, dab, dr, ch, cm, etc.).
  // Utile pour corriger des erreurs d'import Excel sur des TC deja dispatches.
  function editTcInfo(tid: string, fields: { n?: string; ty?: string; po?: number }): void {
    var tc = tcs.find(function (c) { return c.id === tid; });
    if (!tc) return;
    var clean: Record<string, unknown> = {};
    if (fields.n !== undefined) clean.n = String(fields.n).toUpperCase().trim();
    if (fields.ty !== undefined) clean.ty = String(fields.ty);
    if (fields.po !== undefined) clean.po = parseFloat(String(fields.po)) || 0;
    sv(wLog(
      Object.assign({}, db, { tcs: tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, clean) : c; }) }),
      tc.did,
      "MODIF_TC",
      "Modif identite TC " + (tc.n || "?") + " -> " + (clean.n || tc.n || "?")
    ));
    nf("Conteneur modifie");
  }

  // ===== Helpers / derived (pures) =====

  function humanPhrase(d: any, dtcs: any[]): string {
    if (!d) return "";
    var n = dtcs.length;
    if (n === 0) return "Dossier sans conteneur.";
    var attendu = dtcs.filter(function (c: any) { return c.st === "ATTENDU"; }).length;
    var atPort = dtcs.filter(function (c: any) { return c.st === "PORT"; }).length;
    var inTransit = dtcs.filter(function (c: any) { return c.st !== "PORT" && c.st !== "ATTENDU" && c.st !== "RETURNED"; }).length;
    var returned = dtcs.filter(function (c: any) { return c.st === "RETURNED"; }).length;
    var parts: string[] = [];
    if (d.st === "CLOTURE") return "Dossier cloture. " + tcSum(dtcs) + " traite(s).";
    if (attendu === n) {
      parts.push(tcSum(dtcs) + " en attente d'arrivee" + (d.da ? " (ETA " + d.da + ")" : "") + ".");
      return parts.join(" ");
    }
    if (attendu > 0) parts.push(String(attendu) + " en attente d'arrivee.");
    if (atPort + attendu === n) {
      var daysSince = d.da ? Math.floor((new Date().getTime() - new Date(d.da).getTime()) / 864e5) : 0;
      if (atPort > 0) parts.push(String(atPort) + " au port depuis " + String(daysSince) + " jour(s).");
      if (!d.pn && d.as2 !== "OBTENU") parts.push("En attente du BAE ou Pregate pour dispatch.");
      else if (atPort > 0) parts.push("Pret(s) pour le dispatch.");
    } else {
      if (atPort > 0) parts.push(String(atPort) + " encore au port.");
      if (inTransit > 0) {
        var locs: string[] = [];
        dtcs.forEach(function (c: any) { if (c.st !== "PORT" && c.st !== "ATTENDU" && c.st !== "RETURNED" && locs.indexOf(c.st) < 0) locs.push(c.st); });
        parts.push(String(inTransit) + " en route (" + locs.map(function (l) { return SL[l] || l; }).join(", ") + ").");
      }
      if (returned > 0) parts.push(String(returned) + " retourne(s).");
    }
    if (returned === n) parts.push("Tous retournes - pret pour cloture.");
    return parts.join(" ");
  }

  function tcFranchise(tc: any, d: any): any {
    if (!d || !d.da || tc.st === "RETURNED") return null;
    if (tc.st === "ATTENDU") {
      var now = new Date(); now.setHours(0, 0, 0, 0);
      var arr = new Date(d.da); arr.setHours(0, 0, 0, 0);
      var jra = Math.ceil((arr.getTime() - now.getTime()) / 864e5);
      return { rp: null, rt: null, col: jra > 5 ? "green" : jra > 2 ? "orange" : "red", val: jra, lbl: "Arrive" };
    }
    // Sprint 38D - utilise les helpers canoniques (regles BAD + j+1 inclusif
    // factorisees dans src/utils/franchise.ts pour eviter la duplication avec
    // calcAlertesFranchise dans utils/date.ts).
    var joursPort = joursSurestariesPort(d, tc.dsp);
    var rp = (cfg as any).fp - joursPort;

    var rt: number | null = null;
    if (tc.dsp && tc.st !== "PORT") {
      var joursDet = joursDetention(tc.dsp, tc.dr);
      rt = (cfg as any).ft - joursDet;
    }
    var isPort = tc.st === "PORT";
    var val = isPort ? rp : (rt !== null ? rt : rp);
    var col = val > 5 ? "green" : val > 2 ? "orange" : val > 0 ? "red" : "black";
    var lbl = isPort ? "Port" : "Retour";
    return { rp: rp, rt: rt, col: col, val: val, lbl: lbl };
  }

  return { dispatch, assignTc, loadTc, addTcPayment, advance, updateTcDate, patchTc, deleteTc, editTcInfo, humanPhrase, tcFranchise };
}
