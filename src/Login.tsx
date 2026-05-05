// src/Login.jsx
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';

export default function Login(props: { onBack?: () => void } = {}) {
  var params = new URLSearchParams(window.location.search);
  var urlCode = (params.get('invite') || '').toUpperCase().trim();

  var [email, setEmail] = useState('');
  var [pass, setPass] = useState('');
  var [mode, setMode] = useState(urlCode ? 'invite' : 'home');
  var [err, setErr] = useState('');
  var [info, setInfo] = useState('');
  var [loading, setLoading] = useState(false);

  // Invite-specific fields
  var [invCode, setInvCode] = useState(urlCode);
  var [invName, setInvName] = useState('');
  var [invEmail, setInvEmail] = useState('');
  var [invPass, setInvPass] = useState('');

  function submitEmail(e) {
    if (e) e.preventDefault();
    setErr('');
    setLoading(true);
    var fn = mode === 'login' ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
    fn(auth, email, pass)
      .then(function () { setLoading(false); })
      .catch(function (error) {
        setLoading(false);
        var msg = {
          'auth/invalid-email': 'Email invalide',
          'auth/user-not-found': 'Email ou mot de passe incorrect',
          'auth/wrong-password': 'Email ou mot de passe incorrect',
          'auth/email-already-in-use': 'Email deja utilise',
          'auth/weak-password': 'Mot de passe trop court (6 min)',
          'auth/invalid-credential': 'Email ou mot de passe incorrect',
        }[error.code] || 'Email ou mot de passe incorrect';
        setErr(msg);
      });
  }

  function submitReset(e) {
    if (e) e.preventDefault();
    setErr(''); setInfo('');
    if (!email) { setErr('Entrez votre email'); return; }
    setLoading(true);
    sendPasswordResetEmail(auth, email)
      .then(function () {
        setLoading(false);
        setInfo('Email de reinitialisation envoye a ' + email);
      })
      .catch(function (error) {
        setLoading(false);
        var msg = {
          'auth/invalid-email': 'Email invalide',
        }[error.code] || 'Si un compte existe avec cet email, un lien a ete envoye';
        setErr(msg);
      });
  }

  function submitInvite(e) {
    if (e) e.preventDefault();
    setErr('');
    var code = invCode.trim().toUpperCase();
    if (!code) { setErr("Code d'invitation requis"); return; }
    if (!invName.trim()) { setErr('Votre nom est requis'); return; }
    if (!invEmail) { setErr('Email requis'); return; }
    if (!invPass || invPass.length < 6) { setErr('Mot de passe trop court (6 min minimum)'); return; }
    setLoading(true);
    // Store pending join — useData will auto-call joinWithCode once account is created
    try { sessionStorage.setItem('lt_pending_join', JSON.stringify({ code: code, name: invName.trim() })); } catch (e2) {}
    createUserWithEmailAndPassword(auth, invEmail, invPass)
      .then(function () { setLoading(false); })
      .catch(function (error) {
        setLoading(false);
        try { sessionStorage.removeItem('lt_pending_join'); } catch (e2) {}
        var msg = {
          'auth/invalid-email': 'Email invalide',
          'auth/email-already-in-use': 'ALREADY_USED',
          'auth/weak-password': 'Mot de passe trop court (6 min minimum)',
        }[error.code] || error.message;
        setErr(msg);
      });
  }

  function signInWithGoogle(pendingJoin) {
    setErr(''); setLoading(true);
    if (pendingJoin) {
      try { sessionStorage.setItem('lt_pending_join', JSON.stringify(pendingJoin)); } catch (e2) {}
    }
    signInWithPopup(auth, googleProvider)
      .then(function () { setLoading(false); })
      .catch(function (error) {
        setLoading(false);
        if (pendingJoin) { try { sessionStorage.removeItem('lt_pending_join'); } catch (e2) {} }
        var msg = {
          'auth/popup-closed-by-user': 'Connexion annulee',
          'auth/cancelled-popup-request': 'Connexion annulee',
          'auth/account-exists-with-different-credential': 'Un compte existe deja avec cet email',
        }[error.code] || 'Erreur de connexion Google';
        setErr(msg);
      });
  }

  // Bouton Google : blanc + logo colore (brand Google). Standard pour les 2 themes.
  // Treatement "primary" sur ecran home via shadow + padding genereux.
  var googleBtnStyle = { width: '100%', background: 'white', color: '#1f1f1f', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' };

  // Bouton ghost/secondary : transparent + outline, ne domine pas
  var btnGhost = { width: '100%', background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 };

  // Lien tertiaire : style lien discret, sans bordure
  var btnLink = { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline', textDecorationColor: 'var(--border)' };

  var boxStyle = { width: '90%', maxWidth: 400, background: 'var(--bg-primary)', borderRadius: 16, padding: '28px 24px', boxShadow: '0 4px 24px var(--shadow)' };
  var inputStyle: CSSProperties = { width: '100%', padding: '12px 14px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-input)' };
  // Primary "hero" : gradient dark permanent (ne s'inverse pas en dark, contrairement a var(--btn-primary-bg))
  var btnPrimary = { width: '100%', background: 'linear-gradient(135deg, #1c1917, #292524)', color: 'white', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 };
  var labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', display: 'block' as const, marginBottom: 4 };

  return (
    <div className="lt-login-root" style={{ minHeight: '100vh', background: 'var(--bg-body)', fontFamily: 'var(--font-sans)' }}>
      {/* Sprint 2 : split-screen desktop. Panneau droit cache en mobile (<768px). */}
      <style>{".lt-login-root{display:grid;grid-template-columns:1fr;min-height:100vh}.lt-login-left{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:var(--bg-body);position:relative}.lt-login-right{display:none;background:#0a0a09;color:#fff;padding:48px;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}.lt-login-right .lt-pat{position:absolute;inset:0;opacity:.08;background-image:repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 24px)}.lt-login-wrap{display:flex;flex-direction:column;align-items:center;gap:28px;width:100%}.lt-login-bullets{display:none;gap:28px;color:var(--text-secondary);font-size:13px;flex-wrap:wrap;justify-content:center}.lt-login-bullets span{display:inline-flex;align-items:center;gap:6px}@media(min-width:1024px){.lt-login-root{grid-template-columns:1fr 1fr}.lt-login-right{display:flex}.lt-login-bullets{display:flex}}"}</style>
      <div className="lt-login-left">
      {props.onBack ? (<button onClick={props.onBack} aria-label="Retour a la landing" style={{ position: "absolute", top: 16, left: 16, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", fontFamily: "var(--font-mono)", display: "inline-flex", alignItems: "center", gap: 6, zIndex: 10 }}>{"← Retour"}</button>) : null}
      <div className="lt-login-wrap">
      <div style={boxStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: 2 }}>SAPURAI</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Gestion de transit international</div>
        </div>

        {err && err !== 'ALREADY_USED' ? <div role="alert" style={{ background: 'var(--danger-light)', color: 'var(--danger-text)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div> : null}
        {err === 'ALREADY_USED' ? (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: 'var(--warning-text)', marginBottom: 4 }}>Cet email est deja associe a un compte Sapurai.</div>
            <div style={{ color: 'var(--warning-text)', marginBottom: 8 }}>Si c'est votre email, connectez-vous avec votre mot de passe. Sinon, utilisez une adresse email differente.</div>
            <button onClick={function () { setMode('login'); setEmail(invEmail); setErr(''); }} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Se connecter avec cet email
            </button>
          </div>
        ) : null}
        {info ? <div style={{ background: 'var(--success-light)', color: 'var(--success-text)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{info}</div> : null}

        {/* Home screen — hierarchie : Google primary, Email ghost, Invitation link */}
        {mode === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* PRIMARY : Google Sign-In (brand white, shadow pour elever le bouton) */}
            <button onClick={function () { signInWithGoogle(null); }} disabled={loading} style={googleBtnStyle}>
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continuer avec Google
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            {/* SECONDARY : Email login (ghost outline) */}
            <button onClick={function () { setMode('login'); }} style={btnGhost}>
              Se connecter avec email
            </button>
            {/* TERTIARY : Invitation (link style, en bas, discret) */}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={function () { setMode('invite'); setErr(''); }} style={btnLink}>
                J'ai un code d'invitation
              </button>
            </div>
          </div>
        ) : null}

        {/* Invite flow — creates real email+password account */}
        {mode === 'invite' ? (
          <div>
            {urlCode ? (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Code d'invitation</div>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 5, color: 'var(--text-primary)', fontFamily: 'monospace', background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 0' }}>{invCode}</div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Code d'invitation</label>
                <input value={invCode} onChange={function (e) { setInvCode(e.target.value.toUpperCase()); }} placeholder="ABC123" maxLength={6}
                  style={Object.assign({}, inputStyle, { textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center' as const, fontSize: 20, fontWeight: 700 })} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Votre nom</label>
              <input value={invName} onChange={function (e) { setInvName(e.target.value); }} placeholder="Moussa Traore" style={inputStyle} autoFocus />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={invEmail} onChange={function (e) { setInvEmail(e.target.value); }} placeholder="moussa@example.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Mot de passe</label>
              <input type="password" value={invPass} onChange={function (e) { setInvPass(e.target.value); }} placeholder="••••••••" style={inputStyle} />
            </div>
            <button onClick={submitInvite} disabled={loading} style={Object.assign({}, btnPrimary, { background: 'var(--success)' })}>
              {loading ? 'Creation du compte...' : 'Creer mon compte et rejoindre'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button onClick={function () {
              var code = invCode.trim().toUpperCase();
              if (!code) { setErr("Code d'invitation requis"); return; }
              if (!invName.trim()) { setErr('Votre nom est requis'); return; }
              signInWithGoogle({ code: code, name: invName.trim() });
            }} disabled={loading} style={googleBtnStyle}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Rejoindre avec Google
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={function () { setMode('login'); setErr(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                Deja un compte ? Se connecter
              </button>
            </div>
            {!urlCode ? (
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <button onClick={function () { setMode('home'); setErr(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Retour</button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Password reset */}
        {mode === 'forgot' ? (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={function (e) { setEmail(e.target.value); }} placeholder="votre-email@exemple.com" style={inputStyle} />
            </div>
            <button onClick={submitReset} disabled={loading || !email} style={btnPrimary}>
              {loading ? '...' : 'Envoyer le lien de reinitialisation'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={function () { setMode('login'); setErr(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                Retour a la connexion
              </button>
            </div>
          </div>
        ) : null}

        {/* Login / Register */}
        {mode === 'login' || mode === 'register' ? (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={function (e) { setEmail(e.target.value); }} placeholder="votre-email@exemple.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Mot de passe</label>
              <input type="password" value={pass} onChange={function (e) { setPass(e.target.value); }} placeholder="••••••••" style={inputStyle} />
            </div>
            <button onClick={submitEmail} disabled={loading || !email || !pass} style={btnPrimary}>
              {loading ? '...' : mode === 'login' ? 'Se connecter' : 'Creer le compte'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button onClick={function () { signInWithGoogle(null); }} disabled={loading} style={googleBtnStyle}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continuer avec Google
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={function () { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {mode === 'login' ? 'Pas de compte ? Creer un compte' : 'Deja un compte ? Se connecter'}
              </button>
            </div>
            {mode === 'login' ? (
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <button onClick={function () { setMode('forgot'); setErr(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                  Mot de passe oublie ?
                </button>
              </div>
            ) : null}
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <button onClick={function () { setMode('home'); setErr(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Retour</button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="lt-login-bullets">
        <span>{"\u26A1"}<strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Temps reel</strong></span>
        <span>{"\uD83D\uDC65"}<strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Multi-equipes</strong></span>
        <span>{"\uD83D\uDCF4"}<strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Hors ligne</strong></span>
      </div>
      </div>
      </div>
      {/* Panneau droit Sapurai (desktop uniquement) */}
      <aside className="lt-login-right">
        <div className="lt-pat" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6 }}>{'SAPURAI'}</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>{'Plateforme de gestion de transit'}</div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0, maxWidth: 420 }}>
            {'Tout votre transit.'}<br />{'Au même endroit.'}
          </h2>
          <p style={{ fontSize: 15, opacity: 0.7, marginTop: 16, maxWidth: 380, lineHeight: 1.55 }}>
            {'Dossiers, conteneurs, dépenses, cautions, chauffeurs — un seul outil pour les agents au bureau et au port.'}
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 32, fontSize: 12, opacity: 0.7 }}>
          <div><div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', opacity: 1 }}>{'Sync'}</div>{'DPWorld'}</div>
          <div><div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', opacity: 1 }}>{'WhatsApp'}</div>{'tracking client'}</div>
          <div><div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', opacity: 1 }}>{'Hors ligne'}</div>{'PWA installable'}</div>
        </div>
      </aside>
    </div>
  );
}
