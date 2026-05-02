// Tests F.2 — mapDPWorldToPatches (coeur du sync DPWorld)
//
// La fonction transforme la reponse DPWorld en patches (dosPatches +
// tcUpdates + summary). Elle est pure — facile a tester sans mock fetch.

import { describe, it, expect } from 'vitest';
import { mapDPWorldToPatches } from '../dpworld';

function mkDos(overrides: any = {}) {
  return Object.assign({ id: 'd1', bl: 'BL1', cl: 'CL1', st: 'ACTIF' }, overrides);
}

function mkTc(id: string, n: string, st: string = 'ATTENDU') {
  return { id: id, did: 'd1', n: n, ty: '40HC', po: 0, st: st };
}

describe('mapDPWorldToPatches — date arrivee', function () {
  it('pose da depuis la ATA la plus ancienne si dos.da absent', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', ata: '2026-04-10T08:00:00Z' }, { id: 'MSCU2', ata: '2026-04-12T08:00:00Z' }],
      [mkTc('tc1', 'MSCU1')],
      mkDos(),
    );
    expect(res.dosPatches.da).toBe('2026-04-10');
    expect(res.summary).toContain('Date arrivee');
  });

  it('ne touche pas da si deja present', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', ata: '2026-04-10T08:00:00Z' }],
      [],
      mkDos({ da: '2026-01-01' }),
    );
    expect(res.dosPatches.da).toBeUndefined();
  });

  it('skip si aucune ATA', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1' }],
      [],
      mkDos(),
    );
    expect(res.dosPatches.da).toBeUndefined();
  });
});

describe('mapDPWorldToPatches — BAD', function () {
  it('passe bs a OBTENU si au moins un tc.bad === OK', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', bad: 'OK', validiteDODate: '2026-05-15T00:00:00Z' }],
      [],
      mkDos({ bs: 'EN_COURS' }),
    );
    expect(res.dosPatches.bs).toBe('OBTENU');
    expect(res.dosPatches.bv).toBe('2026-05-15');
  });

  it('ne change pas bs si deja OBTENU mais met a jour bv si plus recent', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', bad: 'OK', validiteDODate: '2026-06-01T00:00:00Z' }],
      [],
      mkDos({ bs: 'OBTENU', bv: '2026-05-01' }),
    );
    expect(res.dosPatches.bs).toBeUndefined();
    expect(res.dosPatches.bv).toBe('2026-06-01');
  });

  it('ne ecrase pas bv si date existante plus recente', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', bad: 'OK', validiteDODate: '2026-04-01T00:00:00Z' }],
      [],
      mkDos({ bs: 'OBTENU', bv: '2026-05-01' }),
    );
    expect(res.dosPatches.bv).toBeUndefined();
  });
});

describe('mapDPWorldToPatches — BAE', function () {
  it('passe as2 a OBTENU si au moins un tc.bae === OK', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', bae: 'OK', dateBae: '2026-04-15T00:00:00Z' }],
      [],
      mkDos({ as2: 'EN_COURS' }),
    );
    expect(res.dosPatches.as2).toBe('OBTENU');
    expect(res.dosPatches.bd).toBe('2026-04-15');
  });

  it('ne ecrase pas bd si deja present', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', bae: 'OK', dateBae: '2026-04-15T00:00:00Z' }],
      [],
      mkDos({ as2: 'OBTENU', bd: '2026-04-01' }),
    );
    expect(res.dosPatches.bd).toBeUndefined();
  });
});

describe('mapDPWorldToPatches — Pregate', function () {
  it('pose pn si pregateDO Paiment Effectif et dos.pn absent', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', pregateDO: 'Paiment Effectif', do: 'DO-2026-1234' }],
      [],
      mkDos(),
    );
    expect(res.dosPatches.pn).toBe('DO-2026-1234');
  });

  it('ne touche pas pn si deja present', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', pregateDO: 'Paiment Effectif', do: 'DO-NEW' }],
      [],
      mkDos({ pn: 'DO-EXISTING' }),
    );
    expect(res.dosPatches.pn).toBeUndefined();
  });

  it('skip si pregateDO autre chose', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', pregateDO: 'En attente', do: 'DO-X' }],
      [],
      mkDos(),
    );
    expect(res.dosPatches.pn).toBeUndefined();
  });
});

describe('mapDPWorldToPatches — TC statuts', function () {
  it('matche les TC par numero normalise (espaces + tirets ignores)', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU-123 4567', timeIn: '2026-04-10T08:00:00Z' }],
      [mkTc('tc1', 'MSCU1234567')],
      mkDos(),
    );
    expect(res.tcUpdates).toHaveLength(1);
    expect(res.tcUpdates[0].id).toBe('tc1');
  });

  it('TC ATTENDU avec timeIn => PORT', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', timeIn: '2026-04-10T08:00:00Z' }],
      [mkTc('tc1', 'MSCU1', 'ATTENDU')],
      mkDos(),
    );
    expect(res.tcUpdates).toEqual([{ id: 'tc1', st: 'PORT' }]);
  });

  it('TC PORT avec timeOut et visitState 3DEPARTED => DISPATCHE', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', timeOut: '2026-04-15T14:00:00Z', visitState: '3DEPARTED' }],
      [mkTc('tc1', 'MSCU1', 'PORT')],
      mkDos(),
    );
    expect(res.tcUpdates[0].st).toBe('DISPATCHE');
    expect(res.tcUpdates[0].dsp).toBe('2026-04-15');
  });

  it('TC PORT sans visitState DEPARTED reste PORT', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', timeOut: '2026-04-15T14:00:00Z', visitState: '2LOADED' }],
      [mkTc('tc1', 'MSCU1', 'PORT')],
      mkDos(),
    );
    expect(res.tcUpdates).toEqual([]);
  });

  it('TC non matche (pas dans dosTcs) est ignore', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'INCONNU', timeIn: '2026-04-10T08:00:00Z' }],
      [mkTc('tc1', 'MSCU1', 'ATTENDU')],
      mkDos(),
    );
    expect(res.tcUpdates).toEqual([]);
  });
});

describe('mapDPWorldToPatches — summary', function () {
  it('dit "Aucune nouveaute DPWorld" si aucun changement', function () {
    var res = mapDPWorldToPatches([{ id: 'MSCU1' }], [mkTc('tc1', 'MSCU1', 'ATTENDU')], mkDos({ da: '2026-01-01' }));
    expect(res.summary).toBe('Aucune nouveaute DPWorld');
  });

  it('resume 3 premiers changements + suffixe "..."  si > 3', function () {
    var res = mapDPWorldToPatches(
      [
        { id: 'MSCU1', ata: '2026-04-10T08:00:00Z', bad: 'OK', validiteDODate: '2026-05-01T00:00:00Z', bae: 'OK', dateBae: '2026-04-15T00:00:00Z', pregateDO: 'Paiment Effectif', do: 'DO-X' },
      ],
      [],
      mkDos(),
    );
    expect(res.summary).toContain('...');
    expect(res.summary).toMatch(/^\d+ maj:/);
  });
});
