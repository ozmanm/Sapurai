# Sapurai — Documentation Projet

> **Mis à jour le :** 18/04/2026
> **Version :** 4.0.0
> **URL production :** https://sapurai-84984.web.app
> **Project Firebase :** `sapurai-84984` (hosting + Firestore)

---

## Vue d'ensemble

Sapurai (anciennement LogiTrans) est une application web métier de **gestion de transit maritime et logistique**, conçue pour les transitaires opérant depuis **Dakar** : livraison intérieur Sénégal (Touba, Thiès, Kaolack...) et hinterland (Mali, Burkina Faso).

Elle permet de suivre les dossiers d'importation (BL), les conteneurs (TCs), les dépenses, les chauffeurs et les cautions, avec synchronisation temps réel multi-utilisateurs, mode hors-ligne, et une page de suivi publique pour les clients finaux (WhatsApp-friendly).

---

## Stack technique

| Technologie | Rôle |
|---|---|
| React 18.2 | UI — composants fonctionnels uniquement |
| TypeScript 5.9 | Typage statique (migration complète .jsx → .tsx en Sprint 14) |
| Vite 7 | Build tool, dev server |
| Firebase Auth | Authentification email/password + Google Sign-In |
| Cloud Firestore | Base de données temps réel + persistance offline |
| Firebase Hosting | Hébergement production + headers sécurité |
| PWA (Service Worker) | Mode hors-ligne, installation mobile |
| Vitest + happy-dom | Tests unitaires hooks et logique métier |
| Cloudflare Worker | Proxy API DPWorld (contourne CORS) |

**Dépendances npm :**
- `firebase ^11` — Auth + Firestore
- `react-router-dom ^7` — Routing (page tracking publique `/t/:tokId`)
- `xlsx ^0.18` — Import/Export Excel
- `jspdf ^4` + `jspdf-autotable ^5` — Export PDF dossiers et rapports
- `qrcode.react ^4` — QR code sur la page de tracking client

**Aucune bibliothèque UI** (Material UI, Tailwind, etc.) — tout le CSS est custom dans `src/styles/layout.css` + `src/styles/theme.css` (CSS vars dark/light WCAG AA).

---

## Architecture Firestore

```
/companies/{companyId}
  ├── dos[]        — dossiers (BL, client, statut, intervenants...)
  ├── tcs[]        — conteneurs (N° TC, type, statut, chauffeur...)
  ├── chs[]        — chauffeurs (nom, tel, blacklist...)
  ├── dep[]        — dépenses (type, montant HT/TTC, statut paiement)
  ├── logs[]       — journal d'activité (500 entrées max)
  └── cfg          — configuration (franchise jours, seuil alertes)

/companies/{companyId}/members/{uid}
  └── { email, role, name, joinedAt }

/companies/{companyId}/invites/{code}
  └── { role, createdBy, expiresAt }

/companies/{companyId}/notifications/{id}
  └── { for, msg, dt, read }

/tracking/{tokId}
  └── { companyId, dosId, blId, expiresAt, ... }  — tokens de suivi public

/users/{uid}
  └── { companyId, role, email, name }
```

**Offline :** Firestore est initialisé avec `persistentLocalCache` + `persistentMultipleTabManager` → l'app fonctionne sans connexion et se resynchronise automatiquement.

**Mono-document :** chaque entreprise stocke ses données (dos, tcs, chs, dep, logs) dans un seul document `/companies/{id}`. Limite Firestore : 1 MiB. Migration vers sous-collections planifiée si seuil > 500 KiB (voir `MIGRATION-SUBCOLLECTIONS.md`).

---

## Structure des fichiers

```
sapurai/
├── public/
│   ├── sw.js              — Service Worker (cache shell + network-first)
│   ├── manifest.json      — PWA manifest (icônes, display: standalone)
│   ├── favicon.svg
│   ├── og-tracking.png    — Open Graph image page tracking
│   └── robots.txt
├── src/
│   ├── firebase.ts        — Init Firebase (Auth + Firestore offline)
│   ├── useData.ts         — Hook central : chargement, save, membres, notifs, invites
│   ├── types.ts           — Types domaine stricts (Dossier, Conteneur, Depense, Chauffeur, Intervenant)
│   ├── fileStore.ts       — Abstraction stockage fichiers
│   ├── main.tsx           — Entry point, auth listener, routing
│   ├── App.tsx            — Shell principal, routing par rôle
│   │
│   ├── pages/
│   │   ├── Dash.tsx       — Tableau de bord (alertes, stats globales)
│   │   ├── Dos.tsx        — Liste dossiers (filtres, recherche, cartes)
│   │   ├── Tcs.tsx        — Liste conteneurs (statuts, dispatch)
│   │   ├── Dep.tsx        — Liste dépenses (payé/impayé, filtres)
│   │   ├── Chs.tsx        — Chauffeurs (dashboard stats, missions)
│   │   ├── Caut.tsx       — Cautions (suivi, alertes)
│   │   ├── Stats.tsx      — Statistiques et graphiques
│   │   ├── AgentView.tsx  — Vue dédiée rôle "agent" (tâches + notifs)
│   │   └── AdminPanel.tsx — Panneau super-admin multi-tenant
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      — Navigation latérale (menu, rôle, journal)
│   │   │   └── TopBar.tsx       — Barre du haut (hamburger, recherche, alertes)
│   │   ├── dossiers/
│   │   │   ├── DetView.tsx      — Détail dossier (TCs, dépenses, PDF)
│   │   │   ├── NDosForm.tsx     — Formulaire nouveau/édition dossier
│   │   │   ├── NDepForm.tsx     — Formulaire dépense
│   │   │   ├── IntervenantsView.tsx — Gestion intervenants/tâches agents
│   │   │   ├── JdocView.tsx     — Documents justificatifs
│   │   │   └── PregateInput.tsx — Saisie pregate TC
│   │   ├── conteneurs/
│   │   │   ├── DispForm.tsx     — Formulaire dispatch TC
│   │   │   └── TrancheForm.tsx  — Saisie tranches de paiement
│   │   ├── chauffeurs/
│   │   │   └── NChForm.tsx      — Formulaire nouveau chauffeur
│   │   ├── shared/
│   │   │   ├── AppModals.tsx    — Modale centrale (devis, settings, journal, bilan...)
│   │   │   ├── BilanView.tsx    — Bilan financier dossier
│   │   │   ├── CliSearch.tsx    — Recherche client autocomplete
│   │   │   ├── DevisForm.tsx    — Devis rapide
│   │   │   ├── ErrorBound.tsx   — Error boundary React
│   │   │   ├── OnboardingModal.tsx — Onboarding nouvel utilisateur
│   │   │   ├── Overlay.tsx      — Composant modale générique
│   │   │   └── SettingsForm.tsx — Paramètres entreprise
│   │   └── ui/
│   │       ├── Badge.tsx        — Composant badge design system
│   │       ├── Btn.tsx          — Bouton réutilisable
│   │       ├── Card.tsx         — Carte réutilisable
│   │       ├── ClickableDiv.tsx — Div cliquable a11y
│   │       ├── FormField.tsx    — Champ formulaire standard
│   │       ├── Pagination.tsx   — Pagination liste
│   │       └── Skeleton.tsx     — Skeleton loader
│   │
│   ├── hooks/
│   │   ├── useAppLogic.ts          — Coordinateur (compose les hooks d'actions)
│   │   ├── useAppMetrics.ts        — Counters, urgences, alertes
│   │   ├── useAnalytics.ts         — Events tracking
│   │   ├── useDossierActions.ts    — CRUD dossiers (addDos, patchDos, closeDos)
│   │   ├── useConteneurActions.ts  — Actions TCs (dispatch, pregate, tranches)
│   │   ├── useDepenseActions.ts    — Actions dépenses (toggleDepSt, patchDep)
│   │   ├── useChauffeurActions.ts  — Actions chauffeurs
│   │   ├── useImportActions.ts     — Import Excel en masse
│   │   ├── useDPWorldSync.ts       — Sync statuts TC depuis DPWorld
│   │   ├── usePagination.ts        — Logique pagination générique
│   │   ├── useTheme.ts             — Toggle dark/light mode
│   │   ├── useToast.ts             — Système de notifications toast
│   │   └── __tests__/
│   │       └── useAppLogic.test.ts — Tests unitaires (F.1 : 28 tests)
│   │
│   ├── services/
│   │   └── dpworld.ts     — Client API DPWorld via Worker proxy
│   │
│   ├── utils/
│   │   ├── date.ts        — Formatage dates, calcul alertes franchise/docs
│   │   ├── format.ts      — Formatage montants FCFA, calculs TC
│   │   ├── id.ts          — Générateur d'IDs uniques (crypto.randomUUID)
│   │   ├── print.ts       — Export PDF via window.print()
│   │   ├── pdf.ts         — Génération PDF structurée (jspdf + autotable)
│   │   ├── export.ts      — Export Excel multi-feuilles
│   │   ├── importHelpers.ts — Parsing fichiers Excel
│   │   ├── validate.ts    — Validation formulaires
│   │   ├── contrast.ts    — Vérification WCAG AA
│   │   └── __tests__/     — Tests unitaires utils
│   │
│   ├── constants/
│   │   ├── statuts.ts     — Statuts dossiers (DL) et conteneurs (SL)
│   │   ├── depenses.ts    — Types de dépenses (DTL), phases
│   │   ├── styles.ts      — Styles JS partagés
│   │   └── tarifs.ts      — Grilles tarifaires
│   │
│   ├── styles/
│   │   ├── layout.css     — CSS global (sidebar, cards, tables, responsive)
│   │   └── theme.css      — CSS vars light/dark mode (WCAG AA)
│   │
│   ├── Login.tsx          — Page de connexion
│   ├── Setup.tsx          — Onboarding (création/rejoindre entreprise)
│   ├── TeamPanel.tsx      — Gestion équipe (invitations, rôles)
│   ├── TrackingPage.tsx   — Page publique suivi client `/t/:tokId`
│   ├── Landing.tsx        — Landing page marketing
│   ├── ScanBL.tsx         — Scanner BL (caméra)
│   └── ImportExcel.tsx    — Import dossiers depuis Excel
│
├── index.html             — HTML root (PWA meta, SW registration, OG/Twitter)
├── firebase.json          — Config Hosting (headers sécurité) + Firestore rules
├── firestore.rules        — Règles de sécurité Firestore (multi-tenant)
├── vite.config.js         — Config Vite
├── vitest.config.ts       — Config Vitest (happy-dom)
├── tsconfig.json          — Config TypeScript
├── eslint.config.js       — ESLint (règle no-restricted-syntax sur hex colors)
├── CLAUDE.md              — Règles de travail Claude
├── CHANGELOG-AUDIT.md     — Suivi audit et tâches (fait / pas fait)
├── PROJET.md              — Ce fichier
├── STYLE-GUIDE.md         — Guide de style UI
├── NOTES-PRODUCT.md       — Notes produit
├── MIGRATION-SUBCOLLECTIONS.md — Plan migration mono-doc → sous-collections
├── AUDIT-DESIGN.md        — Audit design 12 pages
├── AUDIT-A11Y.md          — Audit accessibilité WCAG AA
├── MONITORING-PLAN.md     — Plan monitoring production
└── README.md              — Lancement rapide
```

---

## Système de rôles

| Rôle | Accès |
|---|---|
| `admin` | Tout — paramètres, équipe, toutes les actions CRUD |
| `editor` | Lecture + écriture — pas les paramètres ni l'équipe |
| `viewer` | Lecture seule |
| `agent` | Vue dédiée AgentView — uniquement ses dossiers assignés et ses tâches |
| `client` | Page de tracking publique (sans auth) via lien partagé |
| `super-admin` | UID hardcodé dans Firestore Rules — accès multi-tenant via AdminPanel |

---

## Fonctionnalités implémentées

### Dossiers (BL)
- Création, édition, suppression de dossiers d'importation
- Statuts : `INITIALISE → SECURISE → EN_TRANSIT → CLOTURE → ARCHIVE`
- Informations : client, N° BL, compagnie maritime, corridor, date déchargement, téléphone
- Filtres : statut, recherche texte libre, filtre client, filtre compagnie
- Détail dossier avec TCs associés, dépenses, bilan financier
- Export PDF sans dépendance — `window.open()` + HTML complet + `window.print()`
- Export PDF structuré via `jspdf` + `jspdf-autotable` (rapports et bilans)
- Intervenants (agents assignés) avec liste de tâches par intervenant

### Conteneurs (TCs)
- Suivi par statut : `PORT → DISPATCHE → TRANSIT → KATI → BAMAKO → RETOURNE`
- Dispatch (assignation chauffeur + camion + date)
- Alertes franchise (dépassement jours libres) et surestaries
- Détection TC immobile (dispatché depuis 5+ jours sans avancement)
- Pregate, tranches de paiement
- **Sync DPWorld** : import automatique des statuts conteneurs depuis le portail DPWorld via Cloudflare Worker proxy

### Dépenses
- Types : Transport, Location TC, DP World, Douane, Surestaries, Détentions, Orbus, Autre
- Statut paiement : `PAYE / IMPAYE`
- Montant HT et TTC
- Filtres et totaux par dossier

### Chauffeurs
- Fiche chauffeur (nom, téléphone, camion)
- Blacklist
- Dashboard stats : total actifs, en mission, disponibles
- Missions 30 jours : comptage des dispatches récents
- Dernière date de mission par chauffeur

### Cautions
- Suivi des cautions bancaires par dossier
- Alertes d'expiration

### Tableau de bord
- Indicateurs : dossiers en cours, TCs au port, dépenses totales/payées/impayées
- Alertes critiques : franchise dépassée, TC immobile, documents urgents
- Score de paiement global (%)

### Statistiques
- Graphiques dépenses par type, évolution mensuelle, top clients

### Journal d'activité
- Log automatique de toutes les actions (création, dispatch, paiement, clôture...)
- 500 entrées max (FIFO)
- Modal dédié avec filtre par type d'action
- Accessible depuis la sidebar

### Devis rapide
- Simulation de coût d'un dossier avant création

### Import Excel
- Import en masse de dossiers depuis un fichier Excel

### Scanner BL
- Scan via caméra pour recherche rapide

### Tracking client
- URL publique `/t/:tokId` — le client suit ses conteneurs sans compte
- Token UUID aléatoire (`crypto.randomUUID()`)
- QR code généré sur la page (partage facile)
- Sécurité : `X-Robots-Tag: noindex` via firebase.json + meta tag dynamique
- Open Graph + Twitter Card pour preview WhatsApp/social
- Click-to-chat WhatsApp : +221 (Sénégal) et +223 (Mali)

### Rating client
- Widget de notation affiché sur la tracking page publique quand le dossier passe en `CLOTURE` ou `ARCHIVE`
- 3 niveaux : `1` Très satisfait / `2` Correct, pas parfait / `3` Problème à résoudre
- Si rating=3 : checklist 5 cases (Retard / Communication / Tarif / Qualité / Autre) + textarea libre optionnelle (200 car max)
- Écriture unique (irréversible V1) via `updateDoc` + `serverTimestamp()`
- Sécurité Firestore rules : `allow update` public restreint — une fois seulement, champs limités à `rating/ratingComment/ratingReasons/ratingAt`, `rating ∈ [1,2,3]`, `ratingAt == request.time`
- Approximation auteur : `localStorage` — l'auteur voit son rating figé, les autres visiteurs du même lien ne le voient pas (pas d'auth client)
- Remontée cote transitaire : listener Firestore `/tracking where companyId == cid` + merge sur les dossiers (champs dérivés `rating/ratingComment/ratingReasons/ratingAt`)
- Dashboard : KPI Satisfaction client (% rating 1+2 sur total noté), bandeau rouge "Problèmes signalés" avec liste cliquable (tri récent → ancien)
- DetView : badge "Avis client" dans le hero + bouton WhatsApp "Rappeler le client" si rating=3 (tel +221 ou +223)

### Auto-stub Dépenses à l'arrivée
- Dès qu'un dossier reçoit une date d'arrivée (sync DPWorld, saisie manuelle `da`, ou edit), Sapurai crée automatiquement les Dépenses placeholder attendues en statut `en_attente_facture`, dans l'ordre métier : compagnie_location → compagnie_debarquement → caution + lettre_garantie (si TRANSIT sans garantie permanente) → surestaries_compagnie (si jours au port > franchise) → besc (si toggle) → orbus → dpworld
- Après livraison, un stub `detention_vide` se crée si le retour du conteneur vide dépasse la franchise (selon région livraison : Dakar 4j, Thiès 5j, autres Sénégal 8j, corridor Mali/Burkina/Niger 23j)
- Paramètres par dossier : type (IMPORT / TRANSIT / VEHICULE), franchises (compagnie 10j, magasinage 10/21/5j selon type, retour vide auto selon destination), toggles BESC et RoRo (véhicule sur navire = pas de retour TC)
- Anti-doublon systématique : une catégorie déjà présente (même ignorée) ne re-stub pas
- Soft-delete : bouton "Ignorer" (🚫) pour retirer un stub considéré comme faux positif, sans le recréer au prochain sync
- Dashboard : widget "Factures en attente" avec stats (total, retards >10j, cette semaine, dossiers concernés), liste top 5 par dossier cliquable
- Page Dépenses : tab "En attente" dédiée, badge `AUTO` sur les stubs, bouton "En attente" qui ouvre l'édition pour saisir le montant
- Helpers purs : `utils/franchise.ts`, `utils/stub.ts`, `utils/pendingInvoices.ts` — ~60 tests unitaires

### Gestion équipe
- Invitation par code ou email (lien partageable)
- Attribution des rôles
- Révocation d'accès

### Vue Agent
- Interface dédiée aux agents terrain (rôle `agent`)
- Liste uniquement les dossiers dont l'agent est intervenant
- Tâches assignées avec case à cocher
- Notifications in-app : bandeau + badge quand nouvelles tâches

### Dark mode
- Toggle clair/sombre via `useTheme.ts`
- Persistance `localStorage` (`lt-theme`)
- CSS vars calibrées WCAG AA (contraste 4.5:1 minimum)
- Règle ESLint `no-restricted-syntax` bloque les hex colors hardcodés

### PWA / Mode hors-ligne
- Service Worker (`public/sw.js`) : stratégie network-first, cache du shell
- Manifest (`public/manifest.json`) : installation sur écran d'accueil mobile
- Firestore `persistentLocalCache` : données disponibles sans connexion

### Notifications in-app
- Sous-collection Firestore `companies/{cid}/notifications`
- Envoi automatique quand un admin assigne de nouvelles tâches à un agent
- Marquage "lu" en un clic (`markNotifsRead`)

### Admin multi-tenant (super-admin)
- `AdminPanel.tsx` : vue transverse sur toutes les entreprises
- Accès restreint par UID hardcodé dans `firestore.rules`

---

## Tests

- **Vitest + happy-dom + @testing-library/react**
- Sprint 15 F.1 : suite de 28 tests sur `useAppLogic.ts` (urgences, alertes, toggleDepSt, patchDos, closeDos, addDos, dispatch)
- Stratégie : unit tests avec mocks (save mockée, capture d'arguments) plutôt qu'émulateur Firestore
- Commande : `npm test` (exit code 0 attendu)

---

## Déploiement

### Commande
```bash
npm run deploy
# = vite build && firebase deploy
```

### Configuration Firebase
- **Projet :** `sapurai-84984`
- **Hosting site :** `sapurai-84984`
- **URL prod :** `https://sapurai-84984.web.app`
- **Build output :** `dist/`
- **SPA rewrite :** toutes les routes → `/index.html`
- **Headers sécurité :** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=()`

### Variables d'environnement
Aucune variable d'environnement externe. La config Firebase est inline dans `src/firebase.ts` (clé API publique — sécurité gérée par les Firestore Rules).

---

## Lancement en développement

```bash
cd sapurai
npm install
npm run dev
# → http://localhost:5173
```

### Scripts disponibles
```bash
npm run dev          # Serveur de dev (Vite)
npm run build        # Build production
npm run preview      # Preview build local
npm run lint         # ESLint (0 erreur attendue)
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier
npm run typecheck    # tsc --noEmit
npm test             # Vitest run
npm run test:watch   # Vitest watch
npm run deploy       # Build + deploy Firebase
```

---

## Changelog

### v4.0.0 — 18/04/2026 (Sprint 13–15)
**Breaking : renommage produit et refonte technique majeure.**

- **Rebranding LogiTrans → Sapurai** : landing page, metadata Open Graph/Twitter, favicon, domaine `sapurai-84984.web.app`
- **Migration TypeScript complète** : tous les fichiers `.jsx`/`.js` convertis en `.tsx`/`.ts`, config `tsconfig.json`, script `npm run typecheck`
- **Types domaine stricts** : `types.ts` avec `Dossier`, `Conteneur`, `Depense`, `Chauffeur`, `Intervenant` — suppression des escape hatches `[key: string]: unknown`
- **Sync DPWorld** : `services/dpworld.ts` + Cloudflare Worker proxy pour contourner CORS, hook `useDPWorldSync.ts`, import automatique des statuts TC
- **Dark mode WCAG AA** : refonte CSS vars light/dark dans `styles/theme.css`, purge des hex colors hardcodés (5 fichiers, 105 occurrences), règle ESLint `no-restricted-syntax` pour empêcher la régression
- **Split `useAppLogic`** : God-hook découpé en 8 hooks spécialisés (Dossier, Conteneur, Depense, Chauffeur, Import, DPWorldSync, Metrics, Analytics) + `useAppLogic` devient coordinateur
- **Suite de tests Vitest** : F.1 livrée avec 28 tests unitaires sur `useAppLogic.ts` (urgences, alertes, toggleDepSt, patchDos, closeDos, addDos, dispatch)
- **Page tracking sécurisée** : route publique migrée `/tracking/:token` → `/t/:tokId`, token UUID aléatoire via `crypto.randomUUID()`, `X-Robots-Tag: noindex` header + meta tag dynamique, Open Graph + Twitter Card, QR code
- **Design system** : dossier `components/ui/` (Badge, Btn, Card, FormField, Pagination, Skeleton, ClickableDiv)
- **Google Sign-In** ajouté à l'authentification
- **Landing page** : `Landing.tsx` orientée acquisition
- **Admin multi-tenant** : `AdminPanel.tsx` pour super-admin (UID hardcodé dans rules)
- **Documentation** : `CHANGELOG-AUDIT.md`, `STYLE-GUIDE.md`, `NOTES-PRODUCT.md`, `AUDIT-DESIGN.md`, `AUDIT-A11Y.md`, `MIGRATION-SUBCOLLECTIONS.md`, `MONITORING-PLAN.md`

### v3.2.0 — 28/02/2026
- **Fix reconnexion agent/client** : session anonyme sauvegardée dans `localStorage` (`lt-session`) → reconnexion automatique après logout sans ressaisir le code
- **Fix invitation par email** : `addMemberByEmail` génère désormais un vrai code d'invitation et retourne un lien partageable (WhatsApp/SMS) au lieu d'afficher un faux "email envoyé"
- **Mobile CSS** : breakpoint `768px` → `1024px` (couvre tous les téléphones y compris Android 1080px), `overflow-x: hidden` sur `.lt-main`
- **Spinner de chargement** : animation CSS `lt-spinner` sur tous les écrans de chargement (auth, données)

### v3.0.0 — 27/02/2026
- **PWA / Mode hors-ligne** : SW + manifest dans `public/`, meta PWA dans `index.html`
- **Filtres dossiers améliorés** : filtres client et compagnie en plus du filtre statut
- **Journal d'activité** : modal avec historique filtrable (500 entrées)
- **Dashboard chauffeurs** : stats globales, missions 30j, dernière mission par chauffeur
- **Export PDF dossier** : bouton dans le menu ⋮ du détail dossier, sans dépendance externe
- **Notifications in-app** : alertes temps réel pour les agents terrain
- **Vue Agent** : interface dédiée rôle `agent` avec tâches et notifications
- Déployé sur Firebase Hosting

### v2.x
- Système multi-entreprise (onboarding, invitations, rôles)
- Tracking client public (`/tracking/:token`)
- Import Excel
- Scanner BL
- Intervenants avec tâches par dossier
- Alertes franchise et surestaries
- Bilan financier dossier

### v1.x
- CRUD dossiers, TCs, dépenses, chauffeurs, cautions
- Dashboard avec indicateurs
- Authentification Firebase
- Statistiques
