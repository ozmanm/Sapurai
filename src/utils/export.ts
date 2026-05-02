// src/utils/export.ts
// Export des données vers Excel (.xlsx) — utilise la lib xlsx déjà installée

import * as XLSX from 'xlsx';

var DL_FR: Record<string, string> = { INITIALISE: "Initialise", SECURISE: "Securise", EN_TRANSIT: "En Transit", CLOTURE: "Cloture", ARCHIVE: "Archive" };
var SL_FR: Record<string, string> = { PORT: "Au Port", DISPATCHE: "Dispatche", TRANSIT: "En Transit", KATI: "Kati", BAMAKO: "Bamako", RETURNED: "Retourne" };
var DTL_FR: Record<string, string> = { TRANSPORT: "Transport", LOCATION_TC: "Location TC", DPWORLD: "DP World", DOUANE: "Douane", SURESTARIES: "Surestaries", DETENTIONS: "Detentions", Orbus: "Orbus", AUTRE: "Autre" };

function fd(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function exportDossiers(dos: any[], tcs: any[], dep: any[], companyName?: string): void {
  var wb = XLSX.utils.book_new();

  // --- Feuille 1 : Dossiers ---
  var dosRows = [["Client", "N° BL", "Compagnie", "Destination", "Date decharg.", "Statut", "Nb TC", "Total depenses", "Paye", "Impaye", "% Paye", "Recette", "Marge", "Tel client"]];
  (dos || []).forEach(function (d) {
    var ddep = (dep || []).filter(function (f) { return f.did === d.id; });
    var dtcs = (tcs || []).filter(function (t) { return t.did === d.id; });
    var tot = ddep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    var pay = ddep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    var imp = tot - pay;
    var pct = tot > 0 ? Math.round(pay / tot * 100) : 0;
    var rv = d.rv || 0;
    dosRows.push([
      d.cl || "", d.bl || "", d.cp || "", d.cr || "",
      fd(d.da), DL_FR[d.st] || d.st || "",
      dtcs.length, tot, pay, imp,
      pct + "%", rv || "", rv > 0 ? rv - tot : "", d.ct || ""
    ]);
  });
  var wsD = XLSX.utils.aoa_to_sheet(dosRows);
  wsD['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 7 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsD, "Dossiers");

  // --- Feuille 2 : Conteneurs ---
  var tcsRows = [["N° TC", "Type", "Dossier (BL)", "Client", "Statut", "Chauffeur", "Camion", "Date dispatch", "Date retour"]];
  (tcs || []).forEach(function (tc) {
    var d = (dos || []).find(function (x) { return x.id === tc.did; });
    tcsRows.push([
      tc.n || "", tc.ty || "",
      d ? (d.bl || "") : "", d ? (d.cl || "") : "",
      SL_FR[tc.st] || tc.st || "",
      tc.ch || "", tc.cm || "",
      fd(tc.dsp), fd(tc.dr)
    ]);
  });
  var wsT = XLSX.utils.aoa_to_sheet(tcsRows);
  wsT['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsT, "Conteneurs");

  // --- Feuille 3 : Depenses ---
  var depRows = [["Type", "Description", "N° Facture", "Client", "BL", "Montant HT", "Montant TTC", "Statut", "Date"]];
  (dep || []).forEach(function (f) {
    var d = (dos || []).find(function (x) { return x.id === f.did; });
    depRows.push([
      DTL_FR[f.tp] || f.tp || "", f.ds || "", f.nf || "",
      d ? (d.cl || "") : "", d ? (d.bl || "") : "",
      f.ht || f.mt || 0, f.mt || 0,
      f.s === "PAYE" ? "Paye" : "Impaye",
      fd(f.dt)
    ]);
  });
  var wsF = XLSX.utils.aoa_to_sheet(depRows);
  wsF['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsF, "Depenses");

  var date = new Date().toISOString().slice(0, 10);
  var name = (companyName || "sapurai").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, name + "_export_" + date + ".xlsx");
}

export function exportDepenses(dep: any[], dos: any[], companyName?: string): void {
  var wb = XLSX.utils.book_new();

  var rows = [["Type", "Description", "N° Facture", "Client", "BL", "Montant HT", "Montant TTC", "Statut", "Date"]];
  (dep || []).forEach(function (f) {
    var d = (dos || []).find(function (x) { return x.id === f.did; });
    rows.push([
      DTL_FR[f.tp] || f.tp || "", f.ds || "", f.nf || "",
      d ? (d.cl || "") : "", d ? (d.bl || "") : "",
      f.ht || f.mt || 0, f.mt || 0,
      f.s === "PAYE" ? "Paye" : "Impaye",
      fd(f.dt)
    ]);
  });

  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "Depenses");

  var date = new Date().toISOString().slice(0, 10);
  var name = (companyName || "sapurai").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, name + "_depenses_" + date + ".xlsx");
}

export function exportFinancierClient(dos: any[], dep: any[], companyName?: string): void {
  var wb = XLSX.utils.book_new();

  // Build per-client aggregation (same logic as Dash.jsx)
  var byClient = {};
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
    if (f.s === "PAYE") byClient[cl].pay += (f.mt || 0);
  });
  var rows = Object.keys(byClient).map(function (k) { return byClient[k]; });
  rows.sort(function (a, b) { return (b.tot - b.pay) - (a.tot - a.pay); });

  // --- Feuille 1 : Resume par client ---
  var sumRows = [["Client", "Nb Dossiers", "Total (FCFA)", "Paye (FCFA)", "Impaye (FCFA)", "% Paye", "Recette (FCFA)", "Marge (FCFA)"]];
  var gTot = 0, gPay = 0, gRv = 0;
  rows.forEach(function (r) {
    var imp = r.tot - r.pay;
    var pct = r.tot > 0 ? Math.round(r.pay / r.tot * 100) : 0;
    sumRows.push([r.cl, r.nDos, r.tot, r.pay, imp, pct + "%", r.rv || "", r.rv > 0 ? r.rv - r.tot : ""]);
    gTot += r.tot; gPay += r.pay; gRv += (r.rv || 0);
  });
  sumRows.push(["TOTAL", rows.reduce(function (a, r) { return a + r.nDos; }, 0), gTot, gPay, gTot - gPay, gTot > 0 ? Math.round(gPay / gTot * 100) + "%" : "0%", gRv || "", gRv > 0 ? gRv - gTot : ""]);
  var ws1 = XLSX.utils.aoa_to_sheet(sumRows);
  ws1['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resume par client");

  // --- Feuille 2 : Detail factures ---
  var detRows = [["Client", "N° BL", "Type", "Description", "N° Facture", "Montant (FCFA)", "Statut", "Date"]];
  rows.forEach(function (r) {
    var clientDos = (dos || []).filter(function (d) { return (d.cl || "Sans client") === r.cl && d.st !== "ARCHIVE"; });
    clientDos.forEach(function (d) {
      var ddep = (dep || []).filter(function (f) { return f.did === d.id; });
      ddep.forEach(function (f) {
        detRows.push([
          r.cl, d.bl || "", DTL_FR[f.tp] || f.tp || "", f.ds || "", f.nf || "",
          f.mt || 0, f.s === "PAYE" ? "Paye" : "Impaye", fd(f.dt)
        ]);
      });
    });
  });
  var ws2 = XLSX.utils.aoa_to_sheet(detRows);
  ws2['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Detail factures");

  var date = new Date().toISOString().slice(0, 10);
  var name = (companyName || "sapurai").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, name + "_financier_client_" + date + ".xlsx");
}
