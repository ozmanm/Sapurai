import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { today } from '../../utils/date.js';
import { mid } from '../../utils/id.js';
import { fm } from '../../utils/format.js';
import { fileStore } from '../../fileStore.js';
import Btn from '../ui/Btn.tsx';
import { validateAll, FieldError } from '../../utils/validate.js';

interface NDepFormProps { init?: any; did?: string; dos: any[]; companyId: string; nf: (m: string, t?: string) => void; onClose: () => void; onSave: (data: any) => void; }
type FormErrors = Record<string, string>;
type FileInfo = { fn: string; ft: string; sz: number };

function NDepForm(p: NDepFormProps) {
  var i = p.init;
  var [di, sDi] = useState(i ? i.did || p.did || "" : p.did || "");
  var [tp, sTp] = useState(i ? i.tp || "TRANSPORT" : "TRANSPORT");
  var [categorie, sCategorie] = useState(i ? i.categorie || "autre" : "autre");
  var [status, sStatus] = useState(i ? i.status || (i.s === "PAYE" ? "payee" : "a_payer") : "a_payer");
  var [nf2, sNf] = useState(i ? i.nf || "" : "");
  var [ht, sHt] = useState(i ? String(i.ht || "") : "");
  var [ttc, sTtc] = useState(i ? String(i.mt || "") : "");
  var [dt, sDt] = useState(i ? i.dt || today() : today());
  var [ds, sDs] = useState(i ? i.ds || "" : "");
  var [uploading, setUploading] = useState(false);
  var [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  var [fileId, setFileId] = useState<string | null>(null);
  var [vErr, setVErr] = useState<FormErrors>({});

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "pdf" && ext !== "jpg" && ext !== "jpeg" && ext !== "png") { p.nf("PDF, JPG ou PNG", "error"); return; }
    // Sprint 41 F41.7 - Fix P1.7 : limite a 600 Ko.
    // Avant : 4 Mo, incompatible avec Firestore (limite hard 1 MiB par document)
    // + base64 grossit le payload de ~33%. Resultat : uploads instables/impossibles.
    // Quick fix : limite stricte a 600 Ko (apres encodage base64 ~800 Ko, marge ok).
    // Long terme : migration vers Firebase Storage (Sprint 42).
    if (file.size > 600 * 1024) { p.nf("Max 600 Ko (limite Firestore). Compressez ou utilisez un PDF allege.", "error"); return; }
    setUploading(true);
    var reader = new FileReader();
    reader.onload = function (ev) {
      var fid = (p.companyId ? p.companyId + "-" : "") + mid();
      var data = typeof ev.target?.result === "string" ? ev.target.result : "";
      fileStore.set("lt-file-" + fid, data).then(function () {
        setFileInfo({ fn: file.name, ft: file.type, sz: file.size });
        setFileId(fid);
        setUploading(false);
      }).catch(function () { p.nf("Erreur", "error"); setUploading(false); });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div>
      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Dossier *"}</label><select value={di} onChange={function (e) { sDi(e.target.value); }} style={IS}><option value="">{"---"}</option>{p.dos.map(function (d) { return <option key={d.id} value={d.id}>{(d.bl || "") + " - " + (d.cl || "")}</option>; })}</select></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Type"}</label><select value={tp} onChange={function (e) { sTp(e.target.value); }} style={IS}><option value="TRANSPORT">{"Transport"}</option><option value="LOCATION_TC">{"Location TC"}</option><option value="DPWORLD">{"DP World"}</option><option value="DOUANE">{"Douane"}</option><option value="SURESTARIES">{"Surestaries"}</option><option value="DETENTIONS">{"Détentions"}</option><option value="PREGATE">{"Pregate"}</option><option value="AUTRE">{"Autre"}</option></select></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Catégorie"}</label><select value={categorie} onChange={function (e) { sCategorie(e.target.value); }} style={IS}>
          <option value="compagnie_location">{"Location conteneur (compagnie)"}</option>
          <option value="compagnie_debarquement">{"Débarquement / manutention"}</option>
          <option value="surestaries_compagnie">{"Surestaries compagnie"}</option>
          <option value="caution">{"Caution"}</option>
          <option value="lettre_garantie">{"Lettre de garantie"}</option>
          <option value="besc">{"BESC"}</option>
          <option value="orbus">{"ORBUS"}</option>
          <option value="detention_vide">{"Détention conteneur vide"}</option>
          <option value="dpworld">{"DPWorld"}</option>
          <option value="transport_terr">{"Transport terrestre"}</option>
          <option value="autre">{"Autre"}</option>
        </select></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Statut"}</label><select value={status} onChange={function (e) { sStatus(e.target.value); }} style={IS}>
          <option value="en_attente_facture">{"En attente de facture"}</option>
          <option value="a_payer">{"À payer"}</option>
          <option value="payee">{"Payée"}</option>
        </select></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"N° Facture"}</label><input value={nf2} onChange={function (e) { sNf(e.target.value); }} placeholder="FAC-XXXX" style={IS} maxLength={30} /></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Date"}</label><input type="date" value={dt} onChange={function (e) { sDt(e.target.value); }} style={IS} /></div>
        <div style={{ marginBottom: 12 }}><label style={LS}>{"Montant HT *"}</label><input type="number" value={ht} onChange={function (e) { sHt(e.target.value); }} style={IS} /></div>
        {/* Montant TTC payé : visible et requis uniquement si statut = payee. Sinon le TTC est saisi au moment du toggle a_payer -> payee */}
        {status === "payee" ? (
          <div style={{ marginBottom: 12 }}><label style={LS}>{"Montant payé (TTC)"}</label><input type="number" value={ttc} onChange={function (e) { sTtc(e.target.value); }} placeholder={ht ? "Suggéré : " + ht : ""} style={IS} /></div>
        ) : (
          <div style={{ marginBottom: 12 }}><label style={LS}>{"Montant payé"}</label><div style={{ padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, fontStyle: "italic" as const }}>{"Saisi au moment du paiement (passage du statut « À payer » à « Payée »)"}</div></div>
        )}
        <div style={{ marginBottom: 12, gridColumn: "1 / -1" }}><label style={LS}>{"Description"}</label><input value={ds} onChange={function (e) { sDs(e.target.value); }} placeholder="Optionnel..." style={IS} maxLength={200} /></div>
      </div>
      {ht && ttc && parseFloat(ttc) > parseFloat(ht) ? <div style={{ background: "var(--warning-bg)", borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 12, color: "var(--warning-text)" }}>{"Taxes: " + fm(parseFloat(ttc) - parseFloat(ht)) + " (" + ((parseFloat(ttc) / parseFloat(ht) - 1) * 100).toFixed(1) + "%)"}</div> : null}
      <div style={{ marginBottom: 14 }}>
        <label style={{ background: uploading ? "var(--text-muted)" : "var(--bg-tertiary)", border: "2px dashed var(--border)", borderRadius: 8, padding: 14, display: "block", textAlign: "center", cursor: uploading ? "default" : "pointer" }}>
          {fileInfo ? <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>{"\uD83D\uDCC4 " + fileInfo.fn}</span> : <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{uploading ? "Upload..." : "Joindre justificatif (PDF/Image)"}</span>}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} style={{ display: "none" }} disabled={uploading} />
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <Btn variant="ghost" onClick={p.onClose}>{"Annuler"}</Btn>
        <Btn onClick={function () {
          var v = validateAll({
            di: [di, { required: true }],
            ht: [ht, { required: true, minVal: 1, maxVal: 999999999 }],
            ttc: [ttc, { minVal: 0, maxVal: 999999999 }],
            nf2: [nf2, { maxLen: 30 }],
            ds: [ds, { maxLen: 200 }]
          });
          setVErr(v.errors);
          if (v.hasErrors) { p.nf(v.errors.di ? "Dossier requis" : v.errors.ht ? "Montant HT requis (> 0)" : v.firstError, "error"); return; }
          // Statut legacy `s` synchronise avec nouveau `status` : payee => PAYE, sinon ATT
          var legacyS = status === "payee" ? "PAYE" : "ATT";
          // Sprint 41 F41.1 - Fix P1.6 :
          // `mt` (montant TTC) est INDEPENDANT du statut paiement. Avant on mettait
          // mt=0 quand status !== 'payee', ce qui faisait disparaitre les impayes
          // des totaux/marges (totalDep biaise, totalImpaye = 0).
          // Maintenant mt = TTC saisi (ou HT comme fallback) peu importe le statut.
          // Le calcul "paye" reste filtre par status === 'payee' en aval.
          var mtFinal = parseFloat(ttc) || parseFloat(ht) || 0;
          p.onSave({
            did: di, tp: tp, nf: nf2.trim(),
            ht: parseFloat(ht) || 0, mt: mtFinal, dt: dt,
            s: legacyS, status: status, categorie: categorie,
            auto: i ? !!i.auto : false,
            ignored: i ? !!i.ignored : false,
            ds: ds.trim(),
            fid: fileId || (i ? i.fid || "" : ""),
            fi: fileInfo || (i ? i.fi || null : null),
          });
        }}>{i ? "Modifier" : "Enregistrer"}</Btn>
      </div>
    </div>
  );
}

export default NDepForm;
