import { useMemo } from 'react';
import { isDepensePayee } from '../utils/depenseStatus';
import { fm } from '../utils/format.js';
import { calcAlertesFranchise, calcUrgencesDoc } from '../utils/date.js';
import type { Dossier, Conteneur, Depense, Config } from '../types.js';

/**
 * Calcule tous les compteurs et urgences agreges.
 * Extraite de useAppLogic dans le refactor E (split).
 */
export default function useAppMetrics(
  dos: Dossier[],
  tcs: Conteneur[],
  dep: Depense[],
  cfg: Config
) {
  // Counters (memoized)
  var counters = useMemo(function () {
    var totalDep = 0;
    dep.forEach(function (d) { totalDep += (d.mt || 0); });
    var enCours = dos.filter(function (d) { return d.st !== "CLOTURE" && d.st !== "ARCHIVE"; }).length;
    var nAttendu = tcs.filter(function (c) { return c.st === "ATTENDU"; }).length;
    var nPort = tcs.filter(function (c) { return c.st === "PORT"; }).length;
    var nTrans = tcs.filter(function (c) { return c.st !== "PORT" && c.st !== "ATTENDU" && c.st !== "RETURNED"; }).length;
    // Sprint 41 F41.1 - utilise helper canonique (resout status nouveau OU s legacy)
    var totalPaye = dep.filter(function (f) { return isDepensePayee(f); }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    var totalImpaye = totalDep - totalPaye;
    var payePct = totalDep > 0 ? Math.round(totalPaye / totalDep * 100) : 0;
    var nCloture = dos.filter(function (d) { return d.st === "CLOTURE"; }).length;
    return { totalDep, enCours, nAttendu, nPort, nTrans, totalPaye, totalImpaye, payePct, nCloture };
  }, [dos, tcs, dep]);

  // Urgences & alertes (memoized — heavy computation)
  var urgData = useMemo(function () {
    var _franchise = calcAlertesFranchise(tcs, dos, cfg);
    var _urgencesDoc = calcUrgencesDoc(dos, tcs);
    var alertes = _franchise.alertes;

    // TC immobile : DISPATCHE depuis 5+ jours sans avancement
    var urgTcImm: any[] = [];
    tcs.forEach(function (tc) {
      if (tc.st !== "DISPATCHE" || !tc.dsp) return;
      var days = Math.floor((new Date().getTime() - new Date(tc.dsp).getTime()) / 86400000);
      if (days < 5) return;
      var d = dos.find(function (x) { return x.id === tc.did; });
      urgTcImm.push({ cat: "TC_IMMOBILE", level: days >= 7 ? "critical" : "warning", msg: (tc.n || "?") + " immobile " + String(days) + "j", sub: d ? (d.cl || "") : "", did: tc.did || "" });
    });

    // Dossier pret a cloturer : tous les TCs RETURNED, dossier non cloture
    var urgPretCloture: any[] = [];
    dos.forEach(function (d) {
      if (d.st === "CLOTURE" || d.st === "ARCHIVE") return;
      var dtcs = tcs.filter(function (c) { return c.did === d.id; });
      if (dtcs.length === 0) return;
      if (dtcs.every(function (c) { return c.st === "RETURNED"; })) {
        urgPretCloture.push({ cat: "PRET_CLOTURE", level: "warning", msg: (d.cl || "?") + " - " + (d.bl || ""), sub: String(dtcs.length) + " TC(s) retournes", did: d.id });
      }
    });

    // Chauffeur a rappeler : TC dispatche 14+ jours sans RETURNED
    var urgChauffeur: any[] = [];
    var chDispMap: Record<string, any[]> = {};
    tcs.forEach(function (tc) {
      if (tc.st === "PORT" || tc.st === "ATTENDU" || tc.st === "RETURNED" || !tc.ch || !tc.dsp) return;
      var days = Math.floor((new Date().getTime() - new Date(tc.dsp).getTime()) / 86400000);
      if (days < 14) return;
      if (!chDispMap[tc.ch]) chDispMap[tc.ch] = [];
      chDispMap[tc.ch].push({ days: days, did: tc.did, tc: tc });
    });
    Object.keys(chDispMap).forEach(function (chName) {
      var arr = chDispMap[chName];
      var maxDays = arr.reduce(function (mx: number, x: any) { return x.days > mx ? x.days : mx; }, 0);
      urgChauffeur.push({ cat: "CHAUFFEUR_RETOUR", level: "warning", msg: chName + " (" + String(maxDays) + "j)", sub: String(arr.length) + " TC(s)", did: arr[0].did });
    });

    var urgCaution: any[] = [];
    dos.forEach(function (d) {
      if (d.st === "CLOTURE" || d.st === "ARCHIVE") return;
      if (d.gr === "PERMANENTE" || !d.gr) return;
      var dtcs = tcs.filter(function (c) { return c.did === d.id; });
      var allReturned = dtcs.length > 0 && dtcs.every(function (c) { return c.st === "RETURNED"; });
      if (d.gr === "LOUEE" && d.gar_statut === "VERSEE") {
        if (allReturned) {
          urgCaution.push({ cat: "CAUTION", level: "critical", msg: (d.bl || "?") + " - Récupérer " + fm(d.gar_caution || 0) + " chez " + (d.gar_contact || "?"), sub: d.cl || "", did: d.id });
        } else {
          var lastDsp: string | null = null;
          dtcs.forEach(function (c) { if (c.dsp && (!lastDsp || c.dsp > lastDsp)) lastDsp = c.dsp; });
          if (lastDsp) {
            var jt = Math.floor((new Date().getTime() - new Date(lastDsp).getTime()) / 86400000);
            var reste = ((cfg as any).ft || 23) - jt;
            if (reste < 0) {
              urgCaution.push({ cat: "CAUTION", level: "critical", msg: (d.bl || "?") + " - Caution " + fm(d.gar_caution || 0) + " EN RETARD " + String(Math.abs(reste)) + "j", sub: d.cl || "", did: d.id });
            } else if (reste <= 3) {
              urgCaution.push({ cat: "CAUTION", level: "warning", msg: (d.bl || "?") + " - Caution " + fm(d.gar_caution || 0) + " à risque, retour dans " + String(reste) + "j", sub: d.cl || "", did: d.id });
            }
          }
        }
      }
      if (d.gr === "VENDUE" && d.gar_statut === "RETENUE" && allReturned) {
        urgCaution.push({ cat: "CAUTION", level: "warning", msg: (d.bl || "?") + " - Rembourser ou conserver " + fm(d.gar_caution || 0) + " (" + (d.gar_contact || "?") + ")", sub: d.cl || "", did: d.id });
      }
    });

    var cautionsEnCours = dos.reduce(function (sum, d) {
      if (d.gr !== "LOUEE" || d.gar_statut !== "VERSEE") return sum;
      if (d.st === "CLOTURE" || d.st === "ARCHIVE") return sum;
      return sum + (d.gar_caution || 0);
    }, 0);

    // Sprint B.3 : Arrivée imminente J-3 / J-5 (anticipation logistique)
    var urgArriveeImm: any[] = [];
    var nowImm = new Date(); nowImm.setHours(0, 0, 0, 0);
    dos.forEach(function (d: any) {
      if (d.st === "CLOTURE" || d.st === "ARCHIVE") return;
      if (!d.da) return;
      // Pertinent uniquement si au moins un TC est encore ATTENDU
      var dtcs = tcs.filter(function (c) { return c.did === d.id; });
      if (dtcs.length === 0 || !dtcs.some(function (c) { return c.st === "ATTENDU"; })) return;
      var darr = new Date(d.da); darr.setHours(0, 0, 0, 0);
      var jra = Math.floor((darr.getTime() - nowImm.getTime()) / 86400000);
      if (jra < 0 || jra > 5) return;
      var lvl = jra <= 1 ? "critical" : "warning";
      urgArriveeImm.push({ cat: "ARRIVEE_IMM", level: lvl, msg: (d.cl || "?") + " — " + (d.bl || "?") + " arrive J" + (jra === 0 ? "0 (aujourd'hui)" : "-" + String(jra)), sub: String(dtcs.filter(function (c) { return c.st === "ATTENDU"; }).length) + " TC en attente", did: d.id });
    });

    // BAD/BAE — rappels documents
    var urgBadBae: any[] = [];
    dos.forEach(function (d) {
      if (d.st === "CLOTURE" || d.st === "ARCHIVE") return;
      var hasTcPort = tcs.some(function (c) { return c.did === d.id && c.st === "PORT"; });
      if (hasTcPort && (!d.bs || d.bs === "NON_DEMANDE")) {
        urgBadBae.push({ cat: "BAD", level: "warning", msg: (d.bl || "?") + " — TC au port, BAD non demande", sub: d.cl || "", did: d.id });
      }
      if (hasTcPort && (!d.as2 || d.as2 === "NON_DEMANDE")) {
        urgBadBae.push({ cat: "BAE", level: "warning", msg: (d.bl || "?") + " — TC au port, BAE non demande", sub: d.cl || "", did: d.id });
      }
      if (d.bs === "OBTENU" && !d.bv) {
        urgBadBae.push({ cat: "BAD", level: "warning", msg: (d.bl || "?") + " — BAD sans date validite", sub: d.cl || "", did: d.id });
      }
    });

    var urgences = _franchise.urgences.concat(_urgencesDoc).concat(urgTcImm).concat(urgPretCloture).concat(urgChauffeur).concat(urgCaution).concat(urgBadBae).concat(urgArriveeImm);
    return {
      alertes: alertes,
      urgences: urgences,
      cautionsEnCours: cautionsEnCours,
      totalSurestariesJours: _franchise.totalSurestariesJours,
      totalSurestariesFCFA: _franchise.totalSurestariesFCFA,
      nSurestaries: _franchise.nSurestaries
    };
  }, [dos, tcs, cfg]);

  var urgCats = [
    { key: "SURESTARIES",      ic: "\u26F5",       label: "Surestaries",        bg: "#fef2f2", bdr: "#dc2626", txtH: "#991b1b" },
    { key: "DETENTION",        ic: "\uD83D\uDE9A", label: "Detentions",         bg: "#fef2f2", bdr: "#dc2626", txtH: "#991b1b" },
    { key: "MAGASINAGE",       ic: "\uD83C\uDFED", label: "Magasinage DPW",     bg: "#fef2f2", bdr: "#dc2626", txtH: "#991b1b" },
    { key: "TC_IMMOBILE",      ic: "\uD83D\uDED1", label: "TC immobiles",       bg: "#fef2f2", bdr: "#dc2626", txtH: "#991b1b" },
    { key: "PORT",             ic: "\u26F5",       label: "Franchise port",     bg: "#fffbeb", bdr: "#d97706", txtH: "#92400e" },
    { key: "RETOUR",           ic: "\uD83D\uDE9A", label: "Retour vide",        bg: "#fffbeb", bdr: "#d97706", txtH: "#92400e" },
    { key: "CHAUFFEUR_RETOUR", ic: "\uD83D\uDCDE", label: "Chauffeurs rappeler",bg: "#fffbeb", bdr: "#d97706", txtH: "#92400e" },
    { key: "BAD",              ic: "\uD83D\uDCC4", label: "BAD",                bg: "#fef2f2", bdr: "#dc2626", txtH: "#991b1b" },
    { key: "BAE",              ic: "\uD83D\uDCCB", label: "BAE/Pregate",        bg: "#fffbeb", bdr: "#d97706", txtH: "#92400e" },
    { key: "CAUTION",          ic: "\uD83D\uDCB0", label: "Caution",            bg: "#f5f3ff", bdr: "#7c3aed", txtH: "#5b21b6" },
    { key: "PRET_CLOTURE",     ic: "\u2705",       label: "Prets a cloturer",   bg: "#f0fdf4", bdr: "#059669", txtH: "#166534" },
    { key: "ARRIVEE_IMM",      ic: "\u26f4",       label: "Arrivees imminentes",bg: "#eff6ff", bdr: "#2563eb", txtH: "#1e40af" },
  ];

  var urgByKey: Record<string, any[]> = {};
  urgData.urgences.forEach(function (u: any) { if (!urgByKey[u.cat]) urgByKey[u.cat] = []; urgByKey[u.cat].push(u); });
  var urgGrouped = urgCats
    .filter(function (c) { return urgByKey[c.key] && urgByKey[c.key].length > 0; })
    .map(function (c) { return { cat: c, items: urgByKey[c.key] }; });

  var recent3 = dos.slice().reverse().slice(0, 3);
  var critCount = urgData.urgences.filter(function (u: any) { return u.level === "critical"; }).length;
  var sysStatus = critCount > 0 ? "CRITIQUE" : urgData.urgences.length > 0 ? "ATTENTION" : "NORMAL";
  var sysBg = sysStatus === "CRITIQUE" ? "#dc2626" : sysStatus === "ATTENTION" ? "#d97706" : "#059669";

  return {
    ...counters,
    ...urgData,
    urgGrouped: urgGrouped,
    recent3: recent3,
    critCount: critCount,
    sysStatus: sysStatus,
    sysBg: sysBg,
  };
}
