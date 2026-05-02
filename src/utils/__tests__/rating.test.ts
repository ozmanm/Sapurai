import { describe, it, expect } from 'vitest';
import { ratingStats, dossiersWithProblems } from '../rating';
import type { Dossier } from '../../types';

function mkDos(id: string, rating?: 1 | 2 | 3, ratingAt?: string): Dossier {
  return {
    id: id,
    bl: "BL" + id,
    cl: "CLIENT " + id,
    st: "CLOTURE",
    rating: rating,
    ratingAt: ratingAt,
  } as Dossier;
}

describe('ratingStats', function () {
  it('retourne des stats vides si aucun dossier note', function () {
    var r = ratingStats([mkDos("a"), mkDos("b"), mkDos("c")]);
    expect(r).toEqual({ total: 0, good: 0, problems: 0, goodPct: 0 });
  });

  it('compte correctement bons et problemes', function () {
    var r = ratingStats([
      mkDos("1", 1),
      mkDos("2", 2),
      mkDos("3", 3),
      mkDos("4", 1),
      mkDos("5"),          // pas note, ignore
    ]);
    expect(r.total).toBe(4);
    expect(r.good).toBe(3);
    expect(r.problems).toBe(1);
    expect(r.goodPct).toBe(75);
  });

  it('100% si tous satisfaits', function () {
    var r = ratingStats([mkDos("1", 1), mkDos("2", 2), mkDos("3", 1)]);
    expect(r.goodPct).toBe(100);
    expect(r.problems).toBe(0);
  });

  it('0% si tous problemes', function () {
    var r = ratingStats([mkDos("1", 3), mkDos("2", 3)]);
    expect(r.goodPct).toBe(0);
    expect(r.problems).toBe(2);
  });
});

describe('dossiersWithProblems', function () {
  it('retourne uniquement les rating=3', function () {
    var res = dossiersWithProblems([
      mkDos("a", 1),
      mkDos("b", 3),
      mkDos("c", 2),
      mkDos("d", 3),
      mkDos("e"),
    ]);
    expect(res.length).toBe(2);
    expect(res.map(function (d) { return d.id; }).sort()).toEqual(["b", "d"]);
  });

  it('trie du plus recent au plus ancien', function () {
    var res = dossiersWithProblems([
      mkDos("old",    3, "2026-01-10T10:00:00.000Z"),
      mkDos("recent", 3, "2026-04-15T10:00:00.000Z"),
      mkDos("mid",    3, "2026-02-20T10:00:00.000Z"),
    ]);
    expect(res.map(function (d) { return d.id; })).toEqual(["recent", "mid", "old"]);
  });

  it('dossiers sans ratingAt atterrissent en fin de liste', function () {
    var res = dossiersWithProblems([
      mkDos("no-date", 3),
      mkDos("dated",   3, "2026-03-01T10:00:00.000Z"),
    ]);
    expect(res[0].id).toBe("dated");
    expect(res[1].id).toBe("no-date");
  });
});
