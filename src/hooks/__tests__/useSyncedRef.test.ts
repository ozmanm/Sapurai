// src/hooks/__tests__/useSyncedRef.test.ts
//
// Backlog N (Sprint 46 hotfix beta) : verrouille l'ex-ligne 37 de useData.ts (sync du ref
// sur la data externe / push onSnapshot d'un autre poste). Si le `useEffect([value])`
// disparait a un futur refactor, le ref ne suit plus les pushes externes -> un save local
// qui suit verrait l'etat pre-push -> resurrection. Ce test casse alors. C'est le 2e mode
// de regression de E, celui que les 3 tests useDossierActions (qui mockent save) ne voient pas.

/* eslint-disable @typescript-eslint/no-explicit-any -- valeurs de test arbitraires */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSyncedRef } from '../useSyncedRef';

describe('useSyncedRef - ref synchronise sur valeur React (backlog N)', function () {

  it('init : ref.current = valeur initiale', function () {
    var r = renderHook(function (props: any) { return useSyncedRef(props.v); }, {
      initialProps: { v: { dos: ['A'] } },
    });
    expect(r.result.current.current).toEqual({ dos: ['A'] });
  });

  it('rerender avec nouvelle valeur -> ref.current suit (chemin onSnapshot externe)', function () {
    var r = renderHook(function (props: any) { return useSyncedRef(props.v); }, {
      initialProps: { v: { dos: ['A'] } },
    });
    var pushed = { dos: ['A', 'B'] };          // simule un push Firestore depuis un autre poste
    r.rerender({ v: pushed });
    expect(r.result.current.current).toBe(pushed);
  });

  it('init null (pre-hydratation) -> ref.current null, puis suit l hydratation', function () {
    var r = renderHook(function (props: any) { return useSyncedRef(props.v); }, {
      initialProps: { v: null as any },
    });
    expect(r.result.current.current).toBe(null);
    var hydrated = { dos: [] };
    r.rerender({ v: hydrated });
    expect(r.result.current.current).toBe(hydrated);
  });

});
