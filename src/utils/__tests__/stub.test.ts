import { describe, it, expect } from 'vitest';
import {
  guessCategorie,
  guessStatus,
  categoriesToStubArrivee,
  categoriesToStubRetourVide,
  filterAntiDoublon,
  buildStubDepenses,
  stubDepensesArrivee,
  stubDepensesRetourVide,
  isNewArrival,
  generateArrivalStubsWithIds,
} from '../stub';
import type { Dossier, Depense, DepenseCategorie } from '../../types';

function mkDos(overrides?: Partial<Dossier>): Dossier {
  return Object.assign(
    { id: "d1", bl: "BL1", cl: "CLIENT", st: "ACTIF" },
    overrides || {},
  ) as Dossier;
}

function mkDep(
  categorie: DepenseCategorie | undefined,
  overrides?: Partial<Depense>,
): Depense {
  return Object.assign(
    { id: "x" + Math.random(), did: "d1", tp: "AUTRE", mt: 0, dt: "2026-01-01" },
    { categorie: categorie },
    overrides || {},
  ) as Depense;
}

describe('guessCategorie', function () {
  it('devine dpworld depuis libelle ou type', function () {
    expect(guessCategorie({ ds: "Facture DPWorld magasinage" })).toBe("dpworld");
    expect(guessCategorie({ tp: "DPWORLD" })).toBe("dpworld");
  });

  it('devine orbus / besc / caution / garantie', function () {
    expect(guessCategorie({ ds: "ORBUS" })).toBe("orbus");
    expect(guessCategorie({ ds: "BESC import" })).toBe("besc");
    expect(guessCategorie({ ds: "Caution transit" })).toBe("caution");
    expect(guessCategorie({ ds: "Lettre de garantie" })).toBe("lettre_garantie");
  });

  it('devine surestaries et detention', function () {
    expect(guessCategorie({ ds: "Surestaries compagnie" })).toBe("surestaries_compagnie");
    expect(guessCategorie({ ds: "Demurrage Maersk" })).toBe("surestaries_compagnie");
    expect(guessCategorie({ ds: "Detention conteneur vide" })).toBe("detention_vide");
    expect(guessCategorie({ ds: "Frais retour vide" })).toBe("detention_vide");
  });

  it('devine compagnie location vs debarquement', function () {
    expect(guessCategorie({ ds: "Location TC 40HC" })).toBe("compagnie_location");
    expect(guessCategorie({ ds: "Debarquement manutention" })).toBe("compagnie_debarquement");
  });

  it('devine transport_terr ou tombe sur autre', function () {
    expect(guessCategorie({ ds: "Transport camion Dakar-Bamako" })).toBe("transport_terr");
    expect(guessCategorie({ ds: "Frais divers" })).toBe("autre");
    expect(guessCategorie({})).toBe("autre");
  });
});

describe('guessStatus', function () {
  it("PAYE legacy => 'payee'", function () {
    expect(guessStatus({ s: "PAYE" })).toBe("payee");
  });
  it("absent ou ATT => 'a_payer'", function () {
    expect(guessStatus({ s: "ATT" })).toBe("a_payer");
    expect(guessStatus({})).toBe("a_payer");
  });
});

describe('categoriesToStubArrivee', function () {
  it('IMPORT avec besc=true : location, debarquement, besc, orbus, dpworld', function () {
    var cats = categoriesToStubArrivee(mkDos({ td: "IMPORT", besc: true }));
    expect(cats).toContain("compagnie_location");
    expect(cats).toContain("compagnie_debarquement");
    expect(cats).toContain("besc");
    expect(cats).toContain("orbus");
    expect(cats).toContain("dpworld");
    expect(cats).not.toContain("caution");
    expect(cats).not.toContain("lettre_garantie");
    expect(cats).not.toContain("surestaries_compagnie");
    expect(cats).not.toContain("detention_vide");
  });

  it('TRANSIT sans garantie permanente => inclut caution et lettre_garantie', function () {
    var cats = categoriesToStubArrivee(mkDos({ td: "TRANSIT", gr: "LOUEE" }));
    expect(cats).toContain("caution");
    expect(cats).toContain("lettre_garantie");
  });

  it('TRANSIT avec garantie permanente => pas de caution ni lettre_garantie', function () {
    var cats = categoriesToStubArrivee(mkDos({ td: "TRANSIT", gr: "PERMANENTE" }));
    expect(cats).not.toContain("caution");
    expect(cats).not.toContain("lettre_garantie");
  });

  it('BESC false ou absent : pas de stub besc', function () {
    var c1 = categoriesToStubArrivee(mkDos({ td: "IMPORT", besc: false }));
    expect(c1).not.toContain("besc");
    var c2 = categoriesToStubArrivee(mkDos({ td: "TRANSIT" }));
    expect(c2).not.toContain("besc");
  });

  it('surestaries_compagnie stub si joursAuPort > franchise (defaut 10j)', function () {
    var cats = categoriesToStubArrivee(mkDos({ td: "IMPORT" }), { joursAuPort: 15 });
    expect(cats).toContain("surestaries_compagnie");
  });

  it('pas de surestaries_compagnie si joursAuPort <= franchise', function () {
    var cats = categoriesToStubArrivee(mkDos({ td: "IMPORT" }), { joursAuPort: 10 });
    expect(cats).not.toContain("surestaries_compagnie");
  });

  it('surestaries_compagnie respecte override dos.frCp', function () {
    var cats = categoriesToStubArrivee(
      mkDos({ td: "IMPORT", frCp: 14 }),
      { joursAuPort: 12 },
    );
    expect(cats).not.toContain("surestaries_compagnie");
  });

  it('ordre metier respecte (location, debarquement, ... orbus, dpworld)', function () {
    var cats = categoriesToStubArrivee(
      mkDos({ td: "TRANSIT", gr: "LOUEE", besc: true }),
      { joursAuPort: 15 },
    );
    expect(cats[0]).toBe("compagnie_location");
    expect(cats[1]).toBe("compagnie_debarquement");
    expect(cats.indexOf("orbus")).toBeGreaterThan(cats.indexOf("besc"));
    expect(cats.indexOf("dpworld")).toBe(cats.length - 1);
  });
});

describe('categoriesToStubRetourVide', function () {
  it('stub detention_vide si joursRetourVide > franchise', function () {
    var cats = categoriesToStubRetourVide(mkDos({ cr: "Dakar" }), { joursRetourVide: 6 });
    expect(cats).toEqual(["detention_vide"]);
  });

  it('pas de stub si joursRetourVide <= franchise', function () {
    var cats = categoriesToStubRetourVide(mkDos({ cr: "Dakar" }), { joursRetourVide: 4 });
    expect(cats).toEqual([]);
  });

  it('pas de stub si RoRo (vehicule sur navire)', function () {
    var cats = categoriesToStubRetourVide(mkDos({ cr: "Dakar", ror: true }), { joursRetourVide: 30 });
    expect(cats).toEqual([]);
  });

  it('pas de stub si joursRetourVide absent', function () {
    var cats = categoriesToStubRetourVide(mkDos({ cr: "Dakar" }));
    expect(cats).toEqual([]);
  });

  it('respecte franchise corridor (23j)', function () {
    var dos = mkDos({ cr: "Bamako" });
    expect(categoriesToStubRetourVide(dos, { joursRetourVide: 20 })).toEqual([]);
    expect(categoriesToStubRetourVide(dos, { joursRetourVide: 24 })).toEqual(["detention_vide"]);
  });
});

describe('filterAntiDoublon', function () {
  it('retire les categories deja presentes via champ categorie', function () {
    var cats: DepenseCategorie[] = ["compagnie_location", "orbus", "dpworld"];
    var res = filterAntiDoublon(cats, [mkDep("orbus")]);
    expect(res).not.toContain("orbus");
    expect(res).toContain("compagnie_location");
    expect(res).toContain("dpworld");
  });

  it('retire meme si la Depense existante est ignored', function () {
    var legacy = mkDep("dpworld", { ignored: true });
    var res = filterAntiDoublon(["dpworld", "orbus"], [legacy]);
    expect(res).not.toContain("dpworld");
  });

  it('devine la categorie des Depenses legacy sans champ categorie', function () {
    var legacy = mkDep(undefined, { tp: "DPWORLD", ds: "Facture DPWorld" });
    var res = filterAntiDoublon(["dpworld", "orbus"], [legacy]);
    expect(res).not.toContain("dpworld");
    expect(res).toContain("orbus");
  });
});

describe('buildStubDepenses', function () {
  it('marque auto=true, status=en_attente_facture, mt=0, ignored=false', function () {
    var stubs = buildStubDepenses(mkDos(), ["orbus", "dpworld"]);
    expect(stubs.length).toBe(2);
    for (var i = 0; i < stubs.length; i++) {
      expect(stubs[i].auto).toBe(true);
      expect(stubs[i].status).toBe("en_attente_facture");
      expect(stubs[i].mt).toBe(0);
      expect(stubs[i].ignored).toBe(false);
      expect(stubs[i].s).toBe("ATT");
    }
  });

  it('inclut fournisseur dans libelle quand dispo', function () {
    var stubs = buildStubDepenses(mkDos(), ["dpworld"]);
    expect(stubs[0].ds).toContain("DPWorld");
  });

  it('utilise dos.cp pour libelle compagnie_*', function () {
    var stubs = buildStubDepenses(mkDos({ cp: "CMA CGM" }), ["compagnie_location"]);
    expect(stubs[0].ds).toContain("CMA CGM");
  });

  it('applique today=ctx.today pour dt', function () {
    var stubs = buildStubDepenses(mkDos(), ["orbus"], { today: new Date("2026-06-15T10:00:00Z") });
    expect(stubs[0].dt).toBe("2026-06-15");
  });
});

describe('stubDepensesArrivee (end-to-end)', function () {
  it('IMPORT : skip stubs si doublon avec Depense existante', function () {
    var existing: Depense[] = [mkDep("dpworld")];
    var stubs = stubDepensesArrivee(mkDos({ td: "IMPORT", besc: true }), existing);
    var cats = stubs.map(function (s) { return s.categorie; });
    expect(cats).not.toContain("dpworld");
    expect(cats).toContain("compagnie_location");
    expect(cats).toContain("orbus");
  });

  it('tableau vide si tout deja present', function () {
    var all: Depense[] = [
      mkDep("compagnie_location"),
      mkDep("compagnie_debarquement"),
      mkDep("orbus"),
      mkDep("dpworld"),
    ];
    var stubs = stubDepensesArrivee(mkDos({ td: "IMPORT", besc: false }), all);
    expect(stubs.length).toBe(0);
  });

  it('TRANSIT sans garantie permanente cree 6 categories par defaut', function () {
    var stubs = stubDepensesArrivee(mkDos({ td: "TRANSIT", gr: "LOUEE" }), []);
    expect(stubs.length).toBe(6);
    var cats = stubs.map(function (s) { return s.categorie; });
    expect(cats).toContain("compagnie_location");
    expect(cats).toContain("compagnie_debarquement");
    expect(cats).toContain("caution");
    expect(cats).toContain("lettre_garantie");
    expect(cats).toContain("orbus");
    expect(cats).toContain("dpworld");
  });
});

describe('stubDepensesRetourVide (end-to-end)', function () {
  it('cree detention_vide si franchise depassee et pas RoRo', function () {
    var stubs = stubDepensesRetourVide(mkDos({ cr: "Dakar" }), [], { joursRetourVide: 10 });
    expect(stubs.length).toBe(1);
    expect(stubs[0].categorie).toBe("detention_vide");
    expect(stubs[0].auto).toBe(true);
  });

  it('skip si detention_vide deja stubbe', function () {
    var existing: Depense[] = [mkDep("detention_vide")];
    var stubs = stubDepensesRetourVide(mkDos({ cr: "Dakar" }), existing, { joursRetourVide: 10 });
    expect(stubs.length).toBe(0);
  });
});

describe('isNewArrival', function () {
  it('true si oldDos.da absent et newDos.da present', function () {
    expect(isNewArrival(mkDos(), mkDos({ da: "2026-04-20" }))).toBe(true);
    expect(isNewArrival(undefined, mkDos({ da: "2026-04-20" }))).toBe(true);
  });
  it('false si oldDos.da deja present (re-edition)', function () {
    expect(isNewArrival(mkDos({ da: "2026-01-01" }), mkDos({ da: "2026-02-01" }))).toBe(false);
  });
  it('false si newDos.da absent', function () {
    expect(isNewArrival(mkDos(), mkDos())).toBe(false);
    expect(isNewArrival(mkDos({ da: "2026-01-01" }), mkDos())).toBe(false);
  });
});

describe('generateArrivalStubsWithIds', function () {
  var seq = 0;
  function mkId(): string { seq++; return "id-" + seq; }

  it('cree les stubs avec id + filtre les depenses du dossier uniquement', function () {
    seq = 0;
    var dep: Depense[] = [
      mkDep("dpworld", { did: "d1" }),              // doublon dossier courant
      mkDep("dpworld", { did: "autre" } as any),     // autre dossier : n'interfere pas
    ];
    var stubs = generateArrivalStubsWithIds(mkDos({ td: "IMPORT", besc: false }), dep, mkId);
    var cats = stubs.map(function (s) { return s.categorie; });
    expect(cats).not.toContain("dpworld");  // doublon filtre (did == d1)
    expect(cats).toContain("compagnie_location");
    expect(cats).toContain("orbus");
    for (var i = 0; i < stubs.length; i++) {
      expect(stubs[i].id).toMatch(/^id-\d+$/);
    }
  });
});
