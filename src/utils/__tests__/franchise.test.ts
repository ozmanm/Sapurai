import { describe, it, expect } from 'vitest';
import {
  regionFromDestination,
  defaultFranchiseMagasinage,
  defaultFranchiseRetourVide,
  defaultFranchiseCompagnie,
  getFranchiseMagasinage,
  getFranchiseCompagnie,
  getFranchiseRetourVide,
} from '../franchise';
import type { Dossier } from '../../types';

function mkDos(overrides?: Partial<Dossier>): Dossier {
  return Object.assign(
    { id: "d1", bl: "BL1", cl: "CLIENT", st: "ACTIF" },
    overrides || {},
  ) as Dossier;
}

describe('regionFromDestination', function () {
  it('reconnait Dakar (insensible a la casse)', function () {
    expect(regionFromDestination("Dakar")).toBe("DAKAR");
    expect(regionFromDestination("DAKAR")).toBe("DAKAR");
    expect(regionFromDestination("Livraison Dakar Plateau")).toBe("DAKAR");
  });

  it('reconnait Thies avec ou sans accent', function () {
    expect(regionFromDestination("Thies")).toBe("THIES");
    expect(regionFromDestination("Thiès")).toBe("THIES");
    expect(regionFromDestination("Ville de Thiès")).toBe("THIES");
  });

  it('reconnait le corridor Mali / Burkina / Niger', function () {
    expect(regionFromDestination("Bamako, Mali")).toBe("CORRIDOR");
    expect(regionFromDestination("Ouagadougou")).toBe("CORRIDOR");
    expect(regionFromDestination("Niger")).toBe("CORRIDOR");
    expect(regionFromDestination("Burkina Faso")).toBe("CORRIDOR");
  });

  it('autres villes Senegal => SENEGAL', function () {
    expect(regionFromDestination("Kaolack")).toBe("SENEGAL");
    expect(regionFromDestination("Saint-Louis")).toBe("SENEGAL");
    expect(regionFromDestination("Ziguinchor")).toBe("SENEGAL");
  });

  it('destination vide => DAKAR par defaut', function () {
    expect(regionFromDestination()).toBe("DAKAR");
    expect(regionFromDestination("")).toBe("DAKAR");
  });
});

describe('defaultFranchiseMagasinage', function () {
  it('IMPORT = 10j', function () {
    expect(defaultFranchiseMagasinage("IMPORT")).toBe(10);
  });
  it('TRANSIT = 21j', function () {
    expect(defaultFranchiseMagasinage("TRANSIT")).toBe(21);
  });
  it('VEHICULE = 5j', function () {
    expect(defaultFranchiseMagasinage("VEHICULE")).toBe(5);
  });
  it('type inconnu ou non defini = 10j par defaut', function () {
    expect(defaultFranchiseMagasinage()).toBe(10);
    expect(defaultFranchiseMagasinage("XYZ")).toBe(10);
  });
});

describe('defaultFranchiseCompagnie', function () {
  it('standard armateur = 10j', function () {
    expect(defaultFranchiseCompagnie()).toBe(10);
  });
});

describe('defaultFranchiseRetourVide', function () {
  it('DAKAR = 4j, THIES = 5j, SENEGAL = 8j, CORRIDOR = 23j', function () {
    expect(defaultFranchiseRetourVide("DAKAR")).toBe(4);
    expect(defaultFranchiseRetourVide("THIES")).toBe(5);
    expect(defaultFranchiseRetourVide("SENEGAL")).toBe(8);
    expect(defaultFranchiseRetourVide("CORRIDOR")).toBe(23);
  });
});

describe('getFranchiseMagasinage', function () {
  it('prend override dos.frMg si defini', function () {
    expect(getFranchiseMagasinage(mkDos({ td: "IMPORT", frMg: 15 }))).toBe(15);
  });
  it('prend default selon type sinon', function () {
    expect(getFranchiseMagasinage(mkDos({ td: "TRANSIT" }))).toBe(21);
    expect(getFranchiseMagasinage(mkDos({ td: "VEHICULE" }))).toBe(5);
  });
});

describe('getFranchiseCompagnie', function () {
  it('defaut = 10j', function () {
    expect(getFranchiseCompagnie(mkDos())).toBe(10);
  });
  it('prend override dos.frCp', function () {
    expect(getFranchiseCompagnie(mkDos({ frCp: 14 }))).toBe(14);
  });
});

describe('getFranchiseRetourVide', function () {
  it('calcule depuis destination si pas override', function () {
    expect(getFranchiseRetourVide(mkDos({ cr: "Bamako" }))).toBe(23);
    expect(getFranchiseRetourVide(mkDos({ cr: "Thies" }))).toBe(5);
    expect(getFranchiseRetourVide(mkDos({ cr: "Kaolack" }))).toBe(8);
    expect(getFranchiseRetourVide(mkDos({ cr: "Dakar" }))).toBe(4);
  });
  it('prend override dos.frRt', function () {
    expect(getFranchiseRetourVide(mkDos({ cr: "Dakar", frRt: 7 }))).toBe(7);
  });
});
