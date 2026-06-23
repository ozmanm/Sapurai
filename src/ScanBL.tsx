// src/ScanBL.tsx
// Scanner BL via pipeline OCR Tesseract + Llama 3.1 text-only (Sprint 33 v2).
// Avant : Gemini 2.0 Flash (desactive Sprint 27 cause quota Senegal).
// Sprint 33 v1 : LLaVA / Llama Vision (modeles vision hallucinent les codes alphanumeriques).
// Sprint 33 v2 : pipeline hybride - Tesseract.js fait l'OCR brut (precis sur le texte imprime),
//   Llama 3.1 8B text-only structure le texte en JSON (excellent en suivi d'instructions).
import { useState } from 'react';
import type { ChangeEvent } from 'react';

// URL du Worker scan-bl-proxy (deploye via wrangler).
var SCAN_URL = "https://scan-bl-proxy.ozmanm10.workers.dev/scan";

interface ScanBLProps {
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

type ScanStage = "idle" | "pdf" | "ocr" | "ai";

export default function ScanBL(p: ScanBLProps) {
  var [stage, setStage] = useState<ScanStage>("idle");
  var [err, setErr] = useState("");
  var [preview, setPreview] = useState<ScanPreview | null>(null);
  // Cumul progress Tesseract (0-100)
  var [ocrProgress, setOcrProgress] = useState(0);
  var loading = stage !== "idle";

  /**
   * Convertit la 1ere page d'un PDF en canvas via pdfjs-dist (lazy load).
   * Retourne le canvas pour pouvoir le passer directement a Tesseract (evite un round-trip JPEG).
   */
  async function pdfToCanvas(file: File): Promise<HTMLCanvasElement> {
    var pdfjsLib: any = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();

    var arrayBuffer = await file.arrayBuffer();
    // CMA CGM BL = souvent XFA forms : pdfjs rend BLANC sans enableXfa. useSystemFonts couvre
    // les polices PDF absentes (texte invisible -> canvas vide).
    var pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      enableXfa: true,
      useSystemFonts: true,
    }).promise;
    var page = await pdf.getPage(1);

    // Echelle ADAPTATIVE : viser ~2200px de large (suffisant OCR/vision), plafonnee pour ne
    // PAS depasser la limite canvas du navigateur sur les PDF a grande page (scans haute-def).
    // `scale:3` aveugle ecrasait : page large -> canvas > limite -> render BLANC -> OCR/vision vide
    // + Tesseract qui mouline des minutes sur le vide.
    var base = page.getViewport({ scale: 1 });
    var scale = Math.min(3, 2200 / base.width);
    var viewport = page.getViewport({ scale: scale });
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("canvas 2d context indisponible");

    await page.render({ canvasContext: ctx, viewport: viewport, canvas: canvas }).promise;
    // Debug diag (temporaire) : signale un render blanc (canvas vide) en console.
    try {
      var px = ctx.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
      var blank = px[0] > 250 && px[1] > 250 && px[2] > 250;
      // eslint-disable-next-line no-console
      console.log('[scan-debug] canvas ' + canvas.width + 'x' + canvas.height + ' centerRGB ' + px[0] + ',' + px[1] + ',' + px[2] + (blank ? ' = BLANC (render foire)' : ' = contenu OK'));
    } catch (_e) { /* getImageData peut throw, ignore */ }
    return canvas;
  }

  /**
   * Lance Tesseract OCR sur un canvas/blob/dataURL. Langues : anglais + francais
   * (les BL maritimes utilisent souvent les deux : "Consignee" / "Consignataire").
   */
  async function runOcr(source: HTMLCanvasElement | string): Promise<string> {
    var tesseract: any = await import('tesseract.js');
    var result = await tesseract.recognize(source, 'eng+fra', {
      logger: function (m: any) {
        if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
          setOcrProgress(Math.round(m.progress * 100));
        }
      },
    });
    return (result && result.data && result.data.text) || '';
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    setErr("");
    setPreview(null);
    setOcrProgress(0);

    var isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    runPipeline(file, isPdf).catch(function (ex: any) {
      setErr("Erreur scan : " + (ex && ex.message ? ex.message : "inconnue"));
      setStage("idle");
    });
  }

  async function runPipeline(file: File, isPdf: boolean) {
    var source: HTMLCanvasElement | string;
    if (isPdf) {
      setStage("pdf");
      source = await pdfToCanvas(file);
    } else {
      // Image directe : on la passe a Tesseract via dataURL
      source = await new Promise<string>(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (ev) {
          var d = typeof ev.target?.result === "string" ? ev.target.result : "";
          resolve(d);
        };
        reader.onerror = function () { reject(new Error("lecture image impossible")); };
        reader.readAsDataURL(file);
      });
    }

    // Image dataURL pour fallback vision (reutilise le canvas PDF, pas de re-render).
    var imageDataURL = typeof source === "string" ? source : source.toDataURL("image/jpeg", 0.85);

    setStage("ocr");
    var ocrText = await runOcr(source);
    // T3 (OCR multi-qualite) : si Tesseract sort faible/junk (< 100 chars utiles) -> bascule
    // vision gemma sur l'image (scans pourris, photos basse qualite) au lieu d'echouer. BL
    // digital (texte propre) reste sur le chemin text (rapide, econome neurons).
    var cleanLen = ocrText.replace(/[^a-zA-Z0-9]/g, "").length;

    setStage("ai");
    var data: any = null;
    if (cleanLen >= 100) {
      // Texte OCR consistant -> chemin text (rapide, econome). Mais si l'extraction revient
      // vide (junk OCR qui passe le seuil de longueur), on bascule quand meme sur la vision.
      try { data = await callWorker({ text: ocrText }); } catch (_e) { data = null; }
    }
    if (!data || !data.bl) {
      // Scan image / photo basse qualite / text-path vide -> vision gemma directe sur l'image.
      data = await callWorker({ image: imageDataURL });
    }
    setPreview(data);
    setStage("idle");
  }

  async function callWorker(payload: { text?: string; image?: string }) {
    try {
      var response = await fetch(SCAN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      var json: any = null;
      try {
        json = await response.json();
      } catch (_e) {
        throw new Error("reponse non-JSON du Worker (HTTP " + response.status + ")");
      }

      if (!response.ok || !json || !json.ok) {
        var detail = (json && (json.error || json.detail)) || ("HTTP " + response.status);
        // Si le Worker a renvoye le `raw` du modele (cas non-JSON), l'inclure pour debug
        if (json && json.raw) {
          detail = String(detail) + " — Reponse modele : " + String(json.raw).slice(0, 300);
        }
        throw new Error(String(detail).slice(0, 600));
      }

      // Normalise les poids et les numeros de conteneurs des l'affichage preview
      // (avant c'etait fait dans applyData() au clic, mais l'utilisateur voyait
      // "7000000 kg" aberrant). Lambda safe-no-op si data manquant.
      var data = json.data || {};
      if (Array.isArray(data.conteneurs)) {
        data.conteneurs = data.conteneurs.map(function (c: any) {
          return {
            numero: String(c.numero || "").toUpperCase().replace(/\s/g, ""),
            type: c.type || "",
            poids: normalizeWeight(c.poids),
          };
        });
      }
      // Post-processing metier : corrige les confusions OCR connues selon la compagnie
      data = applyCarrierHeuristics(data);
      return data;
    } catch (ex: any) {
      // Remonte a runPipeline/handleFile (gere err + stage) ; permet aussi le fallback vision
      // quand le text-path throw (worker erreur sur OCR junk).
      throw ex;
    }
  }

  /**
   * Post-processing metier des donnees extraites, basee sur la compagnie identifiee.
   * Corrige les confusions OCR connues (Tesseract confond S/5, O/0, I/1, B/8) que
   * l'on peut deduire du pattern de numerotation de chaque armateur.
   *
   * Patterns connus :
   *  - GRIMALDI : BL commence TOUJOURS par "S" suivi de 9 chiffres (ex: S329270640)
   *  - MSC      : BL commence par "MEDU" + lettres + chiffres (ex: MEDUKQ914799)
   *  - CMA CGM  : prefixe 3 lettres (LHV, CHN, etc.) + 7 chiffres
   */
  function applyCarrierHeuristics(data: any): any {
    if (!data || typeof data !== 'object') return data;
    var carrier = String(data.compagnie || "").toUpperCase();
    var bl = String(data.bl || "");

    // GRIMALDI : si BL commence par un chiffre, c'est forcement un "S" mal lu
    if (carrier.indexOf("GRIMALDI") >= 0 && bl.length >= 9 && /^\d/.test(bl)) {
      data.bl = "S" + bl.slice(1);
    }

    return data;
  }

  /**
   * Normalise un poids texte (potentiellement avec separateurs FR/US/espaces/unite)
   * en entier kg. Heuristique pour distinguer format US (1,234.56) vs EU (1.234,56).
   * Garde-fou : si > 35 000 kg, c'est aberrant pour 1 conteneur → on tente sans le
   * dernier groupe de separateurs (Llama renvoie souvent "7000,000" = 7000 kg).
   */
  function normalizeWeight(raw: any): string {
    var s = String(raw || "").trim();
    if (!s) return "";
    // Vire l'unite "kg", "kgs.", "kilos", etc.
    s = s.replace(/\s*(kgs?\.?|kilos?|kg)\s*$/i, "").trim();
    // Vire espaces
    s = s.replace(/\s/g, "");
    if (!s) return "";

    // Detection format : si dernier separateur a 3 chiffres apres → c'est un sep. de milliers
    var lastDot = s.lastIndexOf(".");
    var lastComma = s.lastIndexOf(",");
    var n: number;
    if (lastDot < 0 && lastComma < 0) {
      n = parseFloat(s);
    } else if (lastComma > lastDot) {
      // virgule en dernier → format EU (1.234,56) ou US trompeur (7000,000)
      // si exactement 3 chiffres apres la virgule, c'est un separateur de milliers
      var afterComma = s.slice(lastComma + 1);
      if (afterComma.length === 3 && /^\d+$/.test(afterComma)) {
        // "7000,000" → 7000000 ? Mais aberrant → on traite comme separateur de milliers
        n = parseFloat(s.replace(/[.,]/g, ""));
      } else {
        // 1.234,56 → 1234.56
        n = parseFloat(s.replace(/\./g, "").replace(",", "."));
      }
    } else {
      // point en dernier → format US (1,234.56) ou simple decimal
      var afterDot = s.slice(lastDot + 1);
      if (afterDot.length === 3 && /^\d+$/.test(afterDot) && s.indexOf(",") < 0) {
        // "7000.000" → 7000 (decimales nulles) ou 7000000 ? On prend la lecture entiere
        n = parseFloat(s.replace(/,/g, ""));
      } else {
        n = parseFloat(s.replace(/,/g, ""));
      }
    }

    if (isNaN(n)) return "";

    // Garde-fou : si > 35t, on a probablement mal lu les separateurs.
    // Tentative : diviser par 1000 (cas 7000000 → 7000).
    if (n > 35000) {
      var divided = n / 1000;
      if (divided <= 35000 && divided >= 1000) n = divided;
      else return "";  // vraiment aberrant, on vide
    }

    return String(Math.round(n));
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
        return { n: (c.numero || "").toUpperCase(), ty: ty, po: normalizeWeight(c.poids) };
      })
    });
  }

  return (
    <div>
      {err ? <div style={{ background: "var(--danger-light)", color: "var(--danger-text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div> : null}

      {!loading && !preview ? (
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{"📷"}</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>{"Scannez votre BL"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>{"Prenez en photo ou uploadez le PDF du connaissement (page 1). L'IA extraira automatiquement les informations."}</div>
          <label style={{ display: "inline-block", background: "var(--success)", color: "white", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>
            {"📷 Choisir image / PDF"}
            <input type="file" accept="image/*,.pdf" onChange={handleFile} style={{ display: "none" }} capture="environment" />
          </label>
        </div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px 10px" }}>
          <div style={{ fontSize: 36, marginBottom: 12, animation: "spin 1s linear infinite" }}>{"⚙️"}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-tertiary)" }}>
            {stage === "pdf" ? "Conversion PDF en image..." : null}
            {stage === "ocr" ? ("Lecture OCR du document... " + ocrProgress + "%") : null}
            {stage === "ai" ? "Structuration des informations..." : null}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
            {stage === "pdf" ? "Rendu de la 1ere page" : null}
            {stage === "ocr" ? "Lecture des caracteres (peut prendre 10-20s sur mobile)" : null}
            {stage === "ai" ? "Llama extrait les champs structures" : null}
          </div>
          <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        </div>
      ) : null}

      {preview ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success)", marginBottom: 6 }}>{"✅ Informations extraites :"}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--warning-bg, #fff8e1)", borderRadius: 6, padding: "6px 10px", marginBottom: 12, border: "1px dashed var(--border)" }}>
            {"⚠️ Verifie chaque champ avant de valider. L'OCR peut confondre certains caracteres (S/5, O/0, I/1, B/8) ou inclure du texte parasite."}
          </div>
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
            <button onClick={function () { setPreview(null); setStage("idle"); }} style={{ background: "transparent", border: "2px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 12, color: "var(--text-primary)", minHeight: 44 }}>{"Rescanner"}</button>
            <button onClick={applyData} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13, minHeight: 44 }}>{"Utiliser ces donnees"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
