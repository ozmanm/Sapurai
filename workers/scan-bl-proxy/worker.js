/**
 * scan-bl-proxy — Cloudflare Worker pour structuration d'un Bill of Lading.
 *
 * Pipeline Sapurai v2 (Sprint 33 v2) :
 *   Front : PDF -> Canvas -> Tesseract.js OCR -> texte brut
 *   Worker : texte brut -> Llama 3.1 8B Instruct (text-only) -> JSON structure
 *
 * Pourquoi text-only au lieu de vision ?
 *   - Tesseract.js fait de l'OCR pur avec 95%+ de precision sur texte imprime
 *   - Llama 3.1 8B text-only est nettement meilleur que Llama Vision 11B pour
 *     suivre des instructions structurees et eviter les hallucinations
 *   - Plus econome en neurons que les modeles Vision (5-10x moins)
 *
 * Endpoints :
 *   POST /scan      Body : { text: '...OCR...' } ou { image: 'data:...' } (legacy fallback)
 *   GET  /accept-license  Pour les modeles necessitant une acceptation one-shot
 *
 * Binding requis (wrangler.toml) :
 *   [ai] binding = "AI"
 *
 * Variables optionnelles :
 *   SCAN_MODEL_TEXT  : modele text-only (defaut @cf/meta/llama-3.1-8b-instruct)
 *   SCAN_MODEL_VISION : modele vision si fallback image (defaut @cf/meta/llama-3.2-11b-vision-instruct)
 */

var DEFAULT_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
var DEFAULT_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

var EXTRACTION_PROMPT = [
  "You are a structured information extractor for maritime Bill of Lading (BL) documents.",
  "The user message contains RAW OCR TEXT from a BL document. Some characters may be misread.",
  "Extract the fields below and reply with RAW JSON only (no prose, no markdown, no backticks, no explanation).",
  "",
  "STRICT RULES — IF UNSURE, RETURN EMPTY STRING. NEVER INVENT.",
  "",
  "1. \"bl\" = the BL/Waybill number, usually labeled \"BL No\", \"B/L No\", \"Bill of Lading No\", \"Waybill Number\", \"Booking No\". It is typically alphanumeric (e.g. LHV3891471, MEDUKQ914799, S329270640). Do NOT confuse with barcode digits or reference numbers.",
  "",
  "2. \"client\" = the CONSIGNEE only (the goods receiver, labeled \"Consignee\" or \"Consignataire\" or \"Destinataire\"). NEVER take from \"Shipper\", \"Notify Party\", \"Notify\", \"Expéditeur\". If no clear Consignee, return \"\".",
  "",
  "3. \"compagnie\" = the carrier SHORT NAME ONLY, NOT the full legal name. Choose ONLY the brand: \"CMA CGM\", \"MAERSK\", \"MSC\", \"COSCO\", \"GRIMALDI\", \"EVERGREEN\", \"HAPAG-LLOYD\", \"ONE\", \"ZIM\", \"YANG MING\", \"PIL\", \"WAN HAI\", \"HMM\", \"OOCL\". Never include \"Société Anonyme\", \"S.p.A.\", \"Ltd\", \"S.A.\", \"Capital de X Euros\", \"Deep Sea\" or other suffix. Example: \"CMA CGM Société Anonyme au Capital de 234 988 330 Euros\" → \"CMA CGM\". Example: \"Mediterranean Shipping Company S.A.\" → \"MSC\". Example: \"Grimaldi Deep Sea S.p.A.\" → \"GRIMALDI\".",
  "",
  "4. \"date_arrivee\" = STRICTLY EMPTY unless the OCR text contains a date IMMEDIATELY adjacent to one of these EXACT labels: \"ETA\", \"E.T.A.\", \"Estimated Time of Arrival\", \"Date of Arrival\", \"Arrival Date\", \"Date d'arrivée\", \"Date d'arrivee\". If no such label exists → \"\". A barcode string, reference number, address, or other date (issue date, on-board date, shipping date) is NOT an arrival date → \"\".",
  "",
  "5. \"contact\" = STRICTLY EMPTY unless the phone number appears IN THE CONSIGNEE BLOCK ITSELF (right after the consignee name and address) with a \"Tel:\", \"Phone:\", \"WhatsApp:\", \"Cell:\", or \"Contact:\" label. NEVER take phones from the carrier header, agent, notify party, or anywhere else. If unsure → \"\".",
  "",
  "6. \"conteneurs\" = ALL containers visible in the goods description area. For each:",
  "   - \"numero\" : 4 letters + 7 digits (e.g. MSDU5609366, ACLU9698798). NEVER guess characters.",
  "   - \"type\" : choose ONLY from {20GP, 40GP, 40HC, 20RF, 40RF}. Map: \"20'\" → 20GP, \"40'\" → 40GP, \"40 HC\" / \"40 High Cube\" / \"40' HQ\" / \"45 HC\" / \"45HC\" → 40HC, reefer 20 → 20RF, reefer 40 → 40RF.",
  "   - \"poids\" : GROSS WEIGHT in kilograms as PLAIN NUMBER, no thousand separators (e.g. \"8814\", \"12181\", \"22500\"). NEVER use TARE WEIGHT or NET weight. Watch European format (1.234,56) vs US (1,234.56). A 20-ft = 18000-28000 kg max, 40-ft = 22000-32000 kg max. Above 35000 → you misread separators.",
  "",
  "7. Spell consignee and carrier names EXACTLY as in the text, character by character. Do not auto-correct OCR errors.",
  "",
  "Reply format (RAW JSON only):",
  '{"bl":"","client":"","compagnie":"","date_arrivee":"","contact":"","conteneurs":[{"numero":"","type":"","poids":""}]}'
].join('\n');

function corsHeaders(origin) {
  var allowed = [
    'https://sapurai-84984.web.app',
    'https://sapurai.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  var allowOrigin = allowed.indexOf(origin) >= 0 ? origin : 'https://sapurai-84984.web.app';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin)),
  });
}

function base64ToUint8Array(b64) {
  var clean = b64.indexOf(',') >= 0 ? b64.split(',')[1] : b64;
  var binary = atob(clean);
  var len = binary.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Parse la reponse texte du modele en JSON structure.
 * Tolere : backticks markdown, prose autour du JSON, escapes invalides, smart quotes,
 * trailing commas.
 */
function parseModelResponse(text) {
  var clean = String(text || '').trim();
  if (!clean) return null;
  clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
  clean = clean.replace(/\\([_*\-+.])/g, '$1');

  try { return JSON.parse(clean); } catch (_) {}

  var firstBrace = clean.indexOf('{');
  var lastBrace = clean.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    var block = clean.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(block); } catch (_) {}
    var sanitized = block
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/'/g, '"');
    try { return JSON.parse(sanitized); } catch (_) {}
  }
  return null;
}

function normalizeOutput(parsed) {
  return {
    bl: String(parsed.bl || '').trim(),
    client: String(parsed.client || '').trim(),
    compagnie: String(parsed.compagnie || '').trim(),
    date_arrivee: String(parsed.date_arrivee || '').trim(),
    contact: String(parsed.contact || '').trim(),
    conteneurs: Array.isArray(parsed.conteneurs) ? parsed.conteneurs.map(function (c) {
      return {
        numero: String((c && c.numero) || '').trim(),
        type: String((c && c.type) || '').trim(),
        poids: String((c && c.poids) || '').trim(),
      };
    }) : [],
  };
}

/**
 * Extrait le texte de la reponse aiResult selon la structure renvoyee par
 * Workers AI (varie selon le modele : description / response / result.response / choices).
 * Retourne { rawText, preParsed } - preParsed est non-null si Cloudflare a deja parse le JSON.
 */
function readAiResponse(aiResult) {
  if (typeof aiResult === 'string') {
    return { rawText: aiResult, preParsed: null };
  }
  if (aiResult && aiResult.response && typeof aiResult.response === 'object') {
    return { rawText: JSON.stringify(aiResult.response), preParsed: aiResult.response };
  }
  if (aiResult && typeof aiResult.response === 'string') {
    return { rawText: aiResult.response, preParsed: null };
  }
  if (aiResult && typeof aiResult.description === 'string') {
    return { rawText: aiResult.description, preParsed: null };
  }
  if (aiResult && typeof aiResult.text === 'string') {
    return { rawText: aiResult.text, preParsed: null };
  }
  if (aiResult && aiResult.result && typeof aiResult.result.response === 'string') {
    return { rawText: aiResult.result.response, preParsed: null };
  }
  if (aiResult && Array.isArray(aiResult.choices) && aiResult.choices[0]) {
    var ch = aiResult.choices[0];
    if (ch.message && typeof ch.message.content === 'string') return { rawText: ch.message.content, preParsed: null };
    if (typeof ch.text === 'string') return { rawText: ch.text, preParsed: null };
  }
  return { rawText: JSON.stringify(aiResult || {}), preParsed: null };
}

async function runTextModel(env, ocrText) {
  var model = env.SCAN_MODEL_TEXT || DEFAULT_TEXT_MODEL;
  var aiResult = await env.AI.run(model, {
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: 'OCR TEXT FROM BL:\n\n' + ocrText },
    ],
    max_tokens: 1024,
    temperature: 0.1,
  });
  return { model: model, aiResult: aiResult };
}

async function runVisionModel(env, dataUrl) {
  var model = env.SCAN_MODEL_VISION || DEFAULT_VISION_MODEL;
  var aiResult = await env.AI.run(model, {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.1,
  });
  return { model: model, aiResult: aiResult };
}

async function handleScan(request, env) {
  var origin = request.headers.get('origin');
  if (!env.AI) {
    return jsonResponse({ ok: false, error: 'Workers AI binding (AI) non configure' }, 500, origin);
  }

  var body;
  try { body = await request.json(); } catch (_) {
    return jsonResponse({ ok: false, error: 'JSON body invalide' }, 400, origin);
  }
  if (!body || (!body.text && !body.image)) {
    return jsonResponse({ ok: false, error: 'champ "text" (OCR brut) ou "image" requis' }, 400, origin);
  }

  try {
    var runRes;
    var ocrEcho = '';
    if (body.text) {
      // Pipeline v2 : texte OCR -> Llama text-only (recommande)
      var ocrText = String(body.text).trim();
      if (ocrText.length < 20) {
        return jsonResponse({ ok: false, error: 'texte OCR trop court (<20 chars)' }, 400, origin);
      }
      ocrEcho = ocrText.slice(0, 500);
      runRes = await runTextModel(env, ocrText);
    } else {
      // Pipeline v1 (legacy) : image -> Llama Vision
      var rawImage = String(body.image);
      var dataUrl = rawImage.indexOf('data:') === 0 ? rawImage : ('data:' + (body.mimeType || 'image/jpeg') + ';base64,' + rawImage);
      try { base64ToUint8Array(rawImage); } catch (_) {
        return jsonResponse({ ok: false, error: 'image base64 invalide' }, 400, origin);
      }
      runRes = await runVisionModel(env, dataUrl);
    }

    var ar = readAiResponse(runRes.aiResult);
    var parsed = ar.preParsed || parseModelResponse(ar.rawText);
    if (!parsed) {
      console.log('[scan-bl-proxy] non-JSON raw:', ar.rawText.slice(0, 1000));
      return jsonResponse({
        ok: false,
        error: 'Modele AI a retourne du non-JSON',
        raw: ar.rawText.slice(0, 800),
        model: runRes.model,
      }, 502, origin);
    }

    var data = normalizeOutput(parsed);
    console.log('[scan-bl-proxy] OK model=', runRes.model, 'bl=', data.bl, 'client=', data.client);
    return jsonResponse({
      ok: true,
      data: data,
      model: runRes.model,
      raw: ar.rawText.slice(0, 800),
      ocrText: ocrEcho,
      fetchedAt: Date.now(),
    }, 200, origin);
  } catch (e) {
    var msg = (e && e.message) ? e.message : 'erreur inconnue';
    return jsonResponse({ ok: false, error: 'Workers AI : ' + msg }, 502, origin);
  }
}

/**
 * One-shot endpoint pour accepter une Community License Meta (Llama Vision en a une).
 * GET /accept-license [?model=...]
 */
async function handleAcceptLicense(request, env) {
  var origin = request.headers.get('origin');
  if (!env.AI) return jsonResponse({ ok: false, error: 'AI binding manquant' }, 500, origin);
  var url = new URL(request.url);
  var model = url.searchParams.get('model') || env.SCAN_MODEL_VISION || DEFAULT_VISION_MODEL;
  try {
    var res = await env.AI.run(model, { prompt: 'agree' });
    return jsonResponse({ ok: true, message: 'License acceptee pour ' + model, response: res }, 200, origin);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'Workers AI : ' + (e && e.message ? e.message : 'inconnu') }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    var origin = request.headers.get('origin');
    var url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/accept-license') {
      return handleAcceptLicense(request, env);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed (POST only)' }, 405, origin);
    }

    return handleScan(request, env);
  },
};
