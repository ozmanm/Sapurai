import { describe, it, expect } from 'vitest';
import { today, joursDiff, calcAlertesFranchise, calcUrgencesDoc } from '../date.js';

describe('today', function () {
  it('retourne une date au format YYYY-MM-DD', function () {
    var result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('retourne la date du jour', function () {
    var now = new Date();
    var expected = now.toISOString().split('T')[0];
    expect(today()).toBe(expected);
  });
});

describe('joursDiff', function () {
  // Convention metier transit Senegal/Mali : decompte INCLUSIF
  // (le jour de mise a dispo / chargement compte). Du 01 au 24 = 24 jours.
  it('retourne 1 pour le meme jour (jour inclus)', function () {
    expect(joursDiff('2026-03-01', '2026-03-01')).toBe(1);
  });

  it('retourne le nombre de jours INCLUSIF (du 01 au 11 = 11 jours)', function () {
    expect(joursDiff('2026-03-01', '2026-03-11')).toBe(11);
  });

  it('retourne un nombre negatif pour les dates futures (toujours +1)', function () {
    // 2026-03-11 -> 2026-03-01 : diff brut -10, +1 = -9
    expect(joursDiff('2026-03-11', '2026-03-01')).toBe(-9);
  });

  it('retourne 0 pour une date de debut nulle', function () {
    expect(joursDiff(null, '2026-03-01')).toBe(0);
    expect(joursDiff('', '2026-03-01')).toBe(0);
  });

  it('exemple metier : du 01 au 24 = 24 jours (franchise 23j -> 1j detention)', function () {
    expect(joursDiff('2026-03-01', '2026-03-24')).toBe(24);
  });
});

describe('calcAlertesFranchise', function () {
  var cfg = { fm: 20, fp: 10, ft: 23 };

  it('retourne un objet avec alertes et urgences vides si pas de TCs', function () {
    var result = calcAlertesFranchise([], [], cfg);
    expect(result.alertes).toEqual([]);
    expect(result.urgences).toEqual([]);
  });

  it('ignore les TC RETURNED', function () {
    var tcs = [{ id: 't1', did: 'd1', st: 'RETURNED', n: 'TC001' }];
    var dos = [{ id: 'd1', da: '2026-01-01', st: 'EN_COURS', bl: 'BL001', cl: 'CLIENT' }];
    var result = calcAlertesFranchise(tcs, dos, cfg);
    expect(result.alertes).toEqual([]);
    expect(result.urgences).toEqual([]);
  });

  it('ignore les dossiers clotures', function () {
    var tcs = [{ id: 't1', did: 'd1', st: 'PORT', n: 'TC001' }];
    var dos = [{ id: 'd1', da: '2026-01-01', st: 'CLOTURE', bl: 'BL001', cl: 'CLIENT' }];
    var result = calcAlertesFranchise(tcs, dos, cfg);
    expect(result.alertes).toEqual([]);
    expect(result.urgences).toEqual([]);
  });

  it('genere une alerte magasinage quand franchise proche', function () {
    // TC au port depuis 15 jours (franchise 20j => reste 5j => alerte)
    var dateDecharge = new Date();
    dateDecharge.setDate(dateDecharge.getDate() - 15);
    var da = dateDecharge.toISOString().split('T')[0];

    var tcs = [{ id: 't1', did: 'd1', st: 'PORT', n: 'TC001' }];
    var dos = [{ id: 'd1', da: da, st: 'EN_COURS', bl: 'BL001', cl: 'CLIENT' }];
    var result = calcAlertesFranchise(tcs, dos, cfg);
    expect(result.alertes.length).toBeGreaterThan(0);
    expect(result.alertes[0].tp).toBe('Magasinage');
    expect(result.alertes[0].r).toBeLessThanOrEqual(7);
  });

  it('genere une urgence critique quand franchise depassee', function () {
    // TC au port depuis 25 jours (franchise 20j => depasse de 5j)
    var dateDecharge = new Date();
    dateDecharge.setDate(dateDecharge.getDate() - 25);
    var da = dateDecharge.toISOString().split('T')[0];

    var tcs = [{ id: 't1', did: 'd1', st: 'PORT', n: 'TC001' }];
    var dos = [{ id: 'd1', da: da, st: 'EN_COURS', bl: 'BL001', cl: 'CLIENT' }];
    var result = calcAlertesFranchise(tcs, dos, cfg);
    var critiques = result.urgences.filter(function (u) { return u.level === 'critical'; });
    expect(critiques.length).toBeGreaterThan(0);
  });

  it('genere une alerte detention pour TC dispatche', function () {
    // TC dispatche depuis 18 jours (franchise 23j => reste 5j => alerte)
    var dateDispatch = new Date();
    dateDispatch.setDate(dateDispatch.getDate() - 18);
    var dsp = dateDispatch.toISOString().split('T')[0];

    var tcs = [{ id: 't1', did: 'd1', st: 'TRANSIT', n: 'TC001', dsp: dsp }];
    var dos = [{ id: 'd1', da: '2026-01-01', st: 'EN_COURS', bl: 'BL001', cl: 'CLIENT' }];
    var result = calcAlertesFranchise(tcs, dos, cfg);
    var detentions = result.alertes.filter(function (a) { return a.tp === 'Detention'; });
    expect(detentions.length).toBeGreaterThan(0);
  });

  it('utilise les valeurs de franchise par defaut si cfg absent', function () {
    var result = calcAlertesFranchise([], [], null);
    expect(result.alertes).toEqual([]);
    expect(result.urgences).toEqual([]);
  });
});

describe('calcUrgencesDoc', function () {
  it('retourne un tableau vide si pas de dossiers', function () {
    expect(calcUrgencesDoc([], [])).toEqual([]);
  });

  it('ignore les dossiers clotures', function () {
    var dos = [{ id: 'd1', st: 'CLOTURE', bl: 'BL001', cl: 'CLIENT' }];
    expect(calcUrgencesDoc(dos, [])).toEqual([]);
  });

  it('detecte un BAE manquant quand TC au port', function () {
    var dos = [{ id: 'd1', st: 'EN_COURS', bl: 'BL001', cl: 'CLIENT', as2: 'NON_DEMANDE' }];
    var tcs = [{ id: 't1', did: 'd1', st: 'PORT' }];
    var result = calcUrgencesDoc(dos, tcs);
    var bae = result.filter(function (u) { return u.cat === 'BAE'; });
    expect(bae.length).toBe(1);
    expect(bae[0].msg).toContain('Manquant');
  });

  it('pas d alerte BAE si pregate obtenu', function () {
    var dos = [{ id: 'd1', st: 'EN_COURS', bl: 'BL001', cl: 'CLIENT', pn: 'PRE123' }];
    var tcs = [{ id: 't1', did: 'd1', st: 'PORT' }];
    var result = calcUrgencesDoc(dos, tcs);
    var bae = result.filter(function (u) { return u.cat === 'BAE'; });
    expect(bae.length).toBe(0);
  });

  it('detecte un BAD expire', function () {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var bv = yesterday.toISOString().split('T')[0];

    var dos = [{ id: 'd1', st: 'EN_COURS', bl: 'BL001', cl: 'CLIENT', bv: bv, bs: 'OBTENU' }];
    var tcs = [{ id: 't1', did: 'd1', st: 'PORT' }];
    var result = calcUrgencesDoc(dos, tcs);
    var bad = result.filter(function (u) { return u.cat === 'BAD'; });
    expect(bad.length).toBe(1);
    expect(bad[0].level).toBe('critical');
  });
});
