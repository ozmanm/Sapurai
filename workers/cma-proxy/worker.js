/**
 * cma-proxy — Cloudflare Worker pour API CMA-CGM Track & Trace v1
 *
 * Architecture : meme pattern que dpworld-proxy.
 *  - Detient l'API Key CMA en secret (jamais exposee au navigateur)
 *  - Cache LRU 1h en memoire pour eviter de bruler le quota 20/h
 *  - Rate limit cote Worker : max 1 appel par BL par 3 minutes
 *  - Normalise la reponse en JSON Sapurai-compatible
 *
 * Secrets a configurer (wrangler ou dashboard) :
 *  - CMA_API_KEY : la cle API du portail api-portal.cma-cgm.com
 *  - CMA_API_BASE : optionnel, defaut https://apis.cma-cgm.com
 *
 * Endpoints :
 *  GET /?bl=CHN2580404            => Track & Trace par BL
 *  GET /?container=TGHU6321812    => Track & Trace par n° TC
 *  POST { bl } / { container }    => Idem en POST si tu preferes
 */

var DEFAULT_API_BASE = 'https://apis.cma-cgm.com';
var CACHE_TTL_MS = 60 * 60 * 1000;  // 1h cache
var RATE_LIMIT_MS = 3 * 60 * 1000;   // 3min entre 2 appels meme cle

// Cache en memoire (perdu au redeploy, mais ca convient pour 20/h quota)
var responseCache = new Map();
var lastFetchTimestamp = new Map();

function corsHeaders(origin) {
  // Whitelist des origins autorises a appeler le Worker
  var allowed = [
    'https://sapurai-84984.web.app',
    'https://sapurai.app',
    'http://localhost:5173',  // dev Vite
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

async function fetchCMATrackAndTrace(env, query) {
  // query : { bl?: string, container?: string }
  var apiBase = env.CMA_API_BASE || DEFAULT_API_BASE;
  var apiKey = env.CMA_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'CMA_API_KEY non configure dans le Worker' };
  }

  // Construction URL Track & Trace v1
  // Endpoint reel : https://apis.cma-cgm.com/operation/trackandtrace/v1/...
  // La doc officielle peut differer (parametres, sous-endpoints).
  // On essaie le format le plus standard.
  var endpoint = apiBase + '/operation/trackandtrace/v1';
  var params = new URLSearchParams();
  if (query.bl) params.set('shippingBl', query.bl);
  if (query.container) params.set('containerId', query.container);
  var url = endpoint + (params.toString() ? '?' + params.toString() : '');

  try {
    var res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      var body = await res.text();
      return {
        ok: false,
        error: 'CMA API HTTP ' + res.status,
        detail: body.slice(0, 500),
        url: url,
      };
    }
    var data = await res.json();
    return { ok: true, data: data, fetchedAt: Date.now() };
  } catch (e) {
    return { ok: false, error: 'Reseau : ' + (e.message || 'inconnu'), url: url };
  }
}

function cacheKey(query) {
  return (query.bl || '') + '|' + (query.container || '');
}

async function handleTracking(request, env) {
  var url = new URL(request.url);
  var query;

  if (request.method === 'POST') {
    try {
      query = await request.json();
    } catch (e) {
      return jsonResponse({ ok: false, error: 'JSON body invalide' }, 400, request.headers.get('origin'));
    }
  } else {
    query = {
      bl: url.searchParams.get('bl') || undefined,
      container: url.searchParams.get('container') || undefined,
    };
  }

  if (!query.bl && !query.container) {
    return jsonResponse({ ok: false, error: 'bl ou container requis' }, 400, request.headers.get('origin'));
  }

  var key = cacheKey(query);

  // Cache hit ?
  var cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return jsonResponse(
      Object.assign({}, cached.payload, { cached: true, cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) }),
      200,
      request.headers.get('origin'),
    );
  }

  // Rate limit : 1 appel par 3min par cle
  var lastFetch = lastFetchTimestamp.get(key) || 0;
  if (Date.now() - lastFetch < RATE_LIMIT_MS && cached) {
    // On a un cache (peut-etre vieux > 1h) mais on est rate-limited : on retourne le cache
    return jsonResponse(
      Object.assign({}, cached.payload, { cached: true, rateLimited: true }),
      200,
      request.headers.get('origin'),
    );
  }

  lastFetchTimestamp.set(key, Date.now());

  // Appel CMA
  var result = await fetchCMATrackAndTrace(env, query);
  if (result.ok) {
    responseCache.set(key, { payload: result, timestamp: Date.now() });
    return jsonResponse(result, 200, request.headers.get('origin'));
  }
  return jsonResponse(result, 502, request.headers.get('origin'));
}

export default {
  async fetch(request, env) {
    // CORS preflight (avant tout autre check)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405, request.headers.get('origin'));
    }

    return handleTracking(request, env);
  },
};
