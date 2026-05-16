// Tests F.2 — mapDPWorldToPatches (coeur du sync DPWorld)
//
// La fonction transforme la reponse DPWorld en patches (dosPatches +
// tcUpdates + summary). Elle est pure — facile a tester sans mock fetch.

import { describe, it, expect } from 'vitest';
import { mapDPWorldToPatches, mapTcDPWorld, detectTcConflict } from '../dpworld';

function mkDos(overrides: any = {}) {
  return Object.assign({ id: 'd1', bl: 'BL1', cl: 'CL1', st: 'ACTIF' }, overrides);
}

function mkTc(id: string, n: string, st: string = 'ATTENDU'): any {
  return { id: id, did: 'd1', n: n, ty: '40HC', po: 0, st: st };
}

function mkTcWithDpw(id: string, n: string, st: string, overrides: any = {}) {
  return Object.assign(mkTc(id, n, st), {
    dpwAta: undefined,
    dpwDischarge: undefined,
    dpwTimeIn: undefined,
    dpwTimeOut: undefined,
    dpwVisitState: undefined,
    dpwSyncedAt: undefined,
    dpwConflict: undefined,
  }, overrides);
}

// ===== mapTcDPWorld (core par TC) =====

describe('mapTcDPWorld', function () {
  it('pose tous les champs dpw depuis la reponse DPWorld', function () {
    var res = mapTcDPWorld(
      { id: 'tc1', n: 'MSCU1' },
      { id: 'MSCU1', ata: '2026-04-10T08:00:00Z', dischargeDate: '2026-04-10T12:00:00Z', timeIn: '2026-04-11T08:00:00Z', timeOut: '2026-04-15T14:00:00Z', visitState: '3DEPARTED' },
    );
    expect(res.dpwAta).toBe('2026-04-10');
    expect(res.dpwDischarge).toBe('2026-04-10');
    expect(res.dpwTimeIn).toBe('2026-04-11');
    expect(res.dpwTimeOut).toBe('2026-04-15');
    expect(res.dpwVisitState).toBe('3DEPARTED');
    expect(res.dpwSyncedAt).toBeTruthy();
    expect(res.id).toBe('tc1');
  });

  it('ATTENDU + timeOut + 3DEPARTED → DISPATCHE direct (skip PORT)', function () {
    var res = mapTcDPWorld(
      { id: 'tc1', n: 'MSCU1', st: 'ATTENDU' },
      { timeOut: '2026-04-15T14:00:00Z', visitState: '3DEPARTED' },
    );
    expect(res.st).toBe('DISPATCHE');
    expect(res.dsp).toBe('2026-04-15');
    expect(res.changes).toEqual(['MSCU1 → Dispatche']);
  });

  it('ATTENDU + timeIn → PORT si pas de timeOut', function () {
    var res = mapTcDPWorld(
      { id: 'tc1', n: 'MSCU1', st: 'ATTENDU' },
      { timeIn: '2026-04-11T08:00:00Z' },
    );
    expect(res.st).toBe('PORT');
    expect(res.changes).toEqual(['MSCU1 → Port']);
  });

  it('PORT + timeOut + 3DEPARTED → DISPATCHE', function () {
    var res = mapTcDPWorld(
      { id: 'tc1', n: 'MSCU1', st: 'PORT' },
      { timeOut: '2026-04-15T14:00:00Z', visitState: '3DEPARTED' },
    );
    expect(res.st).toBe('DISPATCHE');
    expect(res.dsp).toBe('2026-04-15');
  });

  it('ne regresse PAS un statut plus avance (KATI reste KATI)', function () {
    var res = mapTcDPWorld(
      { id: 'tc1', n: 'MSCU1', st: 'KATI' },
      { timeIn: '2026-04-11T08:00:00Z', timeOut: '2026-04-15T14:00:00Z', visitState: '3DEPARTED' },
    );
    expect(res.st).toBeUndefined();
  });

  it('efface dpwConflict si sync OK et pas de transition', function () {
    var res = mapTcDPWorld(
      { id: 'tc1', n: 'MSCU1', st: 'PORT', dpwConflict: { type: 'STATUS_MISMATCH', note: 'test', at: '2026-01-01' } },
      { timeIn: '2026-04-11T08:00:00Z', visitState: undefined },
    );
    expect(res.dpwConflict).toBeNull();
    expect(res.changes).toContain('MSCU1 conflit resolve');
  });
});

// ===== detectTcConflict =====

describe('detectTcConflict', function () {
  it('STATUS_MISMATCH si local=DISPATCHE mais DPWorld=2LOADED (pas 3DEPARTED)', function () {
    var tc = { id: 'tc1', n: 'MEDU1', st: 'DISPATCHE', dsp: '2026-04-15' };
    var dpTc = { id: 'MEDU1', visitState: '2LOADED', timeOut: '2026-04-15T14:00:00Z' };
    var conf = detectTcConflict(tc, dpTc);
    expect(conf).not.toBeNull();
    expect(conf!.type).toBe('STATUS_MISMATCH');
  });

  it('STATUS_MISMATCH si local=DISPATCHE mais DPWorld pas 3DEPARTED (no timeOut)', function () {
    var tc = { id: 'tc1', n: 'MEDU1', st: 'DISPATCHE', dsp: '2026-04-15' };
    var dpTc = { id: 'MEDU1', visitState: '1ARRIVED' };
    var conf = detectTcConflict(tc, dpTc);
    expect(conf).not.toBeNull();
    expect(conf!.type).toBe('STATUS_MISMATCH');
  });

  it('pas de conflit si local=PORT et DPWorld=PORT', function () {
    var tc = { id: 'tc1', n: 'MEDU1', st: 'PORT' };
    var dpTc = { id: 'MEDU1', timeIn: '2026-04-11T08:00:00Z' };
    var conf = detectTcConflict(tc, dpTc);
    expect(conf).toBeNull();
  });

  it('pas de conflit si local=TRANSIT/KATI et DPWorld=3DEPARTED (coherent)', function () {
    var tc = { id: 'tc1', n: 'MEDU1', st: 'TRANSIT', dsp: '2026-04-15' };
    var dpTc = { id: 'MEDU1', visitState: '3DEPARTED', timeOut: '2026-04-15T14:00:00Z' };
    var conf = detectTcConflict(tc, dpTc);
    expect(conf).toBeNull();
  });

  it('MISSING_DSP si DISPATCHE sans dsp', function () {
    var tc = { id: 'tc1', n: 'MEDU1', st: 'DISPATCHE' };
    var dpTc = { id: 'MEDU1', visitState: '3DEPARTED', timeOut: '2026-04-15T14:00:00Z' };
    var conf = detectTcConflict(tc, dpTc);
    expect(conf).not.toBeNull();
    expect(conf!.type).toBe('MISSING_DSP');
  });
});

// ===== Facade mapDPWorldToPatches (compat ascendante) =====

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
    expect(res.tcUpdates[0].st).toBe('PORT');
    expect(res.tcUpdates[0].dpwTimeIn).toBe('2026-04-10');
  });

  it('TC ATTENDU avec timeIn => PORT', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', timeIn: '2026-04-10T08:00:00Z' }],
      [mkTc('tc1', 'MSCU1', 'ATTENDU')],
      mkDos(),
    );
    expect(res.tcUpdates[0].id).toBe('tc1');
    expect(res.tcUpdates[0].st).toBe('PORT');
    expect(res.tcUpdates[0].dpwTimeIn).toBe('2026-04-10');
  });

  it('TC PORT avec timeOut et visitState 3DEPARTED => DISPATCHE', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', timeOut: '2026-04-15T14:00:00Z', visitState: '3DEPARTED' }],
      [mkTc('tc1', 'MSCU1', 'PORT')],
      mkDos(),
    );
    expect(res.tcUpdates[0].st).toBe('DISPATCHE');
    expect(res.tcUpdates[0].dsp).toBe('2026-04-15');
    expect(res.tcUpdates[0].dpwTimeOut).toBe('2026-04-15');
    expect(res.tcUpdates[0].dpwVisitState).toBe('3DEPARTED');
  });

  it('TC PORT avec timeOut mais visitState 2LOADED → statut reste PORT, donnees dpw captures', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', timeOut: '2026-04-15T14:00:00Z', visitState: '2LOADED' }],
      [mkTc('tc1', 'MSCU1', 'PORT')],
      mkDos(),
    );
    expect(res.tcUpdates).toHaveLength(1);
    expect(res.tcUpdates[0].st).toBeUndefined(); // pas de transition statut
    expect(res.tcUpdates[0].dpwTimeOut).toBe('2026-04-15');
    expect(res.tcUpdates[0].dpwVisitState).toBe('2LOADED');
  });

  it('ATTENDU directement DISPATCHE si timeOut + 3DEPARTED', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'MSCU1', timeIn: '2026-04-11T08:00:00Z', timeOut: '2026-04-15T14:00:00Z', visitState: '3DEPARTED' }],
      [mkTc('tc1', 'MSCU1', 'ATTENDU')],
      mkDos(),
    );
    expect(res.tcUpdates[0].st).toBe('DISPATCHE');
    expect(res.tcUpdates[0].dsp).toBe('2026-04-15');
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

describe('mapDPWorldToPatches — conflits', function () {
  it('signale NOT_FOUND si TC deja sync mais absent de la reponse DPWorld', function () {
    var tc = mkTc('tc1', 'MSCU1', 'PORT');
    tc.dpwSyncedAt = '2026-01-01T00:00:00Z';
    var res = mapDPWorldToPatches(
      [{ id: 'AUTRE', timeIn: '2026-04-10T08:00:00Z' }],
      [tc],
      mkDos(),
    );
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].conflict.type).toBe('NOT_FOUND');
  });

  it('ne signale PAS NOT_FOUND si TC jamais sync', function () {
    var res = mapDPWorldToPatches(
      [{ id: 'AUTRE', timeIn: '2026-04-10T08:00:00Z' }],
      [mkTc('tc1', 'MSCU1', 'PORT')],
      mkDos(),
    );
    expect(res.conflicts).toHaveLength(0);
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
