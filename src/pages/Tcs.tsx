import { useState } from 'react';
import { fd } from '../utils/format.js';
import { today } from '../utils/date.js';
import { PL, SL, SC, SB, ABG, ACOL } from '../constants/statuts.js';
import usePagination from '../hooks/usePagination.js';
import Pagination from '../components/ui/Pagination.tsx';

interface TcsProps { [key: string]: any; }

function Tcs(p: TcsProps) {
  var tcs = p.tcs;
  var dos = p.dos;
  var canEdit = p.canEdit;
  var qr = p.qr;
  var setQr = p.setQr;
  var openTc = p.openTc;
  var setOpenTc = p.setOpenTc;
  var setMl = p.setMl;
  var setAdvPending = p.setAdvPending;
  var updateTcDate = p.updateTcDate;
  var tcFranchise = p.tcFranchise;

  var [qrCh, setQrCh] = useState("");
  var [qrCl, setQrCl] = useState("");
  var [sortBy, setSortBy] = useState("priorite");
  var [sortDir, setSortDir] = useState("asc");
  // Sprint B.2 — vue Kanban en alternative au tableau
  var [view, setView] = useState<"table" | "kanban">("table");

  function toggleSort(col) {
    if (sortBy === col) { setSortDir(sortDir === "asc" ? "desc" : "asc"); }
    else { setSortBy(col); setSortDir("asc"); }
  }

  var filtered = tcs.filter(function (tc) {
    if (qr && tc.st !== qr) return false;
    if (qrCh && (!tc.ch || tc.ch.toLowerCase().indexOf(qrCh.toLowerCase()) < 0)) return false;
    if (qrCl) {
      var d = dos.find(function (x) { return x.id === tc.did; });
      if (!d || !d.cl || d.cl.toLowerCase().indexOf(qrCl.toLowerCase()) < 0) return false;
    }
    return true;
  }).slice().sort(function (a, b) {
    // Tri par colonne si actif
    if (sortBy !== "priorite") {
      var dir = sortDir === "asc" ? 1 : -1;
      var dA = dos.find(function (x) { return x.id === a.did; }) || {};
      var dB = dos.find(function (x) { return x.id === b.did; }) || {};
      if (sortBy === "n") return ((a.n || "").localeCompare(b.n || "")) * dir;
      if (sortBy === "cl") return ((dA.cl || "").localeCompare(dB.cl || "")) * dir;
      if (sortBy === "da") return ((dA.da || "").localeCompare(dB.da || "")) * dir;
      if (sortBy === "po") return (((a.po || 0) - (b.po || 0))) * dir;
      if (sortBy === "st") return ((SL[a.st] || a.st).localeCompare(SL[b.st] || b.st)) * dir;
      return 0;
    }
    // Score continu : plus bas = plus urgent
    function sc(tc) {
      if (tc.st === "RETURNED") return 6000;
      if (tc.st === "ATTENDU") return 5500;
      var d = dos.find(function (x) { return x.id === tc.did; });
      var fr = tcFranchise(tc, d);
      if (!fr) return 5000;
      // TC au port : score base sur franchise port restante (rp negatif = surestaries)
      if (tc.st === "PORT") return 100 - fr.rp;
      // TC dispatche : score base sur franchise retour (rt negatif = detention)
      if (fr.rt !== null) return 200 - fr.rt;
      return 3000;
    }
    var sa = sc(a);
    var sb = sc(b);
    if (sa !== sb) return sa - sb;
    // Departage : arrivee la plus ancienne d'abord
    var da = (dos.find(function (x) { return x.id === a.did; }) || {}).da || "";
    var db = (dos.find(function (x) { return x.id === b.did; }) || {}).da || "";
    return da.localeCompare(db);
  });

  var pg = usePagination<any>(filtered, 20);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" as const }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: "var(--text-primary)" }}>{"Conteneurs"}</h1><div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontVariantNumeric: "tabular-nums" as const }}>{String(tcs.length) + " conteneur(s)"}</div></div>
        {/* Toggle vue Liste / Kanban */}
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius, 8px)", overflow: "hidden", background: "var(--bg-primary)" }}>
          <button onClick={function () { setView("table"); }} aria-pressed={view === "table"} style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === "table" ? "var(--btn-primary-bg)" : "transparent", color: view === "table" ? "var(--btn-primary-text)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>{"☰ Liste"}</button>
          <button onClick={function () { setView("kanban"); }} aria-pressed={view === "kanban"} style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === "kanban" ? "var(--btn-primary-bg)" : "transparent", color: view === "kanban" ? "var(--btn-primary-text)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>{"▦ Kanban"}</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        <button onClick={function () { setQr(""); }} style={{ background: !qr ? "var(--btn-primary-bg)" : "transparent", color: !qr ? "var(--btn-primary-text)" : "var(--text-tertiary)", border: !qr ? "none" : "1px solid var(--border)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{"Tous (" + String(tcs.length) + ")"}</button>
        {PL.map(function (s) { var n = tcs.filter(function (c) { return c.st === s; }).length; return <button key={s} onClick={function () { setQr(qr === s ? "" : s); }} style={{ background: qr === s ? "var(--btn-primary-bg)" : "transparent", color: qr === s ? "var(--btn-primary-text)" : "var(--text-tertiary)", border: qr === s ? "none" : "1px solid var(--border)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{(SL[s] || s) + " (" + String(n) + ")"}</button>; })}
      </div>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div>
          <input value={qrCl} onChange={function (e) { setQrCl(e.target.value); }} placeholder={"Filtrer par client..."} style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, width: "100%", maxWidth: 200, outline: "none", boxSizing: "border-box" }} />
          {qrCl ? <button onClick={function () { setQrCl(""); }} style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>{"x"}</button> : null}
        </div>
        <div>
          <input value={qrCh} onChange={function (e) { setQrCh(e.target.value); }} placeholder={"Filtrer par chauffeur..."} style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, width: "100%", maxWidth: 200, outline: "none", boxSizing: "border-box" }} />
          {qrCh ? <button onClick={function () { setQrCh(""); }} style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>{"x"}</button> : null}
        </div>
      </div>
      {sortBy !== "priorite" ? <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 8, padding: "6px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--info)", fontWeight: 600 }}>{"Tri par : " + ({ n: "Conteneur", cl: "Client", da: "Arrivee", po: "Poids", st: "Statut" }[sortBy] || sortBy) + " (" + (sortDir === "asc" ? "croissant" : "decroissant") + ")"}</span>
        <button onClick={function () { setSortBy("priorite"); setSortDir("asc"); }} style={{ background: "none", border: "none", color: "var(--info)", fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{"Revenir au tri par priorite"}</button>
      </div> : null}
      {/* Vue Kanban — Sprint B.2 — 5 colonnes par statut handoff */}
      {view === "kanban" ? (function () {
        var KCOLS: Array<{ key: string; lbl: string; statuts: string[] }> = [
          { key: "annonce", lbl: "Annoncé", statuts: ["ATTENDU"] },
          { key: "port", lbl: "Au port", statuts: ["PORT"] },
          { key: "embarque", lbl: "Embarqué", statuts: ["DISPATCHE"] },
          { key: "transit", lbl: "En transit", statuts: ["TRANSIT", "KATI", "BAMAKO"] },
          { key: "livre", lbl: "Livré", statuts: ["RETURNED"] },
        ];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 12, overflowX: "auto" as const, paddingBottom: 8 }}>
            {KCOLS.map(function (col) {
              var items = filtered.filter(function (tc: any) { return col.statuts.indexOf(tc.st) >= 0; });
              return (
                <div key={col.key} className="lt-card" style={{ padding: 0, minWidth: 180, display: "flex", flexDirection: "column" as const, maxHeight: "70vh" }}>
                  {/* Col header */}
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{col.lbl}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const }}>{String(items.length)}</span>
                  </div>
                  {/* Cards */}
                  <div style={{ padding: 8, display: "flex", flexDirection: "column" as const, gap: 6, overflowY: "auto" as const, flex: 1 }}>
                    {items.length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" as const, padding: "16px 0", fontStyle: "italic" as const }}>{"Aucun"}</div>
                    ) : items.map(function (tc: any) {
                      var d = dos.find(function (x: any) { return x.id === tc.did; });
                      if (!d) return null;
                      var fr = tcFranchise(tc, d);
                      var durLbl = "";
                      var durColor = "var(--text-muted)";
                      if (fr) {
                        durLbl = fr.lbl + " " + (fr.val > 0 ? "J-" + String(fr.val) : "+" + String(Math.abs(fr.val)) + "j");
                        durColor = fr.col === "red" || fr.col === "black" ? "var(--danger)" : fr.col === "orange" ? "var(--warning-text)" : "var(--success-text)";
                      }
                      return (
                        <div key={tc.id} role="button" tabIndex={0} onClick={function () { setMl({ t: "tctimeline", tcid: tc.id }); }} onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMl({ t: "tctimeline", tcid: tc.id }); } }} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: 6, padding: "8px 10px", cursor: "pointer", display: "flex", flexDirection: "column" as const, gap: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", overflow: "hidden" as const, textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>{tc.n || "?"}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.02em", overflow: "hidden" as const, textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>{d.cl || "?"}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{tc.ty || "?"}</span>
                            {durLbl ? <span style={{ fontSize: 10, fontWeight: 600, color: durColor, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const }}>{durLbl}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })() : null}

      {view === "table" ? (
      <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 1.8fr 0.9fr 0.8fr 0.8fr 1fr 60px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
          {[
            { l: "Conteneur", k: "n" }, { l: "Client / BL", k: "cl" }, { l: "Arrivee", k: "da" },
            { l: "Type", k: null }, { l: "Poids", k: "po" }, { l: "Statut", k: "st" }, { l: "", k: null }
          ].map(function (h) {
            var active = h.k && sortBy === h.k;
            return <div key={h.l || "x"} onClick={h.k ? function () { toggleSort(h.k); } : undefined} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: active ? "var(--text-primary)" : "var(--text-muted)", letterSpacing: 0.5, textTransform: "uppercase", cursor: h.k ? "pointer" : "default", userSelect: "none" }}>{h.l}{active ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}</div>;
          })}
        </div>
        {pg.paginated.map(function (tc) {
          var d = dos.find(function (x) { return x.id === tc.did; });
          if (!d) return null;
          var nx = PL.slice(PL.indexOf(tc.st) + 1);
          var fr = tcFranchise(tc, d);
          var isExp = openTc === tc.id;
          var steps = [
            { k: "ATTENDU", lbl: "Attendu", dt: null, done: PL.indexOf(tc.st) >= 0 },
            { k: "PORT", lbl: "Port", dt: d.da || null, done: PL.indexOf(tc.st) >= 1 },
            { k: "DISPATCHE", lbl: "Chargement", dt: tc.dsp || null, done: PL.indexOf(tc.st) >= 2 },
            { k: "TRANSIT", lbl: "Sortie DK", dt: tc.dtk || null, done: PL.indexOf(tc.st) >= 3 },
            { k: "KATI", lbl: "Kati", dt: tc.dak || null, done: PL.indexOf(tc.st) >= 4 },
            { k: "BAMAKO", lbl: "Bamako", dt: tc.dab || null, done: PL.indexOf(tc.st) >= 5 },
            { k: "RETURNED", lbl: "Retourne", dt: tc.dr || null, done: PL.indexOf(tc.st) >= 6 }
          ];
          return <div key={tc.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
            {/* Desktop row */}
            <div className="lt-hide-mobile" onClick={function () { setOpenTc(isExp ? null : tc.id); }} style={{ display: "grid", gridTemplateColumns: "2fr 1.8fr 0.9fr 0.8fr 0.8fr 1fr 60px", alignItems: "center", cursor: "pointer", background: isExp ? "var(--bg-tertiary)" : "transparent" }}>
              <div style={{ padding: "12px 12px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>{tc.n || "?"}{fr ? <span style={{ marginLeft: 6, background: ABG[fr.col], color: ACOL[fr.col], padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: "system-ui" }}>{fr.lbl + " " + (fr.val > 0 ? "J-" + String(fr.val) : "+" + String(Math.abs(fr.val)) + "j")}</span> : null}</div>
                {tc.ch ? <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>{"\u2192 " + tc.ch}</div> : null}
              </div>
              <div style={{ padding: "12px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-input)" }}>{d.cl || "?"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(d.bl || "") + " \u00B7 " + (d.cp || "")}</div>
              </div>
              <div style={{ padding: "12px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-input)" }}>{d.da ? fd(d.da) : "---"}</div>
              <div style={{ padding: "12px 12px" }}><span style={{ background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "var(--text-input)" }}>{tc.ty || "---"}</span></div>
              <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-input)" }}>{tc.po ? String(Math.round(tc.po / 1000)) + "t" : "---"}</div>
              <div style={{ padding: "12px 12px" }}><span style={{ background: SB[tc.st] || "var(--bg-secondary)", color: SC[tc.st] || "var(--text-secondary)", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{SL[tc.st] || tc.st}</span></div>
              <div style={{ padding: "12px 8px", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 16, color: "var(--text-muted)", transform: isExp ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>{"\u25BC"}</span>
              </div>
            </div>
            {/* Mobile row */}
            <div className="lt-show-mobile" onClick={function () { setOpenTc(isExp ? null : tc.id); }} style={{ display: "none", padding: "10px 12px", cursor: "pointer", background: isExp ? "var(--bg-tertiary)" : "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>{tc.n || "?"}{fr ? <span style={{ marginLeft: 6, background: ABG[fr.col], color: ACOL[fr.col], padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: "system-ui" }}>{fr.lbl + " " + (fr.val > 0 ? "J-" + String(fr.val) : "+" + String(Math.abs(fr.val)) + "j")}</span> : null}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{(d.cl || "") + " \u00B7 " + (d.bl || "")}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(d.da ? fd(d.da) : "") + " \u00B7 " + (tc.ty || "") + (tc.po ? " \u00B7 " + String(Math.round(tc.po / 1000)) + "t" : "") + (tc.ch ? " \u00B7 " + tc.ch : "")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: SB[tc.st] || "var(--bg-secondary)", color: SC[tc.st] || "var(--text-secondary)", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{SL[tc.st] || tc.st}</span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)", transform: isExp ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>{"\u25BC"}</span>
                </div>
              </div>
            </div>
            {/* Expanded panel */}
            {isExp ? <div style={{ padding: "0 12px 14px 12px", background: "var(--bg-tertiary)" }}>
              {/* Timeline cliquable : le prochain step (cercle pulsant) avance le TC */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 0, margin: "10px 0 14px 0", overflowX: "auto", paddingBottom: 4 }}>
                {steps.map(function (s, i) {
                  var isCur = s.k === tc.st;
                  var col = s.done ? (isCur ? SC[s.k] || "var(--text-primary)" : "var(--success)") : "#d6d3d1";
                  // Step cliquable = c'est le tout prochain dans la sequence (nx[0])
                  var isNext = canEdit && nx.length > 0 && s.k === nx[0];
                  // Cas special : transition PORT -> DISPATCHE necessite le modal Dispatch (chauffeur)
                  // Cas special : transition vers PORT seulement si BAE/Pregate disponible
                  var blockedDispatch = isNext && s.k === "DISPATCHE" && tc.st === "PORT" && !d.pn && d.as2 !== "OBTENU";
                  function handleStepClick() {
                    if (!isNext || blockedDispatch) return;
                    if (s.k === "DISPATCHE" && tc.st === "PORT") {
                      // Ouvre le modal de dispatch (assignation chauffeur + budget)
                      setMl({ t: "disp", tid: tc.id });
                    } else {
                      // Avance simple : ouvre le mini-modal de date
                      setAdvPending({ tid: tc.id, ns: s.k, dt: today() });
                    }
                  }
                  var clickable = isNext && !blockedDispatch;
                  return <div key={s.k} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <div
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? handleStepClick : undefined}
                      onKeyDown={clickable ? function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStepClick(); } } : undefined}
                      title={clickable ? ("Avancer vers " + s.lbl) : (blockedDispatch ? "BAE ou Pregate requis avant dispatch" : undefined)}
                      style={{ textAlign: "center", minWidth: 76, cursor: clickable ? "pointer" : (blockedDispatch ? "not-allowed" : "default"), padding: clickable ? "2px 4px" : 0, borderRadius: 6, transition: "background .15s", outline: "none" }}
                      onMouseEnter={clickable ? function (e) { (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)"; } : undefined}
                      onMouseLeave={clickable ? function (e) { (e.currentTarget as HTMLElement).style.background = "transparent"; } : undefined}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: s.done ? col : "var(--bg-primary)", border: "2px solid " + col, margin: "0 auto 4px auto", display: "flex", alignItems: "center", justifyContent: "center", animation: clickable ? "lt-tc-step-pulse 1.6s ease-in-out infinite" : "none", boxShadow: clickable ? "0 0 0 0 rgba(22,163,74,0.4)" : "none" }}>
                        {s.done && !isCur ? <span style={{ color: "white", fontSize: 11, fontWeight: 800 }}>{"\u2713"}</span> : null}
                        {isCur ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }}></div> : null}
                        {clickable ? <span style={{ color: "var(--success)", fontSize: 12, fontWeight: 800 }}>{"\u2192"}</span> : null}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: isCur ? 800 : (clickable ? 700 : 600), color: isCur ? "var(--text-primary)" : s.done ? "var(--success)" : (clickable ? "var(--success)" : "var(--text-muted)"), whiteSpace: "nowrap", textDecoration: clickable ? "underline" : "none", textDecorationStyle: clickable ? "dotted" : undefined as any, textUnderlineOffset: 3 }}>{s.lbl}</div>
                      {s.dt ? <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 1, whiteSpace: "nowrap" }}>{fd(s.dt)}</div> : (clickable ? <div style={{ fontSize: 9, color: "var(--success)", marginTop: 1, whiteSpace: "nowrap", fontStyle: "italic" }}>{"cliquer"}</div> : null)}
                    </div>
                    {i < steps.length - 1 ? <div style={{ width: 16, minWidth: 16, height: 2, background: steps[i + 1].done ? "var(--success)" : "var(--border)", marginTop: -14 }}></div> : null}
                  </div>;
                })}
              </div>
              {/* Details grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "8px 10px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700 }}>{"CLIENT"}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{d.cl || "?"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{"BL: " + (d.bl || "?")}</div>
                </div>
                <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "8px 10px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700 }}>{"TRANSPORT"}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{tc.ch || "Non assigne"}</div>
                  {tc.cm ? <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{tc.cm}</div> : null}
                </div>
                <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "8px 10px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700 }}>{"COMPAGNIE"}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{d.cp || "---"}</div>
                  {d.cr ? <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{d.cr}</div> : null}
                </div>
              </div>
              {/* Editable dates */}
              {canEdit ? <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>{"Dates du mouvement"}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[
                    { k: "dsp", lbl: "Chargement", show: PL.indexOf(tc.st) >= 2 },
                    { k: "dtk", lbl: "Sortie DK", show: PL.indexOf(tc.st) >= 3 },
                    { k: "dak", lbl: "Arr. Kati", show: PL.indexOf(tc.st) >= 4 },
                    { k: "dab", lbl: "Arr. Bamako", show: PL.indexOf(tc.st) >= 5 },
                    { k: "dr", lbl: "Retour", show: PL.indexOf(tc.st) >= 6 }
                  ].filter(function (f) { return f.show; }).map(function (f) {
                    return <div key={f.k} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>{f.lbl}</span>
                      <input type="date" value={tc[f.k] || ""} onChange={function (e) { updateTcDate(tc.id, f.k, e.target.value); }} style={{ border: "none", fontSize: 11, color: "var(--text-primary)", fontWeight: 600, padding: 0, width: 110, background: "transparent" }} />
                    </div>;
                  })}
                </div>
              </div> : null}
              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tc.st === "ATTENDU" ? <button onClick={function () { setAdvPending({ tid: tc.id, ns: "PORT", dt: today() }); }} style={{ background: "var(--info)", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>{"\u26F5 Arrive au port"}</button> : null}
                {tc.st === "PORT" && (d.pn || d.as2 === "OBTENU") ? <button onClick={function () { setMl({ t: "disp", tid: tc.id }); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>{"Dispatcher"}</button> : null}
                {tc.st === "PORT" && !d.pn && d.as2 !== "OBTENU" ? <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600, padding: "8px 0" }}>{"BAE / Pregate requis avant dispatch"}</span> : null}
                {tc.st !== "PORT" && tc.st !== "ATTENDU" && nx.length > 0 ? <select value="" onChange={function (e) { if (e.target.value) setAdvPending({ tid: tc.id, ns: e.target.value, dt: today() }); }} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, cursor: "pointer", minHeight: 44 }}><option value="">{"Avancer \u2192"}</option>{nx.map(function (s) { return <option key={s} value={s}>{SL[s] || s}</option>; })}</select> : null}
                <button onClick={function () { setMl({ t: "det", did: d.id }); }} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-tertiary)", minHeight: 44 }}>{"Voir dossier"}</button>
              </div>
            </div> : null}
          </div>;
        })}
        {filtered.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{qrCh || qrCl ? "Aucun conteneur pour ce filtre" : "Aucun conteneur"}</div> : null}
        <div style={{ background: "var(--bg-tertiary)", padding: "8px 12px", fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
          {String(filtered.length) + " conteneur(s) \u00B7 " + String(tcs.filter(function (t) { return t.st === "ATTENDU"; }).length) + " attendu(s) \u00B7 " + String(tcs.filter(function (t) { return t.st === "PORT"; }).length) + " au port \u00B7 " + String(tcs.filter(function (t) { return t.st === "DISPATCHE" || t.st === "TRANSIT"; }).length) + " en route"}
        </div>
      </div>
      ) : null}
      {view === "table" ? <Pagination page={pg.page} setPage={pg.setPage} totalPages={pg.totalPages} total={pg.total} /> : null}
    </div>
  );
}

export default Tcs;
