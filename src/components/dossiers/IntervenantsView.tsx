import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { mid } from '../../utils/id.js';
import { validate } from '../../utils/validate.js';

interface IntervenantsViewProps { did: string; dos: any[]; sv: (data: any) => void; db: any; }

var ROLES = [
  { k: "AGENT_DOUANE", l: "Agent douanier" },
  { k: "AGENT_COMPAGNIE", l: "Agent compagnie" },
  { k: "MAISON_TRANSIT", l: "Maison de transit" },
  { k: "LOUEUR_LETTRE", l: "Loueur lettre" },
  { k: "LOCATAIRE_LETTRE", l: "Locataire lettre" },
  { k: "AGENT_DPWORLD", l: "Agent DP World" },
  { k: "CHAUFFEUR_VILLE", l: "Chauffeur ville" },
  { k: "AUTRE", l: "Autre" }
];

var TACHES = [
  { k: "BAD", l: "BAD" },
  { k: "BAE", l: "BAE/Douane" },
  { k: "PREGATE", l: "Pregate" },
  { k: "TRANSIT", l: "Transit" },
  { k: "LIVRAISON", l: "Livraison" },
  { k: "MANUT", l: "Manutention" },
  { k: "FACT", l: "Facturation" }
];

function IntervenantsView(p: IntervenantsViewProps) {
  var d = p.dos.find(function (x) { return x.id === p.did; });
  var [adding, setAdding] = useState(false);
  var [role, setRole] = useState("AGENT_DOUANE");
  var [nm, setNm] = useState("");
  var [tl, setTl] = useState("");
  var [notes, setNotes] = useState("");
  var [selTaches, setSelTaches] = useState<string[]>([]);
  var [nmErr, setNmErr] = useState("");
  var [editingTasks, setEditingTasks] = useState<string | null>(null);
  if (!d) return null;
  var itv = d.itv || [];
  var RL = {}; ROLES.forEach(function (r) { RL[r.k] = r.l; });

  function toggleSel(tk: string) {
    setSelTaches(function (prev) {
      return prev.indexOf(tk) >= 0 ? prev.filter(function (t) { return t !== tk; }) : prev.concat([tk]);
    });
  }

  function addItv() {
    var err = validate(nm, { required: true, maxLen: 50 });
    if (err) { setNmErr(err); return; }
    var errN = validate(notes, { maxLen: 500 });
    if (errN) { setNmErr(errN); return; }
    var errT = validate(tl, { maxLen: 20 });
    if (errT) { setNmErr(errT); return; }
    setNmErr("");
    var ni = itv.concat([{ id: mid(), role: role, nm: nm.trim().toUpperCase(), tl: tl.trim(), notes: notes.trim(), taches: selTaches.slice(), tachesDone: [] }]);
    p.sv(Object.assign({}, p.db, { dos: p.dos.map(function (x) { return x.id === d.id ? Object.assign({}, x, { itv: ni }) : x; }) }));
    setNm(""); setTl(""); setNotes(""); setSelTaches([]); setAdding(false);
  }

  function delItv(iid: string) {
    var ni = itv.filter(function (x) { return x.id !== iid; });
    p.sv(Object.assign({}, p.db, { dos: p.dos.map(function (x) { return x.id === d.id ? Object.assign({}, x, { itv: ni }) : x; }) }));
  }

  function toggleTask(iid: string, tk: string) {
    var newItv = itv.map(function (iv: any) {
      if (iv.id !== iid) return iv;
      var cur = iv.taches || [];
      var has = cur.indexOf(tk) >= 0;
      return Object.assign({}, iv, { taches: has ? cur.filter(function (t: string) { return t !== tk; }) : cur.concat([tk]) });
    });
    p.sv(Object.assign({}, p.db, { dos: p.dos.map(function (x) { return x.id === d.id ? Object.assign({}, x, { itv: newItv }) : x; }) }));
  }

  function renderTacheButtons(selected: string[], onToggle: (tk: string) => void) {
    return <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
      {TACHES.map(function (t) {
        var sel = selected.indexOf(t.k) >= 0;
        return <button key={t.k} type="button" onClick={function () { onToggle(t.k); }}
          style={{
            background: sel ? "var(--btn-primary-bg)" : "var(--bg-secondary)",
            color: sel ? "var(--btn-primary-text)" : "var(--text-secondary)",
            border: sel ? "none" : "1px solid var(--border)",
            borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
            cursor: "pointer", minHeight: 40
          }}>
          {t.l}
        </button>;
      })}
    </div>;
  }

  return (
    <div style={{ marginTop: 10, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{"Intervenants (" + String(itv.length) + ")"}</span>
        <button onClick={function () { setAdding(!adding); }} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{adding ? "x" : "+ Ajouter"}</button>
      </div>

      {adding ? <div style={{ background: "var(--bg-tertiary)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
        <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div><label style={LS}>{"Role"}</label><select value={role} onChange={function (e) { setRole(e.target.value); }} style={IS}>{ROLES.map(function (r) { return <option key={r.k} value={r.k}>{r.l}</option>; })}</select></div>
          <div><label style={LS}>{"Nom"}</label><input value={nm} onChange={function (e) { setNm(e.target.value); }} style={IS} maxLength={50} />{nmErr ? <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3, fontWeight: 500 }}>{nmErr}</div> : null}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 8 }}>
          <div style={{ flex: 1 }}><label style={LS}>{"Tel"}</label><input value={tl} onChange={function (e) { setTl(e.target.value); }} placeholder="Optionnel" style={IS} maxLength={20} /></div>
          <button onClick={addItv} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{"OK"}</button>
        </div>
        <div>
          <label style={LS}>{"Notes"}</label>
          <textarea value={notes} onChange={function (e) { setNotes(e.target.value); }} placeholder={"Notes sur cet intervenant..."} rows={2} style={Object.assign({}, IS, { resize: "vertical" })} maxLength={500} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={LS}>{"Taches a assigner"}</label>
          {renderTacheButtons(selTaches, toggleSel)}
        </div>
      </div> : null}

      {itv.length === 0 && !adding ? <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>{"Aucun intervenant"}</div> : null}

      {itv.map(function (iv: any) {
        var isEditing = editingTasks === iv.id;
        return <div key={iv.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>{RL[iv.role] || iv.role}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{iv.nm}</span>
              {iv.tl ? <span style={{ color: "var(--text-secondary)", fontSize: 11, marginLeft: 6 }}>{iv.tl}</span> : null}
              {iv.notes ? <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3, lineHeight: 1.4 }}>{iv.notes}</div> : null}
              {!isEditing && (iv.taches || []).length > 0 ? <div style={{ marginTop: 4 }}>{(iv.taches || []).map(function (tk: string) {
                var done = (iv.tachesDone || []).indexOf(tk) >= 0;
                return <span key={tk} style={{ background: done ? "var(--success-light)" : "var(--info-bg)", color: done ? "var(--success)" : "var(--info-text)", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, marginRight: 3, textDecoration: done ? "line-through" : "none" }}>{TACHES.find(function (t) { return t.k === tk; })?.l || tk}</span>;
              })}</div> : null}
              {!isEditing && (iv.taches || []).length === 0 ? <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{"Aucune tache"}</div> : null}
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button onClick={function () { setEditingTasks(isEditing ? null : iv.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: isEditing ? "var(--btn-primary-bg)" : "var(--text-muted)", fontSize: 12, padding: "2px 4px" }} title="Gerer les taches">{isEditing ? "OK" : "T"}</button>
              <button onClick={function () { delItv(iv.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>{"x"}</button>
            </div>
          </div>
          {isEditing ? <div style={{ marginTop: 6, paddingLeft: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{"Cliquez pour assigner/retirer :"}</div>
            {renderTacheButtons(iv.taches || [], function (tk) { toggleTask(iv.id, tk); })}
          </div> : null}
        </div>;
      })}
    </div>
  );
}

export default IntervenantsView;
