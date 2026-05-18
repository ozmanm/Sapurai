import { useState } from 'react';
import { fd, fm } from '../../utils/format.js';
import { SL } from '../../constants/statuts.js';
import { DTL } from '../../constants/depenses.js';
import ClickableDiv from '../ui/ClickableDiv.tsx';

/**
 * Timeline detaillee d'un conteneur (Sprint B.3 refonte handoff `d-tc-detail`).
 *
 * Affiche :
 * - Header : n° TC mono + pills statut + alerte surestaries
 * - Timeline 6 etapes (Annonce / Port / Dispatch / Transit / Kati / Bamako / Returned)
 *   avec date prevue/reelle. Etapes done = point vert ; en cours = orange ; futur = gris.
 * - Historique des positions (date mono + statut + nb jours)
 * - Depenses liees (filtrage par tcid)
 * - Sidebar : alerte surestaries, fiche technique, chauffeur
 */

interface TcTimelineProps {
  tc: any;
  dos: any;
  dep: any[];
  cfg?: any;
  setMl: (ml: any) => void;
  onClose: () => void;
}

interface Step {
  key: string;
  lbl: string;
  date: string | null;
  done: boolean;
  current: boolean;
}

function buildSteps(tc: any): Step[] {
  // Sprint 46 - Cycle de vie : ATTENDU -> PORT -> ASSIGNE -> DISPATCHE -> TRANSIT -> BAMAKO -> RETURNED
  // KATI retire du cycle. Les TC legacy en KATI sont migres vers TRANSIT par script,
  // mais on garde KATI dans la map de fallback pour les affichages historiques.
  var states = ["ATTENDU", "PORT", "ASSIGNE", "DISPATCHE", "TRANSIT", "BAMAKO", "RETURNED"];
  var orderIdx: Record<string, number> = {};
  states.forEach(function (s, i) { orderIdx[s] = i; });
  // KATI legacy -> on l'aligne sur TRANSIT pour l'affichage
  if (tc.st === "KATI") orderIdx["KATI"] = orderIdx["TRANSIT"];
  var curIdx = orderIdx[tc.st] !== undefined ? orderIdx[tc.st] : 0;

  // Dates : da (annonce), dassign (assignation camion), dsp (chargement effectif),
  //         dtk (sortie DK), dab (Bamako), dr (retour). dak legacy.
  var stepDefs = [
    { key: "ATTENDU", lbl: "Annoncé", date: tc.da || null },
    { key: "PORT", lbl: "Au port", date: tc.dsp ? "" : (tc.st === "PORT" ? "" : null) },
    { key: "ASSIGNE", lbl: "Camion assigné", date: tc.dassign || null },
    { key: "DISPATCHE", lbl: "Chargé", date: tc.dsp || null },
    { key: "TRANSIT", lbl: "En transit", date: tc.dtk || tc.dak || null },
    { key: "BAMAKO", lbl: "Bamako", date: tc.dab || null },
    { key: "RETURNED", lbl: "Retourné", date: tc.dr || null },
  ];

  return stepDefs.map(function (s, i) {
    return {
      key: s.key,
      lbl: s.lbl,
      date: s.date,
      done: i <= curIdx,
      current: i === curIdx,
    };
  });
}

function TcTimeline(p: TcTimelineProps) {
  var tc = p.tc;
  var d = p.dos;
  var [activeTab, setActiveTab] = useState("timeline");
  var steps = buildSteps(tc);

  // Depenses liees a ce TC (via tcid)
  var tcDep = (p.dep || []).filter(function (f: any) { return f.tcid === tc.id; });
  var totalTcDep = tcDep.reduce(function (s: number, f: any) { return s + (f.mt || 0); }, 0);

  // Calculs surestaries
  var franchiseFp = (p.cfg && p.cfg.fp) || 10;
  var franchiseFt = (p.cfg && p.cfg.ft) || 23;
  var nowMs = Date.now();
  var jp = 0, rp = 0, jt = 0, rt = 0;
  if (d.da) {
    var arr = new Date(d.da); arr.setHours(0, 0, 0, 0);
    var ref = tc.dsp ? new Date(tc.dsp) : new Date(); ref.setHours(0, 0, 0, 0);
    jp = Math.floor((ref.getTime() - arr.getTime()) / 864e5);
    rp = franchiseFp - jp;
  }
  if (tc.dsp && tc.st !== "PORT" && tc.st !== "ATTENDU") {
    var c2 = new Date(tc.dsp); c2.setHours(0, 0, 0, 0);
    var d2 = tc.dr ? new Date(tc.dr) : new Date(); d2.setHours(0, 0, 0, 0);
    jt = Math.floor((d2.getTime() - c2.getTime()) / 864e5);
    rt = franchiseFt - jt;
  }
  var alertSur = rp <= 3 && tc.st === "PORT";
  var alertDet = rt <= 3 && rt < franchiseFt && tc.st !== "RETURNED";

  function tabBtn(key: string, lbl: string) {
    var isActive = activeTab === key;
    return (
      <button
        key={key}
        onClick={function () { setActiveTab(key); }}
        role="tab"
        aria-selected={isActive}
        style={{
          background: "transparent",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          border: "none",
          borderBottom: isActive ? "2px solid var(--btn-primary-bg)" : "2px solid transparent",
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: isActive ? 700 : 500,
          cursor: "pointer",
          marginBottom: -1,
        }}
      >{lbl}</button>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      {/* Header — n° TC mono + statut + alertes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, marginBottom: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{tc.n || "?"}</div>
          <span className="lt-pill lt-pill-info" style={{ fontFamily: "var(--font-sans)" }}>{SL[tc.st] || tc.st}</span>
          {alertSur ? <span className="lt-pill lt-pill-alert">{"⚠ Surestaries J-" + String(rp)}</span> : null}
          {alertDet ? <span className="lt-pill lt-pill-warning">{"⚠ Détention J-" + String(rt)}</span> : null}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {(tc.ty || "TC") + (tc.po ? " · " + tc.po + " kg" : "") + " · "}
          <ClickableDiv onClick={function () { p.setMl({ t: "det", did: d.id, prev: { t: "tctimeline", tcid: tc.id } }); }} label="Voir le dossier" style={{ display: "inline" as const, color: "var(--btn-link)", fontWeight: 600, cursor: "pointer" }}>
            {(d.cl || "?") + " · BL " + (d.bl || "?")}
          </ClickableDiv>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "1px solid var(--border)" }}>
        {tabBtn("timeline", "Timeline")}
        {tabBtn("history", "Historique")}
        {tabBtn("dep", "Dépenses (" + tcDep.length + ")")}
        {tabBtn("tech", "Fiche technique")}
      </div>

      {/* Timeline */}
      {activeTab === "timeline" ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          {steps.map(function (s, i) {
            var isLast = i === steps.length - 1;
            var color = s.done ? "var(--success)" : s.current ? "var(--warning)" : "var(--text-muted)";
            var bg = s.done ? "var(--success-bg)" : s.current ? "var(--warning-bg)" : "var(--bg-secondary)";
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative" as const, paddingBottom: isLast ? 0 : 16 }}>
                {/* Point + ligne verticale */}
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" as const, position: "relative" as const, flexShrink: 0 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 999,
                    background: bg, border: "2px solid " + color,
                    display: "grid", placeItems: "center" as const,
                    fontSize: 11, fontWeight: 700,
                    color: color,
                    fontFamily: "var(--font-mono)",
                    zIndex: 1,
                  }}>{s.done ? "✓" : String(i + 1)}</div>
                  {!isLast ? (
                    <div style={{ position: "absolute" as const, top: 24, bottom: -16, width: 2, background: s.done ? "var(--success)" : "var(--border)" }} />
                  ) : null}
                </div>
                {/* Label + date */}
                <div style={{ flex: 1, paddingTop: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.done ? "var(--text-primary)" : "var(--text-muted)" }}>{s.lbl}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const, marginTop: 2 }}>
                    {s.date ? fd(s.date) : (s.current ? "En cours" : "—")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Historique reconstruit depuis les dates */}
      {activeTab === "history" ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          {(function () {
            var hist: Array<{ dt: string; lbl: string; sub: string }> = [];
            if (tc.da) hist.push({ dt: tc.da, lbl: "Annoncé", sub: "ETA initial" });
            if (tc.dsp) hist.push({ dt: tc.dsp, lbl: "Dispatché", sub: tc.ch ? "Chauffeur " + tc.ch : "" });
            if (tc.dtk) hist.push({ dt: tc.dtk, lbl: "Sortie Dakar", sub: "" });
            if (tc.dak) hist.push({ dt: tc.dak, lbl: "Arrivée Kati", sub: "" });
            if (tc.dab) hist.push({ dt: tc.dab, lbl: "Arrivée Bamako", sub: "" });
            if (tc.dr) hist.push({ dt: tc.dr, lbl: "Retourné", sub: "" });
            hist.sort(function (a, b) { return a.dt < b.dt ? -1 : 1; });
            if (hist.length === 0) {
              return <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" as const, fontStyle: "italic" as const }}>{"Pas encore d'événement"}</div>;
            }
            return hist.map(function (h, i) {
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 12, padding: "8px 10px", borderRadius: 6, alignItems: "center", background: i % 2 === 0 ? "var(--bg-secondary)" : "transparent" }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const, color: "var(--text-muted)" }}>{fd(h.dt)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{h.lbl}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{h.sub}</span>
                </div>
              );
            });
          })()}
        </div>
      ) : null}

      {/* Depenses liees */}
      {activeTab === "dep" ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          {tcDep.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" as const, fontStyle: "italic" as const }}>{"Aucune dépense liée à ce TC"}</div>
          ) : (
            <>
              {tcDep.map(function (f: any) {
                return (
                  <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 12, padding: "8px 10px", borderRadius: 6, background: "var(--bg-secondary)", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{DTL[f.tp] || f.tp || "?"}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{f.dt ? fd(f.dt) : "—"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: f.s === "PAYE" ? "var(--success-text)" : "var(--warning-text)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const }}>{fm(f.mt || 0)}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 10px 0", borderTop: "1px solid var(--border)", marginTop: 4, fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: "var(--text-primary)" }}>{"Total"}</span>
                <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const }}>{fm(totalTcDep)}</span>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Fiche technique */}
      {activeTab === "tech" ? (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 14px", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Numéro"}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{tc.n || "—"}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Type"}</span>
          <span>{tc.ty || "—"}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Poids"}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const }}>{tc.po ? tc.po + " kg" : "—"}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Statut"}</span>
          <span>{SL[tc.st] || tc.st}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Chauffeur"}</span>
          <span>{tc.ch || "—"}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Camion"}</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{tc.cm || "—"}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Téléphone"}</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{tc.tl || "—"}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Caution récup."}</span>
          <span>{tc.gar_recup ? "✓ Récupérée" + (tc.gar_recup_dt ? " (" + fd(tc.gar_recup_dt) + ")" : "") : "—"}</span>
          {tc.inc ? (<>
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{"Incident"}</span>
            <span style={{ color: "var(--danger-text)" }}>{tc.inc}</span>
          </>) : null}
        </div>
      ) : null}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 16, gap: 8 }}>
        <button onClick={function () { p.setMl({ t: "det", did: d.id }); }} style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>{"Voir le dossier"}</button>
        <button onClick={p.onClose} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Fermer"}</button>
      </div>
    </div>
  );
}

export default TcTimeline;
