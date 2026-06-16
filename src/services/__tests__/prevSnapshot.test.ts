// src/services/__tests__/prevSnapshot.test.ts
//
// Backlog G (Sprint 46 hotfix beta) : barriere CI sur la resolution du prevSnapshot.
// Couvre les 3 chemins de resolvePrevSnapshot, independamment du hook React :
//   - getDoc OK + exists      -> data Firestore (PAS le fallback)
//   - getDoc OK + exists=false -> fallback (jamais {})
//   - getDoc throw            -> fallback + log persistMirrorErrors
//   - timeout (2s)            -> fallback + log persistMirrorErrors (fake timers)
//
// C'est cette barriere qui manquait : si quelqu'un re-inline `prev = data` ou retire
// le sourcing Firestore, ces tests cassent (la logique est ici, plus dans save()).

/* eslint-disable @typescript-eslint/no-explicit-any -- mocks Firebase, types stricts inutiles ici */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mocks -----------------------------------------------------------------

var getDocImpl: any = function () {
  return Promise.resolve({ exists: function () { return false; }, data: function () { return {}; } });
};
var persistCalls: Array<{ companyId: string; errors: string[] }> = [];
var getDocsImpl: any = function () { return Promise.resolve({ forEach: function () {} }); };

vi.mock('firebase/firestore', function () {
  return {
    doc: function (_db: any, ...parts: string[]) { return { _path: parts.join('/') }; },
    getDoc: function (ref: any) { return getDocImpl(ref); },
    collection: function (_db: any, ...parts: string[]) { return { _path: parts.join('/') }; },
    getDocs: function (ref: any) { return getDocsImpl(ref); },
  };
});

vi.mock('../dualwrite', function () {
  return {
    persistMirrorErrors: function (_db: any, companyId: string, stats: any) {
      persistCalls.push({ companyId: companyId, errors: stats.errors });
      return Promise.resolve();
    },
    SUB_KEYS: ['dos', 'tcs', 'chs', 'dep', 'logs'],
    pathOf: function (k: string) { return k === 'dos' ? 'dossiers' : k; },
  };
});

// Import APRES les mocks
import { resolvePrevSnapshot, resolvePrevFromSub } from '../prevSnapshot';

function reset() {
  persistCalls = [];
  getDocImpl = function () {
    return Promise.resolve({ exists: function () { return false; }, data: function () { return {}; } });
  };
  getDocsImpl = function () { return Promise.resolve({ forEach: function () {} }); };
}

describe('resolvePrevSnapshot - sourcing prev fiable (backlog G)', function () {

  beforeEach(function () { reset(); vi.useRealTimers(); });

  it('getDoc OK + exists -> retourne data Firestore (pas le fallback)', async function () {
    var firestoreData = { dos: [{ id: 'A' }], tcs: [] };
    getDocImpl = function () {
      return Promise.resolve({ exists: function () { return true; }, data: function () { return firestoreData; } });
    };
    var fallback = { dos: [], tcs: [] };

    var res = await resolvePrevSnapshot({} as any, 'cid1', fallback);

    expect(res).toBe(firestoreData);     // verite Firestore, PAS le fallback
    expect(persistCalls.length).toBe(0); // aucun log d'erreur
  });

  it('getDoc OK mais exists=false -> retourne le fallback (jamais {})', async function () {
    var fallback = { dos: [{ id: 'X' }] };
    getDocImpl = function () {
      return Promise.resolve({ exists: function () { return false; }, data: function () { return undefined; } });
    };

    var res = await resolvePrevSnapshot({} as any, 'cid1', fallback);

    expect(res).toBe(fallback);
    expect(persistCalls.length).toBe(0);
  });

  it('getDoc throw -> retourne fallback + log persistMirrorErrors', async function () {
    var fallback = { dos: [{ id: 'Y' }] };
    getDocImpl = function () { return Promise.reject(new Error('firestore unreachable')); };

    var res = await resolvePrevSnapshot({} as any, 'cid1', fallback);

    expect(res).toBe(fallback);
    expect(persistCalls.length).toBe(1);
    expect(persistCalls[0].companyId).toBe('cid1');
    expect(persistCalls[0].errors[0]).toContain('prevRead/getDoc : firestore unreachable');
  });

  it('timeout (getDoc ne resout jamais) -> fallback + log apres 2s', async function () {
    vi.useFakeTimers();
    var fallback = { dos: [{ id: 'Z' }] };
    getDocImpl = function () { return new Promise(function () { /* jamais resolu */ }); };

    var p = resolvePrevSnapshot({} as any, 'cid1', fallback);
    await vi.advanceTimersByTimeAsync(2000);
    var res = await p;

    expect(res).toBe(fallback);
    expect(persistCalls.length).toBe(1);
    expect(persistCalls[0].errors[0]).toContain('prevRead/getDoc : getDoc-prev timeout');
  });

});

describe('resolvePrevFromSub - sourcing prev depuis sub (Phase C C2 / backlog Q)', function () {

  beforeEach(function () { reset(); vi.useRealTimers(); });

  it('getDocs OK -> assemble les 5 arrays depuis sub (pas le fallback)', async function () {
    var byPath: any = { dossiers: [{ id: 'A' }], tcs: [{ id: 'T' }], chs: [], dep: [], logs: [{ id: 'L' }] };
    getDocsImpl = function (ref: any) {
      var path = ref._path.split('/').pop();
      var docs = byPath[path] || [];
      return Promise.resolve({ forEach: function (cb: any) { docs.forEach(function (d: any) { cb({ data: function () { return d; } }); }); } });
    };
    var res: any = await resolvePrevFromSub({} as any, 'cid1', { dos: [] });
    expect(res.dos).toEqual([{ id: 'A' }]);
    expect(res.tcs).toEqual([{ id: 'T' }]);
    expect(res.chs).toEqual([]);
    expect(res.logs).toEqual([{ id: 'L' }]);
    expect(persistCalls.length).toBe(0);
  });

  it('sub vide -> {dos:[],...} (etat reel, PAS le fallback)', async function () {
    var fallback = { dos: [{ id: 'SHOULD_NOT_APPEAR' }] };
    var res: any = await resolvePrevFromSub({} as any, 'cid1', fallback);
    expect(res.dos).toEqual([]);
    expect(res).not.toBe(fallback);
    expect(persistCalls.length).toBe(0);
  });

  it('un getDocs throw -> Promise.all rejette -> fallback complet + log (all-or-nothing)', async function () {
    getDocsImpl = function (ref: any) {
      if (ref._path.indexOf('/dep') >= 0) return Promise.reject(new Error('rules denied dep'));
      return Promise.resolve({ forEach: function () {} });
    };
    var fallback = { dos: [{ id: 'FB' }] };
    var res = await resolvePrevFromSub({} as any, 'cid1', fallback);
    expect(res).toBe(fallback);
    expect(persistCalls.length).toBe(1);
    expect(persistCalls[0].errors[0]).toContain('prevReadSub/getDocs : rules denied dep');
  });

  it('timeout (getDocs ne resout jamais) -> fallback + log apres 2s', async function () {
    vi.useFakeTimers();
    getDocsImpl = function () { return new Promise(function () { /* jamais resolu */ }); };
    var fallback = { dos: [{ id: 'TO' }] };
    var p = resolvePrevFromSub({} as any, 'cid1', fallback);
    await vi.advanceTimersByTimeAsync(2000);
    var res = await p;
    expect(res).toBe(fallback);
    expect(persistCalls.length).toBe(1);
    expect(persistCalls[0].errors[0]).toContain('prevReadSub/getDocs : getDocs-prev-sub timeout');
  });

});
