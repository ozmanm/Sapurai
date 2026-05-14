import React, { useState, useEffect, lazy, Suspense } from 'react';
import type { CSSProperties } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import useData from './useData.js';
import useFCM from './hooks/useFCM.ts';
import { PageSkeleton } from './components/ui/Skeleton.tsx';
import './styles/theme.css';
import './styles/layout.css';
import './styles/print.css';

var SUPER_ADMIN_CACHE: string | null = null;

async function isSuperAdmin(uid: string): Promise<boolean> {
  if (SUPER_ADMIN_CACHE === uid) return true;
  try {
    var snap = await getDoc(doc(db, 'superAdmins', uid));
    if (snap.exists()) { SUPER_ADMIN_CACHE = uid; return true; }
  } catch (_e) { /* pas super-admin */ }
  return false;
}

const Login        = lazy(() => import('./Login.tsx'));
const Landing      = lazy(() => import('./Landing.tsx'));
const Setup        = lazy(() => import('./Setup.tsx'));
const App          = lazy(() => import('./App.tsx'));
const TeamPanel    = lazy(() => import('./TeamPanel.tsx'));
const TrackingPage = lazy(() => import('./TrackingPage.tsx'));
const SuperAdmin   = lazy(() => import('./pages/SuperAdmin.tsx'));

// Global error boundary — prevents blank pages
interface GEBProps { children?: React.ReactNode }
interface GEBState { err: Error | null }

class GlobalErrorBoundary extends React.Component<GEBProps, GEBState> {
  constructor(props: GEBProps) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err: Error) { return { err: err }; }
  render() {
    if (this.state.err) {
      return React.createElement("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--danger-bg)", fontFamily: "var(--font-sans)", padding: 20 } },
        React.createElement("div", { style: { maxWidth: 500, textAlign: "center" } },
          React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u26A0\uFE0F"),
          React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: "var(--text-primary)", marginBottom: 8 } }, "SAPURAI"),
          React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: "var(--danger-text)", marginBottom: 12 } }, "Une erreur est survenue"),
          React.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-primary)", padding: 14, borderRadius: 8, fontFamily: "var(--font-mono)", textAlign: "left", wordBreak: "break-all", marginBottom: 16, border: "1px solid var(--danger-border)" } }, String(this.state.err.message || this.state.err)),
          React.createElement("button", { onClick: function () { window.location.reload(); }, style: { background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer" } }, "Recharger")
        )
      );
    }
    return this.props.children;
  }
}

function TrackingRoute() {
  var params = useParams();
  return React.createElement(TrackingPage, {
    tokId: params.tokId,
  });
}

function Root() {
  return React.createElement(
    BrowserRouter,
    null,
    React.createElement(
      Routes,
      null,
      React.createElement(Route, { path: '/t/:tokId', element: React.createElement(TrackingRoute) }),
      React.createElement(Route, { path: '*', element: React.createElement(AuthRoot) })
    )
  );
}

function AuthRoot() {
  var [user, setUser] = useState(undefined);

  useEffect(function () {
    var unsub = onAuthStateChanged(auth, function (u) { setUser(u || null); });
    return function () { unsub(); };
  }, []);

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: 2, marginBottom: 20 }}>SAPURAI</div>
          <div className="lt-spinner"></div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Chargement...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Afficher la landing publique par defaut. Si l'URL est /?invite=XXX ou
    // /?login=1, aller direct au Login (pour liens d'invitation).
    var params = new URLSearchParams(window.location.search);
    var directLogin = !!params.get('invite') || params.get('login') === '1';
    return directLogin ? <Login /> : <Landing />;
  }
  return <AuthGate user={user} />;
}

function AuthGate({ user }: { user: any }) {
  var [checking, setChecking] = useState(true);
  var [superAdmin, setSuperAdmin] = useState(false);

  useEffect(function () {
    isSuperAdmin(user.uid).then(function (isSA) {
      setSuperAdmin(isSA);
      setChecking(false);
    });
  }, [user.uid]);

  if (checking) return SPLASH;

  if (superAdmin) {
    return (
      <Suspense fallback={SPLASH}>
        <SuperAdmin user={user} logout={function () { signOut(auth); }} />
      </Suspense>
    );
  }
  return <AuthenticatedApp user={user} />;
}

interface AuthAppProps { user: any }

function AuthenticatedApp(props: AuthAppProps) {
  var user = props.user;
  var store = useData(user.uid, user.email || '');
  var [showTeam, setShowTeam] = useState(false);
  var [switchCode, setSwitchCode] = useState('');
  var [switchName, setSwitchName] = useState('');
  var [switchLoading, setSwitchLoading] = useState(false);
  var [switchErr, setSwitchErr] = useState('');

  // FCM (Phase 1.3) — enregistre token + ecoute foreground messages
  // Permission demandee apres 1ere interaction (cf. useFCM.requestPermission)
  // Foreground message -> toast in-app via store.sendNotif silencieux ou alerte
  var fcm = useFCM({
    uid: user.uid,
    onForegroundMessage: function (title: string, body: string) {
      // L'app est ouverte : on peut afficher un toast natif au lieu d'une notif OS
      // Pour V1 on log + alerte Notification API si granted
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: body, icon: '/icon-192.png' });
        } catch (_e) { /* fallback silencieux */ }
      }
    },
  });

  // Demande permission apres 1ere interaction utilisateur (Chrome bloque sinon).
  // Si role === 'admin' ou 'agent' (ceux qui recoivent vraiment des notifs metier).
  useEffect(function () {
    if (!fcm.supported) return;
    if (fcm.permission !== 'default') return;
    if (!store.role || store.role === 'client') return;
    var asked = false;
    function tryAsk() {
      if (asked) return;
      asked = true;
      // Petit delai pour laisser l'UI respirer
      setTimeout(function () { fcm.requestPermission(); }, 500);
    }
    document.addEventListener('click', tryAsk, { once: true });
    document.addEventListener('keydown', tryAsk, { once: true });
    return function () {
      document.removeEventListener('click', tryAsk);
      document.removeEventListener('keydown', tryAsk);
    };
  }, [fcm.supported, fcm.permission, store.role]);

  // Detect ?invite=CODE in URL for already-authenticated users (company switch)
  useEffect(function () {
    var params = new URLSearchParams(window.location.search);
    var code = (params.get('invite') || '').toUpperCase().trim();
    if (code) {
      setSwitchCode(code);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  function logout() { signOut(auth); }

  if (store.loading) {
    return <PageSkeleton />;
  }

  if (store.needSetup) {
    return <Setup createCompany={store.createCompany} joinWithCode={store.joinWithCode} logout={logout} />;
  }

  if (store.data && store.data.status === 'blocked') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--danger-bg)', fontFamily: 'var(--font-sans)', padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: 2, marginBottom: 16 }}>SAPURAI</div>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '24px 28px', border: '1px solid var(--danger-border)', boxShadow: '0 4px 20px var(--shadow)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger-text)', marginBottom: 8 }}>Compte suspendu</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Abonnement expiré — contactez sapurai pour renouveler</div>
          </div>
          <button onClick={logout} style={{ marginTop: 20, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 24px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Déconnexion</button>
        </div>
      </div>
    );
  }

  // Already-authenticated user received an invite link → offer to switch company
  if (switchCode) {
    var boxS = { width: '90%', maxWidth: 400, background: 'var(--bg-primary)', borderRadius: 12, padding: '28px 24px', boxShadow: '0 4px 24px var(--shadow)' };
    var inputS: CSSProperties = { width: '100%', padding: '12px 14px', border: '2px solid var(--border)', borderRadius: 8, fontSize: 15, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-input)' };
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', fontFamily: 'var(--font-sans)', padding: 16 }}>
        <div style={boxS}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: 2 }}>SAPURAI</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Vous avez une invitation pour rejoindre un nouvel espace</div>
          </div>
          {switchErr ? <div style={{ background: 'var(--danger-light)', color: 'var(--danger-text)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{switchErr}</div> : null}
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 14, textAlign: 'center', marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Code d'invitation</div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 5, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{switchCode}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Votre nom dans ce nouvel espace</label>
            <input value={switchName} onChange={function (e) { setSwitchName(e.target.value); }} placeholder="Moussa Traore" style={inputS} autoFocus />
          </div>
          <button
            disabled={switchLoading}
            onClick={async function () {
              if (!switchName.trim()) { setSwitchErr('Votre nom est requis'); return; }
              setSwitchLoading(true); setSwitchErr('');
              try {
                await store.joinWithCode(switchCode, switchName.trim());
                setSwitchCode('');
              } catch (e) {
                setSwitchLoading(false);
                setSwitchErr(e.message || "Code invalide ou expire");
              }
            }}
            style={{ width: '100%', background: 'var(--success)', color: 'white', border: 'none', borderRadius: 8, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: switchLoading ? 0.6 : 1, marginBottom: 10 }}>
            {switchLoading ? 'Connexion...' : 'Rejoindre ce nouvel espace'}
          </button>
          <button onClick={function () { setSwitchCode(''); }} style={{ width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 0', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Ignorer, rester dans mon espace actuel
          </button>
        </div>
      </div>
    );
  }

  if (showTeam && store.role === 'admin') {
    return <TeamPanel
      members={store.members}
      createInvite={store.createInvite}
      addMemberByEmail={store.addMemberByEmail}
      updateMemberRole={store.updateMemberRole}
      removeMember={store.removeMember}
      onClose={function () { setShowTeam(false); }}
      currentUid={user.uid}
    />;
  }

  // Props groupees pour la section Equipe du panel Parametres (evite la pollution d'API)
  var teamProps = {
    members: store.members,
    currentUid: user.uid,
    createInvite: store.createInvite,
    addMemberByEmail: store.addMemberByEmail,
    updateMemberRole: store.updateMemberRole,
    updateMemberAssignments: store.updateMemberAssignments,
    removeMember: store.removeMember,
    dos: (store.data && store.data.dos) ? store.data.dos : [],
  };
  return <App
    db={store.data}
    sv={store.save}
    user={user}
    role={store.role}
    logout={logout}
    showTeam={store.role === 'admin' ? function () { setShowTeam(true); } : null}
    teamProps={teamProps}
    shareTracking={store.shareTracking}
    shareClientTracking={store.shareClientTracking}
    companyId={store.companyId}
    agentName={store.agentName}
    sendNotif={store.sendNotif}
    notifyAdmins={store.notifyAdmins}
    notifs={store.notifs}
    markNotifsRead={store.markNotifsRead}
    saveError={store.saveError}
    saveOk={store.saveOk}
  />;
}

var SPLASH = React.createElement("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-body)", fontFamily: "var(--font-sans)" } },
  React.createElement("div", { style: { textAlign: "center" } },
    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: 2, marginBottom: 20 } }, "SAPURAI"),
    React.createElement("div", { className: "lt-spinner" }),
    React.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary)" } }, "Chargement...")
  )
);

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(GlobalErrorBoundary, null,
    React.createElement(Suspense, { fallback: SPLASH },
      React.createElement(Root, null)
    )
  )
);
