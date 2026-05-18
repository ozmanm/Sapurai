import { useState } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { fm } from '../../utils/format.js';
import { today } from '../../utils/date.js';
import { validateAll } from '../../utils/validate.js';

var TYPES_20 = ["20GP", "20RF"];

interface DispFormProps {
  tc: any;
  tcs: any[];
  chs: any[];
  onClose: () => void;
  // goAddCh : ancienne API (deprecated) — la creation chauffeur se fait
  // maintenant inline dans le formulaire. Conserve optionnel pour retro-compat.
  goAddCh?: () => void;
  // Nouvelle signature : 7e parametre optionnel pour creation chauffeur inline.
  // Quand newChData est defini, ch peut etre null (pas encore en DB).
  onDisp: (tid: string, ch: any, avance: number, budget: number, dspDate?: string, prixConvenu?: number, newChData?: any) => void;
  onAssign?: (tid: string, ch: any, avance: number, budget: number, dassign?: string, prixConvenu?: number, newChData?: any) => void;
  nf: (m: string, t?: string) => void;
}

function DispForm(p: DispFormProps) {
  var tc = p.tc;
  var tcs = p.tcs || [];
  var [ci, sCi] = useState("");
  var [avance, sAvance] = useState("");
  var [budget, sBudget] = useState("");
  var [prixConvenu, setPrixConvenu] = useState("");
  var [dspDate, setDspDate] = useState(today());

  // Mode "nouveau chauffeur" : champs inline pour creer + dispatcher en une etape
  var [mode, setMode] = useState<"select" | "new">("select");
  var [newNm, setNewNm] = useState("");
  var [newCm, setNewCm] = useState("");
  var [newTl, setNewTl] = useState("");
  var [newPm, setNewPm] = useState("");
  var [newTr, setNewTr] = useState("");

  var [vErr, setVErr] = useState<Record<string, string>>({});
  if (!tc) return <div>{"?"}</div>;

  var po = parseInt(tc.po) || 0;
  var tyIs20 = TYPES_20.indexOf(tc.ty) >= 0;
  var now = new Date();

  function getActiveTcs(c: any) {
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

  // Filtre disponibilite : type compatible + slots actifs OK.
  // NOTE : le poids max du camion n'est PLUS un blocker (le recap rouge en bas
  // affiche la surcharge potentielle, mais n'empeche pas le dispatch — parfois
  // le transitaire n'a pas l'info exacte du poids max).
  function isAvailable(c: any) {
    if (c.tty && c.tty.length > 0 && c.tty.indexOf(tc.ty) < 0) return false;
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

  var ch: any = null;
  availChs.forEach(function (c) { if (c.id === ci) ch = c; });

  // Recap surcharge : calcule des qu'un chauffeur (existant OU nouveau) est defini.
  // En mode 'new', on synthetise un ch a partir des champs saisis pour reutiliser
  // la meme logique d'affichage.
  var recapCh: any = null;
  if (mode === "select" && ch) recapCh = ch;
  else if (mode === "new" && newNm.trim()) {
    recapCh = { nm: newNm.trim(), cm: newCm.trim(), pm: parseInt(newPm) || 0 };
  }

  var recap: any = null;
  if (recapCh) {
    var actifsCh = mode === "select" ? getActiveTcs(recapCh) : [];
    var totalPoidsActif = actifsCh.reduce(function (s: number, t: any) { return s + (parseInt(t.po) || 0); }, 0);
    var totalFinal = totalPoidsActif + po;
    var pmCh = parseInt(recapCh.pm) || 0;
    recap = {
      tcs: actifsCh,
      totalActif: totalPoidsActif,
      totalFinal: totalFinal,
      overPm: pmCh > 0 && totalFinal > pmCh,
      pm: pmCh,
    };
  }

  // Si l'utilisateur n'a aucun chauffeur compatible OU s'il a explicitement
  // bascule en mode 'new', on affiche le formulaire inline.
  var noCh = availChs.length === 0;
  var showNewForm = mode === "new" || noCh;

  /**
   * Sprint 46 : valide les inputs et retourne les params communs.
   * Si validation echoue, retourne null (notif deja envoyee).
   */
  function validateAndCollect(): { actualCh: any; newChData: any | null } | null {
    if (showNewForm) {
      var v = validateAll({
        nm: [newNm, { required: true, maxLen: 50 }],
        cm: [newCm, { required: true, maxLen: 15 }],
        tl: [newTl, { maxLen: 20 }],
        tr: [newTr, { maxLen: 15 }],
        pm: [newPm, { minVal: 0, maxVal: 200000 }],
        budget: [budget, { minVal: 0, maxVal: 999999999 }],
        avance: [avance, { minVal: 0, maxVal: 999999999 }],
        prixConvenu: [prixConvenu, { minVal: 0, maxVal: 999999999 }],
      });
      setVErr(v.errors);
      if (v.errors.nm) { p.nf("Nom du chauffeur requis", "error"); return null; }
      if (v.errors.cm) { p.nf("Plaque du camion requise", "error"); return null; }
      if (v.hasErrors) { p.nf(v.firstError, "error"); return null; }
      var ncd = {
        nm: newNm.trim().toUpperCase(),
        cm: newCm.trim().toUpperCase(),
        tl: newTl.trim(),
        tr: newTr.trim().toUpperCase(),
        pm: parseInt(newPm) || 0,
        tty: ["20GP", "40GP", "40HC", "20HC", "45HC", "20RF", "40RF"],
        bl: false,
        blr: "",
      };
      return { actualCh: null, newChData: ncd };
    }
    var vSel = validateAll({
      ci: [ci, { required: true }],
      budget: [budget, { minVal: 0, maxVal: 999999999 }],
      avance: [avance, { minVal: 0, maxVal: 999999999 }],
      prixConvenu: [prixConvenu, { minVal: 0, maxVal: 999999999 }],
    });
    setVErr(vSel.errors);
    if (vSel.errors.ci) { p.nf("Choisir chauffeur", "error"); return null; }
    if (vSel.hasErrors) { p.nf(vSel.firstError, "error"); return null; }
    return { actualCh: ch, newChData: null };
  }

  /**
   * Sprint 46 : PORT -> ASSIGNE (camion reserve, RDV pris, pas encore charge).
   * L'avance est versee maintenant (chauffeur a besoin du cash pour la route).
   */
  function doAssign() {
    var r = validateAndCollect();
    if (!r) return;
    if (p.onAssign) {
      p.onAssign(tc.id, r.actualCh, parseFloat(avance) || 0, parseFloat(budget) || 0, dspDate, parseFloat(prixConvenu) || 0, r.newChData);
    }
  }

  /**
   * Sprint 46 : PORT -> DISPATCHE atomique (chargement immediat,
   * camion deja sur place). Pose dassign + dsp a la meme date.
   */
  function doDispatch() {
    var r = validateAndCollect();
    if (!r) return;
    p.onDisp(tc.id, r.actualCh, parseFloat(avance) || 0, parseFloat(budget) || 0, dspDate, parseFloat(prixConvenu) || 0, r.newChData);
  }

  return (
    <div>
      <div style={{ background: "var(--info-bg)", padding: 12, borderRadius: 8, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{"TC: "}<strong>{tc.n || "?"}</strong>{" | "}<strong>{tc.ty || "?"}</strong>{" | "}<strong>{(tc.po || "?") + " kg"}</strong></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: noCh ? "var(--warning)" : "var(--success)" }}>
          {String(availChs.length) + "/" + String(allActifs.length) + " dispo"}
        </span>
      </div>

      {/* Toggle select / new (visible des qu'au moins 1 chauffeur dispo, sinon on impose 'new') */}
      {!noCh ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, background: "var(--bg-tertiary)", padding: 4, borderRadius: 8 }}>
          <button type="button" onClick={function () { setMode("select"); setVErr({}); }} style={{ flex: 1, background: mode === "select" ? "var(--bg-primary)" : "transparent", border: "none", borderRadius: 6, padding: "8px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", color: mode === "select" ? "var(--text-primary)" : "var(--text-secondary)" }}>{"Chauffeur existant"}</button>
          <button type="button" onClick={function () { setMode("new"); setVErr({}); }} style={{ flex: 1, background: mode === "new" ? "var(--bg-primary)" : "transparent", border: "none", borderRadius: 6, padding: "8px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", color: mode === "new" ? "var(--text-primary)" : "var(--text-secondary)" }}>{"+ Nouveau chauffeur"}</button>
        </div>
      ) : (
        <div style={{ background: "var(--info-bg)", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12, color: "var(--text-secondary)" }}>
          {allActifs.length === 0 ? "Aucun chauffeur enregistre. Saisissez les infos ci-dessous, il sera ajoute automatiquement." : String(masques) + " chauffeur(s) non compatibles. Creez-en un nouveau ci-dessous."}
        </div>
      )}

      {showNewForm ? (
        // Formulaire inline nouveau chauffeur
        <div>
          <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={LS}>{"Nom *"}</label>
              <input value={newNm} onChange={function (e) { setNewNm(e.target.value); }} style={IS} maxLength={50} placeholder="MAMADOU DIALLO" />
              {vErr.nm ? <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>{vErr.nm}</div> : null}
            </div>
            <div>
              <label style={LS}>{"Camion (plaque) *"}</label>
              <input value={newCm} onChange={function (e) { setNewCm(e.target.value.toUpperCase()); }} style={IS} maxLength={15} placeholder="DK-1234-AB" />
              {vErr.cm ? <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>{vErr.cm}</div> : null}
            </div>
            <div>
              <label style={LS}>{"Tel"}</label>
              <input value={newTl} onChange={function (e) { setNewTl(e.target.value); }} style={IS} maxLength={20} placeholder="77 123 45 67" />
            </div>
            <div>
              <label style={LS}>{"Poids max kg"}</label>
              <input type="number" value={newPm} onChange={function (e) { setNewPm(e.target.value); }} style={IS} placeholder="optionnel" />
              {(!newPm || newPm === "0") ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{"Optionnel : la verif surcharge sera ignoree"}</div> : null}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={LS}>{"Tracteur (optionnel)"}</label>
            <input value={newTr} onChange={function (e) { setNewTr(e.target.value.toUpperCase()); }} style={IS} maxLength={15} />
          </div>
        </div>
      ) : (
        // Mode 'select' : dropdown classique
        <div style={{ marginBottom: 12 }}>
          <label style={LS}>{"Chauffeur *"}</label>
          <select value={ci} onChange={function (e) { sCi(e.target.value); }} style={IS}>
            <option value="">{"---"}</option>
            {availChs.map(function (c: any) {
              var actifs = getActiveTcs(c);
              var has20 = tyIs20 && actifs.filter(function (t: any) { return TYPES_20.indexOf(t.ty) >= 0; }).length === 1;
              var info = has20 ? " ★ 2e slot 20ft" : actifs.length > 0 ? " · " + String(actifs.length) + " TC en cours" : " · Disponible";
              return <option key={c.id} value={c.id}>{c.nm + " - " + c.cm + " " + String(c.pm || 0) + "kg" + info}</option>;
            })}
          </select>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {masques > 0 ? String(masques) + " masque(s) : type ou en mission" : "Tous les chauffeurs actifs sont disponibles pour ce TC"}
          </div>
        </div>
      )}

      {recap ? (
        <div style={{ background: recap.overPm ? "var(--danger-bg)" : "var(--success-bg)", border: "1px solid " + (recap.overPm ? "var(--danger-border)" : "var(--success-border)"), borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: recap.overPm ? "var(--danger-text)" : "var(--success-text)", marginBottom: 4 }}>{"Charge totale apres dispatch"}</div>
          {recap.tcs.map(function (t: any) { return <div key={t.id} style={{ color: "var(--text-tertiary)" }}>{(t.n || "?") + " (" + (t.ty || "") + ") — " + String(parseInt(t.po) || 0) + " kg"}</div>; })}
          <div style={{ borderTop: "1px solid " + (recap.overPm ? "var(--danger-border)" : "var(--success-border)"), marginTop: 6, paddingTop: 6, fontWeight: 700, color: recap.overPm ? "var(--danger)" : "var(--success)" }}>{"+ " + (tc.n || "?") + " (" + tc.ty + ") — " + String(po) + " kg"}</div>
          <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4, color: recap.overPm ? "var(--danger)" : "var(--success)" }}>{"= " + String(recap.totalFinal) + " kg" + (recap.pm > 0 ? " / " + String(recap.pm) + " kg max" : " (poids max non renseigne)") + (recap.overPm ? " ⚠ SURCHARGE (dispatch possible mais a vos risques)" : recap.pm > 0 ? " ✓ OK" : "")}</div>
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

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
        <button onClick={p.onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Annuler"}</button>
        {p.onAssign ? (
          <button onClick={doAssign} title="Camion reserve, chargement plus tard" style={{ background: "var(--info, var(--btn-primary-bg))", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>
            {"Assigner camion"}
          </button>
        ) : null}
        <button onClick={doDispatch} title="Camion deja sur place, chargement immediat" style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>
          {"Chargement immediat"}
        </button>
      </div>
    </div>
  );
}

export default DispForm;
