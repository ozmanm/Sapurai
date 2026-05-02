// Cloudflare Worker — fcm-proxy
// Proxy FCM HTTP v1 (Firebase Cloud Messaging API V1)
// Cote client : POST { tokens: [], title, body, data } -> ce worker
// Cote FCM : signature OAuth2 avec Service Account, envoi a https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
//
// Setup :
// 1. Firebase Console > Project settings > Service accounts > Generate new private key
// 2. wrangler secret put FCM_SERVICE_ACCOUNT_JSON  (colle le JSON entier)
// 3. wrangler secret put FCM_PROJECT_ID  (= "sapurai-84984")
// 4. wrangler deploy
//
// Limitations Spark plan : aucune (FCM v1 est gratuit, le Worker tourne sur Cloudflare)

export default {
  async fetch(request, env) {
    // CORS preflight DOIT etre traite avant le check POST (sinon le browser bloque)
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }
    if (request.method !== 'POST') {
      return cors(new Response('Method not allowed', { status: 405 }));
    }

    var body;
    try {
      body = await request.json();
    } catch {
      return cors(new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    var tokens = Array.isArray(body.tokens) ? body.tokens : [];
    var title = String(body.title || 'Sapurai');
    var bodyTxt = String(body.body || '');
    var data = body.data || {};

    if (tokens.length === 0) {
      return cors(new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { 'Content-Type': 'application/json' } }));
    }

    // Generer access token OAuth2 depuis le service account
    var accessToken;
    try {
      accessToken = await getAccessToken(env);
    } catch (e) {
      return cors(new Response(JSON.stringify({ error: 'Auth failed: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
    }

    // Envoyer a chaque token (FCM HTTP v1 = un POST par token)
    var results = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      try {
        var res = await fetch('https://fcm.googleapis.com/v1/projects/' + env.FCM_PROJECT_ID + '/messages:send', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: t,
              notification: { title: title, body: bodyTxt },
              data: Object.keys(data).reduce(function (acc, k) { acc[k] = String(data[k]); return acc; }, {}),
              webpush: {
                fcm_options: { link: data.url || '/' },
              },
            },
          }),
        });
        results.push({ token: t.slice(0, 12) + '...', ok: res.ok, status: res.status });
      } catch (e) {
        results.push({ token: t.slice(0, 12) + '...', ok: false, error: e.message });
      }
    }

    return cors(new Response(JSON.stringify({ ok: true, sent: results.length, results: results }), {
      headers: { 'Content-Type': 'application/json' },
    }));
  },
};

// CORS helper — autorise app sapurai
function cors(response) {
  var h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');  // a restreindre en prod a sapurai-84984.web.app
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

// OAuth2 access token via Service Account (JWT signed -> echange contre access_token)
async function getAccessToken(env) {
  var sa = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);

  var header = { alg: 'RS256', typ: 'JWT' };
  var now = Math.floor(Date.now() / 1000);
  var claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  var unsigned = b64u(JSON.stringify(header)) + '.' + b64u(JSON.stringify(claim));
  var key = await importPrivateKey(sa.private_key);
  var sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  var jwt = unsigned + '.' + b64uBytes(new Uint8Array(sig));

  var res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
  });
  if (!res.ok) {
    var t = await res.text();
    throw new Error('OAuth2 ' + res.status + ': ' + t);
  }
  var json = await res.json();
  return json.access_token;
}

function b64u(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uBytes(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  var pemContents = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  var binary = atob(pemContents);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}
