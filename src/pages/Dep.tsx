import { useState } from 'react';
import { fd, fm } from '../utils/format.js';
import { DTL } from '../constants/depenses.js';
import { IS } from '../constants/styles.js';
import { exportDepenses } from '../utils/export.js';
import { pdfDepenses } from '../utils/pdf.js';
import usePagination from '../hooks/usePagination.js';
import Pagination from '../components/ui/Pagination.tsx';
import EmptyState from '../components/ui/EmptyState.tsx';

interface DepProps { [key: string]: any; }

function Dep(p: DepProps) {
  var dep = p.dep;
  var dos = p.dos;
  var canEdit = p.canEdit;
  var qr = p.qr;
  var setQr = p.setQr;
  var setMl = p.setMl;
  var toggleDepSt = p.toggleDepSt;
  var deleteDep = p.deleteDep;
  var ignoreDep = p.ignoreDep;
  var companyName = p.companyName || "";
  var [pendingDel, setPendingDel] = useState(null);
  var [tab, setTab] = useState("TOUTES");

  // Exclut les stubs ignores de TOUTES les vues (soft-delete)
  var visible = dep.filter(function (f) { return !f.ignored; });
  var filtered = visible.slice();
  if (qr) {
    var q = qr.toLowerCase();
    filtered = filtered.filter(function (f) {
      var d = dos.find(function (x) { return x.id === f.did; });
      if (!d) return false;
      return (d.bl || "").toLowerCase().indexOf(q) >= 0 || (d.cl || "").toLowerCase().indexOf(q) >= 0 || (DTL[f.tp] || "").toLowerCase().indexOf(q) >= 0;
    });
  }
  var fatt = filtered.filter(function (f) { return f.status === "en_attente_facture"; }).length;
  var fpaye = filtered.filter(function (f) { return f.s === "PAYE"; }).length;
  var fimp = filtered.filter(function (f) { return f.s !== "PAYE" && f.status !== "en_attente_facture"; }).length;
  var reversed = filtered.slice().reverse();
  // Filtrer par tab
  var tabFiltered = tab === "EN_ATT" ? reversed.filter(function (f) { return f.status === "en_attente_facture"; })
    : tab === "A_PAYER" ? reversed.filter(function (f) { return f.s !== "PAYE" && f.status !== "en_attente_facture"; })
    : tab === "PAYEES" ? reversed.filter(function (f) { return f.s === "PAYE"; })
    : reversed;
  // Totaux recalcules selon le tab actif
  var ftot = tabFiltered.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var fht = tabFiltered.reduce(function (a, f) { return a + (f.ht || f.mt || 0); }, 0);
  var ftax = ftot - fht;
  var pg = usePagination<any>(tabFiltered, 20);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>{"Dépenses (" + String(dep.length) + ")"}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canEdit ? <button onClick={function () { setMl({ t: "ndep" }); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"+ Nouvelle"}</button> : null}
          <button onClick={function () { exportDepenses(dep, dos, companyName); }} title="Exporter Excel" style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 13 }}>{"↓ Excel"}</button>
          <button onClick={function () { pdfDepenses(filtered, dos, companyName); }} title="Exporter PDF" style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 13 }}>{"↓ PDF"}</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={qr} onChange={function (e) { setQr(e.target.value); }} placeholder="Filtrer par BL, client ou type..." style={Object.assign({}, IS, { flex: 1, minWidth: 200 })} />
        <select value={qr} onChange={function (e) { setQr(e.target.value); }} style={Object.assign({}, IS, { width: "auto", minWidth: 180, maxWidth: 280, color: qr ? "var(--text-primary)" : "var(--text-muted)", fontWeight: qr ? 700 : 400 })}>
          <option value="">{"Tous les dossiers"}</option>
          {dos.filter(function (d) { return dep.some(function (f) { return f.did === d.id; }); }).map(function (d) {
            var nd = dep.filter(function (f) { return f.did === d.id; }).length;
            return <option key={d.id} value={d.bl || ""}>{(d.cl || "?") + " - " + (d.bl || "") + " (" + String(nd) + ")"}</option>;
          })}
        </select>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "TOUTES", label: "Toutes", count: filtered.length, color: "var(--text-primary)" },
          { key: "EN_ATT", label: "En attente", count: fatt, color: "var(--info-text)" },
          { key: "A_PAYER", label: "A payer", count: fimp, color: "var(--warning)" },
          { key: "PAYEES", label: "Payees", count: fpaye, color: "var(--success)" }
        ].map(function (t) {
          var active = tab === t.key;
          return <button key={t.key} onClick={function () { setTab(t.key); }} style={{
            background: active ? "var(--btn-primary-bg)" : "var(--bg-primary)",
            color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
            border: active ? "none" : "1px solid var(--border)",
            borderRadius: 8, padding: "8px 16px", fontWeight: 700,
            cursor: "pointer", fontSize: 13, minHeight: 44
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: active ? "var(--btn-primary-text)" : t.color }}>{String(t.count)}</div>
            <div style={{ fontSize: 11 }}>{t.label}</div>
          </button>;
        })}
      </div>
      <div className="lt-grid4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 12, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{"HT"}</div><div style={{ fontSize: 14, fontWeight: 800 }}>{fm(fht)}</div></div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 12, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--danger-text)", fontWeight: 600 }}>{"TTC"}</div><div style={{ fontSize: 14, fontWeight: 800, color: "var(--danger-text)" }}>{fm(ftot)}</div></div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 12, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--warning-text)", fontWeight: 600 }}>{"TAXES"}</div><div style={{ fontSize: 14, fontWeight: 800, color: "var(--warning)" }}>{fm(ftax)}</div></div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 12, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--success-text)", fontWeight: 600 }}>{"PAYE"}</div><div style={{ fontSize: 14, fontWeight: 800, color: "var(--success-text)" }}>{String(fpaye) + "/" + String(fpaye + fimp)}</div></div>
      </div>
      <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 90px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
          {["TYPE", "DOSSIER", "HT", "TAXES", "TTC", "STATUT"].map(function (h) { return <div key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</div>; })}
        </div>
        {pg.paginated.map(function (f) {
          var d = dos.find(function (x) { return x.id === f.did; });
          var dn = d ? (d.cl || "") + " - " + (d.bl || "") : "";
          var hasFile = f.fid || (f.fi && f.fi.fn);
          var tax = (f.mt || 0) - (f.ht || f.mt || 0);
          return <div key={f.id}>
            <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 90px", alignItems: "center", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ padding: "12px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>{DTL[f.tp] || f.tp || "?"}</span>
                  {hasFile ? <span style={{ color: "var(--text-primary)" }}>{"\uD83D\uDCCE"}</span> : null}
                  {f.auto ? <span title="Cree automatiquement a l'arrivee" style={{ fontSize: 9, background: "var(--info-bg)", color: "var(--info-text)", padding: "1px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.3 }}>{"AUTO"}</span> : null}
                </div>
                {f.nf ? <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{"N° " + f.nf}</div> : null}
                {f.ds ? <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{f.ds}</div> : null}
              </div>
              <div style={{ padding: "12px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-input)" }}>{d ? d.cl || "?" : "?"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d ? (d.bl || "") + " · " + fd(f.dt) : fd(f.dt)}</div>
              </div>
              <div style={{ padding: "12px 12px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fm(f.ht || f.mt || 0)}</div>
              <div style={{ padding: "12px 12px", fontSize: 12, color: tax > 0 ? "var(--warning)" : "var(--text-muted)" }}>{tax > 0 ? fm(tax) : "---"}</div>
              <div style={{ padding: "12px 12px", fontSize: 13, fontWeight: 800, color: "var(--danger)" }}>{fm(f.mt || 0)}</div>
              <div style={{ padding: "12px 8px", display: "flex", gap: 4, alignItems: "center" }}>
                {f.status === "en_attente_facture" ? (
                  <button onClick={function () { setMl({ t: "edep", fid: f.id }); }} title="Saisir le montant de la facture" style={{ background: "var(--info-bg)", color: "var(--info-text)", border: "none", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{"En attente"}</button>
                ) : (
                  <button onClick={function () { toggleDepSt(f.id); }} style={{ background: f.s === "PAYE" ? "var(--success-light)" : "var(--warning-bg)", color: f.s === "PAYE" ? "var(--success-text)" : "var(--warning-text)", border: "none", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{f.s === "PAYE" ? "Paye" : "Impaye"}</button>
                )}
                <button onClick={function () { setMl({ t: "edep", fid: f.id }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}>{"\u270F\uFE0F"}</button>
                {f.auto && f.status === "en_attente_facture" && ignoreDep ? (
                  <button onClick={function () { ignoreDep(f.id); }} title="Ignorer ce stub (faux positif)" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12 }}>{"\u{1F6AB}"}</button>
                ) : null}
                {pendingDel === f.id ? (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button onClick={function () { setPendingDel(null); deleteDep(f.id); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{"Oui"}</button>
                    <button onClick={function () { setPendingDel(null); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>{"Non"}</button>
                  </span>
                ) : (
                  <button onClick={function () { setPendingDel(f.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>{"x"}</button>
                )}
              </div>
            </div>
            <div className="lt-show-mobile" style={{ display: "none", padding: "10px 12px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{DTL[f.tp] || f.tp || "?"}{hasFile ? " \uD83D\uDCCE" : ""}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{dn + " \u00B7 " + fd(f.dt)}</div>
                  {f.nf ? <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{"N\u00B0 " + f.nf}</div> : null}
                </div>
                <button onClick={function () { toggleDepSt(f.id); }} style={{ background: f.s === "PAYE" ? "var(--success-light)" : "var(--warning-bg)", color: f.s === "PAYE" ? "var(--success-text)" : "var(--warning-text)", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", minHeight: 32 }}>{f.s === "PAYE" ? "Paye" : "Impaye"}</button>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 12 }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{"HT " + fm(f.ht || f.mt || 0)}</span>
                {tax > 0 ? <span style={{ color: "var(--warning)" }}>{"Tax " + fm(tax)}</span> : null}
                <span style={{ color: "var(--danger)", fontWeight: 800 }}>{"TTC " + fm(f.mt || 0)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={function () { setMl({ t: "edep", fid: f.id }); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-tertiary)", minHeight: 36 }}>{"Modifier"}</button>
                {pendingDel === f.id ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={function () { setPendingDel(null); deleteDep(f.id); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>{"Oui"}</button>
                    <button onClick={function () { setPendingDel(null); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12, cursor: "pointer", minHeight: 36 }}>{"Non"}</button>
                  </span>
                ) : (
                  <button onClick={function () { setPendingDel(f.id); }} style={{ background: "var(--danger-bg)", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--danger)", minHeight: 36 }}>{"Suppr."}</button>
                )}
              </div>
            </div>
          </div>;
        })}
        {filtered.length === 0 ? <div style={{ padding: 24 }}><EmptyState variant="compact" icon="💰" title={qr ? "Aucun résultat" : "Aucune dépense"} description={qr ? "Aucune dépense ne correspond à votre filtre. Essayez un autre terme." : "Les dépenses liées à vos dossiers apparaîtront ici."} /></div> : null}
        <div style={{ background: "var(--bg-tertiary)", padding: "10px 12px", fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
          <span>{String(filtered.length) + " dépense(s)"}</span>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{"Total TTC: " + fm(ftot)}</span>
        </div>
      </div>
      {pg.totalPages > 1 ? <Pagination page={pg.page} setPage={pg.setPage} totalPages={pg.totalPages} total={pg.total} /> : null}
    </div>
  );
}

export default Dep;
