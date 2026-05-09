import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';

interface PregateInputProps { did: string; dos: any[]; db: any; sv: (data: any) => void; nf: (m: string, t?: string) => void; setMl: (ml: any) => void; }

function PregateInput(p: PregateInputProps) {
  var d = p.dos.find(function (x) { return x.id === p.did; });
  var [pn, sPn] = useState("");
  if (!d) return null;
  function save() {
    if (!pn.trim()) { p.nf("Numero requis", "error"); return; }
    p.sv(Object.assign({}, p.db, { dos: p.dos.map(function (x) { return x.id === d.id ? Object.assign({}, x, { pn: pn }) : x; }) }));
    p.nf("Pregate enregistre"); p.setMl(null);
  }
  return (
    <div>
      <div style={{ background: "var(--success-bg)", borderRadius: 8, padding: 14, marginBottom: 14, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success-text)" }}>{"La facture DP World du dossier " + (d.bl || "") + " est payee."}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{"Saisissez le numero Pregate pour debloquer le dispatch."}</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={LS}>{"Pregate"}</label>
        <input autoFocus value={pn} onChange={function (e) { sPn(e.target.value); }} placeholder="Numero Pregate..." style={IS} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={function () { p.setMl(null); }} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Plus tard"}</button>
        <button onClick={save} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Valider"}</button>
      </div>
    </div>
  );
}

export default PregateInput;
