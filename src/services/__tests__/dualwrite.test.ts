// src/services/__tests__/dualwrite.test.ts
//
// Sprint 46 hotfix incident 2026-05-24 : barriere de regression sur la propagation
// des deletes par mirrorToSubcollections (Step 2). L'incident a montre que prevArr
// vide (prevSnapshot pre-hydratation ou closure figee a EMPTY) skip silencieusement
// le Step 2 -> 370 orphelins en sub, dual_write_errors=0.
//
// Ces tests mockent firebase/firestore pour valider la logique de detection des
// suppressions, sans dependance a l'emulateur ou a un network reel.
//
// NOTE : ces tests protegent le MIRROR (Step 2 logic), pas le sourcing de prev dans
// save(). Si quelqu'un re-met `prevSnapshot = data` dans useData.ts:save(), tous ces
// tests restent verts. La barriere CI pour beta est tracee en backlog G (extract
// resolvePrevSnapshot helper testable). Cf. CHANGELOG-AUDIT.md.

/* eslint-disable @typescript-eslint/no-explicit-any -- mocks vi.mock callbacks Firebase, types stricts inutiles ici */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mocks Firestore ------------------------------------------------------

var batchSetCalls: Array<{ ref: any; data: any }> = [];
var deleteDocCalls: Array<{ ref: any }> = [];
var batchCommitCalls = 0;

vi.mock('firebase/firestore', function () {
  return {
    collection: function (_db: any, ...parts: string[]) {
      return { _path: parts.join('/') };
    },
    doc: function (refOrDb: any, ...parts: string[]) {
      var basePath = refOrDb && refOrDb._path ? refOrDb._path + '/' : '';
      return { _path: basePath + parts.join('/') };
    },
    writeBatch: function (_db: any) {
      return {
        set: function (ref: any, data: any) { batchSetCalls.push({ ref: ref, data: data }); },
        commit: function () { batchCommitCalls++; return Promise.resolve(); },
      };
    },
    deleteDoc: function (ref: any) {
      deleteDocCalls.push({ ref: ref });
      return Promise.resolve();
    },
    addDoc: function () { return Promise.resolve({ id: 'mock' }); },
    serverTimestamp: function () { return 'mock-ts'; },
  };
});

vi.mock('firebase/auth', function () {
  return {
    getAuth: function () { return { currentUser: { uid: 'test-uid' } }; },
  };
});

// Import APRES les mocks
import { mirrorToSubcollections } from '../dualwrite';

// --- Helpers --------------------------------------------------------------

function mkDos(id: string, overrides: any = {}) {
  return Object.assign({ id: id, bl: 'BL-' + id, cl: 'CLIENT', st: 'ACTIF' }, overrides);
}

function reset() {
  batchSetCalls = [];
  deleteDocCalls = [];
  batchCommitCalls = 0;
}

describe('mirrorToSubcollections - propagation deletes (Step 2)', function () {

  beforeEach(function () { reset(); });

  it('chemin nominal : prev=[A,B,C] new=[A,B] -> 1 delete propage', async function () {
    var prev = { dos: [mkDos('A'), mkDos('B'), mkDos('C')], tcs: [], chs: [], dep: [], logs: [] };
    var next = { dos: [mkDos('A'), mkDos('B')], tcs: [], chs: [], dep: [], logs: [] };

    var stats = await mirrorToSubcollections({} as any, 'cid1', next, prev);

    expect(stats.ok).toBe(true);
    expect(stats.deleted).toBe(1);
    expect(stats.written).toBe(2);  // Step 1 ecrit A et B (set idempotent)
    expect(deleteDocCalls.length).toBe(1);
    expect(deleteDocCalls[0].ref._path).toContain('companies/cid1/dossiers/C');
    expect(stats.errors).toEqual([]);
    expect(batchCommitCalls).toBe(1);  // 1 seul batch commit (seule dos a des items)
  });

  it('cas border incident : prev={} new={} -> 0 delete, 0 write, 0 error', async function () {
    // Reproduit le scenario incident 2026-05-24 : prevSnapshot vide (pre-hydratation).
    // Le mirror NE DOIT PAS hurler (rien a faire), mais ne doit RIEN ecrire/supprimer.
    var prev = {};
    var next = {};

    var stats = await mirrorToSubcollections({} as any, 'cid1', next, prev);

    expect(stats.ok).toBe(true);
    expect(stats.deleted).toBe(0);
    expect(stats.written).toBe(0);
    expect(deleteDocCalls.length).toBe(0);
    expect(stats.errors).toEqual([]);
  });

  it('cas border 2 : prev={dos:[A,B]} new={dos:[]} -> 2 deletes (suppression totale)', async function () {
    var prev = { dos: [mkDos('A'), mkDos('B')], tcs: [], chs: [], dep: [], logs: [] };
    var next = { dos: [], tcs: [], chs: [], dep: [], logs: [] };

    var stats = await mirrorToSubcollections({} as any, 'cid1', next, prev);

    expect(stats.ok).toBe(true);
    expect(stats.deleted).toBe(2);
    expect(stats.written).toBe(0);  // pas d'items dans new.dos
    var deletedPaths = deleteDocCalls.map(function (c) { return c.ref._path; });
    expect(deletedPaths).toContain('companies/cid1/dossiers/A');
    expect(deletedPaths).toContain('companies/cid1/dossiers/B');
  });

  it('SANS prev : prev=undefined new=[A] -> 1 write, 0 delete (1er save d\'une session)', async function () {
    // Quand prev=undefined, le mirror ne fait QUE le Step 1 (write). Pas de delete
    // possible sans referentiel. C'est le cas du 1er save apres init.
    var next = { dos: [mkDos('A')], tcs: [], chs: [], dep: [], logs: [] };

    var stats = await mirrorToSubcollections({} as any, 'cid1', next);

    expect(stats.ok).toBe(true);
    expect(stats.written).toBe(1);
    expect(stats.deleted).toBe(0);
    expect(deleteDocCalls.length).toBe(0);
  });

  it('le drift silencieux (incident) : prev.dos vide ET new.dos vide ET sub avait des items -> 0 delete', async function () {
    // C'est EXACTEMENT le scenario qui a cause l'incident :
    // - prevSnapshot.dos = [] (closure figee a EMPTY)
    // - newData.dos = [] (user a tout supprime)
    // - sub conserve ses items historiques car prevArr.length === 0 dans Step 2
    //
    // Le mirror NE PEUT PAS le detecter sans referentiel externe. La barriere de
    // regression est cote save() (fix beta : prevSnapshot lu depuis Firestore).
    // Ce test documente le comportement pour qu'aucune regression future ne casse
    // l'invariant "si prevArr vide, on ne presume rien et on ne touche pas sub".
    var prev = { dos: [], tcs: [], chs: [], dep: [], logs: [] };
    var next = { dos: [], tcs: [], chs: [], dep: [], logs: [] };

    var stats = await mirrorToSubcollections({} as any, 'cid1', next, prev);

    expect(stats.ok).toBe(true);
    expect(stats.deleted).toBe(0);  // bien : on ne suppose rien
    expect(stats.errors).toEqual([]);
    // Note : ce comportement EST correct cote dualwrite. Le fix de l'incident est
    // a la source (useData.save() lit prev depuis Firestore, pas depuis React state).
  });

  it('propage les deletes sur tcs/chs/dep aussi, pas seulement dos', async function () {
    var prev = {
      dos: [], tcs: [mkDos('T1')], chs: [mkDos('C1'), mkDos('C2')], dep: [mkDos('D1')], logs: [],
    };
    var next = { dos: [], tcs: [], chs: [mkDos('C1')], dep: [], logs: [] };

    var stats = await mirrorToSubcollections({} as any, 'cid1', next, prev);

    expect(stats.deleted).toBe(3);  // T1, C2, D1
    var paths = deleteDocCalls.map(function (c) { return c.ref._path; }).sort();
    expect(paths).toContain('companies/cid1/chs/C2');
    expect(paths).toContain('companies/cid1/dep/D1');
    expect(paths).toContain('companies/cid1/tcs/T1');
  });

});
