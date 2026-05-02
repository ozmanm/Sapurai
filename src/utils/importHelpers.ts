// src/utils/importHelpers.ts
// Fonctions utilitaires pour l'import Excel — extraites de ImportExcel.jsx

export var SHEET_TYPES: Record<string, { keywords: string[]; label: string }> = {
  dossiers: { keywords: ["bl", "connaissement", "numbl", "client", "destinat", "consign", "dossier", "vuegener", "general"], label: "Connaissements / Dossiers" },
  conteneurs: { keywords: ["numconteneur", "container", "conteneur", "numtc", "tc"], label: "Conteneurs" },
  factures: { keywords: ["numfact", "facture", "montantht", "montantttc", "invoice", "depense", "facturation", "surestari", "pregate", "location", "situation"], label: "Factures / Depenses" },
  chauffeurs: { keywords: ["chauffeur", "numcamion", "camion", "numpermis", "conducteur"], label: "Chauffeurs / Camions" },
  detention: { keywords: ["detention", "franchise", "caution", "dateretour"], label: "Detention / Cautions" }
};

export function detectSheetType(headers: (string | null)[], sheetName?: string): string {
  var hl = headers.map(function (h) { return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, ""); });
  var snl = (sheetName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  var scores: Record<string, number> = {};
  Object.keys(SHEET_TYPES).forEach(function (type) {
    var s = 0;
    SHEET_TYPES[type].keywords.forEach(function (kw) {
      hl.forEach(function (h) { if (h.indexOf(kw) >= 0) s++; });
      if (snl.indexOf(kw) >= 0) s += 2;
    });
    scores[type] = s;
  });
  var best = Object.keys(scores).reduce(function (a, b) { return scores[a] >= scores[b] ? a : b; });
  return scores[best] > 0 ? best : "dossiers";
}

export function findCol(headers: (string | null)[], patterns: string[]): number {
  var hl = headers.map(function (h) {
    return String(h || "").toLowerCase()
      .replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e").replace(/[îï]/g, "i").replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u")
      .replace(/[^a-z0-9]/g, "");
  });
  for (var p = 0; p < patterns.length; p++) {
    for (var i = 0; i < hl.length; i++) {
      if (hl[i].indexOf(patterns[p]) >= 0) return i;
    }
  }
  return -1;
}

export function parseDate(val: unknown): string {
  if (!val) return "";
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var m = s.match(/^(\d{1,2})[\/\-.\ ](\d{1,2})[\/\-.\ ](\d{2,4})$/);
  if (m) {
    var y = m[3].length === 2 ? "20" + m[3] : m[3];
    return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  }
  var num = parseFloat(val as string);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    var d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  return "";
}

export function parseNum(val: unknown): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/\s/g, "").replace(",", ".")) || 0;
}

export function normBL(val: unknown): string {
  if (val == null) return "";
  var s = String(val).trim();
  s = s.replace(/\.0+$/, "");
  return s.toUpperCase();
}

export function normType(val: unknown): string {
  var t = String(val || "").toUpperCase().replace(/[''"\s]/g, "").replace(/PIEDS?/g, "").replace(/[^A-Z0-9]/g, "");
  if (t.indexOf("45") >= 0 || t.indexOf("40HC") >= 0 || t.indexOf("40H") >= 0) return "40HC";
  if (t.indexOf("40GP") >= 0 || t === "40") return "40GP";
  if (t.indexOf("20RF") >= 0) return "20RF";
  if (t.indexOf("40RF") >= 0) return "40RF";
  if (t.indexOf("20") >= 0) return "20GP";
  if (t.indexOf("40") >= 0) return "40GP";
  return "20GP";
}

export var RE_TC: RegExp = /^[A-Z]{4}\d{7}$/;

export var BL_PREFIXES: string[] = ["HLCU", "HLXU", "COSU", "COSN", "OOLU", "ONEY", "MAEU", "MSKU", "MEDU", "CMAU", "ANMU", "YMLU", "HDMU", "ZIMU", "EGLV", "SNKO", "KMTC"];

export function splitContainers(val: unknown): string[] {
  if (!val) return [];
  var raw = String(val).toUpperCase();
  var parts = raw.split(/[\/,;\n]+/);
  var results: string[] = [];
  parts.forEach(function (p) {
    var s = p.trim().replace(/[^A-Z0-9]/g, "");
    if (RE_TC.test(s)) { results.push(s); return; }
    var noSpace = p.trim().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "").toUpperCase();
    if (RE_TC.test(noSpace)) results.push(noSpace);
  });
  return results;
}

export function isContainerNumber(val: unknown): string | null {
  var s = String(val || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return RE_TC.test(s) ? s : null;
}

export function isBLNumber(val: unknown): string | null {
  var raw = String(val || "").trim().replace(/\.0+$/, "");
  if (/^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(raw)) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  var s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s || s.length < 6 || s.length > 30) return null;
  if (RE_TC.test(s)) return null;
  for (var i = 0; i < BL_PREFIXES.length; i++) {
    if (s.indexOf(BL_PREFIXES[i]) === 0 && s.length >= 9) return s;
  }
  if (/^\d{6,15}$/.test(s)) return s;
  if (/^[A-Z0-9]{8,20}$/.test(s) && (s.match(/\d/g) || []).length >= 3) return s;
  return null;
}

export function isAmount(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  var n = parseNum(val);
  if (n >= 1000 && n <= 500000000) return n;
  return null;
}

export function isDate(val: unknown): string | null {
  var d = parseDate(val);
  return d || null;
}

export function isClientName(val: unknown): string | null {
  var s = String(val || "").trim();
  if (s.length < 3 || s.length > 60) return null;
  if (/^\d+$/.test(s.replace(/[\s.,]/g, ""))) return null;
  if (isContainerNumber(s) || isBLNumber(s)) return null;
  var letters = (s.match(/[a-zA-ZàâäéèêëîïôöùûüÀ-Ü]/g) || []).length;
  if (letters / s.length < 0.6) return null;
  return s.toUpperCase();
}

export function isTCType(val: unknown): string | null {
  var s = String(val || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^(20GP|40GP|40HC|20RF|40RF|45HC|20|40|45)$/.test(s)) return normType(s);
  if (/^\d{2}(GP|HC|RF|OT|FR|TK)$/.test(s)) return normType(s);
  return null;
}
