import { mid } from '../utils/id.js';
import { fm } from '../utils/format.js';
import { DTL } from '../constants/depenses.js';
import type { Dossier, Depense } from '../types.js';

/**
 * Actions sur les depenses. Extraite de useAppLogic dans le refactor E.
 *
 * NB : `toggleDepSt` applique le pattern return-value (decision TODO #1
 * Option A dans NOTES-PRODUCT.md) — ne fait plus d'effet de bord UI
 * (ouverture de modale pregate), retourne un objet structure que le
 * caller (App.tsx) consomme pour decider de l'UI.
 */

export interface DepenseActionsDeps {
  db: any;
  sv: (data: any) => void;
  wLog: (data: any, did: string, action: string, detail?: string) => any;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void; // utilise uniquement pour addDep/editDep qui ferment la modale d'edition
  dos: Dossier[];
  dep: Depense[];
}

export interface ToggleDepStResult {
  ok: boolean;
  needsPregate?: { did: string };
}

export default function useDepenseActions(p: DepenseActionsDeps) {
  var db = p.db, sv = p.sv, wLog = p.wLog, nf = p.nf, setMl = p.setMl;
  var dos = p.dos, dep = p.dep;

  function addDep(d: any): void {
    sv(wLog(Object.assign({}, db, { dep: dep.concat([Object.assign({}, d, { id: mid(), ht: parseFloat(d.ht) || 0, mt: parseFloat(d.mt) || 0 })]) }), d.did, "AJOUT_DEPENSE", (DTL[d.tp] || d.tp) + " " + fm(d.mt)));
    nf("Depense ajoutee"); setMl(null);
  }

  function editDep(eid: string, d: any): void {
    sv(wLog(Object.assign({}, db, { dep: dep.map(function (x) { return x.id === eid ? Object.assign({}, x, d, { ht: parseFloat(d.ht) || 0, mt: parseFloat(d.mt) || 0 }) : x; }) }), d.did, "MODIF_DEPENSE", (DTL[d.tp] || d.tp) + " " + fm(d.mt)));
    nf("Depense modifiee"); setMl(null);
  }

  function deleteDep(id: string): void {
    var f = dep.find(function (x) { return x.id === id; });
    sv(wLog(Object.assign({}, db, { dep: dep.filter(function (x) { return x.id !== id; }) }), f ? f.did : "", "SUPPR_DEPENSE", (DTL[f ? f.tp : ""] || "") + " " + fm(f ? f.mt : 0)));
    nf("Depense supprimee", "error");
  }

  /**
   * Soft-delete : ignore un stub auto considere comme faux positif.
   * La Depense reste en base (pour l'audit) mais ne reapparait pas dans
   * les listes filtrees ni dans le widget Factures en attente. L'anti-doublon
   * compte aussi les ignored => on ne re-stub pas apres ignore.
   */
  function ignoreDep(id: string): void {
    var f = dep.find(function (x) { return x.id === id; });
    if (!f) return;
    sv(wLog(Object.assign({}, db, { dep: dep.map(function (x) { return x.id === id ? Object.assign({}, x, { ignored: true }) : x; }) }), f.did, "IGNORE_DEPENSE", (DTL[f.tp] || f.tp) + " (stub auto ignore)"));
    nf("Facture ignoree");
  }

  /**
   * Bascule le statut de paiement (ATT ↔ PAYE).
   *
   * Retourne `{ ok: boolean, needsPregate?: { did } }` :
   * - `ok: false` si la depense n'existe pas (early return)
   * - `ok: true, needsPregate: { did }` si DPWORLD paye mais pas de
   *   pregate sur le dossier → le caller doit ouvrir la modale pregate
   * - `ok: true` sinon (cas standard)
   *
   * Pattern return-value remplace l'ancien setMl direct (decouple UI).
   */
  function toggleDepSt(depId: string): ToggleDepStResult {
    var f = dep.find(function (x) { return x.id === depId; });
    if (!f) return { ok: false };
    var ns = f.s === "PAYE" ? "ATT" : "PAYE";

    // ATT → PAYE : demander le montant payé reel (peut differer du HT). Bug fix
    // demande user : ne plus auto-remplir TTC depuis HT, demander a la conversion.
    var newMt = f.mt || 0;
    var newStatus: "en_attente_facture" | "a_payer" | "payee" = ns === "PAYE" ? "payee" : "a_payer";
    if (ns === "PAYE") {
      var suggested = (f.mt && f.mt > 0) ? f.mt : (f.ht || 0);
      var promptVal = "";
      if (typeof window !== "undefined" && typeof window.prompt === "function") {
        var label = "Montant payé (FCFA) pour : " + (DTL[f.tp] || f.tp) + (f.nf ? " (N° " + f.nf + ")" : "");
        promptVal = window.prompt(label, String(suggested)) || "";
      }
      if (promptVal === "") {
        // User a annule → on ne change rien
        return { ok: false };
      }
      var parsed = parseFloat(promptVal.replace(/\s/g, "").replace(",", "."));
      if (isNaN(parsed) || parsed <= 0) {
        nf("Montant invalide", "error");
        return { ok: false };
      }
      newMt = parsed;
    } else {
      // PAYE → ATT : on conserve le mt (au cas ou repaiement futur a montant identique)
      // mais on remet le status legacy a a_payer
    }

    sv(wLog(Object.assign({}, db, { dep: dep.map(function (x) { return x.id === depId ? Object.assign({}, x, { s: ns, mt: newMt, status: newStatus }) : x; }) }), f.did, "PAIEMENT", (DTL[f.tp] || f.tp) + " " + fm(newMt) + " -> " + (ns === "PAYE" ? "Paye" : "Impaye")));
    if (ns === "PAYE" && f.tp === "DPWORLD") {
      var d = dos.find(function (x) { return x.id === f.did; });
      if (d && !d.pn) return { ok: true, needsPregate: { did: f.did } };
    }
    return { ok: true };
  }

  return { addDep, editDep, deleteDep, ignoreDep, toggleDepSt };
}
