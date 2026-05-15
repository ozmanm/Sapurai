import { describe, it, expect } from 'vitest';
import { canTcTransition, isTerminalStatus, TC_STATUSES } from '../tcStateMachine';

describe('tcStateMachine.canTcTransition', () => {
  describe('Transitions nominales (cycle complet)', () => {
    it('autorise ATTENDU -> PORT', () => {
      expect(canTcTransition('ATTENDU', 'PORT').valid).toBe(true);
    });
    it('autorise PORT -> DISPATCHE', () => {
      expect(canTcTransition('PORT', 'DISPATCHE').valid).toBe(true);
    });
    it('autorise DISPATCHE -> TRANSIT', () => {
      expect(canTcTransition('DISPATCHE', 'TRANSIT').valid).toBe(true);
    });
    it('autorise TRANSIT -> KATI', () => {
      expect(canTcTransition('TRANSIT', 'KATI').valid).toBe(true);
    });
    it('autorise KATI -> BAMAKO', () => {
      expect(canTcTransition('KATI', 'BAMAKO').valid).toBe(true);
    });
    it('autorise BAMAKO -> RETURNED', () => {
      expect(canTcTransition('BAMAKO', 'RETURNED').valid).toBe(true);
    });
  });

  describe('Raccourcis tolérés (cas réels)', () => {
    it('autorise TRANSIT -> BAMAKO (saut de Kati)', () => {
      expect(canTcTransition('TRANSIT', 'BAMAKO').valid).toBe(true);
    });
    it('autorise TRANSIT -> RETURNED (dossier rapide)', () => {
      expect(canTcTransition('TRANSIT', 'RETURNED').valid).toBe(true);
    });
    it('autorise DISPATCHE -> RETURNED (dossier Dakar local)', () => {
      expect(canTcTransition('DISPATCHE', 'RETURNED').valid).toBe(true);
    });
    it('autorise BAMAKO -> KATI (passage retour)', () => {
      expect(canTcTransition('BAMAKO', 'KATI').valid).toBe(true);
    });
  });

  describe('Transitions interdites', () => {
    it('refuse RETURNED -> n importe quel statut', () => {
      expect(canTcTransition('RETURNED', 'TRANSIT').valid).toBe(false);
      expect(canTcTransition('RETURNED', 'BAMAKO').valid).toBe(false);
      expect(canTcTransition('RETURNED', 'PORT').valid).toBe(false);
    });
    it('refuse PORT -> BAMAKO direct (saut DISPATCHE+TRANSIT)', () => {
      expect(canTcTransition('PORT', 'BAMAKO').valid).toBe(false);
    });
    it('refuse PORT -> RETURNED direct', () => {
      expect(canTcTransition('PORT', 'RETURNED').valid).toBe(false);
    });
    it('refuse ATTENDU -> DISPATCHE (le navire doit décharger d abord)', () => {
      expect(canTcTransition('ATTENDU', 'DISPATCHE').valid).toBe(false);
    });
    it('refuse une régression PORT -> ATTENDU', () => {
      expect(canTcTransition('PORT', 'ATTENDU').valid).toBe(false);
    });
  });

  describe('Cas limites', () => {
    it('autorise sans statut courant (création TC)', () => {
      expect(canTcTransition(null, 'ATTENDU').valid).toBe(true);
      expect(canTcTransition(undefined, 'PORT').valid).toBe(true);
    });
    it('autorise statut courant == cible (no-op)', () => {
      expect(canTcTransition('PORT', 'PORT').valid).toBe(true);
    });
    it('refuse un statut cible inconnu', () => {
      var r = canTcTransition('PORT', 'PIROUETTE');
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('inconnu');
    });
    it('tolère un statut courant legacy non-standard (warn)', () => {
      var r = canTcTransition('LEGACY_OLD', 'PORT');
      expect(r.valid).toBe(true);
      expect(r.reason).toContain('non-standard');
    });
  });

  describe('isTerminalStatus', () => {
    it('RETURNED est terminal', () => {
      expect(isTerminalStatus('RETURNED')).toBe(true);
    });
    it('PORT n est pas terminal', () => {
      expect(isTerminalStatus('PORT')).toBe(false);
    });
    it('statut inconnu n est pas terminal', () => {
      expect(isTerminalStatus('UNKNOWN')).toBe(false);
    });
  });

  describe('TC_STATUSES expose la liste complète', () => {
    it('contient les 7 statuts canoniques', () => {
      expect(TC_STATUSES).toEqual(['ATTENDU', 'PORT', 'DISPATCHE', 'TRANSIT', 'KATI', 'BAMAKO', 'RETURNED']);
    });
  });
});
