// src/utils/pdf.ts
// Generation de rapports PDF — jsPDF + autoTable

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SL, DL } from '../constants/statuts.js';
import { DTL } from '../constants/depenses.js';
import type { Dossier, Conteneur, Depense, Config } from '../types.js';

// jspdf-autotable etend jsPDF avec lastAutoTable (non type dans @types officiel)
type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

// --- Helpers ---

function fdPdf(iso: string | null): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function fmPdf(n: number | null): string {
  if (!n && n !== 0) return "---";
  return Number(n).toLocaleString("fr-FR") + " FCFA";
}

var HEAD_FILL: [number, number, number] = [28, 25, 23];
var ALT_ROW: [number, number, number] = [250, 250, 249];

function pdfHeader(doc: jsPDF, companyName: string, title: string): number {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(companyName || "SAPURAI", 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("Gestion Transit & Logistique", 14, 24);
  doc.setTextColor(0);
  var pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, pw - 14, 18, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("Imprime le " + fdPdf(new Date().toISOString()), pw - 14, 24, { align: "right" });
  doc.setTextColor(0);
  doc.setDrawColor(28, 25, 23);
  doc.setLineWidth(0.5);
  doc.line(14, 28, pw - 14, 28);
  return 34;
}

function pdfFooter(doc: jsPDF, companyName: string): void {
  // jsPDF.internal n'expose pas getNumberOfPages dans le typage @types officiel, mais l'API runtime l'expose
  var pages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (var i = 1; i <= pages; i++) {
    doc.setPage(i);
    var ph = doc.internal.pageSize.getHeight();
    var pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(companyName || "SAPURAI", 14, ph - 10);
    doc.text("Document genere automatiquement", pw / 2, ph - 10, { align: "center" });
    doc.text("Page " + String(i) + "/" + String(pages), pw - 14, ph - 10, { align: "right" });
  }
}

function safeName(s: string | null): string {
  return (s || "sapurai").replace(/[^a-zA-Z0-9_-]/g, "_");
}

// --- Fonctions publiques ---

/**
 * PDF fiche dossier complete.
 * @param {Object} d   - dossier
 * @param {Array}  tcs - tous les conteneurs
 * @param {Array}  dep - toutes les depenses
 * @param {Object} cfg - { name: "SOCIETE", ... }
 */
export function pdfDossier(d: Dossier, tcs: Conteneur[], dep: Depense[], cfg: Config): void {
  var companyName = (cfg && cfg.name) || "SAPURAI";
  var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var y = pdfHeader(doc, companyName, "FICHE DOSSIER");

  // Statut
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Statut : " + (DL[d.st] || d.st || ""), 14, y);
  y += 8;

  // Infos dossier
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Informations dossier", 14, y);
  y += 2;
  doc.setDrawColor(28, 25, 23);
  doc.setLineWidth(0.3);
  doc.line(14, y, 100, y);
  y += 5;

  var infos = [
    ["Client", d.cl || "---"],
    ["N. BL", d.bl || "---"],
    ["Compagnie", d.cp || "---"],
    ["Destination", d.cr || "---"],
    ["Date decharg.", fdPdf(d.da)],
    ["Tel client", d.ct || "---"]
  ];

  doc.setFontSize(9);
  infos.forEach(function (pair, i) {
    var col = i % 2 === 0 ? 14 : 110;
    var row = y + Math.floor(i / 2) * 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120);
    doc.text(pair[0] + " :", col, row);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(pair[1], col + 32, row);
  });
  y += Math.ceil(infos.length / 2) * 6 + 6;

  // Conteneurs
  var dosTcs = (tcs || []).filter(function (t) { return t.did === d.id; });
  if (dosTcs.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Conteneurs (" + String(dosTcs.length) + ")", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["N. TC", "Type", "Statut", "Chauffeur", "Camion", "Date dispatch"]],
      body: dosTcs.map(function (tc) {
        return [tc.n || "?", tc.ty || "", SL[tc.st] || tc.st || "", tc.ch || "---", tc.cm || "---", fdPdf(tc.dsp)];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: ALT_ROW },
      margin: { left: 14, right: 14 }
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;
  }

  // Depenses
  var dosDep = (dep || []).filter(function (f) { return f.did === d.id; });
  if (dosDep.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Depenses (" + String(dosDep.length) + ")", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Type", "Description", "Montant HT", "Montant TTC", "Statut"]],
      body: dosDep.map(function (f) {
        return [DTL[f.tp] || f.tp || "", f.ds || "", fmPdf(f.ht || f.mt), fmPdf(f.mt), f.s === "PAYE" ? "Paye" : "Impaye"];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: ALT_ROW },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center" } },
      margin: { left: 14, right: 14 }
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;
  }

  // Totaux
  var tot = dosDep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var paye = dosDep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var impaye = tot - paye;

  if (tot > 0) {
    var pw2 = doc.internal.pageSize.getWidth();
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("TOTAL :", pw2 - 80, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(fmPdf(tot), pw2 - 14, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("PAYE :", pw2 - 80, y);
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.text(fmPdf(paye), pw2 - 14, y, { align: "right" });
    y += 5;
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text("IMPAYE :", pw2 - 80, y);
    if (impaye > 0) { doc.setTextColor(220, 38, 38); } else { doc.setTextColor(5, 150, 105); }
    doc.setFont("helvetica", "bold");
    doc.text(impaye > 0 ? fmPdf(impaye) : "OK", pw2 - 14, y, { align: "right" });
    doc.setTextColor(0);
    y += 8;
    var rv = d.rv || 0;
    if (rv > 0) {
      var margeDos = rv - tot;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text("RECETTE :", pw2 - 80, y);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(fmPdf(rv), pw2 - 14, y, { align: "right" });
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text("MARGE :", pw2 - 80, y);
      if (margeDos >= 0) { doc.setTextColor(5, 150, 105); } else { doc.setTextColor(220, 38, 38); }
      doc.setFont("helvetica", "bold");
      doc.text(fmPdf(margeDos), pw2 - 14, y, { align: "right" });
      doc.setTextColor(0);
    }
  }

  pdfFooter(doc, companyName);
  doc.save(safeName(companyName) + "_dossier_" + (d.bl || d.id) + ".pdf");
}

/**
 * PDF liste des depenses filtrees.
 * @param {Array}  deps - depenses (filtrees)
 * @param {Array}  dos  - dossiers (pour lookup client/BL)
 * @param {string} companyName
 */
export function pdfDepenses(deps: Depense[], dos: Dossier[], companyName?: string): void {
  companyName = companyName || "SAPURAI";
  var doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  var y = pdfHeader(doc, companyName, "LISTE DES DEPENSES");

  var tot = (deps || []).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var paye = (deps || []).filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);

  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text(
    String(deps.length) + " depense(s) | Total : " + fmPdf(tot) + " | Paye : " + fmPdf(paye) + " | Impaye : " + fmPdf(tot - paye),
    14, y
  );
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Type", "Description", "N. Facture", "Client", "BL", "Montant HT", "Montant TTC", "Statut", "Date"]],
    body: (deps || []).map(function (f) {
      var d = (dos || []).find(function (x) { return x.id === f.did; });
      return [
        DTL[f.tp] || f.tp || "", f.ds || "", f.nf || "",
        d ? (d.cl || "") : "", d ? (d.bl || "") : "",
        fmPdf(f.ht || f.mt), fmPdf(f.mt),
        f.s === "PAYE" ? "Paye" : "Impaye", fdPdf(f.dt)
      ];
    }),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "center" } },
    margin: { left: 14, right: 14 }
  });

  pdfFooter(doc, companyName);
  doc.save(safeName(companyName) + "_depenses_" + new Date().toISOString().slice(0, 10) + ".pdf");
}

interface BilanUrgence {
  level?: 'critical' | 'warning' | string;
  cat?: string;
  msg?: string;
  sub?: string;
}

interface BilanAlerte {
  tn?: string;
  cl?: string;
  dn?: string;
  tp?: string;
  j?: number;
  r?: number;
}

interface BilanData {
  dos: Dossier[];
  tcs: Conteneur[];
  dep: Depense[];
  urgences?: BilanUrgence[];
  alertes?: BilanAlerte[];
  companyName?: string;
}

/**
 * PDF bilan journalier.
 */
export function pdfBilan(data: BilanData): void {
  var companyName = data.companyName || "SAPURAI";
  var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var y = pdfHeader(doc, companyName, "BILAN JOURNALIER");

  var enCours = data.dos.filter(function (d) { return d.st !== "CLOTURE" && d.st !== "ARCHIVE"; }).length;
  var clotures = data.dos.filter(function (d) { return d.st === "CLOTURE"; }).length;
  var nAttendu = data.tcs.filter(function (c) { return c.st === "ATTENDU"; }).length;
  var atPort = data.tcs.filter(function (c) { return c.st === "PORT"; }).length;
  var inTransit = data.tcs.filter(function (c) { return c.st !== "PORT" && c.st !== "ATTENDU" && c.st !== "RETURNED"; }).length;
  var returned = data.tcs.filter(function (c) { return c.st === "RETURNED"; }).length;
  var payees = data.dep.filter(function (f) { return f.s === "PAYE"; }).length;
  var impayees = data.dep.filter(function (f) { return f.s !== "PAYE"; }).length;

  // Situation
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Situation actuelle", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Categorie", "Detail"]],
    body: [
      ["Dossiers", String(enCours) + " en cours, " + String(clotures) + " cloture(s)"],
      ["Conteneurs", (nAttendu > 0 ? String(nAttendu) + " attendu(s) | " : "") + String(atPort) + " au port | " + String(inTransit) + " en transit | " + String(returned) + " retourne(s)"],
      ["Depenses", String(payees) + " payee(s) | " + String(impayees) + " impayee(s)"],
      ["Financier", (function () { var tDep = data.dep.reduce(function (a, f) { return a + (f.mt || 0); }, 0); var tPay = data.dep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0); var tRv = data.dos.filter(function (d) { return d.st !== "ARCHIVE"; }).reduce(function (a, d) { return a + (d.rv || 0); }, 0); return "Total: " + fmPdf(tDep) + " | Paye: " + fmPdf(tPay) + " | Impaye: " + fmPdf(tDep - tPay) + (tRv > 0 ? " | Marge: " + fmPdf(tRv - tDep) : ""); })()]
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    margin: { left: 14, right: 14 }
  });
  y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

  // Urgences
  if (data.urgences && data.urgences.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Points a regler (" + String(data.urgences.length) + ")", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Niveau", "Categorie", "Detail"]],
      body: data.urgences.map(function (u) {
        return [u.level === "critical" ? "CRITIQUE" : "ATTENTION", u.cat || "", (u.msg || "") + " - " + (u.sub || "")];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
      didParseCell: function (data) {
        if (data.section === "body" && data.column.index === 0) {
          if (data.cell.raw === "CRITIQUE") {
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [146, 64, 14];
          }
        }
      },
      margin: { left: 14, right: 14 }
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;
  }

  // Alertes franchise
  if (data.alertes && data.alertes.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Detail alertes franchise (" + String(data.alertes.length) + ")", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["TC", "Client", "BL", "Type", "Jours", "Reste"]],
      body: data.alertes.map(function (a) {
        return [a.tn || "", a.cl || "", a.dn || "", a.tp || "", String(a.j || 0) + "j", String(a.r || 0) + "j"];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
      margin: { left: 14, right: 14 }
    });
  }

  pdfFooter(doc, companyName);
  doc.save(safeName(companyName) + "_bilan_" + new Date().toISOString().slice(0, 10) + ".pdf");
}

/**
 * PDF bilan par client — resume + detail de chaque dossier.
 * @param {string} clientName
 * @param {Array}  dos - tous les dossiers
 * @param {Array}  tcs - tous les conteneurs
 * @param {Array}  dep - toutes les depenses
 * @param {string} companyName
 */
export function pdfClient(clientName: string, dos: Dossier[], tcs: Conteneur[], dep: Depense[], companyName?: string): void {
  companyName = companyName || "SAPURAI";
  var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var y = pdfHeader(doc, companyName, "BILAN CLIENT");

  var clientDos = (dos || []).filter(function (d) { return (d.cl || "") === clientName && d.st !== "ARCHIVE"; });
  var clientDep = (dep || []).filter(function (f) {
    return clientDos.some(function (d) { return d.id === f.did; });
  });
  var clientTcs = (tcs || []).filter(function (c) {
    return clientDos.some(function (d) { return d.id === c.did; });
  });

  // --- Resume client ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(clientName || "---", 14, y);
  y += 6;

  var tot = clientDep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var pay = clientDep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var imp = tot - pay;
  var pct = tot > 0 ? Math.round(pay / tot * 100) : 0;
  var totalRv = clientDos.reduce(function (a, d) { return a + (d.rv || 0); }, 0);
  var marge = totalRv - tot;

  var indicBody = [
    ["Dossiers actifs", String(clientDos.filter(function (d) { return d.st !== "CLOTURE"; }).length)],
    ["Dossiers clotures", String(clientDos.filter(function (d) { return d.st === "CLOTURE"; }).length)],
    ["Conteneurs", String(clientTcs.length)],
    ["Total depenses", fmPdf(tot)],
    ["Paye", fmPdf(pay)],
    ["Impaye", imp > 0 ? fmPdf(imp) : "Tout regle"]
  ];
  if (totalRv > 0) {
    indicBody.push(["Recette", fmPdf(totalRv)]);
    indicBody.push(["Marge", fmPdf(marge)]);
  }
  indicBody.push(["Taux paiement", String(pct) + "%"]);

  autoTable(doc, {
    startY: y,
    head: [["Indicateur", "Valeur"]],
    body: indicBody,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    didParseCell: function (data) {
      if (data.section === "body") {
        if (data.row.index === 4) data.cell.styles.textColor = [5, 150, 105];
        if (data.row.index === 5 && imp > 0) data.cell.styles.textColor = [220, 38, 38];
      }
    },
    margin: { left: 14, right: 14 }
  });
  y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

  // --- Liste recapitulative des dossiers ---
  if (clientDos.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Recapitulatif dossiers (" + String(clientDos.length) + ")", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["N. BL", "Compagnie", "Destination", "Date", "Statut", "TC", "Total", "Paye", "Impaye"]],
      body: clientDos.map(function (d) {
        var ddep = clientDep.filter(function (f) { return f.did === d.id; });
        var dtcs = clientTcs.filter(function (c) { return c.did === d.id; });
        var dt = ddep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
        var dp = ddep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
        return [d.bl || "---", d.cp || "---", d.cr || "---", fdPdf(d.da), DL[d.st] || d.st || "", String(dtcs.length), fmPdf(dt), fmPdf(dp), dt - dp > 0 ? fmPdf(dt - dp) : "OK"];
      }),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: ALT_ROW },
      columnStyles: { 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
      margin: { left: 14, right: 14 }
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;
  }

  // --- Detail par dossier ---
  clientDos.forEach(function (d) {
    var dosTcs = clientTcs.filter(function (c) { return c.did === d.id; });
    var dosDep = clientDep.filter(function (f) { return f.did === d.id; });
    if (dosTcs.length === 0 && dosDep.length === 0) return;

    // Check page space — add new page if less than 60mm left
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = pdfHeader(doc, companyName, "BILAN CLIENT");
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(28, 25, 23);
    doc.text("Dossier : " + (d.bl || "---") + "  |  " + (d.cp || "") + "  |  " + (DL[d.st] || d.st || ""), 14, y);
    y += 5;

    if (dosTcs.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["N. TC", "Type", "Statut", "Chauffeur", "Camion", "Dispatch", "Retour"]],
        body: dosTcs.map(function (tc) {
          return [tc.n || "?", tc.ty || "", SL[tc.st] || tc.st || "", tc.ch || "---", tc.cm || "---", fdPdf(tc.dsp), fdPdf(tc.dr)];
        }),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: ALT_ROW },
        margin: { left: 14, right: 14 }
      });
      y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 3;
    }

    if (dosDep.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Type", "Description", "Montant", "Statut"]],
        body: dosDep.map(function (f) {
          return [DTL[f.tp] || f.tp || "", f.ds || "", fmPdf(f.mt), f.s === "PAYE" ? "Paye" : "Impaye"];
        }),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: ALT_ROW },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "center" } },
        margin: { left: 14, right: 14 }
      });
      y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 3;
    }

    // Sous-total dossier
    var dt2 = dosDep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    var dp2 = dosDep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    if (dt2 > 0) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(120);
      doc.text("Total: " + fmPdf(dt2) + "  |  Paye: " + fmPdf(dp2) + "  |  Impaye: " + (dt2 - dp2 > 0 ? fmPdf(dt2 - dp2) : "OK"), 14, y + 2);
      doc.setTextColor(0);
      y += 10;
    } else {
      y += 5;
    }
  });

  pdfFooter(doc, companyName);
  doc.save(safeName(companyName) + "_client_" + safeName(clientName) + "_" + new Date().toISOString().slice(0, 10) + ".pdf");
}
