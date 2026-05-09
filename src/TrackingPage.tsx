// TrackingPage.tsx — Public tracking page, no auth required
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

// Normalise un numero senegalais (+221) ou malien (+223) pour lien WhatsApp
function normalizeWaPhone(tl: string): string {
  var digits = (tl || "").replace(/\D/g, "");
  if (/^22[13]\d{7,9}$/.test(digits)) return digits;
  if (/^\d{8,9}$/.test(digits)) return "221" + digits; // default Senegal
  return "";
}

// Timestamp relatif ("il y a 2h") avec fallback absolu en tooltip
function relativeTime(iso: string): string {
  if (!iso) return "";
  try {
    var diff = Date.now() - new Date(iso).getTime();
    var mn = Math.round(diff / 60000);
    if (mn < 1) return "a l'instant";
    if (mn < 60) return "il y a " + mn + " min";
    var h = Math.round(mn / 60);
    if (h < 24) return "il y a " + h + "h";
    var d = Math.round(h / 24);
    if (d < 30) return "il y a " + d + "j";
    return formatDateTime(iso);
  } catch (_e) { return iso; }
}

// Hook simple pour detecter la taille ecran (stepper vertical sous 480px)
function useIsNarrow(): boolean {
  var [narrow, setNarrow] = useState(function () {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches;
  });
  useEffect(function () {
    var mq = window.matchMedia("(max-width: 480px)");
    function onChange(e: MediaQueryListEvent) { setNarrow(e.matches); }
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return function () {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return narrow;
}

var STEPS = ["PORT", "DISPATCH", "TRANSIT", "KATI", "BAMAKO", "RETOUR"];
var STEP_LABELS: Record<string, string> = { PORT: "Au Port", DISPATCH: "Dispatché", TRANSIT: "En Transit", KATI: "Kati", BAMAKO: "Bamako", RETOUR: "Retourné" };
var STEP_LETTERS: Record<string, string> = { PORT: "P", DISPATCH: "D", TRANSIT: "T", KATI: "K", BAMAKO: "B", RETOUR: "R" };
// Sprint 28 polish : 3 etats semantiques (la position dans le stepper raconte la progression,
// la couleur l'affirme). Plus de palette arc-en-ciel inventee hors-systeme.
function stepStateColor(done: boolean, current: boolean): string {
  if (current) return 'var(--text-primary)';
  if (done) return 'var(--success)';
  return 'var(--text-muted)';
}

interface Tc {
  n?: string;
  ty?: string;
  st?: string;
  ch?: string;
  cm?: string;
  tl?: string;
}

interface TcTrackingCardProps {
  tc: Tc;
  fallbackIndex: number;
}

function TcTrackingCard(p: TcTrackingCardProps) {
  var tc = p.tc;
  var narrow = useIsNarrow();
  var currentIdx = STEPS.indexOf(tc.st || "");
  if (currentIdx < 0) currentIdx = 0;
  var hasStatus = !!STEPS[currentIdx];

  return (
    <article className="lt-no-print-share" style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: "0 1px 3px var(--shadow)" }}>
      {/* TC Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>{tc.n || "TC " + String(p.fallbackIndex + 1)}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{tc.ty || "20GP"}</div>
        </div>
        <div style={{ background: hasStatus ? "var(--success)" : "var(--bg-secondary)", color: hasStatus ? "var(--btn-primary-text)" : "var(--text-muted)", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }} aria-label={"Statut : " + (STEP_LABELS[tc.st || ""] || tc.st)}>
          {STEP_LABELS[tc.st || ""] || tc.st}
        </div>
      </div>

      {/* Progress stepper — vertical sous 480px */}
      {narrow ? (
        <ol aria-label="Progression du conteneur" style={{ listStyle: "none", margin: "0 0 12px 0", padding: 0 }}>
          {STEPS.map(function (step, si) {
            var isDone = si <= currentIdx;
            var isCurrent = si === currentIdx;
            var color = isDone ? "var(--success)" : "var(--border)";
            return (
              <li key={step} aria-current={isCurrent ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", position: "relative" }}>
                <div style={{
                  width: isCurrent ? 32 : 24,
                  height: isCurrent ? 32 : 24,
                  borderRadius: "50%",
                  background: isDone ? color : "var(--bg-secondary)",
                  border: isCurrent ? "3px solid " + color : isDone ? "none" : "2px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isCurrent ? 14 : 11,
                  color: isDone ? "white" : "var(--text-muted)",
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: isCurrent ? "0 2px 8px var(--shadow)" : "none",
                  zIndex: 1
                }}>
                  {isDone ? "✓" : (isCurrent ? STEP_LETTERS[step] : String(si + 1))}
                </div>
                <div style={{ fontSize: 13, color: isCurrent ? "var(--text-primary)" : isDone ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: isCurrent ? 700 : 500 }}>
                  {STEP_LABELS[step]}
                </div>
                {si < STEPS.length - 1 ? (
                  <div aria-hidden="true" style={{
                    position: "absolute",
                    left: isCurrent ? 15 : 11,
                    top: isCurrent ? 38 : 30,
                    width: 2,
                    height: 14,
                    background: si < currentIdx ? "var(--success)" : "var(--border)"
                  }}></div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <ol aria-label="Progression du conteneur" style={{ listStyle: "none", margin: "0 0 12px 0", padding: 0, display: "flex", alignItems: "center" }}>
          {STEPS.map(function (step, si) {
            var isDone = si <= currentIdx;
            var isCurrent = si === currentIdx;
            var color = isDone ? "var(--success)" : "var(--border)";
            return (
              <li key={step} aria-current={isCurrent ? "step" : undefined} style={{ display: "flex", alignItems: "center", flex: si < STEPS.length - 1 ? 1 : "none", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 6 }}>
                  <div style={{
                    width: isCurrent ? 36 : 28,
                    height: isCurrent ? 36 : 28,
                    borderRadius: "50%",
                    background: isDone ? color : "var(--bg-secondary)",
                    border: isCurrent ? "3px solid " + color : isDone ? "none" : "2px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isCurrent ? 16 : 12,
                    color: isDone ? "white" : "var(--text-muted)",
                    fontWeight: 700,
                    transition: "background 0.3s ease-out, box-shadow 0.3s ease-out",
                    flexShrink: 0,
                    boxShadow: isCurrent ? "0 2px 8px var(--shadow)" : "none"
                  }}>
                    {isDone ? "✓" : (isCurrent ? STEP_LETTERS[step] : String(si + 1))}
                  </div>
                  {si < STEPS.length - 1 ? (
                    <div aria-hidden="true" style={{
                      flex: 1,
                      height: 3,
                      background: si < currentIdx ? "var(--success)" : "var(--border)",
                      margin: "0 2px",
                      borderRadius: 2,
                      transition: "background 0.3s"
                    }}></div>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: isCurrent ? "var(--text-primary)" : isDone ? "var(--success)" : "var(--text-muted)", fontWeight: isCurrent ? 800 : 500, textAlign: "center", width: si < STEPS.length - 1 ? "100%" : "auto", alignSelf: "flex-start" }}>
                  {STEP_LABELS[step]}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Chauffeur info if dispatched */}
      {tc.ch ? (
        <>
          <div role="separator" aria-orientation="horizontal" style={{ borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{"Transport"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{"Chauffeur"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{tc.ch}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{"Camion"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{tc.cm || "—"}</div>
            </div>
            {tc.tl ? (function () {
              var waNum = normalizeWaPhone(tc.tl);
              var waMsg = encodeURIComponent("Bonjour, je suis le client du conteneur " + (tc.n || "") + ". Pouvez-vous me donner le statut svp ?");
              return (
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={"tel:" + tc.tl} aria-label={"Appeler le chauffeur " + (tc.ch || "")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--success)", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", minHeight: 40 }}>
                    {"\uD83D\uDCDE " + tc.tl}
                  </a>
                  {/* eslint-disable-next-line no-restricted-syntax -- WhatsApp brand color */}
                  {waNum ? <a href={"https://wa.me/" + waNum + "?text=" + waMsg} target="_blank" rel="noopener noreferrer" aria-label="Contacter le chauffeur sur WhatsApp" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#25D366", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", minHeight: 40 }}>{"\uD83D\uDCAC WhatsApp"}</a> : null}
                </div>
              );
            })() : null}
          </div>
        </>
      ) : null}
    </article>
  );
}

function ShareButton(props: { title: string }) {
  var [copied, setCopied] = useState(false);

  function onClick() {
    var url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: props.title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        setCopied(true);
        setTimeout(function () { setCopied(false); }, 2000);
      });
    }
  }

  return (
    <button onClick={onClick} aria-label="Partager ce lien de suivi" className="lt-no-print-share" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {copied ? "\u2713 Copie !" : "\uD83D\uDD17 Partager"}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RATING WIDGET — client note l'experience a la cloture du dossier
// ═══════════════════════════════════════════════════════════════════
//
// Affiche sur la vue BL UNIQUEMENT (pas vue client multi-dossiers).
// Visible seulement si `dosSt` === "CLOTURE" ou "ARCHIVE".
// Ecrit une fois dans /tracking/{tokId} via updateDoc + serverTimestamp.
// Authenticite auteur = approximation UX via localStorage (pas d'auth).

var RATING_REASONS = [
  { k: "retard", l: "Retard" },
  { k: "communication", l: "Communication difficile" },
  { k: "tarif", l: "Tarif" },
  { k: "qualite", l: "Qualite de service" },
  { k: "autre", l: "Autre" },
];

interface RatingWidgetProps {
  tokId: string;
  data: any;  // TrackingDoc — mais comprend aussi les vieux docs sans dosSt
  onRated: () => void;
}

function RatingWidget(p: RatingWidgetProps) {
  var tokId = p.tokId;
  var data = p.data;
  var [selected, setSelected] = useState<1 | 2 | 3 | null>(null);
  var [reasons, setReasons] = useState<string[]>([]);
  var [comment, setComment] = useState("");
  var [submitting, setSubmitting] = useState(false);
  var [done, setDone] = useState(false);
  var [err, setErr] = useState("");

  // Approximation "auteur" : localStorage set apres submit.
  // Pas scientifique (meme device/browser = considere auteur).
  var STORAGE_KEY = "sapurai-rated-" + tokId;
  var isAuthor = (function () {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch (_e) { return false; }
  })();

  // Guard : widget visible uniquement si dossier cloture et pas deja note
  var isClotured = data && (data.dosSt === "CLOTURE" || data.dosSt === "ARCHIVE");
  var alreadyRated = data && (data.rating === 1 || data.rating === 2 || data.rating === 3);

  if (!isClotured) return null;

  // Cas 1 : deja note ET c'est l'auteur → afficher confirmation figee
  if (alreadyRated && isAuthor) {
    var ratingLabel = data.rating === 1 ? "Tres satisfait" : data.rating === 2 ? "Correct" : "Probleme signale";
    var ratingColor = data.rating === 1 ? "var(--success)" : data.rating === 2 ? "var(--warning)" : "var(--danger)";
    return (
      <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px var(--shadow)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{"Votre avis"}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: ratingColor }}>{"\u2713 " + ratingLabel}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{"Merci, votre avis a ete enregistre."}</div>
      </div>
    );
  }

  // Cas 2 : deja note MAIS l'utilisateur actuel n'est pas l'auteur → ne rien montrer
  if (alreadyRated && !isAuthor) return null;

  // Cas 3 : submit success immediat (avant le listener qui relit data)
  if (done) {
    return (
      <div role="status" aria-live="polite" style={{ background: "var(--success-bg)", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid var(--success-border)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--success-text)" }}>{"Merci pour votre retour !"}</div>
        <div style={{ fontSize: 13, color: "var(--success-text)", marginTop: 6, lineHeight: 1.5 }}>
          {selected === 3 ? "Votre transitaire sera alerte et vous rappellera si besoin." : "Votre avis aide votre transitaire a ameliorer son service."}
        </div>
      </div>
    );
  }

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setErr("");
    try {
      var payload: Record<string, any> = {
        rating: selected,
        ratingAt: serverTimestamp(),  // IMPORTANT : serverTimestamp, pas ISO string (rules verifient == request.time)
      };
      // Raisons + commentaire SEULEMENT si rating=3 (probleme)
      if (selected === 3) {
        if (reasons.length > 0) payload.ratingReasons = reasons;
        if (comment.trim().length > 0) payload.ratingComment = comment.trim().slice(0, 200);
      }
      await updateDoc(doc(db, "tracking", tokId), payload);
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (_e) {}
      setDone(true);
      p.onRated();
    } catch (e: any) {
      setSubmitting(false);
      setErr("Erreur d'enregistrement. Verifiez votre connexion et reessayez.");
    }
  }

  function toggleReason(k: string) {
    setReasons(function (prev) {
      return prev.indexOf(k) >= 0 ? prev.filter(function (x) { return x !== k; }) : prev.concat([k]);
    });
  }

  var btnBase: any = { flex: 1, minHeight: 56, borderRadius: 10, padding: "12px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "2px solid transparent", transition: "background 0.2s ease-out, color 0.2s ease-out, border-color 0.2s ease-out", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 };

  return (
    <div className="lt-no-print-share" style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px var(--shadow)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{"Votre avis"}</div>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 14px 0" }}>{"Comment s'est passe votre dossier ?"}</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          onClick={function () { setSelected(1); }}
          aria-pressed={selected === 1}
          style={Object.assign({}, btnBase, {
            background: selected === 1 ? "var(--success-bg)" : "var(--bg-secondary)",
            borderColor: selected === 1 ? "var(--success)" : "transparent",
            color: "var(--text-primary)",
          })}
        >
          <span style={{ fontSize: 22 }}>{"\uD83D\uDE0A"}</span>
          <span>{"Tres satisfait"}</span>
        </button>
        <button
          onClick={function () { setSelected(2); }}
          aria-pressed={selected === 2}
          style={Object.assign({}, btnBase, {
            background: selected === 2 ? "var(--warning-bg)" : "var(--bg-secondary)",
            borderColor: selected === 2 ? "var(--warning)" : "transparent",
            color: "var(--text-primary)",
          })}
        >
          <span style={{ fontSize: 22 }}>{"\uD83D\uDE10"}</span>
          <span>{"Correct, pas parfait"}</span>
        </button>
        <button
          onClick={function () { setSelected(3); }}
          aria-pressed={selected === 3}
          style={Object.assign({}, btnBase, {
            background: selected === 3 ? "var(--danger-bg)" : "var(--bg-secondary)",
            borderColor: selected === 3 ? "var(--danger)" : "transparent",
            color: "var(--text-primary)",
          })}
        >
          <span style={{ fontSize: 22 }}>{"\uD83D\uDE1F"}</span>
          <span>{"Probleme a resoudre"}</span>
        </button>
      </div>

      {selected === 3 ? (
        <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{"Qu'est-ce qui n'a pas marche ? (plusieurs choix possibles)"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {RATING_REASONS.map(function (r) {
              var active = reasons.indexOf(r.k) >= 0;
              return (
                <button
                  key={r.k}
                  onClick={function () { toggleReason(r.k); }}
                  aria-pressed={active}
                  style={{
                    background: active ? "var(--danger)" : "var(--bg-primary)",
                    color: active ? "white" : "var(--text-primary)",
                    border: "1px solid " + (active ? "var(--danger)" : "var(--border)"),
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: 36,
                  }}
                >{r.l}</button>
              );
            })}
          </div>
          <label htmlFor="rating-comment" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>{"Precisez (optionnel)"}</label>
          <textarea
            id="rating-comment"
            value={comment}
            onChange={function (e) { setComment(e.target.value.slice(0, 200)); }}
            placeholder="Decrivez en quelques mots..."
            rows={3}
            maxLength={200}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-sans)", resize: "vertical", background: "var(--bg-primary)", color: "var(--text-input)", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: "right", marginTop: 4 }}>{comment.length + " / 200"}</div>
        </div>
      ) : null}

      {err ? <div role="alert" style={{ background: "var(--danger-light)", color: "var(--danger-text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{err}</div> : null}

      <button
        onClick={submit}
        disabled={!selected || submitting}
        style={{
          width: "100%",
          minHeight: 48,
          background: selected && !submitting ? "var(--btn-primary-bg)" : "var(--bg-secondary)",
          color: selected && !submitting ? "var(--btn-primary-text)" : "var(--text-muted)",
          border: "none",
          borderRadius: 10,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: selected && !submitting ? "pointer" : "not-allowed",
        }}
      >{submitting ? "Envoi..." : "Envoyer mon avis"}</button>
    </div>
  );
}

function Footer() {
  return (
    <div className="lt-no-print-share" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg-primary)", borderTop: "1px solid var(--border)", padding: "12px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {"Suivi via "}
        <a href="https://sapurai-84984.web.app" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: "var(--success)", textDecoration: "none" }}>{"Sapurai"}</a>
        {" \u2014 Essayer gratuitement"}
      </div>
    </div>
  );
}

// Loading skeleton : placeholder du layout reel
function Skeleton() {
  var bar = { background: "var(--bg-secondary)", borderRadius: 6, height: 12 } as any;
  return (
    <div style={PAGE} aria-busy="true" aria-label="Chargement du suivi">
      <div style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
        <div style={Object.assign({}, bar, { width: 140, height: 16, marginBottom: 6 })}></div>
        <div style={Object.assign({}, bar, { width: 90, height: 10 })}></div>
      </div>
      <div style={{ padding: "16px 16px 100px 16px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px var(--shadow)" }}>
          <div style={Object.assign({}, bar, { width: 100, marginBottom: 12 })}></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={Object.assign({}, bar, { height: 36 })}></div>
            <div style={Object.assign({}, bar, { height: 36 })}></div>
            <div style={Object.assign({}, bar, { height: 36 })}></div>
            <div style={Object.assign({}, bar, { height: 36 })}></div>
          </div>
        </div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: "0 1px 3px var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={Object.assign({}, bar, { width: 120 })}></div>
            <div style={Object.assign({}, bar, { width: 60, height: 24, borderRadius: 8 })}></div>
          </div>
          <div style={Object.assign({}, bar, { height: 40, marginBottom: 12 })}></div>
          <div style={Object.assign({}, bar, { height: 70, borderRadius: 10 })}></div>
        </div>
      </div>
    </div>
  );
}

interface TrackingPageProps {
  tokId: string;
}

export default function TrackingPage(p: TrackingPageProps) {
  var tokId = p.tokId;
  var [data, setData] = useState<any>(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState("");

  // Sprint 28 polish : print CSS deplace vers src/styles/print.css (statique).
  // Reste runtime : meta robots noindex (lie a la route /t/, ne doit pas s'appliquer ailleurs).
  useEffect(function () {
    var meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow,noarchive";
    document.head.appendChild(meta);
    return function () {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(function () {
    if (!tokId) { setError("Lien invalide"); setLoading(false); return; }
    var ref = doc(db, "tracking", tokId);
    var unsub = onSnapshot(ref, function (snap) {
      if (snap.exists()) {
        setData(snap.data());
        setError("");
      } else {
        setError("Dossier introuvable ou lien expiré");
      }
      setLoading(false);
    }, function () {
      setError("Erreur de connexion");
      setLoading(false);
    });
    return function () { unsub(); };
  }, [tokId]);

  if (loading) return <Skeleton />;

  if (error) return (
    <div style={PAGE}>
      <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: 420, margin: "0 auto" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">{"\uD83D\uDD0D"}</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>{"Dossier introuvable"}</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>{error}</p>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--border)", textAlign: "left", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{"Que faire ?"}</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>{"Verifiez le lien (sans espace supplementaire)"}</li>
            <li style={{ marginBottom: 4 }}>{"Demandez a votre transitaire de regenerer un nouveau lien"}</li>
            <li>{"Le dossier est peut-etre cloture ou archive"}</li>
          </ul>
        </div>
      </div>
    </div>
  );

  var d = data;

  // Client multi-dossier view
  if (d && d.type === "client") {
    var clientDos = d.dos || [];
    return (
      <div style={PAGE}>
        <header style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", color: "var(--text-primary)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.coName || "Suivi de dossier"}</div>
          </div>
          <ShareButton title={"Suivi " + (d.cl || "client")} />
        </header>
        <main style={{ padding: "16px 16px 100px 16px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px var(--shadow)" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{"Client"}</div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>{d.cl || "—"}</h1>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{String(clientDos.length) + " dossier(s)"}</div>
          </div>
          {clientDos.map(function (dos2: any, di: number) {
            var dosTcs = dos2.tcs || [];
            return (
              <section key={di} style={{ marginBottom: 20 }} aria-labelledby={"dos-" + di}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span id={"dos-" + di}>{"BL: " + (dos2.bl || "?")}</span>
                  <span>{dos2.da ? formatDate(dos2.da) : ""}</span>
                </div>
                {dosTcs.map(function (tc: Tc, idx: number) {
                  return <TcTrackingCard key={idx} tc={tc} fallbackIndex={idx} />;
                })}
              </section>
            );
          })}
          {d.updatedAt ? <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)", marginTop: 20 }} title={formatDateTime(d.updatedAt)}>{"Mis \u00E0 jour " + relativeTime(d.updatedAt)}</div> : null}
        </main>
        <Footer />
      </div>
    );
  }

  var tcs = d.tcs || [];

  return (
    <div style={PAGE}>
      <header style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", color: "var(--text-primary)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.coName || "Suivi de dossier"}</div>
        </div>
        <ShareButton title={"Suivi BL " + (d.bl || "")} />
      </header>

      <main style={{ padding: "16px 16px 100px 16px", maxWidth: 600, margin: "0 auto" }}>
        {/* Dossier Info */}
        <section style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px var(--shadow)" }} aria-label="Informations du dossier">
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{"Informations du dossier"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={LBL}>{"Client"}</div>
              <div style={VAL}>{d.cl || "—"}</div>
            </div>
            <div>
              <div style={LBL}>{"N\u00B0 BL"}</div>
              <div style={Object.assign({}, VAL, { fontFamily: "var(--font-mono)" })}>{d.bl || "—"}</div>
            </div>
            <div>
              <div style={LBL}>{"Compagnie"}</div>
              <div style={VAL}>{d.cp || "—"}</div>
            </div>
            <div>
              <div style={LBL}>{"Date d'arriv\u00E9e"}</div>
              <div style={VAL}>{d.da ? formatDate(d.da) : "—"}</div>
            </div>
            {d.vesselName ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={LBL}>{"Navire"}</div>
                <div style={VAL}>{d.vesselName + (d.voyageNumber ? " · " + d.voyageNumber : "")}</div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Sprint 25 #3 : Timeline du voyage (si recuperee via API armateur) */}
        {Array.isArray(d.timeline) && d.timeline.length > 0 ? (
          <VoyageTimeline timeline={d.timeline} />
        ) : null}

        {/* Sprint 28 polish : h2 redondant retire, section wrappee avec aria-label */}
        <section aria-label={String(tcs.length) + " conteneur" + (tcs.length > 1 ? "s" : "")}>
          {tcs.map(function (tc: Tc, idx: number) {
            return <TcTrackingCard key={idx} tc={tc} fallbackIndex={idx} />;
          })}
        </section>

        {/* Rating client — visible uniquement si dossier cloture */}
        <RatingWidget tokId={tokId} data={d} onRated={function () {}} />

        {d.updatedAt ? (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)", marginTop: 20 }} title={formatDateTime(d.updatedAt)}>
            {"Mis \u00E0 jour " + relativeTime(d.updatedAt)}
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

// Sprint 25 #3 : composant timeline voyage (events ARRI/DEPA tries chronologiquement)
function VoyageTimeline(p: { timeline: Array<{ port: string; portCode?: string; date: string; type: 'DEPA' | 'ARRI'; vessel?: string; voyage?: string; classifier?: string; phase?: string }> }) {
  if (!p.timeline || p.timeline.length === 0) return null;
  return (
    <section style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px var(--shadow)" }} aria-label="Voyage navire">
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{"Voyage"}</div>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        {p.timeline.map(function (e, i) {
          var isAct = e.classifier === 'ACT';
          var isLast = i === p.timeline.length - 1;
          var color = isAct ? "var(--success)" : "var(--text-muted)";
          var label = e.type === 'DEPA' ? 'Depart' : 'Arrivee';
          return (
            <div key={i} style={{ position: "relative", paddingBottom: isLast ? 0 : 14 }}>
              <div style={{ position: "absolute", left: -22, top: 4, width: 12, height: 12, borderRadius: "50%", background: isAct ? color : "var(--bg-primary)", border: "2px solid " + color, zIndex: 1 }} />
              {!isLast ? <div style={{ position: "absolute", left: -17, top: 16, bottom: -2, width: 2, background: "var(--border)" }} /> : null}
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", marginBottom: 1 }}>{formatDate(e.date) + (isAct ? "" : " (prevu)")}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{label + " " + e.port + (e.portCode ? " (" + e.portCode + ")" : "")}</div>
              {e.vessel ? <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>{e.vessel + (e.voyage ? " - " + e.voyage : "")}</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

var PAGE = { minHeight: "100vh", background: "var(--bg-body)", fontFamily: "var(--font-sans)" };
var LBL = { fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 4 };
var VAL = { fontSize: 14, fontWeight: 700, color: "var(--text-primary)" };

function formatDate(d: string): string {
  if (!d) return "";
  var parts = d.split("-");
  if (parts.length === 3) return parts[2] + "/" + parts[1] + "/" + parts[0];
  return d;
}

function formatDateTime(iso: string): string {
  try {
    var d = new Date(iso);
    return d.toLocaleDateString("fr-FR") + " \u00E0 " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return iso; }
}
