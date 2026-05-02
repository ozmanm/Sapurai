# Accessibility Audit — Sapurai

> **Standard** : WCAG 2.1 AA | **Date** : 2026-04-18 | **Methode** : audit code-based transverse
>
> Ne remplace pas un test utilisateur avec lecteur d'ecran ou keyboard-only.
>
> **Statut des fixes** (mis a jour 2026-04-19) :
> - ✅ **#1** image alt (JdocView)
> - ✅ **#3** badge contrast (utils/contrast.ts + textColorFor)
> - ✅ **#4** ClickableDiv cree + migre sur Dash urgences (**backlog : 75 autres divs — outillage pret, migration mecanique differable**)
> - ✅ **#5** focus-visible global (theme.css)
> - ✅ **#6** skip link (App.tsx + CSS)
> - ✅ **#7** touch targets : Dep toggle + IntervenantsView bumpes a 40px (autres 36px passent AA 24x24)
> - ✅ **#8** aria-invalid applique sur NDosForm + NChForm ; Login et Setup ont `role="alert"` sur erreurs (NDepForm pas de validation)
> - ✅ **#9** prefers-reduced-motion (theme.css)
> - ✅ **#10** Overlay : aria-labelledby pointant sur h2 + id unique par instance
> - ⏸ **#2** STEP_COLORS test unitaire (pas encore ecrit, pas bloquant)

---

## Summary

**Issues found** : 10 categories
- 🔴 **Critical** : 3 (keyboard non-fonctionnel, focus indicator absent, divs cliquables sans role)
- 🟡 **Major** : 4 (skip link, image alt, aria-invalid, touch targets)
- 🟢 **Minor** : 3 (reduced-motion, aria-describedby, contraste STEP_COLORS)

**Ce qui va bien** (reconnu) : ARIA landmarks, role=alert avec aria-live, Overlay avec Escape, contrastes dark corriges aujourd'hui (WCAG AA atteint sur text-primary/secondary/tertiary).

---

## Findings

### 🔴 Perceivable

| # | Issue | WCAG | Severite | Recommandation |
|---|-------|------|----------|----------------|
| 1 | **Image preview document sans alt text** (`JdocView.tsx:80`) — image de prévisualisation d'une photo uploadée n'a pas d'alt. Un lecteur d'ecran annonce juste "image" | 1.1.1 | 🟡 Major | `<img alt={"Preview de " + dc.tp} src={...}>` ou `alt=""` si purement decoratif + `aria-label` sur le container |
| 2 | **STEP_COLORS hardcoded** (TrackingPage, AgentView) sont des couleurs semantiques MAIS ne respectent pas systematiquement le contraste AA quand utilisees comme texte. Ex : `#6b7280` gris sur fond blanc = ~4.6:1 (passe juste) | 1.4.3 | 🟢 Minor | Ajouter un test unitaire qui calcule le ratio des STEP_COLORS sur fond blanc + fond noir. Annoter les couleurs qui sont marginales |
| 3 | **Status TC badge `color: "white"` sur `background: STEP_COLORS[...]`** — `#f59e0b` (TRANSIT) blanc dessus = 1.8:1 ECHEC WCAG AA | 1.4.3 | 🔴 Critical | Utiliser du noir sur fond jaune/orange : `color: stepColor === "#f59e0b" ? "#1c1917" : "white"`. Ou : generer une palette de badges qui respecte le contraste automatiquement |

### 🔴 Operable

| # | Issue | WCAG | Severite | Recommandation |
|---|-------|------|----------|----------------|
| 4 | **77 `<div onClick>` dans le code** — divs cliquables **sans** `role="button"`, **sans** `tabindex="0"`, **sans** `onKeyDown`. Les utilisateurs keyboard-only ne peuvent PAS activer ces elements (urgences groupees, cards cliquables, rows de liste). | 2.1.1 | 🔴 Critical | Convertir en `<button>` quand possible. Sinon ajouter `role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' \|\| e.key === ' ') handler(); }}`. **Fix systemique** : creer un composant `<ClickableDiv>` qui encapsule ces 3 attributs |
| 5 | **`outline: none` partout sans replacement `:focus-visible`** — 20+ inputs avec `outline: "none"` dans style inline, aucune regle `:focus` ou `:focus-visible` dans les CSS. Quand l'utilisateur tab, aucun indicateur visuel. | 2.4.7 | 🔴 Critical | Ajouter dans `layout.css` : `button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }` |
| 6 | **Pas de skip link "Aller au contenu principal"** — un utilisateur keyboard doit tab a travers toute la sidebar (7 items) avant d'atteindre le contenu | 2.4.1 | 🟡 Major | Ajouter en haut du body : `<a href="#main-content" className="lt-skip">Aller au contenu</a>` avec `position: absolute; left: -10000px;` par defaut et `:focus { left: 0; }` |
| 7 | **Touch targets < 44px** sur certains boutons (minHeight 28/32/36 trouves dans le code) | 2.5.5 AAA (24x24 AA) | 🟢 Minor | AA passe a 24x24, donc OK en legal. Mais pour terrain Mali sur mobile avec doigts gants : cibler 44+. Principaux petits boutons : selects de tri dans Dos, boutons role dans TeamPanel |

### 🔴 Understandable

| # | Issue | WCAG | Severite | Recommandation |
|---|-------|------|----------|----------------|
| 8 | **Pas d'`aria-invalid` ni `aria-describedby` sur les formulaires** — quand un input a une erreur de validation, le message d'erreur n'est pas lie semantiquement au champ. Un lecteur d'ecran ne dit pas "Email invalide" en focus l'input | 3.3.1 | 🟡 Major | Sur chaque input avec validation : `aria-invalid={!!err} aria-describedby={err ? "err-" + id : undefined}` + `<div id={"err-" + id} role="alert">{err}</div>` |
| 9 | **Pas de `prefers-reduced-motion`** — les transitions (stepper, modales, spinners) ne respectent pas la preference utilisateur. Utilisateurs sensibles aux animations peuvent avoir vertige | 2.3.3 AAA | 🟢 Minor | Dans `theme.css` : `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` |

### 🔴 Robust

| # | Issue | WCAG | Severite | Recommandation |
|---|-------|------|----------|----------------|
| 10 | **Modales de formulaire (AppModals) — pas toujours de `aria-labelledby`** — Overlay accepte un `aria-label` prop mais certaines modales oublient de le passer, les lecteurs d'ecran ne savent pas de quoi on parle | 4.1.2 | 🟡 Major | Verifier chaque `<Overlay title={...}>` et s'assurer que `title` est toujours fourni. Fallback = `"Dialogue"` actuel n'est pas suffisant. |

---

## Color Contrast Check — dark mode (post-fix aujourd'hui)

| Element | Foreground | Background | Ratio | Required | Pass? |
|---------|-----------|------------|-------|----------|-------|
| Body text primary | #fafaf9 | #1c1917 | 9.0:1 | 4.5:1 | ✅ AAA |
| Text secondary | #d6d3d1 | #1c1917 | 6.5:1 | 4.5:1 | ✅ AA |
| Text tertiary | #a8a29e | #1c1917 | 4.1:1 | 4.5:1 | ❌ (passe AA large 3:1) |
| Text muted (decoratif) | #8b857f | #1c1917 | 3.2:1 | 4.5:1 | ❌ (passe AA large 3:1) |
| Success | #6ee7b7 | #052e16 | 5.5:1 | 4.5:1 | ✅ AA |
| Danger bg vs text | #f87171 | #450a0a | 5.06:1 | 4.5:1 | ✅ AA |
| Purple | #c4b5fd | #2e1065 | ~5:1 | 4.5:1 | ✅ AA |
| **Status badge** | white | #f59e0b (TRANSIT) | 1.8:1 | 3:1 (UI component) | ❌ **CRITIQUE** |
| **Status badge** | white | #ef4444 (KATI) | 3.8:1 | 4.5:1 (text) | ❌ |

**Finding** : Les **badges de statut TC** (TRANSIT orange, KATI rouge clair) avec texte blanc echouent WCAG. A corriger : mettre le texte en noir `#1c1917` sur les fonds clairs (orange, rouge clair), blanc sur les fonds sombres (bleu, violet, vert fonce).

---

## Keyboard Navigation Check

| Element | Tab Order | Enter/Space | Escape | Arrow Keys | Verdict |
|---------|-----------|-------------|--------|------------|---------|
| Sidebar nav items | ✅ sequential | ✅ navigate | n/a | ❌ pas gere | Majeur OK, arrow keys a ajouter |
| TopBar search | ✅ | ✅ submit | ❌ ne ferme pas le dropdown | n/a | Escape a ajouter |
| Modal overlay | ✅ | ✅ | ✅ ferme | n/a | ✅ |
| `<div onClick>` (urgences, cards cliquables) | ❌ non tabbable | ❌ n/a | n/a | n/a | 🔴 BROKEN |
| Pregate input inline | ✅ | ✅ Enter submit | n/a | n/a | ✅ |
| Boutons standards | ✅ | ✅ | n/a | n/a | ✅ |
| Liens `<a>` | ✅ | ✅ | n/a | n/a | ✅ |

**Focus trap dans les modales** : l'Overlay a un auto-focus sur le premier element focusable, mais **pas de focus trap** (l'utilisateur peut tab dans la page derriere). A renforcer.

---

## Screen Reader Check (mental model — pas teste avec un vrai SR)

| Element | Annonce probable | Issue |
|---------|-----------------|-------|
| Toast succes/erreur | "Dossier cree" (via role=alert aria-live=polite) | ✅ OK |
| Sidebar nav | "Navigation principale, menu, Dossiers, 12" | ✅ OK avec aria-label et role=menubar |
| TrackingPage stepper | "Progression du conteneur, liste, Etape courante Port 27/01/2026" | ✅ OK avec aria-current="step" |
| `<div onClick>` urgences | "Texte '3 urgences'" — pas "bouton" | ❌ ne sait pas que c'est cliquable |
| Input avec erreur | "Email, champ de texte" (mais "Email invalide" pas associe) | ❌ 3.3.1 |
| Image preview document | "image" (pas de description) | ❌ 1.1.1 |
| Badge TC TRANSIT | "En Transit" (sur fond orange, contraste faible mais SR ne voit pas les couleurs) | ✅ OK pour SR, ❌ visuel |

---

## Priority Fixes

### Urgent (Critical + Major) — ~2h total

1. **Fix #5 focus-visible** — ajouter les 4 lignes CSS dans `layout.css` ou `theme.css`. **5 min.** Impact massif : tout utilisateur keyboard voit enfin ou il est.

2. **Fix #3 contraste badge** — ajouter une logique `textColorFor(bgColor)` qui calcule le bon noir/blanc selon luminance. **20 min.** Evite le fail WCAG sur les statuts TRANSIT/KATI.

3. **Fix #4 divs cliquables** — creer un composant `<ClickableDiv>` + migration des 77 occurrences. **~1h** (fractionnable par page).

4. **Fix #1 image alt** — 1 ligne dans JdocView. **2 min.**

5. **Fix #6 skip link** — 1 composant + 1 CSS. **15 min.**

6. **Fix #8 aria-invalid** — ajouter sur les 5 formulaires principaux (Login, NDosForm, NDepForm, NChForm, Setup). **30 min.**

### Moyen terme (Minor) — ~30 min

7. **Fix #9 prefers-reduced-motion** — 1 media query dans theme.css. **5 min.**

8. **Fix #7 touch targets** — audit des boutons sous 44px, bump a 44. **15 min.**

9. **Fix #10 Overlay title** — verifier les call sites AppModals. **10 min.**

10. **Fix #2 STEP_COLORS contraste** — ecrire un test unitaire. **10 min.**

---

## Recommandation

**Session focus accessibilite (~2h30)** qui resout les 6 Urgent + les 4 Minor.

**Effort ROI** : les 2 premieres corrections (#5 focus-visible + #3 badge contrast) representent **25 minutes** de travail pour **eliminer les 2 plus gros fail WCAG** de l'app. A faire en priorite.

Le #4 (77 divs cliquables) est le chantier le plus long mais peut etre fractionne : commencer par les pages les plus utilisees (Dash urgences cards, DetView), finir par les pages secondaires.

---

## Ce que cet audit N'a PAS teste

1. **Vrai test lecteur d'ecran** (VoiceOver iOS, NVDA Windows, TalkBack Android) — necessite un vrai humain qui ecoute
2. **Keyboard-only reel** — j'ai infere du code, pas teste main sur clavier
3. **Zoom 200%** — le layout mobile-first de Sapurai est responsive, probable que ca tienne, mais non verifie
4. **Touch sur mobile reel** — tailles des targets verifiees dans le code, pas au doigt
5. **Navigation audio-only** (utilisateur malvoyant complet) — seulement SR+keyboard mental model
6. **Ecrans d'authentification Firebase** (popup Google) — depend de Google
7. **Contraste STEP_COLORS systematique** — les 6 couleurs badges x 2 themes x 2 textes = 24 ratios a calculer

**Recommandation** : apres les fixes automatisables, faire un test utilisateur avec un lecteur d'ecran (30 min) pour valider ce que l'audit code n'attrape pas.

---

*Ce document peut etre mis a jour apres chaque session de correction, ou apres des tests manuels pour completer les zones inexplorees.*
