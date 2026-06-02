// src/services/__tests__/resolveUpdater.test.ts
//
// Backlog N (Sprint 46 hotfix beta) : verrouille l'ex-ligne 461 de useData.ts (write-back
// synchrone du ref) + le comportement de fallback. 5 cas, dont le rapid-succession (2
// updaters chaines via le meme ref) et le value-path (qui DOIT aussi mettre a jour le ref,
// sinon un updater suivant lit un ref stale du dernier value-save : ex deleteDos apres un
// addDos rapproche). Si quelqu'un retire `ref.current = next`, le cas 1 ET le cas value-path
// cassent. C'est le mode de regression #1 (primaire) de E.

/* eslint-disable @typescript-eslint/no-explicit-any -- formes de test arbitraires */

import { describe, it, expect } from 'vitest';
import { resolveUpdater } from '../resolveUpdater';

describe('resolveUpdater - resolution + write-back synchrone (backlog N)', function () {

  it('RAPID-SUCCESSION : fonction sur ref valide, 2 appels chaines -> le 2e voit le post-state du 1er', function () {
    var A = { id: 'A' }, B = { id: 'B' }, C = { id: 'C' };
    var ref: any = { current: { dos: [A, B, C] } };
    var out1 = resolveUpdater(function (p: any) {
      return { dos: p.dos.filter(function (d: any) { return d.id !== 'A'; }) };
    }, ref, null as any);
    expect(out1.dos.map(function (d: any) { return d.id; })).toEqual(['B', 'C']);
    expect(ref.current).toBe(out1);               // write-back : le ref pointe le post-state
    var out2 = resolveUpdater(function (p: any) {
      return { dos: p.dos.filter(function (d: any) { return d.id !== 'B'; }) };
    }, ref, null as any);
    expect(out2.dos.map(function (d: any) { return d.id; })).toEqual(['C']);  // A PAS ressuscite
  });

  it('fonction avec ref.current null (pre-hydratation) -> base = fallback', function () {
    var ref: any = { current: null };
    var out = resolveUpdater(function (p: any) {
      return { dos: p.dos.concat(['X']) };
    }, ref, { dos: ['seed'] } as any);
    expect(out).toEqual({ dos: ['seed', 'X'] });
    expect(ref.current).toBe(out);
  });

  it('valeur directe (value-path addDos/editDos/patchDos) -> ref mis a jour AUSSI', function () {
    var ref: any = { current: { dos: ['old'] } };
    var val = { dos: ['new'] };
    var out = resolveUpdater(val as any, ref, null as any);
    expect(out).toBe(val);
    expect(ref.current).toBe(val);                // sinon un updater suivant lirait un ref stale
  });

  it('valeur directe avec ref.current null -> fallback ignore, la valeur ecrase', function () {
    var ref: any = { current: null };
    var val = { dos: ['v'] };
    var out = resolveUpdater(val as any, ref, { dos: ['fb'] } as any);
    expect(out).toBe(val);
    expect(ref.current).toBe(val);
  });

  it('fonction renvoyant un objet -> ref.current et return pointent le MEME objet', function () {
    var produced = { dos: ['z'] };
    var ref: any = { current: { dos: [] } };
    var out = resolveUpdater(function () { return produced; }, ref, null as any);
    expect(out).toBe(produced);
    expect(ref.current).toBe(produced);
  });

});
