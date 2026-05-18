import { useState } from 'react';
import { SL } from '../../constants/statuts.js';
import Overlay from './Overlay.tsx';
import ErrorBound from './ErrorBound.tsx';
import ImportExcel from '../../ImportExcel.tsx';
import ScanBL from '../../ScanBL.tsx';
import { isBetaCompany } from '../../constants/featureFlags';
import NChForm from '../chauffeurs/NChForm.tsx';
import DispForm from '../conteneurs/DispForm.tsx';
import LoadForm from '../conteneurs/LoadForm.tsx';
import TrancheForm from '../conteneurs/TrancheForm.tsx';
import NDepForm from '../dossiers/NDepForm.tsx';
import JdocView from '../dossiers/JdocView.tsx';
import PregateInput from '../dossiers/PregateInput.tsx';
import NDosForm from '../dossiers/NDosForm.tsx';
import DetView from '../dossiers/DetView.tsx';
import CliSearch from './CliSearch.tsx';
import SettingsForm from './SettingsForm.tsx';
import SyncReport from './SyncReport.tsx';
import TcTimeline from '../conteneurs/TcTimeline.tsx';
import DetentionModal from './DetentionModal.tsx';

var LOG_ICONS = { CREATION: "\uD83D\uDCC1", MODIF_DOSSIER: "\u270F\uFE0F", SUPPR_DOSSIER: "\uD83D\uDDD1\uFE0F", DISPATCH: "\uD83D\uDE9B", TC_STATUT: "\uD83D\uDCE6", AJOUT_DEPENSE: "\uD83D\uDCB8", MODIF_DEPENSE: "\u270F\uFE0F", SUPPR_DEPENSE: "\uD83D\uDDD1\uFE0F", PAIEMENT: "\uD83D\uDCB0", CLOTURE: "\u2705", ARCHIVE: "\uD83D\uDCE5", STATUT: "\uD83D\uDD04" };
var LOG_ACS = ["CREATION", "DISPATCH", "TC_STATUT", "AJOUT_DEPENSE", "PAIEMENT", "CLOTURE", "MODIF_DOSSIER", "ARCHIVE"];

function LogsModal(q) {
  var [filtAc, setFiltAc] = useState("");
  var sorted = (q.logs || []).slice().sort(function (a, b) { return a.dt < b.dt ? 1 : -1; });
  var filtered = filtAc ? sorted.filter(function (l) { return l.ac === filtAc; }) : sorted;
  var dos = q.dos || [];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={function () { setFiltAc(""); }} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: !filtAc ? "var(--btn-primary-bg)" : "var(--bg-secondary)", color: !filtAc ? "var(--btn-primary-text)" : "var(--text-secondary)" }}>{"Tous (" + String(sorted.length) + ")"}</button>
        {LOG_ACS.map(function (ac) {
          var cnt = sorted.filter(function (l) { return l.ac === ac; }).length;
          if (cnt === 0) return null;
          return <button key={ac} onClick={function () { setFiltAc(ac); }} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: filtAc === ac ? "var(--purple)" : "var(--bg-secondary)", color: filtAc === ac ? "white" : "var(--text-secondary)" }}>{(LOG_ICONS[ac] || "") + " " + ac.replace(/_/g, " ") + " (" + String(cnt) + ")"}</button>;
        })}
      </div>
      <div style={{ maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 ? <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 32, fontSize: 13 }}>{"Aucune entrée"}</div> : null}
        {filtered.map(function (l) {
          var d = dos.find(function (x) { return x.id === l.did; });
          var dt = l.dt ? new Date(l.dt) : null;
          var dateStr = dt ? dt.toLocaleDateString("fr-FR") + " " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
          return (
            <div key={l.id} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{LOG_ICONS[l.ac] || "\uD83D\uDD35"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{l.ds || l.ac}</div>
                {d ? <div style={{ fontSize: 11, color: "var(--purple)", marginTop: 2 }}>{d.cl + (d.bl ? " \u00B7 " + d.bl : "")}</div> : null}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, textAlign: "right" }}>{dateStr}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AppModalsProps { [key: string]: any; }

function AppModals(p: AppModalsProps) {
  var ml = p.ml;
  var setMl = p.setMl;
  var dos = p.dos;
  var tcs = p.tcs;
  var dep = p.dep;
  var chs = p.chs;
  var logs = p.logs;
  var cfg = p.cfg;
  var sv = p.sv;
  var db = p.db;
  var nf = p.nf;
  var canEdit = p.canEdit;
  var addDos = p.addDos;
  var editDos = p.editDos;
  var addCh = p.addCh;
  var editCh = p.editCh;
  var addDep = p.addDep;
  var editDep = p.editDep;
  var dispatch = p.dispatch;
  var assignTc = p.assignTc;
  var loadTc = p.loadTc;
  var advance = p.advance;
  var deleteDos = p.deleteDos;
  var closeDos = p.closeDos;
  var archiveDos = p.archiveDos;
  var setDosSt = p.setDosSt;
  var toggleDepSt = p.toggleDepSt;
  var patchDos = p.patchDos;
  var syncDPWorld = p.syncDPWorld;
  var syncTcDPWorld = p.syncTcDPWorld;
  var syncCMA = p.syncCMA;
  var humanPhrase = p.humanPhrase;
  var bulkImport = p.bulkImport;
  var advPending = p.advPending;
  var setAdvPending = p.setAdvPending;
  var shareTracking = p.shareTracking;
  var shareClientTracking = p.shareClientTracking;
  var companyId = p.companyId;
  var updateTcDate = p.updateTcDate;
  var updateGarantie = p.updateGarantie;
  var addTcPayment = p.addTcPayment;

  return (
    <>
      {ml && ml.t === "ndos" ? <Overlay close={function () { setMl(null); }} title="Nouveau dossier" w={820}><NDosForm allDos={dos} members={(p.teamProps || {}).members || []} onSave={addDos} onClose={function () { setMl(null); }} nf={nf} setMl={setMl} companyId={companyId} apiKey={cfg.geminiKey || ""} scan={ml.scan || null} /></Overlay> : null}
      {ml && ml.t === "edos" ? <Overlay close={function () { setMl(ml.prev || null); }} title="Modifier dossier" w={820}><NDosForm allDos={dos} members={(p.teamProps || {}).members || []} init={dos.find(function (d) { return d.id === ml.did; })} initTcs={tcs.filter(function (c) { return c.did === ml.did && (c.st === "PORT" || c.st === "ATTENDU"); })} onSave={function (f, tcl) { var prev = ml.prev; editDos(ml.did, f, tcl); if (prev) setTimeout(function () { setMl(prev); }, 0); }} onClose={function () { setMl(ml.prev || null); }} nf={nf} /></Overlay> : null}
      {ml && ml.t === "nch" ? <Overlay close={function () { setMl(null); }} title="Nouveau chauffeur" w={600}><NChForm onSave={addCh} onClose={function () { setMl(null); }} nf={nf} /></Overlay> : null}
      {ml && ml.t === "ech" ? <Overlay close={function () { setMl(null); }} title="Modifier chauffeur" w={600}><NChForm init={chs.find(function (c) { return c.id === ml.cid; })} onSave={function (d) { editCh(ml.cid, d); }} onClose={function () { setMl(null); }} nf={nf} /></Overlay> : null}
      {ml && ml.t === "disp" ? <Overlay close={function () { setMl(null); }} title="Dispatch" w={600}><DispForm tc={tcs.find(function (c) { return c.id === ml.tid; })} chs={chs} tcs={tcs} onDisp={dispatch} onAssign={assignTc} onClose={function () { setMl(null); }} goAddCh={function () { setMl({ t: "nch" }); }} nf={nf} /></Overlay> : null}
      {ml && ml.t === "load" ? <Overlay close={function () { setMl(null); }} title="Confirmer chargement" w={520}><LoadForm tc={tcs.find(function (c) { return c.id === ml.tid; })} onLoad={loadTc} onClose={function () { setMl(null); }} nf={nf} /></Overlay> : null}
      {ml && ml.t === "tcp" ? <Overlay close={function () { setMl(null); }} title="Versement transport" w={500}><TrancheForm tc={tcs.find(function (c) { return c.id === ml.tid; })} tranches={dep.filter(function (f) { return f.tcid === ml.tid && f.tp === "TRANSPORT"; })} onSave={function (ph, mt, note) { addTcPayment(ml.tid, ph, mt, note); }} onClose={function () { setMl(null); }} nf={nf} /></Overlay> : null}
      {ml && ml.t === "ndep" ? <Overlay close={function () { setMl(null); }} title="Nouvelle dépense" w={600}><NDepForm dos={dos} did={ml.did || ""} onSave={addDep} onClose={function () { setMl(null); }} nf={nf} companyId={companyId} /></Overlay> : null}
      {ml && ml.t === "edep" ? <Overlay close={function () { setMl(null); }} title="Modifier dépense" w={600}><NDepForm dos={dos} init={dep.find(function (f) { return f.id === ml.fid; })} did={(dep.find(function (f) { return f.id === ml.fid; }) || {}).did || ""} onSave={function (d) { editDep(ml.fid, d); }} onClose={function () { setMl(null); }} nf={nf} companyId={companyId} /></Overlay> : null}
      {ml && ml.t === "det" ? <Overlay close={function () { setMl(null); }} title="Détails" w={820}><ErrorBound onClose={function () { setMl(null); }}><DetView did={ml.did} dos={dos} tcs={tcs} dep={dep} logs={logs} cfg={cfg} advance={advance} setAdvPending={setAdvPending} updateTcDate={updateTcDate} deleteTc={p.deleteTc} editTcInfo={p.editTcInfo} updateGarantie={updateGarantie} setMl={setMl} dispatch={dispatch} deleteDos={deleteDos} closeDos={closeDos} archiveDos={archiveDos} setDosSt={setDosSt} toggleDepSt={toggleDepSt} patchDos={patchDos} syncDPWorld={syncDPWorld} syncTcDPWorld={syncTcDPWorld} syncCMA={syncCMA} syncCarrier={p.syncCarrier} humanPhrase={humanPhrase} sv={sv} db={db} canEdit={canEdit} shareTracking={shareTracking} companyId={companyId} nf={nf} /></ErrorBound></Overlay> : null}
      {ml && ml.t === "cli" ? <Overlay close={function () { setMl(null); }} title="Mode Client" w={700}><CliSearch dos={dos} tcs={tcs} nf={nf} shareClientTracking={shareClientTracking} /></Overlay> : null}
      {ml && ml.t === "jdoc" ? <Overlay close={function () { setMl(null); }} title="Documents justificatifs" w={600}><JdocView did={ml.did} dos={dos} sv={sv} db={db} nf={nf} setMl={setMl} companyId={companyId} /></Overlay> : null}
      {ml && ml.t === "pregate" ? <Overlay close={function () { setMl(null); }} title="Pregate - Facture DP World payee" w={420}><PregateInput did={ml.did} dos={dos} sv={sv} db={db} nf={nf} setMl={setMl} /></Overlay> : null}
      {ml && ml.t === "import" ? <Overlay close={function () { setMl(null); }} title="Importer depuis Excel/CSV" w={820}><ImportExcel bulkImport={bulkImport} dos={dos} tcs={tcs} onClose={function () { setMl(null); }} /></Overlay> : null}
      {/* Sprint 33 : modal scan via Cloudflare Workers AI, gate beta company uniquement */}
      {ml && ml.t === "scan" && isBetaCompany(companyId) ? <Overlay close={function () { setMl(null); }} title="Scanner un BL" w={520}><ScanBL onResult={function (r: any) { setMl({ t: "ndos", scan: r }); }} /></Overlay> : null}
      {ml && ml.t === "settings" ? <Overlay close={function () { setMl(null); }} title="Paramètres" w={720}><SettingsForm cfg={cfg} sv={sv} db={db} nf={nf} onClose={function () { setMl(null); }} theme={p.theme} toggleTheme={p.toggleTheme} teamProps={p.teamProps} /></Overlay> : null}
      {ml && ml.t === "syncreport" && ml.report ? <Overlay close={function () { setMl(null); }} title="Rapport de synchronisation DPWorld" w={720}><SyncReport report={ml.report} setMl={setMl} onClose={function () { setMl(null); }} /></Overlay> : null}
      {ml && ml.t === "tctimeline" && ml.tcid ? (function () {
        var theTc = (tcs || []).find(function (c: any) { return c.id === ml.tcid; });
        var theDos = theTc ? (dos || []).find(function (d: any) { return d.id === theTc.did; }) : null;
        if (!theTc || !theDos) return null;
        return <Overlay close={function () { setMl(ml.prev || null); }} title={"Conteneur " + (theTc.n || "?")} w={720}><TcTimeline tc={theTc} dos={theDos} dep={dep || []} cfg={cfg} setMl={setMl} onClose={function () { setMl(ml.prev || null); }} /></Overlay>;
      })() : null}
      {ml && ml.t === "detention" ? <Overlay close={function () { setMl(null); }} title="Détention conteneur — clôture conditionnelle" w={620}><DetentionModal did={ml.did} jours={ml.jours} depassement={ml.depassement} franchise={ml.franchise} dos={dos} cfg={cfg} addDep={p.addDep} patchDos={p.patchDos} closeDos={p.closeDos} onClose={function () { setMl(null); }} /></Overlay> : null}
      {ml && ml.t === "logs" ? <Overlay close={function () { setMl(ml.prev || null); }} title={(ml.did ? "Historique du dossier" : "Historique des actions") + " (" + String((logs || []).filter(function (l: any) { return ml.did ? l.did === ml.did : true; }).length) + " entrées)"} w={700}><LogsModal logs={(logs || []).filter(function (l: any) { return ml.did ? l.did === ml.did : true; })} dos={dos} /></Overlay> : null}
      {advPending ? <div onClick={function () { setAdvPending(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div onClick={function (e) { e.stopPropagation(); }} style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 24, width: 340, maxWidth: "90vw", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{"Confirmer l'avancement"}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            {(function () { var tc = tcs.find(function (c) { return c.id === advPending.tid; }); return tc ? tc.n : "?"; })() + " \u2192 " + (SL[advPending.ns] || advPending.ns)}
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>{"Date effective"}</label>
          <input type="date" value={advPending.dt} onChange={function (e) { setAdvPending(Object.assign({}, advPending, { dt: e.target.value })); }} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, marginBottom: 6, background: "var(--bg-secondary)", color: "var(--text-input)" }} />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>{"Modifiez si l'evenement a eu lieu un autre jour"}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={function () { setAdvPending(null); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-tertiary)" }}>{"Annuler"}</button>
            <button onClick={function () { advance(advPending.tid, advPending.ns, advPending.dt); setAdvPending(null); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{"Confirmer"}</button>
          </div>
        </div>
      </div> : null}
    </>
  );
}

export default AppModals;
