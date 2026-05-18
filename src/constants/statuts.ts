// Statuts conteneurs
// Sprint 46 : ajout ASSIGNE entre PORT et DISPATCHE, retrait de KATI.
// KATI conserve dans SL/SC/SB en lecture seule pour rendu des TC legacy
// non encore migres (transition automatique vers TRANSIT via le script).
export var PL: string[] = ["ATTENDU", "PORT", "ASSIGNE", "DISPATCHE", "TRANSIT", "BAMAKO", "RETURNED"];

export var SL: Record<string, string> = {
  ATTENDU: "Attendu",
  PORT: "Au Port",
  ASSIGNE: "Camion assigne",
  DISPATCHE: "Charge / Sorti",
  TRANSIT: "En Transit",
  KATI: "Kati (legacy)",  // legacy : TCs pas encore migres
  BAMAKO: "Bamako",
  RETURNED: "Retourne",
};

export var SC: Record<string, string> = {
  ATTENDU: "var(--sc-attendu)",
  PORT: "var(--sc-port)",
  ASSIGNE: "var(--sc-assigne, var(--sc-port))",
  DISPATCHE: "var(--sc-dispatche)",
  TRANSIT: "var(--sc-transit)",
  KATI: "var(--sc-kati)",
  BAMAKO: "var(--sc-bamako)",
  RETURNED: "var(--sc-returned)",
};

export var SB: Record<string, string> = {
  ATTENDU: "var(--sb-attendu)",
  PORT: "var(--sb-port)",
  ASSIGNE: "var(--sb-assigne, var(--sb-port))",
  DISPATCHE: "var(--sb-dispatche)",
  TRANSIT: "var(--sb-transit)",
  KATI: "var(--sb-kati)",
  BAMAKO: "var(--sb-bamako)",
  RETURNED: "var(--sb-returned)",
};

// Statuts dossiers
export var DL: Record<string, string> = {
  INITIALISE: "Initialise",
  SECURISE: "Securise",
  EN_TRANSIT: "En Transit",
  CLOTURE: "Cloture",
  ARCHIVE: "Archive",
};

export var DC: Record<string, string> = {
  INITIALISE: "var(--dc-initialise)",
  SECURISE: "var(--dc-securise)",
  EN_TRANSIT: "var(--dc-en_transit)",
  CLOTURE: "var(--dc-cloture)",
  ARCHIVE: "var(--dc-archive)",
};

export var DBG: Record<string, string> = {
  INITIALISE: "var(--dbg-initialise)",
  SECURISE: "var(--dbg-securise)",
  EN_TRANSIT: "var(--dbg-en_transit)",
  CLOTURE: "var(--dbg-cloture)",
  ARCHIVE: "var(--dbg-archive)",
};

// Couleurs alerte franchise
export var ACOL: Record<string, string> = {
  green: "var(--acol-green)",
  orange: "var(--acol-orange)",
  red: "var(--acol-red)",
  black: "var(--acol-black)",
};

export var ABG: Record<string, string> = {
  green: "var(--abg-green)",
  orange: "var(--abg-orange)",
  red: "var(--abg-red)",
  black: "var(--abg-black)",
};
