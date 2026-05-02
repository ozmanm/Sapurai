import { mid } from '../utils/id.js';
import { today } from '../utils/date.js';
import { fm, tcSum } from '../utils/format.js';
import { SL } from '../constants/statuts.js';
import { TPHASES } from '../constants/depenses.js';
import { applyAutoStatus } from '../utils/dossierStatus';
import { getFranchiseRetourVide } from '../utils/franchise';
import type { Dossier, Conteneur, Depense, Config } from '../types.js';

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
  cfg: Config;
}

export default function useConteneurActions(p: ConteneurActionsDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf, setMl = p.setMl;
  var dos = p.dos, tcs = p.tcs, dep = p.dep, cfg = p.cfg;

  function dispatch(tid: string, ch: any, avance: number, budget: number, dspDate?: string, prixConvenu?: number): void {
    var tc = tcs.find(function (c) { return c.id === tid; });
    var d = tc ? dos.find(function (x) { return x.id === tc.did; }) : null;
    if (d && !d.pn && d.as2 !== "OBTENU") { nf("BAE ou Pregate requis avant dispatch!", "error"); return; }
    var up: Record<string, any> = { st: "DISPATCHE", ch: ch.nm, cm: ch.cm, dsp: dspDate || today() };
    if (budget > 0) up.budget = budget;
    if (prixConvenu && prixConvenu > 0) up.pc = prixConvenu;
    var nc = tcs.map(function (c) { return c.id === tid ? Object.assign({}, c, up) : c; });
    var nd: Depense[] = dep;
    if (avance > 0) {
      nd = dep.concat([{ id: mid(), did: tc ? tc.did : "", tp: "TRANSPORT", ht: avance, mt: avance, s: "ATT", ph: "AVANCE_DK", tcid: tid, ds: "Avance depart - " + (tc ? tc.n : "?") + " - " + ch.nm, dt: today() }]);
    }
    // Sprint B.1 : statut dossier auto selon l'etat des TC apres mise a jour
    var newDos = applyAutoStatus(dos, nc);
    sv(wLog(Object.assign({}, db, { dos: newDos, tcs: nc, dep: nd }), tc ? tc.did : "", "DISPATCH", (tc ? tc.n : "?") + " -> " + ch.nm + " (" + ch.cm + ")"));
    nf("Dispatche"); setMl(null);
  }

  function addTcPayment(tcid: string, ph: string, mt: number, note?: string): void {
    var tc = tcs.find(function (c) { return c.id === tcid; });
    if (!tc) return;
    var exp: Depense = { id: mid(), did: tc.did, tp: "TRANSPORT", ht: mt, mt: mt, s: "ATT", ph: ph, tcid: tcid, ds: (TPHASES[ph] || ph) + " - " + (tc.n || "?") + (note ? " - " + note : ""), dt: today() };
    sv(wLog(Object.assign({}, db, { dep: dep.concat([exp]) }), tc.did, "AJOUT_DEPENSE", (TPHASES[ph] || ph) + " " + fm(mt)));
    nf("Versement enregistre"); setMl(null);
  }

  function advance(tid: string, ns: string, dt?: string): void {
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
    var a = new Date(d.da); a.setHours(0, 0, 0, 0);
    var b = tc.dsp ? new Date(tc.dsp) : new Date(); b.setHours(0, 0, 0, 0);
    var rp = (cfg as any).fp - Math.floor((b.getTime() - a.getTime()) / 864e5);
    var rt: number | null = null;
    if (tc.dsp && tc.st !== "PORT") {
      var c2 = new Date(tc.dsp); c2.setHours(0, 0, 0, 0);
      var d2 = tc.dr ? new Date(tc.dr) : new Date(); d2.setHours(0, 0, 0, 0);
      rt = (cfg as any).ft - Math.floor((d2.getTime() - c2.getTime()) / 864e5);
    }
    var isPort = tc.st === "PORT";
    var val = isPort ? rp : (rt !== null ? rt : rp);
    var col = val > 5 ? "green" : val > 2 ? "orange" : val > 0 ? "red" : "black";
    var lbl = isPort ? "Port" : "Retour";
    return { rp: rp, rt: rt, col: col, val: val, lbl: lbl };
  }

  return { dispatch, addTcPayment, advance, updateTcDate, patchTc, deleteTc, humanPhrase, tcFranchise };
}
