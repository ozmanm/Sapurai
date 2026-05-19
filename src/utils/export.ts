// src/utils/export.ts
// Sprint 42 F42.5 - Export Excel via exceljs (xlsx etait vulnerable).
// exceljs est plus moderne, sans prototype pollution ni ReDoS connus.
// Lazy-load pour ne pas gonfler le main bundle.

import type { Workbook, Worksheet } from 'exceljs';
import type { Dossier, Conteneur, Depense } from '../types.js';
import { isDepensePayee } from './depenseStatus';

// Cellule d'export : valeurs primitives Excel acceptees par addRows()
type ExcelCell = string | number | boolean | Date | null | undefined;
type ExcelRow = ExcelCell[];

// Module exceljs (lazy-loaded). On garde le type 'unknown' au niveau du module
// car le default-export bundling differe selon le build (CJS/ESM).
type ExcelJSModule = { default?: { Workbook: new () => Workbook }; Workbook?: new () => Workbook };

var DL_FR: Record<string, string> = { INITIALISE: "Initialise", SECURISE: "Securise", EN_TRANSIT: "En Transit", CLOTURE: "Cloture", ARCHIVE: "Archive" };
var SL_FR: Record<string, string> = { PORT: "Au Port", DISPATCHE: "Dispatche", TRANSIT: "En Transit", KATI: "Kati", BAMAKO: "Bamako", RETURNED: "Retourne" };
var DTL_FR: Record<string, string> = { TRANSPORT: "Transport", LOCATION_TC: "Location TC", DPWORLD: "DP World", DOUANE: "Douane", SURESTARIES: "Surestaries", DETENTIONS: "Detentions", Orbus: "Orbus", AUTRE: "Autre" };

function fd(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Lazy-load exceljs
var exceljsCache: Promise<ExcelJSModule> | null = null;
function getExcelJS(): Promise<ExcelJSModule> {
  if (!exceljsCache) exceljsCache = import('exceljs') as Promise<ExcelJSModule>;
  return exceljsCache;
}

function getWorkbookCtor(mod: ExcelJSModule): new () => Workbook {
  // ESM/CJS interop : selon le bundler, ExcelJS est en `mod.default.Workbook` ou `mod.Workbook`
  var Ctor = (mod.default && mod.default.Workbook) || mod.Workbook;
  if (!Ctor) throw new Error('[export] ExcelJS Workbook ctor introuvable');
  return Ctor;
}

/**
 * Helper : ajoute des rows + applique les largeurs de colonnes.
 * `widths` est dans la meme unite que les `wch` xlsx (~caracteres).
 */
function setupSheet(ws: Worksheet, rows: ExcelRow[], widths?: number[]): void {
  ws.addRows(rows);
  if (widths) {
    ws.columns = widths.map(function (w) { return { width: w }; });
  }
}

/**
 * Telecharge un workbook exceljs cote navigateur.
 */
async function downloadWorkbook(wb: Workbook, filename: string): Promise<void> {
  var buffer = await wb.xlsx.writeBuffer();
  var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

export async function exportDossiers(dos: Dossier[], tcs: Conteneur[], dep: Depense[], companyName?: string): Promise<void> {
  var mod = await getExcelJS();
  var WorkbookCtor = getWorkbookCtor(mod);
  var wb = new WorkbookCtor();

  // --- Feuille 1 : Dossiers ---
  var dosRows: ExcelRow[] = [["Client", "N° BL", "Compagnie", "Destination", "Date decharg.", "Statut", "Nb TC", "Total depenses", "Paye", "Impaye", "% Paye", "Recette", "Marge", "Tel client"]];
  (dos || []).forEach(function (d) {
    var ddep = (dep || []).filter(function (f) { return f.did === d.id; });
    var dtcs = (tcs || []).filter(function (t) { return t.did === d.id; });
    var tot = ddep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    var pay = ddep.filter(function (f) { return isDepensePayee(f); }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    var imp = tot - pay;
    var pct = tot > 0 ? Math.round(pay / tot * 100) : 0;
    var rv = d.rv || 0;
    dosRows.push([
      d.cl || "", d.bl || "", d.cp || "", d.cr || "",
      fd(d.da), DL_FR[d.st] || d.st || "",
      dtcs.length, tot, pay, imp,
      pct + "%", rv || "", rv > 0 ? rv - tot : "", d.ct || "",
    ]);
  });
  var wsD = wb.addWorksheet('Dossiers');
  setupSheet(wsD, dosRows, [22, 16, 14, 12, 14, 12, 7, 16, 14, 14, 8, 14, 14, 14]);

  // --- Feuille 2 : Conteneurs ---
  var tcsRows: ExcelRow[] = [["N° TC", "Type", "Dossier (BL)", "Client", "Statut", "Chauffeur", "Camion", "Date dispatch", "Date retour"]];
  (tcs || []).forEach(function (tc) {
    var d = (dos || []).find(function (x) { return x.id === tc.did; });
    tcsRows.push([
      tc.n || "", tc.ty || "",
      d ? (d.bl || "") : "", d ? (d.cl || "") : "",
      SL_FR[tc.st] || tc.st || "",
      tc.ch || "", tc.cm || "",
      fd(tc.dsp), fd(tc.dr),
    ]);
  });
  var wsT = wb.addWorksheet('Conteneurs');
  setupSheet(wsT, tcsRows, [18, 8, 16, 20, 12, 20, 14, 14, 12]);

  // --- Feuille 3 : Depenses ---
  var depRows: ExcelRow[] = [["Type", "Description", "N° Facture", "Client", "BL", "Montant HT", "Montant TTC", "Statut", "Date"]];
  (dep || []).forEach(function (f) {
    var d = (dos || []).find(function (x) { return x.id === f.did; });
    depRows.push([
      DTL_FR[f.tp] || f.tp || "", f.ds || "", f.nf || "",
      d ? (d.cl || "") : "", d ? (d.bl || "") : "",
      f.ht || f.mt || 0, f.mt || 0,
      isDepensePayee(f) ? "Paye" : "Impaye",
      fd(f.dt),
    ]);
  });
  var wsF = wb.addWorksheet('Depenses');
  setupSheet(wsF, depRows, [14, 24, 12, 20, 14, 14, 14, 10, 12]);

  var date = new Date().toISOString().slice(0, 10);
  var name = (companyName || "sapurai").replace(/[^a-zA-Z0-9]/g, "_");
  await downloadWorkbook(wb, name + "_export_" + date + ".xlsx");
}

export async function exportDepenses(dep: Depense[], dos: Dossier[], companyName?: string): Promise<void> {
  var mod = await getExcelJS();
  var WorkbookCtor = getWorkbookCtor(mod);
  var wb = new WorkbookCtor();

  var rows: ExcelRow[] = [["Type", "Description", "N° Facture", "Client", "BL", "Montant HT", "Montant TTC", "Statut", "Date"]];
  (dep || []).forEach(function (f) {
    var d = (dos || []).find(function (x) { return x.id === f.did; });
    rows.push([
      DTL_FR[f.tp] || f.tp || "", f.ds || "", f.nf || "",
      d ? (d.cl || "") : "", d ? (d.bl || "") : "",
      f.ht || f.mt || 0, f.mt || 0,
      isDepensePayee(f) ? "Paye" : "Impaye",
      fd(f.dt),
    ]);
  });

  var ws = wb.addWorksheet('Depenses');
  setupSheet(ws, rows, [14, 24, 12, 20, 14, 14, 14, 10, 12]);

  var date = new Date().toISOString().slice(0, 10);
  var name = (companyName || "sapurai").replace(/[^a-zA-Z0-9]/g, "_");
  await downloadWorkbook(wb, name + "_depenses_" + date + ".xlsx");
}

interface ClientAggregate {
  cl: string;
  nDos: number;
  tot: number;
  pay: number;
  rv: number;
  bls: string[];
}

export async function exportFinancierClient(dos: Dossier[], dep: Depense[], companyName?: string): Promise<void> {
  var mod = await getExcelJS();
  var WorkbookCtor = getWorkbookCtor(mod);
  var wb = new WorkbookCtor();

  // Build per-client aggregation (same logic as Dash.jsx)
  var byClient: Record<string, ClientAggregate> = {};
  (dos || []).forEach(function (d) {
    if (d.st === "ARCHIVE") return;
    var cl = d.cl || "Sans client";
    if (!byClient[cl]) byClient[cl] = { cl: cl, nDos: 0, tot: 0, pay: 0, rv: 0, bls: [] };
    byClient[cl].nDos++;
    byClient[cl].rv += (d.rv || 0);
    byClient[cl].bls.push(d.bl || "");
  });
  (dep || []).forEach(function (f) {
    var d = (dos || []).find(function (x) { return x.id === f.did; });
    if (!d || d.st === "ARCHIVE") return;
    var cl = d.cl || "Sans client";
    if (!byClient[cl]) return;
    byClient[cl].tot += (f.mt || 0);
    if (isDepensePayee(f)) byClient[cl].pay += (f.mt || 0);
  });
  var rows = Object.keys(byClient).map(function (k) { return byClient[k]; });
  rows.sort(function (a, b) { return (b.tot - b.pay) - (a.tot - a.pay); });

  // --- Feuille 1 : Resume par client ---
  var sumRows: ExcelRow[] = [["Client", "Nb Dossiers", "Total (FCFA)", "Paye (FCFA)", "Impaye (FCFA)", "% Paye", "Recette (FCFA)", "Marge (FCFA)"]];
  var gTot = 0, gPay = 0, gRv = 0;
  rows.forEach(function (r) {
    var imp = r.tot - r.pay;
    var pct = r.tot > 0 ? Math.round(r.pay / r.tot * 100) : 0;
    sumRows.push([r.cl, r.nDos, r.tot, r.pay, imp, pct + "%", r.rv || "", r.rv > 0 ? r.rv - r.tot : ""]);
    gTot += r.tot; gPay += r.pay; gRv += (r.rv || 0);
  });
  sumRows.push(["TOTAL", rows.reduce(function (a, r) { return a + r.nDos; }, 0), gTot, gPay, gTot - gPay, gTot > 0 ? Math.round(gPay / gTot * 100) + "%" : "0%", gRv || "", gRv > 0 ? gRv - gTot : ""]);
  var ws1 = wb.addWorksheet('Resume par client');
  setupSheet(ws1, sumRows, [24, 12, 16, 16, 16, 10, 16, 16]);

  // --- Feuille 2 : Detail factures ---
  var detRows: ExcelRow[] = [["Client", "N° BL", "Type", "Description", "N° Facture", "Montant (FCFA)", "Statut", "Date"]];
  rows.forEach(function (r) {
    var clientDos = (dos || []).filter(function (d) { return (d.cl || "Sans client") === r.cl && d.st !== "ARCHIVE"; });
    clientDos.forEach(function (d) {
      var ddep = (dep || []).filter(function (f) { return f.did === d.id; });
      ddep.forEach(function (f) {
        detRows.push([
          r.cl, d.bl || "", DTL_FR[f.tp] || f.tp || "", f.ds || "", f.nf || "",
          f.mt || 0, isDepensePayee(f) ? "Paye" : "Impaye", fd(f.dt),
        ]);
      });
    });
  });
  var ws2 = wb.addWorksheet('Detail factures');
  setupSheet(ws2, detRows, [24, 16, 14, 24, 12, 16, 10, 12]);

  var date = new Date().toISOString().slice(0, 10);
  var name = (companyName || "sapurai").replace(/[^a-zA-Z0-9]/g, "_");
  await downloadWorkbook(wb, name + "_financier_client_" + date + ".xlsx");
}
