import type { Dossier, Depense, DepenseCategorie } from '../types';
import { getFranchiseCompagnie, getFranchiseRetourVide } from './franchise';

/**
 * Auto-stub Depenses a l'arrivee d'un TC.
 *
 * Principe : a la detection d'arrivee (sync DPWorld OU saisie manuelle de
 * arriveeReelle), on cree des Depense "placeholder" en statut
 * `en_attente_facture` pour les factures attendues, dans l'ordre metier du
 * transitaire dakarois :
 *
 *   1. compagnie_location      (toujours)
 *   2. compagnie_debarquement  (toujours)
 *   3. caution + lettre_garantie  (TRANSIT sans garantie permanente)
 *   4. surestaries_compagnie   (si joursAuPort > franchise compagnie)
 *   5. besc                    (si dos.besc === true)
 *   6. orbus                   (toujours)
 *   7. dpworld                 (toujours)
 *
 * Le stub `detention_vide` est cree APRES livraison (fn distincte), si le
 * TC vide depasse la franchise de retour au port (et si !ror).
 *
 * Anti-doublon systematique : on skip toute categorie deja presente sur le
 * dossier (y compris devinee depuis un libelle legacy).
 */

interface CategorieMeta {
  tp: string;               // type Depense (legacy champ tp)
  fournisseur?: string;     // fournisseur par defaut (si pas la compagnie du dossier)
  libelle: string;          // libelle par defaut
}

var CATEGORIES_META: Record<DepenseCategorie, CategorieMeta> = {
  compagnie_location:     { tp: "COMPAGNIE", libelle: "Location conteneur" },
  compagnie_debarquement: { tp: "COMPAGNIE", libelle: "Debarquement / manutention" },
  surestaries_compagnie:  { tp: "COMPAGNIE", libelle: "Surestaries compagnie" },
  caution:                { tp: "CAUTION",   libelle: "Caution" },
  lettre_garantie:        { tp: "GARANTIE",  libelle: "Lettre de garantie" },
  besc:                   { tp: "BESC",      fournisseur: "BESC",    libelle: "BESC" },
  orbus:                  { tp: "ORBUS",     fournisseur: "ORBUS",   libelle: "Paiement ORBUS" },
  detention_vide:         { tp: "COMPAGNIE", libelle: "Detention conteneur vide" },
  dpworld:                { tp: "DPWORLD",   fournisseur: "DPWorld", libelle: "Manutention / magasinage DPWorld" },
  transport_terr:         { tp: "TRANSPORT", libelle: "Transport terrestre" },
  autre:                  { tp: "AUTRE",     libelle: "Autre" },
};

/** Metadata (tp, libelle, fournisseur) d'une categorie. */
export function getCategorieMeta(c: DepenseCategorie): CategorieMeta {
  return CATEGORIES_META[c];
}

/**
 * Devine la categorie d'une Depense legacy (sans champ `categorie`) depuis son
 * libelle (ds) et/ou son type (tp). Utilise pour l'anti-doublon et pour la
 * migration lazy cote lecture.
 */
export function guessCategorie(dep: { tp?: string; ds?: string }): DepenseCategorie {
  var lib = (dep.ds || "").toLowerCase();
  var tp = (dep.tp || "").toLowerCase();
  var hay = lib + " " + tp;

  if (hay.indexOf("dpworld") >= 0 || hay.indexOf("port autonome") >= 0) return "dpworld";
  if (hay.indexOf("orbus") >= 0) return "orbus";
  if (hay.indexOf("besc") >= 0) return "besc";
  if (hay.indexOf("caution") >= 0) return "caution";
  if (hay.indexOf("garantie") >= 0) return "lettre_garantie";
  if (hay.indexOf("detention") >= 0 || hay.indexOf("retour vide") >= 0) return "detention_vide";
  if (hay.indexOf("surestar") >= 0 || hay.indexOf("demurrage") >= 0) return "surestaries_compagnie";
  if (hay.indexOf("location") >= 0) return "compagnie_location";
  if (hay.indexOf("debarq") >= 0 || hay.indexOf("manutention") >= 0) return "compagnie_debarquement";
  if (hay.indexOf("transport") >= 0 || hay.indexOf("camion") >= 0) return "transport_terr";
  return "autre";
}

/**
 * Devine le status d'une Depense legacy depuis son ancien champ `s`.
 * Legacy 'PAYE' => 'payee' ; sinon => 'a_payer' (on suppose facture recue).
 */
export function guessStatus(dep: { s?: string }): "en_attente_facture" | "a_payer" | "payee" {
  if (dep.s === "PAYE") return "payee";
  return "a_payer";
}

export interface StubContext {
  today?: Date;             // defaut new Date()
  joursAuPort?: number;     // jours ecoules depuis arrivee (pour surestaries_compagnie)
  joursRetourVide?: number; // jours ecoules depuis sortie TC (pour detention_vide)
}

/**
 * Liste les categories a stubber a l'arrivee d'un TC pour un dossier donne.
 * Ordre chronologique metier respecte.
 */
export function categoriesToStubArrivee(dos: Dossier, ctx: StubContext = {}): DepenseCategorie[] {
  var out: DepenseCategorie[] = [];

  // 1. + 2. Compagnie location et debarquement (toujours)
  out.push("compagnie_location");
  out.push("compagnie_debarquement");

  // 3. + 4. Caution et lettre de garantie (TRANSIT sans garantie permanente)
  var isTransit = dos.td === "TRANSIT";
  var hasGarantiePerm = dos.gr === "PERMANENTE";
  if (isTransit && !hasGarantiePerm) {
    out.push("caution");
    out.push("lettre_garantie");
  }

  // 5. Surestaries compagnie (si joursAuPort > franchise)
  if (ctx.joursAuPort !== undefined) {
    var franchiseCp = getFranchiseCompagnie(dos);
    if (ctx.joursAuPort > franchiseCp) {
      out.push("surestaries_compagnie");
    }
  }

  // 6. BESC (si toggle actif sur dossier)
  if (dos.besc === true) {
    out.push("besc");
  }

  // 7. ORBUS (toujours)
  out.push("orbus");

  // 8. DPWorld (toujours)
  out.push("dpworld");

  return out;
}

/**
 * Liste les categories a stubber au retour vide (detention conteneur).
 * Un seul item possible : `detention_vide`.
 */
export function categoriesToStubRetourVide(dos: Dossier, ctx: StubContext = {}): DepenseCategorie[] {
  var out: DepenseCategorie[] = [];
  if (dos.ror === true) return out;               // RoRo : pas de conteneur a retourner
  if (ctx.joursRetourVide === undefined) return out;
  var franchiseRt = getFranchiseRetourVide(dos);
  if (ctx.joursRetourVide > franchiseRt) {
    out.push("detention_vide");
  }
  return out;
}

/**
 * Filtre les categories pour eviter de recreer un stub deja present sur
 * le dossier. Une Depense existante "couvre" sa categorie meme si :
 *  - elle a `ignored: true` (soft-delete) → on ne re-stub pas
 *  - elle est en legacy (pas de champ categorie) → on devine via guessCategorie
 */
export function filterAntiDoublon(
  categories: DepenseCategorie[],
  existing: Depense[],
): DepenseCategorie[] {
  var exist = new Set<DepenseCategorie>();
  for (var i = 0; i < existing.length; i++) {
    var d = existing[i];
    if (d.categorie) {
      exist.add(d.categorie);
    } else {
      exist.add(guessCategorie({ tp: d.tp, ds: d.ds }));
    }
  }
  return categories.filter(function (c) { return !exist.has(c); });
}

/**
 * Construit les Depenses stubs a partir d'une liste de categories.
 * Retourne des Depense SANS id (Firestore generera au write).
 */
export function buildStubDepenses(
  dos: Dossier,
  categories: DepenseCategorie[],
  ctx: StubContext = {},
): Omit<Depense, "id">[] {
  var today = ctx.today ? ctx.today : new Date();
  var isoDate = today.toISOString().slice(0, 10);

  return categories.map(function (c) {
    var meta = getCategorieMeta(c);
    var fournisseur = meta.fournisseur
      ? meta.fournisseur
      : (meta.tp === "COMPAGNIE" && dos.cp ? dos.cp : null);
    var ds = fournisseur ? meta.libelle + " (" + fournisseur + ")" : meta.libelle;

    var dep: Omit<Depense, "id"> = {
      did: dos.id,
      tp: meta.tp,
      mt: 0,
      dt: isoDate,
      ds: ds,
      s: "ATT",                        // legacy compat : "en attente"
      status: "en_attente_facture",
      auto: true,
      ignored: false,
      categorie: c,
    };
    return dep;
  });
}

/**
 * API principale : genere les stubs Depense a l'arrivee d'un TC.
 * Respecte ordre metier, franchises, toggles dossier, anti-doublon.
 */
export function stubDepensesArrivee(
  dos: Dossier,
  existing: Depense[],
  ctx: StubContext = {},
): Omit<Depense, "id">[] {
  var cats = categoriesToStubArrivee(dos, ctx);
  var notDup = filterAntiDoublon(cats, existing);
  return buildStubDepenses(dos, notDup, ctx);
}

/**
 * API principale : genere le stub Depense detention vide apres livraison.
 */
export function stubDepensesRetourVide(
  dos: Dossier,
  existing: Depense[],
  ctx: StubContext = {},
): Omit<Depense, "id">[] {
  var cats = categoriesToStubRetourVide(dos, ctx);
  var notDup = filterAntiDoublon(cats, existing);
  return buildStubDepenses(dos, notDup, ctx);
}

/**
 * Detecte la transition "nouvelle arrivee" sur un dossier.
 * True si `da` etait absent et vient d'etre renseigne.
 * Utilise par les declencheurs (patchDos, editDos, syncDPWorld).
 */
export function isNewArrival(oldDos: Dossier | undefined, newDos: Dossier): boolean {
  var hadDa = !!(oldDos && oldDos.da);
  var hasDa = !!newDos.da;
  return !hadDa && hasDa;
}

/**
 * Variante de stubDepensesArrivee qui retourne des Depense completes (avec id)
 * pretes a push dans db.dep. L'id est genere via mkId (injecte pour rester pur).
 */
export function generateArrivalStubsWithIds(
  newDos: Dossier,
  existingDep: Depense[],
  mkId: () => string,
  ctx: StubContext = {},
): Depense[] {
  var dosDep = existingDep.filter(function (d) { return d.did === newDos.id; });
  var stubs = stubDepensesArrivee(newDos, dosDep, ctx);
  return stubs.map(function (s) { return Object.assign({ id: mkId() }, s) as Depense; });
}
