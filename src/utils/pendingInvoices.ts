import type { Dossier, Depense } from '../types';

/**
 * Helpers pour le widget "Factures en attente" du Dashboard.
 *
 * Une facture "en attente" = Depense avec `status === 'en_attente_facture'`
 * ET pas ignored. Un stub peut vieillir sans etre traite : au-dela du seuil
 * `LATE_THRESHOLD_DAYS` (10j) on le considere en retard.
 */

export var LATE_THRESHOLD_DAYS = 10;

export interface PendingInvoice {
  depense: Depense;
  dossier: Dossier | undefined;
  ageDays: number;     // jours depuis creation du stub (via dt)
  late: boolean;       // ageDays > LATE_THRESHOLD_DAYS
}

function daysBetween(isoA: string, isoB: string): number {
  var a = new Date(isoA + "T00:00:00Z").getTime();
  var b = new Date(isoB + "T00:00:00Z").getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

/**
 * Retourne la liste des factures en attente, triees par age decroissant
 * (les plus vieilles en premier = a traiter en priorite).
 * Filtre : status=en_attente_facture, !ignored, et dossier non archive.
 */
export function pendingInvoices(
  dep: Depense[],
  dos: Dossier[],
  todayIso?: string,
): PendingInvoice[] {
  var today = todayIso || new Date().toISOString().slice(0, 10);
  var dosById: Record<string, Dossier> = {};
  dos.forEach(function (d) { dosById[d.id] = d; });

  var out: PendingInvoice[] = dep
    .filter(function (d) {
      if (d.status !== "en_attente_facture") return false;
      if (d.ignored) return false;
      var ds = dosById[d.did];
      if (!ds || ds.st === "ARCHIVE") return false;
      return true;
    })
    .map(function (d) {
      var age = d.dt ? daysBetween(d.dt, today) : 0;
      return {
        depense: d,
        dossier: dosById[d.did],
        ageDays: age,
        late: age > LATE_THRESHOLD_DAYS,
      };
    });

  out.sort(function (a, b) { return b.ageDays - a.ageDays; });
  return out;
}

export interface PendingInvoicesStats {
  total: number;
  late: number;         // en retard (age > 10j)
  thisWeek: number;     // age <= 7j
  byDossier: number;    // nombre de dossiers concernes
}

export function pendingInvoicesStats(invoices: PendingInvoice[]): PendingInvoicesStats {
  var dosSet = new Set<string>();
  invoices.forEach(function (p) { if (p.dossier) dosSet.add(p.dossier.id); });
  return {
    total: invoices.length,
    late: invoices.filter(function (p) { return p.late; }).length,
    thisWeek: invoices.filter(function (p) { return p.ageDays <= 7; }).length,
    byDossier: dosSet.size,
  };
}

/**
 * Groupe les factures en attente par dossier (pour l'affichage).
 */
export interface PendingByDossier {
  dossier: Dossier;
  invoices: PendingInvoice[];
  maxAge: number;
}

export function groupPendingByDossier(invoices: PendingInvoice[]): PendingByDossier[] {
  var map: Record<string, PendingByDossier> = {};
  invoices.forEach(function (p) {
    if (!p.dossier) return;
    var did = p.dossier.id;
    if (!map[did]) {
      map[did] = { dossier: p.dossier, invoices: [], maxAge: 0 };
    }
    map[did].invoices.push(p);
    if (p.ageDays > map[did].maxAge) map[did].maxAge = p.ageDays;
  });
  var list: PendingByDossier[] = [];
  Object.keys(map).forEach(function (k) { list.push(map[k]); });
  list.sort(function (a, b) { return b.maxAge - a.maxAge; });
  return list;
}
