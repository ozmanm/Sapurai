import type { Conteneur, Dossier, Config, Alerte, Urgence, AlertesFranchiseResult } from '../types';

/**
 * Retourne la date du jour au format ISO (YYYY-MM-DD)
 */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Calcule le nombre de jours INCLUSIF entre deux dates ISO.
 * Si dateFin est absente, utilise aujourd'hui.
 *
 * Convention metier transit Senegal/Mali : le jour de mise a dispo (debut)
 * est INCLUS dans le decompte. Du 01/03 au 24/03 = 24 jours (et non 23).
 */
export function joursDiff(dateDebut: string | null | undefined, dateFin?: string | null): number {
  if (!dateDebut) return 0;
  var a = new Date(dateDebut); a.setHours(0, 0, 0, 0);
  var b = dateFin ? new Date(dateFin) : new Date(); b.setHours(0, 0, 0, 0);
  return Math.floor((b.getTime() - a.getTime()) / 864e5) + 1;
}

// -------------------------------------------------------------------
// LES 3 COMPTEURS INDEPENDANTS
//
// Tous les 3 partagent la meme date de depart :
//   d.da = date de dechargement du navire
//
// 1. MAGASINAGE (DP World)     : Dechargement -> Pregate/Sortie  (cfg.fm)
// 2. SURESTARIES (Compagnie)   : Dechargement -> Sortie terminal (cfg.fp)
// 3. DETENTION (Compagnie)     : Sortie terminal -> Retour vide  (cfg.ft)
//
// tc.dsp = date de dispatch = sortie du terminal (Pregate valide)
// tc.dr  = date de retour conteneur vide
// -------------------------------------------------------------------

/**
 * Calcule toutes les alertes franchise pour un ensemble de conteneurs.
 */
export function calcAlertesFranchise(tcs: Conteneur[], dos: Dossier[], cfg: Config): AlertesFranchiseResult {
  var fm = (cfg && cfg.fm) || 20;
  var fp = (cfg && cfg.fp) || 10;
  var ft = (cfg && cfg.ft) || 23;
  var ts = (cfg && cfg.ts) || 25000;

  var alertes: Alerte[] = [];
  var urgences: Urgence[] = [];
  var totalSurestariesJours = 0;
  var nSurestaries = 0;

  tcs.forEach(function (tc) {
    var d = dos.find(function (x) { return x.id === tc.did; });
    if (!d || !d.da || tc.st === "RETURNED" || tc.st === "ATTENDU") return;
    if (d.st === "CLOTURE" || d.st === "ARCHIVE") return;

    var dateFinPort = tc.st === "PORT" ? null : tc.dsp;
    var joursDepuisDecharge = joursDiff(d.da, dateFinPort);
    // Surestaries depuis date fin validite BAD si BAD obtenu, sinon depuis da.
    // Si BAD pas encore expire (joursSur < 0), clamp a 0.
    var startSur = (d.bs === "OBTENU" && d.bv) ? d.bv : d.da;
    var joursSur = joursDiff(startSur, dateFinPort);
    if (joursSur < 0) joursSur = 0;

    // 1. MAGASINAGE — DP World
    if (tc.st === "PORT") {
      var resteMag = fm - joursDepuisDecharge;
      var colMag = resteMag > 7 ? "green" : resteMag > 3 ? "orange" : resteMag > 0 ? "red" : "black";

      if (resteMag <= 7) {
        alertes.push({
          tn: tc.n || "?", dn: d.bl || "?", cl: d.cl || "?",
          tp: "Magasinage", facture: "DP World",
          j: joursDepuisDecharge, r: resteMag, col: colMag,
          did: d.id, tid: tc.id,
        });
      }
      if (resteMag <= 3 && resteMag > 0) {
        urgences.push({ cat: "MAGASINAGE", msg: "J-" + String(resteMag) + " " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "warning" });
      }
      if (resteMag === 0) {
        urgences.push({ cat: "MAGASINAGE", msg: "EXPIRE " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "critical" });
      }
      if (resteMag < 0) {
        urgences.push({ cat: "MAGASINAGE", msg: "+" + String(Math.abs(resteMag)) + "j " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "critical" });
      }
    }

    // 2. SURESTARIES — Compagnie maritime (depuis bv si BAD obtenu, sinon da)
    if (tc.st === "PORT") {
      var resteSur = fp - joursSur;
      var colSur = resteSur > 3 ? "green" : resteSur > 1 ? "orange" : resteSur > 0 ? "red" : "black";

      if (resteSur <= 5) {
        alertes.push({
          tn: tc.n || "?", dn: d.bl || "?", cl: d.cl || "?",
          tp: "Surestaries", facture: d.cp || "Compagnie",
          j: joursDepuisDecharge, r: resteSur, col: colSur,
          did: d.id, tid: tc.id,
        });
      }
      if (resteSur <= 2 && resteSur > 0) {
        urgences.push({ cat: "PORT", msg: "J-" + String(resteSur) + " " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "warning" });
      }
      if (resteSur === 0) {
        urgences.push({ cat: "PORT", msg: "EXPIRE " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "critical" });
      }
      if (resteSur < 0) {
        totalSurestariesJours += Math.abs(resteSur);
        nSurestaries++;
        urgences.push({ cat: "SURESTARIES", msg: "+" + String(Math.abs(resteSur)) + "j " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "critical" });
      }
    }

    // 3. DETENTION — Compagnie maritime
    if (tc.dsp && tc.st !== "PORT") {
      var jt = joursDiff(tc.dsp, tc.dr || null);
      var rt = ft - jt;
      var tcol = rt > 7 ? "green" : rt > 5 ? "orange" : rt > 2 ? "red" : "black";

      if (rt <= 7) {
        alertes.push({
          tn: tc.n || "?", dn: d.bl || "?", cl: d.cl || "?",
          tp: "Detention", facture: d.cp || "Compagnie",
          j: jt, r: rt, col: tcol,
          did: d.id, tid: tc.id,
        });
      }
      if (rt <= 3 && rt > 0) {
        urgences.push({ cat: "RETOUR", msg: "J-" + String(rt) + " " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "warning" });
      }
      if (rt === 0) {
        urgences.push({ cat: "RETOUR", msg: "EXPIRE " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "critical" });
      }
      if (rt < 0) {
        urgences.push({ cat: "DETENTION", msg: "+" + String(Math.abs(rt)) + "j " + (tc.n || "?"), sub: d.cl || "?", did: d.id, level: "critical" });
      }
    }
  });

  return { alertes: alertes, urgences: urgences, totalSurestariesJours: totalSurestariesJours, totalSurestariesFCFA: totalSurestariesJours * ts, nSurestaries: nSurestaries };
}

/**
 * Calcule les urgences documentaires (BAE, BAD, caution).
 */
export function calcUrgencesDoc(dos: Dossier[], tcs: Conteneur[]): Urgence[] {
  var urgences: Urgence[] = [];

  dos.forEach(function (d) {
    if (d.st === "CLOTURE" || d.st === "ARCHIVE") return;

    var dtcs = tcs.filter(function (c) { return c.did === d.id && c.st === "PORT"; });
    if (dtcs.length > 0 && !d.pn && d.as2 !== "OBTENU") {
      urgences.push({ cat: "BAE", msg: "Manquant " + (d.bl || "?"), sub: d.cl || "?", did: d.id, level: "warning" });
    }

    // BAD expiration — only for TCs at port (not ATTENDU)
    var hasTcsAtPort = tcs.some(function (c) { return c.did === d.id && c.st === "PORT"; });
    if (d.bv && hasTcsAtPort) {
      var bvd = new Date(d.bv); bvd.setHours(0, 0, 0, 0);
      var now = new Date(); now.setHours(0, 0, 0, 0);
      var bvr = Math.floor((bvd.getTime() - now.getTime()) / 864e5);
      if (bvr <= 3 && bvr > 0) {
        urgences.push({ cat: "BAD", msg: "Expire J-" + String(bvr) + " " + (d.bl || "?"), sub: d.cl || "?", did: d.id, level: "warning" });
      }
      if (bvr <= 0) {
        urgences.push({ cat: "BAD", msg: "EXPIRE +" + String(Math.abs(bvr)) + "j " + (d.bl || "?"), sub: d.cl || "?", did: d.id, level: "critical" });
      }
    }
  });

  return urgences;
}
