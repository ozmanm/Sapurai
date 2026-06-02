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

vi.mock('firebase/firestore', function () {
  return {
    doc: function (_db: any, ...parts: string[]) { return { _path: parts.join('/') }; },
    getDoc: function (ref: any) { return getDocImpl(ref); },
  };
});

vi.mock('../dualwrite', function () {
  return {
    persistMirrorErrors: function (_db: any, companyId: string, stats: any) {
      persistCalls.push({ companyId: companyId, errors: stats.errors });
      return Promise.resolve();
    },
  };
});

// Import APRES les mocks
import { resolvePrevSnapshot } from '../prevSnapshot';

function reset() {
  persistCalls = [];
  getDocImpl = function () {
    return Promise.resolve({ exists: function () { return false; }, data: function () { return {}; } });
  };
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
