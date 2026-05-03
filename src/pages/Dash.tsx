import { fm } from '../utils/format.js';
import { pdfBilan, pdfClient } from '../utils/pdf.js';
import { exportFinancierClient } from '../utils/export.js';
import { ratingStats, dossiersWithProblems, RATING_REASON_LABELS } from '../utils/rating.js';
import { pendingInvoices, pendingInvoicesStats, groupPendingByDossier } from '../utils/pendingInvoices';
import { getCategorieMeta } from '../utils/stub';
import ClickableDiv from '../components/ui/ClickableDiv.tsx';
import EmptyState from '../components/ui/EmptyState.tsx';

interface DashProps { [key: string]: any; }

function Dash(p: DashProps) {
  var enCours = p.enCours;
  var nCloture = p.nCloture;
  var tcs = p.tcs;
  var dep = p.dep;
  var dos = p.dos;
  var totalDep = p.totalDep;
  var totalPaye = p.totalPaye;
  var totalImpaye = p.totalImpaye;
  var nPort = p.nPort;
  var nTrans = p.nTrans;
  var urgences = p.urgences;
  var urgGrouped = p.urgGrouped;
  var cautionsEnCours = p.cautionsEnCours || 0;
  var nSurestaries = p.nSurestaries || 0;
  var canEdit = p.canEdit;
  var setMl = p.setMl;
  var setVw = p.setVw;
  var companyName = p.companyName || "SAPURAI";

  if (dos.length === 0) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <EmptyState
          icon="📦"
          title="Bienvenue sur Sapurai"
          description="Créez votre premier dossier de transit pour commencer le suivi de vos conteneurs, dépenses et franchises."
          action={canEdit ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 320, maxWidth: "100%" }}>
              <button onClick={function () { setMl({ t: "ndos" }); }} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 48 }}>{"+ Créer un dossier"}</button>
              <button onClick={function () { setMl({ t: "import" }); }} style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 48 }}>{"📂 Importer depuis Excel"}</button>
            </div>
          ) : null}
        />
      </div>
    );
  }

  return (
    <div>
      {/* SUMMARY CARDS */}
      <div className="lt-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Dossiers actifs"}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{String(enCours)}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{String(nCloture) + " clôturés"}</div>
        </div>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Conteneurs"}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{String(tcs.length) + " TC"}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{(p.nAttendu > 0 ? String(p.nAttendu) + " attendu | " : "") + String(nPort) + " port | " + String(nTrans) + " transit"}</div>
        </div>
        {(function () {
          var nPay = dep.filter(function (f) { return f.s === "PAYE"; }).length;
          var nImp = dep.length - nPay;
          return <>
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Factures"}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{String(dep.length)}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{fm(totalDep)}</div>
            </div>
            <div style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Payees"}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>{String(nPay)}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{fm(totalPaye)}</div>
            </div>
            <div style={{ background: nImp > 0 ? "var(--danger-bg)" : "var(--bg-primary)", border: "1px solid " + (nImp > 0 ? "var(--danger-border)" : "var(--border)"), borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Impayees"}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: nImp > 0 ? "var(--danger)" : "var(--success)" }}>{nImp > 0 ? String(nImp) : "\u2713"}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{nImp > 0 ? fm(totalImpaye) : "tout est regle"}</div>
            </div>
          </>;
        })()}
        {nSurestaries > 0 ? (
          <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--warning-text)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Surestaries"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--warning-text)" }}>{String(nSurestaries) + " TC"}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{"en surestaries"}</div>
          </div>
        ) : null}
        {(function () {
          var totalRv = dos.filter(function (d) { return d.st !== "ARCHIVE"; }).reduce(function (s, d) { return s + (d.rv || 0); }, 0);
          var margeGlobale = totalRv - totalDep;
          if (totalRv === 0) return null;
          return <div style={{ background: margeGlobale >= 0 ? "var(--success-bg)" : "var(--danger-bg)", border: "1px solid " + (margeGlobale >= 0 ? "var(--success-border)" : "var(--danger-border)"), borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Marge globale"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: margeGlobale >= 0 ? "var(--success)" : "var(--danger)" }}>{fm(margeGlobale)}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{"Recette: " + fm(totalRv)}</div>
          </div>;
        })()}
        {cautionsEnCours > 0 ? (
          <ClickableDiv onClick={function () { if (setVw) setVw("caut"); }} label="Voir les cautions en cours" style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--purple)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Cautions"}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--purple-text)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fm(cautionsEnCours)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{"montant bloque"}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--purple)" }}>{"Voir \u2192"}</span>
            </div>
          </ClickableDiv>
        ) : null}
        {/* Carte Factures impayees \u2014 meme pattern que Cautions */}
        {totalImpaye > 0 ? (
          <ClickableDiv onClick={function () { if (setVw) setVw("dep"); }} label="Voir les factures impayees" style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--warning-text)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Factures impay\u00e9es"}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--warning-text)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fm(totalImpaye)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{"reste a payer"}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--warning-text)" }}>{"Voir \u2192"}</span>
            </div>
          </ClickableDiv>
        ) : null}
        {/* Compteur Archives retire \u2014 peu actionable au quotidien (consultable depuis Dossiers > onglet Archives) */}
        {/* KPI Satisfaction client — visible si au moins 1 rating */}
        {(function () {
          var st = ratingStats(dos);
          if (st.total === 0) return null;
          var col = st.goodPct >= 80 ? "var(--success)" : st.goodPct >= 60 ? "var(--warning)" : "var(--danger)";
          return (
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Satisfaction client"}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: col }}>{String(st.goodPct) + "%"}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{String(st.total) + " avis" + (st.problems > 0 ? " \u2014 " + String(st.problems) + " a traiter" : "")}</div>
            </div>
          );
        })()}
      </div>

      {/* URGENCES \u2014 bandeau retire (redondant avec la notif topbar) ; on garde uniquement la grille par categorie */}
      {urgences.length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          {/* Grille urgences group\u00e9es : 3 colonnes desktop, responsive */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {urgGrouped.map(function (g) {
              return <div key={g.cat.key} className="lt-card" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{g.cat.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{String(g.items.length)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {g.items.slice(0, 5).map(function (u, i) {
                    // Parse msg : extrait dur\u00e9e (J-X, J+X, +Xj, Xj) du d\u00e9but si pr\u00e9sent
                    var msg = String(u.msg || "");
                    var durMatch = msg.match(/^(\+?J?[-+]?\d+\s?j?|\+\d+j|J-\d+|J\+\d+)/i);
                    var dur = durMatch ? durMatch[0].trim() : "";
                    var rest = dur ? msg.replace(durMatch[0], "").trim() : msg;
                    return <ClickableDiv key={i} onClick={function () { setMl({ t: "det", did: u.did }); }} label={"Ouvrir dossier : " + u.msg} style={{ fontSize: 12, padding: "5px 6px", borderRadius: 6, display: "flex", alignItems: "center", gap: 8, lineHeight: 1.3 }}>
                      {dur ? <span style={{ color: "var(--danger)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 38, fontSize: 11 }}>{dur}</span> : null}
                      <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontSize: 11.5 }}>{rest || msg}</span>
                      {u.sub ? <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flexShrink: 0 }}>{u.sub}</span> : null}
                    </ClickableDiv>;
                  })}
                  {g.items.length > 5 ? <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" as const, padding: "6px 0 2px", fontWeight: 500 }}>{"+ " + String(g.items.length - 5) + " autre(s)"}</div> : null}
                </div>
              </div>;
            })}
          </div>
        </div>
      ) : (
        <div className="lt-card" style={{ padding: 14, marginBottom: 14, background: "var(--success-bg)", borderColor: "var(--success-border)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success-text)" }}>{"\u2705 Aucune action urgente"}</div>
        </div>
      )}

      {/* FACTURES EN ATTENTE — auto-stub Depenses */}
      {(function () {
        var inv = pendingInvoices(dep, dos);
        if (inv.length === 0) return null;
        var st = pendingInvoicesStats(inv);
        var groups = groupPendingByDossier(inv);
        var headerBg = st.late > 0 ? "var(--warning-bg)" : "var(--info-bg)";
        var headerBorder = st.late > 0 ? "var(--warning-border)" : "var(--info-border)";
        var headerText = st.late > 0 ? "var(--warning-text)" : "var(--info-text)";
        return (
          <div style={{ background: headerBg, border: "1px solid " + headerBorder, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: headerText, letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span>{"\uD83E\uDDFE Factures en attente (" + String(st.total) + ")"}</span>
              <span style={{ fontSize: 11, fontWeight: 700, display: "flex", gap: 10 }}>
                {st.late > 0 ? <span style={{ color: "var(--danger-text)" }}>{"\u{1F534} " + String(st.late) + " en retard (>10j)"}</span> : null}
                {st.thisWeek > 0 ? <span style={{ color: "var(--info-text)" }}>{"\u{1F535} " + String(st.thisWeek) + " cette semaine"}</span> : null}
                <span style={{ color: "var(--text-secondary)" }}>{String(st.byDossier) + " dossier(s)"}</span>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.slice(0, 5).map(function (g) {
                var cats = g.invoices.map(function (p) {
                  var meta = getCategorieMeta(p.depense.categorie || "autre");
                  return meta.libelle.replace(" conteneur", "").replace(" / manutention", "").replace("Paiement ", "");
                }).slice(0, 4).join(", ");
                var isLate = g.maxAge > 10;
                return (
                  <ClickableDiv
                    key={g.dossier.id}
                    onClick={function () { setMl({ t: "det", did: g.dossier.id }); }}
                    label={"Ouvrir dossier : " + (g.dossier.cl || "") + " " + (g.dossier.bl || "")}
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{(g.dossier.cl || "?") + " \u2014 " + (g.dossier.bl || "?")}</span>
                      <span style={{ fontSize: 10, background: isLate ? "var(--danger-light)" : "var(--info-bg)", color: isLate ? "var(--danger-text)" : "var(--info-text)", padding: "2px 8px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {String(g.invoices.length) + (g.invoices.length > 1 ? " factures" : " facture") + " \u00B7 " + String(g.maxAge) + "j"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{cats + (g.invoices.length > 4 ? "\u2026" : "")}</div>
                  </ClickableDiv>
                );
              })}
              {groups.length > 5 ? <div style={{ fontSize: 11, color: headerText, textAlign: "center", fontWeight: 600, marginTop: 4 }}>{"+ " + String(groups.length - 5) + " dossier(s)"}</div> : null}
            </div>
          </div>
        );
      })()}

      {/* PROBLEMES SIGNALES CLIENTS — rating=3 a traiter */}
      {(function () {
        var probs = dossiersWithProblems(dos);
        if (probs.length === 0) return null;
        return (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--danger-text)", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{"\uD83D\uDE1F"}</span>
              <span>{"Problemes signales par clients (" + String(probs.length) + ")"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {probs.slice(0, 5).map(function (d: any) {
                var reasons = (d.ratingReasons || []).map(function (k: string) { return RATING_REASON_LABELS[k] || k; }).join(", ");
                return (
                  <ClickableDiv
                    key={d.id}
                    onClick={function () { setMl({ t: "det", did: d.id }); }}
                    label={"Ouvrir dossier : " + (d.cl || "") + " " + (d.bl || "")}
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{(d.cl || "?") + " \u2014 " + (d.bl || "?")}</span>
                      {reasons ? <span style={{ fontSize: 10, background: "var(--danger-light)", color: "var(--danger-text)", padding: "2px 8px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>{reasons}</span> : null}
                    </div>
                    {d.ratingComment ? <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>{"\u00AB " + d.ratingComment + " \u00BB"}</div> : null}
                  </ClickableDiv>
                );
              })}
              {probs.length > 5 ? <div style={{ fontSize: 11, color: "var(--danger-text)", textAlign: "center", fontWeight: 600, marginTop: 4 }}>{"+ " + String(probs.length - 5) + " autre(s)"}</div> : null}
            </div>
          </div>
        );
      })()}

      {/* QUICK ACTIONS + REPRENDRE LE FIL */}
      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {/* Quick actions */}
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 14, border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>{"Actions rapides"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {canEdit ? <ClickableDiv onClick={function () { setMl({ t: "ndos" }); }} label="Nouveau dossier" style={{ background: "var(--bg-tertiary)", borderRadius: 10, padding: 12, textAlign: "center" }}><div style={{ fontSize: 22 }}>{"+"}</div><div style={{ fontWeight: 700, fontSize: 11, color: "var(--text-primary)" }}>{"Dossier"}</div></ClickableDiv> : null}
            <ClickableDiv onClick={function () { setMl({ t: "cli" }); }} label="Nouveau client" style={{ background: "var(--bg-tertiary)", borderRadius: 10, padding: 12, textAlign: "center" }}><div style={{ fontSize: 22 }}>{"\uD83D\uDCDE"}</div><div style={{ fontWeight: 700, fontSize: 11 }}>{"Client"}</div></ClickableDiv>
            {canEdit ? <ClickableDiv onClick={function () { setMl({ t: "nch" }); }} label="Nouveau chauffeur" style={{ background: "var(--bg-tertiary)", borderRadius: 10, padding: 12, textAlign: "center" }}><div style={{ fontSize: 22 }}>{"\uD83D\uDE9B"}</div><div style={{ fontWeight: 700, fontSize: 11 }}>{"Chauffeur"}</div></ClickableDiv> : null}
            {canEdit ? <ClickableDiv onClick={function () { setMl({ t: "ndep" }); }} label="Nouvelle depense" style={{ background: "var(--bg-tertiary)", borderRadius: 10, padding: 12, textAlign: "center" }}><div style={{ fontSize: 22 }}>{"\uD83D\uDCB0"}</div><div style={{ fontWeight: 700, fontSize: 11 }}>{"Dépense"}</div></ClickableDiv> : null}
          </div>
          {/* Banner urgences retire : info deja visible via le badge "X urgence(s)" en haut a droite */}
          <button onClick={function () { pdfBilan({ dos: dos, tcs: tcs, dep: dep, urgences: urgences, alertes: p.alertes || [], companyName: p.companyName || "SAPURAI" }); }} style={{ marginTop: 10, width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--text-tertiary)" }}>{"\uD83D\uDCC4 Telecharger bilan PDF"}</button>
          {p.syncAllDPWorld ? <button onClick={function () { p.syncAllDPWorld(); }} style={{ marginTop: 6, width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--text-tertiary)" }}>{"\uD83D\uDD04 Sync DPWorld (tous)"}</button> : null}
        </div>

        {/* Suivi financier par client : deplace dans la page Depenses (onglet "Par client") */}
      </div>
    </div>
  );
}

export default Dash;
