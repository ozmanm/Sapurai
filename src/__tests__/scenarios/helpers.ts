/**
 * Sprint 39 - Helpers communs aux tests de scenarios metier E2E.
 *
 * setupScenario(initialDb?) retourne :
 *   - hook : reference du resultat de useAppLogic
 *   - saves : tableau ordonne des appels a sv()
 *   - modals : tableau ordonne des appels a setMl()
 *   - getDb() : etat courant du db (mis a jour apres chaque save)
 *   - rerender() : force un re-render avec le db courant
 *
 * Pattern d'utilisation :
 *   act(() => s.hook.current.X());
 *   s.rerender();
 *   act(() => s.hook.current.Y());
 *   s.rerender();
 *
 * Note : on doit explicitement appeler `rerender()` apres chaque action car
 * useAppLogic n'observe pas Firestore, il prend `db` en prop. Le rerender
 * propage le dernier save dans le hook pour la prochaine action.
 */

import { renderHook } from '@testing-library/react';
import useAppLogic from '../../hooks/useAppLogic';

export function setupScenario(initialDb: any = {}) {
  var saves: any[] = [];
  var modals: any[] = [];

  var currentDb: any = Object.assign(
    {
      dos: [],
      tcs: [],
      chs: [],
      dep: [],
      logs: [],
      cfg: { fp: 10, ft: 23, fm: 20, ts: 25000 },
    },
    initialDb,
  );

  function makeProps() {
    return {
      db: currentDb,
      sv: function (d: any) { currentDb = d; saves.push(d); },
      ml: null,
      setMl: function (m: any) { modals.push(m); },
      sendNotif: function () { /* noop */ },
    } as any;
  }

  var result = renderHook(function (props: any) { return useAppLogic(props); }, {
    initialProps: makeProps(),
  });

  return {
    hook: result.result,
    saves: saves,
    modals: modals,
    lastSave: function () { return saves[saves.length - 1]; },
    lastModal: function () { return modals[modals.length - 1]; },
    getDb: function () { return currentDb; },
    rerender: function () { result.rerender(makeProps()); },
  };
}

/**
 * Retourne le statut courant d'un TC dans le dernier snapshot save.
 */
export function getTcStatus(saves: any[], tcid: string): string | undefined {
  var last = saves[saves.length - 1];
  if (!last || !last.tcs) return undefined;
  var tc = last.tcs.find(function (t: any) { return t.id === tcid; });
  return tc ? tc.st : undefined;
}

/**
 * Retourne le statut courant d'un dossier dans le dernier snapshot save.
 */
export function getDosStatus(saves: any[], dosId: string): string | undefined {
  var last = saves[saves.length - 1];
  if (!last || !last.dos) return undefined;
  var d = last.dos.find(function (x: any) { return x.id === dosId; });
  return d ? d.st : undefined;
}

/**
 * Date ISO simple (YYYY-MM-DD) pour les tests.
 */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

export function today(): string {
  return isoDate(new Date());
}
