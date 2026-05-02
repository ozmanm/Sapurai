import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { DEF_TARIFS } from '../../constants/tarifs.js';
import { TCTYPES_ALL } from '../../constants/depenses.js';
import { fm } from '../../utils/format.js';

interface DevisFormProps {
  cfg: any;
  nf: (m: string, t?: string) => void;
  onClose: () => void;
}

function DevisForm(p: DevisFormProps) {
  var tarifs = p.cfg.tarifs || DEF_TARIFS;
  var compagnies = Object.keys(tarifs.location || {});
  var [comp, setComp] = useState(compagnies[0] || "CMA CGM");
  var [lines, setLines] = useState([{ ty: "20GP", qty: 1 }]);
  var [client, setClient] = useState("");

  function addLine() { setLines(lines.concat([{ ty: "40GP", qty: 1 }])); }
  function updLine(i, f, v) { var a = lines.slice(); a[i] = Object.assign({}, a[i]); a[i][f] = f === "qty" ? (parseInt(v) || 1) : v; setLines(a); }
  function rmLine(i) { setLines(lines.filter(function (_, j) { return j !== i; })); }

  var locGrid = (tarifs.location || {})[comp] || {};
  var autGrid = (tarifs.autres || {})[comp] || {};
  var dpGrid = tarifs.dpworld || {};
  var orGrid = tarifs.orbus || {};
  var missionUnit = tarifs.mission || 30000;

  var totalTC = lines.reduce(function (a, l) { return a + l.qty; }, 0);

  var breakdown = lines.map(function (l) {
    var loc = (locGrid[l.ty] || 0) * l.qty;
    var aut = (autGrid[l.ty] || 0) * l.qty;
    var dpw = (dpGrid[l.ty] || 0) * l.qty;
    var orb = (orGrid[l.ty] || 0) * l.qty;
    var mis = missionUnit * l.qty;
    return { ty: l.ty, qty: l.qty, loc: loc, aut: aut, dpw: dpw, orb: orb, mis: mis, total: loc + aut + dpw + orb + mis };
  });

  var totals = { loc: 0, aut: 0, dpw: 0, orb: 0, mis: 0, total: 0 };
  breakdown.forEach(function (b) { totals.loc += b.loc; totals.aut += b.aut; totals.dpw += b.dpw; totals.orb += b.orb; totals.mis += b.mis; totals.total += b.total; });

  function shareText() {
    var t = "\uD83E\uDDFE DEVIS ESTIMATIF\n";
    if (client) t += "Client: " + client + "\n";
    t += "Compagnie: " + comp + "\n";
    t += "Conteneurs: " + totalTC + "\n";
    t += "---\n";
    breakdown.forEach(function (b) {
      t += "\n" + b.qty + "x " + b.ty + ":\n";
      if (b.loc > 0) t += "  Location TC: " + fm(b.loc) + "\n";
      if (b.aut > 0) t += "  Autres frais: " + fm(b.aut) + "\n";
      if (b.dpw > 0) t += "  DP World: " + fm(b.dpw) + "\n";
      if (b.orb > 0) t += "  Orbus: " + fm(b.orb) + "\n";
      t += "  Ordre mission: " + fm(b.mis) + "\n";
      t += "  Sous-total: " + fm(b.total) + "\n";
    });
    t += "\n---\nTOTAL ESTIME: " + fm(totals.total) + " FCFA\n";
    t += "\n* Hors surestaries et frais variables";
    return t;
  }

  function copyDevis() {
    navigator.clipboard.writeText(shareText()).then(function () { p.nf("Devis copie !"); });
  }

  function shareDevis() {
    if (navigator.share) {
      navigator.share({ text: shareText() }).catch(function () {});
    } else { copyDevis(); }
  }

  var anyZero = totals.loc === 0 && totals.aut === 0 && totals.dpw === 0 && totals.orb === 0;

  return (
    <div>
      {anyZero ? <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--warning-text)" }}>
        {"\u26A0 Tarifs non configures. Allez dans Parametres > Grille tarifaire pour saisir vos prix. Seul l'ordre de mission (30 000/TC) est pre-rempli."}
      </div> : null}

      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={LS}>{"Client (optionnel)"}</label>
          <input value={client} onChange={function (e) { setClient(e.target.value); }} placeholder="Nom du client" style={IS} />
        </div>
        <div>
          <label style={LS}>{"Compagnie maritime"}</label>
          <select value={comp} onChange={function (e) { setComp(e.target.value); }} style={IS}>
            {compagnies.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontWeight: 700, fontSize: 13 }}>{"Conteneurs (" + totalTC + ")"}</label>
          <button onClick={addLine} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-tertiary)" }}>{"+ Ligne"}</button>
        </div>
        {lines.map(function (l, i) {
          return <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <select value={l.ty} onChange={function (e) { updLine(i, "ty", e.target.value); }} style={{ flex: 2, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg-secondary)", color: "var(--text-input)" }}>
              {TCTYPES_ALL.map(function (t) { return <option key={t} value={t}>{t}</option>; })}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
              <button onClick={function () { if (l.qty > 1) updLine(i, "qty", l.qty - 1); }} style={{ width: 30, height: 30, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-primary)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>{"\u2212"}</button>
              <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: "center" }}>{String(l.qty)}</span>
              <button onClick={function () { updLine(i, "qty", l.qty + 1); }} style={{ width: 30, height: 30, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-primary)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>{"+"}</button>
            </div>
            {lines.length > 1 ? <button onClick={function () { rmLine(i); }} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 16 }}>{"x"}</button> : null}
          </div>;
        })}
      </div>

      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 1fr 1.2fr", background: "var(--bg-tertiary)", padding: "8px 12px", gap: 6, fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
          <span>{"TYPE"}</span><span style={{ textAlign: "right" }}>{"Location"}</span><span style={{ textAlign: "right" }}>{"Autres"}</span><span style={{ textAlign: "right" }}>{"DP World"}</span><span style={{ textAlign: "right" }}>{"Orbus"}</span><span style={{ textAlign: "right" }}>{"Mission"}</span><span style={{ textAlign: "right", fontWeight: 800, color: "var(--text-primary)" }}>{"TOTAL"}</span>
        </div>
        {breakdown.map(function (b, i) {
          return <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 1fr 1.2fr", padding: "10px 12px", gap: 6, fontSize: 12, borderTop: "1px solid var(--border-light)" }}>
            <span style={{ fontWeight: 700 }}>{b.qty + "x " + b.ty}</span>
            <span style={{ textAlign: "right", color: b.loc > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{b.loc > 0 ? fm(b.loc) : "---"}</span>
            <span style={{ textAlign: "right", color: b.aut > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{b.aut > 0 ? fm(b.aut) : "---"}</span>
            <span style={{ textAlign: "right", color: b.dpw > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{b.dpw > 0 ? fm(b.dpw) : "---"}</span>
            <span style={{ textAlign: "right", color: b.orb > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{b.orb > 0 ? fm(b.orb) : "---"}</span>
            <span style={{ textAlign: "right" }}>{fm(b.mis)}</span>
            <span style={{ textAlign: "right", fontWeight: 800 }}>{fm(b.total)}</span>
          </div>;
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 1fr 1.2fr", padding: "10px 12px", gap: 6, fontSize: 12, borderTop: "2px solid var(--border)", background: "var(--bg-tertiary)", fontWeight: 700 }}>
          <span style={{ fontWeight: 800 }}>{"TOTAL"}</span>
          <span style={{ textAlign: "right" }}>{totals.loc > 0 ? fm(totals.loc) : "---"}</span>
          <span style={{ textAlign: "right" }}>{totals.aut > 0 ? fm(totals.aut) : "---"}</span>
          <span style={{ textAlign: "right" }}>{totals.dpw > 0 ? fm(totals.dpw) : "---"}</span>
          <span style={{ textAlign: "right" }}>{totals.orb > 0 ? fm(totals.orb) : "---"}</span>
          <span style={{ textAlign: "right" }}>{fm(totals.mis)}</span>
          <span style={{ textAlign: "right", fontWeight: 900, fontSize: 14, color: "var(--success)" }}>{fm(totals.total)}</span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, fontStyle: "italic" }}>{"* Estimation hors surestaries, detentions et frais variables"}</div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <button onClick={p.onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Fermer"}</button>
        <button onClick={copyDevis} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"\uD83D\uDCCB Copier"}</button>
        <button onClick={shareDevis} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"\uD83D\uDCE4 Envoyer"}</button>
      </div>
    </div>
  );
}

export default DevisForm;
