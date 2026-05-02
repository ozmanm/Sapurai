# cma-proxy — Cloudflare Worker pour API CMA-CGM Track & Trace

Proxy serveur qui détient l'API Key CMA-CGM (en secret) et expose un endpoint
CORS-friendly pour Sapurai.

## Pourquoi un Worker

- **Sécurité** : la clé API CMA ne doit jamais être dans le code navigateur (sinon elle est volable via DevTools).
- **Cache** : 1h en mémoire pour économiser le quota strict (20/h sur le plan gratuit CMA).
- **Rate limit** : max 1 appel par BL toutes les 3 minutes (anti double-clic).

## Déploiement

### Prérequis

```bash
npm install -g wrangler
wrangler login
```

### 1. Configurer la clé API CMA en secret

```bash
cd workers/cma-proxy
wrangler secret put CMA_API_KEY
# → Quand wrangler te demande "Enter a secret value:", colle ta clé CMA puis Entrée
```

(Optionnel) Si l'URL de base CMA-CGM diffère du défaut `https://apis.cma-cgm.com` :

```bash
wrangler secret put CMA_API_BASE
# → Entrée la nouvelle URL
```

### 2. Déployer

```bash
wrangler deploy
```

Wrangler te confirme l'URL : `https://cma-proxy.<ton-subdomain>.workers.dev`

(Pour le compte ozmanm10 → `https://cma-proxy.ozmanm10.workers.dev`)

### 3. Vérifier

```bash
curl "https://cma-proxy.ozmanm10.workers.dev/?bl=CHN2580404"
```

Réponse attendue : JSON avec `ok: true, data: { ... }` ou `ok: false, error: "..."` si la clé est mauvaise ou le BL inconnu.

## Endpoints

### GET /?bl=BL_NUMBER

Track & Trace par numéro de BL.

```
GET https://cma-proxy.ozmanm10.workers.dev/?bl=CHN2580404
```

### GET /?container=TC_NUMBER

Track & Trace par numéro de conteneur.

```
GET https://cma-proxy.ozmanm10.workers.dev/?container=TGHU6321812
```

### POST { bl?, container? }

Idem en POST si tu préfères passer le payload en JSON.

```bash
curl -X POST https://cma-proxy.ozmanm10.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"bl":"CHN2580404"}'
```

## Réponse normalisée

```json
{
  "ok": true,
  "fetchedAt": 1714579200000,
  "cached": false,
  "data": { ... }
}
```

Si `cached: true`, la réponse vient du cache mémoire Worker (économise quota CMA).

## CORS

Le Worker autorise uniquement :
- `https://sapurai-84984.web.app`
- `https://sapurai.app`
- `http://localhost:5173` (dev Vite)
- `http://localhost:3000`

Pour ajouter une origin, modifier `corsHeaders()` dans `worker.js`.

## Quota & coût

- **CMA-CGM plan gratuit** : 20 appels/heure (= 480/jour).
- **Cache 1h** dans le Worker → 1 BL = 1 appel par heure max.
- **Rate limit 3min/BL** → anti double-clic.

Si tu fais "Sync" sur le même BL 5 fois en 1h, ça compte 1 appel chez CMA grâce au cache.

## Gestion des erreurs

| Code HTTP | Signification |
|-----------|---------------|
| 200 + ok:true | Succès |
| 200 + ok:true + cached:true | Réponse du cache |
| 200 + ok:true + rateLimited:true | Rate limit, cache renvoyé |
| 400 | bl ou container manquant |
| 405 | Method not allowed (autre que GET/POST/OPTIONS) |
| 502 + ok:false + error | Erreur CMA-CGM (HTTP non-2xx ou réseau) |

Le champ `error` + `detail` (max 500 char) aide à diagnostiquer côté Sapurai.
