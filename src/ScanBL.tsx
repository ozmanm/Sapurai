// src/ScanBL.jsx
// Scanner BL avec Gemini API (gratuit) - extrait les infos du connaissement
import { useState } from 'react';
import type { ChangeEvent } from 'react';

var GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

var PROMPT = `Tu es un assistant specialise dans le transit maritime. Analyse cette image/document de connaissement (Bill of Lading / BL) et extrais les informations suivantes au format JSON strict.

Reponds UNIQUEMENT avec du JSON, sans aucun texte avant ou apres, sans backticks:
{
  "bl": "numero du BL",
  "client": "nom du destinataire/consignee/notify party",
  "compagnie": "compagnie maritime / armateur",
  "date_arrivee": "date ETA au format YYYY-MM-DD si disponible",
  "contact": "telephone si visible",
  "conteneurs": [
    { "numero": "XXXX1234567", "type": "20GP ou 40HC etc", "poids": "en kg" }
  ]
}

Si une information n'est pas visible, mets une chaine vide. Pour les conteneurs, extrais tous ceux visibles. Le type doit etre parmi: 20GP, 40GP, 40HC, 20RF, 40RF.`;

interface ScanBLProps {
  apiKey: string;
  onResult: (data: any) => void;
}
type ScanPreview = {
  bl?: string;
  client?: string;
  compagnie?: string;
  date_arrivee?: string;
  contact?: string;
  conteneurs?: Array<{ numero?: string; type?: string; poids?: string | number }>;
};

export default function ScanBL(p: ScanBLProps) {
  var [loading, setLoading] = useState(false);
  var [err, setErr] = useState("");
  var [preview, setPreview] = useState<ScanPreview | null>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var apiKey = p.apiKey;
    if (!apiKey) {
      setErr("Cle API Gemini requise. Allez dans Parametres pour la configurer.");
      return;
    }

    setErr("");
    setLoading(true);
    setPreview(null);

    var reader = new FileReader();
    reader.onload = function (ev) {
      var dataUrl = typeof ev.target?.result === "string" ? ev.target.result : "";
      var base64 = dataUrl.split(",")[1];
      var mimeType = file.type || "image/jpeg";

      // Handle PDF
      if (file.name.toLowerCase().endsWith(".pdf")) {
        mimeType = "application/pdf";
      }

      callGemini(apiKey, base64, mimeType);
    };
    reader.readAsDataURL(file);
  }

  async function callGemini(apiKey, base64, mimeType) {
    try {
      var response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]
          }]
        })
      });

      if (!response.ok) {
        var errText = await response.text();
        throw new Error("API error " + response.status + ": " + errText.slice(0, 200));
      }

      var data = await response.json();
      var text = "";
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        text = data.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("");
      }

      // Clean and parse JSON
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      var parsed = JSON.parse(text);
      setPreview(parsed);
      setLoading(false);
    } catch (ex) {
      setErr("Erreur: " + ex.message);
      setLoading(false);
    }
  }

  function applyData() {
    if (!preview) return;
    p.onResult({
      bl: (preview.bl || "").toUpperCase(),
      cl: (preview.client || "").toUpperCase(),
      cp: (preview.compagnie || "").toUpperCase(),
      da: preview.date_arrivee || "",
      ct: preview.contact || "",
      tcs: (preview.conteneurs || []).map(function (c) {
        var ty = (c.type || "20GP").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (["20GP", "40GP", "40HC", "20RF", "40RF"].indexOf(ty) < 0) ty = "20GP";
        return { n: (c.numero || "").toUpperCase(), ty: ty, po: String(c.poids || "").replace(/[^0-9]/g, "") };
      })
    });
  }

  return (
    <div>
      {err ? <div style={{ background: "var(--danger-light)", color: "var(--danger-text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div> : null}

      {!loading && !preview ? (
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{"\uD83D\uDCF7"}</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>{"Scannez votre BL"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>{"Prenez en photo ou uploadez le PDF du connaissement. L'IA extraira automatiquement les informations."}</div>
          <label style={{ display: "inline-block", background: "var(--success)", color: "white", padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {"\uD83D\uDCF7 Choisir image / PDF"}
            <input type="file" accept="image/*,.pdf" onChange={handleFile} style={{ display: "none" }} capture="environment" />
          </label>
        </div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px 10px" }}>
          <div style={{ fontSize: 36, marginBottom: 12, animation: "spin 1s linear infinite" }}>{"\u2699\uFE0F"}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-tertiary)" }}>{"Analyse du document en cours..."}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{"L'IA lit votre BL et extrait les informations"}</div>
          <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        </div>
      ) : null}

      {preview ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success)", marginBottom: 12 }}>{"\u2705 Informations extraites :"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>{"BL"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{preview.bl || "---"}</div>
            </div>
            <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>{"CLIENT"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{preview.client || "---"}</div>
            </div>
            <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>{"COMPAGNIE"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{preview.compagnie || "---"}</div>
            </div>
            <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>{"DATE ARRIVEE"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{preview.date_arrivee || "---"}</div>
            </div>
          </div>
          {preview.conteneurs && preview.conteneurs.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 6 }}>{"Conteneurs (" + String(preview.conteneurs.length) + ") :"}</div>
              {preview.conteneurs.map(function (c, idx) {
                return <div key={idx} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "6px 10px", marginBottom: 4, display: "flex", gap: 12, fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>{c.numero || "?"}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{c.type || "?"}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{c.poids ? c.poids + " kg" : ""}</span>
                </div>;
              })}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={function () { setPreview(null); setLoading(false); }} style={{ background: "transparent", border: "2px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 12, color: "var(--text-primary)" }}>{"Rescanner"}</button>
            <button onClick={applyData} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{"Utiliser ces donnees"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
