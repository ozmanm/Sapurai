import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { IS, LS } from '../../constants/styles.js';
import { today } from '../../utils/date.js';
import { mid } from '../../utils/id.js';
import { fd } from '../../utils/format.js';
import { fileStore } from '../../fileStore.js';

interface JdocViewProps { did: string; dos: any[]; companyId: string; nf: (m: string, t?: string) => void; sv: (data: any) => void; db: any; setMl?: (ml: any) => void; }
type PreviewState = null | { loading: boolean; id: string; data?: string; ft?: string; name?: string };

function JdocView(p: JdocViewProps) {
  var d = p.dos.find(function (x) { return x.id === p.did; });
  var [tp, setTp] = useState("BAD");
  var [uploading, setUploading] = useState(false);
  var [preview, setPreview] = useState<PreviewState>(null);
  if (!d) return <div>{"?"}</div>;
  var docs = d.docs || [];
  var DTYPES = ["BAD", "BAE", "Pregate", "BL", "Facture", "Ticket Interchange", "Ordre Mission", "Quittance", "Autre"];

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    var files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (var fi = 0; fi < files.length; fi++) {
      var f0 = files[fi];
      var ext = (f0.name.split(".").pop() || "").toLowerCase();
      if (ext !== "pdf" && ext !== "jpg" && ext !== "jpeg" && ext !== "png") { p.nf("Format accepte: PDF, JPG, PNG", "error"); return; }
      if (f0.size > 4 * 1024 * 1024) { p.nf("Trop volumineux (max 4MB): " + f0.name, "error"); return; }
    }
    setUploading(true);
    var pending = files.length;
    var newDocs = docs.slice();
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var docId = (p.companyId ? p.companyId + "-" : "") + mid();
        var data = typeof ev.target?.result === "string" ? ev.target.result : "";
        fileStore.set("lt-file-" + docId, data).then(function () {
          newDocs.push({ id: docId, tp: tp, fn: file.name, ft: file.type, sz: file.size, dt: today() });
          pending--;
          if (pending === 0) {
            p.sv(Object.assign({}, p.db, { dos: p.dos.map(function (x) { return x.id === d.id ? Object.assign({}, x, { docs: newDocs }) : x; }) }));
            p.nf(files.length > 1 ? String(files.length) + " documents uploades" : "Document uploade");
            setUploading(false);
          }
        }).catch(function () { p.nf("Erreur stockage", "error"); setUploading(false); });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function delDoc(docId: string) {
    fileStore.delete("lt-file-" + docId).catch(function () {});
    var nd = docs.filter(function (x) { return x.id !== docId; });
    p.sv(Object.assign({}, p.db, { dos: p.dos.map(function (x) { return x.id === d.id ? Object.assign({}, x, { docs: nd }) : x; }) }));
    p.nf("Document supprime");
  }

  function viewDoc(docId: string, ft: string) {
    setPreview({ loading: true, id: docId });
    fileStore.get("lt-file-" + docId).then(function (r) {
      if (r && typeof r.value === "string") setPreview({ loading: false, id: docId, data: r.value, ft: ft });
      else setPreview(null);
    }).catch(function () { setPreview(null); p.nf("Fichier introuvable", "error"); });
  }

  function fmtSize(b: number) {
    if (b < 1024) return String(b) + " o";
    if (b < 1024 * 1024) return String(Math.round(b / 1024)) + " Ko";
    return String((b / (1024 * 1024)).toFixed(1)) + " Mo";
  }

  return (
    <div>
      {preview ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{"Apercu"}</span>
            <button onClick={function () { setPreview(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-secondary)" }}>{"x"}</button>
          </div>
          {preview.loading ? <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>{"Chargement..."}</div> : null}
          {!preview.loading && preview.data && (preview.ft || "").indexOf("image") >= 0 ? <img src={preview.data} alt={"Apercu du document " + (preview.name || "joint")} style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 8, background: "var(--bg-secondary)" }} /> : null}
          {!preview.loading && preview.data && (preview.ft || "").indexOf("pdf") >= 0 ? <iframe src={preview.data} style={{ width: "100%", height: 400, border: "1px solid var(--border)", borderRadius: 8 }} /> : null}
          {!preview.loading && preview.data ? <div style={{ marginTop: 8, textAlign: "center" }}><a href={preview.data} download={"document"} style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{"Telecharger"}</a></div> : null}
        </div>
      ) : null}
      <div style={{ marginBottom: 14, background: "var(--bg-tertiary)", borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{(d.cl || "") + " - " + (d.bl || "")}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}><label style={LS}>{"Type"}</label><select value={tp} onChange={function (e) { setTp(e.target.value); }} style={IS}>{DTYPES.map(function (t) { return <option key={t} value={t}>{t}</option>; })}</select></div>
          <label style={{ background: uploading ? "var(--text-muted)" : "var(--btn-primary-bg)", color: "white", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: uploading ? "default" : "pointer", fontSize: 13, whiteSpace: "nowrap", display: "inline-block", textAlign: "center" }}>
            {uploading ? "Upload..." : "Joindre PDF / Image"}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} style={{ display: "none" }} disabled={uploading} multiple />
          </label>
        </div>
      </div>
      {docs.length === 0 ? <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>{"Aucun document joint"}</div> : null}
      {docs.map(function (dc) {
        var isImg = (dc.ft || "").indexOf("image") >= 0;
        var isPdf = (dc.ft || "").indexOf("pdf") >= 0;
        var icon = isPdf ? "\uD83D\uDCC4" : isImg ? "\uD83D\uDDBC\uFE0F" : "\uD83D\uDCCE";
        return <div key={dc.id} style={{ background: "var(--bg-primary)", borderRadius: 8, padding: 10, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--border)" }}>
          <div style={{ flex: 1 }}>
            <div><span style={{ fontSize: 14, marginRight: 6 }}>{icon}</span><span style={{ fontWeight: 700, fontSize: 13 }}>{dc.tp}</span><span style={{ color: "var(--text-secondary)", fontSize: 11, marginLeft: 8 }}>{fd(dc.dt)}</span></div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{(dc.fn || "fichier") + " (" + fmtSize(dc.sz || 0) + ")"}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={function () { viewDoc(dc.id, dc.ft); }} style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{"Voir"}</button>
            <button onClick={function () { delDoc(dc.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 14 }}>{"x"}</button>
          </div>
        </div>;
      })}
    </div>
  );
}

export default JdocView;
