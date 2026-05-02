// src/utils/print.ts
// Generates a printable HTML page for a dossier — opened in a new tab
// User can Ctrl+P / Share > Print / Save as PDF from the browser

var SL_FR: Record<string, string> = { PORT: "Au Port", DISPATCHE: "Dispatche", TRANSIT: "En Transit", KATI: "Kati", BAMAKO: "Bamako", RETURNED: "Retourne" };
var DL_FR: Record<string, string> = { INITIALISE: "Initialise", SECURISE: "Securise", EN_TRANSIT: "En Transit", CLOTURE: "Cloture", ARCHIVE: "Archive" };
var DTL_FR: Record<string, string> = { TRANSPORT: "Transport", LOCATION_TC: "Location TC", DPWORLD: "DP World", DOUANE: "Douane", SURESTARIES: "Surestaries", DETENTIONS: "Detentions", Orbus: "Orbus", AUTRE: "Autre" };

function fdPrint(iso: string | null): string {
  if (!iso) return "---";
  var d = new Date(iso);
  return d.toLocaleDateString("fr-FR");
}

function fmPrint(n: number | null): string {
  if (!n && n !== 0) return "---";
  return Number(n).toLocaleString("fr-FR") + " FCFA";
}

export function printDossier(d: any, tcs: any[], dep: any[], companyName?: string): void {
  var dosTcs = (tcs || []).filter(function (t) { return t.did === d.id; });
  var dosDep = (dep || []).filter(function (f) { return f.did === d.id; });
  var tot = dosDep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var paye = dosDep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var impaye = tot - paye;

  var tcsRows = dosTcs.map(function (tc) {
    return "<tr><td>" + (tc.n || "?") + "</td><td>" + (tc.ty || "") + "</td><td>" + (SL_FR[tc.st] || tc.st || "") + "</td><td>" + (tc.ch || "---") + "</td><td>" + (tc.cm || "---") + "</td><td>" + fdPrint(tc.dsp) + "</td></tr>";
  }).join("");

  var depRows = dosDep.map(function (f) {
    return "<tr><td>" + (DTL_FR[f.tp] || f.tp || "") + "</td><td>" + (f.ds || "") + "</td><td style='text-align:right'>" + fmPrint(f.ht || f.mt) + "</td><td style='text-align:right'>" + fmPrint(f.mt) + "</td><td style='text-align:center'><span style='background:" + (f.s === "PAYE" ? "#dcfce7;color:#166534" : "#fee2e2;color:#991b1b") + ";padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700'>" + (f.s === "PAYE" ? "Paye" : "Impaye") + "</span></td></tr>";
  }).join("");

  var html = "<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'><title>Dossier " + (d.bl || d.cl || "") + "</title>" +
    "<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;font-size:13px;color:#1c1917;padding:24px}" +
    "h1{font-size:20px;font-weight:900;letter-spacing:1px}h2{font-size:14px;font-weight:700;margin:18px 0 8px;border-bottom:2px solid #1c1917;padding-bottom:4px}" +
    ".header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1c1917}" +
    ".info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:4px}" +
    ".info-item{display:flex;gap:6px}.info-label{font-weight:600;color:#78716c;min-width:100px;font-size:12px}.info-val{font-size:12px}" +
    "table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1c1917;color:white;padding:7px 10px;text-align:left;font-size:11px;font-weight:700}" +
    "td{padding:7px 10px;border-bottom:1px solid #e7e5e4}tr:nth-child(even)td{background:#fafaf9}" +
    ".totals{display:flex;gap:20px;margin-top:14px;justify-content:flex-end}" +
    ".total-box{text-align:right}.total-label{font-size:11px;color:#78716c;font-weight:600}.total-val{font-size:16px;font-weight:800}" +
    ".footer{margin-top:28px;padding-top:12px;border-top:1px solid #e7e5e4;display:flex;justify-content:space-between;font-size:11px;color:#a8a29e}" +
    ".badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#f5f5f4}" +
    "@media print{body{padding:12px}}</style>" +
    "</head><body>" +
    "<div class='header'><div><h1>" + (companyName || "SAPURAI") + "</h1><div style='font-size:12px;color:#78716c;margin-top:2px'>Gestion Transit &amp; Logistique</div></div>" +
    "<div style='text-align:right'><div style='font-size:12px;font-weight:600'>FICHE DOSSIER</div><div style='font-size:11px;color:#78716c'>Imprime le " + fdPrint(new Date().toISOString()) + "</div><span class='badge'>" + (DL_FR[d.st] || d.st || "") + "</span></div></div>" +
    "<h2>Informations dossier</h2>" +
    "<div class='info-grid'>" +
    "<div class='info-item'><span class='info-label'>Client :</span><span class='info-val'><strong>" + (d.cl || "---") + "</strong></span></div>" +
    "<div class='info-item'><span class='info-label'>N° BL :</span><span class='info-val'><strong>" + (d.bl || "---") + "</strong></span></div>" +
    "<div class='info-item'><span class='info-label'>Compagnie :</span><span class='info-val'>" + (d.cp || "---") + "</span></div>" +
    "<div class='info-item'><span class='info-label'>Destination :</span><span class='info-val'>" + (d.cr || "---") + "</span></div>" +
    "<div class='info-item'><span class='info-label'>Date decharg. :</span><span class='info-val'>" + fdPrint(d.da) + "</span></div>" +
    "<div class='info-item'><span class='info-label'>Tel client :</span><span class='info-val'>" + (d.ct || "---") + "</span></div>" +
    "</div>" +
    (dosTcs.length > 0 ? "<h2>Conteneurs (" + String(dosTcs.length) + ")</h2><table><thead><tr><th>N° TC</th><th>Type</th><th>Statut</th><th>Chauffeur</th><th>Camion</th><th>Date dispatch</th></tr></thead><tbody>" + tcsRows + "</tbody></table>" : "") +
    (dosDep.length > 0 ? "<h2>Depenses (" + String(dosDep.length) + ")</h2><table><thead><tr><th>Type</th><th>Description</th><th style='text-align:right'>Montant HT</th><th style='text-align:right'>Montant TTC</th><th style='text-align:center'>Statut</th></tr></thead><tbody>" + depRows + "</tbody></table>" : "") +
    (tot > 0 ? "<div class='totals'><div class='total-box'><div class='total-label'>TOTAL DEPENSES</div><div class='total-val'>" + fmPrint(tot) + "</div></div><div class='total-box'><div class='total-label'>PAYE</div><div class='total-val' style='color:#059669'>" + fmPrint(paye) + "</div></div><div class='total-box'><div class='total-label'>IMPAYE</div><div class='total-val' style='color:" + (impaye > 0 ? "#dc2626" : "#059669") + "'>" + (impaye > 0 ? fmPrint(impaye) : "OK \u2713") + "</div></div></div>" : "") +
    "<div class='footer'><span>" + (companyName || "SAPURAI") + "</span><span>Document genere automatiquement</span></div>" +
    "<script>window.print();<\/script></body></html>";

  var w = window.open("", "_blank");
  if (!w) { alert("Autorisez les popups pour imprimer ce dossier."); return; }
  w.document.write(html);
  w.document.close();
}
