import { useState } from 'react';
import { DL } from '../constants/statuts.js';
import { DTL } from '../constants/depenses.js';
import { fm } from '../utils/format.js';

interface StatsProps { dos: any[]; tcs: any[]; dep: any[]; }

function Stats(p: StatsProps) {
  var dos = p.dos; var tcs = p.tcs; var dep = p.dep;
  var [per, setPer] = useState("all");

  // Palette chart (10 couleurs distinctes qui basculent light/dark via CSS vars)
  var PAL = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)", "var(--chart-9)", "var(--chart-10)"];

  function inPeriod(dt) {
    if (per === "all" || !dt) return true;
    var d = new Date(dt); var now = new Date();
    if (per === "month") { return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
    if (per === "quarter") { var q1 = Math.floor(now.getMonth() / 3); var q2 = Math.floor(d.getMonth() / 3); return q1 === q2 && d.getFullYear() === now.getFullYear(); }
    if (per === "year") { return d.getFullYear() === now.getFullYear(); }
    return true;
  }
  var fdos = dos.filter(function (d) { return inPeriod(d.da); });
  var fdep = dep.filter(function (f) { return inPeriod(f.dt); });

  var totalDos = fdos.length;
  var actifs = fdos.filter(function (d) { return d.st !== "CLOTURE" && d.st !== "ARCHIVE"; }).length;
  var clotures = fdos.filter(function (d) { return d.st === "CLOTURE" || d.st === "ARCHIVE"; }).length;
  var totalTTC = fdep.reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var totalHT = fdep.reduce(function (a, f) { return a + (f.ht || f.mt || 0); }, 0);
  var totalTax = totalTTC - totalHT;
  var paye = fdep.filter(function (f) { return f.s === "PAYE"; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
  var impaye = totalTTC - paye;
  var nTC = tcs.filter(function (c) { return fdos.some(function (d) { return d.id === c.did; }); }).length;

  var depByType = {};
  fdep.forEach(function (f) { var k = f.tp || "AUTRE"; depByType[k] = (depByType[k] || 0) + (f.mt || 0); });
  var typeKeys = Object.keys(depByType).sort(function (a, b) { return depByType[b] - depByType[a]; });
  var maxType = typeKeys.length > 0 ? depByType[typeKeys[0]] : 1;

  var dosByClient = {};
  fdos.forEach(function (d) { var cl = d.cl || "?"; dosByClient[cl] = (dosByClient[cl] || 0) + 1; });
  var clKeys = Object.keys(dosByClient).sort(function (a, b) { return dosByClient[b] - dosByClient[a]; });
  var maxCl = clKeys.length > 0 ? dosByClient[clKeys[0]] : 1;

  var dosBySt = {};
  fdos.forEach(function (d) { dosBySt[d.st] = (dosBySt[d.st] || 0) + 1; });

  var transitTimes = [];
  fdos.forEach(function (d) {
    if ((d.st === "CLOTURE" || d.st === "ARCHIVE") && d.da) {
      var dtcs2 = tcs.filter(function (c) { return c.did === d.id && c.dr; });
      if (dtcs2.length > 0) {
        var lastRet = dtcs2.reduce(function (mx, c) { var v = new Date(c.dr); return v > mx ? v : mx; }, new Date(0));
        var days = Math.floor((lastRet.getTime() - new Date(d.da).getTime()) / 864e5);
        if (days > 0 && days < 365) transitTimes.push(days);
      }
    }
  });
  var avgTransit = transitTimes.length > 0 ? Math.round(transitTimes.reduce(function (a, b) { return a + b; }, 0) / transitTimes.length) : 0;

  // Graphe d'evolution mensuelle : la fenetre temporelle suit le filtre `per`.
  // - month : 1 mois courant
  // - quarter : 3 mois (trimestre courant)
  // - year : 12 mois de l'annee courante
  // - all : 6 derniers mois (comportement legacy)
  var monthData = [];
  var mois = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
  var nowRef = new Date();
  var monthsToShow: Array<{ mm: number; yy: number }> = [];
  if (per === "year") {
    var curYear = nowRef.getFullYear();
    for (var ym = 0; ym < 12; ym++) monthsToShow.push({ mm: ym, yy: curYear });
  } else if (per === "quarter") {
    var qStart = Math.floor(nowRef.getMonth() / 3) * 3;
    for (var qm = 0; qm < 3; qm++) monthsToShow.push({ mm: qStart + qm, yy: nowRef.getFullYear() });
  } else if (per === "month") {
    monthsToShow.push({ mm: nowRef.getMonth(), yy: nowRef.getFullYear() });
  } else {
    // all : 6 derniers mois
    for (var mi = 5; mi >= 0; mi--) {
      var mdRef = new Date(); mdRef.setMonth(mdRef.getMonth() - mi);
      monthsToShow.push({ mm: mdRef.getMonth(), yy: mdRef.getFullYear() });
    }
  }
  monthsToShow.forEach(function (slot) {
    var cnt = dos.filter(function (d) { if (!d.da) return false; var dd = new Date(d.da); return dd.getMonth() === slot.mm && dd.getFullYear() === slot.yy; }).length;
    var depM = dep.filter(function (f) { if (!f.dt) return false; var dd = new Date(f.dt); return dd.getMonth() === slot.mm && dd.getFullYear() === slot.yy; }).reduce(function (a, f) { return a + (f.mt || 0); }, 0);
    monthData.push({ l: mois[slot.mm] + " " + String(slot.yy).slice(2), dos: cnt, dep: depM });
  });
  var maxMDos = Math.max.apply(null, monthData.map(function (m) { return m.dos; }).concat([1]));
  var maxMDep = Math.max.apply(null, monthData.map(function (m) { return m.dep; }).concat([1]));

  // Couleurs par type de depense, mapees sur les chart vars (theme-aware)
  var typeColors: Record<string, string> = { TRANSPORT: "var(--chart-1)", DPWORLD: "var(--chart-2)", DOUANE: "var(--chart-3)", SURESTARIES: "var(--chart-5)", DETENTIONS: "var(--chart-4)", LOCATION_TC: "var(--chart-6)", PREGATE: "var(--chart-10)", AUTRE: "var(--text-secondary)", MAGASINAGE: "var(--chart-7)", MANUTENTION: "var(--chart-8)", BILAN: "var(--chart-9)" };

  function Bar(props) {
    var pct = props.max > 0 ? Math.round(props.val / props.max * 100) : 0;
    return <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{ width: 70, minWidth: 50, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{props.label}</div>
      <div style={{ flex: 1, height: 22, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: props.color || "var(--chart-1)", borderRadius: 4, minWidth: pct > 0 ? 4 : 0 }} /></div>
      <div style={{ width: 70, minWidth: 50, fontSize: 11, fontWeight: 700, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{props.fmt || fm(props.val)}</div>
    </div>;
  }

  // Statuts dossier : reuse des tokens --dc-* qui existent deja (light/dark correct)
  var stColors: Record<string, string> = { INITIALISE: "var(--dc-initialise)", SECURISE: "var(--dc-securise)", EN_TRANSIT: "var(--dc-en_transit)", CLOTURE: "var(--dc-cloture)", ARCHIVE: "var(--dc-archive)" };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em", margin: 0, color: "var(--text-primary)" }}>{"Statistiques"}</h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{String(totalDos) + " dossiers · " + String(nTC) + " conteneurs · " + fm(totalTTC) + " FCFA depenses"}</div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[{ k: "month", l: "Ce mois" }, { k: "quarter", l: "Trimestre" }, { k: "year", l: "Annee" }, { k: "all", l: "Tout" }].map(function (p2) {
            return <button key={p2.k} onClick={function () { setPer(p2.k); }} style={{ background: per === p2.k ? "var(--btn-primary-bg)" : "transparent", color: per === p2.k ? "var(--btn-primary-text)" : "var(--text-tertiary)", border: per === p2.k ? "none" : "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 36 }}>{p2.l}</button>;
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"DOSSIERS"}</div><div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.02em" }}>{String(totalDos)}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{String(actifs) + " actifs | " + String(clotures) + " clos"}</div></div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"CONTENEURS"}</div><div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.02em", color: "var(--info)" }}>{String(nTC)}</div></div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"DEPENSES TTC"}</div><div style={{ fontSize: 16, fontWeight: 900, color: "var(--danger)" }}>{fm(totalTTC)}</div><div style={{ fontSize: 10, color: "var(--warning)" }}>{"Taxes: " + fm(totalTax)}</div></div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"IMPAYE"}</div><div style={{ fontSize: 16, fontWeight: 900, color: impaye > 0 ? "var(--warning)" : "var(--success)" }}>{fm(impaye)}</div></div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{"TRANSIT MOY."}</div><div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.02em", color: "var(--purple)" }}>{avgTransit > 0 ? String(avgTransit) + "j" : "---"}</div></div>
      </div>

      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"Dossiers / mois"}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
            {monthData.map(function (m, i) {
              var h = maxMDos > 0 ? Math.round(m.dos / maxMDos * 100) : 0;
              var barCol = PAL[i % PAL.length];
              return <div key={m.l} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: barCol, marginBottom: 2 }}>{m.dos > 0 ? String(m.dos) : ""}</div>
                <div style={{ height: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><div style={{ width: "70%", height: h + "%", background: barCol, borderRadius: "4px 4px 0 0", minHeight: m.dos > 0 ? 4 : 0 }} /></div>
                <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4 }}>{m.l}</div>
              </div>;
            })}
          </div>
        </div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"Depenses / mois"}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
            {monthData.map(function (m, i) {
              var h = maxMDep > 0 ? Math.round(m.dep / maxMDep * 100) : 0;
              var barCol = PAL[(i + 3) % PAL.length];
              return <div key={m.l} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: barCol, marginBottom: 2 }}>{m.dep > 0 ? (m.dep >= 1e6 ? (m.dep / 1e6).toFixed(1) + "M" : (m.dep / 1000).toFixed(0) + "k") : ""}</div>
                <div style={{ height: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><div style={{ width: "70%", height: h + "%", background: barCol, borderRadius: "4px 4px 0 0", minHeight: m.dep > 0 ? 4 : 0 }} /></div>
                <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4 }}>{m.l}</div>
              </div>;
            })}
          </div>
        </div>
      </div>

      <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"Dossiers par statut"}</div>
        <div style={{ display: "flex", gap: 2, height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
          {["INITIALISE", "SECURISE", "EN_TRANSIT", "CLOTURE", "ARCHIVE"].map(function (s) {
            var n = dosBySt[s] || 0; if (n === 0) return null;
            var pct = totalDos > 0 ? (n / totalDos * 100) : 0;
            return <div key={s} style={{ width: pct + "%", background: stColors[s], minWidth: n > 0 ? 24 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "white", fontSize: 10, fontWeight: 700 }}>{String(n)}</span></div>;
          })}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["INITIALISE", "SECURISE", "EN_TRANSIT", "CLOTURE", "ARCHIVE"].map(function (s) {
            return <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: stColors[s] }} /><span style={{ fontWeight: 600 }}>{DL[s]}</span><span style={{ color: "var(--text-secondary)" }}>{"(" + String(dosBySt[s] || 0) + ")"}</span></div>;
          })}
        </div>
      </div>

      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"Depenses par type"}</div>
          {typeKeys.map(function (k, i) {
            return <Bar key={k} label={DTL[k] || k} val={depByType[k]} max={maxType} color={typeColors[k] || PAL[i % PAL.length]} />;
          })}
          {typeKeys.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 16 }}>{"Aucune depense"}</div> : null}
        </div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"Top clients (dossiers)"}</div>
          {clKeys.slice(0, 8).map(function (k, i) {
            return <Bar key={k} label={k} val={dosByClient[k]} max={maxCl} color={PAL[i % PAL.length]} fmt={String(dosByClient[k]) + " dossier(s)"} />;
          })}
          {clKeys.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 16 }}>{"Aucune donnee"}</div> : null}
        </div>
      </div>

      {/* TRANSPORT — stats par chauffeur, type TC, poids */}
      {(function () {
        // Build transport stats: cross dep (TRANSPORT) with tcs (chauffeur, type, weight)
        var transportDeps = fdep.filter(function (f) { return f.tp === "TRANSPORT" && f.tcid; });
        if (transportDeps.length === 0) return null;

        var byCh = {};
        var byTy = {};
        transportDeps.forEach(function (f) {
          var tc = tcs.find(function (c) { return c.id === f.tcid; });
          if (!tc) return;
          var ch = tc.ch || "Non assigne";
          var ty = tc.ty || "20GP";
          var po = parseFloat(tc.po) || 0;

          // By chauffeur
          if (!byCh[ch]) byCh[ch] = { n: 0, tot: 0 };
          byCh[ch].n++;
          byCh[ch].tot += (f.mt || 0);

          // By TC type
          if (!byTy[ty]) byTy[ty] = { n: 0, tot: 0, poTot: 0, poN: 0 };
          byTy[ty].n++;
          byTy[ty].tot += (f.mt || 0);
          if (po > 0) { byTy[ty].poTot += po; byTy[ty].poN++; }
        });

        var chRows = Object.keys(byCh).map(function (k) { return { ch: k, n: byCh[k].n, avg: Math.round(byCh[k].tot / byCh[k].n) }; });
        chRows.sort(function (a, b) { return b.n - a.n; });
        var maxChN = chRows.length > 0 ? chRows[0].n : 1;

        var tyRows = Object.keys(byTy).map(function (k) { return { ty: k, n: byTy[k].n, avg: Math.round(byTy[k].tot / byTy[k].n), poAvg: byTy[k].poN > 0 ? Math.round(byTy[k].poTot / byTy[k].poN * 10) / 10 : 0 }; });
        tyRows.sort(function (a, b) { return b.n - a.n; });
        var maxTyN = tyRows.length > 0 ? tyRows[0].n : 1;

        var tyColors2: Record<string, string> = { "20GP": "var(--chart-1)", "40GP": "var(--chart-2)", "40HC": "var(--chart-3)", "20RF": "var(--chart-6)", "40RF": "var(--chart-4)", "45HC": "var(--chart-7)" };

        return <>
          <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{"Transport par chauffeur"}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>{String(transportDeps.length) + " voyage(s) enregistre(s)"}</div>
            {chRows.slice(0, 10).map(function (r, i) {
              return <div key={r.ch} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 90, minWidth: 70, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ch}</div>
                <div style={{ flex: 1, height: 22, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: Math.round(r.n / maxChN * 100) + "%", height: "100%", background: PAL[i % PAL.length], borderRadius: 4, minWidth: 4 }} /></div>
                <div style={{ width: 130, minWidth: 100, fontSize: 10, textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <span style={{ fontWeight: 700 }}>{String(r.n) + " voy."}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{"moy. " + fm(r.avg)}</span>
                </div>
              </div>;
            })}
          </div>

          <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"Prix moyen par type TC"}</div>
              {tyRows.map(function (r) {
                return <div key={r.ty} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 50, fontSize: 12, fontWeight: 700, color: tyColors2[r.ty] || "var(--text-primary)", textAlign: "right" }}>{r.ty}</div>
                  <div style={{ flex: 1, height: 22, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: Math.round(r.n / maxTyN * 100) + "%", height: "100%", background: tyColors2[r.ty] || "var(--text-secondary)", borderRadius: 4, minWidth: 4 }} /></div>
                  <div style={{ width: 100, fontSize: 10, textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{fm(r.avg)}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{String(r.n) + " TC"}</div>
                  </div>
                </div>;
              })}
              {tyRows.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 16 }}>{"Aucune donnee"}</div> : null}
            </div>
            <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"Poids moyen par type TC"}</div>
              {tyRows.filter(function (r) { return r.poAvg > 0; }).map(function (r) {
                return <div key={r.ty} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 50, fontSize: 12, fontWeight: 700, color: tyColors2[r.ty] || "var(--text-primary)", textAlign: "right" }}>{r.ty}</div>
                  <div style={{ flex: 1, height: 22, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: Math.round(r.poAvg / Math.max.apply(null, tyRows.map(function (x) { return x.poAvg || 1; })) * 100) + "%", height: "100%", background: tyColors2[r.ty] || "var(--text-secondary)", borderRadius: 4, minWidth: 4 }} /></div>
                  <div style={{ width: 80, fontSize: 11, fontWeight: 700, textAlign: "right" }}>{String(r.poAvg) + " T"}</div>
                </div>;
              })}
              {tyRows.filter(function (r) { return r.poAvg > 0; }).length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 16 }}>{"Pas de donnees poids"}</div> : null}
            </div>
          </div>
        </>;
      })()}
    </div>
  );
}

export default Stats;
