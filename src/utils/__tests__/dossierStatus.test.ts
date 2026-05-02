import { describe, it, expect } from 'vitest';
import { computeDossierStatus, applyAutoStatus } from '../dossierStatus';
import type { Dossier, Conteneur } from '../../types';

function mkDos(id: string, st: string): Dossier {
  return { id: id, bl: "BL" + id, cl: "CL", st: st } as Dossier;
}
function mkTc(did: string, st: string): Conteneur {
  return { id: "tc-" + Math.random(), did: did, n: "X", ty: "20GP", po: 0, st: st } as Conteneur;
}

describe('computeDossierStatus', function () {
  it('CLOTURE / ARCHIVE jamais ecrases', function () {
    expect(computeDossierStatus(mkDos("d1", "CLOTURE"), [mkTc("d1", "PORT")])).toBe(null);
    expect(computeDossierStatus(mkDos("d1", "ARCHIVE"), [mkTc("d1", "TRANSIT")])).toBe(null);
  });

  it('Tous TC ATTENDU => INITIALISE', function () {
    var d = mkDos("d1", "SECURISE");
    var tcs = [mkTc("d1", "ATTENDU"), mkTc("d1", "ATTENDU")];
    expect(computeDossierStatus(d, tcs)).toBe("INITIALISE");
  });

  it('1 TC PORT => SECURISE', function () {
    var d = mkDos("d1", "INITIALISE");
    var tcs = [mkTc("d1", "PORT"), mkTc("d1", "ATTENDU")];
    expect(computeDossierStatus(d, tcs)).toBe("SECURISE");
  });

  it('Tous TC dispatches => EN_TRANSIT', function () {
    var d = mkDos("d1", "SECURISE");
    var tcs = [mkTc("d1", "DISPATCHE"), mkTc("d1", "TRANSIT")];
    expect(computeDossierStatus(d, tcs)).toBe("EN_TRANSIT");
  });

  it('1 TC encore au port + 1 dispatche => SECURISE', function () {
    var d = mkDos("d1", "INITIALISE");
    var tcs = [mkTc("d1", "PORT"), mkTc("d1", "DISPATCHE")];
    expect(computeDossierStatus(d, tcs)).toBe("SECURISE");
  });

  it('1 RETURNED + 1 TRANSIT => EN_TRANSIT (retour ignore dans actifs)', function () {
    var d = mkDos("d1", "SECURISE");
    var tcs = [mkTc("d1", "RETURNED"), mkTc("d1", "TRANSIT")];
    expect(computeDossierStatus(d, tcs)).toBe("EN_TRANSIT");
  });

  it('Aucun TC => null (pas de changement)', function () {
    expect(computeDossierStatus(mkDos("d1", "INITIALISE"), [])).toBe(null);
  });

  it('Pas de changement si statut deja correct', function () {
    var d = mkDos("d1", "EN_TRANSIT");
    var tcs = [mkTc("d1", "TRANSIT")];
    expect(computeDossierStatus(d, tcs)).toBe(null);
  });
});

describe('applyAutoStatus', function () {
  it('met a jour seulement les dossiers concernes', function () {
    var dos: Dossier[] = [mkDos("d1", "INITIALISE"), mkDos("d2", "SECURISE"), mkDos("d3", "CLOTURE")];
    var tcs: Conteneur[] = [
      mkTc("d1", "PORT"),       // -> SECURISE
      mkTc("d2", "DISPATCHE"),  // -> EN_TRANSIT
      mkTc("d3", "PORT"),       // CLOTURE non touche
    ];
    var out = applyAutoStatus(dos, tcs);
    expect(out[0].st).toBe("SECURISE");
    expect(out[1].st).toBe("EN_TRANSIT");
    expect(out[2].st).toBe("CLOTURE");
  });
});
