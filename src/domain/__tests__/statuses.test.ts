import { describe, it, expect } from 'vitest';
import {
  normalizeTcStatus,
  normalizeDossierStatus,
  isKnownTcStatus,
  isKnownDossierStatus,
  DOSSIER_STATUSES,
} from '../statuses';

describe('normalizeTcStatus', () => {
  it('retourne le statut TC canonique inchangé', () => {
    expect(normalizeTcStatus('ATTENDU')).toBe('ATTENDU');
    expect(normalizeTcStatus('PORT')).toBe('PORT');
    expect(normalizeTcStatus('RETURNED')).toBe('RETURNED');
  });
  it('ramène une valeur non-string à ATTENDU par défaut', () => {
    expect(normalizeTcStatus(null)).toBe('ATTENDU');
    expect(normalizeTcStatus(undefined)).toBe('ATTENDU');
    expect(normalizeTcStatus(42)).toBe('ATTENDU');
  });
  it('ramène une valeur string inconnue au fallback', () => {
    expect(normalizeTcStatus('UNKNOWN_STATUS')).toBe('ATTENDU');
    expect(normalizeTcStatus('port')).toBe('ATTENDU'); // case-sensitive
  });
  it('utilise un fallback explicite si fourni', () => {
    expect(normalizeTcStatus('foo', 'PORT')).toBe('PORT');
  });
});

describe('normalizeDossierStatus', () => {
  it('retourne le statut Dossier canonique inchangé', () => {
    expect(normalizeDossierStatus('INITIALISE')).toBe('INITIALISE');
    expect(normalizeDossierStatus('SECURISE')).toBe('SECURISE');
    expect(normalizeDossierStatus('EN_TRANSIT')).toBe('EN_TRANSIT');
    expect(normalizeDossierStatus('CLOTURE')).toBe('CLOTURE');
    expect(normalizeDossierStatus('ARCHIVE')).toBe('ARCHIVE');
  });
  it('défaut INITIALISE si valeur invalide (Sprint 40 : ACTIF supprime)', () => {
    expect(normalizeDossierStatus(null)).toBe('INITIALISE');
    expect(normalizeDossierStatus('BIDON')).toBe('INITIALISE');
    expect(normalizeDossierStatus('ACTIF')).toBe('INITIALISE');  // ACTIF n'est plus canonique
  });
});

describe('isKnownTcStatus / isKnownDossierStatus (type guards)', () => {
  it('isKnownTcStatus reconnait les 7 statuts', () => {
    expect(isKnownTcStatus('ATTENDU')).toBe(true);
    expect(isKnownTcStatus('BAMAKO')).toBe(true);
    expect(isKnownTcStatus('foo')).toBe(false);
    expect(isKnownTcStatus(null)).toBe(false);
  });
  it('isKnownDossierStatus reconnait les 4 statuts', () => {
    expect(isKnownDossierStatus('CLOTURE')).toBe(true);
    expect(isKnownDossierStatus('PENDING')).toBe(false);
  });
});

describe('DOSSIER_STATUSES expose la liste complète', () => {
  it('contient les 4 statuts canoniques', () => {
    expect(DOSSIER_STATUSES).toEqual(['INITIALISE', 'SECURISE', 'EN_TRANSIT', 'CLOTURE', 'ARCHIVE']);
  });
});
