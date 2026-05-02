# Sapurai V4 — Guide de déploiement

> Application web métier pour transitaires opérant depuis Dakar
> (intérieur Sénégal + hinterland Mali/Burkina).
> Voir `PROJET.md` pour la documentation détaillée.

## Pré-requis

- Node.js 20+ (https://nodejs.org)
- Un compte Firebase (https://console.firebase.google.com)
- npm (vient avec Node.js)

---

## Étape 1 : Configurer Firebase

1. Va sur https://console.firebase.google.com
2. Clique **"Ajouter un projet"** → nomme-le `sapurai` → Continue
3. Désactive Google Analytics (pas besoin) → Créer le projet

### Activer Authentication
4. Menu gauche → **Build > Authentication** → **Get started**
5. Onglet **Sign-in method** → Active **Email/Password** + **Google** → Save

### Activer Firestore
6. Menu gauche → **Build > Firestore Database** → **Create database**
7. Choisis **Start in test mode** (on sécurisera après)
8. Choisis la région **eur3 (Europe)** → Enable

### Récupérer les clés
9. Clique la roue ⚙️ → **Project settings**
10. Scroll → **Your apps** → clique l'icône web `</>`
11. Nomme l'app `sapurai-web` → Register app
12. Copie le bloc `firebaseConfig` (apiKey, authDomain, etc.)

---

## Étape 2 : Configurer le projet

1. Ouvre le fichier `src/firebase.ts`
2. Remplace les valeurs par tes vraies clés :

```typescript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "sapurai-xxxxx.firebaseapp.com",
  projectId: "sapurai-xxxxx",
  storageBucket: "sapurai-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

---

## Étape 3 : Installer et tester en local

```bash
cd sapurai
npm install
npm run dev
```

Ouvre http://localhost:5173 → tu devrais voir la landing page.
Crée un compte → tu accèdes à Sapurai !

---

## Étape 4 : Déployer en ligne

### Installer Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### Initialiser et déployer
```bash
firebase init hosting
# Choisir "Use an existing project" → sélectionner sapurai
# Public directory: dist
# Single-page app: Yes
# Overwrite dist/index.html: No

firebase init firestore
# Choisir le fichier firestore.rules existant

npm run deploy
```

Tu recevras une URL publique : `https://sapurai-xxxxx.web.app`
(Site de production actuel : `https://sapurai-84984.web.app`)

---

## Étape 5 : Sécuriser (après les tests)

Le projet inclut déjà `firestore.rules` avec une logique multi-tenant complète
(rôles admin/editor/viewer/agent/client + super-admin par UID hardcodé +
règles tracking public token-based). Déploie-les :

```bash
firebase deploy --only firestore:rules
```

Ne remplace **pas** ces règles par un `allow read, write: if true` —
le tracking client public et la séparation par companyId en dépendent.

---

## Structure du projet (résumé)

```
sapurai/
├── index.html              # Page HTML d'entrée (PWA, OG, SW)
├── package.json            # Dépendances
├── vite.config.js          # Config Vite
├── tsconfig.json           # Config TypeScript
├── vitest.config.ts        # Config tests
├── eslint.config.js        # ESLint (règle no-hex-in-style)
├── firebase.json           # Config Firebase Hosting + headers sécurité
├── firestore.rules         # Règles de sécurité Firestore (multi-tenant)
└── src/
    ├── main.tsx            # Point d'entrée (auth state, routing)
    ├── App.tsx             # Application principale (shell + pages)
    ├── Login.tsx           # Page de connexion (Email + Google)
    ├── Landing.tsx         # Landing marketing
    ├── TrackingPage.tsx    # Suivi client public /t/:tokId
    ├── firebase.ts         # Config Firebase (tes clés)
    ├── useData.ts          # Hook central Firestore
    ├── types.ts            # Types domaine stricts
    ├── fileStore.ts        # Stockage fichiers
    ├── pages/              # Dash, Dos, Tcs, Dep, Chs, Caut, Stats, AgentView, AdminPanel
    ├── components/         # layout/, dossiers/, conteneurs/, chauffeurs/, shared/, ui/
    ├── hooks/              # useAppLogic + 11 hooks spécialisés + __tests__/
    ├── services/           # dpworld.ts (proxy Cloudflare Worker)
    ├── utils/              # date, format, pdf, export, importHelpers, validate, contrast
    ├── constants/          # statuts, depenses, styles, tarifs
    └── styles/             # layout.css + theme.css (dark mode WCAG AA)
```

Voir `PROJET.md` pour la structure détaillée et l'architecture Firestore.

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancer en local (Vite) |
| `npm run build` | Compiler pour production |
| `npm run preview` | Preview du build |
| `npm run lint` | ESLint (0 erreur attendue) |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier |
| `npm run typecheck` | tsc --noEmit |
| `npm test` | Vitest (suite F.1 : 28 tests) |
| `npm run test:watch` | Vitest watch mode |
| `npm run deploy` | Compiler + déployer sur Firebase |
| `firebase deploy --only hosting` | Redéployer le site uniquement |
| `firebase deploy --only firestore:rules` | Mettre à jour les règles |
