import { useState, useEffect } from 'react';
import { fd, fm, tcSum } from '../utils/format.js';
import { DBG, DC, DL } from '../constants/statuts.js';
import { exportDossiers } from '../utils/export.js';
import Pagination from '../components/ui/Pagination.tsx';
import EmptyState from '../components/ui/EmptyState.tsx';
import ClickableDiv from '../components/ui/ClickableDiv.tsx';

interface DosProps { [key: string]: any; }

function Dos(p: DosProps) {
  var dos = p.dos;
  var tcs = p.tcs;
  var dep = p.dep;
  var canEdit = p.canEdit;
  var enCours = p.enCours;
  var nCloture = p.nCloture;
  var dosFilter = p.dosFilter;
  var setDosFilter = p.setDosFilter;
  var dosView = p.dosView;
  var setDosView = p.setDosView;
  var qr = p.qr;
  var setQr = p.setQr;
  var om = p.om;
  var setOm = p.setOm;
  var setMl = p.setMl;
  var archiveDos = p.archiveDos;
  var deleteDos = p.deleteDos;
  var bulkDeleteDos = p.bulkDeleteDos;
  var companyName = p.companyName || "";

  var filtCl = p.filtCl !== undefined ? p.filtCl : "";
  var setFiltCl = p.setFiltCl || function () {};
  var [filtCp, setFiltCp] = useState("");
  var [pendingDel, setPendingDel] = useState(null);
  var [selectedIds, setSelectedIds] = useState([]);
  var [bulkConfirm, setBulkConfirm] = useState(false);
  var [dosPage, setDosPage] = useState(1);
  var [sortBy, setSortBy] = useState("priorite");
  var [sortDir, setSortDir] = useState("asc");

  function toggleSort(col) {
    if (sortBy === col) { setSortDir(sortDir === "asc" ? "desc" : "asc"); }
    else { setSortBy(col); setSortDir("asc"); }
    setDosPage(1);
  }

  useEffect(function () { setFiltCl(""); setFiltCp(""); setSelectedIds([]); setBulkConfirm(false); setDosPage(1); setSortBy("priorite"); setSortDir("asc"); }, [dosFilter]);
  useEffect(function () { setDosPage(1); }, [qr, filtCl, filtCp]);

  function toggleSelect(e, id) {
    e.stopPropagation();
    setSelectedIds(function (prev) {
      return prev.indexOf(id) >= 0 ? prev.filter(function (x) { return x !== id; }) : prev.concat([id]);
    });
  }

  var clients = dos.map(function (d) { return d.cl || ""; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
  var compagnies = dos.map(function (d) { return d.cp || ""; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();

  return (
    <div onClick={function () { setOm(null); }}>
      {/* TOOLBAR */}
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", padding: "10px 14px", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, borderBottom: dosView === "table" ? "none" : undefined, borderRadius: dosView === "table" ? "12px 12px 0 0" : 12 }}>
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {[
            { k: "all", lab: "Tous", count: dos.length },
            { k: "actif", lab: "Actifs", count: enCours },
            { k: "cloture", lab: "Clôturés", count: nCloture },
            { k: "archive", lab: "Archives", count: dos.filter(function (d: any) { return d.st === "ARCHIVE"; }).length },
          ].map(function (f) {
            var active = dosFilter === f.k;
            return <button key={f.k} onClick={function () { setDosFilter(f.k); setQr(""); }} style={{
              padding: "7px 14px", borderRadius: "var(--radius, 8px)", fontSize: 13, cursor: "pointer",
              background: active ? "var(--btn-primary-bg)" : "transparent",
              color: active ? "var(--btn-primary-text)" : "var(--text-muted)",
              fontWeight: active ? 600 : 500,
              border: "none", fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
            }}>{f.lab}<span style={{ opacity: 0.7, marginLeft: 6 }}>{"(" + String(f.count) + ")"}</span></button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input className="lt-search" value={qr} onChange={function (e) { setQr(e.target.value); }} placeholder="Rechercher client, BL..." style={{
              border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px 6px 30px", fontSize: 13, width: 180, outline: "none", minHeight: 44
            }} />
            <span style={{ position: "absolute", left: 10, top: 8, fontSize: 13, color: "var(--text-muted)" }}>{"\uD83D\uDD0D"}</span>
          </div>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <button onClick={function () { setDosView("table"); }} style={{ padding: "5px 10px", border: "none", cursor: "pointer", fontSize: 14, background: dosView === "table" ? "var(--btn-primary-bg)" : "var(--bg-primary)", color: dosView === "table" ? "var(--btn-primary-text)" : "var(--text-muted)" }}>{"\u2630"}</button>
            <button onClick={function () { setDosView("cards"); }} style={{ padding: "5px 10px", border: "none", cursor: "pointer", fontSize: 14, background: dosView === "cards" ? "var(--btn-primary-bg)" : "var(--bg-primary)", color: dosView === "cards" ? "var(--btn-primary-text)" : "var(--text-muted)" }}>{"\u25A6"}</button>
          </div>
          {canEdit ? <button onClick={function () { setMl({ t: "ndos" }); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{"+ Nouveau"}</button> : null}
          {canEdit ? <button className="lt-hide-mobile" onClick={function () { setMl({ t: "import" }); }} style={{ background: "transparent", color: "var(--btn-primary-bg)", border: "2px solid var(--btn-primary-bg)", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{"\uD83D\uDCC1"}</button> : null}
          <button className="lt-hide-mobile" onClick={function () { exportDossiers(dos, tcs, dep, companyName); }} title="Exporter Excel" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}><span style={{ color: "var(--success)", marginRight: 3, fontWeight: 700 }}>{"↓"}</span>{"Excel"}</button>
        </div>
      </div>

      {/* Barre de sélection multiple */}
      {selectedIds.length > 0 ? (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderTop: "none", padding: "8px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!bulkConfirm ? (
            <>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--danger-text)" }}>
                {String(selectedIds.length) + " dossier" + (selectedIds.length > 1 ? "s" : "") + " selectionne" + (selectedIds.length > 1 ? "s" : "")}
              </span>
              <button onClick={function () { setBulkConfirm(true); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {"\uD83D\uDDD1 Supprimer " + String(selectedIds.length) + " dossier" + (selectedIds.length > 1 ? "s" : "")}
              </button>
              <button onClick={function () { setSelectedIds([]); }} style={{ background: "none", border: "1px solid var(--danger-border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>{"✕ Annuler"}</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--danger-text)" }}>
                {"Supprimer " + String(selectedIds.length) + " dossier" + (selectedIds.length > 1 ? "s" : "") + " et tous leurs TCs / depenses ?"}
              </span>
              <button onClick={function () { bulkDeleteDos(selectedIds); setSelectedIds([]); setBulkConfirm(false); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{"Confirmer la suppression"}</button>
              <button onClick={function () { setBulkConfirm(false); }} style={{ background: "none", border: "1px solid var(--danger-border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>{"Annuler"}</button>
            </>
          )}
        </div>
      ) : null}

      {/* Filtres client + compagnie */}
      {(clients.length > 1 || compagnies.length > 1) ? (
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderTop: "none", padding: "8px 14px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{"Filtrer :"}</span>
          {clients.length > 1 ? (
            <select value={filtCl} onChange={function (e) { setFiltCl(e.target.value); }} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", background: filtCl ? "var(--btn-primary-bg)" : "var(--bg-primary)", color: filtCl ? "var(--btn-primary-text)" : "var(--text-input)", cursor: "pointer" }}>
              <option value={""}>{"Tous clients"}</option>
              {clients.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
            </select>
          ) : null}
          {compagnies.length > 1 ? (
            <select value={filtCp} onChange={function (e) { setFiltCp(e.target.value); }} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", background: filtCp ? "var(--btn-primary-bg)" : "var(--bg-primary)", color: filtCp ? "var(--btn-primary-text)" : "var(--text-input)", cursor: "pointer" }}>
              <option value={""}>{"Toutes compagnies"}</option>
              {compagnies.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
            </select>
          ) : null}
          {(filtCl || filtCp) ? <button onClick={function () { setFiltCl(""); setFiltCp(""); }} style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>{"✕ Effacer"}</button> : null}
        </div>
      ) : null}

      {(function () {
        var filt = dos.filter(function (d) {
          if (dosFilter === "actif" && (d.st === "CLOTURE" || d.st === "ARCHIVE")) return false;
          if (dosFilter === "cloture" && d.st !== "CLOTURE") return false;
          if (dosFilter === "archive" && d.st !== "ARCHIVE") return false;
          if (filtCl && d.cl !== filtCl) return false;
          if (filtCp && d.cp !== filtCp) return false;
          if (qr) {
            var q = qr.toLowerCase();
            return (d.cl || "").toLowerCase().indexOf(q) >= 0 || (d.bl || "").toLowerCase().indexOf(q) >= 0 || (d.cp || "").toLowerCase().indexOf(q) >= 0 || (d.cr || "").toLowerCase().indexOf(q) >= 0;
          }
          return true;
        }).slice().sort(function (a, b) {
          // Tri configurable par colonne
          if (sortBy !== "priorite") {
            var va, vb, cmp;
            if (sortBy === "cl") { va = (a.cl || "").toLowerCase(); vb = (b.cl || "").toLowerCase(); cmp = va.localeCompare(vb); }
            else if (sortBy === "bl") { va = (a.bl || "").toLowerCase(); vb = (b.bl || "").toLowerCase(); cmp = va.localeCompare(vb); }
            else if (sortBy === "cp") { va = (a.cp || "").toLowerCase(); vb = (b.cp || "").toLowerCase(); cmp = va.localeCompare(vb); }
            else if (sortBy === "da") { va = a.da || ""; vb = b.da || ""; cmp = va.localeCompare(vb); }
            else if (sortBy === "st") { va = a.st || ""; vb = b.st || ""; cmp = va.localeCompare(vb); }
            else if (sortBy === "dep") {
              var aDep = dep.filter(function (f) { return f.did === a.id; }).reduce(function (s, f) { return s + (f.mt || 0); }, 0);
              var bDep = dep.filter(function (f) { return f.did === b.id; }).reduce(function (s, f) { return s + (f.mt || 0); }, 0);
              cmp = aDep - bDep;
            }
            else if (sortBy === "marge") {
              var aDepM = dep.filter(function (f) { return f.did === a.id; }).reduce(function (s, f) { return s + (f.mt || 0); }, 0);
              var bDepM = dep.filter(function (f) { return f.did === b.id; }).reduce(function (s, f) { return s + (f.mt || 0); }, 0);
              cmp = ((a.rv || 0) - aDepM) - ((b.rv || 0) - bDepM);
            }
            else { cmp = 0; }
            return sortDir === "asc" ? cmp : -cmp;
          }
          // Score continu : plus bas = plus urgent
          function sc(d) {
            var dtcs = tcs.filter(function (c) { return c.did === d.id; });
            var allAttendu = dtcs.length > 0 && dtcs.every(function (c) { return c.st === "ATTENDU"; });
            if (allAttendu) return 1500 + (d.da ? Math.abs(Math.floor((new Date(d.da).getTime() - new Date().getTime()) / 864e5)) : 0);
            var atPort = dtcs.some(function (c) { return c.st === "PORT"; });
            var inTransit = dtcs.some(function (c) { return c.st !== "PORT" && c.st !== "ATTENDU" && c.st !== "RETURNED"; });
            var daysSince = 0;
            if (d.da) {
              var ad = new Date(d.da); ad.setHours(0, 0, 0, 0);
              var td = new Date(); td.setHours(0, 0, 0, 0);
              daysSince = Math.floor((td.getTime() - ad.getTime()) / 864e5);
            }
            if (d.st === "CLOTURE" || d.st === "ARCHIVE") return 6000;
            if (atPort && daysSince >= 0) {
              if (d.bv) {
                var bvd = new Date(d.bv); bvd.setHours(0, 0, 0, 0);
                var now = new Date(); now.setHours(0, 0, 0, 0);
                var bvr = Math.floor((bvd.getTime() - now.getTime()) / 864e5);
                if (bvr <= 0) return 100 - daysSince;
                if (bvr <= 3) return 200 - daysSince;
              }
              if (daysSince > 10) return 300 - daysSince;
              if (d.bs !== "OBTENU" || d.as2 !== "OBTENU" || !d.pn) return 400 - daysSince;
              return 500 - daysSince;
            }
            if (inTransit) return 1000 - daysSince;
            if (atPort && daysSince < 0) {
              var daysUntil = Math.abs(daysSince);
              if (d.bs !== "OBTENU" || d.as2 !== "OBTENU" || !d.pn) return 1200 + daysUntil;
              return 1400 + daysUntil;
            }
            if (dtcs.length > 0) return 1600;
            return 2000 - daysSince;
          }
          var sa = sc(a);
          var sb = sc(b);
          if (sa !== sb) return sa - sb;
          return (a.da || "").localeCompare(b.da || "");
        });

        var allSelected = canEdit && filt.length > 0 && filt.every(function (d) { return selectedIds.indexOf(d.id) >= 0; });

        var filtDepTot = 0; var filtImpTot = 0; var filtRvTot = 0;
        filt.forEach(function (d) {
          filtRvTot += (d.rv || 0);
          var dd = dep.filter(function (f) { return f.did === d.id; });
          dd.forEach(function (f) { filtDepTot += (f.mt || 0); if (f.s !== "PAYE") filtImpTot += (f.mt || 0); });
        });
        var filtMargeTot = filtRvTot - filtDepTot;

        var perPage = 20;
        var totalPages = Math.max(1, Math.ceil(filt.length / perPage));
        var safePage = Math.min(dosPage, totalPages);
        var paginated = filt.slice((safePage - 1) * perPage, safePage * perPage);

        return <div>
          {/* TABLE VIEW */}
          {dosView === "table" ? (
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "0 0 12px 12px", overflow: "hidden", borderTop: "none" }}>
              {/* Table header - desktop */}
              <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "30px 1.8fr 1.3fr 1fr 0.8fr 0.5fr 1.1fr 0.9fr 0.7fr 0.7fr 60px 80px 40px", gap: 0, background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                <div style={{ padding: "8px 4px 8px 10px" }}>
                  {canEdit && selectedIds.length > 0 ? <input type="checkbox" checked={allSelected} onChange={function (e) { e.stopPropagation(); setSelectedIds(e.target.checked ? filt.map(function (d) { return d.id; }) : []); }} style={{ cursor: "pointer" }} /> : null}
                </div>
                {[
                  { l: "Client", k: "cl" }, { l: "N\u00B0 BL", k: "bl" }, { l: "Compagnie", k: "cp" },
                  { l: "Arriv\u00E9e", k: "da" }, { l: "TC", k: null }, { l: "Dépenses", k: "dep" },
                  { l: "Paye", k: null }, { l: "Impaye", k: null }, { l: "Marge", k: "marge" }, { l: "Docs", k: null },
                  { l: "Statut", k: "st" }, { l: "", k: null }
                ].map(function (h) {
                  var arrow = h.k && sortBy === h.k ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";
                  var isActive = h.k && sortBy === h.k;
                  return <div key={h.l || "actions"} onClick={h.k ? function () { toggleSort(h.k); } : undefined} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, cursor: h.k ? "pointer" : "default", userSelect: "none" }}>{h.l + arrow}</div>;
                })}
                {sortBy !== "priorite" ? <div style={{ gridColumn: "1 / -1", background: "var(--info-bg)", padding: "4px 14px", fontSize: 11, color: "var(--info)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--info-border)" }}>
                  <span>{"Tri : " + sortBy.toUpperCase() + " " + (sortDir === "asc" ? "\u2191" : "\u2193")}</span>
                  <button onClick={function () { setSortBy("priorite"); setSortDir("asc"); }} style={{ background: "none", border: "none", color: "var(--info)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{"Revenir au tri par priorite"}</button>
                </div> : null}
              </div>
              {paginated.map(function (d) {
                var dtcs = tcs.filter(function (c) { return c.did === d.id; });
                var ddep = dep.filter(function (f) { return f.did === d.id; });
                var dTot = ddep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
                var dPay = ddep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
                var dImp = dTot - dPay;
                var dPct = dTot > 0 ? Math.round(dPay / dTot * 100) : 0;
                var isOpen = om === d.id;
                var isChecked = selectedIds.indexOf(d.id) >= 0;
                return <div key={d.id} style={{ borderBottom: "1px solid var(--border-light)", position: "relative", background: isChecked ? "var(--danger-bg)" : "transparent" }}>
                  {/* Desktop row */}
                  <ClickableDiv onClick={function () { setMl({ t: "det", did: d.id }); }} label={"Ouvrir dossier " + (d.cl || "") + " " + (d.bl || "")} className="lt-hide-mobile lt-dos-row" style={{ display: "grid", gridTemplateColumns: "30px 1.8fr 1.3fr 1fr 0.8fr 0.5fr 1.1fr 0.9fr 0.7fr 0.7fr 60px 80px 40px", gap: 0, alignItems: "center", background: isOpen ? "var(--bg-tertiary)" : "transparent" }}>
                    <div className={"lt-row-check" + (isChecked ? " is-checked" : "")} style={{ padding: "10px 4px 10px 10px" }} onClick={function (e) { e.stopPropagation(); }}>
                      {canEdit ? <input type="checkbox" checked={isChecked} onChange={function (e) { toggleSelect(e, d.id); }} style={{ cursor: "pointer" }} /> : null}
                    </div>
                    <div style={{ padding: "10px 10px", fontWeight: 700, fontSize: 13 }}>{d.cl || "?"}</div>
                    <div style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{d.bl || ""}</div>
                    <div style={{ padding: "10px 8px", fontSize: 11, color: "var(--text-secondary)" }}>{d.cp || "---"}</div>
                    <div style={{ padding: "10px 8px", fontSize: 11, color: d.da ? "var(--text-primary)" : "var(--text-muted)", fontWeight: d.da ? 600 : 400 }}>{d.da ? fd(d.da) : "---"}</div>
                    <div style={{ padding: "10px 10px", textAlign: "center" }}>
                      <span style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", padding: "2px 7px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{String(dtcs.length)}</span>
                    </div>
                    <div style={{ padding: "10px 10px", fontWeight: 600, fontSize: 12 }}>{dTot > 0 ? fm(dTot) : "---"}</div>
                    <div style={{ padding: "10px 6px" }}>
                      {dTot > 0 ? <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 6, minWidth: 30 }}>
                          <div style={{ width: dPct + "%", height: 4, background: dPct === 100 ? "var(--success)" : "var(--warning)", borderRadius: 6 }}></div>
                        </div>
                        <span style={{ fontSize: 10, color: dPct === 100 ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>{String(dPct) + "%"}</span>
                      </div> : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{"---"}</span>}
                    </div>
                    <div style={{ padding: "10px 10px", fontWeight: 700, color: dImp > 0 ? "var(--danger)" : "var(--success)", fontSize: 12 }}>{dImp > 0 ? fm(dImp) : dTot > 0 ? "\u2713" : "---"}</div>
                    {(function () { var dMarge = (d.rv || 0) - dTot; var hasRv = (d.rv || 0) > 0; return <div style={{ padding: "10px 6px", fontWeight: 700, fontSize: 11, color: !hasRv ? "var(--text-muted)" : dMarge >= 0 ? "var(--success)" : "var(--danger)" }}>{hasRv ? fm(dMarge) : "---"}</div>; })()}
                    <div style={{ padding: "10px 6px" }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        <span title="BAD" style={{ width: 8, height: 8, borderRadius: 999, display: "inline-block", background: d.bs === "OBTENU" ? "var(--success)" : d.bs === "EN_COURS" ? "var(--warning)" : "var(--danger)" }}></span>
                        <span title="BAE" style={{ width: 8, height: 8, borderRadius: 999, display: "inline-block", background: d.as2 === "OBTENU" || d.pn ? "var(--success)" : d.as2 === "EN_COURS" ? "var(--warning)" : "var(--danger)" }}></span>
                      </div>
                    </div>
                    <div style={{ padding: "10px 6px" }}>
                      <span style={{ background: DBG[d.st] || "var(--bg-secondary)", color: DC[d.st] || "var(--text-secondary)", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.005em", border: "1px solid var(--border)" }}>{DL[d.st] || "?"}</span>
                    </div>
                    <div style={{ padding: "10px 6px", textAlign: "center" }}>
                      {canEdit ? <button onClick={function (e) { e.stopPropagation(); setOm(isOpen ? null : d.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", padding: 4 }}>{"\u22EE"}</button> : null}
                    </div>
                  </ClickableDiv>
                  {/* Mobile row - card style */}
                  <div className="lt-show-mobile" style={{ display: "none", padding: "10px 12px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <ClickableDiv onClick={function () { setMl({ t: "det", did: d.id }); }} label={"Ouvrir dossier " + (d.cl || "") + " " + (d.bl || "")} style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{d.cl || "?"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{(d.bl || "") + (d.cp ? " | " + d.cp : "") + (d.da ? " | " + fd(d.da) : "") + " | " + (dtcs.length > 0 ? tcSum(dtcs) : "0 TC")}</div>
                      </ClickableDiv>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ background: DBG[d.st] || "var(--bg-secondary)", color: DC[d.st] || "var(--text-secondary)", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.005em", border: "1px solid var(--border)" }}>{DL[d.st] || "?"}</span>
                        {/* eslint-disable-next-line no-restricted-syntax -- WhatsApp brand green (couleur officielle) */}
                        {d.ct ? <a href={"https://wa.me/" + d.ct.replace(/[^0-9+]/g, "") + "?text=" + encodeURIComponent("Bonjour " + (d.cl || "client") + ",\n\nSuivi de votre dossier BL " + (d.bl || "") + " (" + String(dtcs.length) + " conteneur" + (dtcs.length > 1 ? "s" : "") + ").\n\nStatut : " + (DL[d.st] || d.st) + (dtcs.length > 0 ? "\n\nConteneur(s) :\n" + dtcs.map(function (tc) { return "- " + (tc.n || "?") + " (" + (tc.ty || "") + ")"; }).join("\n") : "") + "\n\nCordialement")} target="_blank" rel="noopener noreferrer" onClick={function (e) { e.stopPropagation(); }} style={{ background: "#25D366", color: "white", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44 }}>{"\uD83D\uDCF1"}</a> : null}
                        {canEdit ? <button onClick={function (e) { e.stopPropagation(); setOm(isOpen ? null : d.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", padding: "4px 2px", minHeight: 44, minWidth: 32 }}>{"\u22EE"}</button> : null}
                      </div>
                    </div>
                    {dTot > 0 ? <ClickableDiv onClick={function () { setMl({ t: "det", did: d.id }); }} label="Voir details financiers" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{fm(dTot)}</span>
                      <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 6 }}><div style={{ width: dPct + "%", height: 3, background: dPct === 100 ? "var(--success)" : "var(--warning)", borderRadius: 6 }}></div></div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: dPct === 100 ? "var(--success)" : "var(--warning)" }}>{String(dPct) + "%"}</span>
                    </ClickableDiv> : null}
                  </div>
                  {/* Context menu */}
                  {isOpen ? <div onClick={function (e) { e.stopPropagation(); }} style={{ position: "absolute", right: 8, top: 40, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 16px var(--shadow-lg)", zIndex: 50, minWidth: 200, overflow: "hidden" }}>
                    <ClickableDiv onClick={function () { setOm(null); setMl({ t: "det", did: d.id }); }} label="Voir details" style={{ padding: "12px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-light)", minHeight: 44 }}><span style={{ fontSize: 15 }}>{"\uD83D\uDCC4"}</span>{"Details"}</ClickableDiv>
                    <ClickableDiv onClick={function () { setOm(null); setMl({ t: "edos", did: d.id }); }} label="Modifier dossier" style={{ padding: "12px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-light)", minHeight: 44 }}><span style={{ fontSize: 15 }}>{"\u270F\uFE0F"}</span>{"Modifier"}</ClickableDiv>
                    <ClickableDiv onClick={function () { setOm(null); setMl({ t: "jdoc", did: d.id }); }} label="Joindre documents" style={{ padding: "12px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-light)", minHeight: 44 }}><span style={{ fontSize: 15 }}>{"\uD83D\uDCCE"}</span>{"Documents"}</ClickableDiv>
                    {/* eslint-disable-next-line no-restricted-syntax -- WhatsApp brand green (couleur officielle) */}
                    {d.ct ? <a href={"https://wa.me/" + d.ct.replace(/[^0-9+]/g, "") + "?text=" + encodeURIComponent("Bonjour " + (d.cl || "client") + ",\n\nSuivi de votre dossier BL " + (d.bl || "") + " (" + String(dtcs.length) + " conteneur" + (dtcs.length > 1 ? "s" : "") + ").\n\nStatut : " + (DL[d.st] || d.st) + (dtcs.length > 0 ? "\n\nConteneur(s) :\n" + dtcs.map(function (tc) { return "- " + (tc.n || "?") + " (" + (tc.ty || "") + ")"; }).join("\n") : "") + "\n\nCordialement")} target="_blank" rel="noopener noreferrer" onClick={function () { setOm(null); }} style={{ padding: "12px 14px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-light)", minHeight: 44, color: "#25D366", textDecoration: "none" }}><span style={{ fontSize: 15 }}>{"\uD83D\uDCF1"}</span>{"WhatsApp client"}</a> : null}
                    {d.st === "CLOTURE" ? <ClickableDiv onClick={function () { archiveDos(d.id); }} label="Archiver le dossier" style={{ padding: "12px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-light)", minHeight: 44 }}><span style={{ fontSize: 15 }}>{"\uD83D\uDCE6"}</span>{"Archiver"}</ClickableDiv> : null}
                    {pendingDel === d.id ? (
                      <div style={{ padding: "10px 14px", background: "var(--danger-bg)" }}>
                        <div style={{ fontSize: 12, color: "var(--danger-text)", fontWeight: 700, marginBottom: 8 }}>{"Supprimer ce dossier et tous ses TCs / depenses ?"}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={function () { setPendingDel(null); setOm(null); deleteDos(d.id); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{"Oui, supprimer"}</button>
                          <button onClick={function () { setPendingDel(null); }} style={{ background: "var(--bg-secondary)", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>{"Annuler"}</button>
                        </div>
                      </div>
                    ) : (
                      <ClickableDiv onClick={function () { setPendingDel(d.id); }} stopPropagation label="Supprimer le dossier" style={{ padding: "12px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 10, color: "var(--danger)", minHeight: 44 }}><span style={{ fontSize: 15 }}>{"\uD83D\uDDD1\uFE0F"}</span>{"Supprimer"}</ClickableDiv>
                    )}
                  </div> : null}
                </div>;
              })}
              {/* Footer totals */}
              <div className="lt-hide-mobile" style={{ padding: "10px 14px", background: "var(--bg-tertiary)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
                <span>{String(filt.length) + " dossier(s)"}</span>
                <span>{"Total: "}<strong style={{ color: "var(--text-primary)" }}>{fm(filtDepTot)}</strong>{" \u2014 Impaye: "}<strong style={{ color: "var(--danger)" }}>{fm(filtImpTot)}</strong>{filtRvTot > 0 ? " \u2014 Marge: " : ""}{filtRvTot > 0 ? <strong style={{ color: filtMargeTot >= 0 ? "var(--success)" : "var(--danger)" }}>{fm(filtMargeTot)}</strong> : null}</span>
              </div>
            </div>
          ) : null}

          {/* CARDS VIEW */}
          {dosView === "cards" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginTop: 10 }}>
              {paginated.map(function (d) {
                var dtcs = tcs.filter(function (c) { return c.did === d.id; });
                var ddep = dep.filter(function (f) { return f.did === d.id; });
                var dTot = ddep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
                var dPay = ddep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
                var dImp = dTot - dPay;
                var dPct = dTot > 0 ? Math.round(dPay / dTot * 100) : 0;
                var isCardSelected = selectedIds.indexOf(d.id) >= 0;
                return <div key={d.id} className="lt-dos-card" onClick={function () { setMl({ t: "det", did: d.id }); }} style={{
                  background: "var(--bg-primary)", border: isCardSelected ? "2px solid var(--danger)" : "1px solid var(--border)", borderRadius: 12, padding: isCardSelected ? 13 : 14, cursor: "pointer"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{d.cl || "?"}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{d.bl || ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {canEdit ? <span className={"lt-card-check" + (isCardSelected ? " is-checked" : "")}><input type="checkbox" checked={isCardSelected} onChange={function (e) { toggleSelect(e, d.id); }} onClick={function (e) { e.stopPropagation(); }} style={{ cursor: "pointer", width: 16, height: 16, flexShrink: 0, display: "block" }} /></span> : null}
                      <span style={{ background: DBG[d.st] || "var(--bg-secondary)", color: DC[d.st] || "var(--text-secondary)", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{DL[d.st] || "?"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>{(d.cp || "---") + " \u2022 " + (d.da ? fd(d.da) : "---")}</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{"TC"}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{String(dtcs.length)}</div>
                    </div>
                    <div style={{ flex: 2, background: "var(--bg-tertiary)", borderRadius: 6, padding: "6px 8px" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{"DÉPENSES"}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{dTot > 0 ? fm(dTot) : "---"}</div>
                    </div>
                    <div style={{ flex: 1, background: dImp > 0 ? "var(--danger-bg)" : "var(--success-bg)", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{"IMPAYE"}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: dImp > 0 ? "var(--danger)" : "var(--success)" }}>{dImp > 0 ? fm(dImp) : dTot > 0 ? "\u2713" : "---"}</div>
                    </div>
                    {(d.rv || 0) > 0 ? <div style={{ flex: 1, background: (d.rv || 0) - dTot >= 0 ? "var(--success-bg)" : "var(--danger-bg)", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{"MARGE"}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: (d.rv || 0) - dTot >= 0 ? "var(--success)" : "var(--danger)" }}>{fm((d.rv || 0) - dTot)}</div>
                    </div> : null}
                  </div>
                  {dTot > 0 ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 6 }}>
                      <div style={{ width: dPct + "%", height: 4, background: dPct === 100 ? "var(--success)" : "var(--warning)", borderRadius: 6 }}></div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: dPct === 100 ? "var(--success)" : "var(--warning)" }}>{String(dPct) + "%"}</span>
                    <div style={{ display: "flex", gap: 3, marginLeft: 4 }}>
                      <span title="BAD" style={{ width: 8, height: 8, borderRadius: 999, display: "inline-block", background: d.bs === "OBTENU" ? "var(--success)" : "var(--danger)" }}></span>
                      <span title="BAE" style={{ width: 8, height: 8, borderRadius: 999, display: "inline-block", background: d.as2 === "OBTENU" || d.pn ? "var(--success)" : "var(--danger)" }}></span>
                    </div>
                  </div> : null}
                </div>;
              })}
            </div>
          ) : null}

          {totalPages > 1 ? <Pagination page={safePage} setPage={setDosPage} totalPages={totalPages} total={filt.length} /> : null}

          {filt.length === 0 ? (
            <div style={{ marginTop: 10 }}>
              <EmptyState
                icon={"\uD83D\uDCCB"}
                title={qr || filtCl || filtCp ? "Aucun r\u00E9sultat" : (dosFilter === "cloture" ? "Aucun dossier cl\u00F4tur\u00E9" : dosFilter === "archive" ? "Aucun dossier archiv\u00E9" : "Aucun dossier")}
                description={qr || filtCl || filtCp ? "Modifiez vos filtres pour voir plus de r\u00E9sultats." : (dosFilter === "actif" ? "Tous vos dossiers actifs appara\u00EEtront ici." : "Cr\u00E9ez votre premier dossier pour d\u00E9marrer le suivi.")}
                action={canEdit && !qr && !filtCl && !filtCp && dosFilter !== "cloture" && dosFilter !== "archive" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={function () { setMl({ t: "ndos" }); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"+ Cr\u00E9er"}</button>
                    <button onClick={function () { setMl({ t: "import" }); }} style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"\uD83D\uDCC1 Importer Excel"}</button>
                  </div>
                ) : null}
              />
            </div>
          ) : null}
        </div>;
      })()}
    </div>
  );
}

export default Dos;
