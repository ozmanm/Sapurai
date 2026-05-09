import SapuraiLogo from '../ui/SapuraiLogo.tsx';

var NAV = [
  { k: "dash", l: "Accueil", ic: "\uD83C\uDFE0" },
  { k: "dos", l: "Dossiers", ic: "\uD83D\uDCCB" },
  { k: "tcs", l: "Conteneurs", ic: "\uD83D\uDCE6" },
  { k: "dep", l: "Dépenses", ic: "\uD83D\uDCB0" },
  { k: "chs", l: "Chauffeurs", ic: "\uD83D\uDE9B" },
  { k: "caut", l: "Cautions", ic: "\uD83D\uDD12" },
  { k: "stats", l: "Stats", ic: "\uD83D\uDCCA" }
];

interface SidebarProps {
  vw: string;
  setVw: (v: string) => void;
  setQr: (q: string) => void;
  sideOpen: boolean;
  setSideOpen: (o: boolean) => void;
  enCours: number;
  critCount: number;
  canEdit: boolean;
  showTeam?: () => void;
  installEvt?: any;
  setInstallEvt: (e: any) => void;
  logout?: () => void;
  role: string;
  companyName: string;
  setMl: (ml: any) => void;
  theme: string;
  toggleTheme?: () => void;
}

function Sidebar(p: SidebarProps) {
  var vw = p.vw;
  var setVw = p.setVw;
  var setQr = p.setQr;
  var sideOpen = p.sideOpen;
  var setSideOpen = p.setSideOpen;
  var enCours = p.enCours;
  var critCount = p.critCount;
  var canEdit = p.canEdit;
  var showTeam = p.showTeam;
  var installEvt = p.installEvt;
  var setInstallEvt = p.setInstallEvt;
  var logout = p.logout;
  var role = p.role;
  var companyName = p.companyName;
  var setMl = p.setMl;
  var theme = p.theme;
  var toggleTheme = p.toggleTheme;

  return (
    <>
      <div className={"lt-sidebar-overlay" + (sideOpen ? " open" : "")} onClick={function () { setSideOpen(false); }}></div>
      <nav className={"lt-sidebar" + (sideOpen ? " open" : "")} aria-label="Navigation principale">
        <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.015em" }}>{companyName || "Sapurai"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{"Gestion de transit"}</div>
        </div>
        <div style={{ flex: 1, padding: "8px 0", overflow: "auto" }} role="menubar" aria-label="Menu principal">
          {NAV.map(function (t) {
            var isActive = vw === t.k;
            return <button key={t.k} role="menuitem" aria-current={isActive ? "page" : undefined} className={"lt-nav-item" + (isActive ? " active" : "")} onClick={function () { setVw(t.k); setQr(""); setSideOpen(false); }}>
              <span className="ic" aria-hidden="true">{t.ic}</span>
              <span>{t.l}</span>
              {t.k === "dos" ? <span style={{ marginLeft: "auto", color: isActive ? "var(--btn-primary-text)" : "var(--text-muted)", fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)" }}>{String(enCours)}</span> : null}
              {t.k === "dash" && critCount > 0 ? <span style={{ marginLeft: "auto", background: "var(--danger-bg)", color: "var(--danger)", padding: "1px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{String(critCount)}</span> : null}
            </button>;
          })}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
          {/* Dark mode toggle retire — desormais dans Parametres -> tab Preferences */}
          <button className="lt-nav-item" onClick={function () { setMl({ t: "logs" }); setSideOpen(false); }} style={{ color: "var(--purple)" }}><span className="ic">{"\uD83D\uDDC2\uFE0F"}</span><span>{"Historique des actions"}</span></button>
          {canEdit ? <button className="lt-nav-item" onClick={function () { setMl({ t: "settings" }); setSideOpen(false); }}><span className="ic">{"\u2699\uFE0F"}</span><span>{"Paramètres"}</span></button> : null}
          {/* Toggle Equipe retire — desormais dans Parametres -> tab Equipe (evite la repetition) */}
          {installEvt ? <button className="lt-nav-item" onClick={function () { installEvt.prompt(); installEvt.userChoice.then(function () { setInstallEvt(null); }); setSideOpen(false); }} style={{ color: "var(--success)" }}><span className="ic">{"\u2B07"}</span><span>{"Installer l'app"}</span></button> : null}
          {logout ? <button className="lt-nav-item" onClick={logout} style={{ color: "var(--danger)" }}><span className="ic">{"\u23FB"}</span><span>{"Déconnexion"}</span></button> : null}
        </div>
        {/* Pill role retire (deja dans topbar a droite) — propulse-par seul */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>{"Propulsé par "}<SapuraiLogo size={11} color="var(--text-secondary)" /></span>
        </div>
      </nav>
    </>
  );
}

export default Sidebar;
