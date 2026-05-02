import { describe, it, expect } from 'vitest';
import {
  pendingInvoices,
  pendingInvoicesStats,
  groupPendingByDossier,
  LATE_THRESHOLD_DAYS,
} from '../pendingInvoices';
import type { Dossier, Depense } from '../../types';

function mkDos(id: string, overrides?: Partial<Dossier>): Dossier {
  return Object.assign(
    { id: id, bl: "BL" + id, cl: "CLIENT", st: "ACTIF" },
    overrides || {},
  ) as Dossier;
}

function mkDep(overrides: Partial<Depense>): Depense {
  return Object.assign(
    { id: "dep-" + Math.random(), did: "d1", tp: "AUTRE", mt: 0, dt: "2026-04-01" },
    overrides,
  ) as Depense;
}

describe('pendingInvoices', function () {
  it('filtre uniquement en_attente_facture non ignored', function () {
    var dep: Depense[] = [
      mkDep({ status: "en_attente_facture" }),
      mkDep({ status: "a_payer" }),                         // ignore
      mkDep({ status: "payee" }),                           // ignore
      mkDep({ status: "en_attente_facture", ignored: true }), // ignore
    ];
    var dos: Dossier[] = [mkDos("d1")];
    var res = pendingInvoices(dep, dos, "2026-04-22");
    expect(res.length).toBe(1);
  });

  it('exclut les dossiers archives', function () {
    var dep: Depense[] = [
      mkDep({ status: "en_attente_facture", did: "d1" }),
      mkDep({ status: "en_attente_facture", did: "d2" }),
    ];
    var dos: Dossier[] = [mkDos("d1", { st: "ACTIF" }), mkDos("d2", { st: "ARCHIVE" })];
    var res = pendingInvoices(dep, dos, "2026-04-22");
    expect(res.length).toBe(1);
    expect(res[0].dossier && res[0].dossier.id).toBe("d1");
  });

  it('calcule age et flag late', function () {
    var dep: Depense[] = [
      mkDep({ status: "en_attente_facture", dt: "2026-04-01" }), // 21j
      mkDep({ status: "en_attente_facture", dt: "2026-04-20" }), // 2j
    ];
    var dos: Dossier[] = [mkDos("d1")];
    var res = pendingInvoices(dep, dos, "2026-04-22");
    expect(res[0].ageDays).toBe(21);    // plus vieux en premier
    expect(res[0].late).toBe(true);
    expect(res[1].ageDays).toBe(2);
    expect(res[1].late).toBe(false);
  });

  it('trie du plus ancien au plus recent', function () {
    var dep: Depense[] = [
      mkDep({ status: "en_attente_facture", dt: "2026-04-10", did: "d1" }),
      mkDep({ status: "en_attente_facture", dt: "2026-04-01", did: "d1" }),
      mkDep({ status: "en_attente_facture", dt: "2026-04-15", did: "d1" }),
    ];
    var dos: Dossier[] = [mkDos("d1")];
    var res = pendingInvoices(dep, dos, "2026-04-22");
    expect(res.map(function (p) { return p.depense.dt; })).toEqual([
      "2026-04-01", "2026-04-10", "2026-04-15",
    ]);
  });
});

describe('pendingInvoicesStats', function () {
  it('compte total, retards, semaine, dossiers', function () {
    var dep: Depense[] = [
      mkDep({ status: "en_attente_facture", dt: "2026-04-01", did: "d1" }), // 21j late
      mkDep({ status: "en_attente_facture", dt: "2026-04-05", did: "d1" }), // 17j late
      mkDep({ status: "en_attente_facture", dt: "2026-04-18", did: "d2" }), // 4j cette semaine
      mkDep({ status: "en_attente_facture", dt: "2026-04-20", did: "d2" }), // 2j cette semaine
    ];
    var dos: Dossier[] = [mkDos("d1"), mkDos("d2")];
    var inv = pendingInvoices(dep, dos, "2026-04-22");
    var st = pendingInvoicesStats(inv);
    expect(st.total).toBe(4);
    expect(st.late).toBe(2);
    expect(st.thisWeek).toBe(2);
    expect(st.byDossier).toBe(2);
  });
});

describe('groupPendingByDossier', function () {
  it('groupe par dossier et trie par maxAge decroissant', function () {
    var dep: Depense[] = [
      mkDep({ status: "en_attente_facture", dt: "2026-04-15", did: "d1" }), // 7j
      mkDep({ status: "en_attente_facture", dt: "2026-04-01", did: "d2" }), // 21j
      mkDep({ status: "en_attente_facture", dt: "2026-04-20", did: "d2" }), // 2j
    ];
    var dos: Dossier[] = [mkDos("d1"), mkDos("d2")];
    var inv = pendingInvoices(dep, dos, "2026-04-22");
    var grp = groupPendingByDossier(inv);
    expect(grp.length).toBe(2);
    expect(grp[0].dossier.id).toBe("d2");  // max age 21j
    expect(grp[0].invoices.length).toBe(2);
    expect(grp[1].dossier.id).toBe("d1");
    expect(grp[1].invoices.length).toBe(1);
  });
});

describe('LATE_THRESHOLD_DAYS', function () {
  it('est bien 10 jours', function () {
    expect(LATE_THRESHOLD_DAYS).toBe(10);
  });
});
