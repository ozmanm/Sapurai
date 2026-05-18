import { useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import {
  detectSheetType, findCol, parseDate, parseNum,
  normBL, normType, splitContainers,
  isContainerNumber, isBLNumber, isAmount, isDate, isClientName, isTCType
} from './utils/importHelpers.js';

type SheetData = { name: string; headers: string[]; rows: any[][]; type: string; rowCount: number };
type ImportResult = { dossiers: any[]; deps: any[]; chauffeurs: any[]; depsByBl: Record<string, number> };

// Sprint 42 F42.5 - exceljs remplace xlsx (vulnerabilites prototype pollution + ReDoS sans fix).
// Lazy-load pour ne pas gonfler le main bundle.
var exceljsCache: Promise<any> | null = null;
function getExcelJS() {
  if (!exceljsCache) exceljsCache = import('exceljs');
  return exceljsCache;
}

/**
 * Adapter : prend un ArrayBuffer Excel et retourne le meme format que sheet_to_json
 * avec header:1 (rows as arrays). Compatible avec parseWorkbook() existant.
 */
async function readWorkbook(buf: ArrayBuffer): Promise<{ SheetNames: string[]; Sheets: Record<string, any[][]> }> {
  var mod: any = await getExcelJS();
  var ExcelJS = mod.default || mod;
  var workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf);
  var result: { SheetNames: string[]; Sheets: Record<string, any[][]> } = { SheetNames: [], Sheets: {} };
  workbook.eachSheet(function (ws: any) {
    result.SheetNames.push(ws.name);
    var rows: any[][] = [];
    ws.eachRow({ includeEmpty: true }, function (row: any) {
      // row.values est 1-indexed dans exceljs : [undefined, cell1, cell2, ...]
      var values = (row.values || []).slice(1).map(function (v: any) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object' && v !== null) {
          // Cellule avec formule, hyperlink, richText -> extraire la valeur affichee
          if ('result' in v) return v.result;
          if ('text' in v) return v.text;
          if ('hyperlink' in v) return v.text || v.hyperlink;
          if (v instanceof Date) return v;
          if (Array.isArray(v.richText)) return v.richText.map(function (rt: any) { return rt.text; }).join('');
          return String(v);
        }
        return v;
      });
      rows.push(values);
    });
    result.Sheets[ws.name] = rows;
  });
  return result;
}

// Scan all sheets cell by cell, classify, assemble
function patternScan(allSheets: SheetData[]): ImportResult {
  var tcSet: Record<string, any> = {};        // container# → { bl, type, weight }
  var blSet: Record<string, any> = {};        // bl# → { client, date, company, tcs[] }
  var allRows: any[] = [];      // flat list of classified rows

  // Pass 1: scan every cell, classify per row
  allSheets.forEach(function (sheet) {
    sheet.rows.forEach(function (row) {
      var classified = { tcs: [], bls: [], amounts: [], dates: [], names: [], types: [], raw: row, sheetName: sheet.name };

      row.forEach(function (cell) {
        if (cell === null || cell === undefined || cell === "") return;
        var sv = String(cell).trim();
        
        var tcList = splitContainers(sv);
        if (tcList.length > 0) { tcList.forEach(function(t) { classified.tcs.push(t); }); return; }
        var tc = isContainerNumber(sv);
        if (tc) { classified.tcs.push(tc); return; }
        
        var ty = isTCType(sv);
        if (ty) { classified.types.push(ty); return; }
        
        var bl = isBLNumber(sv);
        if (bl) { classified.bls.push(bl); return; }
        
        var dt = isDate(cell);
        if (dt) { classified.dates.push(dt); return; }
        
        var am = isAmount(cell);
        if (am !== null) { classified.amounts.push(am); return; }
        
        var nm = isClientName(sv);
        if (nm) { classified.names.push(nm); return; }
      });
      
      // Only keep rows that have at least one interesting field
      if (classified.tcs.length || classified.bls.length || classified.amounts.length) {
        allRows.push(classified);
      }
    });
  });

  // Pass 2: build BL index from rows that have both BL + other info
  allRows.forEach(function (r) {
    r.bls.forEach(function (bl) {
      if (!blSet[bl]) {
        blSet[bl] = { bl: bl, cl: "", da: "", cp: "", tcs: [], amounts: [] };
      }
      // Attach names, dates from same row
      if (r.names.length > 0 && !blSet[bl].cl) blSet[bl].cl = r.names[0];
      if (r.dates.length > 0 && !blSet[bl].da) blSet[bl].da = r.dates[0];
      // Attach containers from same row
      r.tcs.forEach(function (tc) {
        var ty = r.types.length > 0 ? r.types[0] : "20GP";
        if (!tcSet[tc]) {
          tcSet[tc] = { n: tc, ty: ty, po: "", bl: bl };
          blSet[bl].tcs.push(tcSet[tc]);
        }
      });
      // Attach amounts from same row
      r.amounts.forEach(function (am) {
        blSet[bl].amounts.push({ mt: am, ds: r.names.length > 1 ? r.names[1] : (r.names[0] || "") });
      });
    });
  });

  // Pass 3: orphan containers (TC found without BL on same row)
  // Try to find their BL by checking if the TC appears on any row with a BL
  allRows.forEach(function (r) {
    if (r.bls.length > 0) return; // already handled
    r.tcs.forEach(function (tc) {
      if (tcSet[tc]) return; // already assigned
      // Look for this TC in other rows that have a BL
      var foundBl = null;
      allRows.forEach(function (r2) {
        if (r2.bls.length > 0 && r2.tcs.indexOf(tc) >= 0) foundBl = r2.bls[0];
      });
      if (foundBl && blSet[foundBl]) {
        var ty = r.types.length > 0 ? r.types[0] : "20GP";
        tcSet[tc] = { n: tc, ty: ty, po: "", bl: foundBl };
        blSet[foundBl].tcs.push(tcSet[tc]);
      }
    });
  });

  // Pass 4: detect shipping company from BL prefix
  Object.keys(blSet).forEach(function (bl) {
    if (blSet[bl].cp) return;
    var prefix = bl.slice(0, 4);
    var companies = {
      "HLCU": "HAPAG-LLOYD", "HLXU": "HAPAG-LLOYD",
      "COSU": "COSCO", "COSN": "COSCO",
      "OOLU": "OOCL", "ONEY": "ONE",
      "MAEU": "MAERSK", "MSKU": "MAERSK", "MEDU": "MAERSK",
      "CMAU": "CMA CGM", "ANMU": "ANL",
      "YMLU": "YANG MING", "HDMU": "HMM",
      "ZIMU": "ZIM", "EGLV": "EVERGREEN",
      "SNKO": "SINOKOR", "KMTC": "KMTC"
    };
    if (companies[prefix]) blSet[bl].cp = companies[prefix];
  });

  // Convert to dossier format
  var dossiers = Object.values(blSet).filter(function (d) { return d.tcs.length > 0 || d.cl; });
  var deps: any[] = [];
  dossiers.forEach(function (d) {
    d.amounts.forEach(function (a) {
      deps.push({ bl: d.bl, nf: "", tp: "AUTRE", ht: a.mt, mt: a.mt, s: "ATT", dt: "", ds: a.ds });
    });
  });

  // Build final format matching header-based output
  var dosMap: Record<string, any> = {};
  dossiers.forEach(function (d) {
    dosMap[d.bl] = {
      bl: d.bl, cl: d.cl, cp: d.cp, da: d.da, ct: "", gr: "PERMANENTE",
      bs: "NON_DEMANDE", bv: "", as2: "NON_DEMANDE", nd: "", pn: "",
      nbTc: 0, defType: "20GP",
      tcs: d.tcs.map(function (t) { return { n: t.n, ty: t.ty, po: t.po }; })
    };
  });

  var depsByBl: Record<string, number> = {};
  deps.forEach(function (f) { depsByBl[f.bl] = (depsByBl[f.bl] || 0) + 1; });

  return { dossiers: Object.values(dosMap), deps: deps, chauffeurs: [], depsByBl: depsByBl };
}

// Extract Google Sheets ID from various URL formats
function extractGSheetId(url: string) {
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

var IS2: CSSProperties = { width: "100%", padding: "10px 12px", border: "2px solid var(--border)", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", minHeight: 44, background: "var(--bg-secondary)", color: "var(--text-input)" };

interface ImportExcelProps {
  bulkImport: (dossiers: any[], deps?: any[], chauffeurs?: any[]) => void;
  dos?: any[];
  tcs?: any[];
  onClose: () => void;
}

export default function ImportExcel(p: ImportExcelProps) {
  var [step, setStep] = useState(1);
  var [sheets, setSheets] = useState<SheetData[]>([]);
  var [assignments, setAssignments] = useState<Record<number, string>>({});
  var [result, setResult] = useState<ImportResult | null>(null);
  var [err, setErr] = useState("");
  var [imported, setImported] = useState(0);
  var [gUrl, setGUrl] = useState("");
  var [loadingUrl, setLoadingUrl] = useState(false);
  var [colDebug, setColDebug] = useState<string[] | null>(null);
  var [excluded, setExcluded] = useState<Set<string>>(new Set());

  // BL existants en base pour detection doublons
  var existingBls = new Set((p.dos || []).map(function (d) { return (d.bl || "").toUpperCase(); }).filter(Boolean));

  function parseWorkbook(wb: any) {
    var sheetData = wb.SheetNames.map(function (name: string) {
      // Sprint 42 F42.5 - wb.Sheets[name] est deja un array de rows (exceljs adapter)
      var data: any[][] = wb.Sheets[name] || [];
      if (data.length < 2) return null;
      // Find first non-empty row as header (skip empty rows at top)
      var headerIdx = 0;
      for (var hi = 0; hi < Math.min(data.length, 5); hi++) {
        if (data[hi] && data[hi].filter(Boolean).length >= 2) { headerIdx = hi; break; }
      }
      var headers = data[headerIdx].map(function (h) { return String(h || "").trim(); });
      var rows = data.slice(headerIdx + 1).filter(function (r) { return r.some(function (c) { return c !== undefined && c !== ""; }); });
      if (rows.length === 0) return null;
      return { name: name, headers: headers, rows: rows, type: detectSheetType(headers, name), rowCount: rows.length };
    }).filter(Boolean);
    if (sheetData.length === 0) { setErr("Fichier vide ou pas de donnees"); return; }
    setSheets(sheetData);
    var auto = {};
    sheetData.forEach(function (s, i) { auto[i] = s.type; });
    setAssignments(auto);
    if (sheetData.length === 1) { processData(sheetData, auto); }
    else { setStep(2); }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    var file = e.target.files[0];
    if (!file) return;
    setErr("");
    var reader = new FileReader();
    reader.onload = function (ev) {
      var buf = ev.target!.result as ArrayBuffer;
      readWorkbook(buf).then(parseWorkbook).catch(function (ex: any) {
        setErr("Erreur lecture: " + (ex && ex.message ? ex.message : 'inconnue'));
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function handleGSheet() {
    var id = extractGSheetId(gUrl);
    if (!id) { setErr("URL Google Sheets invalide. Collez le lien complet."); return; }
    setErr(""); setLoadingUrl(true);
    var exportUrl = "https://docs.google.com/spreadsheets/d/" + id + "/export?format=xlsx";
    fetch(exportUrl)
      .then(function (r) {
        if (!r.ok) throw new Error("Fichier inaccessible. Verifiez que le partage est active (Toute personne disposant du lien).");
        return r.arrayBuffer();
      })
      .then(function (buf) {
        return readWorkbook(buf).then(function (wb) {
          parseWorkbook(wb);
          setLoadingUrl(false);
        });
      })
      .catch(function (ex) {
        setErr(ex.message || "Erreur de chargement");
        setLoadingUrl(false);
      });
  }

  function processData(sl?: SheetData[], as?: Record<number, string>) {
    sl = sl || sheets; as = as || assignments;
    var dosMap: Record<string, any> = {};
    var depList = [];
    var chList = [];
    var debug = [];

    // 1. Dossiers
    try { sl.forEach(function (s, idx) {
      if (as[idx] !== "dossiers") return;
      var h = s.headers;
      // Removed overly broad patterns: "type", "date", "numero", "tc", "reference"
      var iBl = findCol(h, ["numbl", "nbl", "bl", "connaissement", "booking", "numerodossier", "numdossier", "ndossier"]);
      var iCl = findCol(h, ["client", "destinat", "consign", "recepteur", "receiver", "societe", "entreprise"]);
      var iDa = findCol(h, ["datearrivee", "eta", "datearr", "dateeta", "arrivee", "arrival"]);
      var iCp = findCol(h, ["compagn", "company", "armateur", "carrier", "shipping", "maritime", "navire"]);
      var iGr = findCol(h, ["lettre", "garantie", "caution"]);
      var iCt = findCol(h, ["contact", "tel", "phone", "mobile", "portable"]);
      var iBad = findCol(h, ["bad"]);
      var iBae = findCol(h, ["bae"]);
      var iNd = findCol(h, ["declaration", "declarant", "declar", "transitaire"]);
      var iNb = findCol(h, ["nbreconteneur", "nbretc", "nbtc", "qtc", "quantite"]);
      var iTy = findCol(h, ["typetc", "typeconteneur", "taille"]);
      var iTc = findCol(h, ["numconteneur", "numconteneurs", "conteneur", "conteneurs", "container", "containers", "numtc"]);
      var iPo = findCol(h, ["poids", "weight", "kg", "tonnage"]);

      debug.push("DOSSIERS [" + s.name + "] colonnes: " + h.join(", "));
      debug.push("  BL=" + (iBl >= 0 ? h[iBl] : "?") + " Client=" + (iCl >= 0 ? h[iCl] : "?") + " DateArr=" + (iDa >= 0 ? h[iDa] : "?") + " Cie=" + (iCp >= 0 ? h[iCp] : "?") + " TC=" + (iTc >= 0 ? h[iTc] : "?"));

      s.rows.forEach(function (row) {
        var bl = iBl >= 0 ? normBL(row[iBl]) : "";
        if (!bl) return;
        if (dosMap[bl]) {
          if (iTc >= 0) {
            var tcNums = splitContainers(row[iTc]);
            tcNums.forEach(function (tcN) {
              dosMap[bl].tcs.push({ n: tcN, ty: iTy >= 0 ? normType(row[iTy]) : "20GP", po: iPo >= 0 ? String(parseNum(row[iPo]) || "") : "" });
            });
          }
          return;
        }
        var bad = iBad >= 0 ? String(row[iBad] != null ? row[iBad] : "").trim().toUpperCase() : "";
        var bae = iBae >= 0 ? String(row[iBae] != null ? row[iBae] : "").trim().toUpperCase() : "";
        var gr = iGr >= 0 ? String(row[iGr] != null ? row[iGr] : "").trim().toUpperCase() : "";
        var tcs = [];
        if (iTc >= 0) {
          var tcNums2 = splitContainers(row[iTc]);
          tcNums2.forEach(function (tcN2) {
            tcs.push({ n: tcN2, ty: iTy >= 0 ? normType(row[iTy]) : "20GP", po: iPo >= 0 ? String(parseNum(row[iPo]) || "") : "" });
          });
        }
        dosMap[bl] = {
          bl: bl,
          cl: iCl >= 0 ? String(row[iCl] != null ? row[iCl] : "").trim().toUpperCase() : "",
          cp: iCp >= 0 ? String(row[iCp] != null ? row[iCp] : "").trim().toUpperCase() : "",
          da: iDa >= 0 ? parseDate(row[iDa]) : "",
          ct: iCt >= 0 ? String(row[iCt] != null ? row[iCt] : "").trim() : "",
          gr: (gr === "PERMANENTE" || gr === "LOUEE" || gr === "VENDUE") ? gr : (gr ? "LOUEE" : "PERMANENTE"),
          bs: (bad === "OK" || bad === "OUI" || bad === "OBTENU") ? "OBTENU" : "NON_DEMANDE",
          bv: "", as2: (bae === "OK" || bae === "OUI" || bae === "OBTENU") ? "OBTENU" : "NON_DEMANDE",
          nd: iNd >= 0 ? String(row[iNd] != null ? row[iNd] : "").trim().toUpperCase() : "",
          pn: "", nbTc: iNb >= 0 ? (parseInt(row[iNb]) || 0) : 0,
          defType: iTy >= 0 ? normType(row[iTy]) : "20GP", tcs: tcs
        };
      });
    }); } catch (ex) { debug.push("CRASH section Dossiers ligne ~" + ex.message); }

    // 2. Conteneurs → join by BL
    try { sl.forEach(function (s, idx) {
      if (as[idx] !== "conteneurs") return;
      var h = s.headers;
      var iTc = findCol(h, ["numconteneur", "numconteneurs", "conteneur", "conteneurs", "container", "containers", "numtc"]);
      var iBl2 = findCol(h, ["bl", "connaissement", "numbl", "nbl", "dossier"]);
      var iTy2 = findCol(h, ["typetc", "typeconteneur", "taille"]);
      var iPo2 = findCol(h, ["poids", "weight", "kg", "tonnage"]);
      debug.push("CONTENEURS [" + s.name + "]: TC=" + (iTc >= 0 ? h[iTc] : "?") + " BL=" + (iBl2 >= 0 ? h[iBl2] : "?"));
      s.rows.forEach(function (row) {
        var bl = iBl2 >= 0 ? normBL(row[iBl2]) : "";
        if (!bl) return;
        var tcArr = iTc >= 0 ? splitContainers(row[iTc]) : [];
        if (tcArr.length === 0) {
          var tcRaw = iTc >= 0 ? String(row[iTc] != null ? row[iTc] : "").trim().toUpperCase() : "";
          if (tcRaw && tcRaw.length >= 4) tcArr = [tcRaw];
        }
        tcArr.forEach(function (tcN) {
          var obj = { n: tcN, ty: iTy2 >= 0 ? normType(row[iTy2]) : "20GP", po: iPo2 >= 0 ? String(parseNum(row[iPo2]) || "") : "" };
          if (dosMap[bl]) dosMap[bl].tcs.push(obj);
        });
      });
    }); } catch (ex) { debug.push("CRASH section Conteneurs: " + ex.message); }

    // 3. Factures
    try { sl.forEach(function (s, idx) {
      if (as[idx] !== "factures") return;
      var h = s.headers;
      var iBl3 = findCol(h, ["bl", "connaissement", "numbl", "nbl", "dossier"]);
      var iNf = findCol(h, ["numfact", "facture", "invoice", "nfacture"]);
      var iHt = findCol(h, ["montantht", "ht", "horstaxe"]);
      var iTtc = findCol(h, ["montantttc", "ttc", "montant", "total", "cout", "prix"]);
      var iSt3 = findCol(h, ["statut", "status", "paiement"]);
      var iDt3 = findCol(h, ["datepaiement", "datefacture"]);
      var iCom = findCol(h, ["commentaire", "comment", "description", "libelle", "designation", "objet", "nature", "intitule"]);
      debug.push("FACTURES [" + s.name + "] colonnes: " + h.join(", "));
      debug.push("  BL=" + (iBl3 >= 0 ? h[iBl3] : "?") + " Montant=" + (iTtc >= 0 ? h[iTtc] : (iHt >= 0 ? h[iHt] : "?")) + " Desc=" + (iCom >= 0 ? h[iCom] : "?"));
      s.rows.forEach(function (row) {
        var bl = iBl3 >= 0 ? normBL(row[iBl3]) : "";
        if (!bl) return;
        var ht = iHt >= 0 ? parseNum(row[iHt]) : 0;
        var ttc = iTtc >= 0 ? parseNum(row[iTtc]) : ht;
        if (!ht && !ttc) return;
        var st = iSt3 >= 0 ? String(row[iSt3] != null ? row[iSt3] : "").toLowerCase() : "";
        var com = iCom >= 0 ? String(row[iCom] != null ? row[iCom] : "").trim() : "";
        var comL = com.toLowerCase();
        var tp = "AUTRE";
        if (comL.indexOf("transport") >= 0 || comL.indexOf("fret") >= 0) tp = "TRANSPORT";
        else if (comL.indexOf("dpworld") >= 0 || comL.indexOf("dp world") >= 0 || comL.indexOf("terminal") >= 0) tp = "DPWORLD";
        else if (comL.indexOf("location") >= 0 || comL.indexOf("locat") >= 0) tp = "LOCATION_TC";
        else if (comL.indexOf("douane") >= 0 || comL.indexOf("dedouane") >= 0) tp = "DOUANE";
        else if (comL.indexOf("surestari") >= 0) tp = "SURESTARIES";
        else if (comL.indexOf("detention") >= 0) tp = "DETENTIONS";
        else if (comL.indexOf("pregate") >= 0 || comL.indexOf("orbus") >= 0) tp = "PREGATE";
        var isPaid = st.indexOf("paye") >= 0 || st.indexOf("paid") >= 0 || st.indexOf("regle") >= 0;
        depList.push({ bl: bl, nf: iNf >= 0 ? String(row[iNf] != null ? row[iNf] : "").trim() : "", tp: tp, ht: ht, mt: ttc || ht, s: isPaid ? "PAYE" : "ATT", dt: iDt3 >= 0 ? parseDate(row[iDt3]) : "", ds: com });
      });
    }); } catch (ex) { debug.push("CRASH section Factures: " + ex.message); }

    // 3b. Columnar expenses: sheets where each expense type is a separate column
    // e.g. West Africa "Depenses_Situation": BL | Location | Frais add | Surestaries | Pregate
    try { sl.forEach(function (s, idx) {
      if (as[idx] !== "factures") return;
      var h = s.headers;
      var iBl4 = findCol(h, ["bl", "connaissement", "numbl", "nbl", "dossier"]);
      if (iBl4 < 0) return;
      // Detect columnar format: multiple known expense-type columns
      var expCols = [];
      var COL_TYPES = [
        { patterns: ["location", "locat"], tp: "LOCATION_TC", label: "Location" },
        { patterns: ["fraisadd", "fraissup", "fraisaddit"], tp: "AUTRE", label: "Frais add" },
        { patterns: ["autresfrais", "autrefrais", "fraisdebarq"], tp: "AUTRE", label: "Autres frais" },
        { patterns: ["surestari"], tp: "SURESTARIES", label: "Surestaries" },
        { patterns: ["pregate", "orbus"], tp: "PREGATE", label: "Pregate" },
        { patterns: ["dpworld", "terminal"], tp: "DPWORLD", label: "DPWorld" },
        { patterns: ["transport", "fret"], tp: "TRANSPORT", label: "Transport" },
        { patterns: ["douane", "dedouane"], tp: "DOUANE", label: "Douane" },
        { patterns: ["detention"], tp: "DETENTIONS", label: "Detention" }
      ];
      var hl = h.map(function (x) { return String(x || "").toLowerCase().replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e").replace(/[îï]/g, "i").replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u").replace(/[^a-z0-9]/g, ""); });
      COL_TYPES.forEach(function (ct) {
        for (var ci = 0; ci < hl.length; ci++) {
          for (var pi = 0; pi < ct.patterns.length; pi++) {
            if (hl[ci].indexOf(ct.patterns[pi]) >= 0) {
              expCols.push({ col: ci, tp: ct.tp, label: ct.label });
              return;
            }
          }
        }
      });
      if (expCols.length < 2) return; // Need at least 2 expense columns to consider this columnar
      debug.push("DEPENSES COLONNES [" + s.name + "]: " + expCols.map(function (c) { return c.label + "=" + h[c.col]; }).join(", "));
      // Also detect BAD/BAE columns to enrich dossiers
      var iBad4 = findCol(h, ["bad"]);
      var iBae4 = findCol(h, ["bae"]);
      var iDa4 = findCol(h, ["datearrivee", "eta", "datearr", "arrivee"]);
      s.rows.forEach(function (row) {
        var bl = iBl4 >= 0 ? normBL(row[iBl4]) : "";
        if (!bl) return;
        // Enrich existing dossier with BAD/BAE if available
        if (dosMap[bl]) {
          if (iBad4 >= 0) {
            var bad4 = String(row[iBad4] != null ? row[iBad4] : "").trim().toUpperCase();
            if (bad4 === "OK" || bad4 === "OUI" || bad4 === "OBTENU") dosMap[bl].bs = "OBTENU";
          }
          if (iBae4 >= 0) {
            var bae4 = String(row[iBae4] != null ? row[iBae4] : "").trim().toUpperCase();
            if (bae4 === "OK" || bae4 === "OUI" || bae4 === "OBTENU") dosMap[bl].as2 = "OBTENU";
          }
        }
        // Create one expense per non-zero column
        expCols.forEach(function (ec) {
          var amt = parseNum(row[ec.col]);
          if (amt > 0) {
            depList.push({ bl: bl, nf: "", tp: ec.tp, ht: amt, mt: amt, s: "ATT", dt: iDa4 >= 0 ? parseDate(row[iDa4]) : "", ds: ec.label });
          }
        });
      });
    }); } catch (ex) { debug.push("CRASH section Depenses colonnes: " + ex.message); }

    // 4. Chauffeurs
    try { sl.forEach(function (s, idx) {
      if (as[idx] !== "chauffeurs") return;
      var h = s.headers;
      var iNm = findCol(h, ["nom", "chauffeur", "conducteur", "driver", "prenom"]);
      var iCm = findCol(h, ["numcamion", "camion", "plaque", "truck", "immatricul"]);
      var iTl = findCol(h, ["numtel", "tel", "phone", "mobile", "portable"]);
      var iPm = findCol(h, ["poidsmax", "charge", "ptac"]);
      var iGb = findCol(h, ["gabari", "gabar", "taille"]);
      s.rows.forEach(function (row) {
        var nm = iNm >= 0 ? String(row[iNm] != null ? row[iNm] : "").trim() : "";
        if (!nm) return;
        var gb = iGb >= 0 ? String(row[iGb] != null ? row[iGb] : "").toUpperCase() : "";
        var tty = [];
        if (gb.indexOf("40") >= 0 || gb.indexOf("45") >= 0) tty = ["20GP", "40GP", "40HC"];
        else if (gb.indexOf("20") >= 0) tty = ["20GP"];
        chList.push({ nm: nm, cm: iCm >= 0 ? String(row[iCm] != null ? row[iCm] : "").trim().toUpperCase() : "", tl: iTl >= 0 ? String(row[iTl] != null ? row[iTl] : "").trim() : "", pm: iPm >= 0 ? parseNum(row[iPm]) : 0, tty: tty });
      });
    }); } catch (ex) { debug.push("CRASH section Chauffeurs: " + ex.message); }

    // 5. Placeholder TCs for dossiers without TC data
    Object.keys(dosMap).forEach(function (bl) {
      var d = dosMap[bl];
      if (d.tcs.length === 0 && d.nbTc > 0) {
        for (var i = 0; i < d.nbTc; i++) d.tcs.push({ n: "", ty: d.defType, po: "" });
      }
    });

    var depsByBl: Record<string, number> = {};
    depList.forEach(function (f) { depsByBl[f.bl] = (depsByBl[f.bl] || 0) + 1; });

    var headerResult = { dossiers: Object.values(dosMap), deps: depList, chauffeurs: chList, depsByBl: depsByBl };

    // FALLBACK: if header-based parsing found 0 dossiers, try pattern scan
    if (headerResult.dossiers.length === 0) {
      debug.push("--- EN-TETES: 0 dossiers, activation du SCAN PAR PATTERN ---");
      try {
        var patternResult = patternScan(sl);
        if (patternResult.dossiers.length > 0) {
          debug.push("PATTERN SCAN: " + patternResult.dossiers.length + " dossiers, " +
            patternResult.dossiers.reduce(function (a, d) { return a + d.tcs.length; }, 0) + " TC, " +
            patternResult.deps.length + " depenses");
          setColDebug(debug);
          setExcluded(new Set());
          setResult(patternResult);
          setStep(3);
          return;
        }
        debug.push("PATTERN SCAN: 0 dossiers non plus");
      } catch (ex) { debug.push("CRASH pattern scan: " + ex.message); }
    }

    setColDebug(debug);
    // Pre-exclure les BL deja presents en base
    var dupeSet = new Set<string>();
    headerResult.dossiers.forEach(function (d) {
      if (d.bl && existingBls.has(d.bl.toUpperCase())) dupeSet.add(d.bl);
    });
    setExcluded(dupeSet);
    setResult(headerResult);
    setStep(3);
  }
  var [cmaCount, setCmaCount] = useState(0);
  function doImport() {
    if (!result || !result.dossiers.length) return;
    var toImport = result.dossiers.filter(function (d) { return !excluded.has(d.bl); });
    if (!toImport.length) return;
    var importedBls = new Set(toImport.map(function (d) { return d.bl; }));
    var filteredDeps = result.deps.filter(function (f) { return importedBls.has(f.bl); });
    p.bulkImport(toImport, filteredDeps, result.chauffeurs);
    // Sprint 25 #5 : compter les BL CMA pour informer du sync auto background
    var cmaBls = toImport.filter(function (d) {
      var cp = String(d.cp || '').toUpperCase();
      var bl = String(d.bl || '').toUpperCase();
      return cp.indexOf('CMA') >= 0 || /^(CMA|CHN|CAN|GGZ|NGP)/.test(bl);
    });
    setCmaCount(cmaBls.length);
    setImported(toImport.length);
    setStep(4);
  }

  return (
    <div>
      {/* Stepper visuel handoff (Sprint F.2) — 4 etapes : Choix / Apercu / Resultat / Termine */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 18, padding: "0 4px" }}>
        {[
          { lbl: "Choix" },
          { lbl: "Aperçu" },
          { lbl: "Import" },
          { lbl: "Terminé" },
        ].map(function (s, i) {
          var n = i + 1;
          var done = n < step;
          var current = n === step;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                background: done || current ? "var(--btn-primary-bg)" : "var(--bg-secondary)",
                border: done || current ? "none" : "1px solid var(--border)",
                color: done || current ? "var(--btn-primary-text)" : "var(--text-muted)",
                display: "grid", placeItems: "center" as const,
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                fontFamily: "var(--font-mono)",
              }}>{done ? "✓" : String(n)}</div>
              <span style={{ fontSize: 12, fontWeight: current ? 700 : 500, color: done || current ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap" as const }}>{s.lbl}</span>
              {i < 3 ? <div style={{ flex: 1, height: 2, background: n < step ? "var(--btn-primary-bg)" : "var(--border)", borderRadius: 6 }} /> : null}
            </div>
          );
        })}
      </div>

      {err ? <div style={{ background: "var(--danger-light)", color: "var(--danger-text)", padding: "12px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}>{err}</div> : null}

      {step === 1 ? (
        <div style={{ padding: "20px 16px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{"\uD83D\uDCC1"}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{"Importez vos donnees"}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
              {"Formats : .xlsx, .xls, .csv ou lien Google Sheets"}<br />
              {"Multi-feuilles : Connaissements, Conteneurs, Factures, Chauffeurs"}<br />
              {"Jointure automatique par numero BL"}
            </div>
          </div>

          {/* File upload */}
          <label style={{ display: "block", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", padding: "14px 0", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", minHeight: 48, textAlign: "center", marginBottom: 16 }}>
            {"Choisir un fichier Excel/CSV"}
            <input type="file" accept=".xlsx,.xls,.csv,.tsv" onChange={handleFile} style={{ display: "none" }} />
          </label>

          {/* Google Sheets URL */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 6 }}>{"Ou collez un lien Google Sheets :"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input 
                value={gUrl} 
                onChange={function (e) { setGUrl(e.target.value); }} 
                placeholder="https://docs.google.com/spreadsheets/d/..." 
                style={Object.assign({}, IS2, { flex: 1, fontSize: 13 })} 
              />
              <button 
                onClick={handleGSheet} 
                disabled={!gUrl || loadingUrl}
                style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", minHeight: 44, opacity: (!gUrl || loadingUrl) ? 0.5 : 1, whiteSpace: "nowrap" }}
              >
                {loadingUrl ? "..." : "Charger"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{"Le fichier doit etre partage en lecture (Toute personne disposant du lien)"}</div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{String(sheets.length) + " feuilles detectees — associez chaque feuille :"}</div>
          {sheets.map(function (s, idx) {
            return <div key={idx} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 14, marginBottom: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{String(s.rowCount) + " lignes | " + s.headers.slice(0, 5).join(", ") + (s.headers.length > 5 ? "..." : "")}</div>
                </div>
                <select value={assignments[idx] || "skip"} onChange={function (e) { var a = Object.assign({}, assignments); a[idx] = e.target.value; setAssignments(a); }} style={Object.assign({}, IS2, { width: "auto", minWidth: 200 })}>
                  <option value="skip">{"-- Ignorer --"}</option>
                  <option value="dossiers">{"Connaissements / Dossiers"}</option>
                  <option value="conteneurs">{"Conteneurs"}</option>
                  <option value="factures">{"Factures / Depenses"}</option>
                  <option value="chauffeurs">{"Chauffeurs / Camions"}</option>
                  <option value="detention">{"Detention / Cautions"}</option>
                </select>
              </div>
            </div>;
          })}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={function () { setStep(1); setSheets([]); }} style={{ background: "transparent", border: "2px solid var(--border)", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Retour"}</button>
            <button onClick={function () { try { processData(); } catch(ex) { setErr("Erreur analyse: " + ex.message); } }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Analyser"}</button>
          </div>
        </div>
      ) : null}

      {step === 3 && result ? (
        <div>
          {/* Debug: column mapping */}
          {colDebug && colDebug.length > 0 ? (
            <div style={{ background: colDebug.some(function(d) { return d.indexOf("PATTERN SCAN") >= 0; }) ? "var(--success-bg)" : "var(--warning-bg)", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: colDebug.some(function(d) { return d.indexOf("PATTERN SCAN") >= 0; }) ? "var(--success-text)" : "var(--warning-text)", marginBottom: 4 }}>
                {colDebug.some(function(d) { return d.indexOf("PATTERN SCAN") >= 0 && d.indexOf("0 dossiers non plus") < 0; }) ? "Mode intelligent : detection par pattern (sans en-tetes)" : "Colonnes detectees :"}
              </div>
              {colDebug.map(function (d, i) { return <div key={i} style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{d}</div>; })}
              {result.dossiers.length === 0 ? <div style={{ color: "var(--warning-text)", marginTop: 6 }}>{"Aucun BL ou conteneur reconnu. Verifiez le format de votre fichier."}</div> : null}
            </div>
          ) : null}

          {/* Interactive Power BI-style table */}
          <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10 }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
                  <th style={{ width: 36, padding: "10px 8px", textAlign: "center", position: "sticky", top: 0, background: "var(--btn-primary-bg)", zIndex: 2 }}>
                    <input
                      type="checkbox"
                      checked={excluded.size === 0 && result.dossiers.length > 0}
                      onChange={function (e) {
                        if (e.target.checked) setExcluded(new Set());
                        else setExcluded(new Set(result.dossiers.map(function (d) { return d.bl; })));
                      }}
                    />
                  </th>
                  <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", position: "sticky", top: 0, background: "var(--btn-primary-bg)", zIndex: 2 }}>{"N\u00b0 BL"}</th>
                  <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, position: "sticky", top: 0, background: "var(--btn-primary-bg)", zIndex: 2 }}>{"Client"}</th>
                  <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, position: "sticky", top: 0, background: "var(--btn-primary-bg)", zIndex: 2 }}>{"Compagnie"}</th>
                  <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", position: "sticky", top: 0, background: "var(--btn-primary-bg)", zIndex: 2 }}>{"Date arr."}</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, position: "sticky", top: 0, background: "var(--btn-primary-bg)", zIndex: 2 }}>{"TCs"}</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, position: "sticky", top: 0, background: "var(--btn-primary-bg)", zIndex: 2 }}>{"D\u00e9p."}</th>
                </tr>
              </thead>
              <tbody>
                {result.dossiers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 14 }}>{"Aucun dossier detecte. Verifiez que la feuille contient une colonne BL."}</td></tr>
                ) : null}
                {result.dossiers.map(function (d, idx) {
                  var isExcluded = excluded.has(d.bl);
                  var nd = result.depsByBl[d.bl] || 0;
                  return (
                    <tr
                      key={idx}
                      style={{ background: idx % 2 === 0 ? "var(--bg-primary)" : "var(--bg-tertiary)", opacity: isExcluded ? 0.38 : 1, cursor: "pointer" }}
                      onClick={function () {
                        setExcluded(function (prev) {
                          var next = new Set(prev);
                          if (next.has(d.bl)) next.delete(d.bl); else next.add(d.bl);
                          return next;
                        });
                      }}
                    >
                      <td style={{ padding: "8px", textAlign: "center" }} onClick={function (e) { e.stopPropagation(); }}>
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={function () {
                            setExcluded(function (prev) {
                              var next = new Set(prev);
                              if (next.has(d.bl)) next.delete(d.bl); else next.add(d.bl);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {d.bl}
                        {existingBls.has((d.bl || "").toUpperCase()) ? <span style={{ marginLeft: 6, background: "var(--danger-light)", color: "var(--danger)", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6 }}>{"Existe d\u00e9j\u00e0"}</span> : null}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--text-tertiary)" }}>{d.cl || "\u2014"}</td>
                      <td style={{ padding: "8px 10px", color: "var(--text-secondary)", fontSize: 12 }}>{d.cp || "\u2014"}</td>
                      <td style={{ padding: "8px 10px", color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>{d.da || "\u2014"}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        {d.tcs.length > 0
                          ? <span style={{ background: "var(--success-light)", color: "var(--success)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>{String(d.tcs.length)}</span>
                          : <span style={{ color: "var(--text-muted)" }}>{"0"}</span>}
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        {nd > 0
                          ? <span style={{ background: "var(--warning-bg)", color: "var(--warning-text)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>{String(nd)}</span>
                          : <span style={{ color: "var(--text-muted)" }}>{"0"}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stats bar */}
          {(function () {
            var selDos = result.dossiers.filter(function (d) { return !excluded.has(d.bl); });
            var totalTcs = selDos.reduce(function (a, d) { return a + d.tcs.length; }, 0);
            var zeroW = selDos.reduce(function (a, d) { return a + d.tcs.filter(function (t) { return !t.po || t.po === "0"; }).length; }, 0);
            var nDoublons = result.dossiers.filter(function (d) { return existingBls.has((d.bl || "").toUpperCase()); }).length;
            return <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14, display: "flex", gap: 16, flexWrap: "wrap", padding: "2px 2px" }}>
              <span><strong>{result.dossiers.length}</strong>{" dossiers"}</span>
              {nDoublons > 0 ? <span style={{ color: "var(--danger)" }}><strong>{nDoublons}</strong>{" doublon(s)"}</span> : null}
              <span style={{ color: "var(--success)" }}><strong>{selDos.length}</strong>{" s\u00e9lectionn\u00e9s"}</span>
              <span><strong>{totalTcs}</strong>{" conteneurs"}</span>
              {zeroW > 0 ? <span style={{ color: "var(--danger)" }}><strong>{zeroW}</strong>{" sans poids"}</span> : null}
              <span style={{ color: "var(--warning)" }}><strong>{result.deps.filter(function (f) { return !excluded.has(f.bl); }).length}</strong>{" d\u00e9penses"}</span>
              {result.chauffeurs.length > 0 ? <span><strong>{result.chauffeurs.length}</strong>{" chauffeurs"}</span> : null}
            </div>;
          })()}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={function () { setStep(sheets.length > 1 ? 2 : 1); setResult(null); setColDebug(null); setExcluded(new Set()); }} style={{ background: "transparent", border: "2px solid var(--border)", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"← Corriger"}</button>
            <button onClick={doImport} disabled={excluded.size >= result.dossiers.length || result.dossiers.length === 0} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", minHeight: 48, fontSize: 15, opacity: (excluded.size >= result.dossiers.length || result.dossiers.length === 0) ? 0.5 : 1 }}>{"Importer " + String(result.dossiers.length - excluded.size) + " dossiers \u2192"}</button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"\u2705"}</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{String(imported) + " dossiers importes !"}</div>
          {result && result.deps.length > 0 ? <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>{String(result.deps.length) + " depenses"}</div> : null}
          {result && result.chauffeurs.length > 0 ? <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>{String(result.chauffeurs.length) + " chauffeurs"}</div> : null}
          {cmaCount > 0 ? <div style={{ fontSize: 13, color: "var(--info)", background: "var(--info-bg)", borderRadius: 8, padding: "10px 14px", marginTop: 12, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 8 }}><span>{"📡"}</span><span>{String(cmaCount) + " BL CMA detectes — sync auto en arriere-plan (espacement 5s, quota CMA respecte)"}</span></div> : null}
          <button onClick={p.onClose} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", minHeight: 48, marginTop: 16 }}>{"Fermer"}</button>
        </div>
      ) : null}
    </div>
  );
}


