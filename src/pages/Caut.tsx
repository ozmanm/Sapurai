import { useState } from 'react';
import { fm, tcSum } from '../utils/format.js';
import usePagination from '../hooks/usePagination.js';
import Pagination from '../components/ui/Pagination.tsx';
import ClickableDiv from '../components/ui/ClickableDiv.tsx';

interface CautProps { dos: any[]; tcs: any[]; setMl: (ml: any) => void; updateGarantie: (dosId: string, statut: string) => void; patchTc?: (tid: string, fields: Record<string, unknown>) => void; }

function Caut(p: CautProps) {
  var dos = p.dos;
  var tcs = p.tcs;
  var setMl = p.setMl;
  var [tab, setTab] = useState("LOUEE");

  var louees = dos.filter(function (d) { return d.gr === "LOUEE" && d.st !== "ARCHIVE"; });
  var vendues = dos.filter(function (d) { return d.gr === "VENDUE" && d.st !== "ARCHIVE"; });
  var permanentes = dos.filter(function (d) { return d.gr === "PERMANENTE" && d.st !== "ARCHIVE"; });

  // Financials
  var totalCautionLouee = louees.reduce(function (s, d) { return s + (d.gar_caution || 0); }, 0);
  var totalFraisLouee = louees.reduce(function (s, d) { return s + (d.gar_frais || 0); }, 0);
  var totalCautionVendue = vendues.reduce(function (s, d) { return s + (d.gar_caution || 0); }, 0);
  var totalFraisVendue = vendues.reduce(function (s, d) { return s + (d.gar_frais || 0); }, 0);

  // Action needed
  var lRecup = louees.filter(function (d) {
    if (d.gar_statut === "RECUPEREE" || d.gar_statut === "PERDUE") return false;
    var dtcs = tcs.filter(function (c) { return c.did === d.id; });
    return dtcs.length > 0 && dtcs.every(function (c) { return c.st === "RETURNED"; });
  });
  var vRendre = vendues.filter(function (d) {
    if (d.gar_statut === "REMBOURSEE" || d.gar_statut === "CONSERVEE") return false;
    var dtcs = tcs.filter(function (c) { return c.did === d.id; });
    return dtcs.length > 0 && dtcs.every(function (c) { return c.st === "RETURNED"; });
  });

  // Cautions en cours (louees non recuperees)
  var cautEnCours = louees.filter(function (d) { return d.gar_statut === "VERSEE" || (!d.gar_statut && d.gar_caution > 0); }).reduce(function (s, d) { return s + (d.gar_caution || 0); }, 0);

  var pgP = usePagination(permanentes, 20);
  var pgL = usePagination(louees, 20);
  var pgV = usePagination(vendues, 20);

  var STATUT_LBL = { VERSEE: "Versee", RECUPEREE: "Recuperee", PERDUE: "Perdue", RETENUE: "Retenue", REMBOURSEE: "Remboursee", CONSERVEE: "Conservee" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div><h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{"Suivi des Cautions"}</h1><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{String(permanentes.length + louees.length + vendues.length) + " dossier(s) avec caution"}</div></div>
      </div>

      {/* Onglets cliquables — theme-aware : text-primary et bg-primary s'inversent ensemble */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 16 }}>
        <ClickableDiv onClick={function () { setTab("PERMANENTE"); }} label="Onglet cautions permanentes" style={{ background: tab === "PERMANENTE" ? "var(--text-primary)" : "var(--bg-primary)", borderRadius: 8, padding: 14, border: "1px solid " + (tab === "PERMANENTE" ? "var(--text-primary)" : "var(--border)"), textAlign: "center", transition: "background 0.2s ease-out, color 0.2s ease-out, border-color 0.2s ease-out" }}><div style={{ fontSize: 10, fontWeight: 700, color: tab === "PERMANENTE" ? "var(--bg-secondary)" : "var(--text-muted)" }}>{"PERMANENTES"}</div><div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: tab === "PERMANENTE" ? "var(--bg-primary)" : "var(--text-primary)" }}>{String(permanentes.length)}</div></ClickableDiv>
        <ClickableDiv onClick={function () { setTab("LOUEE"); }} label="Onglet cautions louees" style={{ background: tab === "LOUEE" ? "var(--text-primary)" : "var(--bg-primary)", borderRadius: 8, padding: 14, border: "1px solid " + (tab === "LOUEE" ? "var(--text-primary)" : "var(--border)"), textAlign: "center", transition: "background 0.2s ease-out, color 0.2s ease-out, border-color 0.2s ease-out" }}><div style={{ fontSize: 10, fontWeight: 700, color: tab === "LOUEE" ? "var(--bg-secondary)" : "var(--text-muted)" }}>{"LOUEES"}</div><div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: tab === "LOUEE" ? "var(--bg-primary)" : "var(--warning)" }}>{String(louees.length)}</div>{lRecup.length > 0 ? <div style={{ fontSize: 11, color: tab === "LOUEE" ? "var(--danger-light)" : "var(--danger)", fontWeight: 600 }}>{String(lRecup.length) + " a recuperer"}</div> : null}</ClickableDiv>
        <ClickableDiv onClick={function () { setTab("VENDUE"); }} label="Onglet ventes de lettre" style={{ background: tab === "VENDUE" ? "var(--text-primary)" : "var(--bg-primary)", borderRadius: 8, padding: 14, border: "1px solid " + (tab === "VENDUE" ? "var(--text-primary)" : "var(--border)"), textAlign: "center", transition: "background 0.2s ease-out, color 0.2s ease-out, border-color 0.2s ease-out" }}><div style={{ fontSize: 10, fontWeight: 700, color: tab === "VENDUE" ? "var(--bg-secondary)" : "var(--text-muted)" }}>{"VENTES LETTRE"}</div><div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: tab === "VENDUE" ? "var(--bg-primary)" : "var(--purple)" }}>{String(vendues.length)}</div>{vRendre.length > 0 ? <div style={{ fontSize: 11, color: tab === "VENDUE" ? "var(--danger-light)" : "var(--danger)", fontWeight: 600 }}>{String(vRendre.length) + " a rembourser"}</div> : null}</ClickableDiv>
        <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: 14, border: "1px solid var(--border)", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>{"CAUTIONS EN COURS"}</div><div style={{ fontSize: 16, fontWeight: 800, color: cautEnCours > 0 ? "var(--danger)" : "var(--success)" }}>{fm(cautEnCours)}</div></div>
      </div>

      {/* Financial summary */}
      {(totalCautionLouee > 0 || totalCautionVendue > 0) ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {totalCautionLouee > 0 && tab === "LOUEE" ? <div style={{ background: "var(--warning-bg)", borderRadius: 8, padding: 12, border: "1px solid var(--warning)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warning-text)", marginBottom: 4 }}>{"Louees — Montants"}</div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--warning-text)" }}>
              <span>{"Cautions : "}<strong>{fm(totalCautionLouee)}</strong></span>
              <span>{"Lettre : "}<strong>{fm(totalFraisLouee)}</strong></span>
            </div>
          </div> : null}
          {totalCautionVendue > 0 && tab === "VENDUE" ? <div style={{ background: "var(--purple-bg)", borderRadius: 8, padding: 12, border: "1px solid var(--purple-border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--purple-text)", marginBottom: 4 }}>{"Ventes — Montants"}</div>
            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
              <span>{"Cautions : "}<strong>{fm(totalCautionVendue)}</strong></span>
              <span>{"Ventes : "}<strong>{fm(totalFraisVendue)}</strong></span>
            </div>
          </div> : null}
        </div>
      ) : null}

      {/* Actions urgentes — Louees */}
      {lRecup.length > 0 && tab === "LOUEE" ? (
        <div style={{ background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border)", padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--warning)", marginBottom: 8 }}>{"\u26A0 Cautions a recuperer (" + String(lRecup.length) + ")"}</div>
          {lRecup.map(function (d) { return <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
            <ClickableDiv onClick={function () { setMl({ t: "det", did: d.id }); }} label={"Ouvrir dossier " + (d.cl || "") + " " + (d.bl || "")} style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{(d.cl || "?") + " — " + (d.bl || "")}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(d.gar_contact || "?") + (d.gar_tel ? " · " + d.gar_tel : "") + " · Caution: " + fm(d.gar_caution || 0)}</div>
            </ClickableDiv>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={function () { p.updateGarantie(d.id, "RECUPEREE"); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{"Recuperee"}</button>
              <button onClick={function () { p.updateGarantie(d.id, "PERDUE"); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{"Perdue"}</button>
            </div>
          </div>; })}
        </div>
      ) : null}

      {/* Actions urgentes — Vendues */}
      {vRendre.length > 0 && tab === "VENDUE" ? (
        <div style={{ background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border)", padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--purple)", marginBottom: 8 }}>{"\u26A0 Cautions a rembourser (" + String(vRendre.length) + ")"}</div>
          {vRendre.map(function (d) { return <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
            <ClickableDiv onClick={function () { setMl({ t: "det", did: d.id }); }} label={"Ouvrir dossier " + (d.cl || "") + " " + (d.bl || "")} style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{(d.cl || "?") + " — " + (d.bl || "")}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(d.gar_contact || "?") + (d.gar_tel ? " · " + d.gar_tel : "") + " · Caution: " + fm(d.gar_caution || 0)}</div>
            </ClickableDiv>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={function () { p.updateGarantie(d.id, "REMBOURSEE"); }} style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{"Remboursee"}</button>
              <button onClick={function () { p.updateGarantie(d.id, "CONSERVEE"); }} style={{ background: "var(--danger)", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{"Conservee"}</button>
            </div>
          </div>; })}
        </div>
      ) : null}

      {/* PERMANENTES table */}
      {permanentes.length > 0 && tab === "PERMANENTE" ? <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ padding: "10px 12px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{"Permanentes (" + permanentes.length + ")"}</div>
        <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 90px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
          {["CLIENT / BL", "DESTINATION", "TC", "STATUT"].map(function (h) { return <div key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</div>; })}
        </div>
        {pgP.paginated.map(function (d) {
          var dtcs = tcs.filter(function (c) { return c.did === d.id; });
          var allRet = dtcs.length > 0 && dtcs.every(function (c) { return c.st === "RETURNED"; });
          var stLbl = d.st === "CLOTURE" ? "Cloture" : d.st === "ARCHIVE" ? "Archive" : allRet ? "Retourne" : "En cours";
          var stBg = d.st === "CLOTURE" || allRet ? "var(--success-light)" : "var(--bg-secondary)";
          var stCol = d.st === "CLOTURE" || allRet ? "var(--success-text)" : "var(--text-secondary)";
          return <div key={d.id}>
            <div className="lt-hide-mobile" onClick={function () { setMl({ t: "det", did: d.id }); }} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 90px", alignItems: "center", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}>
              <div style={{ padding: "12px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{d.cl || "?"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.bl || ""}</div>
              </div>
              <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-input)" }}>{d.cr || "---"}</div>
              <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-input)" }}>{dtcs.length > 0 ? tcSum(dtcs) : "0 TC"}</div>
              <div style={{ padding: "12px 8px" }}><span style={{ background: stBg, color: stCol, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{stLbl}</span></div>
            </div>
            <div className="lt-show-mobile" onClick={function () { setMl({ t: "det", did: d.id }); }} style={{ display: "none", padding: "10px 12px", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{(d.cl || "") + " — " + (d.bl || "")}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(d.cr || "") + " · " + tcSum(dtcs)}</div>
                </div>
                <span style={{ background: stBg, color: stCol, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{stLbl}</span>
              </div>
            </div>
          </div>;
        })}
        <Pagination page={pgP.page} setPage={pgP.setPage} totalPages={pgP.totalPages} total={pgP.total} />
      </div> : null}

      {louees.length > 0 || vendues.length > 0 ? (<div>
        {/* LOUEES table */}
        {louees.length > 0 && tab === "LOUEE" ? <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 12 }}>
          <div style={{ padding: "10px 12px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, color: "var(--warning)" }}>{"Louees (" + louees.length + ")"}</div>
          <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 90px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
            {["CLIENT / BL", "CONTACT", "CAUTION", "LETTRE", "TC", "STATUT"].map(function (h) { return <div key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</div>; })}
          </div>
          {pgL.paginated.map(function (d) {
            var dtcs = tcs.filter(function (c) { return c.did === d.id; });
            var allRet = dtcs.length > 0 && dtcs.every(function (c) { return c.st === "RETURNED"; });
            var stLbl = d.gar_statut ? (STATUT_LBL[d.gar_statut] || d.gar_statut) : (allRet ? "A recuperer" : "En cours");
            var stBg = d.gar_statut === "RECUPEREE" ? "var(--success-light)" : d.gar_statut === "PERDUE" ? "var(--danger-light)" : allRet ? "var(--danger-light)" : "var(--warning-bg)";
            var stCol = d.gar_statut === "RECUPEREE" ? "var(--success-text)" : d.gar_statut === "PERDUE" ? "var(--danger)" : allRet ? "var(--danger)" : "var(--warning-text)";
            return <div key={d.id}>
              <div className="lt-hide-mobile" onClick={function () { setMl({ t: "det", did: d.id }); }} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 90px", alignItems: "center", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}>
                <div style={{ padding: "12px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{d.cl || "?"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.bl || ""}</div>
                </div>
                <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-input)" }}>{d.gar_contact || "---"}{d.gar_tel ? <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.gar_tel}</div> : null}</div>
                <div style={{ padding: "12px 12px", fontSize: 12, fontWeight: 700 }}>{d.gar_caution > 0 ? fm(d.gar_caution) : "---"}</div>
                <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>{d.gar_frais > 0 ? fm(d.gar_frais) : "---"}</div>
                <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-input)" }}>{dtcs.length > 0 ? tcSum(dtcs) : "0 TC"}</div>
                <div style={{ padding: "12px 8px" }}><span style={{ background: stBg, color: stCol, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{stLbl}</span></div>
              </div>
              <div className="lt-show-mobile" onClick={function () { setMl({ t: "det", did: d.id }); }} style={{ display: "none", padding: "10px 12px", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{(d.cl || "") + " — " + (d.bl || "")}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(d.gar_contact || "") + " · " + fm(d.gar_caution || 0)}</div>
                  </div>
                  <span style={{ background: stBg, color: stCol, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{stLbl}</span>
                </div>
              </div>
            </div>;
          })}
          <Pagination page={pgL.page} setPage={pgL.setPage} totalPages={pgL.totalPages} total={pgL.total} />
        </div> : null}

        {/* VENDUES table */}
        {vendues.length > 0 && tab === "VENDUE" ? <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, color: "var(--purple)" }}>{"Ventes de lettre (" + vendues.length + ")"}</div>
          <div className="lt-hide-mobile" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 90px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
            {["CLIENT / BL", "ACHETEUR", "CAUTION", "VENTE", "TC", "STATUT"].map(function (h) { return <div key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</div>; })}
          </div>
          {pgV.paginated.map(function (d) {
            var dtcs = tcs.filter(function (c) { return c.did === d.id; });
            var allRet = dtcs.length > 0 && dtcs.every(function (c) { return c.st === "RETURNED"; });
            var stLbl = d.gar_statut ? (STATUT_LBL[d.gar_statut] || d.gar_statut) : (allRet ? "A rembourser" : "En cours");
            var stBg = d.gar_statut === "REMBOURSEE" ? "var(--success-light)" : d.gar_statut === "CONSERVEE" ? "var(--danger-light)" : allRet ? "var(--danger-light)" : "var(--purple-bg)";
            var stCol = d.gar_statut === "REMBOURSEE" ? "var(--success-text)" : d.gar_statut === "CONSERVEE" ? "var(--danger)" : allRet ? "var(--danger)" : "var(--purple-text)";
            return <div key={d.id}>
              <div className="lt-hide-mobile" onClick={function () { setMl({ t: "det", did: d.id }); }} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 90px", alignItems: "center", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}>
                <div style={{ padding: "12px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{d.cl || "?"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.bl || ""}</div>
                </div>
                <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-input)" }}>{d.gar_contact || "---"}{d.gar_tel ? <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.gar_tel}</div> : null}</div>
                <div style={{ padding: "12px 12px", fontSize: 12, fontWeight: 700 }}>{d.gar_caution > 0 ? fm(d.gar_caution) : "---"}</div>
                <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>{d.gar_frais > 0 ? fm(d.gar_frais) : "---"}</div>
                <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-input)" }}>{dtcs.length > 0 ? tcSum(dtcs) : "0 TC"}</div>
                <div style={{ padding: "12px 8px" }}><span style={{ background: stBg, color: stCol, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{stLbl}</span></div>
              </div>
              <div className="lt-show-mobile" onClick={function () { setMl({ t: "det", did: d.id }); }} style={{ display: "none", padding: "10px 12px", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{(d.cl || "") + " — " + (d.bl || "")}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(d.gar_contact || "") + " · " + fm(d.gar_caution || 0)}</div>
                  </div>
                  <span style={{ background: stBg, color: stCol, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{stLbl}</span>
                </div>
              </div>
            </div>;
          })}
          <Pagination page={pgV.page} setPage={pgV.setPage} totalPages={pgV.totalPages} total={pgV.total} />
        </div> : null}

      </div>) : null}
    </div>
  );
}

export default Caut;
