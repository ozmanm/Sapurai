import { useState, useEffect, useRef } from 'react';
import { fm } from '../../utils/format.js';
import { DBG, DC, DL } from '../../constants/statuts.js';
import { DTL } from '../../constants/depenses.js';

interface TopBarProps {
  sideOpen: boolean;
  setSideOpen: (o: boolean) => void;
  gs: string;
  setGs: (s: string) => void;
  gsOpen: boolean;
  setGsOpen: (o: boolean) => void;
  dos: any[];
  tcs: any[];
  chs: any[];
  dep: any[];
  setMl: (ml: any) => void;
  critCount: number;
  urgences: any[];
  role: string;
  urgOpen: boolean;
  setUrgOpen: (o: boolean) => void;
}

function TopBar(p: TopBarProps) {
  var sideOpen = p.sideOpen;
  var setSideOpen = p.setSideOpen;
  var gs = p.gs;
  var setGs = p.setGs;
  var gsOpen = p.gsOpen;
  var setGsOpen = p.setGsOpen;
  var dos = p.dos;

  // Debounced search input
  var [localGs, setLocalGs] = useState(gs);
  var debounceRef = useRef(null);
  var searchInputRef = useRef<HTMLInputElement | null>(null);
  function onSearchChange(e) {
    var val = e.target.value;
    setLocalGs(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(function () {
      setGs(val);
      setGsOpen(val.length >= 2);
    }, 250);
  }
  useEffect(function () { setLocalGs(gs); }, [gs]);
  useEffect(function () { return function () { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  // Sprint E.5 : Cmd+K / Ctrl+K focus barre de recherche (handoff `d-search`)
  useEffect(function () {
    function onKey(e: KeyboardEvent) {
      var isMac = /Mac/i.test(navigator.platform);
      var modPressed = isMac ? e.metaKey : e.ctrlKey;
      if (modPressed && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
      if (e.key === "Escape" && gsOpen) {
        setGsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, [gsOpen]);
  var tcs = p.tcs;
  var chs = p.chs;
  var dep = p.dep;
  var setMl = p.setMl;
  var critCount = p.critCount;
  var urgences = p.urgences;
  var role = p.role;
  var urgOpen = p.urgOpen;
  var setUrgOpen = p.setUrgOpen;

  // Online/offline indicator
  var [online, setOnline] = useState(navigator.onLine);
  useEffect(function () {
    function goOn() { setOnline(true); }
    function goOff() { setOnline(false); }
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return function () { window.removeEventListener("online", goOn); window.removeEventListener("offline", goOff); };
  }, []);

  return (
    <div className="lt-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="lt-hamburger" aria-label="Ouvrir le menu" aria-expanded={sideOpen} onClick={function (e) { e.stopPropagation(); setSideOpen(!sideOpen); }}>{"\u2630"}</button>
        {!online ? <span style={{ background: "var(--danger-bg)", color: "var(--danger)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--danger-border)", whiteSpace: "nowrap" }}>{"Hors ligne"}</span> : null}
        <div style={{ position: "relative" }} role="search" onClick={function (e) { e.stopPropagation(); }}>
          <input ref={searchInputRef} className="lt-search" value={localGs} onChange={onSearchChange} onFocus={function () { if (gs.length >= 2) setGsOpen(true); }} placeholder="Rechercher (dossier, BL, client, TC, chauffeur)..." aria-label="Recherche globale" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 60px 8px 34px", fontSize: 13, color: "var(--text-primary)", width: 480, maxWidth: "100%", outline: "none", fontFamily: "var(--font-sans)" }} />
          <span style={{ position: "absolute", left: 10, top: 9, fontSize: 14, color: "var(--text-muted)" }}>{"\uD83D\uDD0D"}</span>
          {!localGs ? (
            <span aria-hidden="true" className="lt-hide-mobile" style={{ position: "absolute" as const, right: 10, top: 9, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", lineHeight: 1.2, fontWeight: 500 }}>
              {/Mac/i.test(navigator.platform) ? "\u2318K" : "Ctrl K"}
            </span>
          ) : null}
          {gsOpen && gs.length >= 2 ? (function () {
            var q = gs.toLowerCase();
            var rDos = dos.filter(function (d) { return (d.cl || "").toLowerCase().indexOf(q) >= 0 || (d.bl || "").toLowerCase().indexOf(q) >= 0 || (d.cp || "").toLowerCase().indexOf(q) >= 0 || (d.cr || "").toLowerCase().indexOf(q) >= 0 || (d.nd || "").toLowerCase().indexOf(q) >= 0; }).slice(0, 5);
            var rTcs = tcs.filter(function (c) { return (c.n || "").toLowerCase().indexOf(q) >= 0; }).slice(0, 5);
            var rChs = chs.filter(function (c) { return (c.nm || "").toLowerCase().indexOf(q) >= 0 || (c.cm || "").toLowerCase().indexOf(q) >= 0; }).slice(0, 3);
            var rDep = dep.filter(function (f) { return (f.nf || "").toLowerCase().indexOf(q) >= 0 || (DTL[f.tp] || "").toLowerCase().indexOf(q) >= 0; }).slice(0, 3);
            var total = rDos.length + rTcs.length + rChs.length + rDep.length;
            return <div style={{ position: "absolute", top: 44, left: 0, width: 400, maxWidth: "90vw", background: "var(--bg-primary)", borderRadius: 10, boxShadow: "0 8px 30px var(--shadow-lg)", border: "1px solid var(--border)", zIndex: 200, maxHeight: 400, overflow: "auto" }}>
              {total === 0 ? <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{"Aucun résultat"}</div> : null}
              {rDos.length > 0 ? <div><div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Dossiers"}</div>{rDos.map(function (d) { return <div key={d.id} onClick={function () { setMl({ t: "det", did: d.id }); setGsOpen(false); setGs(""); }} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.cl || "?"}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}><span style={{ color: "var(--text-secondary)", fontSize: 12, fontFamily: "var(--font-mono)" }}>{d.bl || ""}</span><span style={{ background: DBG[d.st] || "var(--bg-secondary)", color: DC[d.st] || "var(--text-secondary)", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{DL[d.st] || "?"}</span></div></div>; })}</div> : null}
              {rTcs.length > 0 ? <div><div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Conteneurs"}</div>{rTcs.map(function (c) { var d = dos.find(function (x) { return x.id === c.did; }); return <div key={c.id} onClick={function () { setMl({ t: "det", did: c.did }); setGsOpen(false); setGs(""); }} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{c.n || "?"}</div><div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>{c.ty + " | " + (d ? d.cl : "?")}</div></div>; })}</div> : null}
              {rChs.length > 0 ? <div><div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Chauffeurs"}</div>{rChs.map(function (c) { return <div key={c.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}><span style={{ fontWeight: 600 }}>{c.nm || "?"}</span><span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{c.cm || ""}</span>{c.bl ? <span style={{ color: "var(--danger)", marginLeft: 6, fontWeight: 700 }}>{"BL"}</span> : null}</div>; })}</div> : null}
              {rDep.length > 0 ? <div><div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Dépenses"}</div>{rDep.map(function (f) { return <div key={f.id} onClick={function () { setMl({ t: "det", did: f.did }); setGsOpen(false); setGs(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}><span style={{ fontWeight: 600 }}>{DTL[f.tp] || "?"}</span>{f.nf ? <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{"N\u00B0" + f.nf}</span> : null}<span style={{ float: "right", fontWeight: 700, color: "var(--danger)" }}>{fm(f.mt)}</span></div>; })}</div> : null}
            </div>;
          })() : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(critCount > 0 || urgences.length > 0) ? (
          <div style={{ position: "relative" }} onClick={function (e) { e.stopPropagation(); }}>
            <button
              onClick={function () { setUrgOpen(!urgOpen); }}
              style={{ background: critCount > 0 ? "var(--danger-bg)" : "var(--warning-bg)", color: critCount > 0 ? "var(--danger)" : "var(--warning)", borderRadius: 99, padding: "4px 10px", fontSize: 12, fontWeight: 600, border: "1px solid " + (critCount > 0 ? "var(--danger-border)" : "var(--warning-border)"), cursor: "pointer" }}
            >
              {critCount > 0 ? String(critCount) + " urgence(s)" : String(urgences.length) + " alerte(s)"}
            </button>
            {urgOpen ? (
              <div style={{ position: "absolute", top: 36, right: 0, width: 340, maxWidth: "90vw", background: "var(--bg-primary)", borderRadius: 12, boxShadow: "0 8px 30px var(--shadow-lg)", border: "1px solid var(--border)", zIndex: 200, maxHeight: 400, overflow: "auto" }}>
                <div style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{"Urgences & alertes"}</span>
                  <span style={{ background: critCount > 0 ? "var(--danger)" : "var(--warning)", color: "white", borderRadius: 99, padding: "1px 7px", fontSize: 11 }}>{String(urgences.length)}</span>
                </div>
                {urgences.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{"Aucune urgence"}</div>
                ) : urgences.map(function (u, i) {
                  return (
                    <div key={i} onClick={function () { setMl({ t: "det", did: u.did }); setUrgOpen(false); }} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: u.level === "critical" ? "var(--danger-text)" : "var(--warning-text)" }}>{u.msg}</div>
                        {u.sub ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{u.sub}</div> : null}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, background: u.level === "critical" ? "var(--danger-light)" : "var(--warning-bg)", color: u.level === "critical" ? "var(--danger)" : "var(--warning)", padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 2 }}>{u.level === "critical" ? "URGENT" : "ALERTE"}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {role ? <span className="lt-hide-mobile" style={{ background: role === "admin" ? "var(--danger-bg)" : role === "agent" ? "var(--info-bg)" : "var(--success-bg)", color: role === "admin" ? "var(--danger)" : role === "agent" ? "var(--info)" : "var(--success)", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{role === "admin" ? "Admin" : role === "agent" ? "Agent" : "Client"}</span> : null}
      </div>
    </div>
  );
}

export default TopBar;
