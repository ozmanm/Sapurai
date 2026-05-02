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
  var critCount = p.critCount;
  var sysStatus = p.sysStatus;
  var sysBg = p.sysBg;
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
        {/* Compteur dossiers archives */}
        {(function () {
          var nArc = dos.filter(function (d: any) { return d.st === "ARCHIVE"; }).length;
          if (nArc === 0) return null;
          return (
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{"Archiv\u00e9s"}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{String(nArc)}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{"dossiers archiv\u00e9s"}</div>
            </div>
          );
        })()}
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

      {/* URGENCES \u2014 Sprint A.1 refonte handoff : bandeau orange + grille 3 colonnes par categorie */}
      {urgences.length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          {/* Bandeau total urgences (orange fonc\u00e9 alert) avec CTA noir handoff */}
          <div role="alert" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderLeft: "3px solid var(--danger)", borderRadius: "var(--radius-lg, 12px)", padding: "14px 18px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--danger)", letterSpacing: "-0.01em" }}>{String(urgences.length) + " urgence" + (urgences.length > 1 ? "s" : "") + " \u00e0 traiter"}</div>
              <div style={{ fontSize: 12, color: "var(--danger-text)", marginTop: 3 }}>{critCount > 0 ? String(critCount) + " critique" + (critCount > 1 ? "s" : "") + " \u00b7 surestaries d\u00e9pass\u00e9es, documents expir\u00e9s, cautions en retard" : "Magasinage, d\u00e9tentions, BAD \u00e0 demander, TC immobiles"}</div>
            </div>
            <ClickableDiv onClick={function () {
              var crit = urgences.find(function (u) { return u.level === "critical"; }) || urgences[0];
              if (crit && crit.did) setMl({ t: "det", did: crit.did });
            }} label="Traiter la premiere urgence" style={{ background: "var(--text-primary)", color: "var(--bg-primary)", padding: "8px 16px", borderRadius: "var(--radius, 8px)", fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: "var(--font-sans)" }}>{"Traiter \u2192"}</ClickableDiv>
          </div>
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
          <div style={{ marginTop: 10, background: sysBg, color: "white", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, textAlign: "center" }}>{sysStatus === "NORMAL" ? "\u2705 Tout OK" : "\u26A0\uFE0F " + String(critCount > 0 ? critCount + " critique(s)" : urgences.length + " point(s)") + " en cours"}</div>
          <button onClick={function () { pdfBilan({ dos: dos, tcs: tcs, dep: dep, urgences: urgences, alertes: p.alertes || [], companyName: p.companyName || "SAPURAI" }); }} style={{ marginTop: 8, width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--text-tertiary)" }}>{"\uD83D\uDCC4 Telecharger bilan PDF"}</button>
          {p.syncAllDPWorld ? <button onClick={function () { p.syncAllDPWorld(); }} style={{ marginTop: 6, width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--text-tertiary)" }}>{"\uD83D\uDD04 Sync DPWorld (tous)"}</button> : null}
        </div>

        {/* Suivi financier par client */}
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 14, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: "var(--text-secondary)", letterSpacing: 0.5, textTransform: "uppercase" }}>{"Suivi financier par client"}</div>
            <button onClick={function () { exportFinancierClient(dos, dep, companyName); }} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "var(--text-tertiary)" }}>{"\u2193 Excel"}</button>
          </div>
          {(function () {
            var byClient = {};
            dos.forEach(function (d) {
              if (d.st === "ARCHIVE") return;
              var cl = d.cl || "Sans client";
              if (!byClient[cl]) byClient[cl] = { cl: cl, nDos: 0, tot: 0, pay: 0, rv: 0, ids: [] };
              byClient[cl].nDos++;
              byClient[cl].rv += (d.rv || 0);
              byClient[cl].ids.push(d.id);
            });
            dep.forEach(function (f) {
              var d = dos.find(function (x) { return x.id === f.did; });
              if (!d || d.st === "ARCHIVE") return;
              var cl = d.cl || "Sans client";
              if (!byClient[cl]) return;
              byClient[cl].tot += (f.mt || 0);
              if (f.s === "PAYE") byClient[cl].pay += (f.mt || 0);
            });
            var rows = Object.keys(byClient).map(function (k) { return byClient[k]; });
            rows.sort(function (a, b) { return (b.tot - b.pay) - (a.tot - a.pay); });
            if (rows.length === 0) return <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{"Aucune donnee"}</div>;
            return <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {rows.map(function (r) {
                var imp = r.tot - r.pay;
                var pct = r.tot > 0 ? Math.round(r.pay / r.tot * 100) : 0;
                var col = pct === 100 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--danger)";
                return <div key={r.cl} onClick={function () { if (setVw) setVw("dos"); if (p.setFilter) p.setFilter(r.cl); }} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{r.cl}</span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>{String(r.nDos) + " dossier" + (r.nDos > 1 ? "s" : "")}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{String(pct) + "%"}</span>
                      <span onClick={function (e) { e.stopPropagation(); pdfClient(r.cl, dos, tcs, dep, companyName); }} style={{ fontSize: 10, cursor: "pointer", color: "var(--text-secondary)", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--border)" }} title={"PDF " + r.cl}>{"\uD83D\uDCC4"}</span>
                      {(function () {
                        if (imp <= 0) return null;
                        var clientDos = dos.filter(function (dd) { return (dd.cl || "Sans client") === r.cl && dd.st !== "ARCHIVE"; });
                        var tel = "";
                        clientDos.forEach(function (dd) { if (dd.ct && !tel) tel = dd.ct; });
                        if (!tel) return null;
                        var details = [];
                        clientDos.forEach(function (dd) {
                          var ddep = dep.filter(function (f) { return f.did === dd.id; });
                          var dImp = ddep.reduce(function (s, f) { return s + (f.s !== "PAYE" ? (f.mt || 0) : 0); }, 0);
                          if (dImp > 0) details.push("- " + (dd.bl || "?") + " : " + fm(dImp));
                        });
                        var shown = details.slice(0, 10);
                        if (details.length > 10) shown.push("... et " + String(details.length - 10) + " autre(s)");
                        var msg = "Bonjour " + r.cl + ",\n\nVous avez " + String(details.length) + " facture(s) en attente de reglement pour un montant total de " + fm(imp) + ".\n\nDetail :\n" + shown.join("\n") + "\n\nCordialement,\n" + companyName;
                        var href = "https://wa.me/" + tel.replace(/[^0-9+]/g, "") + "?text=" + encodeURIComponent(msg);
                        // eslint-disable-next-line no-restricted-syntax -- WhatsApp brand green (couleur officielle)
                        return <a href={href} target="_blank" rel="noopener noreferrer" onClick={function (e) { e.stopPropagation(); }} style={{ fontSize: 10, cursor: "pointer", color: "#25d366", padding: "1px 4px", borderRadius: 4, border: "1px solid #25d366", textDecoration: "none", fontWeight: 700 }} title={"Relancer " + r.cl}>{"\uD83D\uDCF1"}</a>;
                      })()}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 3 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{"Total: " + fm(r.tot)}</span>
                    <span style={{ color: "var(--success)", fontWeight: 600 }}>{"Paye: " + fm(r.pay)}</span>
                    {imp > 0 ? <span style={{ color: "var(--danger)", fontWeight: 700 }}>{"Du: " + fm(imp)}</span> : <span style={{ color: "var(--success)" }}>{"\u2713"}</span>}
                    {r.rv > 0 ? <span style={{ color: (r.rv - r.tot) >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>{"Marge: " + fm(r.rv - r.tot)}</span> : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2 }}><div style={{ width: pct + "%", height: 4, background: col, borderRadius: 2 }}></div></div>
                  </div>
                </div>;
              })}
            </div>;
          })()}
        </div>
      </div>
    </div>
  );
}

export default Dash;
