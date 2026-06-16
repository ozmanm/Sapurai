// src/services/__tests__/assembleData.test.ts
//
// Phase C C1 : tests PURS du reducer read-assembly + du flag shouldReadFromSub.
// Mocks firebase VIDES : assembleData importe SUB_KEYS depuis dualwrite (source de verite
// unique), qui importe firebase au top-level. assembleData n'appelle AUCUNE fonction firebase
// -> neutraliser l'import (mocks vides) suffit a garder ce test isole, sans charger le vrai SDK.

/* eslint-disable @typescript-eslint/no-explicit-any -- formes de test arbitraires */

import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', function () { return {}; });
vi.mock('firebase/auth', function () { return {}; });

import { assembleData, extractArrays } from '../assembleData';
import { shouldReadFromSub, matchesSubRead, SUB_READ_COMPANIES } from '../../constants/featureFlags';

var ENV = { cfg: { fp: 10 }, name: 'Co', status: 'active', dos: [{ id: 'M1' }], tcs: [{ id: 'MT1' }] };

describe('assembleData - reducer read-assembly (Phase C C1)', function () {

  it('assemblage normal : enveloppe preservee + arrays sub prennent la place', function () {
    var out = assembleData(ENV, { dos: [{ id: 'S1' }], tcs: [], chs: [], dep: [], logs: [] });
    expect(out.cfg).toEqual({ fp: 10 });           // enveloppe intacte
    expect(out.name).toBe('Co');
    expect(out.status).toBe('active');
    expect(out.dos).toEqual([{ id: 'S1' }]);        // array sub
    expect(out.tcs).toEqual([]);                    // [] sub prend precedence sur le mono [MT1]
  });

  it('envelope null (pre-hydratation) : base {} + arrays sub ou []', function () {
    var out = assembleData(null, { dos: [{ id: 'S1' }] });
    expect(out.dos).toEqual([{ id: 'S1' }]);
    expect(out.tcs).toEqual([]);                    // undefined -> [] (base {} sans tcs)
    expect(out.cfg).toBeUndefined();                // pas d'enveloppe
  });

  it('array undefined (listener pas fire) -> fallback sur l array de l enveloppe mono', function () {
    var out = assembleData(ENV, { tcs: [{ id: 'S2' }] });   // dos absent du patch sub
    expect(out.dos).toEqual([{ id: 'M1' }]);        // fallback mono : pas de flicker vers vide
    expect(out.tcs).toEqual([{ id: 'S2' }]);
  });

  it('array [] (listener fire, vide) -> precedence sub sur enveloppe non-vide', function () {
    var out = assembleData(ENV, { dos: [] });
    expect(out.dos).toEqual([]);                    // [] !== undefined -> sub gagne (le piege du `||`)
  });

  it('subArrays partiel : seuls les keys fournis bougent, le reste fallback', function () {
    var out = assembleData(ENV, { logs: [{ id: 'L1' }] });
    expect(out.logs).toEqual([{ id: 'L1' }]);
    expect(out.dos).toEqual([{ id: 'M1' }]);        // fallback enveloppe
    expect(out.chs).toEqual([]);                    // ni sub ni enveloppe -> []
  });

  it('forme identique a l enveloppe sur les champs non-array (transparence consumer)', function () {
    var out = assembleData(ENV, { dos: [], tcs: [], chs: [], dep: [], logs: [] });
    expect(Object.keys(out).sort()).toEqual(['cfg', 'chs', 'dep', 'dos', 'logs', 'name', 'status', 'tcs']);
  });

  it('extractArrays : recupere les 5 arrays, undefined si absent / non-array non extrait', function () {
    var ex = extractArrays({ dos: [1], tcs: [2], name: 'x' } as any);
    expect(ex.dos).toEqual([1]);
    expect(ex.tcs).toEqual([2]);
    expect(ex.chs).toBeUndefined();
    expect(ex.logs).toBeUndefined();
    expect((ex as any).name).toBeUndefined();       // champ non-array non extrait
  });

  it('extractArrays(null) -> tous undefined (pre-hydratation)', function () {
    var ex = extractArrays(null);
    expect(ex.dos).toBeUndefined();
    expect(ex.logs).toBeUndefined();
  });

});

describe('matchesSubRead / shouldReadFromSub - flag Phase C', function () {

  it('liste vide -> false', function () {
    expect(matchesSubRead([], 'c_x')).toBe(false);
  });

  it('cid liste -> true', function () {
    expect(matchesSubRead(['c_a', 'c_x'], 'c_x')).toBe(true);
  });

  it("'*' -> true pour tout cid (generalisation C5)", function () {
    expect(matchesSubRead(['*'], 'c_anything')).toBe(true);
  });

  it('cid null/absent -> false meme avec liste armee', function () {
    expect(matchesSubRead(['*'], null)).toBe(false);
    expect(matchesSubRead(['c_x'], undefined)).toBe(false);
    expect(matchesSubRead(['c_x'], '')).toBe(false);
  });

  // SENTINELLE : C1 doit shipper DORMANT. Si quelqu'un arme le flag par defaut, ce test casse.
  it('SENTINELLE : SUB_READ_COMPANIES vide par defaut -> shouldReadFromSub false', function () {
    expect(SUB_READ_COMPANIES.length).toBe(0);
    expect(shouldReadFromSub('c_whatever')).toBe(false);
  });

});
