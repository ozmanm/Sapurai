// Types de dépenses
export var DTL: Record<string, string> = {
  TRANSPORT: "Transport",
  LOCATION_TC: "Location TC",
  DPWORLD: "DP World",
  DOUANE: "Douane",
  SURESTARIES: "Surestaries",
  DETENTIONS: "Detentions",
  Orbus: "Orbus",
  AUTRE: "Autre",
};

// Phases de paiement transport
export var TPHASES: Record<string, string> = {
  AVANCE_DK:   "Avance Dakar",
  ACOMPTE_BAM: "Acompte Bamako",
  URGENCE:     "Urgence route",
  RELIQUAT:    "Reliquat retour",
};

// Types de conteneurs
export var TCTYPES_ALL: string[] = ["20GP", "40GP", "40HC", "45HC", "20RF", "40RF"];
