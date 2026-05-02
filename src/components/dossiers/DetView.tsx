import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PL, SL, SC, SB, DL } from '../../constants/statuts.js';
import { DTL } from '../../constants/depenses.js';
import { fd, fm, tcSum } from '../../utils/format.js';
import { today } from '../../utils/date.js';
import { printDossier } from '../../utils/print.js';
import { pdfDossier } from '../../utils/pdf.js';
import IntervenantsView from './IntervenantsView.tsx';
import ClickableDiv from '../ui/ClickableDiv.tsx';

interface DetViewProps { [key: string]: any; }

function DetView(p: DetViewProps) {
  var ce = p.canEdit !== false;
  var d = p.dos.find(function (x) { return x.id === p.did; });
  var [dm, setDm] = useState(false);
  var [shr, setShr] = useState(null);
  var [incEdits, setIncEdits] = useState({});
  var [editBadDt, setEditBadDt] = useState(false);
  var [editNd, setEditNd] = useState(false);
  var [editPn, setEditPn] = useState(false);
  // Tab actif. 4 onglets : resume, tcs, fin, admin. Defaut resume.
  var [activeTab, setActiveTab] = useState("resume");
  if (!d) return <div>{"?"}</div>;
  var mt = p.tcs.filter(function (c) { return c.did === d.id; });
  var md = p.dep.filter(function (f) { return f.did === d.id; });
  var tot = md.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var htot = md.reduce(function (a, f) { return a + (f.ht || f.mt || 0); }, 0);
  var paye = md.reduce(function (a, f) { return a + (f.s === "PAYE" ? f.mt || 0 : 0); }, 0);
  var allRet = mt.length > 0 && mt.every(function (c) { return c.st === "RETURNED"; });
  var canClose = allRet && d.st !== "CLOTURE";
  var phrase = p.humanPhrase(d, mt);
  var frData = mt.map(function (tc) {
    var jp = 0, rp = 0, jt = 0, rt = 0;
    // Bug 1a : surestaries depuis bv (date fin validite BAD) si BAD obtenu, sinon da.
    // Bug 1b : calcul jours INCLUSIF (jour de chargement compte) -> +1 sur le diff.
    var startSur = (d.bs === "OBTENU" && d.bv) ? d.bv : d.da;
    if (startSur) {
      var a = new Date(startSur); a.setHours(0,0,0,0);
      var b = tc.dsp ? new Date(tc.dsp) : new Date(); b.setHours(0,0,0,0);
      jp = Math.floor((b.getTime() - a.getTime()) / 864e5) + 1;  // inclusif
      if (jp < 0) jp = 0;  // BAD pas encore expire
      rp = (p.cfg.fp || 10) - jp;
    }
    if (tc.dsp && tc.st !== "PORT" && tc.st !== "ATTENDU") {
      var c2 = new Date(tc.dsp); c2.setHours(0,0,0,0);
      var d2 = tc.dr ? new Date(tc.dr) : new Date(); d2.setHours(0,0,0,0);
      jt = Math.floor((d2.getTime() - c2.getTime()) / 864e5) + 1;  // inclusif
      rt = (p.cfg.ft || 23) - jt;
    }
    return { tc: tc, jp: jp, rp: rp, jt: jt, rt: rt };
  });
  var DSC = { INITIALISE: "var(--dc-initialise)", SECURISE: "var(--dc-securise)", EN_TRANSIT: "var(--dc-en-transit)", CLOTURE: "var(--dc-cloture)", ARCHIVE: "var(--dc-archive)" };
  var DST = ["INITIALISE", "SECURISE", "EN_TRANSIT", "CLOTURE", "ARCHIVE"];
  var rv = d.rv || 0;
  var pf = d.pf || 0;
  var marge = rv - tot;
  var PLBL = { AVANCE_DK: "Avance DK", ACOMPTE_BAM: "Acompte BAM", URGENCE: "Urgence", RELIQUAT: "Reliquat" };
  return (
    <div>
      {/* eslint-disable-next-line no-restricted-syntax -- hero card : dark permanent non-inversible en dark mode (var(--btn-primary-bg) s'inverserait et casserait le contraste texte blanc) */}
      <div style={{ background: "linear-gradient(135deg,#1c1917,#292524)", padding: 20, borderRadius: 12, color: "white", marginBottom: 14, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{d.cl || "?"}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{"BL: " + (d.bl || "") + (d.cp ? " | " + d.cp : "") + " | " + (mt.length > 0 ? tcSum(mt) : "0 TC") + " | " + fd(d.da)}</div>
            {d.cr ? <div style={{ fontSize: 12, opacity: 0.7 }}>{"Destination: " + d.cr}</div> : null}
            {d.ct ? <div style={{ fontSize: 12, opacity: 0.7 }}>{"Tel: " + d.ct}</div> : null}
            {d.gr ? <div style={{ fontSize: 12, opacity: 0.7 }}>{"Garantie: " + (d.gr === "PERMANENTE" ? "Permanente" : d.gr === "LOUEE" ? "Louée" : "Vente lettre")}</div> : null}
            {pf > 0 ? <div style={{ fontSize: 12, opacity: 0.7 }}>{"Prix fret/TC : " + fm(pf)}</div> : null}
            {d.rating ? (function () {
              var lbl = d.rating === 1 ? "Tres satisfait" : d.rating === 2 ? "Correct" : "Probleme";
              var emoji = d.rating === 1 ? "\uD83D\uDE0A" : d.rating === 2 ? "\uD83D\uDE10" : "\uD83D\uDE1F";
              return (
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, background: "rgba(255,255,255,0.18)", borderRadius: 6, padding: "4px 10px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>{emoji}</span><span>{"Avis client : " + lbl}</span>
                  </span>
                  {d.rating === 3 && d.ct ? (function () {
                    var rawPhone = (d.ct || "").replace(/\D/g, "");
                    var waNum = /^22[13]\d{7,9}$/.test(rawPhone) ? rawPhone : (/^\d{8,9}$/.test(rawPhone) ? "221" + rawPhone : "");
                    if (!waNum) return null;
                    var msg = "Bonjour, suite a votre retour sur le dossier " + (d.bl || "") + ", nous souhaitons comprendre ce qui n'a pas marche et trouver une solution.";
                    return (
                      <a href={"https://wa.me/" + waNum + "?text=" + encodeURIComponent(msg)} target="_blank" rel="noopener noreferrer" onClick={function (e) { e.stopPropagation(); }}
                         // eslint-disable-next-line no-restricted-syntax -- WhatsApp brand color immuable
                         style={{ background: "#25D366", color: "white", fontSize: 12, borderRadius: 6, padding: "4px 10px", fontWeight: 700, textDecoration: "none" }}>
                        {"\uD83D\uDCAC Rappeler le client"}
                      </a>
                    );
                  })() : null}
                </div>
              );
            })() : null}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {ce ? <select value={d.st} onChange={function (e) { p.setDosSt(d.id, e.target.value); }} style={{ background: DSC[d.st] || "var(--text-secondary)", color: "white", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {DST.map(function (s) { return <option key={s} value={s} style={{ color: "black" }}>{DL[s]}</option>; })}
            </select> : <span style={{ background: DSC[d.st] || "var(--text-secondary)", color: "white", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>{DL[d.st] || d.st}</span>}
            {ce ? <button onClick={function () { setDm(!dm); }} style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>{"\u22EE"}</button> : null}
          </div>
        </div>
        {dm ? <div role="menu" style={{ position: "absolute", right: 12, top: 52, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 50, minWidth: 180, overflow: "hidden" }}>
          <ClickableDiv onClick={function () { setDm(false); p.setMl({ t: "edos", did: d.id, prev: { t: "det", did: d.id } }); setDm(false); }} label="Modifier le dossier" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-input)", borderBottom: "1px solid var(--border-light)" }}><span>{"\u270F\uFE0F"}</span>{"Modifier"}</ClickableDiv>
          <ClickableDiv onClick={function () { setDm(false); printDossier(d, p.tcs, p.dep, (p.db || {}).name || "SAPURAI"); }} label="Imprimer le dossier" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-input)", borderBottom: "1px solid var(--border-light)" }}><span>{"\uD83D\uDDA8\uFE0F"}</span>{"Imprimer"}</ClickableDiv>
          <ClickableDiv onClick={function () { setDm(false); pdfDossier(d, p.tcs, p.dep, p.db || {}); }} label="Telecharger le dossier en PDF" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-input)", borderBottom: "1px solid var(--border-light)" }}><span>{"\uD83D\uDCC4"}</span>{"Telecharger PDF"}</ClickableDiv>
          <ClickableDiv onClick={function () { setDm(false); p.setMl({ t: "jdoc", did: d.id }); }} label="Joindre des documents" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-input)", borderBottom: "1px solid var(--border-light)" }}><span>{"\uD83D\uDCCE"}</span>{"Joindre documents"}</ClickableDiv>
          <ClickableDiv onClick={function () { setDm(false); p.setMl({ t: "logs", did: d.id, prev: { t: "det", did: d.id } }); }} label="Voir l'historique de ce dossier" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-input)", borderBottom: "1px solid var(--border-light)" }}><span>{"🗂️"}</span>{"Historique du dossier"}</ClickableDiv>
          <ClickableDiv onClick={function () { setDm(false); if (p.syncDPWorld) p.syncDPWorld(d.id); }} label="Synchroniser avec DPWorld" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-input)", borderBottom: "1px solid var(--border-light)" }}><span>{"\uD83D\uDD04"}</span>{"Sync DPWorld"}</ClickableDiv>
          {/* Sprint CMA : bouton visible uniquement si la compagnie est CMA-CGM (cp contient "CMA") */}
          {p.syncCMA && d.cp && d.cp.toUpperCase().indexOf("CMA") >= 0 ? (
            <ClickableDiv onClick={function () { setDm(false); p.syncCMA(d.id); }} label="Synchroniser avec CMA-CGM" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-input)", borderBottom: "1px solid var(--border-light)" }}><span>{"\uD83C\uDF10"}</span>{"Sync CMA-CGM"}</ClickableDiv>
          ) : null}
          <ClickableDiv onClick={function () { setDm(false); if (p.shareTracking) { p.shareTracking(d.id).then(function (path: string) { if (path) { var url = window.location.origin + path; var msg = "Bonjour, suivez votre dossier " + (d.bl || "") + " ici :\n" + url; setShr({ url: url, msg: msg }); } }); } }} label="Partager le lien de tracking au client" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", borderBottom: "1px solid var(--border-light)" }}><span>{"\uD83D\uDCE4"}</span>{"Partager au client"}</ClickableDiv>
          {canClose ? <ClickableDiv onClick={function () { setDm(false); p.closeDos(d.id); }} label="Cloturer le dossier" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--success-text)", borderBottom: "1px solid var(--border-light)" }}><span>{"\u2705"}</span>{"Cloturer"}</ClickableDiv> : null}
          {d.st === "CLOTURE" ? <ClickableDiv onClick={function () { setDm(false); p.archiveDos(d.id); }} label="Archiver le dossier" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-light)" }}><span>{"\uD83D\uDCE6"}</span>{"Archiver"}</ClickableDiv> : null}
          <ClickableDiv onClick={function () { setDm(false); p.deleteDos(d.id); }} label="Supprimer le dossier" style={{ padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--danger)" }}><span>{"\uD83D\uDDD1\uFE0F"}</span>{"Supprimer"}</ClickableDiv>
        </div> : null}
      </div>

      {/* Share panel */}
      {shr ? <div style={{ background: "var(--bg-tertiary)", border: "2px solid var(--text-primary)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{"\uD83D\uDCE4 Lien de suivi client"}</div>
          <button onClick={function () { setShr(null); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}>{"\u2715"}</button>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: 8, flexShrink: 0 }}>
            <QRCodeSVG value={shr.url} size={120} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "var(--font-mono)", wordBreak: "break-all", marginBottom: 10, border: "1px solid var(--border)", color: "var(--text-primary)" }}>{shr.url}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={function () { navigator.clipboard.writeText(shr.url).then(function () { p.nf("Lien copie !"); }); }} style={{ background: "var(--btn-primary-bg)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>{"\uD83D\uDCCB Copier le lien"}</button>
              {/* eslint-disable-next-line no-restricted-syntax -- WhatsApp brand color */}
              <a href={"https://wa.me/" + (d.ct || "").replace(/[^0-9+]/g, "") + "?text=" + encodeURIComponent(shr.msg)} target="_blank" rel="noopener noreferrer" style={{ background: "#25d366", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}>{"\uD83D\uDCF1 WhatsApp"}</a>
            </div>
          </div>
        </div>
      </div> : null}

      {/* Phrase humaine */}
      {phrase ? <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: "var(--info-text)", lineHeight: 1.5 }}>{phrase}</div> : null}

      {/* Progress steps Sprint B.1 — 5 etapes du cycle dossier (handoff) */}
      {(function () {
        var stIdx: Record<string, number> = { INITIALISE: 0, SECURISE: 1, EN_TRANSIT: 2, CLOTURE: 4, ARCHIVE: 4 };
        // Etat "livre" = tous TC en RETURNED
        var allRetForSteps = mt.length > 0 && mt.every(function (c: any) { return c.st === "RETURNED"; });
        var current = stIdx[d.st] !== undefined ? stIdx[d.st] : 0;
        if (allRetForSteps && current < 3) current = 3;
        var steps = [
          { lbl: "Initialise", date: d.da ? "" : "" },
          { lbl: "Securise", date: "" },
          { lbl: "En transit", date: "" },
          { lbl: "Livre", date: allRetForSteps ? "OK" : "—" },
          { lbl: "Cloture", date: d.st === "CLOTURE" || d.st === "ARCHIVE" ? "OK" : "—" },
        ];
        return (
          <div className="lt-card" style={{ padding: "16px 18px", marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {steps.map(function (s, i) {
              var done = i <= current;
              var isCurrent = i === current && d.st !== "CLOTURE" && d.st !== "ARCHIVE";
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 0, position: "relative" as const, minWidth: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 999,
                        background: done ? "var(--btn-primary-bg)" : "var(--bg-secondary)",
                        border: done ? "none" : "1px solid var(--border)",
                        color: done ? "var(--btn-primary-text)" : "var(--text-muted)",
                        display: "grid", placeItems: "center" as const,
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const,
                      }}>{done ? "✓" : String(i + 1)}</div>
                      {i < steps.length - 1 ? (
                        <div style={{ flex: 1, height: 2, background: i + 1 <= current || isCurrent ? "var(--btn-primary-bg)" : "var(--border)", borderRadius: 1 }} />
                      ) : null}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: done ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap" as const, overflow: "hidden" as const, textOverflow: "ellipsis" as const }}>{s.lbl}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const, marginTop: 2 }}>{s.date}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* TabBar — 4 onglets pour structurer le detail dossier */}
      <div role="tablist" aria-label="Sections du dossier" style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {[
          { k: "resume", lbl: "Vue generale" },
          { k: "tcs", lbl: "Conteneurs (" + String(mt.length) + ")" },
          { k: "fin", lbl: "Depenses (" + String(md.length) + ")" },
          { k: "admin", lbl: "Documents & Historique" },
        ].map(function (t) {
          var isActive = activeTab === t.k;
          return (
            <button
              key={t.k}
              role="tab"
              aria-selected={isActive}
              aria-controls={"detview-panel-" + t.k}
              onClick={function () { setActiveTab(t.k); }}
              style={{
                background: isActive ? "var(--bg-primary)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                border: "none",
                borderBottom: isActive ? "2px solid var(--btn-primary-bg)" : "2px solid transparent",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                minHeight: 44,
                whiteSpace: "nowrap",
                marginBottom: -1,
              }}
            >
              {t.lbl}
            </button>
          );
        })}
      </div>

      {/* Documents */}
      {activeTab === "resume" ? (<>

      {(function () {
      var anyAtPort = mt.some(function (tc) { return tc.st === "PORT"; });
      var CYCLE = { "": "EN_COURS", "NON_DEMANDE": "EN_COURS", "EN_COURS": "OBTENU", "OBTENU": "" };
      function cycleBad() {
        if (!ce || !p.patchDos) return;
        var ns = CYCLE[d.bs || ""] || "EN_COURS";
        var upd: Record<string, any> = { bs: ns };
        if (ns === "OBTENU") { upd.bv = today(); setEditBadDt(true); }
        else { setEditBadDt(false); }
        p.patchDos(d.id, upd);
        p.nf("BAD → " + (ns === "OBTENU" ? "Obtenu" : ns === "EN_COURS" ? "En cours" : "Non demandé"));
      }
      function cycleBae() {
        if (!ce || !p.patchDos) return;
        var ns = CYCLE[d.as2 || ""] || "EN_COURS";
        p.patchDos(d.id, { as2: ns });
        if (ns === "OBTENU") setEditNd(true); else setEditNd(false);
        p.nf("BAE → " + (ns === "OBTENU" ? "Obtenu" : ns === "EN_COURS" ? "En cours" : "Non demandé"));
      }
      return <div className="lt-grid3" style={{ gap: 8, marginBottom: 14 }}>
        {/* BAD — cliquable */}
        {(function () {
          var badBg = d.bs === "OBTENU" ? "var(--success-light)" : d.bs === "EN_COURS" ? "var(--warning-bg)" : "var(--danger-light)";
          var badExp = "";
          if (d.bv) {
            var bvd = new Date(d.bv); bvd.setHours(0,0,0,0);
            var now = new Date(); now.setHours(0,0,0,0);
            var bvr = Math.floor((bvd.getTime() - now.getTime()) / 864e5);
            if (!anyAtPort) { badBg = "var(--bg-secondary)"; badExp = fd(d.bv); }
            else if (bvr <= 0) { badBg = "var(--danger-light)"; badExp = "EXPIRE +" + String(Math.abs(bvr)) + "j"; }
            else if (bvr <= 3) { badBg = "var(--warning-bg)"; badExp = "J-" + String(bvr); }
            else { badExp = "OK " + fd(d.bv); }
          }
          return <ClickableDiv onClick={cycleBad} disabled={!ce} label="Cycler le statut BAD" style={{ background: badBg, padding: 10, borderRadius: 10, transition: "background 0.2s" }}>
            <div style={{ fontWeight: 700, fontSize: 11, display: "flex", justifyContent: "space-between", color: "var(--text-primary)" }}>{"BAD"}{ce ? <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{"cliquer"}</span> : null}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{d.bs === "OBTENU" ? "Obtenu" : d.bs === "EN_COURS" ? "En cours" : "Non demandé"}</div>
            {badExp ? <div style={{ fontSize: 10, fontWeight: 700, color: (!anyAtPort) ? "var(--text-tertiary)" : badExp.indexOf("EXPIRE") >= 0 ? "var(--danger-text)" : badExp.indexOf("J-") >= 0 ? "var(--warning-text)" : "var(--success-text)" }}>{badExp}</div> : null}
            {(editBadDt || (d.bs === "OBTENU" && !d.bv)) && ce ? <input type="date" defaultValue={d.bv || today()} onClick={function (e) { e.stopPropagation(); }} onChange={function (e) { p.patchDos(d.id, { bv: e.target.value }); }} style={{ marginTop: 4, width: "100%", fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }} /> : null}
          </ClickableDiv>;
        })()}
        {/* BAE — cliquable */}
        <ClickableDiv onClick={cycleBae} disabled={!ce} label="Cycler le statut BAE" style={{ background: d.as2 === "OBTENU" ? "var(--success-light)" : d.as2 === "EN_COURS" ? "var(--warning-bg)" : "var(--danger-light)", padding: 10, borderRadius: 10, transition: "background 0.2s" }}>
          <div style={{ fontWeight: 700, fontSize: 11, display: "flex", justifyContent: "space-between", color: "var(--text-primary)" }}>{"BAE"}{ce ? <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{"cliquer"}</span> : null}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{d.as2 === "OBTENU" ? "Obtenu" : d.as2 === "EN_COURS" ? "En cours" : "Non demandé"}</div>
          {d.nd ? <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{"Decl: " + d.nd}</div> : null}
          {(editNd || (d.as2 === "OBTENU" && !d.nd)) && ce ? <input type="text" defaultValue={d.nd || ""} placeholder="N° declaration" onClick={function (e) { e.stopPropagation(); }} onBlur={function (e) { if (e.target.value) p.patchDos(d.id, { nd: e.target.value }); setEditNd(false); }} style={{ marginTop: 4, width: "100%", fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }} /> : null}
        </ClickableDiv>
        {/* PREGATE — cliquable */}
        <ClickableDiv onClick={function () { if (ce && !editPn) setEditPn(true); }} disabled={!ce || editPn} label="Editer le numero Pregate" style={{ background: d.pn ? "var(--success-light)" : anyAtPort ? "var(--warning-bg)" : "var(--bg-secondary)", padding: 10, borderRadius: 10, transition: "background 0.2s" }}>
          <div style={{ fontWeight: 700, fontSize: 11, display: "flex", justifyContent: "space-between", color: "var(--text-primary)" }}>{"PREGATE"}{ce && !d.pn ? <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{"cliquer"}</span> : null}</div>
          {editPn && ce ? <div style={{ display: "flex", gap: 4, marginTop: 4 }} onClick={function (e) { e.stopPropagation(); }}>
            <input type="text" defaultValue={d.pn || ""} placeholder="N° pregate" autoFocus onBlur={function (e) { var v = e.target.value.trim(); p.patchDos(d.id, { pn: v }); setEditPn(false); if (v) p.nf("Pregate enregistre"); }} onKeyDown={function (e) { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={{ flex: 1, fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)" }} />
            {d.pn ? <button onClick={function () { p.patchDos(d.id, { pn: "" }); setEditPn(false); p.nf("Pregate efface"); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>{"✕"}</button> : null}
          </div> : <div style={{ fontSize: 14, fontWeight: 600, color: d.pn ? "var(--success-text)" : anyAtPort ? "var(--warning-text)" : "var(--text-muted)" }}>{d.pn || (anyAtPort ? "A obtenir" : "Non renseigné")}</div>}
        </ClickableDiv>
      </div>;
      })()}


      {/* Caution dossier */}
      {d.gr && d.gr !== "PERMANENTE" ? (function () {
        var isLouee = d.gr === "LOUEE";
        var bg = isLouee ? "var(--purple-bg)" : "var(--success-bg)";
        var bdr = isLouee ? "var(--purple-border)" : "var(--success-border)";
        var txtH = isLouee ? "var(--purple-text)" : "var(--success-text)";
        var statutOk = isLouee ? d.gar_statut === "RECUPEREE" : d.gar_statut === "REMBOURSEE";
        var statutPerdu = isLouee ? d.gar_statut === "PERDUE" : d.gar_statut === "CONSERVEE";
        return (
          <div style={{ background: statutOk ? "var(--success-bg)" : bg, border: "1px solid " + (statutOk ? "var(--success-border)" : bdr), borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: txtH, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              {isLouee ? "Lettre louée — " + (d.gar_contact || "?") : "Vente lettre — " + (d.gar_contact || "?")}
              {/* eslint-disable-next-line no-restricted-syntax -- WhatsApp brand color */}
              {d.gar_tel ? <a href={"https://wa.me/" + (d.gar_tel || "").replace(/[^0-9+]/g, "")} target="_blank" rel="noopener noreferrer" style={{ color: "#25d366", fontWeight: 600, fontSize: 10 }}>{"WhatsApp"}</a> : null}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              {d.gar_frais > 0 ? <span>{isLouee ? "Frais location : " : "Montant vente : "}<strong>{fm(d.gar_frais)}</strong></span> : null}
              {d.gar_caution > 0 ? <span>{"Caution : "}<strong>{fm(d.gar_caution)}</strong></span> : null}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: statutOk ? "var(--success-text)" : statutPerdu ? "var(--danger)" : "var(--warning)" }}>{d.gar_statut || "\u2014"}</span>
              {!statutOk && !statutPerdu && allRet && ce ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={function () { p.updateGarantie(d.id, isLouee ? "RECUPEREE" : "REMBOURSEE"); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{isLouee ? "Récupérée" : "Remboursée"}</button>
                  <button onClick={function () { p.updateGarantie(d.id, isLouee ? "PERDUE" : "CONSERVEE"); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{isLouee ? "Perdue" : "Conservée"}</button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })() : null}
      </>) : null}

      {/* Franchise cards — masquer si tous retournes ou dossier cloture */}
      {activeTab === "tcs" ? (<>
      {frData.length > 0 && d.st !== "CLOTURE" && !allRet ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{"Franchises"}</div>
          {frData.filter(function (fr) { return fr.tc.st !== "RETURNED"; }).map(function (fr) {
            var pcol = fr.rp > 5 ? "var(--success)" : fr.rp > 2 ? "var(--warning)" : fr.rp > 0 ? "var(--danger)" : "var(--danger-text)";
            var tcol = fr.rt > 7 ? "var(--success)" : fr.rt > 5 ? "var(--warning)" : fr.rt > 2 ? "var(--danger)" : "var(--danger-text)";
            return (
              <div key={fr.tc.id} style={{ background: "var(--bg-tertiary)", borderRadius: 10, padding: 10, marginBottom: 6 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{fr.tc.n || "?"}</div>
                <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 6, paddingLeft: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"\u26F5 FRANCHISE PORT (" + String(p.cfg.fp || 10) + "j)"}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: pcol }}>{String(fr.jp) + "j"}{fr.rp > 0 ? " | reste " + String(fr.rp) + "j" : " | +" + String(Math.abs(fr.rp)) + "j surestaries"}</div>
                  </div>
                  {fr.tc.dsp ? (
                    <div style={{ border: "1px solid var(--border)", paddingLeft: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"\uD83D\uDE9A RETOUR VIDE (" + String(p.cfg.ft || 23) + "j)"}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tcol }}>{String(fr.jt) + "j"}{fr.rt > 0 ? " | reste " + String(fr.rt) + "j" : " | +" + String(Math.abs(fr.rt)) + "j detention"}</div>
                    </div>
                  ) : <div style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>{"Pas encore dispatche"}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Conteneurs */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{"Conteneurs (" + String(mt.length) + ")"}</div>
      {mt.map(function (tc) {
        var nx = PL.slice(PL.indexOf(tc.st) + 1);
        var canDisp = tc.st === "PORT" && (d.pn || d.as2 === "OBTENU");
        var noGate = tc.st === "PORT" && !d.pn && d.as2 !== "OBTENU";
        var stIdx = PL.indexOf(tc.st);
        var stps = [
          { k: "ATTENDU", lbl: "Attendu", dt: null, done: stIdx >= 0 },
          { k: "PORT", lbl: "Port", dt: d.da || null, done: stIdx >= 1 },
          { k: "DISPATCHE", lbl: "Chargement", dt: tc.dsp || null, done: stIdx >= 2 },
          { k: "TRANSIT", lbl: "Sortie DK", dt: tc.dtk || null, done: stIdx >= 3 },
          { k: "KATI", lbl: "Kati", dt: tc.dak || null, done: stIdx >= 4 },
          { k: "BAMAKO", lbl: "Bamako", dt: tc.dab || null, done: stIdx >= 5 },
          { k: "RETURNED", lbl: "Retourne", dt: tc.dr || null, done: stIdx >= 6 }
        ];
        return <div key={tc.id} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10, marginBottom: 6, border: "1px solid var(--border)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}><div><span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{tc.n || "?"}</span><span style={{ color: "var(--text-secondary)", fontSize: 12, marginLeft: 6 }}>{(tc.ty || "") + (tc.po ? " " + tc.po + "kg" : "")}</span>{tc.ch ? <span style={{ color: "var(--text-tertiary)", fontSize: 12, marginLeft: 6 }}>{"-> " + tc.ch}</span> : null}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ background: SB[tc.st] || "var(--bg-secondary)", color: SC[tc.st] || "var(--text-secondary)", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{SL[tc.st] || tc.st}</span>{canDisp && ce ? <button onClick={function () { p.setMl({ t: "disp", tid: tc.id }); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{"Dispatch"}</button> : null}{noGate ? <span style={{ fontSize: 10, color: "var(--danger)", fontWeight: 600 }}>{"BAE/Pregate requis"}</span> : null}{tc.st === "ATTENDU" && ce ? <button onClick={function () { p.setAdvPending({ tid: tc.id, ns: "PORT", dt: today() }); }} style={{ background: "var(--btn-primary-bg)", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{"Arrive au port"}</button> : null}{tc.st !== "PORT" && tc.st !== "ATTENDU" && nx.length > 0 && ce ? <select value="" onChange={function (e) { if (e.target.value) p.setAdvPending({ tid: tc.id, ns: e.target.value, dt: today() }); }} style={{ padding: "3px 5px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 11, cursor: "pointer" }}><option value="">{"-->"}</option>{nx.map(function (s) { return <option key={s} value={s}>{SL[s] || s}</option>; })}</select> : null}</div></div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginTop: 8, overflowX: "auto" }}>
            {stps.map(function (s, i) {
              var isCur = s.k === tc.st;
              var col = s.done ? (isCur ? SC[s.k] || "var(--text-primary)" : "var(--success)") : "var(--border)";
              // Bonus : etape suivante cliquable. Le clic avance le TC a cette etape.
              //  - PORT depuis ATTENDU : advance direct (pose la date d'arrivee).
              //  - DISPATCHE depuis PORT : ouvre la modale dispatch (chauffeur requis).
              //  - Autres etapes apres DISPATCHE : advance direct.
              var isNext = ce && i === stIdx + 1 && !s.done && !isCur;
              var canClick = isNext && (s.k !== "DISPATCHE" || canDisp);  // dispatch needs BAE/Pregate
              var onStepClick = canClick ? function () {
                if (s.k === "DISPATCHE") {
                  p.setMl({ t: "disp", tid: tc.id });
                } else {
                  p.setAdvPending({ tid: tc.id, ns: s.k, dt: today() });
                }
              } : null;
              var stepInner = <div style={{ textAlign: "center" as const, minWidth: 48 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: s.done ? col : (canClick ? "var(--btn-primary-bg)" : "var(--bg-primary)"), border: "2px solid " + (canClick ? "var(--btn-primary-bg)" : col), margin: "0 auto 3px auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.done && !isCur ? <span style={{ color: "white", fontSize: 8, fontWeight: 800 }}>{"\u2713"}</span> : null}
                  {isCur ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }}></div> : null}
                  {canClick ? <span style={{ color: "var(--btn-primary-text)", fontSize: 10, fontWeight: 800, lineHeight: 1 }}>{"+"}</span> : null}
                </div>
                <div style={{ fontSize: 9, fontWeight: isCur ? 800 : canClick ? 700 : 500, color: isCur ? "var(--text-primary)" : s.done ? "var(--success)" : canClick ? "var(--btn-primary-bg)" : "var(--text-muted)" }}>{s.lbl}</div>
                {s.dt ? <div style={{ fontSize: 8, color: "var(--text-secondary)" }}>{fd(s.dt)}</div> : null}
              </div>;
              return <div key={s.k} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                {canClick ? (
                  <button onClick={onStepClick || undefined} title={"Avancer le TC vers " + s.lbl} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", flex: 1, minWidth: 0 }}>{stepInner}</button>
                ) : stepInner}
                {i < stps.length - 1 ? <div style={{ flex: 1, height: 2, background: stps[i + 1].done ? "var(--success)" : "var(--border)", marginTop: -12, minWidth: 4 }}></div> : null}
              </div>;
            })}
          </div>
          {(function () {
            var tcDep = p.dep.filter(function (f) { return f.tcid === tc.id && f.tp === "TRANSPORT"; });
            var verse = tcDep.reduce(function (s, f) { return s + (f.mt || 0); }, 0);
            var bgt = parseInt(tc.budget) || 0;
            var reste = bgt > 0 ? bgt - verse : null;
            if (!tc.ch) return null;
            return (
              <div style={{ marginTop: 8, background: "var(--bg-primary)", borderRadius: 6, padding: "6px 10px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)" }}>{"Transport chauffeur"}</span>
                  {ce ? <button onClick={function () { p.setMl({ t: "tcp", tid: tc.id }); }} style={{ background: "var(--btn-primary-bg)", color: "white", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{"+ Verser"}</button> : null}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, flexWrap: "wrap" }}>
                  {bgt > 0 ? <span>{"Budget: "}<strong>{fm(bgt)}</strong></span> : null}
                  <span style={{ color: "var(--success)" }}>{"Verse: "}<strong>{fm(verse)}</strong></span>
                  {reste !== null ? <span style={{ color: reste < 0 ? "var(--danger)" : reste === 0 ? "var(--success)" : "var(--warning)" }}>{"Reste: "}<strong>{fm(reste)}</strong></span> : null}
                </div>
                {tcDep.length > 0 ? <div style={{ marginTop: 4 }}>{tcDep.map(function (f) { return <div key={f.id} style={{ fontSize: 10, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", marginTop: 2 }}><span>{PLBL[f.ph] || (f.ds || "").split(" - ")[0]}</span><span style={{ fontWeight: 700 }}>{fm(f.mt || 0)}{" "}<span style={{ background: f.s === "PAYE" ? "var(--success-light)" : "var(--warning-bg)", color: f.s === "PAYE" ? "var(--success-text)" : "var(--warning-text)", padding: "0 4px", borderRadius: 3 }}>{f.s === "PAYE" ? "P" : "A"}</span></span></div>; })}</div> : null}
              </div>
            );
          })()}
          {ce ? <input value={incEdits.hasOwnProperty(tc.id) ? incEdits[tc.id] : (tc.inc || "")} onChange={function (e) { var v = e.target.value; var r = Object.assign({}, incEdits); r[tc.id] = v; setIncEdits(r); }} onBlur={function () { if (incEdits.hasOwnProperty(tc.id)) { p.updateTcDate(tc.id, "inc", incEdits[tc.id]); var r = Object.assign({}, incEdits); delete r[tc.id]; setIncEdits(r); } }} placeholder={"Incident / note sur ce TC..."} style={{ width: "100%", padding: "4px 8px", border: "1px solid " + (tc.inc ? "var(--danger-border)" : "var(--border)"), borderRadius: 6, fontSize: 10, background: tc.inc ? "var(--danger-bg)" : "var(--bg-tertiary)", marginTop: 6, boxSizing: "border-box" }} /> : tc.inc ? <div style={{ marginTop: 6, fontSize: 10, color: "var(--danger)", background: "var(--danger-bg)", padding: "4px 8px", borderRadius: 6 }}>{tc.inc}</div> : null}
          {ce ? (
            <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {/* Bug 2 fix — modifier identite TC (n, ty, po) meme si dispatched.
                  Permet de corriger les erreurs d'import Excel sans toucher
                  a l'historique transit. */}
              {p.editTcInfo ? (
                <button onClick={function () {
                  var newN = window.prompt("Numéro TC :", tc.n || "");
                  if (newN === null) return;
                  var newTy = window.prompt("Type (20GP / 40GP / 40HC / 45HC / 20RF / 40RF) :", tc.ty || "20GP");
                  if (newTy === null) return;
                  var newPoStr = window.prompt("Poids (kg) :", String(tc.po || 0));
                  if (newPoStr === null) return;
                  p.editTcInfo(tc.id, { n: newN, ty: newTy, po: parseFloat(newPoStr) || 0 });
                }} style={{ background: "var(--info-bg)", color: "var(--info-text)", border: "1px solid var(--info-border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{"✏️ Modifier infos"}</button>
              ) : null}
              {p.deleteTc && tc.st !== "TRANSIT" && tc.st !== "KATI" && tc.st !== "BAMAKO" && tc.st !== "RETURNED" ? (
                <button onClick={function () { if (confirm("Supprimer le conteneur " + (tc.n || "?") + " du dossier ? Les depenses liees seront aussi supprimees.")) p.deleteTc(tc.id); }} style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{"Supprimer ce TC"}</button>
              ) : null}
            </div>
          ) : null}
        </div>;
      })}

      </>) : null}

      {/* Intervenants */}
      {activeTab === "admin" ? (<>
      <IntervenantsView did={d.id} dos={p.dos} sv={p.sv} db={p.db} />

      {/* Documents joints */}
      {(d.docs || []).length > 0 ? (
        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{"Documents (" + String((d.docs || []).length) + ")"}</span>
            <button onClick={function () { p.setMl({ t: "jdoc", did: d.id }); }} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{"Gerer"}</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(d.docs || []).map(function (dc) {
            var isImg = (dc.ft || "").indexOf("image") >= 0;
            return <span key={dc.id} style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{(isImg ? "\uD83D\uDDBC\uFE0F " : "\uD83D\uDCC4 ") + dc.tp}</span>;
          })}</div>
        </div>
      ) : null}

      </>) : null}

      {/* Depenses */}
      {activeTab === "fin" ? (<>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, marginBottom: 8 }}><span style={{ fontWeight: 700, fontSize: 13 }}>{"Dépenses (" + String(md.length) + ")"}</span>{ce ? <button onClick={function () { p.setMl({ t: "ndep", did: d.id }); }} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{"+"}</button> : null}</div>
      <div className="lt-grid3" style={{ gap: 8, marginBottom: 8 }}>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>{"HT"}</div><div style={{ fontSize: 14, fontWeight: 800 }}>{fm(htot)}</div></div>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--danger-text)", fontWeight: 600 }}>{"TTC"}</div><div style={{ fontSize: 14, fontWeight: 800, color: "var(--danger-text)" }}>{fm(tot)}</div></div>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--success-text)", fontWeight: 600 }}>{"PAYE"}</div><div style={{ fontSize: 14, fontWeight: 800, color: "var(--success-text)" }}>{fm(paye)}</div></div>
      </div>
      {tot > htot ? <div style={{ background: "var(--warning-bg)", borderRadius: 6, padding: 6, marginBottom: 8, fontSize: 11, color: "var(--warning-text)", textAlign: "center", fontWeight: 600 }}>{"Taxes totales: " + fm(tot - htot)}</div> : null}
      {md.map(function (f) {
        var tax = (f.mt || 0) - (f.ht || f.mt || 0);
        return <div key={f.id} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10, marginBottom: 6, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div><span style={{ fontWeight: 700, fontSize: 13 }}>{DTL[f.tp] || "?"}</span>{f.nf ? <span style={{ color: "var(--text-secondary)", fontSize: 11, marginLeft: 6 }}>{"N°" + f.nf}</span> : null}{f.fid ? <span style={{ color: "var(--text-primary)", marginLeft: 4 }}>{"\uD83D\uDCCE"}</span> : null}</div>
            {ce ? <div style={{ display: "flex", gap: 4 }}>
              <button onClick={function () { p.setMl({ t: "edep", fid: f.id }); }} style={{ background: "var(--border)", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer", color: "var(--text-tertiary)" }}>{"\u270F\uFE0F"}</button>
              <button onClick={function () { p.toggleDepSt(f.id); }} style={{ background: f.s === "PAYE" ? "var(--success-light)" : "var(--warning-bg)", color: f.s === "PAYE" ? "var(--success-text)" : "var(--warning-text)", border: "none", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{f.s === "PAYE" ? "Paye" : "Impaye"}</button>
            </div> : <span style={{ background: f.s === "PAYE" ? "var(--success-light)" : "var(--warning-bg)", color: f.s === "PAYE" ? "var(--success-text)" : "var(--warning-text)", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{f.s === "PAYE" ? "Paye" : "Impaye"}</span>}
          </div>
          {f.ds ? <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{f.ds}</div> : null}
          <div className="lt-grid3" style={{ gap: 4 }}>
            <div style={{ background: "var(--bg-primary)", borderRadius: 4, padding: "4px 6px" }}><div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>{"HT"}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{fm(f.ht || f.mt || 0)}</div></div>
            <div style={{ background: tax > 0 ? "var(--warning-bg)" : "var(--bg-primary)", borderRadius: 4, padding: "4px 6px" }}><div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>{"TAXES"}</div><div style={{ fontSize: 12, fontWeight: 700, color: tax > 0 ? "var(--warning)" : "var(--text-tertiary)" }}>{tax > 0 ? fm(tax) : "---"}</div></div>
            <div style={{ background: "var(--danger-light)", borderRadius: 4, padding: "4px 6px" }}><div style={{ fontSize: 9, color: "var(--danger-text)", fontWeight: 700 }}>{"TTC"}</div><div style={{ fontSize: 12, fontWeight: 800, color: "var(--danger)" }}>{fm(f.mt || 0)}</div></div>
          </div>
        </div>;
      })}

      {/* Recette / Marge */}
      {rv > 0 ? (
        <div style={{ background: marge >= 0 ? "var(--success-bg)" : "var(--danger-bg)", border: "1px solid " + (marge >= 0 ? "var(--success-border)" : "var(--danger-border)"), borderRadius: 8, padding: "10px 14px", marginTop: 8, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: marge >= 0 ? "var(--success-text)" : "var(--danger)", marginBottom: 6 }}>{"Rentabilite"}</div>
          <div className="lt-grid3" style={{ gap: 8 }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--success)", fontWeight: 600 }}>{"RECETTE"}</div><div style={{ fontWeight: 800, fontSize: 14, color: "var(--success)" }}>{fm(rv)}</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--danger-text)", fontWeight: 600 }}>{"CHARGES"}</div><div style={{ fontWeight: 800, fontSize: 14, color: "var(--danger-text)" }}>{fm(tot)}</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: marge >= 0 ? "var(--success-text)" : "var(--danger)", fontWeight: 600 }}>{"MARGE"}</div><div style={{ fontWeight: 800, fontSize: 14, color: marge >= 0 ? "var(--success)" : "var(--danger)" }}>{fm(marge)}</div><div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>{String(Math.round(marge / rv * 100)) + "%"}</div></div>
          </div>
        </div>
      ) : null}

      </>) : null}

      {/* Historique */}
      {activeTab === "admin" ? (function () {
        var dl = (p.logs || []).filter(function (l) { return l.did === d.id; }).slice().reverse().slice(0, 20);
        if (dl.length === 0) return null;
        var ICONS = { CREATION: "\uD83D\uDCC1", MODIF_DOSSIER: "\u270F\uFE0F", SUPPR_DOSSIER: "\uD83D\uDDD1\uFE0F", DISPATCH: "\uD83D\uDE9A", TC_STATUT: "\uD83D\uDCE6", AJOUT_DEPENSE: "\uD83D\uDCB8", MODIF_DEPENSE: "\u270F\uFE0F", SUPPR_DEPENSE: "\uD83D\uDDD1\uFE0F", PAIEMENT: "\uD83D\uDCB0", CLOTURE: "\u2705", ARCHIVE: "\uD83D\uDCE5", STATUT: "\uD83D\uDD04" };
        return <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{"\uD83D\uDCCB Historique (" + String(dl.length) + ")"}</div>
          {dl.map(function (l) {
            var dt = new Date(l.dt);
            var ts = String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0") + " " + String(dt.getHours()).padStart(2, "0") + ":" + String(dt.getMinutes()).padStart(2, "0");
            return <div key={l.id} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 12 }}>
              <div style={{ minWidth: 24, textAlign: "center" }}>{ICONS[l.ac] || "\u25CF"}</div>
              <div style={{ color: "var(--text-muted)", minWidth: 80 }}>{ts}</div>
              <div style={{ flex: 1, color: "var(--text-input)" }}>{l.ds || l.ac}</div>
            </div>;
          })}
        </div>;
      })() : null}

      {/* Export PDF */}
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button onClick={function () {
          var w = window.open("", "_blank");
          var htot2 = md.reduce(function (a, f) { return a + (f.ht || f.mt || 0); }, 0);
          var tax2 = tot - htot2;
          var html = "<html><head><title>Sapurai - " + (d.cl || "") + " - " + (d.bl || "") + "</title><style>body{font-family:system-ui,sans-serif;padding:30px;max-width:800px;margin:0 auto}h1{font-size:20px;border-bottom:2px solid #1c1917;padding-bottom:8px}h2{font-size:14px;color:#1c1917;margin-top:20px;border-bottom:1px solid #e7e5e4;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{padding:6px 10px;text-align:left;border-bottom:1px solid #e7e5e4;font-size:12px}th{background:#f5f5f4;font-weight:700}.r{text-align:right}.b{font-weight:700}.amt{font-family:monospace}@media print{body{padding:10px}}</style></head><body>";
          html += "<h1>SAPURAI - Fiche Dossier</h1>";
          html += "<table><tr><td><b>Client</b></td><td>" + (d.cl || "") + "</td><td><b>BL</b></td><td>" + (d.bl || "") + "</td></tr>";
          html += "<tr><td><b>Compagnie</b></td><td>" + (d.cp || "") + "</td><td><b>Date arrivee</b></td><td>" + fd(d.da) + "</td></tr>";
          html += "<tr><td><b>Destination</b></td><td>" + (d.cr || "---") + "</td><td></td><td></td></tr>";
          html += "<tr><td><b>Statut</b></td><td>" + (DL[d.st] || d.st) + "</td><td><b>Garantie</b></td><td>" + (d.gr || "") + "</td></tr>";
          html += "<tr><td><b>BAD</b></td><td>" + (d.bs === "OBTENU" ? "Obtenu" : d.bs === "EN_COURS" ? "En cours" : "Non demandé") + "</td><td><b>BAE</b></td><td>" + (d.as2 === "OBTENU" ? "Obtenu" : d.as2 === "EN_COURS" ? "En cours" : "Non demandé") + "</td></tr>";
          html += "<tr><td><b>Pregate</b></td><td>" + (d.pn || "---") + "</td><td><b>Declaration</b></td><td>" + (d.nd || "---") + "</td></tr></table>";
          html += "<h2>Conteneurs (" + String(mt.length) + ")</h2><table><tr><th>Numero</th><th>Type</th><th>Poids</th><th>Statut</th><th>Chauffeur</th></tr>";
          mt.forEach(function (tc) { html += "<tr><td class='b'>" + (tc.n || "?") + "</td><td>" + (tc.ty || "") + "</td><td class='r'>" + (tc.po || "") + "</td><td>" + (SL[tc.st] || tc.st) + "</td><td>" + (tc.ch || "---") + "</td></tr>"; });
          html += "</table>";
          html += "<h2>Depenses (" + String(md.length) + ")</h2><table><tr><th>Type</th><th>Facture</th><th>Date</th><th class='r'>HT</th><th class='r'>TTC</th><th>Statut</th></tr>";
          md.forEach(function (f) { html += "<tr><td>" + (DTL[f.tp] || "?") + "</td><td>" + (f.nf || "") + "</td><td>" + fd(f.dt) + "</td><td class='r amt'>" + fm(f.ht || f.mt || 0) + "</td><td class='r amt b'>" + fm(f.mt || 0) + "</td><td>" + (f.s === "PAYE" ? "Paye" : "Impaye") + "</td></tr>"; });
          html += "<tr style='border-top:2px solid #1c1917'><td colspan='3' class='b'>TOTAUX</td><td class='r amt b'>" + fm(htot2) + "</td><td class='r amt b'>" + fm(tot) + "</td><td class='b'>Taxes: " + fm(tax2) + "</td></tr></table>";
          if ((d.itv || []).length > 0) { html += "<h2>Intervenants</h2><table><tr><th>Role</th><th>Nom</th><th>Tel</th></tr>"; (d.itv || []).forEach(function (iv) { html += "<tr><td>" + iv.role + "</td><td>" + (iv.nm || "") + "</td><td>" + (iv.tl || "") + "</td></tr>"; }); html += "</table>"; }
          var dl2 = (p.logs || []).filter(function (l) { return l.did === d.id; }).slice().reverse();
          if (dl2.length > 0) { html += "<h2>Historique</h2><table><tr><th>Date</th><th>Action</th><th>Detail</th></tr>"; dl2.forEach(function (l) { var dt2 = new Date(l.dt); html += "<tr><td>" + String(dt2.getDate()).padStart(2, "0") + "/" + String(dt2.getMonth() + 1).padStart(2, "0") + "/" + String(dt2.getFullYear()) + " " + String(dt2.getHours()).padStart(2, "0") + ":" + String(dt2.getMinutes()).padStart(2, "0") + "</td><td>" + l.ac + "</td><td>" + (l.ds || "") + "</td></tr>"; }); html += "</table>"; }
          html += "<div style='text-align:center;margin-top:30px;color:#a8a29e;font-size:11px'>Sapurai V3 - Genere le " + new Date().toLocaleDateString("fr-FR") + "</div></body></html>";
          w.document.write(html);
          w.document.close();
          w.print();
        }} style={{ background: "var(--btn-primary-bg)", color: "white", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{"\uD83D\uDDA8\uFE0F Exporter PDF"}</button>
      </div>
    </div>
  );
}

export default DetView;
