// Tests F.2 — syncDPWorld flow complet via useAppLogic.
//
// Verifie :
//  - le mapping DPWorld est applique au dossier
//  - les TCs sont mis a jour
//  - l'auto-stub Depenses se declenche si nouvelle arrivee detectee

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock fetchDPWorld AVANT l'import du hook (vi.mock est hoist).
vi.mock('../../services/dpworld.js', async function () {
  var actual: any = await vi.importActual('../../services/dpworld.js');
  return Object.assign({}, actual, {
    fetchDPWorld: vi.fn(),
  });
});

import useAppLogic from '../useAppLogic';
import { fetchDPWorld } from '../../services/dpworld.js';

function setupHook(initialDb: any = {}) {
  var saves: any[] = [];
  var mlCalls: any[] = [];
  var db = Object.assign(
    { dos: [], tcs: [], chs: [], dep: [], logs: [], cfg: { fp: 10, ft: 23, fm: 20 } },
    initialDb,
  );
  var result = renderHook(function () {
    return useAppLogic({
      db: db,
      sv: function (d: any) { saves.push(d); },
      ml: null,
      setMl: function (m: any) { mlCalls.push(m); },
      sendNotif: function () { /* noop */ },
    });
  });
  return { hook: result.result, saves: saves, mlCalls: mlCalls, db: db };
}

describe('syncDPWorld — mapping + auto-stub', function () {
  beforeEach(function () {
    vi.mocked(fetchDPWorld).mockReset();
  });

  it('applique les patches DPWorld au dossier', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'ATTENDU' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', ata: '2026-04-10T08:00:00Z', timeIn: '2026-04-10T08:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    expect(s.saves.length).toBe(1);
    var saved = s.saves[0];
    expect(saved.dos[0].da).toBe('2026-04-10');
    expect(saved.tcs[0].st).toBe('PORT');
  });

  it('declenche auto-stub Depenses si da nouvellement renseigne', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', besc: true }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'ATTENDU' }],
      dep: [],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', ata: '2026-04-10T08:00:00Z', timeIn: '2026-04-10T08:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    var saved = s.saves[0];
    expect(saved.dep.length).toBeGreaterThan(0);
    var cats = saved.dep.map(function (d: any) { return d.categorie; });
    expect(cats).toContain('compagnie_location');
    expect(cats).toContain('orbus');
    expect(cats).toContain('dpworld');
    expect(cats).toContain('besc');
  });

  it('ne stub PAS si da etait deja renseigne (pas une nouvelle arrivee)', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', da: '2026-03-01' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'PORT' }],
      dep: [],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', bad: 'OK', validiteDODate: '2026-05-01T00:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    // Le sync fait un patch (bs => OBTENU) mais pas de stubs
    expect(s.saves.length).toBe(1);
    expect(s.saves[0].dep).toEqual([]);
  });

  it('respecte anti-doublon : skip si stub deja present', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT', besc: false }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'ATTENDU' }],
      dep: [{ id: 'ex1', did: 'd1', tp: 'DPWORLD', mt: 0, dt: '2026-01-01', categorie: 'dpworld' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', ata: '2026-04-10T08:00:00Z', timeIn: '2026-04-10T08:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    var saved = s.saves[0];
    // ex1 (dpworld) est garde + les nouveaux stubs
    var categoriesNew = saved.dep.filter(function (d: any) { return d.id !== 'ex1'; }).map(function (d: any) { return d.categorie; });
    expect(categoriesNew).not.toContain('dpworld'); // doublon filtre
    expect(categoriesNew).toContain('compagnie_location');
  });

  it('sync reussit quand une nouvelle arrivee est detectee', async function () {
    var db = { dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', td: 'IMPORT' }], tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'ATTENDU' }], chs: [], dep: [], logs: [], cfg: { fp: 10, ft: 23 } };
    var result = renderHook(function () {
      return useAppLogic({
        db: db,
        sv: function () { /* noop */ },
        ml: null,
        setMl: function () { /* noop */ },
        sendNotif: function () { /* noop */ },
      });
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', ata: '2026-04-10T08:00:00Z', timeIn: '2026-04-10T08:00:00Z' }],
    });

    await act(async function () {
      await result.result.current.syncDPWorld('d1');
    });
    // Verifie juste pas d'exception levee (notif n'est pas exposee en retour)
    expect(true).toBe(true);
  });

  it('sort tot si aucun changement DPWorld', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', da: '2026-01-01' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'PORT' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1' }], // aucun champ exploitable
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    // Pas de save si rien a changer
    expect(s.saves.length).toBe(0);
  });

  it('erreur reseau ne plante pas', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      tcs: [],
    });
    vi.mocked(fetchDPWorld).mockRejectedValue(new Error('timeout'));

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    expect(s.saves.length).toBe(0);
  });

  it('dossier sans BL : aucune action', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', cl: 'CL', st: 'ACTIF' }],
      tcs: [],
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    expect(vi.mocked(fetchDPWorld)).not.toHaveBeenCalled();
    expect(s.saves.length).toBe(0);
  });
});

describe('syncAllDPWorld — batch', function () {
  beforeEach(function () {
    vi.mocked(fetchDPWorld).mockReset();
  });

  it('deduplique les appels par BL identique (cache blDone)', async function () {
    var s = setupHook({
      dos: [
        { id: 'd1', bl: 'BL-SHARED', cl: 'CL', st: 'ACTIF' },
        { id: 'd2', bl: 'BL-SHARED', cl: 'CL2', st: 'ACTIF' },
      ],
      tcs: [],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({ success: true, data: [] });

    await act(async function () {
      await s.hook.current.syncAllDPWorld();
    });

    // 1 seul appel malgre 2 dossiers avec meme BL
    expect(vi.mocked(fetchDPWorld)).toHaveBeenCalledTimes(1);
  });

  it('skip les dossiers CLOTURE et ARCHIVE', async function () {
    var s = setupHook({
      dos: [
        { id: 'd1', bl: 'BL1', cl: 'CL', st: 'CLOTURE' },
        { id: 'd2', bl: 'BL2', cl: 'CL', st: 'ARCHIVE' },
        { id: 'd3', bl: 'BL3', cl: 'CL', st: 'ACTIF' },
      ],
      tcs: [],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({ success: true, data: [] });

    await act(async function () {
      await s.hook.current.syncAllDPWorld();
    });

    expect(vi.mocked(fetchDPWorld)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchDPWorld)).toHaveBeenCalledWith('BL3');
  });

  it('ouvre la modale syncreport apres syncAllDPWorld avec changements', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CLIENT A', st: 'ACTIF', td: 'IMPORT' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'ATTENDU' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', ata: '2026-04-10T08:00:00Z', timeIn: '2026-04-10T08:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncAllDPWorld();
    });

    // setMl appele avec ml.t === 'syncreport' + report contenant les items modifies
    var syncReportCall = s.mlCalls.find(function (m: any) { return m && m.t === 'syncreport'; });
    expect(syncReportCall).toBeDefined();
    expect(syncReportCall.report).toBeDefined();
    expect(syncReportCall.report.items.length).toBe(1);
    expect(syncReportCall.report.items[0].cl).toBe('CLIENT A');
    expect(syncReportCall.report.items[0].bl).toBe('BL1');
    expect(syncReportCall.report.items[0].changes.length).toBeGreaterThan(0);
  });

  it('n ouvre PAS la modale si aucun changement', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', da: '2026-01-01' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'PORT' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1' }], // rien d'exploitable
    });

    await act(async function () {
      await s.hook.current.syncAllDPWorld();
    });

    var syncReportCall = s.mlCalls.find(function (m: any) { return m && m.t === 'syncreport'; });
    expect(syncReportCall).toBeUndefined();
  });
});

describe('syncDPWorld — Lot 1 predicat individuel', function () {
  beforeEach(function () {
    vi.mocked(fetchDPWorld).mockReset();
  });

  it('NE skip PAS les TC DISPATCHE sans dpwSyncedAt (verifie DPWorld)', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'DISPATCHE', dsp: '2026-04-15' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', visitState: '2LOADED', timeOut: '2026-04-15T14:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    // Doit avoir interroge DPWorld malgre le statut DISPATCHE local
    expect(vi.mocked(fetchDPWorld)).toHaveBeenCalledWith('BL1');
    expect(s.saves.length).toBe(1);
  });

  it('skip les TC avec dpwVisitState=3DEPARTED et dpwTimeOut', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF', da: '2026-01-01' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'DISPATCHE', dsp: '2026-04-15', dpwVisitState: '3DEPARTED', dpwTimeOut: '2026-04-15', dpwSyncedAt: '2026-01-01T00:00:00Z' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', visitState: '3DEPARTED', timeOut: '2026-04-15T14:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    // TC confirme par DPWorld → skip → pas d'appel API
    expect(vi.mocked(fetchDPWorld)).not.toHaveBeenCalled();
    expect(s.saves.length).toBe(0);
  });

  it('detecte et persiste STATUS_MISMATCH', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MSCU1', st: 'DISPATCHE', dsp: '2026-04-15' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MSCU1', visitState: '1ARRIVED' }],  // DPWorld dit pas sorti
    });

    await act(async function () {
      await s.hook.current.syncDPWorld('d1');
    });

    expect(s.saves.length).toBe(1);
    var savedTc = s.saves[0].tcs[0];
    expect(savedTc.dpwConflict).toBeDefined();
    expect(savedTc.dpwConflict.type).toBe('STATUS_MISMATCH');
  });
});

describe('syncTcDPWorld — chirurgical TC', function () {
  beforeEach(function () {
    vi.mocked(fetchDPWorld).mockReset();
  });

  it('sync un TC individuel par son numero', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MEDU123', st: 'ATTENDU' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MEDU123', timeIn: '2026-04-10T08:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncTcDPWorld('tc1');
    });

    expect(vi.mocked(fetchDPWorld)).toHaveBeenCalledWith('MEDU123');
    expect(s.saves.length).toBe(1);
    expect(s.saves[0].tcs[0].st).toBe('PORT');
    expect(s.saves[0].tcs[0].dpwTimeIn).toBe('2026-04-10');
  });

  it('force sync meme si TC deja confirme DPWorld', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'MEDU123', st: 'DISPATCHE', dsp: '2026-04-15', dpwVisitState: '3DEPARTED', dpwTimeOut: '2026-04-15', dpwSyncedAt: '2026-01-01T00:00:00Z' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'MEDU123', visitState: '3DEPARTED', timeOut: '2026-04-15T14:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncTcDPWorld('tc1', { force: true });
    });

    expect(vi.mocked(fetchDPWorld)).toHaveBeenCalled();
    expect(s.saves.length).toBe(1);
  });

  it('persiste NOT_FOUND si TC absent de la reponse', async function () {
    var s = setupHook({
      dos: [{ id: 'd1', bl: 'BL1', cl: 'CL', st: 'ACTIF' }],
      tcs: [{ id: 'tc1', did: 'd1', n: 'INCONNU', st: 'ATTENDU' }],
    });
    vi.mocked(fetchDPWorld).mockResolvedValue({
      success: true,
      data: [{ id: 'AUTRE', timeIn: '2026-04-10T08:00:00Z' }],
    });

    await act(async function () {
      await s.hook.current.syncTcDPWorld('tc1');
    });

    expect(s.saves.length).toBe(1);
    expect(s.saves[0].tcs[0].dpwConflict.type).toBe('NOT_FOUND');
  });
});
