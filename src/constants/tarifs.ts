// Tarifs par défaut (grille vierge à remplir par société)
interface TarifConfig {
  location: Record<string, Record<string, number>>;
  autres: Record<string, Record<string, number>>;
  dpworld: Record<string, number>;
  orbus: Record<string, number>;
  mission: number;
}

export var DEF_TARIFS: TarifConfig = {
  location: {
    "CMA CGM": { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
    "MAERSK":  { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
    "MSC":     { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
    "PIL":     { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
  },
  autres: {
    "CMA CGM": { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
    "MAERSK":  { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
    "MSC":     { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
    "PIL":     { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
  },
  dpworld:  { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
  orbus:    { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, "20RF": 0, "40RF": 0 },
  mission: 30000,
};
