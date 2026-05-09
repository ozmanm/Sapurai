---
name: Sapurai
description: Système de gestion de transit international pour transitaires Dakar
colors:
  cream-office: "#f5f1e8"
  cream-section: "#efe9d6"
  cream-input: "#f0eada"
  cream-hover: "#ebe5d3"
  ink-primary: "#0a0a09"
  ink-secondary: "#3d3a32"
  ink-muted: "#737067"
  taupe-border: "#d6d0c0"
  taupe-light: "#ebe5d3"
  surface: "#ffffff"
  green-sapurai: "#15803d"
  green-soft-bg: "#d8efd8"
  red-surestarie: "#c0392b"
  red-soft-bg: "#fde7e3"
  amber-warehouse: "#a86a17"
  amber-soft-bg: "#fbeacd"
  blue-info: "#1e40af"
  blue-soft-bg: "#dbeafe"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(22px, 4vw, 32px)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
  mono-id:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.ink-secondary}"
    textColor: "{colors.surface}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-success:
    backgroundColor: "{colors.green-sapurai}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-export-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  card-primary:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-section:
    backgroundColor: "{colors.cream-section}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input-text:
    backgroundColor: "{colors.cream-input}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  badge-success:
    backgroundColor: "{colors.green-soft-bg}"
    textColor: "{colors.green-sapurai}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
    typography: "{typography.label}"
  badge-danger:
    backgroundColor: "{colors.red-soft-bg}"
    textColor: "{colors.red-surestarie}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
    typography: "{typography.label}"
  badge-amber:
    backgroundColor: "{colors.amber-soft-bg}"
    textColor: "{colors.amber-warehouse}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
    typography: "{typography.label}"
  pill-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
---

# Design System: Sapurai

## 1. Overview

**Creative North Star: "The Field Terminal"**

Sapurai est un terminal de terrain pour transitaires. Crème comme un cahier de bureau bien tenu, encre noire pour la lecture, JetBrains Mono pour les identifiants critiques (BL, conteneurs, montants), accents vert et rouge réservés aux signaux métier (succès / surestarie). Le système assume une esthétique d'**outil de travail sérieux**, pas de SaaS premium ; pas de gradients fluides, pas de glassmorphism, pas de palette néon. La page que tu regardes doit ressembler à un cahier de transit moderne, pas à un dashboard tech-bro.

L'identité visuelle est portée par trois piliers : (1) la **palette crème + encre** établit le ton "papier de bureau / carnet métier" qui rassure les utilisateurs réticents au changement ; (2) la **typographie mono pour les identifiants** transforme un BL ou un n° de conteneur en donnée fiable, lisible, copiable ; (3) le **vert sémantique réservé** marque les confirmations et les succès sans envahir l'écran. Tout ce qui n'est pas signal métier reste neutre.

Le système rejette explicitement : la palette arc-en-ciel par étape (un statut KATI rouge "danger" sème la panique chez le client malien — voir critique TrackingPage Sprint 28), les gradients dark-slate copiés de Linear/Stripe (palette hors-marché), les cards-in-card empilés (nesting = anti-pattern), les icônes emoji décoratives qui dépendent du rendu OS, et les modals comme premier réflexe (l'inline est toujours préférable).

**Key Characteristics :**
- Palette crème + encre + accents sémantiques minimaux (vert / rouge / ambre)
- JetBrains Mono partout où l'utilisateur lit un identifiant (BL, TC, montants, plaques camion)
- Plat par défaut, ombres réservées aux états interactifs et modals
- Border radius 8 (boutons, badges) et 12 (cards) uniquement
- Espacements 4 / 8 / 12 / 16 / 20 / 28 pour le rythme
- Mode sombre fonctionnel mais nice-to-have, lisibilité prime sur l'effet stylé
- Aucune dépendance à une typo non-Inter / non-mono

## 2. Colors: La Palette du Bureau

La palette de Sapurai est organisée en **trois rôles strictement séparés** : neutres (la crème du cahier), rôles sémantiques (le métier qui parle), et identité brand (l'encre noire). Aucun ton n'est décoratif.

### Primary

- **Encre Quasi-Noire** (`#0a0a09`) : utilisée pour le texte principal et le fond des CTA primaires. Presque noire, légèrement teintée vers le brun pour s'accorder avec la crème. Jamais `#000` pur. C'est la voix dominante du système.

### Secondary (rôles sémantiques métier)

- **Vert Sapurai** (`#15803d`) : succès, confirmations, statut RETOURNÉ, badge `📡 CMA` source vérifiée. Réservé aux **signaux positifs métier**. Ne jamais utiliser comme couleur décorative.
- **Rouge Surestarie** (`#c0392b`) : alertes critiques, urgences franchises, suppressions destructives. Réservé aux **signaux d'alarme métier**. Pas de "rouge esthétique".
- **Ambre Magasinage** (`#a86a17`) : warnings J-3, magasinage en cours, détention. Réservé aux **signaux de vigilance métier**. Brun-jaune terre, pas jaune flashy.

### Neutral (la crème du bureau)

- **Crème du Bureau** (`#f5f1e8`) : fond principal de toute l'app et de la landing. Évoque le papier ivoire du cahier de transit, pas le blanc clinique du SaaS.
- **Crème Section** (`#efe9d6`) : fonds des bandes alternées, cards de section secondaire.
- **Crème Input** (`#f0eada`) : fond des champs de formulaire, états hover discrets.
- **Crème Hover** (`#ebe5d3`) : feedback hover, separators légers.
- **Surface Blanche** (`#ffffff`) : cards primaires uniquement. Le blanc pur n'est jamais le fond du body.
- **Encre Secondaire** (`#3d3a32`) : taupe foncé pour les labels et le texte d'inputs. Contraste 9:1 sur crème.
- **Encre Atténuée** (`#737067`) : taupe pour metadata et infos secondaires. Contraste ~5:1 sur crème (limite WCAG AA, OK pour décoratif).
- **Taupe Discret** (`#d6d0c0`) : borders, séparateurs. Jamais une couleur vive en bordure.

### Tertiary (info / accent secondaire)

- **Bleu Info** (`#1e40af`) : liens, info notifications, alertes pédagogiques (pas alarme). Usage rare, < 5% des écrans.

### Named Rules

**The Cream-First Rule.** Le fond du body est **toujours** la crème (`--bg-body`). Le blanc pur (`--bg-primary` / `#ffffff`) est réservé aux cards qui doivent ressortir du fond crème. Inverser cette hiérarchie casse l'identité.

**The Sémantique Réservée Rule.** Vert, rouge, ambre sont **uniquement** des signaux métier. Pas de bouton "Sauvegarder" en vert "parce que ça fait positif". Pas de heading rouge "parce que ça attire l'œil". Si tu ressens le besoin d'un accent décoratif, tu cherches du noir ou du taupe.

**The Pas de #000 Rule.** Jamais de noir pur (`#000`) ni de blanc pur (`#fff`) comme couleur de texte ou de fond. L'encre est `#0a0a09` (légèrement chaude), la surface blanche est `#ffffff` réservée aux cards primaires uniquement.

## 3. Typography

**Body & Display Font:** Inter (avec fallback `system-ui, -apple-system, sans-serif`).
**Mono Font:** JetBrains Mono (avec fallback `ui-monospace, monospace`).

**Character:** Inter porte la voix neutre, professionnelle, lisible sur petit écran. JetBrains Mono est l'outil métier : tout ce qui est un **identifiant à lire ou copier** (n° BL, n° conteneur, plaque d'immatriculation, montant FCFA) passe en mono. Le contraste mono/sans est délibéré : il dit *"cette donnée est précise, vérifiable, copiable"*.

### Hierarchy

- **Display** (Inter 800, clamp 22-32px, line-height 1.15, letter-spacing -0.02em) : titres de pages principaux, KPIs accueil ("Dossiers 38"). Volume rare.
- **Headline** (Inter 900, 18px, line-height 1.2) : titres de sections, h1 de pages secondaires (ex: page tracking client).
- **Title** (Inter 700, 14-16px, line-height 1.3) : titres de cards, valeurs principales (`VAL` style dans TrackingPage).
- **Body** (Inter 400, 13-14px, line-height 1.55) : texte courant des cards, descriptions, copies.
- **Label** (Inter 700, 11-12px, **uppercase**, letter-spacing 0.05em) : labels de formulaire, sections cards ("CLIENT", "TRANSPORT", "URGENCES"). C'est la signature visuelle "métier" du système.
- **Mono-ID** (JetBrains Mono 600, 13-15px, letter-spacing 0) : tous les identifiants critiques. Spec absolue.

### Named Rules

**The Identifier Mono Rule.** Tout identifiant qui apparaît à l'écran et que l'utilisateur peut copier-coller (BL, conteneur, plaque, n° de facture, montant FCFA) est rendu en `--font-mono`. Aucune exception. Un identifiant en sans-serif est une faute.

**The Uppercase Label Rule.** Les labels de section (au-dessus de groupes d'inputs ou de KPIs) sont **uppercase**, weight 700, font-size 11px, letter-spacing 0.05em. Cette signature visuelle est cohérente partout. Un label en title case est une dérive.

**The 65-75ch Body Rule.** Le texte courant (cards informationnelles, copies marketing landing) ne dépasse jamais 75 caractères de large. Sur écrans larges, on cap à 600px max-width. Une ligne plus longue est illisible.

## 4. Elevation

Sapurai est **plat par défaut**. Les ombres existent mais sont réservées à 4 contextes précis : (1) cards qui doivent ressortir du fond crème (ombre douce `--shadow`, `0 1px 3px rgba(10,10,9,0.08)`), (2) états hover/lift (translation + ombre amplifiée `0 14px 30px -12px rgba(10,10,9,0.18)`), (3) modals/overlays (ombre prononcée `--shadow-lg`, `0 24px 60px -20px rgba(0,0,0,0.3)`), (4) le hero de DetView (gradient permanent dark documenté).

Le système n'a pas de stack d'élévations Material-style ("elevation-1, elevation-2…"). Les ombres sont **sémantiques** (état d'interaction ou rôle structurel), pas décoratives.

### Shadow Vocabulary

- **`--shadow`** (`0 1px 3px rgba(10,10,9,0.08)`) : cards primaires (TC, dossier info, voyage). Ambient, ne crie pas.
- **Hover lift** (`0 14px 30px -12px rgba(10,10,9,0.18)`) : cards interactives au hover. Translation `translateY(-3px)`. Discret.
- **`--shadow-lg`** (`0 24px 60px -20px rgba(0,0,0,0.3)`) : modals, dropdowns, mock dashboard de la landing.
- **CTA glow** (`0 12px 24px -8px rgba(10,10,9,0.4)` ou `rgba(22,163,74,0.5)` pour CTA success) : seulement les CTA primaires/success au hover.

### Named Rules

**The Flat-By-Default Rule.** Les surfaces sont **plates au repos**. Une ombre apparaît seulement comme réponse à un état (hover, focus, modal ouvert). Une card qui a une ombre prononcée au repos est mal stylée.

**The Pas de Glassmorphism Rule.** `backdrop-filter: blur` est interdit comme effet décoratif. Le système n'a aucun usage légitime de glass cards. Si tu en ressens le besoin, c'est un anti-pattern.

## 5. Components

### Buttons

- **Shape :** rounded `--radius` (8px) pour CTA standard, `--radius-pill` (999px) pour pills toggle (rating reasons, filters).
- **Primary :** background `--btn-primary-bg` (`#0a0a09` encre), text `--btn-primary-text` (`#ffffff`), padding 10×16, font Inter 600 14px. Hover : `translateY(-2px)` + shadow CTA glow.
- **Ghost / Secondary :** background transparent, border `1px solid var(--border)` (`#d6d0c0`), text `--text-primary`. Padding identique. Hover : background `--bg-tertiary` (`#f0eada`).
- **Success (vert métier) :** background `--success` (`#15803d`), text white, padding 10×16. Réservé aux confirmations métier (dispatcher, valider, créer compte). Pas pour "Sauvegarder" générique.
- **Export outline :** background blanc + border + icône colorée (vert pour Excel, rouge pour PDF). Pattern Sapurai-spécifique (Sprint 24, Option A boutons).
- **Disabled :** background `--bg-secondary` (`#efe9d6`), text `--text-muted` (`#737067`), `cursor: not-allowed`.

### Cards / Containers

- **Corner :** `--radius-lg` (12px). Pas de 14, pas de 10, pas de 20. Discipline.
- **Background :** `--bg-primary` (`#ffffff`) pour cards qui ressortent du fond crème, `--bg-secondary` (`#efe9d6`) pour bandes alternées dans une page.
- **Shadow :** `--shadow` ambient au repos, hover lift `translateY(-3px)` + shadow amplifiée pour les cards interactives.
- **Border :** `1px solid var(--border)` (`#d6d0c0`). Optionnel selon contexte. **Jamais de border colorée vive** comme accent.
- **Padding :** 16px (compact, metadata cards), 20px (TC cards, info dossier), 28-32px (hero card landing).

### Badges (status)

- **Style :** font-mono uppercase, font-size 10-12px, weight 700, padding 3×8, radius `--radius-sm` (4-6px).
- **Variants :** `success` (`#d8efd8` bg, `#15803d` text), `danger` (`#fde7e3` bg, `#c0392b` text), `amber` (`#fbeacd` bg, `#a86a17` text), `info` (`#dbeafe` bg, `#1e40af` text).
- **Convention :** background = soft (clear cream-tinted), text = saturé. Jamais l'inverse.

### Inputs / Fields

- **Style :** background `--bg-tertiary` (`#f0eada`), border `1px solid var(--border)`, radius `--radius` (8px), padding 10×12, font Inter 14px.
- **Focus :** border `--text-primary`, shadow ambient. Pas de `outline: none` sans remplaçant. WCAG focus ring.
- **Disabled :** background `--bg-secondary`, text `--text-muted`.
- **Error :** border `--danger`, helper text `--danger-text` 11px sous le champ.

### Navigation

- **Sidebar (248px desktop)** : background `--bg-primary`, border-right `--border`. Items : padding 10×12, icon 20px à gauche. **Actif** = background `--btn-primary-bg` + text `--btn-primary-text` (s'inverse en dark). Badge count en mono compact tabular-nums.
- **TopBar :** background `--bg-primary`, border-bottom `--border`. Recherche centrée 480px. CTA "Admin" / role-pill en haut à droite.
- **Mobile (<1024px)** : sidebar collapsible, topbar conserve recherche compacte.

### Stepper (TC progression)

- **6 étapes** : ATTENDU → PORT → DISPATCHE → TRANSIT → KATI → BAMAKO → RETOUR.
- **3 états visuels** : upcoming (taupe pâle), current (encre + ring vert), done (vert plein + check ✓).
- **Identifiant mono** : lettre P/D/T/K/B/R dans le cercle quand `current`.
- **Responsive** : horizontal sur desktop, vertical sous 480px (Sprint 19 fix mobile).

### Sapurai Logo

- Carré arrondi noir 32-56px, "S" stroke blanc tracé comme une **route** avec pointillés ambre `#fbbf24` (clin d'œil supply chain + samouraï).
- Toujours accompagné du texte "Sapurai" en Inter 700 sauf icônes app/favicon.
- **Signature unique du système.** Ne jamais remplacer par un emoji 🚛 ou un logo générique.

## 6. Do's and Don'ts

### Do:

- **Do** utiliser `--font-mono` (JetBrains Mono) pour **chaque** identifiant à l'écran : BL, conteneur, montant FCFA, plaque camion, n° de facture. Sans exception.
- **Do** garder le vert / rouge / ambre **strictement sémantiques** (succès / alarme / vigilance). Si une couleur est décorative, c'est noir ou taupe.
- **Do** appliquer le pattern "background soft + text saturé" sur tous les badges sémantiques (`#d8efd8` + `#15803d`, `#fde7e3` + `#c0392b`, etc.).
- **Do** réserver les ombres aux **états interactifs** et aux modals. Au repos, les surfaces sont plates.
- **Do** documenter chaque exception au système avec `// eslint-disable-next-line no-restricted-syntax -- <raison>` (ex: WhatsApp brand `#25D366`, hero gradient permanent DetView, Landing brand tier).
- **Do** afficher le **provenance badge** sur chaque donnée à source externe : `📡 CMA`, "Sync DPWorld", saisie manuelle. La source est toujours explicite.
- **Do** assumer le **terminal-style mono** pour les éléments métier (steppers, identifiants, dates ISO). C'est la signature visuelle de Sapurai.
- **Do** respecter les **3 niveaux de border-radius** : 6 (badges compacts), 8 (boutons/inputs/cards petites), 12 (cards principales), 999 (pills toggle). Aucune autre valeur.
- **Do** utiliser des **labels uppercase 11px Inter 700 letter-spacing 0.05em** pour titrer les sections. C'est cohérent partout.
- **Do** vérifier WCAG AA (4.5:1 body, 3:1 large text) pour chaque token texte avec son fond.

### Don't:

- **Don't** utiliser `#000` ou `#fff` purs. L'encre est `#0a0a09`, la surface blanche `#ffffff` est réservée aux cards primaires uniquement.
- **Don't** introduire une palette arc-en-ciel pour différencier des étapes ou des catégories (cf. critique Sprint 28 : KATI en rouge `#ef4444` semait panique chez clients maliens). **La position dans une séquence raconte la progression, la couleur l'affirme** : trois états (upcoming / current / done) suffisent.
- **Don't** copier les gradients dark-slate (`linear-gradient(135deg, #1c1917, #292524)`) de Linear / Stripe / Cron. Sapurai utilise `--btn-primary-bg` plein. Une seule exception : le hero card permanent DetView, documenté.
- **Don't** imbriquer des cards (card-in-card). C'est un anti-pattern explicite. Si une section logique a besoin de structure, utiliser un divider sec et continuer au même niveau.
- **Don't** abuser des emojis décoratifs (⚓🚚🛣️📍🏙️). Garder uniquement les emojis **sémantiques** (✓ done, ⚠ alert, 😊😐😟 rating sentiment, 💬 WhatsApp brand). Pour les steppers métier, utiliser les **lettres mono** (P/D/T/K/B/R).
- **Don't** appliquer `backdrop-filter: blur` (glassmorphism) en décoration. Sapurai n'a aucun usage légitime de glass cards.
- **Don't** utiliser des border-side-stripe (`border-left: 4px solid color`) comme accent sur cards/alerts. C'est un anti-pattern explicite. Réécrire avec full border, background tint, ou rien.
- **Don't** appliquer `background-clip: text` pour des dégradés de texte. Texte = couleur unie, emphasis par weight ou size.
- **Don't** afficher "SAPURAI" comme fallback de marque dans le header tracking quand `coName` n'existe pas. Le client doit voir son transitaire ou un texte neutre, **jamais** la marque vendor.
- **Don't** créer de nouveaux composants UI quand un existant fait le travail (`Btn`, `Card`, `Badge`, `FormField`, `Pagination`, `Skeleton`, `EmptyState`, `SapuraiLogo`). Tout nouvel ajout doit être justifié.
- **Don't** mettre une transition `all` (`transition: all 0.3s`). Toujours préciser les propriétés (`background, box-shadow`) et l'easing (`ease-out`). Pas de bounce ni elastic.
- **Don't** oublier `prefers-reduced-motion`. Les animations Sapurai sont désactivées si l'utilisateur l'a demandé dans son OS.
- **Don't** faire un onboarding lourd ou un tutorial intrusif. La règle d'or PRODUCT.md : *"Si l'utilisateur doit apprendre Sapurai plus de 5 minutes, c'est raté."* L'info se voit en 5 secondes.
- **Don't** lier directement à `https://sapurai-84984.web.app` depuis l'UI app interne. Le footer "Suivi via Sapurai" est réservé à la page tracking publique.
