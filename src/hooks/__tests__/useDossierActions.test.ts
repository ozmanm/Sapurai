// src/hooks/__tests__/useDossierActions.test.ts
//
// Backlog E (Sprint 46 hotfix beta) : barriere de regression sur la closure stale de
// deleteDos / bulkDeleteDos. Avant le fix, ces actions construisaient newData a partir
// du dos/tcs/dep FIGE de la closure React -> sur 2 deletes rapproches (avant re-render),
// le 2e delete repartait du state initial et RESSUSCITAIT l'item supprime par le 1er.
//
// Le fix : deleteDos/bulkDeleteDos passent un UPDATER fonctionnel a sv (=save), qui le
// resout contre la verite synchrone (dataRef.current cote useData). Ce test simule ce
// comportement de save() avec un `store` mutable, et prouve qu'aucune resurrection ne
// se produit. Si quelqu'un re-met la construction depuis la closure, ce test casse.

/* eslint-disable @typescript-eslint/no-explicit-any -- test de hook avec deps mockees */
/* eslint-disable react-hooks/rules-of-hooks -- useDossierActions est une factory pure (zero hook React interne), appelee directement en test unitaire */

import { describe, it, expect } from 'vitest';
import useDossierActions from '../useDossierActions';

// wLog reel append un log ; ici on garde data tel quel (le log n'est pas l'objet du test).
function wLogPass(data: any) { return data; }

function mkActions(initial: any, svImpl: any) {
  return useDossierActions({
    db: initial,
    sv: svImpl,
    wLog: wLogPass as any,
    nf: function () { /* noop */ },
    setMl: function () { /* noop */ },
    // Les listes derivees passees a la closure = etat INITIAL fige (comme React).
    dos: initial.dos,
    tcs: initial.tcs,
    dep: initial.dep,
    ml: null,
  } as any);
}

describe('useDossierActions - closure stale deletes (backlog E)', function () {

  it('deux deleteDos rapproches -> A ET B supprimes, aucune resurrection', function () {
    var A = { id: 'A', cl: 'CL', bl: 'bA' };
    var B = { id: 'B', cl: 'CL', bl: 'bB' };
    var C = { id: 'C', cl: 'CL', bl: 'bC' };
    var initial = {
      dos: [A, B, C],
      tcs: [{ id: 't1', did: 'A' }, { id: 't2', did: 'B' }],
      dep: [{ id: 'd1', did: 'A' }],
      logs: [],
    };
    // sv simule save() : resout l'updater contre la verite synchrone (store).
    var store: any = initial;
    var sv = function (param: any) {
      store = (typeof param === 'function') ? param(store) : param;
    };

    var actions = mkActions(initial, sv);
    actions.deleteDos('A');
    actions.deleteDos('B'); // closure dos = [A,B,C] mais l'updater lit store (deja sans A)

    var ids = store.dos.map(function (d: any) { return d.id; });
    expect(ids).toEqual(['C']);              // A et B partis, A PAS ressuscite
    expect(store.tcs.length).toBe(0);        // tcs des 2 dossiers propages
    expect(store.dep.length).toBe(0);        // depenses propagees
  });

  it('deleteDos simple -> retire le dossier + ses tcs + depenses', function () {
    var initial = {
      dos: [{ id: 'A', cl: 'CL', bl: 'bA' }, { id: 'B', cl: 'CL', bl: 'bB' }],
      tcs: [{ id: 't1', did: 'A' }, { id: 't2', did: 'B' }],
      dep: [{ id: 'd1', did: 'A' }],
      logs: [],
    };
    var store: any = initial;
    var sv = function (param: any) { store = (typeof param === 'function') ? param(store) : param; };

    mkActions(initial, sv).deleteDos('A');

    expect(store.dos.map(function (d: any) { return d.id; })).toEqual(['B']);
    expect(store.tcs.map(function (c: any) { return c.id; })).toEqual(['t2']);
    expect(store.dep.length).toBe(0);
  });

  it('bulkDeleteDos enchaine apres un deleteDos -> pas de resurrection croisee', function () {
    var initial = {
      dos: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
      tcs: [], dep: [], logs: [],
    };
    var store: any = initial;
    var sv = function (param: any) { store = (typeof param === 'function') ? param(store) : param; };

    var actions = mkActions(initial, sv);
    actions.deleteDos('A');
    actions.bulkDeleteDos(['B', 'C']); // doit partir de store (sans A), pas de la closure

    expect(store.dos.map(function (d: any) { return d.id; })).toEqual(['D']);
  });

});
