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

var DEFAULT_API_BASE = 'https://apis.cma-cgm.net';
var DEFAULT_TOKEN_URL = 'https://auth.cma-cgm.com/as/token.oauth2';
var CACHE_TTL_MS = 60 * 60 * 1000;  // 1h cache
var RATE_LIMIT_MS = 3 * 60 * 1000;   // 3min entre 2 appels meme cle

// Cache en memoire (perdu au redeploy, mais ca convient pour 20/h quota)
var responseCache = new Map();
var lastFetchTimestamp = new Map();

// Cache token OAuth2 (renouvele avant expiration)
var tokenCache = { token: null, expiresAt: 0 };

/**
 * Obtient un access_token OAuth2 (clientCredentials flow).
 * Cache memoire + buffer 60s avant expiration pour eviter race condition.
 */
async function getAccessToken(env) {
  // Token encore valide ? (avec buffer 60s)
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 60000) {
    return { ok: true, token: tokenCache.token };
  }
  if (!env.CMA_CLIENT_ID || !env.CMA_CLIENT_SECRET) {
    return { ok: false, error: 'CMA_CLIENT_ID ou CMA_CLIENT_SECRET non configures' };
  }
  var tokenUrl = env.CMA_TOKEN_URL || DEFAULT_TOKEN_URL;
  var scope = env.CMA_SCOPE || '';  // optionnel : scope specifique a l'API
  var body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', env.CMA_CLIENT_ID);
  body.set('client_secret', env.CMA_CLIENT_SECRET);
  if (scope) body.set('scope', scope);

  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 10000);
    var res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      var errBody = await res.text();
      return { ok: false, error: 'Auth CMA HTTP ' + res.status, detail: errBody.slice(0, 300) };
    }
    var json = await res.json();
    if (!json.access_token) {
      return { ok: false, error: 'access_token absent de la reponse auth' };
    }
    tokenCache.token = json.access_token;
    var expiresIn = (typeof json.expires_in === 'number' ? json.expires_in : 3600) * 1000;
    tokenCache.expiresAt = Date.now() + expiresIn;
    return { ok: true, token: json.access_token };
  } catch (e) {
    var msg = (e && e.name === 'AbortError') ? 'Timeout 10s sur auth CMA' : 'Reseau auth : ' + (e && e.message ? e.message : 'inconnu');
    return { ok: false, error: msg };
  }
}

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

  // CMA Track & Trace v2.2.0 (DCSA standard) :
  //   - Auth Public (API Key) : events publics (date arrivee, vessel, equipment)
  //   - Endpoint : GET /events/{trackingReference} ou GET /events?...
  // Le BL est la "trackingReference" pour notre cas d'usage.
  var ref = query.bl || query.container;
  var endpoint = apiBase + '/operation/trackandtrace/v1/events/' + encodeURIComponent(ref);

  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 15000);
    var res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        // Doc CMA : ApiKeyAuth (apiKey) Name: keyId, In: header
        'keyId': apiKey,
        'Accept': 'application/json',
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      var body = await res.text();
      return {
        ok: false,
        error: 'CMA API HTTP ' + res.status,
        detail: body.slice(0, 500),
        url: endpoint,
      };
    }
    // Parsing robuste : si l'API renvoie autre chose que du JSON, on retourne
    // un message clair plutot que de crash le Worker (Cloudflare error 1042).
    var contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.indexOf('application/json') < 0) {
      var raw = await res.text();
      return {
        ok: false,
        error: 'CMA API a retourne du non-JSON (' + contentType + ')',
        detail: raw.slice(0, 300),
      };
    }
    var data = await res.json();
    return { ok: true, data: data, fetchedAt: Date.now() };
  } catch (e) {
    // AbortError, DNS failure, etc. — toujours renvoyer du JSON valide
    var msg = (e && e.name === 'AbortError') ? 'Timeout 15s sur API CMA' : 'Reseau : ' + (e && e.message ? e.message : 'inconnu');
    return { ok: false, error: msg, url: endpoint };
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
