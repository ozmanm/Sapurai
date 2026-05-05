import { describe, it, expect } from 'vitest';
import { detectCarrier, mapCarrierToPatches } from '../carriers';

describe('detectCarrier — depuis cp (compagnie maritime)', function () {
  it('CMA-CGM, cma cgm, etc.', function () {
    expect(detectCarrier('XXX', 'CMA-CGM')).toBe('cma');
    expect(detectCarrier('XXX', 'cma cgm')).toBe('cma');
    expect(detectCarrier('XXX', 'CMA')).toBe('cma');
  });
  it('Maersk', function () {
    expect(detectCarrier('XXX', 'Maersk Line')).toBe('maersk');
    expect(detectCarrier('XXX', 'MAERSK')).toBe('maersk');
  });
  it('MSC', function () {
    expect(detectCarrier('XXX', 'MSC')).toBe('msc');
    expect(detectCarrier('XXX', 'msc Mediterranean')).toBe('msc');
  });
  it('Hapag-Lloyd', function () {
    expect(detectCarrier('XXX', 'Hapag-Lloyd')).toBe('hapag');
    expect(detectCarrier('XXX', 'HLAG')).toBe('hapag');
  });
  it('ONE', function () {
    expect(detectCarrier('XXX', 'ONE')).toBe('one');
    expect(detectCarrier('XXX', 'Ocean Network Express')).toBe('one');
  });
  it('Grimaldi', function () {
    expect(detectCarrier('XXX', 'Grimaldi')).toBe('grimaldi');
  });
});

describe('detectCarrier — depuis prefixe BL (fallback)', function () {
  it('CMA : CHN, CAN, GGZ, NGP', function () {
    expect(detectCarrier('CHN2580404')).toBe('cma');
    expect(detectCarrier('CAN0979033')).toBe('cma');
    expect(detectCarrier('GGZ2832526')).toBe('cma');
    expect(detectCarrier('NGP3308505')).toBe('cma');
  });
  it('Maersk : 260xxx, 265xxx, MAEU', function () {
    expect(detectCarrier('260009455')).toBe('maersk');
    expect(detectCarrier('260882335')).toBe('maersk');
    expect(detectCarrier('265613573')).toBe('maersk');
    expect(detectCarrier('MAEU1234567')).toBe('maersk');
  });
  it('MSC : MEDU', function () {
    expect(detectCarrier('MEDUWN296498')).toBe('msc');
    expect(detectCarrier('MEDUWN433778')).toBe('msc');
    expect(detectCarrier('MEDUWK430892')).toBe('msc');
  });
  it('Hapag : HLCU', function () {
    expect(detectCarrier('HLCUBO1260297983')).toBe('hapag');
    expect(detectCarrier('HLCUSZX2601CEER0')).toBe('hapag');
    expect(detectCarrier('HLCUTYO260117653')).toBe('hapag');
  });
  it('ONE : NK, NBOG', function () {
    expect(detectCarrier('NK5GG1721300')).toBe('one');
    expect(detectCarrier('NK5GG1720900')).toBe('one');
    expect(detectCarrier('NBOG06617600')).toBe('one');
  });
  it('Grimaldi : S\\d{7}+', function () {
    expect(detectCarrier('S329198625')).toBe('grimaldi');
    expect(detectCarrier('S329207837')).toBe('grimaldi');
  });
  it('null si non detectable', function () {
    expect(detectCarrier('XYZ123')).toBe(null);
    expect(detectCarrier('')).toBe(null);
  });
});

describe('mapCarrierToPatches', function () {
  it('pose dos.da uniquement si vide', function () {
    var dos = { id: 'd1', bl: 'CHN001', cl: 'X', cp: 'CMA', st: 'ACTIF' };  // pas de da
    var resp: any = { ok: true, arrivalDate: '2026-04-15' };
    var r = mapCarrierToPatches(resp, [], dos);
    expect(r.dosPatches.da).toBe('2026-04-15');
    expect(r.changes.length).toBe(1);
  });

  it("ecrase dos.da quand l'armateur renvoie une date differente (carrier fait foi)", function () {
    var dos = { id: 'd1', bl: 'CHN001', cl: 'X', cp: 'CMA', st: 'ACTIF', da: '2026-04-10' };
    var resp: any = { ok: true, arrivalDate: '2026-04-15' };
    var r = mapCarrierToPatches(resp, [], dos);
    // Sprint 21 : l'armateur fait foi (cf DPWorld). On ecrase la date manuelle.
    expect(r.dosPatches.da).toBe('2026-04-15');
    expect(r.dosPatches.daSrc).toBe('cma');
    expect(r.changes.length).toBe(1);
    expect(r.changes[0]).toContain('2026-04-10');
    expect(r.changes[0]).toContain('2026-04-15');
  });

  it("n'ecrase pas dos.da quand l'armateur renvoie la meme date (rien a logger)", function () {
    var dos = { id: 'd1', bl: 'CHN001', cl: 'X', cp: 'CMA', st: 'ACTIF', da: '2026-04-15' };
    var resp: any = { ok: true, arrivalDate: '2026-04-15' };
    var r = mapCarrierToPatches(resp, [], dos);
    expect(r.dosPatches.da).toBeUndefined();
    expect(r.changes.length).toBe(0);
    // Le summary indique tout de meme que l'ETA est confirmee
    expect(r.summary).toContain('confirmee');
  });

  it('ajoute les TC manquants signales par le carrier', function () {
    var dos = { id: 'd1', bl: 'X', cl: 'X', cp: 'MSC', st: 'ACTIF' };
    var resp: any = { ok: true, arrivalDate: null, containers: [
      { n: 'MEDU1234567', ty: '40HC' },
      { n: 'MEDU7654321', ty: '20GP' },
    ]};
    var dosTcs = [{ id: 't1', did: 'd1', n: 'MEDU1234567', ty: '40HC', st: 'PORT' }];
    var r = mapCarrierToPatches(resp, dosTcs, dos);
    // MEDU1234567 deja present => skip. MEDU7654321 nouveau => ajout.
    expect(r.newTcs.length).toBe(1);
    expect(r.newTcs[0].n).toBe('MEDU7654321');
  });

  it('matche les numeros TC malgre espaces et tirets', function () {
    var dos = { id: 'd1', bl: 'X', cl: 'X', cp: 'MSC', st: 'ACTIF' };
    var resp: any = { ok: true, containers: [{ n: 'MEDU 1234567', ty: '40HC' }] };
    var dosTcs = [{ id: 't1', did: 'd1', n: 'MEDU1234567', ty: '40HC' }];
    var r = mapCarrierToPatches(resp, dosTcs, dos);
    expect(r.newTcs.length).toBe(0);  // doublon detecte malgre l'espace
  });

  it('retourne summary explicite si rien ne change', function () {
    var dos = { id: 'd1', bl: 'X', cl: 'X', cp: 'MSC', st: 'ACTIF', da: '2026-04-10' };
    var resp: any = { ok: true, arrivalDate: null, containers: [], note: 'Date non trouvee (SPA)' };
    var r = mapCarrierToPatches(resp, [], dos);
    expect(r.changes.length).toBe(0);
    expect(r.summary).toContain('Aucune nouveaute');
    expect(r.summary).toContain('SPA');
  });
});
