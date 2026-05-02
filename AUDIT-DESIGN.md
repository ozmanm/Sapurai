# Audit design global — Sapurai

> Critique structuree des pages principales de l'app. Basee sur inspection code
> + patterns recurrents identifies. Date : 2026-04-18.
>
> **Note** : Login et TrackingPage ont deja ete audites et traites dans la session
> precedente (commits `33dbe84` tracking polish, `76dd507` Login refonte).

---

## Methodologie

Chaque page recoit 3-5 findings structures :
- **Usability** : flow, intuitivite
- **Visual hierarchy** : ce qui accroche l'oeil vs ce qui devrait
- **Consistency** : design system respecte
- **Accessibility** : contraste, touch targets, ARIA

Severite : 🔴 Critical / 🟡 Moderate / 🟢 Minor

---

## 1. `Dash.tsx` — Dashboard admin

| # | Finding | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **`--text-muted` utilise pour les labels "DOSSIERS ACTIFS", "CONTENEURS", etc.** (L49, 54, 63...). En dark mode, muted = `#8b857f` (3.2:1) — echoue WCAG AA (4.5:1 requis pour texte < 14px) | 🔴 | Remplacer par `var(--text-secondary)` pour les labels uppercase des summary cards |
| 2 | **8 summary cards possibles (conditionnelles)**. Grille `auto-fit minmax(140px)` → sur tablette tu peux avoir 2 rangees irregulieres. Visuel fragmente | 🟡 | Soit limiter a 6 cards prioritaires, soit grouper les cards financieres |
| 3 | **Urgences affichees mais pas de CTA primaire clair**. 6 groupes d'urgences en cards side-by-side, chacune avec top 5 items. L'agent ne sait pas par quoi commencer | 🟡 | Ajouter un bandeau "X urgences critiques a traiter maintenant" avant les groupes, qui ouvre les urgences critiques les plus anciennes |
| 4 | **Empty state** a du soin (L30-42, icon + message + CTA) | 🟢 Positif | Pattern a repliquer sur les autres pages qui n'en ont pas |
| 5 | **PDF bilan/client** importe mais l'entree est invisible — ou est le bouton ? Pas vu dans l'extrait | 🟢 | Verifier la decouvrabilite |

---

## 2. `Dos.tsx` — Liste des dossiers

| # | Finding | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **4 filtres tabs + 2 filtres select + 1 recherche + 1 tri + 2 modes vue** = 9 controles simultanes dans la toolbar | 🔴 | Regrouper : tabs pour status (visible), reste dans un bouton "Filtres" qui ouvre un drawer mobile. Desktop peut garder inline mais grouper visuellement |
| 2 | **Selection multiple et bulk delete** : bien integres mais pas mis en avant. L'utilisateur ne sait pas que la selection existe tant qu'il ne trouve pas la checkbox | 🟡 | Au 2e dossier ouvert, afficher une hint "Astuce : selectionnez plusieurs dossiers pour les archiver en masse" (dismissible) |
| 3 | **Tri par "priorite"** — non documente. Qu'est-ce que la priorite ? Date ? Urgences ? | 🟡 | Renommer en "Urgence" ou "Auto" avec tooltip "Dossiers les plus a risque en premier" |
| 4 | **Reset automatique des filtres** quand on change de tab (L46). Peut frustrer si agent veut garder un filtre client actif en switchant actif/cloture | 🟡 | Ne pas reset les filtres qui ne depdent pas du tab (cl, cp, qr) |
| 5 | **Pagination client-side** via `usePagination` — OK tant que < 500 dossiers, au-dela probleme de perf | 🟢 | Noter pour migration subcollections : pagination server-side |

---

## 3. `DetView.tsx` — Detail dossier

| # | Finding | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **Dense : 10+ sections verticales** (hero, phrase, docs, caution, franchises, conteneurs, intervenants, documents joints, depenses, marge, historique, export). Scroll interminable | 🔴 | Onglets horizontaux : "Vue d'ensemble" / "Financier" / "Historique" — reduit le scroll a 3 vues coherentes |
| 2 | **Menu d'actions dans le hero (dropdown 3 points)** : 9 actions listees (Modifier, Imprimer, PDF, Joindre, Sync DPWorld, Partager, Cloturer, Archiver, Supprimer). Aucune hierarchie | 🟡 | Actions principales comme boutons visibles (Partager + Sync DPWorld), le reste dans menu |
| 3 | **Franchises affichees seulement si non-cloture** (L198) — OK, mais l'utilisateur cloture peut vouloir verifier l'historique | 🟢 | Ajouter une vue "historique franchises" pour les dossiers clos |
| 4 | **Historique tronque a 20 entrees** (L342). Pas de "voir plus" | 🟡 | Lien "Voir tout l'historique" qui ouvre un modal |
| 5 | **QR code integre dans share panel** (L91) — bon touch tactique pour les agents qui partagent via ecran | 🟢 Positif | Garder |

---

## 4. `Stats.tsx` — Statistiques

| # | Finding | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **`PAL` hardcoded 10 couleurs** (L12) : `#0369a1, #059669, #7c3aed, #d97706, ...`. Ces couleurs ne s'adaptent pas au dark mode. Graphs illisibles si fond sombre identique a une couleur | 🔴 | Utiliser les semantic vars (`--info`, `--success`, `--purple`, `--warning`, `--danger`) + generer des variants si > 5 categories |
| 2 | **4 periodes** (all/month/quarter/year) mais le selecteur n'est pas clairement visible (pas vu dans l'extrait) | 🟡 | Pills horizontales en haut de page, sticky |
| 3 | **Calcul `transitTimes`** filtre > 0 et < 365 jours (L55) — on exclut les dossiers annuels. Bias possible | 🟡 | Documenter le filtre dans le code + eventuellement rendre le seuil configurable |
| 4 | **Depenses par type** : barre de progression visible mais pas d'export isole (tu as Excel mais pas image) | 🟢 | Ajouter export PNG des graphs (optionnel) |

---

## 5. `AgentView.tsx` — Vue simplifiee agent

| # | Finding | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **`ST_BG` hardcoded** (L4) — meme probleme que Stats | 🔴 | Utiliser les `--sc-*` / `--sb-*` deja definies dans theme.css |
| 2 | **Header mentionne "SAPURAI"** en dur (L22) au lieu du nom d'entreprise — incoherent avec la reco brand faite il y a 3 jours | 🟡 | Utiliser `companyName` prop comme dans Dash |
| 3 | **Notifications banner** : un seul bouton "OK" pour tout marquer lu. Pas possible de lire 1 par 1 | 🟡 | Tapper une notif l'ouvre (va sur le dossier). Bouton "OK" plus discret |
| 4 | **Empty state bien traite** (L47) | 🟢 Positif | |
| 5 | **Affichage taches done/total sur chaque dossier** (L58-60) : bonne synthese cognitive | 🟢 Positif | |

---

## 6. `Setup.tsx` — Creation entreprise

| # | Finding | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **Mode initial `null`** : ecran de choix vide sans branding fort. Comparé a Login qui a été refait, ça casse la continuité | 🟡 | Appliquer le meme pattern que Login : brand header, 1 primary ("Creer entreprise") + 1 secondary ("Rejoindre avec code") |
| 2 | **Formulaire create** simple : 2 champs seulement (companyName + userName). OK — mais manque cruellement des champs optionnels (logo upload, pays, devise) | 🟡 | Ne pas ajouter ces champs ici (friction), mais prevoir un onboarding post-creation |
| 3 | **Aucune confirmation/preview** avant `createCompany`. Le clic sur "Creer" cree immediatement la company + l'utilisateur | 🟢 | Ajouter un "Confirmer ?" discret |

---

## 7. `TeamPanel.tsx` — Gestion equipe

| # | Finding | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **3 tabs** (Membres / Code / Email) — le code et email sont 2 facons d'inviter. Pourrait etre fusionne | 🟡 | Une seule tab "Inviter" avec toggle "Lien generique / Email specifique" |
| 2 | **`ROLE_COLOR_VAR` utilisé maintenant** (corrige dans commit `3d2607a`) | 🟢 Positif | |
| 3 | **Pas d'icone sur les tabs** (juste texte) — pattern incoherent avec la sidebar | 🟡 | Ajouter emojis discrets pour scan visuel rapide |
| 4 | **"Rejoint le DD/MM/YYYY"** + "Il y a X min" (last seen) — bonne info pour admin, a preserver | 🟢 Positif | |

---

## 8. `Dep.tsx`, `Chs.tsx`, `Tcs.tsx`, `Caut.tsx` — Pages similaires

**Pattern commun** : tabs de filtres status, liste, bouton d'action.

| # | Finding (s'applique a toutes) | Severite | Recommandation |
|---|---------|----------|----------------|
| 1 | **Duplication du pattern tabs + liste** entre les 4 pages | 🟡 | Extraire un composant `<FilterTabs>` et `<ListLayout>` reutilisables — gain: coherence + maintenance |
| 2 | **Empty state non systematique** — seul Dos a un empty state soigne | 🟡 | Ajouter empty states sur Dep (pas de depense), Chs (pas de chauffeur), Caut (pas de caution en cours) |
| 3 | **Search input separe sur chaque page** | 🟢 | La TopBar globale fait deja de la search multi-entite, verifier que l'utilisateur le sait |

---

## 9. `TrackingPage.tsx` — Public tracking

**Deja audite + poli aujourd'hui.** Statut : A++ sur UX, contraste, structure.

Points restants non urgents :
- Absence d'ETA calcule (juste la date d'arrivee, pas d'estimation de livraison finale)
- Pas de photo des TCs (feature future)

---

## 🔝 Top 10 findings prioritaires (toutes pages confondues)

Tri par **impact utilisateur** :

| # | Page | Finding | Severite | Effort |
|---|------|---------|----------|--------|
| 1 | Stats + AgentView | Couleurs hardcoded (`PAL`, `ST_BG`) → graphs illisibles en dark | 🔴 | 30 min |
| 2 | Dash | `text-muted` sur labels < 14px → echoue WCAG AA en dark | 🔴 | 10 min |
| 3 | DetView | 10+ sections verticales, scroll interminable | 🔴 | 2-3h (onglets) |
| 4 | Dos | 9 controles simultanes dans toolbar | 🔴 | 1h (drawer filtres) |
| 5 | Dash | Urgences sans CTA hierarchise | 🟡 | 30 min (bandeau) |
| 6 | Setup | Discontinuite brand vs Login refait | 🟡 | 30 min |
| 7 | AgentView | "SAPURAI" hardcoded au lieu de companyName | 🟡 | 5 min |
| 8 | Dos | Tri "priorite" non documente | 🟡 | 5 min (tooltip) |
| 9 | DetView | 9 actions egales dans menu dropdown | 🟡 | 30 min |
| 10 | Dep/Chs/Tcs/Caut | Pattern duplicate → composants reutilisables | 🟡 | 2-3h |

**Total effort si tout fait** : ~10-12h de travail. Split en 2-3 sessions.

**Reco session suivante** : faire les 3 findings 🔴 #1 #2 #7 en 45 min — gros gain contraste/coherence immediat, low risk.

---

## Patterns transverses identifies

1. **Les couleurs hardcoded survivent par endroits** (Stats, AgentView). Le STYLE-GUIDE dit "jamais de hex en dur" — pas encore applique partout.
2. **Empty states** : Dash et AgentView en ont, le reste non. Incoherence.
3. **Duplication de patterns** (tabs filtres, recherche) entre pages — opportunity d'extraction composants.
4. **Text hierarchy** : usage de `text-muted` parfois pour du texte critique alors que ce token est decoratif (3.2:1 en dark). Verifier systematiquement.
5. **Decouvrabilite** : certaines features (bulk delete, export PDF bilan) existent mais ne sont pas mises en avant.

---

**Fin de l'audit.** Ce document complete `STYLE-GUIDE.md` et `NOTES-PRODUCT.md`.
