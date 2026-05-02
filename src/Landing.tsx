// Landing page publique Sapurai
// Affichee par main.tsx quand utilisateur non-authentifie arrive sur /
// Copy derive de EXECUTIVE-ONEPAGER.md et COMPETITIVE-BRIEF.md

import { useState, lazy, Suspense } from 'react';

const Login = lazy(() => import('./Login.tsx'));

export default function Landing() {
  var [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return (
      <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg-body)" }} />}>
        <Login />
      </Suspense>
    );
  }

  var PAD = "20px";
  var MAXW = 960;

  function goLogin() { setShowLogin(true); }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-body)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
      {/* Styles inline specifiques a la landing */}
      <style>{`
        .lt-l-hero h1 { font-size: 36px; line-height: 1.15; font-weight: 900; margin: 0 0 16px 0; }
        .lt-l-hero .sub { font-size: 18px; line-height: 1.5; color: var(--text-secondary); margin: 0 0 28px 0; max-width: 600px; }
        @media (min-width: 768px) {
          .lt-l-hero h1 { font-size: 52px; }
          .lt-l-hero .sub { font-size: 20px; }
        }
        .lt-l-grid-3 { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .lt-l-grid-3 { grid-template-columns: repeat(3, 1fr); } }
        .lt-l-grid-4 { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .lt-l-grid-4 { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .lt-l-grid-4 { grid-template-columns: repeat(4, 1fr); } }
        .lt-l-hero-grid { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; }
        @media (min-width: 900px) { .lt-l-hero-grid { grid-template-columns: 1.15fr 1fr; } }
        .lt-l-phone { max-width: 340px; margin: 0 auto; background: var(--bg-primary); border-radius: 28px; padding: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px var(--border); }
        .lt-l-phone-inner { border-radius: 20px; overflow: hidden; background: var(--bg-body); }
        .lt-l-feat-visual { background: var(--bg-secondary); border-radius: 10px; padding: 14px; margin-top: 12px; border: 1px solid var(--border); }
        .lt-l-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .lt-l-table th, .lt-l-table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); }
        .lt-l-table th { background: var(--bg-secondary); font-weight: 700; font-size: 13px; }
        .lt-l-table td.yes { color: var(--success); font-weight: 700; }
        .lt-l-table td.no { color: var(--text-secondary); }
        .lt-l-table td.partial { color: var(--warning); }
        .lt-l-faq-item { border-bottom: 1px solid var(--border); padding: 16px 0; }
        .lt-l-faq-q { font-weight: 700; font-size: 16px; margin-bottom: 6px; color: var(--text-primary); }
        .lt-l-faq-a { color: var(--text-secondary); line-height: 1.6; font-size: 14px; }
      `}</style>

      {/* ═════════ NAV TOP ═════════ */}
      <header style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", padding: "14px " + PAD, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: "var(--text-primary)" }}>SAPURAI</div>
          {/* eslint-disable-next-line no-restricted-syntax -- gradient brand dark permanent (s'inverserait en dark mode) */}
          <button onClick={goLogin} style={{ background: "linear-gradient(135deg, #1c1917, #292524)", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 40 }}>
            Se connecter
          </button>
        </div>
      </header>

      {/* ═════════ HERO ═════════ */}
      <section className="lt-l-hero" style={{ padding: "60px " + PAD + " 40px" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto" }}>
          <div className="lt-l-hero-grid">
            {/* Colonne gauche : texte */}
            <div>
              <div style={{ background: "var(--info-bg)", color: "var(--info-text)", display: "inline-block", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, marginBottom: 16, border: "1px solid var(--info-border)" }}>
                {"\u26F5  Spécialisé transitaires Dakar"}
              </div>
              <h1>Gérez vos transits sans jamais oublier une surestarie.</h1>
              <div className="sub">
                L'app métier pour les transitaires opérant depuis Dakar.
                Sync DPWorld, alertes surestaries automatiques, tracking client WhatsApp.
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {/* eslint-disable-next-line no-restricted-syntax -- gradient brand dark permanent (CTA hero) */}
                <button onClick={goLogin} style={{ background: "linear-gradient(135deg, #1c1917, #292524)", color: "white", border: "none", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", minHeight: 48 }}>
                  Essayer gratuitement 30 jours
                </button>
                <a href="https://wa.me/221771234567?text=Bonjour%2C%20je%20voudrais%20une%20demo%20Sapurai" target="_blank" rel="noopener noreferrer" style={{ background: "transparent", color: "var(--text-primary)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", minHeight: 48, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                  Voir une demo
                </a>
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                {"Pas de carte bancaire requise. Déployable en 10 minutes."}
              </div>
            </div>

            {/* Colonne droite : mockup phone Dashboard */}
            <div aria-hidden="true">
              <div className="lt-l-phone">
                <div className="lt-l-phone-inner">
                  {/* Header app */}
                  <div style={{ background: "var(--bg-primary)", padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-primary)", letterSpacing: 0.3 }}>{"DEMO TRANSIT SARL"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{"Gestion de transit"}</div>
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{"\u2630"}</div>
                  </div>
                  {/* Urgences CTA banner */}
                  <div style={{ padding: "12px 16px", background: "var(--bg-body)" }}>
                    <div style={{ background: "var(--danger)", color: "white", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{"3 urgences critiques"}</div>
                      <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>{"Surestaries dépassées"}</div>
                    </div>
                  </div>
                  {/* Stat cards */}
                  <div style={{ padding: "0 16px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {[
                      { l: "Dossiers", v: "38", s: "actifs" },
                      { l: "TC", v: "76", s: "en cours" },
                      { l: "Impayés", v: "865k", s: "FCFA" },
                    ].map(function (c) {
                      return <div key={c.l} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 8, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{c.l}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{c.v}</div>
                        <div style={{ fontSize: 8, color: "var(--text-secondary)" }}>{c.s}</div>
                      </div>;
                    })}
                  </div>
                  {/* Urgence list */}
                  <div style={{ padding: "0 16px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{"Urgences"}</div>
                    {[
                      { tc: "MSCU4821739", msg: "Surestaries +3j", sub: "CLIENT A", c: "var(--danger)" },
                      { tc: "CMAU6094287", msg: "BAE manquant", sub: "CLIENT B", c: "var(--warning)" },
                      { tc: "MAEU3718506", msg: "Retour vide J-2", sub: "CLIENT C", c: "var(--warning)" },
                    ].map(function (u, i) {
                      return <div key={i} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderLeft: "3px solid " + u.c, borderRadius: 6, padding: "7px 10px", marginBottom: 5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>{u.tc}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: u.c }}>{u.msg}</div>
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>{u.sub}</div>
                      </div>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════ PROBLEME ═════════ */}
      <section style={{ background: "var(--bg-primary)", padding: "60px " + PAD, borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Le problème</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
              Vous perdez de l'argent à chaque dossier que vous ne suivez pas assez près.
            </h2>
          </div>
          <div className="lt-l-grid-3">
            <div style={{ padding: 20, background: "var(--danger-bg)", borderRadius: 12, border: "1px solid var(--danger-border)" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "var(--danger-text)" }}>200k</div>
              <div style={{ fontSize: 12, color: "var(--danger-text)", fontWeight: 600 }}>FCFA / TC perdu</div>
              <div style={{ fontSize: 14, marginTop: 10, color: "var(--text-primary)", lineHeight: 1.5 }}>
                Une surestarie oubliée = 75 à 200k FCFA de pertes par conteneur.
                Multiplié par 2-3 TC/mois = salaire d'un agent.
              </div>
            </div>
            <div style={{ padding: 20, background: "var(--warning-bg)", borderRadius: 12, border: "1px solid var(--warning-border)" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "var(--warning-text)" }}>3-5x</div>
              <div style={{ fontSize: 12, color: "var(--warning-text)", fontWeight: 600 }}>Appels client par dossier</div>
              <div style={{ fontSize: 14, marginTop: 10, color: "var(--text-primary)", lineHeight: 1.5 }}>
                "Où est mon conteneur ?" L'agent passe son temps au téléphone au lieu de gérer.
              </div>
            </div>
            <div style={{ padding: 20, background: "var(--warning-bg)", borderRadius: 12, border: "1px solid var(--warning-border)" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "var(--warning-text)" }}>30+</div>
              <div style={{ fontSize: 12, color: "var(--warning-text)", fontWeight: 600 }}>Dossiers = débordement</div>
              <div style={{ fontSize: 14, marginTop: 10, color: "var(--text-primary)", lineHeight: 1.5 }}>
                Au-delà, impossible de savoir quel dossier est urgent.
                Le cahier déborde, l'Excel se perd, WhatsApp se noie.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════ SOLUTION ═════════ */}
      <section style={{ padding: "60px " + PAD }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>La solution</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
              Quatre fonctionnalités qui changent votre métier.
            </h2>
          </div>
          <div className="lt-l-grid-4">
            {/* Feature 1 : Sync DPWorld */}
            <div style={{ padding: 20, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{"\u26F5"}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>Sync DPWorld 1 clic</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Statut BAD, BAE, Pregate récupéré automatiquement. Plus besoin d'ouvrir 3 onglets.</div>
              <div className="lt-l-feat-visual">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"BL DKR-2026-5028"}</span>
                  <span style={{ fontSize: 9, background: "var(--success-bg)", color: "var(--success-text)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{"\u2713 Synchronisé"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 9 }}>
                  <div style={{ background: "var(--success-light)", color: "var(--success-text)", padding: "4px 6px", borderRadius: 4, fontWeight: 700, textAlign: "center" }}>{"BAD OK"}</div>
                  <div style={{ background: "var(--success-light)", color: "var(--success-text)", padding: "4px 6px", borderRadius: 4, fontWeight: 700, textAlign: "center" }}>{"BAE OK"}</div>
                  <div style={{ background: "var(--success-light)", color: "var(--success-text)", padding: "4px 6px", borderRadius: 4, fontWeight: 700, textAlign: "center" }}>{"Pregate"}</div>
                </div>
              </div>
            </div>

            {/* Feature 2 : Alertes */}
            <div style={{ padding: 20, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{"\u23F0"}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>Alertes franchises auto</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Magasinage, surestaries, détention : calcul en temps réel. Alerte J-3 avant l'expiration.</div>
              <div className="lt-l-feat-visual">
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>{"CMAU5729014 \u2014 Port 8j / 10"}</div>
                <div style={{ background: "var(--bg-primary)", borderRadius: 4, height: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <div style={{ width: "80%", height: "100%", background: "var(--warning)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: "var(--warning-text)", fontWeight: 700 }}>{"J-2"}</span>
                  <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>{"Reste 2 jours"}</span>
                </div>
              </div>
            </div>

            {/* Feature 3 : Tracking WhatsApp */}
            <div style={{ padding: 20, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{"\uD83D\uDCAC"}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>Tracking WhatsApp</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Un lien partageable par conteneur. Vos clients voient l'état en temps réel sans vous appeler.</div>
              <div className="lt-l-feat-visual">
                <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", padding: "4px 6px", background: "var(--bg-primary)", borderRadius: 4, border: "1px solid var(--border)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>sapurai.app/t/a7f9...</div>
                {/* eslint-disable-next-line no-restricted-syntax -- WhatsApp brand green (couleur officielle) */}
                <a href="#" onClick={function (e) { e.preventDefault(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#25D366", color: "white", borderRadius: 6, padding: "6px 10px", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>
                  {"\uD83D\uDCAC Partager WhatsApp"}
                </a>
              </div>
            </div>

            {/* Feature 4 : Dispatch */}
            <div style={{ padding: 20, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{"\uD83D\uDE9A"}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>Dispatch + parcours</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Chauffeur, camion, avance, suivi par étapes du port à la destination finale. Traçabilité totale.</div>
              <div className="lt-l-feat-visual">
                <div style={{ display: "flex", alignItems: "center", gap: 0, justifyContent: "space-between" }}>
                  {[
                    { l: "Port", done: true },
                    { l: "Transit", done: true },
                    { l: "Kati", done: true },
                    { l: "Destination", done: false },
                  ].map(function (s, i) {
                    return <div key={s.l} style={{ flex: i < 3 ? "1 1 auto" : "0 0 auto", display: "flex", alignItems: "center", gap: 0 }}>
                      <div>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: s.done ? "var(--success)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                          {s.done ? <span style={{ color: "white", fontSize: 9, fontWeight: 800 }}>{"\u2713"}</span> : null}
                        </div>
                        <div style={{ fontSize: 8, color: "var(--text-secondary)", textAlign: "center", marginTop: 3, whiteSpace: "nowrap" }}>{s.l}</div>
                      </div>
                      {i < 3 ? <div style={{ flex: 1, height: 2, background: s.done ? "var(--success)" : "var(--border)", minWidth: 10, marginBottom: 12 }} /> : null}
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════ POSITIONING ═════════ */}
      <section style={{ background: "var(--bg-primary)", padding: "60px " + PAD, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Ce qui change</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
              Ce que Sapurai fait — et que le cahier, Excel ou WhatsApp ne peuvent pas faire.
            </h2>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 12, maxWidth: 640, margin: "12px auto 0" }}>
              {"Le cahier et Excel marchent. Jusqu'à un certain volume. WhatsApp est pratique mais les infos s'y perdent. Sapurai reprend ces outils que vous connaissez déjà, et fait ce qu'ils ne savent pas faire."}
            </div>
          </div>
          <div style={{ overflow: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
            <table className="lt-l-table">
              <thead>
                <tr>
                  <th>Tâche du quotidien</th>
                  <th>Cahier / Excel / WhatsApp</th>
                  <th style={{ background: "var(--info-bg)", color: "var(--info-text)" }}>Sapurai</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Calculer les jours de surestaries restants par TC</td>
                  <td className="no">À la main, sur chaque ligne</td>
                  <td className="yes">Calcul automatique + alerte J-3 / J-0</td>
                </tr>
                <tr>
                  <td>Savoir où en est mon dossier sur DPWorld (BAD, BAE, Pregate)</td>
                  <td className="no">Ouvrir le portail, noter à la main</td>
                  <td className="yes">Sync 1 clic, remonte dans l'app</td>
                </tr>
                <tr>
                  <td>Répondre au client qui demande où est son conteneur</td>
                  <td className="partial">Message WhatsApp à chaque appel</td>
                  <td className="yes">Lien partageable, il voit lui-même en temps réel</td>
                </tr>
                <tr>
                  <td>Retrouver un dossier d'il y a 3 mois</td>
                  <td className="no">Feuilleter le cahier ou chercher dans Excel</td>
                  <td className="yes">Recherche instantanée multi-critère</td>
                </tr>
                <tr>
                  <td>Travailler à 2 agents sur les mêmes dossiers</td>
                  <td className="no">Conflits, fichier verrouillé, duplications</td>
                  <td className="yes">Temps réel, chacun voit les modifs de l'autre</td>
                </tr>
                <tr>
                  <td>Suivre les chauffeurs entre port et destination</td>
                  <td className="partial">WhatsApp individuel par chauffeur</td>
                  <td className="yes">Parcours par étapes, budget, versements</td>
                </tr>
                <tr>
                  <td>Savoir quelles cautions sont bloquées, à récupérer</td>
                  <td className="no">Mémoriser ou noter quelque part</td>
                  <td className="yes">Tableau cautions + alertes fin de contrat</td>
                </tr>
                <tr>
                  <td>Travailler même sans réseau</td>
                  <td className="yes">Cahier = oui, Excel = oui, WhatsApp = queue</td>
                  <td className="yes">Mode hors ligne, sync au retour</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 14, textAlign: "center", fontStyle: "italic" }}>
            {"Pas besoin de tout abandonner. Beaucoup gardent WhatsApp pour discuter chauffeurs et clients. Sapurai s'occupe du reste."}
          </div>
        </div>
      </section>

      {/* ═════════ FAQ ═════════ */}
      <section style={{ padding: "60px " + PAD }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>FAQ</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>Questions fréquentes</h2>
          </div>
          {[
            { q: "Combien de temps pour installer Sapurai ?", a: "10 minutes. Vous créez un compte, vous importez votre Excel (optionnel), vous êtes opérationnel. Pas d'intégrateur, pas de formation obligatoire." },
            { q: "Est-ce que ça fonctionne hors ligne ?", a: "Oui. Sapurai est une PWA avec cache local Firestore. Vos agents peuvent travailler dans les zones 3G instables et tout se synchronise au retour." },
            { q: "Mes données restent-elles confidentielles ?", a: "Oui. Hébergement Firebase Google Cloud. Chaque entreprise a son espace isolé. Nous ne sommes PAS transitaires — vos clients, vos marges et vos données ne sont accessibles à personne d'autre que vous." },
            { q: "Je peux essayer avant de m'engager ?", a: "30 jours d'essai gratuit sur toutes les fonctionnalités. Pas de carte bancaire demandée. Résiliable à tout moment par la suite." },
            { q: "Combien ça coûte ?", a: "Nos tarifs sont personnalisés selon votre volume de dossiers. Contactez-nous pour un devis en moins de 24h (WhatsApp ou email)." },
            { q: "Support disponible si on a un problème ?", a: "Support WhatsApp et email directement avec l'équipe Sapurai. Réponse sous 4h en journée ouvrable." },
          ].map(function (item, i) {
            return <div key={i} className="lt-l-faq-item">
              <div className="lt-l-faq-q">{item.q}</div>
              <div className="lt-l-faq-a">{item.a}</div>
            </div>;
          })}
        </div>
      </section>

      {/* ═════════ CTA FINAL ═════════ */}
      {/* eslint-disable-next-line no-restricted-syntax -- gradient brand dark permanent (section CTA finale) */}
      <section style={{ background: "linear-gradient(135deg, #1c1917, #292524)", color: "white", padding: "60px " + PAD }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 12px 0", lineHeight: 1.2 }}>
            Prêt à récupérer vos surestaries ?
          </h2>
          <div style={{ fontSize: 17, opacity: 0.85, marginBottom: 32, lineHeight: 1.5 }}>
            Essayez 30 jours gratuitement. Si Sapurai ne vous fait pas économiser plus que son prix, on arrête là.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {/* eslint-disable-next-line no-restricted-syntax -- bouton blanc sur fond sombre permanent (inverse du brand) */}
            <button onClick={goLogin} style={{ background: "white", color: "#1c1917", border: "none", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", minHeight: 48 }}>
              Démarrer gratuitement
            </button>
            <a href="https://wa.me/221771234567?text=Bonjour%2C%20je%20voudrais%20en%20savoir%20plus%20sur%20Sapurai" target="_blank" rel="noopener noreferrer" style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", minHeight: 48, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              {"\uD83D\uDCAC WhatsApp"}
            </a>
          </div>
        </div>
      </section>

      {/* ═════════ FOOTER ═════════ */}
      <footer style={{ background: "var(--bg-primary)", borderTop: "1px solid var(--border)", padding: "30px " + PAD, fontSize: 13, color: "var(--text-secondary)" }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <strong style={{ color: "var(--text-primary)" }}>SAPURAI</strong> — Gestion de transit international
            <br />
            <span style={{ fontSize: 12 }}>Dakar, Sénégal</span>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <a href="mailto:sapurailogistics@gmail.com" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Email</a>
            <a href="https://wa.me/221771234567" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>WhatsApp</a>
            <button onClick={goLogin} style={{ background: "none", border: "none", color: "var(--text-secondary)", textDecoration: "underline", cursor: "pointer", fontSize: 13, padding: 0 }}>Se connecter</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
