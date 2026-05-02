import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { fm } from '../../utils/format.js';
import { today } from '../../utils/date.js';
import { validateAll } from '../../utils/validate.js';

var TYPES_20 = ["20GP", "20RF"];

interface DispFormProps { tc: any; tcs: any[]; chs: any[]; onClose: () => void; goAddCh: () => void; onDisp: (tid: string, ch: any, avance: number, budget: number, dspDate?: string, prixConvenu?: number) => void; nf: (m: string, t?: string) => void; }

function DispForm(p: DispFormProps) {
  var tc = p.tc;
  var tcs = p.tcs || [];
  var [ci, sCi] = useState("");
  var [avance, sAvance] = useState("");
  var [budget, sBudget] = useState("");
  var [prixConvenu, setPrixConvenu] = useState("");
  var [dspDate, setDspDate] = useState(today());
  var [vErr, setVErr] = useState({});
  if (!tc) return <div>{"?"}</div>;

  var po = parseInt(tc.po) || 0;
  var tyIs20 = TYPES_20.indexOf(tc.ty) >= 0;
  var now = new Date();

  function getActiveTcs(c) {
    return tcs.filter(function (t) {
      if (t.ch !== c.nm) return false;
      if (t.st === "PORT" || t.st === "ATTENDU" || t.st === "RETURNED") return false;
      if (t.dsp) {
        var days = (now.getTime() - new Date(t.dsp).getTime()) / 86400000;
        if (days >= 15) return false;
      }
      return true;
    });
  }

  function isAvailable(c) {
    if (c.tty && c.tty.length > 0 && c.tty.indexOf(tc.ty) < 0) return false;
    var cpm = parseInt(c.pm) || 0;
    if (cpm > 0 && po > 0 && po > cpm) return false;
    var actifs = getActiveTcs(c);
    if (tyIs20) {
      var actNon20 = actifs.filter(function (t) { return TYPES_20.indexOf(t.ty) < 0; });
      var act20 = actifs.filter(function (t) { return TYPES_20.indexOf(t.ty) >= 0; });
      if (actNon20.length > 0) return false;
      if (act20.length >= 2) return false;
    } else {
      if (actifs.length > 0) return false;
    }
    return true;
  }

  var allActifs = p.chs.filter(function (c) { return !c.bl; });
  var availChs = allActifs.filter(function (c) { return isAvailable(c); });
  var masques = allActifs.length - availChs.length;

  if (tyIs20) {
    availChs = availChs.slice().sort(function (a, b) {
      var aAct20 = getActiveTcs(a).filter(function (t) { return TYPES_20.indexOf(t.ty) >= 0; }).length;
      var bAct20 = getActiveTcs(b).filter(function (t) { return TYPES_20.indexOf(t.ty) >= 0; }).length;
      if (aAct20 === 1 && bAct20 !== 1) return -1;
      if (bAct20 === 1 && aAct20 !== 1) return 1;
      return 0;
    });
  }

  var ch = null; availChs.forEach(function (c) { if (c.id === ci) ch = c; });

  var recap = null;
  if (ch) {
    var actifsCh = getActiveTcs(ch);
    if (actifsCh.length > 0) {
      var totalPoidsActif = actifsCh.reduce(function (s, t) { return s + (parseInt(t.po) || 0); }, 0);
      var totalFinal = totalPoidsActif + po;
      recap = { tcs: actifsCh, totalActif: totalPoidsActif, totalFinal: totalFinal, overPm: ch.pm > 0 && totalFinal > ch.pm };
    }
  }

  return (
    <div>
      <div style={{ background: "var(--info-bg)", padding: 12, borderRadius: 10, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{"TC: "}<strong>{tc.n || "?"}</strong>{" | "}<strong>{tc.ty || "?"}</strong>{" | "}<strong>{(tc.po || "?") + " kg"}</strong></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: availChs.length === 0 ? "var(--danger)" : "var(--success)" }}>
          {String(availChs.length) + "/" + String(allActifs.length) + " dispo"}
        </span>
      </div>
      {availChs.length === 0 ? (
        <div style={{ background: "var(--warning-bg)", padding: 16, borderRadius: 10, textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: "var(--warning-text)", marginBottom: 8 }}>{"Aucun chauffeur disponible"}</div>
          {masques > 0 ? <div style={{ fontSize: 12, color: "var(--warning-text)", marginBottom: 12 }}>{String(masques) + " chauffeur(s) non compatibles (poids, type ou en mission)"}</div> : null}
          <button onClick={function () { p.onClose(); setTimeout(p.goAddCh, 100); }} style={{ background: "var(--warning)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"+ Chauffeur"}</button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={LS}>{"Chauffeur *"}</label>
            <select value={ci} onChange={function (e) { sCi(e.target.value); }} style={IS}>
              <option value="">{"---"}</option>
              {availChs.map(function (c) {
                var actifs = getActiveTcs(c);
                var has20 = tyIs20 && actifs.filter(function (t) { return TYPES_20.indexOf(t.ty) >= 0; }).length === 1;
                var info = has20 ? " \u2605 2e slot 20ft" : actifs.length > 0 ? " \u00B7 " + String(actifs.length) + " TC en cours" : " \u00B7 Disponible";
                return <option key={c.id} value={c.id}>{c.nm + " - " + c.cm + " " + String(c.pm || 0) + "kg" + info}</option>;
              })}
            </select>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {masques > 0 ? String(masques) + " masque(s) : poids, type ou en mission" : "Tous les chauffeurs actifs sont disponibles pour ce TC"}
            </div>
          </div>
          {recap ? (
            <div style={{ background: recap.overPm ? "var(--danger-bg)" : "var(--success-bg)", border: "1px solid " + (recap.overPm ? "var(--danger-border)" : "var(--success-border)"), borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: recap.overPm ? "var(--danger-text)" : "var(--success-text)", marginBottom: 4 }}>{"Charge totale apres dispatch"}</div>
              {recap.tcs.map(function (t) { return <div key={t.id} style={{ color: "var(--text-tertiary)" }}>{(t.n || "?") + " (" + (t.ty || "") + ") \u2014 " + String(parseInt(t.po) || 0) + " kg"}</div>; })}
              <div style={{ borderTop: "1px solid " + (recap.overPm ? "var(--danger-border)" : "var(--success-border)"), marginTop: 6, paddingTop: 6, fontWeight: 700, color: recap.overPm ? "var(--danger)" : "var(--success)" }}>{"+ " + (tc.n || "?") + " (" + tc.ty + ") \u2014 " + String(po) + " kg"}</div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4, color: recap.overPm ? "var(--danger)" : "var(--success)" }}>{"= " + String(recap.totalFinal) + " kg" + (ch.pm > 0 ? " / " + String(ch.pm) + " kg max" : "") + (recap.overPm ? " \u26A0 SURCHARGE" : " \u2713 OK")}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={LS}>{"Budget transport FCFA"}</label>
              <input type="number" value={budget} onChange={function (e) { sBudget(e.target.value); }} style={IS} placeholder={"Total prevu..."} />
            </div>
            <div>
              <label style={LS}>{"Avance Dakar FCFA"}</label>
              <input type="number" value={avance} onChange={function (e) { sAvance(e.target.value); }} style={IS} placeholder={"Versement depart..."} />
              {budget && avance && parseFloat(avance) > parseFloat(budget) ? <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>{"Avance > budget"}</div> : null}
            </div>
            <div>
              <label style={LS}>{"Prix convenu FCFA"}</label>
              <input type="number" value={prixConvenu} onChange={function (e) { setPrixConvenu(e.target.value); }} style={IS} placeholder={"Tarif negocie..."} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={LS}>{"Date de chargement"}</label>
            <input type="date" value={dspDate} onChange={function (e) { setDspDate(e.target.value); }} style={IS} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{"Date de mise sur plateau (debut de la detention)"}</div>
          </div>
          {budget && avance ? (
            <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", marginBottom: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
              {"Reste apres avance : "}<strong style={{ color: "var(--warning)" }}>{fm((parseFloat(budget) || 0) - (parseFloat(avance) || 0))}</strong>{" a verser en route / retour"}
            </div>
          ) : null}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <button onClick={p.onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Annuler"}</button>
        {availChs.length > 0 ? <button onClick={function () {
          var v = validateAll({
            ci: [ci, { required: true }],
            budget: [budget, { minVal: 0, maxVal: 999999999 }],
            avance: [avance, { minVal: 0, maxVal: 999999999 }],
            prixConvenu: [prixConvenu, { minVal: 0, maxVal: 999999999 }]
          });
          setVErr(v.errors);
          if (v.errors.ci) { p.nf("Choisir chauffeur", "error"); return; }
          if (v.hasErrors) { p.nf(v.firstError, "error"); return; }
          p.onDisp(tc.id, ch, parseFloat(avance) || 0, parseFloat(budget) || 0, dspDate, parseFloat(prixConvenu) || 0);
        }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Dispatcher"}</button> : null}
      </div>
    </div>
  );
}

export default DispForm;
