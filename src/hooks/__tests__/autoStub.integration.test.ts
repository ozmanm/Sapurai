// Tests F.2 — integration auto-stub Depenses via useAppLogic
//
// Verifie le flow bout-en-bout :
//  - patchDos avec nouvelle date arrivee => stubs crees
//  - editDos idem
//  - ignoreDep soft-delete fonctionne et empeche re-stub
//  - toggleDepSt sur un stub en attente passe a PAYE

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAppLogic from '../useAppLogic';

function setupHook(initialDb: any = {}) {
  var saves: any[] = [];
  var db = Object.assign(
    { dos: [], tcs: [], chs: [], dep: [], logs: [], cfg: { fp: 10, ft: 23, fm: 20 } },
    initialDb,
  );
  var result = renderHook(function () {
    return useAppLogic({
      db: db,
      sv: function (d: any) { saves.push(d); },
      ml: null,
      setMl: function () { /* noop */ },
      sendNotif: function () { /* noop */ },
    });
  });
  return { hook: result.result, saves: saves };
}

describe('patchDos + auto-stub integration', function () {
  it('patchDos(da) sur dossier sans da declenche les stubs', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', besc: true }],
      dep: [],
    });

    act(function () {
      s.hook.current.patchDos('d1', { da: '2026-04-10' });
    });

    expect(s.saves.length).toBe(1);
    var dep = s.saves[0].dep;
    expect(dep.length).toBeGreaterThan(0);
    var cats = dep.map(function (d: any) { return d.categorie; });
    expect(cats).toContain('compagnie_location');
    expect(cats).toContain('orbus');
    expect(cats).toContain('dpworld');
    expect(cats).toContain('besc');
  });

  it('patchDos sur dossier qui a deja une da ne declenche pas de stubs', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', da: '2026-01-01' }],
      dep: [],
    });

    act(function () {
      s.hook.current.patchDos('d1', { bs: 'OBTENU' });
    });

    expect(s.saves[0].dep).toEqual([]);
  });

  it('patchDos TRANSIT sans garantie permanente inclut caution + lettre_garantie', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'TRANSIT', gr: 'LOUEE' }],
      dep: [],
    });

    act(function () {
      s.hook.current.patchDos('d1', { da: '2026-04-10' });
    });

    var cats = s.saves[0].dep.map(function (d: any) { return d.categorie; });
    expect(cats).toContain('caution');
    expect(cats).toContain('lettre_garantie');
  });

  it('patchDos TRANSIT avec garantie permanente n inclut PAS caution', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'TRANSIT', gr: 'PERMANENTE' }],
      dep: [],
    });

    act(function () {
      s.hook.current.patchDos('d1', { da: '2026-04-10' });
    });

    var cats = s.saves[0].dep.map(function (d: any) { return d.categorie; });
    expect(cats).not.toContain('caution');
    expect(cats).not.toContain('lettre_garantie');
  });
});

describe('editDos + auto-stub integration', function () {
  it('editDos avec f.da nouveau declenche les stubs', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT' }],
      tcs: [],
      dep: [],
    });

    act(function () {
      s.hook.current.editDos('d1', { cl: 'CL', bl: 'BL1', da: '2026-04-10', td: 'IMPORT', besc: false }, []);
    });

    expect(s.saves.length).toBe(1);
    var cats = s.saves[0].dep.map(function (d: any) { return d.categorie; });
    expect(cats).toContain('compagnie_location');
    expect(cats).not.toContain('besc');
  });
});

describe('ignoreDep — soft-delete', function () {
  it('marque la Depense ignored=true sans la supprimer', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      dep: [{ id: 'dep1', did: 'd1', tp: 'DPWORLD', mt: 0, dt: '2026-04-10', status: 'en_attente_facture', auto: true, categorie: 'dpworld' }],
    });

    act(function () {
      s.hook.current.ignoreDep('dep1');
    });

    expect(s.saves.length).toBe(1);
    var dep = s.saves[0].dep;
    expect(dep.length).toBe(1);
    expect(dep[0].ignored).toBe(true);
    expect(dep[0].id).toBe('dep1');
  });

  it('un stub ignored empeche le re-stub au prochain patchDos', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT' }],
      dep: [{ id: 'ignored1', did: 'd1', tp: 'DPWORLD', mt: 0, dt: '2026-03-01', categorie: 'dpworld', ignored: true }],
    });

    act(function () {
      s.hook.current.patchDos('d1', { da: '2026-04-10' });
    });

    var cats = s.saves[0].dep.filter(function (d: any) { return !d.ignored; }).map(function (d: any) { return d.categorie; });
    expect(cats).not.toContain('dpworld'); // pas re-stub grace a l'ignored existant
  });
});

describe('Depense stub status flow', function () {
  it('toggleDepSt sur une depense en_attente_facture passe a PAYE (avec prompt montant)', function () {
    // Bug fix 2026-05-02 : toggleDepSt ATT->PAYE demande le montant via prompt.
    // On mock pour simuler la saisie.
    var promptSpy = vi.fn().mockReturnValue('1000'); vi.stubGlobal('prompt', promptSpy);
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      dep: [{ id: 'dep1', did: 'd1', tp: 'DPWORLD', mt: 1000, dt: '2026-04-10', status: 'en_attente_facture', s: 'ATT', auto: true, categorie: 'dpworld' }],
    });

    act(function () {
      s.hook.current.toggleDepSt('dep1');
    });

    var dep = s.saves[0].dep[0];
    expect(dep.s).toBe('PAYE');
    expect(dep.status).toBe('payee');
    expect(dep.mt).toBe(1000);
    vi.unstubAllGlobals();
  });
});
