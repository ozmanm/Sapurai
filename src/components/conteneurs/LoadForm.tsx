// src/components/conteneurs/LoadForm.tsx
// Sprint 46 - Confirmation du chargement effectif (ASSIGNE -> DISPATCHE).
//
// S'ouvre via la modal `t: "load"` quand l'utilisateur clique sur "Confirmer
// chargement" pour un TC deja assigne. Pose la date `dsp` (= sortie terminal)
// et permet optionnellement un complement de paiement si necessaire.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { today } from '../../utils/date';
import { fm } from '../../utils/format';
import type { Conteneur } from '../../types';

interface LoadFormProps {
  tc: Conteneur;
  onLoad: (tid: string, dsp?: string, extraPayment?: number) => void;
  onClose: () => void;
  nf: (msg: string, type?: string) => void;
}

var LS: CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };
var IS: CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box", minHeight: 44 };

export default function LoadForm(p: LoadFormProps) {
  var tc = p.tc;
  var [dspDate, setDspDate] = useState<string>(today());
  var [extraPayment, setExtraPayment] = useState<string>('');

  // Calcul du delai assignation -> chargement (Sprint 46 KPI)
  var delaiJours = (function () {
    if (!tc.dassign) return null;
    var a = new Date(tc.dassign); a.setHours(0, 0, 0, 0);
    var b = new Date(dspDate); b.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
  })();

  function doLoad() {
    if (!dspDate) { p.nf('Date de chargement requise', 'error'); return; }
    var extra = parseFloat(extraPayment) || 0;
    p.onLoad(tc.id, dspDate, extra > 0 ? extra : undefined);
  }

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Bandeau resume TC */}
      <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Conteneur</div>
        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>{tc.n || '?'} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>· {tc.ty}</span></div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          <div>Chauffeur : <strong style={{ color: 'var(--text-primary)' }}>{tc.ch || '?'}</strong> ({tc.cm || '—'})</div>
          {tc.dassign ? (
            <div>Assigne le : <strong style={{ color: 'var(--text-primary)' }}>{tc.dassign}</strong></div>
          ) : null}
          {tc.budget ? (
            <div>Budget : <strong style={{ color: 'var(--text-primary)' }}>{fm(Number(tc.budget))} FCFA</strong></div>
          ) : null}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={LS}>{"Date de chargement effectif"}</label>
        <input type="date" value={dspDate} onChange={function (e) { setDspDate(e.target.value); }} style={IS} />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{"Sortie du terminal — debut de la detention compagnie"}</div>
      </div>

      {delaiJours !== null && delaiJours > 0 ? (
        <div style={{ background: delaiJours > 5 ? "var(--warning-bg, var(--bg-tertiary))" : "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", marginBottom: 12, fontSize: 12, color: "var(--text-secondary)" }}>
          {"Delai assignation → chargement : "}<strong style={{ color: delaiJours > 5 ? "var(--warning)" : "var(--text-primary)" }}>{delaiJours} jour{delaiJours > 1 ? 's' : ''}</strong>
          {delaiJours > 5 ? " (delai eleve)" : ""}
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <label style={LS}>{"Complement de paiement (optionnel)"}</label>
        <input type="number" value={extraPayment} onChange={function (e) { setExtraPayment(e.target.value); }} style={IS} placeholder="0" min="0" />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{"Ajustement de l'avance si le chauffeur a besoin de plus au moment du chargement"}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <button onClick={p.onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Annuler"}</button>
        <button onClick={doLoad} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Confirmer chargement"}</button>
      </div>
    </div>
  );
}
