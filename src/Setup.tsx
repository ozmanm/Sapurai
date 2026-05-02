// src/Setup.jsx
// Ecran pour les nouveaux utilisateurs: creer entreprise ou rejoindre avec code
import { useState } from 'react';
import type { CSSProperties } from 'react';
import SapuraiLogo from './components/ui/SapuraiLogo.tsx';

interface SetupProps {
  createCompany: (name: string, userName: string) => Promise<void>;
  joinWithCode: (code: string, userName: string) => Promise<void>;
  logout: () => void;
}

export default function Setup(props: SetupProps) {
  // Read invite code from URL ?invite=CODE
  var params = new URLSearchParams(window.location.search);
  var inviteFromUrl = (params.get('invite') || '').toUpperCase().trim();

  var [mode, setMode] = useState(inviteFromUrl ? 'join' : null); // null, 'create', 'join'
  var [companyName, setCompanyName] = useState('');
  var [userName, setUserName] = useState('');
  var [code, setCode] = useState(inviteFromUrl);
  var [err, setErr] = useState('');
  var [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!companyName.trim() || !userName.trim()) { setErr('Nom entreprise et votre nom requis'); return; }
    setLoading(true); setErr('');
    try {
      await props.createCompany(companyName.trim(), userName.trim());
    } catch (e) { setErr(e.message); setLoading(false); }
  }

  async function handleJoin() {
    if (!code || !userName.trim()) { setErr("Votre nom est requis"); return; }
    setLoading(true); setErr('');
    try {
      await props.joinWithCode(code.toUpperCase().trim(), userName.trim());
      // Clean URL after successful join
      if (inviteFromUrl) {
        window.history.replaceState({}, '', '/');
      }
    } catch (e) { setErr(e.message); setLoading(false); }
  }

  var boxStyle = { width: '90%', maxWidth: 420, background: 'var(--bg-primary)', borderRadius: 16, padding: '28px 24px', boxShadow: '0 4px 24px var(--shadow)' };
  // Primary hero : gradient dark permanent (non-inversible dark mode, meme pattern que Login btnPrimary)
  var btnPrimary = { background: 'linear-gradient(135deg, #1c1917, #292524)', color: 'white', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', opacity: loading ? 0.6 : 1 };
  // Ghost outline, non-dominant
  var btnGhost = { background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' };
  var inputStyle: CSSProperties = { width: '100%', padding: '12px 14px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-input)' };
  var labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', display: 'block' as const, marginBottom: 4 };

  // Stepper visuel handoff (Sprint D.2)
  // Etape 1 : Compte cree (Auth, deja done en arrivant ici)
  // Etape 2 : Espace (creation company OU join)
  // Etape 3 : Pret (transition automatique apres step 2)
  var step = mode === null ? 1 : 2;
  var steps = [
    { lbl: 'Compte', done: true },
    { lbl: 'Espace', done: step >= 2, current: step === 1 ? false : true },
    { lbl: 'Pret', done: false, current: false },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', fontFamily: 'var(--font-sans)', padding: 16 }}>
      <div style={boxStyle}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><SapuraiLogo size={28} color="var(--text-primary)" /></div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{'Configuration initiale · Étape ' + String(step) + ' / 3'}</div>
        </div>
        {/* Stepper visuel handoff */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 24 }}>
          {steps.map(function (s, i) {
            var done = s.done;
            var current = i + 1 === step;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 999,
                  background: done || current ? 'var(--btn-primary-bg)' : 'var(--bg-secondary)',
                  border: done || current ? 'none' : '1px solid var(--border)',
                  color: done || current ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                  display: 'grid', placeItems: 'center' as const,
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  fontFamily: 'var(--font-mono)',
                }}>{done ? '✓' : String(i + 1)}</div>
                <span style={{ fontSize: 11, fontWeight: current ? 700 : 500, color: done || current ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.lbl}</span>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {inviteFromUrl ? 'Entrez votre nom pour rejoindre' : 'Bienvenue ! Configurons votre espace.'}
          </div>
        </div>

        {err ? <div role="alert" style={{ background: 'var(--danger-light)', color: 'var(--danger-text)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div> : null}

        {!mode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* PRIMARY : creer une nouvelle entreprise (cas le plus courant) */}
            <button onClick={function () { setMode('create'); }} style={btnPrimary}>
              Creer une entreprise
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            {/* SECONDARY : rejoindre une entreprise existante */}
            <button onClick={function () { setMode('join'); }} style={btnGhost}>
              Rejoindre avec un code
            </button>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={props.logout} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Deconnexion
              </button>
            </div>
          </div>
        ) : null}

        {mode === 'create' ? (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Votre nom</label>
              <input value={userName} onChange={function (e) { setUserName(e.target.value); }} placeholder="Ibrahima Diallo" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nom de l'entreprise</label>
              <input value={companyName} onChange={function (e) { setCompanyName(e.target.value); }} placeholder="Transit Express Dakar" style={inputStyle} />
            </div>
            <button onClick={handleCreate} disabled={loading} style={btnPrimary}>
              {loading ? '...' : 'Creer'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={function () { setMode(null); setErr(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>Retour</button>
            </div>
          </div>
        ) : null}

        {mode === 'join' ? (
          <div>
            {inviteFromUrl ? (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Code d'invitation</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, color: 'var(--text-primary)' }}>{code}</div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Code d'invitation</label>
                <input value={code} onChange={function (e) { setCode(e.target.value.toUpperCase()); }} placeholder="ABC123" style={Object.assign({}, inputStyle, { textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center' as const, fontSize: 20, fontWeight: 700 })} maxLength={6} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Votre nom</label>
              <input value={userName} onChange={function (e) { setUserName(e.target.value); }} placeholder="Moussa Traore" style={inputStyle} autoFocus />
            </div>
            <button onClick={handleJoin} disabled={loading} style={Object.assign({}, btnPrimary, { background: 'var(--success)', color: 'white' })}>
              {loading ? 'Connexion...' : 'Rejoindre'}
            </button>
            {!inviteFromUrl ? (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button onClick={function () { setMode(null); setErr(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>Retour</button>
              </div>
            ) : null}
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={props.logout} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                Deconnexion
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
