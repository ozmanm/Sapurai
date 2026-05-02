/**
 * carrier-proxy — Cloudflare Worker scraper multi-armateurs
 *
 * Scope minimal : recuperer JUSTE la date d'arrivee + n° TC + type
 * pour les 6 armateurs principaux Sapurai (CMA, Maersk, MSC, Hapag, ONE, Grimaldi).
 *
 * Strategie best-effort :
 *  1. Detection automatique de l'armateur depuis dos.cp ou prefixe BL
 *  2. Pour chaque armateur, on tente :
 *     a) Endpoint API public connu (le plus stable)
 *     b) Fetch HTML + regex sur les patterns de date (fallback)
 *  3. Cache 1h en memoire pour eviter de spam les sites
 *  4. Format de sortie unifie : { ok, carrier, arrivalDate, containers, raw }
 *
 * NB CMA : on a deja un Worker dedie cma-proxy avec API officielle. Pour
 * eviter de gaspiller le quota CMA (20/h), on ne re-implemente pas CMA
 * ici. Le service Sapurai routera les BL CMA vers cma-proxy.
 *
 * Endpoints :
 *  GET /?bl=BL_NUMBER&carrier=msc          (carrier optionnel : detection auto si absent)
 *  GET /?bl=BL_NUMBER&cp=MAERSK             (cp = compagnie maritime du dossier)
 */

var CACHE_TTL_MS = 60 * 60 * 1000;     // 1h cache
var FETCH_TIMEOUT_MS = 12 * 1000;       // 12s timeout
var responseCache = new Map();

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

// ----- Detection armateur ---------------------------------------------------

function detectCarrier(bl, hint) {
  var b = (bl || '').toUpperCase().trim();
  var h = (hint || '').toUpperCase();
  // Hint explicite (compagnie du dossier) prioritaire
  if (h.indexOf('CMA') >= 0) return 'cma';
  if (h.indexOf('MAERSK') >= 0) return 'maersk';
  if (h.indexOf('MSC') >= 0) return 'msc';
  if (h.indexOf('HAPAG') >= 0 || h.indexOf('HLAG') >= 0) return 'hapag';
  if (h.indexOf('GRIMALDI') >= 0) return 'grimaldi';
  if (h.indexOf('ONE') >= 0 || h.indexOf('OCEAN NETWORK') >= 0) return 'one';
  // Detection par prefixe BL
  if (/^MEDU/.test(b) || /^MED[A-Z]/.test(b)) return 'msc';
  if (/^HLCU/.test(b) || /^HLAG/.test(b)) return 'hapag';
  if (/^MAEU/.test(b) || /^MRSU/.test(b) || /^26[0-9]{7}$/.test(b) || /^265[0-9]{6}/.test(b)) return 'maersk';
  if (/^CMA/.test(b) || /^CHN/.test(b) || /^CAN/.test(b) || /^GGZ/.test(b) || /^NGP/.test(b)) return 'cma';
  if (/^NK[0-9A-Z]/.test(b) || /^NBOG/.test(b) || /^ONEY/.test(b)) return 'one';
  if (/^S[0-9]{7,}/.test(b)) return 'grimaldi';
  return null;
}

// ----- Helper fetch avec timeout --------------------------------------------

async function fetchWithTimeout(url, options) {
  options = options || {};
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
  try {
    var res = await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Parse une date dans plusieurs formats vers ISO YYYY-MM-DD
function parseDate(str) {
  if (!str) return null;
  var s = String(str).trim();

  // Format ISO YYYY-MM-DD
  var iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];

  // Format DD/MM/YYYY ou DD-MM-YYYY
  var fr = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (fr) {
    return fr[3] + '-' + fr[2].padStart(2, '0') + '-' + fr[1].padStart(2, '0');
  }

  // Format YYYY/MM/DD
  var ymd = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    return ymd[1] + '-' + ymd[2].padStart(2, '0') + '-' + ymd[3].padStart(2, '0');
  }

  // Fallback : Date.parse
  var t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().split('T')[0];
  return null;
}

var DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ----- Scrapers par armateur -----------------------------------------------

// MAERSK : page tracking publique. Pattern courant : "Estimated time of arrival" + date
async function scrapMaersk(bl) {
  var url = 'https://www.maersk.com/tracking/' + encodeURIComponent(bl);
  try {
    var res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return { ok: false, error: 'Maersk HTTP ' + res.status };
    var html = await res.text();
    // Tente plusieurs patterns selon le rendu (SSR partiel ou JS-rendu)
    var arrivalDate = null;
    var patterns = [
      /"plannedArrivalDateTime"\s*:\s*"([^"]+)"/,
      /"arrivalDateTime"\s*:\s*"([^"]+)"/,
      /"actualArrivalDateTime"\s*:\s*"([^"]+)"/,
      /"estimatedTimeOfArrival"\s*:\s*"([^"]+)"/,
      /Estimated time of arrival[^<]*<[^>]*>\s*([0-9]{1,2}[\/\-\s][A-Za-z0-9]{3,}[\/\-\s][0-9]{2,4})/i,
      /Arrival[^<]*<[^>]*>\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = html.match(patterns[i]);
      if (m && m[1]) {
        arrivalDate = parseDate(m[1]);
        if (arrivalDate) break;
      }
    }
    return { ok: true, carrier: 'maersk', arrivalDate: arrivalDate, containers: [], note: arrivalDate ? null : 'Date non trouvee dans le HTML (page probablement rendue cote JS)' };
  } catch (e) {
    return { ok: false, error: 'Maersk scrap : ' + (e.message || 'reseau') };
  }
}

// MSC : page tracking publique
async function scrapMSC(bl) {
  var url = 'https://www.msc.com/track-a-shipment?agencyPath=msc&searchNumber=' + encodeURIComponent(bl);
  try {
    var res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'text/html' },
    });
    if (!res.ok) return { ok: false, error: 'MSC HTTP ' + res.status };
    var html = await res.text();
    var arrivalDate = null;
    var patterns = [
      /"finalDestinationActualArrivalDate"\s*:\s*"([^"]+)"/,
      /"finalDestinationEstimatedArrivalDate"\s*:\s*"([^"]+)"/,
      /"arrivalDate"\s*:\s*"([^"]+)"/,
      /Arrival\s*(?:Date|date)?[^0-9]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i,
      /POD[^0-9]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = html.match(patterns[i]);
      if (m && m[1]) { arrivalDate = parseDate(m[1]); if (arrivalDate) break; }
    }
    return { ok: true, carrier: 'msc', arrivalDate: arrivalDate, containers: [], note: arrivalDate ? null : 'Date non trouvee (probable SPA rendu JS)' };
  } catch (e) {
    return { ok: false, error: 'MSC scrap : ' + (e.message || 'reseau') };
  }
}

// HAPAG-LLOYD : page tracking publique
async function scrapHapag(bl) {
  var url = 'https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?blno=' + encodeURIComponent(bl);
  try {
    var res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'text/html' },
    });
    if (!res.ok) return { ok: false, error: 'Hapag HTTP ' + res.status };
    var html = await res.text();
    var arrivalDate = null;
    var patterns = [
      /"actualArrivalDate"\s*:\s*"([^"]+)"/,
      /"estimatedArrivalDate"\s*:\s*"([^"]+)"/,
      /"plannedArrival"\s*:\s*"([^"]+)"/,
      /Arrival\s*at\s*POD[^0-9]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4})/i,
      /Arrival[^0-9]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4})/i,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = html.match(patterns[i]);
      if (m && m[1]) { arrivalDate = parseDate(m[1]); if (arrivalDate) break; }
    }
    return { ok: true, carrier: 'hapag', arrivalDate: arrivalDate, containers: [], note: arrivalDate ? null : 'Date non trouvee (probable SPA rendu JS)' };
  } catch (e) {
    return { ok: false, error: 'Hapag scrap : ' + (e.message || 'reseau') };
  }
}

// ONE : page tracking publique
async function scrapONE(bl) {
  var url = 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?blnumber=' + encodeURIComponent(bl);
  try {
    var res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'text/html' },
    });
    if (!res.ok) return { ok: false, error: 'ONE HTTP ' + res.status };
    var html = await res.text();
    var arrivalDate = null;
    var patterns = [
      /"podArrivalDate"\s*:\s*"([^"]+)"/,
      /"arrivalDate"\s*:\s*"([^"]+)"/,
      /Arrival[^0-9]*([0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2})/i,
      /POD[^0-9]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4})/i,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = html.match(patterns[i]);
      if (m && m[1]) { arrivalDate = parseDate(m[1]); if (arrivalDate) break; }
    }
    return { ok: true, carrier: 'one', arrivalDate: arrivalDate, containers: [], note: arrivalDate ? null : 'Date non trouvee (probable SPA rendu JS)' };
  } catch (e) {
    return { ok: false, error: 'ONE scrap : ' + (e.message || 'reseau') };
  }
}

// GRIMALDI : site souvent simple (HTML SSR), scrapable
async function scrapGrimaldi(bl) {
  // Page publique de tracking Grimaldi (Naples)
  var url = 'https://gnet.grimaldi.napoli.it/myshipping/index.jsp?bn=' + encodeURIComponent(bl);
  try {
    var res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'text/html' },
    });
    if (!res.ok) return { ok: false, error: 'Grimaldi HTTP ' + res.status };
    var html = await res.text();
    var arrivalDate = null;
    // Grimaldi affiche typiquement les dates en DD/MM/YYYY dans des cellules tableau
    var patterns = [
      /Arrival[^0-9]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i,
      /Discharge[^0-9]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i,
      /POD[^0-9]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i,
      /([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/g,  // dernier recours : 1ere date trouvee
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = html.match(patterns[i]);
      if (m && m[1]) { arrivalDate = parseDate(m[1]); if (arrivalDate) break; }
    }
    return { ok: true, carrier: 'grimaldi', arrivalDate: arrivalDate, containers: [], note: arrivalDate ? null : 'Date non trouvee dans le HTML' };
  } catch (e) {
    return { ok: false, error: 'Grimaldi scrap : ' + (e.message || 'reseau') };
  }
}

// CMA : on delegue au Worker cma-proxy existant (API officielle)
async function scrapCMA(bl) {
  return {
    ok: false,
    carrier: 'cma',
    error: 'CMA utilise API officielle via cma-proxy — appeler https://cma-proxy.ozmanm10.workers.dev/?bl=' + bl + ' a la place',
    redirectTo: 'https://cma-proxy.ozmanm10.workers.dev/?bl=' + encodeURIComponent(bl),
  };
}

// ----- Routing principal ---------------------------------------------------

var SCRAPERS = {
  cma: scrapCMA,
  maersk: scrapMaersk,
  msc: scrapMSC,
  hapag: scrapHapag,
  one: scrapONE,
  grimaldi: scrapGrimaldi,
};

async function handleTracking(request) {
  var url = new URL(request.url);
  var bl = url.searchParams.get('bl');
  var cp = url.searchParams.get('cp');
  var forced = url.searchParams.get('carrier');

  if (!bl) {
    return jsonResponse({ ok: false, error: 'parametre bl requis' }, 400, request.headers.get('origin'));
  }

  var carrier = forced || detectCarrier(bl, cp);
  if (!carrier) {
    return jsonResponse({
      ok: false,
      error: 'Armateur non detecte. Forcer via &carrier=msc|maersk|cma|hapag|one|grimaldi',
      bl: bl,
      hint: cp,
    }, 400, request.headers.get('origin'));
  }

  // Cache check
  var cacheKey = carrier + '|' + bl;
  var cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return jsonResponse(
      Object.assign({}, cached.payload, { cached: true, cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) }),
      200,
      request.headers.get('origin'),
    );
  }

  var scraper = SCRAPERS[carrier];
  if (!scraper) {
    return jsonResponse({ ok: false, error: 'Aucun scraper pour ' + carrier }, 501, request.headers.get('origin'));
  }

  var result = await scraper(bl);
  result.carrier = carrier;
  result.bl = bl;
  result.fetchedAt = Date.now();

  if (result.ok) {
    responseCache.set(cacheKey, { payload: result, timestamp: Date.now() });
  }
  return jsonResponse(result, result.ok ? 200 : 502, request.headers.get('origin'));
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
    }
    if (request.method !== 'GET') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405, request.headers.get('origin'));
    }
    return handleTracking(request);
  },
};
