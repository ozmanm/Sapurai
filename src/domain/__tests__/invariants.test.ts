import { describe, it, expect } from 'vitest';
import {
  isDaFuture,
  canDispatchTc,
  canAdvanceTc,
  deriveDossierStatus,
  reconcileDossierState,
} from '../invariants';

function daysFromToday(n: number): string {
  var d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function mkDos(overrides: any = {}): any {
  return Object.assign({ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT' }, overrides);
}
function mkTc(overrides: any = {}): any {
  return Object.assign({ id: 't1', did: 'd1', n: 'TC1', ty: '40HC', st: 'ATTENDU' }, overrides);
}

describe('isDaFuture', () => {
  it('retourne false si pas de da', () => {
    expect(isDaFuture(mkDos({ da: null }))).toBe(false);
    expect(isDaFuture(null)).toBe(false);
  });
  it('retourne true si da > today', () => {
    expect(isDaFuture(mkDos({ da: daysFromToday(5) }))).toBe(true);
  });
  it('retourne false si da == today', () => {
    expect(isDaFuture(mkDos({ da: daysFromToday(0) }))).toBe(false);
  });
  it('retourne false si da < today (passe)', () => {
    expect(isDaFuture(mkDos({ da: daysFromToday(-3) }))).toBe(false);
  });
});

describe('canDispatchTc', () => {
  it('refuse si tc.st != PORT', () => {
    var r = canDispatchTc(mkTc({ st: 'ATTENDU' }), mkDos({ da: daysFromToday(-5), as2: 'OBTENU' }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('port');
  });
  it('refuse si da future', () => {
    var r = canDispatchTc(mkTc({ st: 'PORT' }), mkDos({ da: daysFromToday(15), as2: 'OBTENU' }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('futur');
  });
  it('refuse si pas de BAE ni Pregate', () => {
    var r = canDispatchTc(mkTc({ st: 'PORT' }), mkDos({ da: daysFromToday(-5) }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('BAE');
  });
  it('autorise si tc.st=PORT + da past + BAE obtenu', () => {
    var r = canDispatchTc(mkTc({ st: 'PORT' }), mkDos({ da: daysFromToday(-5), as2: 'OBTENU' }));
    expect(r.ok).toBe(true);
  });
  it('autorise si tc.st=PORT + da past + Pregate (pn)', () => {
    var r = canDispatchTc(mkTc({ st: 'PORT' }), mkDos({ da: daysFromToday(-5), pn: true }));
    expect(r.ok).toBe(true);
  });
});

describe('canAdvanceTc', () => {
  it('refuse une transition interdite par la machine d etat', () => {
    var r = canAdvanceTc(mkTc({ st: 'RETURNED' }), mkDos({ da: daysFromToday(-5) }), 'TRANSIT');
    expect(r.ok).toBe(false);
  });
  it('refuse ATTENDU -> PORT si da future', () => {
    var r = canAdvanceTc(mkTc({ st: 'ATTENDU' }), mkDos({ da: daysFromToday(10) }), 'PORT');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('futur');
  });
  it('autorise ATTENDU -> PORT si da past', () => {
    var r = canAdvanceTc(mkTc({ st: 'ATTENDU' }), mkDos({ da: daysFromToday(-2) }), 'PORT');
    expect(r.ok).toBe(true);
  });
  it('refuse PORT -> DISPATCHE si da future', () => {
    var r = canAdvanceTc(mkTc({ st: 'PORT' }), mkDos({ da: daysFromToday(10), as2: 'OBTENU' }), 'DISPATCHE');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('futur');
  });
  it('autorise DISPATCHE -> TRANSIT meme si da... peu importe', () => {
    var r = canAdvanceTc(mkTc({ st: 'DISPATCHE' }), mkDos({ da: daysFromToday(-5), as2: 'OBTENU' }), 'TRANSIT');
    expect(r.ok).toBe(true);
  });
});

describe('deriveDossierStatus', () => {
  it('force INITIALISE si da future, peu importe tc.st', () => {
    // Cas reel rapporte : da future + TC marques DISPATCHE => doit etre INITIALISE
    var dos = mkDos({ st: 'EN_TRANSIT', da: daysFromToday(15) });
    var tcs = [mkTc({ st: 'DISPATCHE' })];
    expect(deriveDossierStatus(dos, tcs)).toBe('INITIALISE');
  });
  it('INITIALISE si tous TC ATTENDU et da past', () => {
    var dos = mkDos({ st: 'SECURISE', da: daysFromToday(-1) });
    var tcs = [mkTc({ st: 'ATTENDU' }), mkTc({ id: 't2', st: 'ATTENDU' })];
    expect(deriveDossierStatus(dos, tcs)).toBe('INITIALISE');
  });
  it('SECURISE si au moins un TC PORT et da past', () => {
    var dos = mkDos({ st: 'INITIALISE', da: daysFromToday(-2) });
    var tcs = [mkTc({ st: 'PORT' }), mkTc({ id: 't2', st: 'ATTENDU' })];
    expect(deriveDossierStatus(dos, tcs)).toBe('SECURISE');
  });
  it('EN_TRANSIT si tous TC actifs en transit', () => {
    var dos = mkDos({ st: 'SECURISE', da: daysFromToday(-5) });
    var tcs = [mkTc({ st: 'DISPATCHE' }), mkTc({ id: 't2', st: 'BAMAKO' })];
    expect(deriveDossierStatus(dos, tcs)).toBe('EN_TRANSIT');
  });
  it('ne touche pas CLOTURE', () => {
    var dos = mkDos({ st: 'CLOTURE', da: daysFromToday(-5) });
    var tcs = [mkTc({ st: 'PORT' })];
    expect(deriveDossierStatus(dos, tcs)).toBe(null);
  });
  it('retourne null si pas de changement', () => {
    var dos = mkDos({ st: 'INITIALISE', da: daysFromToday(10) });
    var tcs = [mkTc({ st: 'ATTENDU' })];
    expect(deriveDossierStatus(dos, tcs)).toBe(null);
  });
});

describe('reconcileDossierState', () => {
  it('retrograde les TC PORT/DISPATCHE en ATTENDU si da future', () => {
    var dos = [mkDos({ st: 'EN_TRANSIT', da: daysFromToday(15) })];
    var tcs = [mkTc({ st: 'DISPATCHE', dsp: '2026-05-01' })];
    var res = reconcileDossierState(dos, tcs);
    expect(res.tcs[0].st).toBe('ATTENDU');
    expect(res.tcs[0].dsp).toBeUndefined();
    expect(res.dos[0].st).toBe('INITIALISE');
  });

  it('option fixTcStatusOnFutureDa=false desactive la retrogradation', () => {
    var dos = [mkDos({ st: 'EN_TRANSIT', da: daysFromToday(15) })];
    var tcs = [mkTc({ st: 'DISPATCHE', dsp: '2026-05-01' })];
    var res = reconcileDossierState(dos, tcs, { fixTcStatusOnFutureDa: false });
    expect(res.tcs[0].st).toBe('DISPATCHE');  // pas retrograde
    expect(res.dos[0].st).toBe('INITIALISE');  // mais dossier corrige quand meme
  });

  it('cas reel : da future + TC dispatche => apres reconcile, dossier INITIALISE + TC ATTENDU', () => {
    var dos = [mkDos({ id: 'd1', st: 'EN_TRANSIT', da: daysFromToday(15) })];  // futur (dynamique, immune au time-rot)
    var tcs = [
      mkTc({ id: 't1', did: 'd1', st: 'DISPATCHE', dsp: '2026-05-10' }),
      mkTc({ id: 't2', did: 'd1', st: 'DISPATCHE', dsp: '2026-05-10' }),
    ];
    var res = reconcileDossierState(dos, tcs);
    expect(res.dos[0].st).toBe('INITIALISE');
    expect(res.tcs[0].st).toBe('ATTENDU');
    expect(res.tcs[1].st).toBe('ATTENDU');
  });

  it('ne modifie rien si tout est coherent', () => {
    var dos = [mkDos({ st: 'EN_TRANSIT', da: daysFromToday(-10) })];
    var tcs = [mkTc({ st: 'DISPATCHE' })];
    var res = reconcileDossierState(dos, tcs);
    expect(res.dos[0].st).toBe('EN_TRANSIT');
    expect(res.tcs[0].st).toBe('DISPATCHE');
  });
});
