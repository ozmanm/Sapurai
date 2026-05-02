import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { fm } from '../../utils/format.js';

var PHASES = [
  { k: "ACOMPTE_BAM", l: "Acompte Bamako" },
  { k: "URGENCE",     l: "Urgence route" },
  { k: "RELIQUAT",    l: "Reliquat retour" },
];

var PLBL = { AVANCE_DK: "Avance DK", ACOMPTE_BAM: "Acompte BAM", URGENCE: "Urgence", RELIQUAT: "Reliquat" };

interface TrancheFormProps { tc: any; tranches: any[]; onClose: () => void; onSave: (ph: string, mt: number, note?: string) => void; nf: (m: string, t?: string) => void; }

function TrancheForm(p: TrancheFormProps) {
  var tc = p.tc;
  var tranches = p.tranches || [];
  var [ph, sPh] = useState("ACOMPTE_BAM");
  var [mt, sMt] = useState("");
  var [note, sNote] = useState("");

  if (!tc) return null;

  var budget = parseInt(tc.budget) || 0;
  var totalVerse = tranches.reduce(function (s, t) { return s + (t.mt || 0); }, 0);
  var reste = budget > 0 ? budget - totalVerse : null;

  return (
    <div>
      <div style={{ background: "var(--info-bg)", padding: 14, borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{(tc.n || "?") + " \u2014 " + (tc.ch || "?")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>{"BUDGET"}</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{budget > 0 ? fm(budget) : "---"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--success)", fontWeight: 600 }}>{"VERSE"}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--success)" }}>{fm(totalVerse)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: reste !== null && reste < 0 ? "var(--danger)" : "var(--warning)", fontWeight: 600 }}>{"RESTE"}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: reste === null ? "var(--text-muted)" : reste < 0 ? "var(--danger)" : reste === 0 ? "var(--success)" : "var(--warning)" }}>
              {reste !== null ? fm(reste) : "---"}
            </div>
          </div>
        </div>
      </div>

      {tranches.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 6 }}>{"Historique"}</div>
          {tranches.map(function (t) {
            return (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-tertiary)", padding: "7px 10px", borderRadius: 6, marginBottom: 4, fontSize: 12, border: "1px solid var(--border-light)" }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{PLBL[t.ph] || "Transport"}</span>
                  {t.ds ? <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>{t.ds.split(" - ").slice(2).join(" - ")}</span> : null}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: "var(--success)" }}>{fm(t.mt || 0)}</span>
                  <span style={{ background: t.s === "PAYE" ? "var(--success-light)" : "var(--warning-bg)", color: t.s === "PAYE" ? "var(--success-text)" : "var(--warning-text)", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{t.s === "PAYE" ? "Paye" : "Att"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>{"Nouveau versement"}</div>
        <div style={{ marginBottom: 10 }}>
          <label style={LS}>{"Type *"}</label>
          <select value={ph} onChange={function (e) { sPh(e.target.value); }} style={IS}>
            {PHASES.map(function (p2) { return <option key={p2.k} value={p2.k}>{p2.l}</option>; })}
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={LS}>{"Montant FCFA *"}</label>
          <input type="number" value={mt} onChange={function (e) { sMt(e.target.value); }} style={IS} placeholder="0" />
          {reste !== null && mt && parseFloat(mt) > reste ? <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 3 }}>{"Depasse le reste du budget de " + fm(parseFloat(mt) - reste)}</div> : null}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LS}>{"Note"}</label>
          <input value={note} onChange={function (e) { sNote(e.target.value); }} placeholder={"Ex: Orange Money, virement BDK..."} style={IS} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <button onClick={p.onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Annuler"}</button>
        <button onClick={function () { if (!mt || parseFloat(mt) <= 0) { p.nf("Montant requis", "error"); return; } p.onSave(ph, parseFloat(mt), note); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Enregistrer"}</button>
      </div>
    </div>
  );
}

export default TrancheForm;
