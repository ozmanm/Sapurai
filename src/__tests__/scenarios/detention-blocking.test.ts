/**
 * Sprint 39 - Scenario E2E : detention depasse la franchise -> bloque la cloture auto
 *
 * Quand un TC revient vide au-dela de la franchise retour vide (frRt), Sapurai
 * doit :
 *   - NE PAS cloturer automatiquement le dossier
 *   - Ouvrir la modale "detention" pour rappeler au transitaire qu'il doit
 *     payer la facture detention avant cloture
 *   - Laisser le dossier ouvert pour suivi
 */

import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { setupScenario, getTcStatus, getDosStatus, daysAgo, today } from './helpers';

describe('Scenario detention bloque la cloture', () => {
  it('quand jours detention > frRt : modal detention + dossier reste ouvert', () => {
    var s = setupScenario({
      dos: [{
        id: 'd1', bl: 'BL003', cl: 'CL', cr: 'DAKAR', st: 'ACTIF', td: 'IMPORT',
        da: daysAgo(40), as2: 'OBTENU',
        frRt: 4,  // franchise DAKAR par defaut : 4 jours
      }],
      tcs: [{
        id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'BAMAKO',
        dsp: daysAgo(15),  // sortie terminal il y a 15 jours
        dab: daysAgo(3),
      }],
    });

    // Retour vide aujourd'hui : detention = 15 jours, franchise 4j => depassement 11j
    act(function () {
      s.hook.current.advance('t1', 'RETURNED', today());
    });
    s.rerender();

    // Le TC passe bien RETURNED
    expect(getTcStatus(s.saves, 't1')).toBe('RETURNED');

    // Mais le dossier NE doit PAS etre CLOTURE
    expect(getDosStatus(s.saves, 'd1')).not.toBe('CLOTURE');

    // La modale detention doit avoir ete ouverte avec les bons parametres
    var openedDetentionModal = s.modals.find(function (m) { return m && m.t === 'detention'; });
    expect(openedDetentionModal).toBeDefined();
    expect(openedDetentionModal.did).toBe('d1');
    expect(openedDetentionModal.jours).toBeGreaterThan(4);
    expect(openedDetentionModal.depassement).toBeGreaterThan(0);
    expect(openedDetentionModal.franchise).toBe(4);
  });

  it('quand jours detention === frRt : cloture quand meme (limite tolerance)', () => {
    var s = setupScenario({
      dos: [{
        id: 'd1', bl: 'BL004', cl: 'CL', cr: 'DAKAR', st: 'ACTIF', td: 'IMPORT',
        da: daysAgo(10), as2: 'OBTENU',
        frRt: 4,
      }],
      tcs: [{
        id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'BAMAKO',
        dsp: daysAgo(4),  // exactement la franchise (4j)
        dab: daysAgo(1),
      }],
    });

    act(function () {
      s.hook.current.advance('t1', 'RETURNED', today());
    });
    s.rerender();

    expect(getTcStatus(s.saves, 't1')).toBe('RETURNED');
    expect(getDosStatus(s.saves, 'd1')).toBe('CLOTURE');
  });

  it('region CORRIDOR (Bamako, etc.) : franchise 23j par defaut', () => {
    // Test que le default franchise CORRIDOR est applique sans override
    var s = setupScenario({
      dos: [{
        id: 'd1', bl: 'BL005', cl: 'CL', cr: 'BAMAKO MALI', st: 'ACTIF', td: 'TRANSIT',
        da: daysAgo(30), as2: 'OBTENU',
        // Pas de frRt => default depuis regionFromDestination(CORRIDOR) = 23j
      }],
      tcs: [{
        id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'BAMAKO',
        dsp: daysAgo(20),  // 20j < 23j franchise => cloture OK
        dab: daysAgo(2),
      }],
    });

    act(function () {
      s.hook.current.advance('t1', 'RETURNED', today());
    });
    s.rerender();

    expect(getDosStatus(s.saves, 'd1')).toBe('CLOTURE');
  });
});
