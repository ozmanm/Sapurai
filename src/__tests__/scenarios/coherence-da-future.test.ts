/**
 * Sprint 40 F40.7 - Scenario regression : cas reel "BUILDERS MALI SARL"
 *
 * Date du test : 15/05/2026
 * Dossier observe : BL `LHV3990909`, `da = 30/05/2026` (futur, +15j)
 * TC observes : marques DISPATCHE alors que le navire n'est pas arrive.
 * Statut dossier observe : EN_TRANSIT (faux : impossible si da future).
 *
 * Ce test garantit que ce scenario ne peut plus se reproduire :
 *  1. canDispatchTc refuse un dispatch sur dossier avec da future
 *  2. canAdvanceTc refuse PORT/DISPATCHE si da future
 *  3. deriveDossierStatus force INITIALISE si da future, peu importe tc.st
 *  4. reconcileDossierState retrograde les TC incoherents en ATTENDU
 */

import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { setupScenario, getTcStatus, getDosStatus, daysAgo } from './helpers';
import { canDispatchTc, canAdvanceTc, deriveDossierStatus, reconcileDossierState } from '../../domain/invariants';

function daysFromToday(n: number): string {
  var d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('Scenario coherence date arrivee future', () => {
  describe('Invariants metier (purs)', () => {
    it('canDispatchTc refuse si da future', () => {
      var dos = { id: 'd1', bl: 'BL1', cl: 'CL', st: 'INITIALISE', td: 'IMPORT', da: daysFromToday(15), as2: 'OBTENU' } as any;
      var tc = { id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'PORT' } as any;
      var r = canDispatchTc(tc, dos);
      expect(r.ok).toBe(false);
      expect(r.reason).toContain('futur');
    });

    it('canAdvanceTc refuse ATTENDU -> PORT si da future', () => {
      var dos = { id: 'd1', bl: 'BL1', cl: 'CL', st: 'INITIALISE', td: 'IMPORT', da: daysFromToday(15) } as any;
      var tc = { id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'ATTENDU' } as any;
      var r = canAdvanceTc(tc, dos, 'PORT');
      expect(r.ok).toBe(false);
      expect(r.reason).toContain('futur');
    });

    it('deriveDossierStatus force INITIALISE si da future (cas reel BUILDERS MALI)', () => {
      var dos = { id: 'd1', bl: 'LHV3990909', cl: 'BUILDERS MALI SARL', st: 'EN_TRANSIT', td: 'IMPORT', da: '2026-05-30' } as any;
      var tcs = [
        { id: 't1', did: 'd1', n: 'CAIU9404690', ty: '20GP', st: 'DISPATCHE', dsp: '2026-05-10' } as any,
      ];
      // Today : 2026-05-15 (fixe pour ce test, sinon depend du jour reel)
      // Comme on ne peut pas mock Date facilement, on prend une da clairement future
      var dosFuture = Object.assign({}, dos, { da: daysFromToday(15) });
      expect(deriveDossierStatus(dosFuture, tcs)).toBe('INITIALISE');
    });
  });

  describe('Integration via hook (E2E)', () => {
    it('le bouton Dispatch sur un TC dont le dossier a da future est refuse', () => {
      // Note : useAppLogic a un useEffect qui retrograde PORT -> ATTENDU si
      // da future au mount. Donc le TC sera ATTENDU au moment de dispatch.
      // canDispatchTc refusera (tc.st !== 'PORT' ET da future).
      var s = setupScenario({
        dos: [{
          id: 'd1', bl: 'LHV3990909', cl: 'BUILDERS MALI SARL',
          st: 'INITIALISE', td: 'IMPORT',
          da: daysFromToday(15),  // da future
          as2: 'OBTENU',
        }],
        tcs: [{ id: 't1', did: 'd1', n: 'CAIU9404690', ty: '20GP', st: 'PORT' }],
        chs: [{ id: 'ch1', nm: 'TEST', cm: 'AA-111-BB', tty: ['20GP'] }],
      });
      // Apres mount : useEffect a deja retrograde le TC en ATTENDU
      s.rerender();
      expect((s.getDb().tcs as any[]).find(function (t: any) { return t.id === 't1'; }).st).toBe('ATTENDU');

      var savesBefore = s.saves.length;
      act(function () {
        s.hook.current.dispatch('t1', { id: 'ch1', nm: 'TEST', cm: 'AA-111-BB' }, 0, 0, daysAgo(1));
      });
      s.rerender();

      // Dispatch refuse : pas de nouveau save
      expect(s.saves.length).toBe(savesBefore);
      // TC reste ATTENDU
      expect((s.getDb().tcs as any[]).find(function (t: any) { return t.id === 't1'; }).st).toBe('ATTENDU');
    });

    it('advance ATTENDU -> PORT refuse si da future', () => {
      var s = setupScenario({
        dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'INITIALISE', td: 'IMPORT', da: daysFromToday(10) }],
        tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'ATTENDU' }],
      });

      var savesBefore = s.saves.length;
      act(function () {
        s.hook.current.advance('t1', 'PORT');
      });
      s.rerender();

      expect(s.saves.length).toBe(savesBefore);
      expect(getTcStatus(s.saves, 't1')).toBeUndefined();  // pas de save donc undefined
    });

    it('advance PORT -> DISPATCHE refuse si da future', () => {
      var s = setupScenario({
        dos: [{
          id: 'd1', bl: 'BL1', cl: 'CL', st: 'SECURISE', td: 'IMPORT',
          da: daysFromToday(10), as2: 'OBTENU',
        }],
        tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'PORT' }],
      });

      var savesBefore = s.saves.length;
      act(function () {
        s.hook.current.advance('t1', 'DISPATCHE');
      });
      s.rerender();

      expect(s.saves.length).toBe(savesBefore);
    });
  });

  describe('Reconciliation des donnees existantes incoherentes', () => {
    it('cas reel : da future + TC dispatches -> reconcile force INITIALISE + retrograde TC', () => {
      var dos = [{ id: 'd1', bl: 'LHV3990909', cl: 'BUILDERS MALI', st: 'EN_TRANSIT', td: 'IMPORT', da: daysFromToday(15) } as any];
      var tcs = [
        { id: 't1', did: 'd1', n: 'CAIU9404690', ty: '20GP', st: 'DISPATCHE', dsp: '2026-05-10' } as any,
        { id: 't2', did: 'd1', n: 'TLLU8015019', ty: '20GP', st: 'DISPATCHE', dsp: '2026-05-10' } as any,
        { id: 't3', did: 'd1', n: 'GESU6346166', ty: '20GP', st: 'PORT' } as any,
      ];

      var res = reconcileDossierState(dos, tcs);

      // Dossier reconcilie en INITIALISE
      expect(res.dos[0].st).toBe('INITIALISE');
      // Tous les TC retrogrades en ATTENDU + dates nettoyees
      expect(res.tcs[0].st).toBe('ATTENDU');
      expect(res.tcs[0].dsp).toBeUndefined();
      expect(res.tcs[1].st).toBe('ATTENDU');
      expect(res.tcs[2].st).toBe('ATTENDU');
    });
  });
});
