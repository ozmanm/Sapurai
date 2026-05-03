import { useState, useEffect, lazy, Suspense } from "react";
import './styles/layout.css';
import Sidebar from './components/layout/Sidebar.tsx';
import SapuraiLogo from './components/ui/SapuraiLogo.tsx';
import TopBar from './components/layout/TopBar.tsx';
const AppModals = lazy(() => import('./components/shared/AppModals.tsx'));
import useAppLogic from './hooks/useAppLogic.js';
import useAnalytics from './hooks/useAnalytics.js';
import useTheme from './hooks/useTheme.js';
import AgentView from './pages/AgentView.tsx';
import { isBetaCompany } from './constants/featureFlags.js';

const Dash  = lazy(() => import('./pages/Dash.tsx'));
const Dos   = lazy(() => import('./pages/Dos.tsx'));
const Tcs   = lazy(() => import('./pages/Tcs.tsx'));
const Dep   = lazy(() => import('./pages/Dep.tsx'));
const Chs   = lazy(() => import('./pages/Chs.tsx'));
const Stats = lazy(() => import('./pages/Stats.tsx'));
const Caut  = lazy(() => import('./pages/Caut.tsx'));
const OnboardingModal = lazy(() => import('./components/shared/OnboardingModal.tsx'));

var LOADING = <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{"Chargement..."}</div>;

interface AppProps { [key: string]: any; }

export default function App(props: AppProps) {
  var logout = props.logout;
  var role = props.role || "agent";
  var showTeam = props.showTeam;
  var canEdit = role === "admin" || role === "agent";
  var th = useTheme();

  var initVw = (window.location.hash || "").replace("#", "") || "dash";
  var validVws = ["dash", "dos", "tcs", "dep", "chs", "caut", "stats"];
  if (validVws.indexOf(initVw) < 0) initVw = "dash";
  var [vw, setVwRaw] = useState(initVw);
  function setVw(v) { setVwRaw(v); window.location.hash = v; if (v !== "dos") setFiltCl(""); }

  var [ml, setMl] = useState(null);
  var [qr, setQr] = useState("");
  var [gs, setGs] = useState("");
  var [gsOpen, setGsOpen] = useState(false);
  var [om, setOm] = useState(null);
  var [openTc, setOpenTc] = useState(null);
  var [advPending, setAdvPending] = useState(null);
  var [installEvt, setInstallEvt] = useState(null);
  var [installBannerDismissed, setInstallBannerDismissed] = useState(function () { return !!localStorage.getItem('lt_install_dismissed'); });
  function dismissInstallBanner() { localStorage.setItem('lt_install_dismissed', '1'); setInstallBannerDismissed(true); }
  function promptInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    installEvt.userChoice.then(function (c: any) {
      setInstallEvt(null);
      if (c && c.outcome === 'accepted') localStorage.setItem('lt_install_dismissed', '1');
    });
  }
  var [dosView, setDosView] = useState("table");
  var [dosFilter, setDosFilter] = useState("actif");
  var [filtCl, setFiltCl] = useState("");
  var [sideOpen, setSideOpen] = useState(false);
  var [urgOpen, setUrgOpen] = useState(false);
  var [showOb, setShowOb] = useState(function () { return !localStorage.getItem('lt_ob_' + (props.companyId || '')); });

  useEffect(function () {
    function onBip(e) { e.preventDefault(); setInstallEvt(e); }
    window.addEventListener("beforeinstallprompt", onBip);
    return function () { window.removeEventListener("beforeinstallprompt", onBip); };
  }, []);

  var L = useAppLogic({ db: props.db, sv: props.sv, ml: ml, setMl: setMl, sendNotif: props.sendNotif });

  // Wrapper autour du nouveau toggleDepSt (pattern return-value) :
  // traduit le `needsPregate` en ouverture de modale, preservant l'API des
  // consommateurs (Dep, DetView, AppModals) qui attendent un void.
  function toggleDepSt(depId: string): void {
    var r = L.toggleDepSt(depId);
    if (r && r.needsPregate) setMl({ t: "pregate", did: r.needsPregate.did });
  }

  // Afficher toast d'erreur si la sauvegarde Firestore echoue
  useEffect(function () {
    if (props.saveError) L.nf(props.saveError, "error");
  }, [props.saveError]);
  useAnalytics(props.companyId, vw);

  // Auto-sync DPWorld toutes les 60 min si l'app est ouverte
  // Dep [] : l'interval se monte une seule fois ; la ref L.syncAllDPWorld est lue au moment de l'appel
  useEffect(function () {
    var id = setInterval(function () {
      if (L.syncAllDPWorld && document.visibilityState === "visible") {
        L.syncAllDPWorld();
      }
    }, 60 * 60 * 1000);
    return function () { clearInterval(id); };
  }, []);

  // Q2 — Auto-sync CMA intelligent : scanner les dossiers CMA actifs et lancer
  // sync sur ceux qui matchent (J-5 a J+1 OU jamais sync) sans sync recent (>24h).
  // Economise drastiquement le quota CMA strict (20/h) tout en garantissant une
  // mise a jour avant l'arrivee du TC.
  //
  // Dep sur L.dos.length : se re-execute si un nouveau dossier est cree (cas
  // "creation dossier CMA -> sync auto immediat pour recuperer ETA").
  useEffect(function () {
    if (!L.syncCarrier) return;
    // Feature flag : auto-sync CMA reserve aux compagnies beta-testeuses
    if (!isBetaCompany(props.companyId)) return;
    var todayMs = Date.now();
    var dayMs = 86400000;
    var dosToSync = (L.dos || []).filter(function (d: any) {
      if (!d.bl) return false;
      if (d.st === "CLOTURE" || d.st === "ARCHIVE") return false;
      if (!d.cp || d.cp.toUpperCase().indexOf("CMA") < 0) return false;
      // Pas de sync recent (< 24h)
      if (d.lastCarrierSync) {
        var lastMs = new Date(d.lastCarrierSync).getTime();
        if (!isNaN(lastMs) && (todayMs - lastMs) < dayMs) return false;
      }
      // Jamais sync : declencher (cas creation dossier ou import Excel)
      if (!d.lastCarrierSync) return true;
      // Sinon : seulement si J-5 a J+1
      if (!d.da) return false;
      var arrivalMs = new Date(d.da).getTime();
      if (isNaN(arrivalMs)) return false;
      var diffJours = Math.floor((arrivalMs - todayMs) / dayMs);
      return diffJours >= -1 && diffJours <= 5;
    });
    // Sequencer les sync pour eviter de saturer le quota CMA (20/h)
    // Espace de 5s entre chaque appel = max 12/min, bien sous le quota
    dosToSync.forEach(function (d: any, i: number) {
      setTimeout(function () {
        if (L.syncCarrier) L.syncCarrier(d.id);
      }, i * 5000);
    });
  }, [L.dos.length]);

  if (role === "agent") {
    var agentName = props.agentName || "";
    var agentDos = agentName
      ? L.dos.filter(function (d) {
          return (d.itv || []).some(function (i) { return (i.nm || "").toUpperCase() === agentName.toUpperCase(); });
        })
      : [];
    return (
      <div>
        {L.tt ? <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: L.tt.t === "error" ? "var(--danger)" : "var(--success)", color: "white", padding: "14px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 99999 }}>{L.tt.m}</div> : null}
        <AgentView dos={agentDos} tcs={L.tcs} dep={L.dep} agentName={agentName} markTaskDone={L.markTaskDone} advance={L.advance} patchDos={L.patchDos} sv={props.sv} db={props.db} companyId={props.companyId} notifyAdmins={props.notifyAdmins} logout={props.logout} notifs={props.notifs || []} markNotifsRead={props.markNotifsRead} companyName={(props.db || {}).name || ""} />
      </div>
    );
  }

  if (role === "client") {
    var clientName = props.agentName || "";
    var clientDos = clientName
      ? L.dos.filter(function (d) { return (d.cl || "").toUpperCase() === clientName.toUpperCase(); })
      : [];
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-body)", fontFamily: "var(--font-sans)" }}>
        <div style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SapuraiLogo size={15} color="var(--text-primary)" />
          <button onClick={props.logout} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 14px", fontSize: 13, cursor: "pointer", color: "var(--text-tertiary)" }}>Déconnexion</button>
        </div>
        <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            {"Vos dossiers" + (clientName ? " \u2014 " + clientName : "")}
          </div>
          {clientDos.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40 }}>
              {clientName ? "Aucun dossier trouve pour ce compte" : "Compte client non configure — contactez votre transitaire"}
            </div>
          ) : clientDos.map(function (d) {
            var tcList = L.tcs.filter(function (t) { return t.did === d.id; });
            return (
              <div key={d.id} style={{ background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border)", padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                  {d.bl || "\u2014"}
                  {d.cp ? <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>{d.cp}</span> : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {d.da || ""}{tcList.length > 0 ? " \u00b7 " + tcList.length + " conteneur" + (tcList.length > 1 ? "s" : "") : ""}
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {tcList.map(function (tc) {
                    var stColors = { ATTENDU: "#94a3b8", PORT: "#64748b", DISPATCHE: "#2563eb", TRANSIT: "#d97706", KATI: "#7c3aed", BAMAKO: "var(--text-primary)", RETURNED: "#059669" };
                    var stLabels = { ATTENDU: "Attendu", PORT: "Au port", DISPATCHE: "Dispatche", TRANSIT: "En transit", KATI: "Kati", BAMAKO: "Bamako", RETURNED: "Retourne" };
                    return (
                      <span key={tc.id} style={{ background: stColors[tc.st] || "var(--text-muted)", color: "white", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5 }}>
                        {tc.n || tc.ty} · {stLabels[tc.st] || tc.st}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-body)", fontFamily: "var(--font-sans)" }} onClick={function () { if (gsOpen) setGsOpen(false); if (urgOpen) setUrgOpen(false); }}>

      {L.tt ? <div role="alert" aria-live="polite" style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: L.tt.t === "error" ? "var(--danger)" : L.tt.t === "warning" ? "var(--warning)" : "var(--success)", color: "white", padding: "14px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 99999, boxShadow: "0 4px 20px var(--shadow-lg)", maxWidth: "90vw" }}>{L.tt.m}</div> : null}

      {props.saveOk && !L.tt ? <div style={{ position: "fixed", bottom: 16, right: 16, background: "var(--success)", color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 99998, opacity: 0.85, boxShadow: "0 2px 8px var(--shadow-sm)" }}>{"Enregistre"}</div> : null}

      {/* Skip link a11y — premier element tabbable, saute vers le contenu */}
      <a href="#main-content" className="lt-skip-link">Aller au contenu principal</a>

      {/* Banner installation PWA — Phase 1.1 PWA optim */}
      {installEvt && !installBannerDismissed ? (
        <div style={{ background: "var(--text-primary)", color: "var(--bg-primary)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 250, fontFamily: "var(--font-sans)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 20 }}>{"⬇"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{"Installer Sapurai sur votre appareil"}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{"Acces rapide depuis l'ecran d'accueil + utilisation hors-ligne"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={promptInstall} style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{"Installer"}</button>
            <button onClick={dismissInstallBanner} style={{ background: "transparent", color: "var(--bg-primary)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", minHeight: 32, opacity: 0.8 }}>{"Plus tard"}</button>
          </div>
        </div>
      ) : null}

      <Sidebar vw={vw} setVw={setVw} setQr={setQr} sideOpen={sideOpen} setSideOpen={setSideOpen} enCours={L.enCours} critCount={L.critCount} canEdit={canEdit} showTeam={showTeam} installEvt={installEvt} setInstallEvt={setInstallEvt} logout={logout} role={role} companyName={(props.db || {}).name || ""} setMl={setMl} theme={th.theme} toggleTheme={th.toggleTheme} />

      <TopBar sideOpen={sideOpen} setSideOpen={setSideOpen} gs={gs} setGs={setGs} gsOpen={gsOpen} setGsOpen={setGsOpen} dos={L.dos} tcs={L.tcs} chs={L.chs} dep={L.dep} setMl={setMl} critCount={L.critCount} urgences={L.urgences} role={role} urgOpen={urgOpen} setUrgOpen={setUrgOpen} />

      <main className="lt-main" id="main-content" tabIndex={-1}>
        <Suspense fallback={LOADING}>
          {vw === "dash" ? (
            <Dash
              enCours={L.enCours} nCloture={L.nCloture} tcs={L.tcs} dep={L.dep} dos={L.dos}
              totalDep={L.totalDep} totalPaye={L.totalPaye} totalImpaye={L.totalImpaye} payePct={L.payePct}
              nAttendu={L.nAttendu} nPort={L.nPort} nTrans={L.nTrans} urgences={L.urgences} urgGrouped={L.urgGrouped}
              critCount={L.critCount} sysStatus={L.sysStatus} sysBg={L.sysBg} recent3={L.recent3}
              cautionsEnCours={L.cautionsEnCours}
              totalSurestariesJours={L.totalSurestariesJours} totalSurestariesFCFA={L.totalSurestariesFCFA} nSurestaries={L.nSurestaries}
              alertes={L.alertes} companyName={(props.db || {}).name || "SAPURAI"}
              canEdit={canEdit} setMl={setMl} setVw={setVw} setFilter={setFiltCl}
              syncAllDPWorld={L.syncAllDPWorld}
            />
          ) : null}
          {vw === "dos" ? (
            <Dos
              dos={L.dos} tcs={L.tcs} dep={L.dep} canEdit={canEdit}
              enCours={L.enCours} nCloture={L.nCloture}
              dosFilter={dosFilter} setDosFilter={setDosFilter}
              filtCl={filtCl} setFiltCl={setFiltCl}
              dosView={dosView} setDosView={setDosView}
              qr={qr} setQr={setQr} om={om} setOm={setOm}
              setMl={setMl} archiveDos={L.archiveDos} deleteDos={L.deleteDos}
              bulkDeleteDos={L.bulkDeleteDos}
              companyName={(props.db || {}).name || ""}
            />
          ) : null}
          {vw === "tcs" ? (
            <Tcs
              tcs={L.tcs} dos={L.dos} canEdit={canEdit}
              qr={qr} setQr={setQr} openTc={openTc} setOpenTc={setOpenTc}
              setMl={setMl} setAdvPending={setAdvPending}
              updateTcDate={L.updateTcDate} tcFranchise={L.tcFranchise} deleteTc={L.deleteTc} editTcInfo={L.editTcInfo}
            />
          ) : null}
          {vw === "dep" ? (
            <Dep
              dep={L.dep} dos={L.dos} canEdit={canEdit}
              qr={qr} setQr={setQr} setMl={setMl}
              toggleDepSt={toggleDepSt} deleteDep={L.deleteDep} ignoreDep={L.ignoreDep}
              companyName={(props.db || {}).name || ""}
            />
          ) : null}
          {vw === "chs" ? (
            <Chs
              chs={L.chs} tcs={L.tcs} dos={L.dos} canEdit={canEdit}
              setMl={setMl} deleteCh={L.deleteCh} nf={L.nf}
            />
          ) : null}
          {vw === "caut" ? <Caut dos={L.dos} tcs={L.tcs} setMl={setMl} updateGarantie={L.updateGarantie} patchTc={L.patchTc} /> : null}
          {vw === "stats" ? <Stats dos={L.dos} tcs={L.tcs} dep={L.dep} /> : null}
        </Suspense>
      </main>

      {showOb ? <Suspense fallback={null}><OnboardingModal companyName={(props.db || {}).name || ''} onClose={function () { localStorage.setItem('lt_ob_' + (props.companyId || ''), '1'); setShowOb(false); }} /></Suspense> : null}

      <Suspense fallback={null}><AppModals
        ml={ml} setMl={setMl}
        dos={L.dos} tcs={L.tcs} dep={L.dep} chs={L.chs} logs={L.logs} cfg={L.cfg}
        sv={props.sv} db={props.db} nf={L.nf} canEdit={canEdit}
        teamProps={props.teamProps}
        theme={th.theme} toggleTheme={th.toggleTheme}
        addDos={L.addDos} editDos={L.editDos}
        addCh={L.addCh} editCh={L.editCh}
        addDep={L.addDep} editDep={L.editDep}
        dispatch={L.dispatch} advance={L.advance} updateTcDate={L.updateTcDate} deleteTc={L.deleteTc} editTcInfo={L.editTcInfo} updateGarantie={L.updateGarantie} addTcPayment={L.addTcPayment}
        deleteDos={L.deleteDos} closeDos={L.closeDos} archiveDos={L.archiveDos} setDosSt={L.setDosSt}
        toggleDepSt={toggleDepSt} patchDos={L.patchDos} syncDPWorld={L.syncDPWorld} syncCMA={L.syncCMA} syncCarrier={isBetaCompany(props.companyId) ? L.syncCarrier : undefined} humanPhrase={L.humanPhrase} bulkImport={L.bulkImport}
        urgences={L.urgences} alertes={L.alertes}
        advPending={advPending} setAdvPending={setAdvPending}
        shareTracking={props.shareTracking} shareClientTracking={props.shareClientTracking} companyId={props.companyId}
      /></Suspense>
    </div>
  );
}
