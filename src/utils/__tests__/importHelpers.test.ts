import { describe, it, expect } from 'vitest';
import {
  splitContainers, normBL, normType, parseDate, parseNum,
  isContainerNumber, isBLNumber, isAmount, isDate, isClientName, isTCType,
  detectSheetType, findCol, SHEET_TYPES, RE_TC, BL_PREFIXES
} from '../importHelpers.js';

// ── splitContainers ──
describe('splitContainers', function () {
  it('retourne [] pour null/undefined/vide', function () {
    expect(splitContainers(null)).toEqual([]);
    expect(splitContainers(undefined)).toEqual([]);
    expect(splitContainers("")).toEqual([]);
  });
  it('extrait un seul TC', function () {
    expect(splitContainers("FANU1578957")).toEqual(["FANU1578957"]);
  });
  it('extrait multi-TC separes par /', function () {
    expect(splitContainers("FANU1578957/GCXU5183308")).toEqual(["FANU1578957", "GCXU5183308"]);
  });
  it('extrait multi-TC separes par ,', function () {
    expect(splitContainers("MRSU0626259,TEMU8837410")).toEqual(["MRSU0626259", "TEMU8837410"]);
  });
  it('extrait multi-TC separes par ;', function () {
    expect(splitContainers("MRSU0626259;TEMU8837410")).toEqual(["MRSU0626259", "TEMU8837410"]);
  });
  it('gere les espaces internes (HLBU 3170520)', function () {
    expect(splitContainers("HLBU 3170520")).toEqual(["HLBU3170520"]);
  });
  it('gere newline', function () {
    expect(splitContainers("FANU1578957\nGCXU5183308")).toEqual(["FANU1578957", "GCXU5183308"]);
  });
  it('retourne [] pour valeur non-TC', function () {
    expect(splitContainers("BONJOUR")).toEqual([]);
    expect(splitContainers("12345")).toEqual([]);
  });
  it('ignore les parties invalides dans un mix', function () {
    expect(splitContainers("FANU1578957/INVALID/GCXU5183308")).toEqual(["FANU1578957", "GCXU5183308"]);
  });
});

// ── normBL ──
describe('normBL', function () {
  it('retourne "" pour null', function () {
    expect(normBL(null)).toBe("");
  });
  it('strip .0 trailing', function () {
    expect(normBL("259330400.0")).toBe("259330400");
  });
  it('trim et uppercase', function () {
    expect(normBL(" abc ")).toBe("ABC");
  });
  it('gere un nombre', function () {
    expect(normBL(259330400)).toBe("259330400");
  });
});

// ── normType ──
describe('normType', function () {
  it("20' → 20GP", function () {
    expect(normType("20'")).toBe("20GP");
  });
  it("40HC → 40HC", function () {
    expect(normType("40HC")).toBe("40HC");
  });
  it("45 → 40HC", function () {
    expect(normType("45")).toBe("40HC");
  });
  it("40GP → 40GP", function () {
    expect(normType("40GP")).toBe("40GP");
  });
  it("40 → 40GP", function () {
    expect(normType("40")).toBe("40GP");
  });
  it("20RF → 20RF", function () {
    expect(normType("20RF")).toBe("20RF");
  });
  it("40RF → 40RF", function () {
    expect(normType("40RF")).toBe("40RF");
  });
  it("40 PIEDS → 40GP", function () {
    expect(normType("40 PIEDS")).toBe("40GP");
  });
  it("vide → 20GP (defaut)", function () {
    expect(normType("")).toBe("20GP");
  });
  it("null → 20GP (defaut)", function () {
    expect(normType(null)).toBe("20GP");
  });
});

// ── isContainerNumber ──
describe('isContainerNumber', function () {
  it('valide ISO 6346', function () {
    expect(isContainerNumber("FANU1578957")).toBe("FANU1578957");
  });
  it('normalise minuscules', function () {
    expect(isContainerNumber("fanu1578957")).toBe("FANU1578957");
  });
  it('retourne null pour invalide', function () {
    expect(isContainerNumber("ABC123")).toBeNull();
    expect(isContainerNumber("")).toBeNull();
    expect(isContainerNumber(null)).toBeNull();
  });
  it('retourne null pour trop court', function () {
    expect(isContainerNumber("FANU157895")).toBeNull();
  });
});

// ── isBLNumber ──
describe('isBLNumber', function () {
  it('detecte prefixe connu HLCU', function () {
    expect(isBLNumber("HLCUBO12507AXHU6")).not.toBeNull();
  });
  it('detecte prefixe COSU', function () {
    expect(isBLNumber("COSU6419015160")).not.toBeNull();
  });
  it('detecte numerique pur 6-15 digits', function () {
    expect(isBLNumber("259330400")).not.toBeNull();
  });
  it('strip .0 Excel', function () {
    expect(isBLNumber("259330400.0")).not.toBeNull();
  });
  it('retourne null si trop court', function () {
    expect(isBLNumber("ABC")).toBeNull();
  });
  it('exclut les dates ISO', function () {
    expect(isBLNumber("2026-01-15")).toBeNull();
  });
  it('exclut les dates DD/MM/YYYY', function () {
    expect(isBLNumber("15/01/2026")).toBeNull();
  });
  it('exclut les numeros de conteneur', function () {
    expect(isBLNumber("FANU1578957")).toBeNull();
  });
  it('retourne null pour vide', function () {
    expect(isBLNumber("")).toBeNull();
    expect(isBLNumber(null)).toBeNull();
  });
});

// ── isAmount ──
describe('isAmount', function () {
  it('detecte montant FCFA valide', function () {
    expect(isAmount(150000)).toBe(150000);
  });
  it('detecte string avec espaces', function () {
    expect(isAmount("150 000")).toBe(150000);
  });
  it('retourne null sous 1000', function () {
    expect(isAmount(500)).toBeNull();
  });
  it('retourne null pour vide', function () {
    expect(isAmount("")).toBeNull();
    expect(isAmount(null)).toBeNull();
  });
  it('retourne null au-dessus du max', function () {
    expect(isAmount(600000000)).toBeNull();
  });
});

// ── isDate ──
describe('isDate', function () {
  it('detecte ISO', function () {
    expect(isDate("2026-01-15")).toBe("2026-01-15");
  });
  it('detecte DD/MM/YYYY', function () {
    expect(isDate("15/01/2026")).toBe("2026-01-15");
  });
  it('retourne null pour vide', function () {
    expect(isDate("")).toBeNull();
    expect(isDate(null)).toBeNull();
  });
  it('detecte Excel serial number', function () {
    var result = isDate(45302);
    expect(result).toBeTruthy();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── isClientName ──
describe('isClientName', function () {
  it('detecte nom valide', function () {
    expect(isClientName("Abdoulaye Diallo")).toBe("ABDOULAYE DIALLO");
  });
  it('retourne null pour nombre pur', function () {
    expect(isClientName("12345")).toBeNull();
  });
  it('retourne null si trop court', function () {
    expect(isClientName("AB")).toBeNull();
  });
  it('retourne null pour numero TC', function () {
    expect(isClientName("FANU1578957")).toBeNull();
  });
  it('gere les accents', function () {
    expect(isClientName("Sékou Touré")).toBe("SÉKOU TOURÉ");
  });
});

// ── isTCType ──
describe('isTCType', function () {
  it('detecte 20GP', function () {
    expect(isTCType("20GP")).toBe("20GP");
  });
  it('detecte 40HC', function () {
    expect(isTCType("40HC")).toBe("40HC");
  });
  it('detecte format court 20', function () {
    expect(isTCType("20")).toBe("20GP");
  });
  it('retourne null pour inconnu', function () {
    expect(isTCType("abc")).toBeNull();
    expect(isTCType("")).toBeNull();
  });
  it('detecte format etendu 20OT', function () {
    expect(isTCType("20OT")).not.toBeNull();
  });
});

// ── parseDate ──
describe('parseDate', function () {
  it('parse ISO', function () {
    expect(parseDate("2026-01-15")).toBe("2026-01-15");
  });
  it('parse DD/MM/YYYY', function () {
    expect(parseDate("15/01/2026")).toBe("2026-01-15");
  });
  it('parse DD.MM.YY', function () {
    expect(parseDate("15.01.26")).toBe("2026-01-15");
  });
  it('retourne "" pour null', function () {
    expect(parseDate(null)).toBe("");
  });
  it('retourne "" pour vide', function () {
    expect(parseDate("")).toBe("");
  });
  it('parse Excel serial', function () {
    // 45302 = 2024-01-15 environ
    var result = parseDate(45302);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── parseNum ──
describe('parseNum', function () {
  it('parse nombre normal', function () {
    expect(parseNum(150000)).toBe(150000);
  });
  it('parse string avec espaces', function () {
    expect(parseNum("150 000")).toBe(150000);
  });
  it('parse virgule decimale', function () {
    expect(parseNum("1,5")).toBe(1.5);
  });
  it('retourne 0 pour null', function () {
    expect(parseNum(null)).toBe(0);
  });
  it('retourne 0 pour vide', function () {
    expect(parseNum("")).toBe(0);
  });
});

// ── detectSheetType ──
describe('detectSheetType', function () {
  it('detecte dossiers via headers BL/client', function () {
    expect(detectSheetType(["N° BL", "Client", "Compagnie"], "Feuille1")).toBe("dossiers");
  });
  it('detecte conteneurs via header', function () {
    expect(detectSheetType(["Num Conteneur", "Type", "Poids"], "Sheet1")).toBe("conteneurs");
  });
  it('detecte factures via header', function () {
    expect(detectSheetType(["N° Facture", "Montant TTC", "Statut"], "Depenses")).toBe("factures");
  });
  it('detecte chauffeurs via header', function () {
    expect(detectSheetType(["Chauffeur", "Num Camion", "Permis"], "Conducteurs")).toBe("chauffeurs");
  });
  it('le nom de feuille pese double', function () {
    expect(detectSheetType(["Col1", "Col2"], "Conteneurs")).toBe("conteneurs");
  });
  it('defaut dossiers si rien ne matche', function () {
    expect(detectSheetType(["X", "Y", "Z"], "Random")).toBe("dossiers");
  });
});

// ── findCol ──
describe('findCol', function () {
  it('trouve une colonne par pattern', function () {
    expect(findCol(["Client", "N° BL", "Montant"], ["montant"])).toBe(2);
  });
  it('retourne -1 si pas trouve', function () {
    expect(findCol(["Client", "BL"], ["xyz"])).toBe(-1);
  });
  it('gere les accents', function () {
    expect(findCol(["Montant dépensé"], ["depense"])).toBe(0);
  });
  it('insensible a la casse', function () {
    expect(findCol(["CLIENT"], ["client"])).toBe(0);
  });
  it('retourne le premier match du premier pattern', function () {
    expect(findCol(["A", "Client", "client2"], ["client"])).toBe(1);
  });
});

// ── Constantes ──
describe('constantes', function () {
  it('RE_TC matche ISO 6346', function () {
    expect(RE_TC.test("FANU1578957")).toBe(true);
    expect(RE_TC.test("ABC123")).toBe(false);
  });
  it('BL_PREFIXES contient les majeurs', function () {
    expect(BL_PREFIXES).toContain("MAEU");
    expect(BL_PREFIXES).toContain("CMAU");
    expect(BL_PREFIXES).toContain("HLCU");
  });
  it('SHEET_TYPES a 5 types', function () {
    expect(Object.keys(SHEET_TYPES)).toHaveLength(5);
  });
});
