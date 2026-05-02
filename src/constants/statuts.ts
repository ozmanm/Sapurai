// Statuts conteneurs
export var PL: string[] = ["ATTENDU", "PORT", "DISPATCHE", "TRANSIT", "KATI", "BAMAKO", "RETURNED"];

export var SL: Record<string, string> = {
  ATTENDU: "Attendu",
  PORT: "Au Port",
  DISPATCHE: "Dispatche",
  TRANSIT: "En Transit",
  KATI: "Kati",
  BAMAKO: "Bamako",
  RETURNED: "Retourne",
};

export var SC: Record<string, string> = {
  ATTENDU: "var(--sc-attendu)",
  PORT: "var(--sc-port)",
  DISPATCHE: "var(--sc-dispatche)",
  TRANSIT: "var(--sc-transit)",
  KATI: "var(--sc-kati)",
  BAMAKO: "var(--sc-bamako)",
  RETURNED: "var(--sc-returned)",
};

export var SB: Record<string, string> = {
  ATTENDU: "var(--sb-attendu)",
  PORT: "var(--sb-port)",
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
