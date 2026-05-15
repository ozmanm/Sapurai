/**
 * Sprint 39 - Scenario E2E : machine d'etat TC bloque les transitions interdites
 *
 * Verifie que `advance()` ne laisse pas passer :
 *   - RETURNED -> n'importe quel statut (regression d'un TC retourne)
 *   - PORT -> BAMAKO direct (saute DISPATCHE + TRANSIT)
 *   - ATTENDU -> DISPATCHE (le TC n'est pas encore arrive)
 *   - regression PORT -> ATTENDU
 *
 * Et que les transitions valides passent normalement :
 *   - PORT -> DISPATCHE
 *   - TRANSIT -> BAMAKO (raccourci tolere)
 *   - BAMAKO -> KATI (au retour)
 */

import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { setupScenario, getTcStatus, daysAgo } from './helpers';

describe('Scenario machine d etat TC', () => {
  it('refuse RETURNED -> TRANSIT (regression interdite)', () => {
    var s = setupScenario({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'CLOTURE', td: 'IMPORT', da: daysAgo(20), as2: 'OBTENU' }],
      tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'RETURNED', dsp: daysAgo(15), dr: daysAgo(2) }],
    });

    var savesBefore = s.saves.length;
    act(function () {
      s.hook.current.advance('t1', 'TRANSIT');
    });
    s.rerender();

    // Aucun save (transition refusee, advance return early)
    expect(s.saves.length).toBe(savesBefore);
    // Le TC reste RETURNED dans le state initial
    expect((s.getDb().tcs as any[]).find(function (t: any) { return t.id === 't1'; }).st).toBe('RETURNED');
  });

  it('refuse PORT -> BAMAKO direct (saute DISPATCHE + TRANSIT)', () => {
    var s = setupScenario({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', da: daysAgo(5), as2: 'OBTENU' }],
      tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'PORT' }],
    });

    var savesBefore = s.saves.length;
    act(function () {
      s.hook.current.advance('t1', 'BAMAKO');
    });
    s.rerender();

    expect(s.saves.length).toBe(savesBefore);
    expect((s.getDb().tcs as any[]).find(function (t: any) { return t.id === 't1'; }).st).toBe('PORT');
  });

  it('refuse ATTENDU -> DISPATCHE (le TC n est pas encore arrive)', () => {
    var s = setupScenario({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'INITIALISE', td: 'IMPORT', as2: 'OBTENU' }],
      tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'ATTENDU' }],
    });

    var savesBefore = s.saves.length;
    act(function () {
      s.hook.current.advance('t1', 'DISPATCHE');
    });
    s.rerender();

    expect(s.saves.length).toBe(savesBefore);
  });

  it('refuse PORT -> ATTENDU (regression de statut)', () => {
    var s = setupScenario({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', da: daysAgo(5), as2: 'OBTENU' }],
      tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'PORT' }],
    });

    var savesBefore = s.saves.length;
    act(function () {
      s.hook.current.advance('t1', 'ATTENDU');
    });
    s.rerender();

    expect(s.saves.length).toBe(savesBefore);
    expect((s.getDb().tcs as any[]).find(function (t: any) { return t.id === 't1'; }).st).toBe('PORT');
  });

  it('autorise TRANSIT -> BAMAKO (raccourci tolere)', () => {
    var s = setupScenario({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', da: daysAgo(8), as2: 'OBTENU' }],
      tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'TRANSIT', dsp: daysAgo(5) }],
    });

    act(function () {
      s.hook.current.advance('t1', 'BAMAKO');
    });
    s.rerender();

    expect(getTcStatus(s.saves, 't1')).toBe('BAMAKO');
  });

  it('autorise BAMAKO -> KATI (passage retour)', () => {
    var s = setupScenario({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', da: daysAgo(10), as2: 'OBTENU' }],
      tcs: [{ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'BAMAKO', dsp: daysAgo(7), dab: daysAgo(1) }],
    });

    act(function () {
      s.hook.current.advance('t1', 'KATI');
    });
    s.rerender();

    expect(getTcStatus(s.saves, 't1')).toBe('KATI');
  });
});
