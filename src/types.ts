// Types du domaine metier Sapurai

export interface DocAttachment {
  id: string;
  tp: string;
  fn: string;
  ft: string;
  sz: number;
  dt: string;
}

export interface Intervenant {
  id?: string;
  nm: string;
  role?: string;
  tl?: string;
  notes?: string;
  taches?: string[];       // BAD, BAE, PREGATE, TRANSIT, LIVRAISON, MANUT, FACT
  tachesDone?: string[];
  voirDepenses?: boolean;  // Permission explicite : agent peut voir la section Depenses du dossier
}

export interface Conteneur {
  // Identite
  id?: string;
  did?: string;
  n?: string;          // numero conteneur
  ty?: string;         // type : 20GP, 40GP, 40HC, 20RF, 40RF
  po?: number;         // poids kg

  // Cycle de vie
  st?: "ATTENDU" | "PORT" | "DISPATCHE" | "TRANSIT" | "KATI" | "BAMAKO" | "RETURNED" | string;

  // Dates de parcours (ISO)
  da?: string;         // date attendue
  dsp?: string;        // date dispatch
  dtk?: string;        // date sortie Dakar
  dak?: string;        // date arrivee Kati
  dab?: string;        // date arrivee Bamako
  dr?: string;         // date retour

  // Chauffeur denormalise (snapshot au moment du dispatch)
  ch?: string;         // nom chauffeur
  cm?: string;         // immatriculation camion
  tl?: string;         // telephone chauffeur

  // Paiement transport
  pc?: number;         // prix chauffeur
  pg?: string;         // phase paiement
  tranche?: unknown[];

  // Budget / incident
  budget?: string | number;
  inc?: string;        // note / incident

  // Sprint D.2 — suivi caution TC par TC
  gar_recup?: boolean;     // caution recuperee pour ce TC ?
  gar_recup_dt?: string;   // date de recuperation (ISO court)
  gar_recup_note?: string; // note libre (ex: "perdu chez X", "soldee par detention")
}

export interface Dossier {
  // Identite
  id: string;
  bl: string;
  cl: string;
  cp?: string;        // Compagnie maritime
  ct?: string;        // Telephone client

  // Dates
  da?: string;        // Date arrivee (ISO)

  // Statuts documentaires (OBTENU / EN_COURS / NON_DEMANDE / BLOQUE)
  bs?: string;        // BSC (Bordereau de Suivi Cargaison)
  as2?: string;       // BAE (Bon A Enlever)
  bv?: string;        // Date validite BAD (ISO)
  bd?: string;        // Date BAE (ISO)
  pn?: string;        // Numero pregate / DO

  // Financier
  nd?: string;        // Numero declaration douaniere
  rv?: number;        // Recette (revenu)
  pf?: number;        // Profit / frais

  // Logistique
  cr?: string;        // Destination (ex-corridor)
  ce?: string;        // Email client

  // Garantie / Caution
  gr?: "PERMANENTE" | "LOUEE" | "VENDUE" | string;
  gar_contact?: string;
  gar_tel?: string;
  gar_frais?: number;             // montant total de la lettre (legacy + total auto-calcule)
  gar_caution?: number;           // montant total de la caution (legacy + total auto-calcule)
  gar_caution_unit?: number;      // Sprint D.2 — montant unitaire caution (par TC)
  gar_frais_unit?: number;        // Sprint D.2 — montant unitaire lettre (par TC)
  gar_statut?: "VERSEE" | "RECUPEREE" | "PERDUE" | "RETENUE" | "REMBOURSEE" | "CONSERVEE" | string;

  // Cycle de vie
  st: "ACTIF" | "CLOTURE" | "ARCHIVE" | "INITIALISE" | string;

  // Attachements
  docs?: DocAttachment[];
  itv?: Intervenant[];

  // Securite tracking public
  tokId?: string;

  // Rating client — champs DERIVES depuis /tracking/{tokId} par le listener
  // useData. JAMAIS persistes sur le doc dossier principal. Ne pas ecrire
  // via patchDos — source de verite = le doc tracking.
  rating?: 1 | 2 | 3;          // 1=Tres satisfait, 2=Correct, 3=Probleme
  ratingComment?: string;      // Texte libre (rating=3 uniquement, 200 car max)
  ratingReasons?: string[];    // Checklist cases cochees (rating=3 uniquement)
  ratingAt?: string;           // ISO string convertie depuis Timestamp Firestore

  // Phase import uniquement (ImportExcel) — jamais persistes comme tels
  tcs?: Conteneur[];
  nbTc?: number;
  defType?: string;

  // Auto-stub Depenses a l'arrivee (commit 1 - fondations)
  td?: "IMPORT" | "TRANSIT" | "VEHICULE" | string;  // type dossier
  frCp?: number;      // franchise compagnie (jours), defaut 10
  frMg?: number;      // franchise magasinage DPWorld (jours), defaut auto selon td
  frRt?: number;      // franchise retour vide (jours), defaut auto selon destination
  besc?: boolean;     // BESC attendu (defaut true si IMPORT, false sinon)
  ror?: boolean;      // Vehicule en RoRo (sur navire, pas de retour vide)
}

/**
 * Categorie metier d'une Depense (utilise par l'auto-stub a l'arrivee
 * et pour le filtrage / tri dans les vues).
 */
export type DepenseCategorie =
  | "compagnie_location"
  | "compagnie_debarquement"
  | "surestaries_compagnie"
  | "caution"
  | "lettre_garantie"
  | "besc"
  | "orbus"
  | "detention_vide"
  | "dpworld"
  | "transport_terr"
  | "autre";

/**
 * Document stocke dans /tracking/{tokId}.
 * - Ecrit par shareTracking / syncTracking cote patron authentifie.
 * - Update UNE SEULE FOIS par client non-authentifie (rating).
 * - Rules Firestore : read public, write auth restreint, update public strict rating.
 */
export interface TrackingDoc {
  // Identite dossier (snapshot partage)
  companyId: string;
  cl: string;
  bl: string;
  cp?: string;
  da?: string;
  coName?: string;
  tcs?: Array<{ n: string; ty: string; st: string; dsp?: string; dak?: string; dab?: string }>;
  dosSt?: string;              // Snapshot de Dossier.st — widget rating visible si CLOTURE/ARCHIVE

  // Multi-dossier (type === "client")
  type?: "client";
  dossiers?: Array<{ id: string; bl: string; cp?: string; da?: string; tcs: unknown[] }>;

  // Partage
  shared: boolean;
  updatedAt: string | number | object;  // serverTimestamp au write

  // Rating (optionnel, ecrit UNE fois par un visiteur)
  rating?: 1 | 2 | 3;
  ratingComment?: string;
  ratingReasons?: string[];
  ratingAt?: string | number | object;  // Timestamp Firestore
}

export interface Depense {
  id: string;
  did: string;

  // Metadonnees
  tp: string;                      // type : TRANSPORT, DPWORLD, AUTRE, ...
  ph?: "AVANCE_DK" | "ACOMPTE_BAM" | "URGENCE" | "RELIQUAT" | string; // phase paiement (si TRANSPORT)
  tcid?: string;                   // lien au conteneur (si TRANSPORT)

  // Montants
  mt: number;                      // montant TTC
  ht?: number;                     // montant HT

  // Facture
  dt: string;                      // date ISO
  nf?: string;                     // numero facture
  ds?: string;                     // description / libelle

  // Statut (le code utilise `s`, pas `st` — historique)
  s?: "PAYE" | "ATT" | string;

  // Attachement
  fid?: string;                    // file ID (DocAttachment.id)
  fi?: { fn: string };             // attachement inline legacy

  // Auto-stub a l'arrivee (commit 1 - fondations)
  // `status` est la source de verite cote nouveau code ; `s` reste pour compat
  // ascendante. Migration lazy : si status absent et s === 'PAYE' => 'payee',
  // sinon defaut 'a_payer'. Cf. utils/stub.guessStatus.
  status?: "en_attente_facture" | "a_payer" | "payee";
  auto?: boolean;                  // true = stub auto genere a l'arrivee
  ignored?: boolean;               // soft-delete : stub ecarte par l'user (faux positif)
  categorie?: DepenseCategorie;    // pour tri + filtrage
}

export interface Chauffeur {
  id: string;
  nm: string;              // nom (majuscule)
  cm?: string;             // immatriculation camion
  tl?: string;             // telephone
  tr?: string;             // tracteur (plaque optionnelle)
  pm?: number;             // poids max kg (0 = illimite)
  tty?: string[];          // types TC acceptes (20GP, 40HC...)
  bl?: boolean;            // blackliste
  blr?: string;            // raison blacklist
}

export interface Config {
  name?: string;
  fm?: number;
  fp?: number;
  ft?: number;
  ts?: number;
  clientTokens?: Record<string, string>;
  [key: string]: unknown;
}

export interface Alerte {
  tn: string;
  dn: string;
  cl: string;
  tp: string;
  facture: string;
  j: number;
  r: number;
  col: string;
  did: string;
  tid: string;
}

export interface Urgence {
  cat: string;
  msg: string;
  sub: string;
  did: string;
  level: "warning" | "critical";
}

export interface AlertesFranchiseResult {
  alertes: Alerte[];
  urgences: Urgence[];
  totalSurestariesJours: number;
  totalSurestariesFCFA: number;
  nSurestaries?: number;
}

export interface ValidationRules {
  required?: boolean;
  maxLen?: number;
  minVal?: number;
  maxVal?: number;
  pattern?: RegExp;
  patternMsg?: string;
}

export interface ValidateAllResult {
  errors: Record<string, string>;
  hasErrors: boolean;
  firstError: string | null;
}
