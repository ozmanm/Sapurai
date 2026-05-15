/**
 * Sprint 39 - Scenario E2E : workflow nominal complet
 *
 * Trace un dossier IMPORT typique de bout en bout :
 *   1. Setup dossier IMPORT + 1 TC PORT + BAE obtenu (prerequis dispatch)
 *   2. Arrivee navire (patchDos da) -> auto-stub Depenses
 *   3. Dispatch TC (PORT -> DISPATCHE) avec chauffeur complet
 *   4. Transit (DISPATCHE -> TRANSIT)
 *   5. Arrivee Bamako (TRANSIT -> BAMAKO)
 *   6. Retour vide (BAMAKO -> RETURNED) - sans depassement franchise
 *   7. Cloture auto du dossier
 *
 * Note : `dispatch` requiert BAE obtenu (d.as2 === 'OBTENU') OU Pregate (d.pn === true).
 * `applyAutoStatus` calcule INITIALISE / SECURISE / EN_TRANSIT pour le statut dossier ;
 * la cloture finale est posee dans `advance` quand tous les TC passent RETURNED
 * (sauf si detention > franchise retour vide).
 */

import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { setupScenario, getTcStatus, getDosStatus, daysAgo, today } from './helpers';

var CHAUFFEUR = { id: 'ch1', nm: 'AMADOU DIOP', cm: 'AB-123-CD', tl: '+221700000000', pm: 28000, tty: ['20GP', '40GP', '40HC'] };

describe('Scenario workflow nominal IMPORT', () => {
  it('chaine arrivee -> dispatch -> bamako -> retour -> cloture sans accroc', () => {
    var s = setupScenario({
      dos: [{
        id: 'd1', bl: 'BL001', cl: 'CLIENT-TEST', cp: 'MAERSK',
        st: 'ACTIF', td: 'IMPORT', besc: true,
        as2: 'OBTENU',  // BAE obtenu => dispatch autorise
        // Franchise retour vide large pour ne pas declencher detention dans ce scenario
        frRt: 30,
      }],
      tcs: [{
        id: 't1', did: 'd1', n: 'MSDU1234567', ty: '40HC', st: 'PORT',
      }],
      chs: [CHAUFFEUR],
    });

    // Etape 1 : arrivee navire (da posee il y a 5 jours)
    act(function () {
      s.hook.current.patchDos('d1', { da: daysAgo(5) });
    });
    s.rerender();
    var save1 = s.lastSave();
    expect(save1.dep.length).toBeGreaterThan(0);
    var stubCats = save1.dep.map(function (d: any) { return d.categorie; });
    expect(stubCats).toContain('dpworld');
    expect(save1.dep.every(function (d: any) { return d.auto === true; })).toBe(true);

    // Etape 2 : dispatch TC (PORT -> DISPATCHE)
    // Signature : dispatch(tid, ch, avance, budget, dspDate, prixConvenu?, newChData?)
    act(function () {
      s.hook.current.dispatch('t1', CHAUFFEUR, 0, 0, daysAgo(3));
    });
    s.rerender();
    expect(getTcStatus(s.saves, 't1')).toBe('DISPATCHE');
    var tcAfterDisp = s.lastSave().tcs.find(function (t: any) { return t.id === 't1'; });
    expect(tcAfterDisp.dsp).toBe(daysAgo(3));
    expect(tcAfterDisp.ch).toBe('AMADOU DIOP');

    // Etape 3 : transit (DISPATCHE -> TRANSIT)
    act(function () {
      s.hook.current.advance('t1', 'TRANSIT', daysAgo(2));
    });
    s.rerender();
    expect(getTcStatus(s.saves, 't1')).toBe('TRANSIT');

    // Etape 4 : arrivee Bamako (TRANSIT -> BAMAKO)
    act(function () {
      s.hook.current.advance('t1', 'BAMAKO', daysAgo(1));
    });
    s.rerender();
    expect(getTcStatus(s.saves, 't1')).toBe('BAMAKO');
    var tcAfterBamako = s.lastSave().tcs.find(function (t: any) { return t.id === 't1'; });
    expect(tcAfterBamako.dab).toBe(daysAgo(1));

    // Etape 5 : retour vide aujourd'hui, dsp = daysAgo(3) => detention = 4j < frRt 30j => OK
    act(function () {
      s.hook.current.advance('t1', 'RETURNED', today());
    });
    s.rerender();
    expect(getTcStatus(s.saves, 't1')).toBe('RETURNED');

    // Etape 6 : cloture auto puisque tous les TC RETURNED et detention OK
    expect(getDosStatus(s.saves, 'd1')).toBe('CLOTURE');
  });

  it('avec 2 TC : la cloture auto attend que LES DEUX soient RETURNED', () => {
    var s = setupScenario({
      dos: [{
        id: 'd1', bl: 'BL002', cl: 'CL', st: 'ACTIF', td: 'IMPORT',
        da: daysAgo(10), as2: 'OBTENU',
        frRt: 30,  // large franchise pour eviter detention
      }],
      tcs: [
        { id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'BAMAKO', dsp: daysAgo(3), dab: daysAgo(1) },
        { id: 't2', did: 'd1', n: 'TC2', ty: '40HC', st: 'BAMAKO', dsp: daysAgo(3), dab: daysAgo(1) },
      ],
    });

    // Premier TC retourne : dossier doit rester ouvert (l'autre TC encore BAMAKO)
    act(function () {
      s.hook.current.advance('t1', 'RETURNED', today());
    });
    s.rerender();
    expect(getTcStatus(s.saves, 't1')).toBe('RETURNED');
    expect(getDosStatus(s.saves, 'd1')).not.toBe('CLOTURE');

    // Deuxieme TC retourne : tous RETURNED + detention < franchise => CLOTURE
    act(function () {
      s.hook.current.advance('t2', 'RETURNED', today());
    });
    s.rerender();
    expect(getTcStatus(s.saves, 't2')).toBe('RETURNED');
    expect(getDosStatus(s.saves, 'd1')).toBe('CLOTURE');
  });
});
