// useAppLogic — orchestrator
//
// Version post-refactor E : le "God-hook" de 639 lignes a ete decoupe en 8
// hooks specialises (par domaine metier). Ce fichier compose les resultats
// pour offrir une API unique a App.tsx.
//
// Objectifs du split :
// - Responsabilite unique par fichier (Single Responsibility)
// - Testabilite par domaine (possibilite de tester les actions en isolation)
// - Lisibilite : chaque fichier fait <200 lignes vs 639 avant
//
// API publique inchangee : tous les appels depuis App.tsx et les tests F.1
// restent valides, SAUF toggleDepSt qui applique le nouveau pattern
// return-value (decision TODO #1 Option A dans NOTES-PRODUCT.md) :
//   Avant : toggleDepSt(id) -> void, declenche setMl({t: "pregate"}) en interne
//   Apres : toggleDepSt(id) -> { ok, needsPregate? } — caller decide de l'UI
//
// Les hooks composes :
// - useToast             : toast notifications (tt state + nf)
// - useAppMetrics        : counters + urgences agregees + alertes franchise
// - useDossierActions    : CRUD dossiers + close/archive/patch + garantie + taches
// - useConteneurActions  : dispatch + advance + updateTcDate + helpers (humanPhrase, tcFranchise)
// - useChauffeurActions  : CRUD chauffeurs
// - useDepenseActions    : CRUD depenses + toggleDepSt (pattern return-value)
// - useDPWorldSync       : syncDPWorld + syncAllDPWorld
// - useImportActions     : bulkImport

import { useEffect } from 'react';
import { mid } from '../utils/id.js';
import { today } from '../utils/date.js';
import useToast from './useToast.js';
import useAppMetrics from './useAppMetrics.js';
import useDossierActions from './useDossierActions.js';
import useConteneurActions from './useConteneurActions.js';
import useChauffeurActions from './useChauffeurActions.js';
import useDepenseActions from './useDepenseActions.js';
import useDPWorldSync from './useDPWorldSync.js';
import useCMASync from './useCMASync';
import useCarrierSync from './useCarrierSync';
import useImportActions from './useImportActions.js';
import type { Dossier, Conteneur, Depense, Chauffeur } from '../types.js';

interface UseAppLogicParams {
  db: any;
  sv: (data: any) => void;
  ml: any;
  setMl: (ml: any) => void;
  sendNotif?: (to: string, msg: string) => void;
}

export default function useAppLogic({ db, sv, ml, setMl, sendNotif }: UseAppLogicParams) {
  // Toast notifications (extrait dans useToast)
  var toast = useToast();
  var nf = toast.nf;

  // Derivation des listes typees depuis db
  var dos: Dossier[] = db.dos || [];
  var tcs: Conteneur[] = db.tcs || [];
  var chs: Chauffeur[] = db.chs || [];
  var dep: Depense[] = db.dep || [];
  var logs: any[] = db.logs || [];
  var cfg: any = Object.assign({ fp: 10, ft: 23, fm: 20 }, db.cfg || {});

  // Helper partage wLog (append a l'historique avec limite 500 entries)
  function wLog(data: any, did: string, action: string, detail?: string): any {
    var entry = { id: mid(), did: did || "", dt: new Date().toISOString(), ac: action, ds: detail || "" };
    var nl = (data.logs || logs).concat([entry]);
    if (nl.length > 500) nl = nl.slice(nl.length - 500);
    return Object.assign({}, data, { logs: nl });
  }

  // Auto-sync ATTENDU <-> PORT selon d.da vs aujourd'hui
  var todayStr = today();
  useEffect(function () {
    var toPromote: string[] = [];
    var toDemote: string[] = [];
    tcs.forEach(function (tc) {
      var d = dos.find(function (x) { return x.id === tc.did; });
      if (!d || !d.da) return;
      if (tc.st === "ATTENDU" && d.da <= todayStr) toPromote.push(tc.id);
      if (tc.st === "PORT" && d.da > todayStr) toDemote.push(tc.id);
    });
    if (toPromote.length > 0 || toDemote.length > 0) {
      var newTcs = tcs.map(function (c) {
        if (toPromote.indexOf(c.id) >= 0) return Object.assign({}, c, { st: "PORT" });
        if (toDemote.indexOf(c.id) >= 0) return Object.assign({}, c, { st: "ATTENDU" });
        return c;
      });
      sv(Object.assign({}, db, { tcs: newTcs }));
    }
  }, [tcs, dos, todayStr]);

  // Compose les 8 hooks specialises
  var metrics = useAppMetrics(dos, tcs, dep, cfg);
  var dossierActions = useDossierActions({ db, sv, wLog, nf, setMl, sendNotif, dos, tcs, dep, ml });
  var conteneurActions = useConteneurActions({ db, sv, wLog, nf, setMl, dos, tcs, dep, cfg });
  var chauffeurActions = useChauffeurActions({ db, sv, nf, setMl, chs });
  var depenseActions = useDepenseActions({ db, sv, wLog, nf, setMl, dos, dep });
  var dpworldSync = useDPWorldSync({ db, sv, wLog, nf, setMl, dos, tcs });
  var cmaSync = useCMASync({ db, sv, wLog, nf, setMl, dos, tcs });
  var carrierSync = useCarrierSync({ db, sv, wLog, nf, setMl, dos, tcs });
  var importActions = useImportActions({ db, sv, nf, dos, tcs, chs, dep, logs });

  // API publique (forme identique au legacy, sauf toggleDepSt nouvelle signature)
  return {
    // Toast
    tt: toast.tt,
    nf: nf,

    // Donnees brutes (derivees de db)
    dos, tcs, chs, dep, logs, cfg,

    // Compteurs et urgences (depuis useAppMetrics)
    totalDep: metrics.totalDep,
    enCours: metrics.enCours,
    nAttendu: metrics.nAttendu,
    nPort: metrics.nPort,
    nTrans: metrics.nTrans,
    totalPaye: metrics.totalPaye,
    totalImpaye: metrics.totalImpaye,
    payePct: metrics.payePct,
    nCloture: metrics.nCloture,
    alertes: metrics.alertes,
    urgences: metrics.urgences,
    urgGrouped: metrics.urgGrouped,
    recent3: metrics.recent3,
    critCount: metrics.critCount,
    sysStatus: metrics.sysStatus,
    sysBg: metrics.sysBg,
    cautionsEnCours: metrics.cautionsEnCours,
    totalSurestariesJours: metrics.totalSurestariesJours,
    totalSurestariesFCFA: metrics.totalSurestariesFCFA,
    nSurestaries: metrics.nSurestaries,

    // Actions dossiers
    deleteDos: dossierActions.deleteDos,
    bulkDeleteDos: dossierActions.bulkDeleteDos,
    addDos: dossierActions.addDos,
    editDos: dossierActions.editDos,
    closeDos: dossierActions.closeDos,
    archiveDos: dossierActions.archiveDos,
    setDosSt: dossierActions.setDosSt,
    patchDos: dossierActions.patchDos,
    updateGarantie: dossierActions.updateGarantie,
    markTaskDone: dossierActions.markTaskDone,

    // Actions conteneurs
    dispatch: conteneurActions.dispatch,
    addTcPayment: conteneurActions.addTcPayment,
    advance: conteneurActions.advance,
    updateTcDate: conteneurActions.updateTcDate,
    patchTc: conteneurActions.patchTc,
    deleteTc: conteneurActions.deleteTc,
    editTcInfo: conteneurActions.editTcInfo,
    humanPhrase: conteneurActions.humanPhrase,
    tcFranchise: conteneurActions.tcFranchise,

    // Actions chauffeurs
    addCh: chauffeurActions.addCh,
    editCh: chauffeurActions.editCh,
    deleteCh: chauffeurActions.deleteCh,

    // Actions depenses (toggleDepSt = signature nouvelle, return-value)
    addDep: depenseActions.addDep,
    editDep: depenseActions.editDep,
    deleteDep: depenseActions.deleteDep,
    ignoreDep: depenseActions.ignoreDep,
    toggleDepSt: depenseActions.toggleDepSt,

    // DPWorld
    syncDPWorld: dpworldSync.syncDPWorld,
    syncAllDPWorld: dpworldSync.syncAllDPWorld,

    // CMA-CGM (sync uniquement par dossier — pas de Sync All a cause du quota 20/h)
    syncCMA: cmaSync.syncCMA,

    // Carrier generique (scraping multi-armateurs : CMA, Maersk, MSC, Hapag, ONE, Grimaldi)
    syncCarrier: carrierSync.syncCarrier,

    // Import
    bulkImport: importActions.bulkImport,
  };
}
