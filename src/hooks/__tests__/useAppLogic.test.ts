// Tests useAppLogic — F.1 filet avant refactor E (split du God-hook)
//
// CONVENTION IMPORTANTE
// Les tests ci-dessous encodent le comportement ACTUEL du code, pas le
// comportement ideal. Si un test est marque `// TODO: verifier si
// comportement correct`, c'est qu'au moment d'ecrire le test j'ai eu un
// doute sur la justesse du comportement. Au refactor E, relire ces TODO
// avant de valider.
//
// Le bug st→s sur Depense (revele en typant C.3) est la preuve que
// d'autres comportements bizarres peuvent etre caches ici. Ne pas
// assumer que "test vert = comportement correct".

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAppLogic from '../useAppLogic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupHook(initialDb: any = {}) {
  var saves: any[] = [];
  var mlCalls: any[] = [];
  var notifs: Array<{ to: string; msg: string }> = [];
  var db = Object.assign(
    { dos: [], tcs: [], chs: [], dep: [], logs: [], cfg: { fp: 10, ft: 23, fm: 20 } },
    initialDb
  );
  var result = renderHook(function () {
    return useAppLogic({
      db: db,
      sv: function (d: any) { saves.push(d); },
      ml: null,
      setMl: function (m: any) { mlCalls.push(m); },
      sendNotif: function (to: string, msg: string) { notifs.push({ to: to, msg: msg }); },
    });
  });
  return { hook: result.result, saves: saves, mlCalls: mlCalls, notifs: notifs };
}

// ---------------------------------------------------------------------------
// Smoke
// ---------------------------------------------------------------------------

describe('useAppLogic — smoke', function () {
  it('instancie le hook avec un db vide', function () {
    var s = setupHook();
    expect(s.hook.current).toBeDefined();
    expect(typeof s.hook.current.addDos).toBe('function');
    expect(typeof s.hook.current.dispatch).toBe('function');
    expect(typeof s.hook.current.closeDos).toBe('function');
    expect(typeof s.hook.current.toggleDepSt).toBe('function');
    expect(typeof s.hook.current.patchDos).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// toggleDepSt
// ---------------------------------------------------------------------------

describe('toggleDepSt', function () {
  // Post-refactor E : toggleDepSt applique le pattern return-value.
  // Au lieu d'appeler setMl en interne, il retourne { ok, needsPregate? }
  // que le caller (App.tsx) consomme pour decider de l'UI.
  //
  // Bug fix 2026-05-02 : le passage ATT -> PAYE ouvre maintenant un
  // window.prompt() pour demander le montant paye reel (peut differer du
  // mt initial). Les tests doivent mocker `window.prompt` pour simuler
  // la saisie d'un montant. Si prompt vide/cancel => return { ok: false }.

  it('bascule une depense ATT → PAYE (avec prompt montant)', function () {
    var promptSpy = vi.fn().mockReturnValue('1000'); vi.stubGlobal('prompt', promptSpy);
    var s = setupHook({
      dep: [{ id: 'f1', did: 'd1', tp: 'AUTRE', mt: 1000, s: 'ATT', dt: '2026-01-01' }],
    });
    var result: any;
    act(function () { result = s.hook.current.toggleDepSt('f1'); });
    expect(promptSpy).toHaveBeenCalled();
    expect(s.saves.length).toBe(1);
    expect(s.saves[0].dep[0].s).toBe('PAYE');
    expect(s.saves[0].dep[0].mt).toBe(1000);
    expect(s.saves[0].dep[0].status).toBe('payee');
    expect(result.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('bascule une depense PAYE → ATT (sans prompt, status -> a_payer)', function () {
    var s = setupHook({
      dep: [{ id: 'f1', did: 'd1', tp: 'AUTRE', mt: 1000, s: 'PAYE', dt: '2026-01-01' }],
    });
    act(function () { s.hook.current.toggleDepSt('f1'); });
    expect(s.saves[0].dep[0].s).toBe('ATT');
    expect(s.saves[0].dep[0].status).toBe('a_payer');
  });

  it('annule si prompt vide ou cancel (return ok:false, pas de save)', function () {
    var promptSpy = vi.fn().mockReturnValue(null); vi.stubGlobal('prompt', promptSpy);
    var s = setupHook({
      dep: [{ id: 'f1', did: 'd1', tp: 'AUTRE', mt: 1000, s: 'ATT', dt: '2026-01-01' }],
    });
    var result: any;
    act(function () { result = s.hook.current.toggleDepSt('f1'); });
    expect(s.saves.length).toBe(0);
    expect(result.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  it('retourne ok:false si la depense n\'existe pas (early return, pas de prompt)', function () {
    var promptSpy = vi.fn(); vi.stubGlobal('prompt', promptSpy);
    var s = setupHook({ dep: [{ id: 'f1', did: 'd1', s: 'ATT', mt: 100, tp: 'AUTRE', dt: '2026-01-01' }] });
    var result: any;
    act(function () { result = s.hook.current.toggleDepSt('inexistant'); });
    expect(s.saves.length).toBe(0);
    expect(result.ok).toBe(false);
    expect(promptSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('retourne needsPregate quand DPWORLD paye sans pn', function () {
    var promptSpy = vi.fn().mockReturnValue('1000'); vi.stubGlobal('prompt', promptSpy);
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CLIENT', st: 'ACTIF' }],
      dep: [{ id: 'f1', did: 'd1', tp: 'DPWORLD', mt: 1000, s: 'ATT', dt: '2026-01-01' }],
    });
    var result: any;
    act(function () { result = s.hook.current.toggleDepSt('f1'); });
    expect(result.ok).toBe(true);
    expect(result.needsPregate).toEqual({ did: 'd1' });
    // Le hook ne declenche PLUS setMl directement — App.tsx wrap et ouvre
    // la modale selon result.needsPregate
    expect(s.mlCalls.some(function (m: any) { return m && m.t === 'pregate'; })).toBe(false);
    vi.unstubAllGlobals();
  });

  it('retourne pas de needsPregate si pn est deja renseigne', function () {
    var promptSpy = vi.fn().mockReturnValue('1000'); vi.stubGlobal('prompt', promptSpy);
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CLIENT', st: 'ACTIF', pn: 'DO123' }],
      dep: [{ id: 'f1', did: 'd1', tp: 'DPWORLD', mt: 1000, s: 'ATT', dt: '2026-01-01' }],
    });
    var result: any;
    act(function () { result = s.hook.current.toggleDepSt('f1'); });
    expect(result.ok).toBe(true);
    expect(result.needsPregate).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// patchDos
// ---------------------------------------------------------------------------

describe('patchDos', function () {
  it('met a jour un seul champ', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CLIENT', st: 'ACTIF' }],
    });
    act(function () { s.hook.current.patchDos('d1', { bs: 'OBTENU' }); });
    var saved = s.saves[0];
    expect(saved.dos[0].bs).toBe('OBTENU');
    expect(saved.dos[0].bl).toBe('BL1'); // autres champs preserves
  });

  it('met a jour plusieurs champs en une fois', function () {
    var s = setupHook({ dos: [{ id: 'd1', cl: 'A', st: 'ACTIF' }] });
    act(function () { s.hook.current.patchDos('d1', { bs: 'OBTENU', bv: '2026-03-15' }); });
    var saved = s.saves[0];
    expect(saved.dos[0].bs).toBe('OBTENU');
    expect(saved.dos[0].bv).toBe('2026-03-15');
  });

  it('ne touche pas les autres dossiers', function () {
    var s = setupHook({
      dos: [
        { id: 'd1', cl: 'A', st: 'ACTIF' },
        { id: 'd2', cl: 'B', st: 'ACTIF', bs: 'EN_COURS' },
      ],
    });
    act(function () { s.hook.current.patchDos('d1', { bs: 'OBTENU' }); });
    var saved = s.saves[0];
    expect(saved.dos[0].bs).toBe('OBTENU');
    expect(saved.dos[1].bs).toBe('EN_COURS');
  });

  it('log l\'action MODIF_DOSSIER', function () {
    var s = setupHook({ dos: [{ id: 'd1', cl: 'A', bl: 'BL1', st: 'ACTIF' }] });
    act(function () { s.hook.current.patchDos('d1', { bs: 'OBTENU' }); });
    var saved = s.saves[0];
    var log = saved.logs[saved.logs.length - 1];
    expect(log.ac).toBe('MODIF_DOSSIER');
    expect(log.did).toBe('d1');
    expect(log.ds).toContain('bs');
  });
});

// ---------------------------------------------------------------------------
// closeDos
// ---------------------------------------------------------------------------

describe('closeDos', function () {
  it('passe le statut a CLOTURE', function () {
    var s = setupHook({ dos: [{ id: 'd1', cl: 'A', bl: 'BL1', st: 'ACTIF' }] });
    act(function () { s.hook.current.closeDos('d1'); });
    var saved = s.saves[0];
    expect(saved.dos[0].st).toBe('CLOTURE');
  });

  it('log l\'action CLOTURE', function () {
    var s = setupHook({ dos: [{ id: 'd1', cl: 'A', bl: 'BL1', st: 'ACTIF' }] });
    act(function () { s.hook.current.closeDos('d1'); });
    var saved = s.saves[0];
    var log = saved.logs[saved.logs.length - 1];
    expect(log.ac).toBe('CLOTURE');
    expect(log.did).toBe('d1');
  });

  it('ne cascade pas les TCs en RETURNED', function () {
    // TODO: verifier si comportement correct — closeDos manuel ne modifie
    // pas le statut des TCs. L'auto-cloture dans advance() le fait quand
    // tous les TCs passent RETURNED. Incoherence possible a clarifier.
    var s = setupHook({
      dos: [{ id: 'd1', cl: 'A', st: 'ACTIF' }],
      tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '20GP', po: 1000, st: 'BAMAKO' }],
    });
    act(function () { s.hook.current.closeDos('d1'); });
    var saved = s.saves[0];
    expect(saved.tcs[0].st).toBe('BAMAKO');
  });

  it('ne touche pas les autres dossiers', function () {
    var s = setupHook({
      dos: [
        { id: 'd1', st: 'ACTIF' },
        { id: 'd2', st: 'ACTIF' },
      ],
    });
    act(function () { s.hook.current.closeDos('d1'); });
    var saved = s.saves[0];
    expect(saved.dos[0].st).toBe('CLOTURE');
    expect(saved.dos[1].st).toBe('ACTIF');
  });
});

// ---------------------------------------------------------------------------
// addDos
// ---------------------------------------------------------------------------

describe('addDos', function () {
  var nf = vi.fn();

  it('cree un dossier avec tokId et status INITIALISE', function () {
    var s = setupHook({});
    act(function () { s.hook.current.addDos({ cl: 'CLIENT', bl: 'BL123' }, []); });
    var saved = s.saves[0];
    expect(saved.dos.length).toBe(1);
    expect(saved.dos[0].cl).toBe('CLIENT');
    expect(saved.dos[0].bl).toBe('BL123');
    expect(saved.dos[0].st).toBe('INITIALISE');
    expect(typeof saved.dos[0].tokId).toBe('string');
    expect(saved.dos[0].tokId.length).toBeGreaterThanOrEqual(10);
  });

  it('cree les TCs associes au dossier', function () {
    var s = setupHook({});
    act(function () {
      s.hook.current.addDos(
        { cl: 'CLIENT', bl: 'BL1' },
        [{ n: 'TC1', ty: '20GP', po: 1000 }, { n: 'TC2', ty: '40HC', po: 2000 }]
      );
    });
    var saved = s.saves[0];
    expect(saved.tcs.length).toBe(2);
    expect(saved.tcs[0].n).toBe('TC1');
    expect(saved.tcs[0].did).toBe(saved.dos[0].id);
    expect(saved.tcs[1].n).toBe('TC2');
  });

  it('met les TCs en ATTENDU si date arrivee future', function () {
    // Date dans 30 jours
    var future = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
    var s = setupHook({});
    act(function () {
      s.hook.current.addDos({ cl: 'CL', bl: 'BL1', da: future }, [{ n: 'TC1', ty: '20GP', po: 1000 }]);
    });
    var saved = s.saves[0];
    expect(saved.tcs[0].st).toBe('ATTENDU');
  });

  it('met les TCs en PORT si date arrivee passee ou aujourd\'hui', function () {
    var s = setupHook({});
    act(function () {
      s.hook.current.addDos({ cl: 'CL', bl: 'BL1', da: '2020-01-01' }, [{ n: 'TC1', ty: '20GP', po: 1000 }]);
    });
    var saved = s.saves[0];
    expect(saved.tcs[0].st).toBe('PORT');
  });

  it('bloque la creation si le BL existe deja (nf error + pas de save)', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'EXISTING', st: 'ACTIF' }],
    });
    act(function () { s.hook.current.addDos({ cl: 'NEW', bl: 'BL1' }, []); });
    expect(s.saves.length).toBe(0);
  });

  it('bloque aussi si BL en casse differente (case-insensitive)', function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'bl1', cl: 'EXISTING', st: 'ACTIF' }],
    });
    act(function () { s.hook.current.addDos({ cl: 'NEW', bl: 'BL1' }, []); });
    expect(s.saves.length).toBe(0);
  });

  it('dedupe les TCs dont le numero existe deja', function () {
    var s = setupHook({
      tcs: [{ id: 't1', did: 'dX', n: 'TC1', ty: '20GP', po: 500, st: 'PORT' }],
    });
    act(function () {
      s.hook.current.addDos(
        { cl: 'CL', bl: 'BL1' },
        [{ n: 'TC1', ty: '20GP', po: 1000 }, { n: 'TC2', ty: '40HC', po: 2000 }]
      );
    });
    var saved = s.saves[0];
    // TC1 existe deja, TC2 devrait etre le seul ajoute
    var newTcs = saved.tcs.filter(function (t: any) { return t.did === saved.dos[0].id; });
    expect(newTcs.length).toBe(1);
    expect(newTcs[0].n).toBe('TC2');
  });

  it('accepte un dossier sans TCs', function () {
    var s = setupHook();
    act(function () { s.hook.current.addDos({ cl: 'CL', bl: 'BL1' }, []); });
    var saved = s.saves[0];
    expect(saved.dos.length).toBe(1);
    expect(saved.tcs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

describe('dispatch', function () {
  var dosActif = { id: 'd1', cl: 'CLIENT', bl: 'BL1', st: 'INITIALISE', pn: 'DO123' };
  var tcPort = { id: 't1', did: 'd1', n: 'TC1', ty: '20GP', po: 1000, st: 'PORT' };
  var chauffeur = { nm: 'MOUSSA', cm: 'AA-123-BB', tl: '221771234567' };

  it('passe le TC en DISPATCHE avec chauffeur et camion', function () {
    var s = setupHook({ dos: [dosActif], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    var saved = s.saves[0];
    var tc = saved.tcs[0];
    expect(tc.st).toBe('DISPATCHE');
    expect(tc.ch).toBe('MOUSSA');
    expect(tc.cm).toBe('AA-123-BB');
    expect(tc.dsp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('bloque si ni pn ni BAE obtenu (nf error)', function () {
    var dosBloque = { id: 'd1', cl: 'CL', bl: 'BL1', st: 'INITIALISE' }; // pas de pn, pas de as2
    var s = setupHook({ dos: [dosBloque], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    expect(s.saves.length).toBe(0);
  });

  it('autorise si BAE OBTENU sans pn', function () {
    var dosBAE = { id: 'd1', cl: 'CL', bl: 'BL1', st: 'INITIALISE', as2: 'OBTENU' };
    var s = setupHook({ dos: [dosBAE], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    expect(s.saves.length).toBe(1);
  });

  it('cree une depense TRANSPORT si avance > 0', function () {
    var s = setupHook({ dos: [dosActif], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 50000, 0); });
    var saved = s.saves[0];
    expect(saved.dep.length).toBe(1);
    expect(saved.dep[0].tp).toBe('TRANSPORT');
    expect(saved.dep[0].mt).toBe(50000);
    expect(saved.dep[0].s).toBe('ATT');
    expect(saved.dep[0].ph).toBe('AVANCE_DK');
    expect(saved.dep[0].tcid).toBe('t1');
  });

  it('ne cree pas de depense si avance = 0', function () {
    var s = setupHook({ dos: [dosActif], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    var saved = s.saves[0];
    expect(saved.dep.length).toBe(0);
  });

  it('enregistre budget et prixConvenu sur le TC', function () {
    var s = setupHook({ dos: [dosActif], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 100000, undefined, 90000); });
    var saved = s.saves[0];
    expect(saved.tcs[0].budget).toBe(100000);
    expect(saved.tcs[0].pc).toBe(90000);
  });

  it('fait monter le dossier INITIALISE → EN_TRANSIT', function () {
    var s = setupHook({ dos: [dosActif], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    var saved = s.saves[0];
    expect(saved.dos[0].st).toBe('EN_TRANSIT');
  });

  it('fait monter le dossier SECURISE → EN_TRANSIT', function () {
    var s = setupHook({ dos: [Object.assign({}, dosActif, { st: 'SECURISE' })], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    var saved = s.saves[0];
    expect(saved.dos[0].st).toBe('EN_TRANSIT');
  });

  it('ne change pas le statut dossier si deja EN_TRANSIT', function () {
    var s = setupHook({ dos: [Object.assign({}, dosActif, { st: 'EN_TRANSIT' })], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    var saved = s.saves[0];
    expect(saved.dos[0].st).toBe('EN_TRANSIT');
  });

  it('log l\'action DISPATCH', function () {
    var s = setupHook({ dos: [dosActif], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0); });
    var saved = s.saves[0];
    var log = saved.logs[saved.logs.length - 1];
    expect(log.ac).toBe('DISPATCH');
    expect(log.ds).toContain('TC1');
    expect(log.ds).toContain('MOUSSA');
  });

  it('utilise la dspDate fournie si presente', function () {
    var s = setupHook({ dos: [dosActif], tcs: [tcPort] });
    act(function () { s.hook.current.dispatch('t1', chauffeur, 0, 0, '2026-01-15'); });
    var saved = s.saves[0];
    expect(saved.tcs[0].dsp).toBe('2026-01-15');
  });
});
