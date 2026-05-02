import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';
import Btn from '../ui/Btn.tsx';
import { validateAll, FieldError } from '../../utils/validate.js';

interface NChFormProps { init?: any; onClose: () => void; onSave: (data: any) => void; nf: (m: string, t?: string) => void; }
type FormErrors = Record<string, string>;

function NChForm(p: NChFormProps) {
  var i = p.init;
  var [nm, sNm] = useState(i ? i.nm || "" : "");
  var [tl, sTl] = useState(i ? i.tl || "" : "");
  var [cm, sCm] = useState(i ? i.cm || "" : "");
  var [tr, sTr] = useState(i ? i.tr || "" : "");
  var [pm, sPm] = useState(i ? String(i.pm || "") : "");
  var [tty, sTty] = useState(i && i.tty ? i.tty : ["20GP", "40GP", "40HC"]);
  var [bl, sBl] = useState(i ? !!i.bl : false);
  var [blr, sBlr] = useState(i ? i.blr || "" : "");
  var [vErr, setVErr] = useState<FormErrors>({});
  var TCTYPES = ["20GP", "40GP", "20HC", "40HC", "45HC", "20RF", "40RF"];
  function togTy(ty) {
    if (tty.indexOf(ty) >= 0) sTty(tty.filter(function (t) { return t !== ty; }));
    else sTty(tty.concat([ty]));
  }
  return (
    <div>
      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ marginBottom: 12 }}><label style={LS} htmlFor="nch-nm">{"Nom *"}</label><input id="nch-nm" value={nm} onChange={function (e) { sNm(e.target.value.toUpperCase()); }} style={IS} maxLength={50} aria-invalid={!!vErr.nm} aria-describedby={vErr.nm ? "nch-nm-err" : undefined} aria-required="true" /><FieldError msg={vErr.nm} id="nch-nm-err" /></div>
        <div style={{ marginBottom: 12 }}><label style={LS} htmlFor="nch-tl">{"Tel"}</label><input id="nch-tl" value={tl} onChange={function (e) { sTl(e.target.value); }} style={IS} maxLength={20} /></div>
        <div style={{ marginBottom: 12 }}><label style={LS} htmlFor="nch-cm">{"Camion *"}</label><input id="nch-cm" value={cm} onChange={function (e) { sCm(e.target.value.toUpperCase()); }} placeholder="DK-1234-AB" style={IS} maxLength={15} aria-invalid={!!vErr.cm} aria-describedby={vErr.cm ? "nch-cm-err" : undefined} aria-required="true" /><FieldError msg={vErr.cm} id="nch-cm-err" /></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Tracteur"}</label><input value={tr} onChange={function (e) { sTr(e.target.value.toUpperCase()); }} style={IS} maxLength={15} /></div>
        <div style={{ marginBottom: 12 }}>
          <label style={LS}>{"Poids max kg"}</label>
          <input type="number" value={pm} onChange={function (e) { sPm(e.target.value); }} style={IS} />
          {(!pm || pm === "0") ? <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 3 }}>{"Sans poids max, le filtre surcharge sera ignore lors du dispatch"}</div> : null}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={LS}>{"Types de TC acceptes"}</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {TCTYPES.map(function (ty) {
            var sel = tty.indexOf(ty) >= 0;
            return <button key={ty} type="button" onClick={function () { togTy(ty); }} style={{ background: sel ? "var(--btn-primary-bg)" : "var(--bg-secondary)", color: sel ? "var(--btn-primary-text)" : "var(--text-secondary)", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{ty}</button>;
          })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
        <input type="checkbox" checked={bl} onChange={function (e) { sBl(e.target.checked); }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: bl ? "var(--danger)" : "var(--text-tertiary)" }}>{"Blackliste"}</span>
        {bl ? <input placeholder="Raison..." value={blr} onChange={function (e) { sBlr(e.target.value); }} style={{ flex: 1, padding: "5px 8px", border: "2px solid var(--danger-border)", borderRadius: 6, fontSize: 13, background: "var(--bg-secondary)", color: "var(--text-input)" }} maxLength={100} /> : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <Btn variant="ghost" onClick={p.onClose}>{"Annuler"}</Btn>
        <Btn onClick={function () {
          var v = validateAll({
            nm: [nm, { required: true, maxLen: 50 }],
            cm: [cm, { required: true, maxLen: 15 }],
            tl: [tl, { maxLen: 20 }],
            tr: [tr, { maxLen: 15 }],
            pm: [pm, { minVal: 0, maxVal: 200000 }],
            blr: [blr, { maxLen: 100 }]
          });
          setVErr(v.errors);
          if (v.hasErrors) { p.nf(v.errors.nm ? "Nom requis" : v.errors.cm ? "Camion requis" : v.firstError, "error"); return; }
          p.onSave({ nm: nm.trim(), tl: tl.trim(), cm: cm.trim(), tr: tr.trim(), pm: parseInt(pm) || 0, tty: tty, bl: bl, blr: blr.trim() });
        }}>{p.init ? "Modifier" : "Ajouter"}</Btn>
      </div>
    </div>
  );
}

export default NChForm;
