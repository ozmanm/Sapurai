# fcm-proxy — Cloudflare Worker

Proxy entre Sapurai (client web) et Firebase Cloud Messaging API V1.

Le client envoie : `POST { tokens: [], title, body, data }`
Le worker signe une requête OAuth2 avec le service account, puis envoie à FCM.

## Setup (5 minutes)

### 1. Récupérer le service account Firebase

- Va sur https://console.firebase.google.com/project/sapurai-84984/settings/serviceaccounts/adminsdk
- Onglet **"Service accounts"**
- Clique **"Generate new private key"** → tu télécharges un fichier JSON (le garder secret)

### 2. Installer wrangler (si pas déjà fait)

```bash
npm install -g wrangler
wrangler login
```

### 3. Configurer les secrets dans le Worker

```bash
cd workers/fcm-proxy

# Colle le JSON entier du service account quand wrangler te le demande
wrangler secret put FCM_SERVICE_ACCOUNT_JSON

# Tape "sapurai-84984"
wrangler secret put FCM_PROJECT_ID
```

### 4. Déployer

```bash
wrangler deploy
```

→ Le worker est dispo sur `https://fcm-proxy.<ton-subdomain>.workers.dev`

### 5. Mettre à jour l'URL côté client

Dans `src/firebase.ts`, vérifie que `FCM_PROXY_URL` pointe vers la bonne URL Worker.

L'URL actuelle dans le code est `https://fcm-proxy.ozmanm10.workers.dev` — adapte si différent.

## Test rapide

```bash
curl -X POST https://fcm-proxy.ozmanm10.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"tokens":["TOKEN_FCM_RECUP_DEPUIS_LAPP"],"title":"Test Sapurai","body":"Hello !","data":{"url":"/"}}'
```

Si ça renvoie `{"ok":true,"sent":1,...}` → ça marche.

## Sécurité

- **Service account** : jamais en clair, toujours via `wrangler secret`
- **CORS** : ouvert (`*`) en V1 pour simplicité. À restreindre à `https://sapurai-84984.web.app` quand prod stable
- **Rate limit** : pas implémenté. À ajouter via Cloudflare WAF si abus

## Limitations

- FCM v1 envoie 1 token à la fois (pas de batch comme l'ancienne API legacy). Le worker boucle.
- Tokens expirent après ~270 jours d'inactivité → côté client (`useFCM`), on regénère au login si Firebase invalide le token.
