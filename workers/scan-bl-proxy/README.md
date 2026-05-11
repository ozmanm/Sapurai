# scan-bl-proxy

Cloudflare Worker qui scanne un Bill of Lading (BL) via **Workers AI** (LLaVA 1.5 7B par defaut).

## Pourquoi

Sapurai utilisait Gemini 2.0 Flash pour le scan BL, mais le Senegal n'est pas dans le free tier Gemini (erreur 429 quota). Workers AI offre 10 000 neurons / jour gratuits, soit ~50-100 scans BL / jour, et l'edge computing est proche de Dakar (~80 ms).

## Deploiement

```bash
cd workers/scan-bl-proxy
wrangler deploy
```

Pas de secret requis : le binding `AI` est automatique via `wrangler.toml`.

## Test rapide

```bash
curl -X POST https://scan-bl-proxy.<ton-subdomain>.workers.dev/scan \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,/9j/4AAQ...","mimeType":"image/jpeg"}'
```

## Endpoint

- `POST /scan`
- Body : `{ image: string (base64 ou data URL), mimeType?: string }`
- Reponse OK : `{ ok: true, data: { bl, client, compagnie, date_arrivee, contact, conteneurs[] }, model, fetchedAt }`
- Reponse KO : `{ ok: false, error: '...', raw?: '...' }`

## Modele

Par defaut : `@cf/llava-hf/llava-1.5-7b-hf` (stable, optimise OCR documents).

Pour changer sans redeployer :
```bash
wrangler secret put SCAN_MODEL
# saisir: @cf/meta/llama-3.2-11b-vision-instruct
```

## CORS

Whitelist : `sapurai.app`, `sapurai-84984.web.app`, `localhost:5173`, `localhost:3000`.

## Limitation

Restriction beta cote front (`isBetaCompany(companyId)` dans `NDosForm.tsx`) : seule la societe `c_mocpodna9egt` voit le bouton scan tant que le quota Workers AI n'est pas valide en production.
