import { useState } from 'react';
import { fm } from '../../utils/format.js';

/**
 * Modale qui apparait quand l'utilisateur saisit la date de retour d'un TC
 * et que les jours de detention depassent la franchise contractuelle.
 *
 * Choix offerts a l'admin :
 *  - "Defalquer la caution"  -> creation d'un Depense detention_vide payee depuis caution + maj statut caution
 *  - "Paye par banque"       -> creation d'un Depense detention_vide payee normale
 *  - "Plus tard"             -> simple stub en attente de facture
 */

interface DetentionModalProps {
  did: string;
  jours: number;
  depassement: number;
  franchise: number;
  dos: any[];
  cfg?: any;
  addDep: (d: any) => void;
  patchDos: (dosId: string, fields: Record<string, any>) => void;
  closeDos: (dosId: string) => void;
  onClose: () => void;
}

function DetentionModal(p: DetentionModalProps) {
  var d = p.dos.find(function (x: any) { return x.id === p.did; });
  var [montant, setMontant] = useState<string>("");
  var [mode, setMode] = useState<string>("");

  var tarifJour = (p.cfg && p.cfg.ts) ? p.cfg.ts : 25000;
  var estimation = p.depassement * tarifJour;

  function handleStubLater() {
    p.addDep({
      did: p.did, tp: "COMPAGNIE", mt: 0, ht: 0,
      dt: new Date().toISOString().slice(0, 10),
      ds: "Detention conteneur vide (" + p.jours + "j, depassement " + p.depassement + "j)",
      s: "ATT",
      status: "en_attente_facture",
      auto: true,
      categorie: "detention_vide",
    });
    p.onClose();
  }

  function handleSave() {
    var mt = parseFloat(montant) || 0;
    if (mt <= 0) { handleStubLater(); return; }
    var basePayload: any = {
      did: p.did, tp: "COMPAGNIE",
      mt: mt, ht: mt,
      dt: new Date().toISOString().slice(0, 10),
      ds: "Detention conteneur vide " + p.depassement + "j" + (mode === "caution" ? " (defalque caution)" : mode === "banque" ? " (paye banque)" : ""),
      s: "PAYE",
      status: "payee",
      auto: false,
      categorie: "detention_vide",
    };
    p.addDep(basePayload);
    if (mode === "caution" && d) {
      // Defalquer du montant caution + marquer statut "RETENUE" si tout retenu
      var newCaut = (d.gar_caution || 0) - mt;
      p.patchDos(p.did, { gar_caution: newCaut < 0 ? 0 : newCaut, gar_statut: "RETENUE" });
    }
    // Apres enregistrement, demander cloture si tous TC retournes (l'auto-cloture est bloquee, on cloture manuellement maintenant)
    if (d && d.st !== "CLOTURE") {
      setTimeout(function () { p.closeDos(p.did); }, 100);
    }
    p.onClose();
  }

  return (
    <div>
      <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--warning-text)", marginBottom: 6 }}>{"⚠ Détention conteneur détectée"}</div>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
          {"Le TC est resté "}<strong>{p.jours} jours</strong>{" hors port (franchise : "}<strong>{p.franchise}j</strong>{"). "}
          {"Soit "}<strong style={{ color: "var(--danger)" }}>{p.depassement} jour(s) de dépassement</strong>{"."}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
          {"Estimation indicative : "}<strong>{fm(estimation)}</strong>{" (sur la base de " + fm(tarifJour) + "/jour)"}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>{"Mode de règlement"}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="radio" name="mode" value="banque" checked={mode === "banque"} onChange={function () { setMode("banque"); }} />
            <span>{"Réglée par banque (sortie de trésorerie)"}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="radio" name="mode" value="caution" checked={mode === "caution"} onChange={function () { setMode("caution"); }} />
            <span>{"Défalquer de la caution versée" + (d && d.gar_caution > 0 ? " (caution actuelle : " + fm(d.gar_caution) + ")" : "")}</span>
          </label>
        </div>
      </div>

      {mode ? (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>{"Montant facturé (FCFA)"}</label>
          <input type="number" value={montant} onChange={function (e) { setMontant(e.target.value); }} placeholder={String(estimation)} style={{ width: "100%", padding: "8px 11px", border: "2px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--bg-primary)", color: "var(--text-input)" }} autoFocus />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{"Saisissez le montant exact de la facture détention reçue."}</div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <button onClick={handleStubLater} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44, fontSize: 13 }}>{"Plus tard (stub en attente)"}</button>
        <button onClick={handleSave} disabled={!mode} style={{ background: mode ? "var(--btn-primary-bg)" : "var(--bg-secondary)", color: mode ? "var(--btn-primary-text)" : "var(--text-muted)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: mode ? "pointer" : "not-allowed", minHeight: 44, fontSize: 14, opacity: mode ? 1 : 0.6 }}>{"Enregistrer + clôturer"}</button>
      </div>
    </div>
  );
}

export default DetentionModal;
