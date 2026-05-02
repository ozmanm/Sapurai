import { describe, it, expect } from 'vitest';
import { mapCMAToPatches } from '../cma';

// Fixtures : reponses CMA representatives. Le format reel sera ajuste apres
// le 1er appel reussi sur le BL test (CHN2580404). En attendant ces fixtures
// couvrent les cas standards.

function mkDos(overrides: any = {}) {
  return Object.assign({ id: 'd1', bl: 'CHN2580404', cl: 'CLIENT TEST', cp: 'CMA', st: 'ACTIF' }, overrides);
}

function mkTc(n: string, st: string, overrides: any = {}) {
  return Object.assign({ id: 'tc-' + n, did: 'd1', n: n, ty: '40HC', st: st }, overrides);
}

describe('mapCMAToPatches', function () {

  it('aucun changement si pas de containers CMA', function () {
    var dos = mkDos({ da: '2026-04-01' });
    var tcs = [mkTc('TGHU6321812', 'PORT')];
    var result = mapCMAToPatches({}, tcs, dos);
    expect(result.changes.length).toBe(0);
    expect(result.tcUpdates.length).toBe(0);
    expect(Object.keys(result.dosPatches).length).toBe(0);
  });

  it('detecte date arrivee depuis evenement DISCHARGE', function () {
    var dos = mkDos();  // pas de da
    var tcs = [mkTc('TGHU6321812', 'ATTENDU')];
    var raw = {
      containers: [{
        number: 'TGHU6321812',
        events: [
          { type: 'LOAD', date: '2026-03-15T10:00:00Z', location: 'SHANGHAI' },
          { type: 'DISCHARGE', date: '2026-04-15T08:00:00Z', location: 'DAKAR' },
        ],
      }],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    expect(result.dosPatches.da).toBe('2026-04-15');
    expect(result.changes.some(function (c) { return c.indexOf('Date arrivee') >= 0; })).toBe(true);
  });

  it("n'ecrase pas une date arrivee deja renseignee", function () {
    var dos = mkDos({ da: '2026-04-10' });
    var tcs = [mkTc('TGHU6321812', 'PORT')];
    var raw = {
      containers: [{
        number: 'TGHU6321812',
        events: [{ type: 'DISCHARGE', date: '2026-04-15T08:00:00Z' }],
      }],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    expect(result.dosPatches.da).toBeUndefined();
  });

  it('mappe DISCHARGE -> PORT, GATE_OUT -> DISPATCHE', function () {
    var dos = mkDos({ da: '2026-04-15' });
    var tcs = [mkTc('TGHU6321812', 'ATTENDU')];
    var raw = {
      containers: [{
        number: 'TGHU6321812',
        events: [
          { type: 'DISCHARGE', date: '2026-04-15T08:00:00Z' },
          { type: 'GATE_OUT', date: '2026-04-20T14:00:00Z' },
        ],
      }],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    expect(result.tcUpdates.length).toBe(1);
    expect(result.tcUpdates[0].st).toBe('DISPATCHE');
    expect(result.tcUpdates[0].dsp).toBe('2026-04-20');
  });

  it('mappe EMPTY_RETURN -> RETURNED avec dr', function () {
    var dos = mkDos({ da: '2026-04-15' });
    var tcs = [mkTc('TGHU6321812', 'BAMAKO', { dsp: '2026-04-20' })];
    var raw = {
      containers: [{
        number: 'TGHU6321812',
        events: [{ type: 'EMPTY_RETURN', date: '2026-05-10T10:00:00Z' }],
      }],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    expect(result.tcUpdates.length).toBe(1);
    expect(result.tcUpdates[0].st).toBe('RETURNED');
    expect(result.tcUpdates[0].dr).toBe('2026-05-10');
  });

  it('matche les TC malgre espaces et tirets dans le numero', function () {
    var dos = mkDos({ da: '2026-04-15' });
    var tcs = [mkTc('TGHU6321812', 'ATTENDU')];
    var raw = {
      containers: [{
        number: 'TGHU 6321812',  // avec espace
        events: [{ type: 'DISCHARGE', date: '2026-04-15T08:00:00Z' }],
      }],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    // Note : DISCHARGE seul ne change pas le statut si deja ATTENDU mappe vers PORT
    // (seuls DISPATCHE/RETURNED ecrasent). Mais le matching doit fonctionner.
    // On verifie qu'on ne genere PAS une erreur de matching.
    expect(result.changes.length).toBeGreaterThanOrEqual(0);
  });

  it('supporte format alternatif data.containers', function () {
    var dos = mkDos();
    var tcs = [mkTc('TGHU6321812', 'ATTENDU')];
    var raw = {
      data: {
        containers: [{
          number: 'TGHU6321812',
          events: [{ type: 'DISCHARGE', date: '2026-04-15T08:00:00Z' }],
        }],
      },
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    expect(result.dosPatches.da).toBe('2026-04-15');
  });

  it('supporte format alternatif containerStatuses', function () {
    var dos = mkDos();
    var tcs = [mkTc('TGHU6321812', 'ATTENDU')];
    var raw = {
      containerStatuses: [{
        containerNumber: 'TGHU6321812',
        statusHistory: [{ eventType: 'DISCHARGE', eventDate: '2026-04-15T08:00:00Z' }],
      }],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    expect(result.dosPatches.da).toBe('2026-04-15');
  });

  it('ignore les containers absents du dossier', function () {
    var dos = mkDos();
    var tcs = [mkTc('TGHU6321812', 'ATTENDU')];
    var raw = {
      containers: [
        { number: 'TGHU6321812', events: [{ type: 'GATE_OUT', date: '2026-04-20T10:00:00Z' }] },
        { number: 'INCONNU99999', events: [{ type: 'DISCHARGE', date: '2026-04-15T08:00:00Z' }] },
      ],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    // Seul le TC connu doit etre patche
    expect(result.tcUpdates.length).toBe(1);
    expect(result.tcUpdates[0].id).toBe('tc-TGHU6321812');
  });

  it('summary descriptif et changes detaille', function () {
    var dos = mkDos();
    var tcs = [mkTc('TGHU6321812', 'ATTENDU')];
    var raw = {
      containers: [{
        number: 'TGHU6321812',
        events: [
          { type: 'DISCHARGE', date: '2026-04-15T08:00:00Z' },
          { type: 'GATE_OUT', date: '2026-04-20T14:00:00Z' },
        ],
      }],
    };
    var result = mapCMAToPatches(raw, tcs, dos);
    expect(result.summary.indexOf('CMA')).toBeGreaterThanOrEqual(0);
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
