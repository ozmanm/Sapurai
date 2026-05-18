import { describe, it, expect } from 'vitest';
import { canTcTransition, isTerminalStatus, TC_STATUSES } from '../tcStateMachine';

describe('tcStateMachine.canTcTransition (Sprint 46)', () => {
  describe('Transitions nominales (cycle complet)', () => {
    it('autorise ATTENDU -> PORT', () => {
      expect(canTcTransition('ATTENDU', 'PORT').valid).toBe(true);
    });
    it('autorise PORT -> ASSIGNE', () => {
      expect(canTcTransition('PORT', 'ASSIGNE').valid).toBe(true);
    });
    it('autorise ASSIGNE -> DISPATCHE', () => {
      expect(canTcTransition('ASSIGNE', 'DISPATCHE').valid).toBe(true);
    });
    it('autorise DISPATCHE -> TRANSIT', () => {
      expect(canTcTransition('DISPATCHE', 'TRANSIT').valid).toBe(true);
    });
    it('autorise TRANSIT -> BAMAKO', () => {
      expect(canTcTransition('TRANSIT', 'BAMAKO').valid).toBe(true);
    });
    it('autorise BAMAKO -> RETURNED', () => {
      expect(canTcTransition('BAMAKO', 'RETURNED').valid).toBe(true);
    });
  });

  describe('Raccourcis et cas reels', () => {
    it('autorise PORT -> DISPATCHE (chargement immediat, sans etape assignation)', () => {
      expect(canTcTransition('PORT', 'DISPATCHE').valid).toBe(true);
    });
    it('autorise ASSIGNE -> PORT (annulation assignation)', () => {
      expect(canTcTransition('ASSIGNE', 'PORT').valid).toBe(true);
    });
    it('autorise TRANSIT -> RETURNED (dossier rapide)', () => {
      expect(canTcTransition('TRANSIT', 'RETURNED').valid).toBe(true);
    });
    it('autorise DISPATCHE -> RETURNED (dossier Dakar local)', () => {
      expect(canTcTransition('DISPATCHE', 'RETURNED').valid).toBe(true);
    });
  });

  describe('Transitions interdites', () => {
    it('refuse RETURNED -> n importe quel statut', () => {
      expect(canTcTransition('RETURNED', 'TRANSIT').valid).toBe(false);
      expect(canTcTransition('RETURNED', 'BAMAKO').valid).toBe(false);
      expect(canTcTransition('RETURNED', 'PORT').valid).toBe(false);
    });
    it('refuse PORT -> BAMAKO direct (saut ASSIGNE+DISPATCHE+TRANSIT)', () => {
      expect(canTcTransition('PORT', 'BAMAKO').valid).toBe(false);
    });
    it('refuse PORT -> TRANSIT direct (saut DISPATCHE)', () => {
      expect(canTcTransition('PORT', 'TRANSIT').valid).toBe(false);
    });
    it('refuse ASSIGNE -> TRANSIT direct (saut DISPATCHE)', () => {
      expect(canTcTransition('ASSIGNE', 'TRANSIT').valid).toBe(false);
    });
    it('refuse ATTENDU -> DISPATCHE (le navire doit decharger d abord)', () => {
      expect(canTcTransition('ATTENDU', 'DISPATCHE').valid).toBe(false);
    });
    it('refuse ATTENDU -> ASSIGNE (TC pas encore au port)', () => {
      expect(canTcTransition('ATTENDU', 'ASSIGNE').valid).toBe(false);
    });
    it('refuse une regression PORT -> ATTENDU', () => {
      expect(canTcTransition('PORT', 'ATTENDU').valid).toBe(false);
    });
    it('refuse KATI comme statut cible (retire Sprint 46)', () => {
      var r = canTcTransition('TRANSIT', 'KATI');
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('inconnu');
    });
  });

  describe('Cas limites', () => {
    it('autorise sans statut courant (creation TC)', () => {
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
    it('tolere un statut courant legacy KATI (warn, transition vers BAMAKO possible)', () => {
      // Les TC legacy en KATI doivent pouvoir migrer vers TRANSIT (script de migration)
      // ou etre avances vers BAMAKO manuellement.
      var r = canTcTransition('KATI', 'BAMAKO');
      expect(r.valid).toBe(true);
      expect(r.reason).toContain('non-standard');
    });
    it('tolere un statut courant legacy non-standard (warn)', () => {
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
    it('ASSIGNE n est pas terminal', () => {
      expect(isTerminalStatus('ASSIGNE')).toBe(false);
    });
    it('statut inconnu n est pas terminal', () => {
      expect(isTerminalStatus('UNKNOWN')).toBe(false);
    });
  });

  describe('TC_STATUSES expose la liste complete', () => {
    it('contient les 7 statuts canoniques (sans KATI)', () => {
      expect(TC_STATUSES).toEqual(['ATTENDU', 'PORT', 'ASSIGNE', 'DISPATCHE', 'TRANSIT', 'BAMAKO', 'RETURNED']);
    });
  });
});
