import ClickableDiv from '../ui/ClickableDiv.tsx';
import type { SyncReport as SyncReportData } from '../../hooks/useDPWorldSync';

/**
 * Rapport detaille apres syncAllDPWorld : affiche la liste des dossiers modifies
 * (cliquables pour ouvrir le detail) avec leurs changements precis et le nombre
 * de factures en attente creees auto.
 */

interface SyncReportProps {
  report: SyncReportData;
  setMl: (ml: any) => void;
  onClose: () => void;
}

function SyncReport(p: SyncReportProps) {
  var r = p.report;

  function openDossier(dosId: string) {
    p.setMl({ t: "det", did: dosId });
  }

  return (
    <div>
      {/* Stats en entete */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 8, padding: "8px 14px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--success-text)", letterSpacing: 0.5, textTransform: "uppercase" }}>{"Dossiers mis a jour"}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success-text)" }}>{String(r.items.length)}</div>
        </div>
        <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 8, padding: "8px 14px", flex: "1 1 140px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--info-text)", letterSpacing: 0.5, textTransform: "uppercase" }}>{"Changements"}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--info-text)" }}>{String(r.totalChanges)}</div>
        </div>
        {r.totalStubs > 0 ? (
          <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 8, padding: "8px 14px", flex: "1 1 140px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--warning-text)", letterSpacing: 0.5, textTransform: "uppercase" }}>{"Factures en attente"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--warning-text)" }}>{"+" + String(r.totalStubs)}</div>
          </div>
        ) : null}
        {r.errorsBL.length > 0 ? (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, padding: "8px 14px", flex: "1 1 140px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--danger-text)", letterSpacing: 0.5, textTransform: "uppercase" }}>{"BL non trouves"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--danger-text)" }}>{String(r.errorsBL.length)}</div>
          </div>
        ) : null}
      </div>

      {/* Liste des dossiers */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--text-primary)" }}>{"Details par dossier"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "50vh", overflowY: "auto" }}>
        {r.items.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{"Aucun changement"}</div>
        ) : r.items.map(function (item) {
          return (
            <ClickableDiv
              key={item.dosId}
              onClick={function () { openDossier(item.dosId); }}
              label={"Ouvrir dossier " + item.cl + " " + item.bl}
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{(item.cl || "?") + " \u2014 " + (item.bl || "?")}</span>
                {item.stubCount > 0 ? (
                  <span style={{ fontSize: 10, background: "var(--warning-bg)", color: "var(--warning-text)", padding: "2px 8px", borderRadius: 6, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {"+" + String(item.stubCount) + " facture(s) en attente"}
                  </span>
                ) : null}
              </div>
              {item.changes.length > 0 ? (
                <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {item.changes.map(function (c, i) {
                    return <li key={i}>{c}</li>;
                  })}
                </ul>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>{"Seules des factures en attente ont ete ajoutees"}</div>
              )}
            </ClickableDiv>
          );
        })}
      </div>

      {r.errorsBL.length > 0 ? (
        <div style={{ marginTop: 12, padding: 10, background: "var(--danger-bg)", borderRadius: 8, fontSize: 11, color: "var(--danger-text)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{"BL non trouves chez DPWorld :"}</div>
          <div style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{r.errorsBL.join(", ")}</div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 16 }}>
        <button onClick={p.onClose} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Fermer"}</button>
      </div>
    </div>
  );
}

export default SyncReport;
