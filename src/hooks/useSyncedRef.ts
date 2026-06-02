// src/hooks/useSyncedRef.ts
//
// Backlog N (Sprint 46 hotfix beta) : primitive extraite du fix E (closure stale).
// Synchronise un ref sur une valeur React a chaque changement (via useEffect). Permet
// de tester le mecanisme "le ref suit la data externe (push onSnapshot d'un autre poste)"
// SANS monter le hook useData entier (auth + companyId + 5 listeners imbriques). Verrouille
// l'ex-ligne 37 de useData.ts. Si ce useEffect disparait, le ref ne se resynchronise plus
// sur les pushes externes -> resurrection "data pushee ailleurs" -> useSyncedRef.test casse.

import { useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';

/**
 * Retourne un ref dont `.current` est resynchronise sur `value` apres chaque render ou
 * `value` change. Sert a exposer la derniere valeur connue a du code qui tourne hors
 * cycle de render (closures, callbacks asynchrones, updater de save()).
 *
 * Note d'equivalence : init a `value` (et non `null`). Comme l'appelant part typiquement
 * d'un state `null` (`useState<any>(null)`), `.current` vaut `null` au mount dans les deux
 * cas -> equivalence stricte avec l'ancien `useRef(null)` + `useEffect`.
 */
export function useSyncedRef<T>(value: T): MutableRefObject<T> {
  var ref = useRef<T>(value);
  useEffect(function () { ref.current = value; }, [value]);
  return ref;
}
