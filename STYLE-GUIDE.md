# Sapurai — Style Guide

> Regles de style et conventions design pour eviter les regressions dark mode et assurer la coherence visuelle.
> Derniere mise a jour : 2026-04-18

---

## 0. Enforcement automatique

Une regle ESLint custom (`no-restricted-syntax`) detecte les hex colors dans les attributs `style={}` JSX et emet un warning a chaque build.

**Verifier :** `npm run lint` → les hex hardcoded apparaissent avec le message "Hex color hardcodee dans style={}".

**Bypass legitime :** ajouter une ligne de justification avant la ligne concernee :

```tsx
// eslint-disable-next-line no-restricted-syntax -- WhatsApp brand color immuable
<a style={{ background: "#25D366" }}>WhatsApp</a>
```

**Exceptions deja identifiees et documentees** (a annoter avec le commentaire ci-dessus) :
- Couleurs de marques tierces : `#25D366` (WhatsApp), Google Sign-In colors
- `STEP_COLORS` dans TrackingPage — palette semantique intentionnelle par etape transit
- Hero card gradient `#1c1917 → #292524` (dark permanent, ne s'inverse pas) — DetView L53, Login btnPrimary
- Couleurs print/pdf destinees au papier (non theme-aware par design)

**Backlog a purger progressivement** : au 2026-04-18, 25 warnings restants repartis dans 19 fichiers (detail via `npm run lint | grep no-restricted-syntax`). A traiter par lots en sessions futures.

---

## 1. Regle d'or : **jamais de couleur en dur**

**Interdit :**
```tsx
style={{ background: "#fafaf9", color: "#1e3a5f", border: "1px solid #e7e5e4" }}
```

**Autorise :**
```tsx
style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
```

**Pourquoi** : les CSS variables (dans `src/styles/theme.css`) basculent automatiquement entre light et dark selon `data-theme`. Une couleur hardcodee ne bascule pas → rendu casse en dark.

**Exceptions tolerees** :
- Couleurs de marques tierces immuables (WhatsApp `#25D366`, Google palette Sign-In)
- Print styles / pdf / export Excel (destination papier, theme inutile)
- Constantes semantiques documentees (`STEP_COLORS` dans TrackingPage — couleurs par etape de transit, intentionnelles)

---

## 2. Tokens par type d'usage

### 2.1 Backgrounds
| Variable | Usage |
|----------|-------|
| `--bg-body` | Fond de la page (root) |
| `--bg-primary` | Cards / panneaux principaux |
| `--bg-secondary` | Zones secondaires (filtres, hovers subtils) |
| `--bg-tertiary` | Zones tertiaires (cards imbriquees, sections info) |
| `--bg-hover` | Etat hover pour boutons et items cliquables |

### 2.2 Textes (hierarchie)
| Variable | Usage | Contraste dark |
|----------|-------|---------------:|
| `--text-primary` | Titres, valeurs cle | ~9:1 (AAA) |
| `--text-secondary` | Sous-titres, descriptions, body secondaire | ~6.5:1 (AA) |
| `--text-tertiary` | Labels secondaires, infos contextuelles | ~4.1:1 (AA large) |
| `--text-muted` | Hints decoratifs (placeholders, watermarks) | ~3.2:1 (decoratif) |
| `--text-input` | Valeurs saisies dans inputs | ~7:1 |

**⚠ Ne pas utiliser `--text-muted` pour du texte critique (timestamps, messages d'erreur, donnees metier)**. Destine au decoratif.

### 2.3 Bordures
| Variable | Usage |
|----------|-------|
| `--border` | Bordures cards, separateurs |
| `--border-light` | Sub-separateurs dans cards, lignes tres discretes |

### 2.4 Semantiques (couleurs metier)

Chaque couleur semantique a 5 variantes :

- `--X` : couleur principale (texte sur fond clair, icones, borders)
- `--X-bg` : fond sombre/sature (cards statut, badges)
- `--X-light` : fond clair/subtil (highlight subtil)
- `--X-text` : texte sur `-bg` (contraste optimise pour le fond sombre)
- `--X-border` : bordure coherente avec le statut

Couleurs :
- **success** (vert) : succes, paiement, retour
- **danger** (rouge) : erreur, urgence, surestaries
- **warning** (orange) : alerte, pending
- **info** (bleu) : info neutre, BSC
- **purple** (violet) : locations, lettres louees, logs

**Regle paires fond/texte** : sur `--X-bg` ou `--X-light` utilise **toujours** `--X-text`, jamais `--X` (contraste insuffisant valide).

```tsx
// OK
<div style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
// Pas OK — contraste limite en dark
<div style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
```

### 2.5 Buttons
| Variable | Usage |
|----------|-------|
| `--btn-primary-bg` | Fond bouton principal (s'inverse entre light et dark !) |
| `--btn-primary-text` | Texte du bouton principal |
| `--btn-ghost-text` | Texte bouton ghost / link |
| `--btn-ghost-border` | Bordure bouton ghost |
| `--btn-link` | Liens hypertexte |

**⚠ `--btn-primary-bg` et `--btn-primary-text` s'inversent entre light et dark (bouton sombre clair et vice-versa). NE PAS les utiliser pour des zones non-bouton** (ex : header card). Utilise un token dedie ou hardcode un vrai dark permanent.

---

## 3. Hierarchie typographique

Echelle ciblee : **11 / 12 / 13 / 14 / 15 / 18** px.

| Size | Usage |
|------|-------|
| 11 | Micro-labels uppercase, hints, footer |
| 12 | Meta-infos, dates, sous-titres |
| 13 | Body courant |
| 14 | Valeurs cle dans formulaires |
| 15 | Titres de cards, numeros |
| 18+ | Titres de page, hero |

**Evite** : 9, 10 (sous le seuil de lisibilite WCAG sur mobile Android moyen).

---

## 4. Spacing rhythm

Echelle : **4 / 8 / 12 / 16 / 20 / 32** px.

Evite 2, 6, 10, 14, 24 — reduisent la coherence visuelle. Si une regle visuelle impose une valeur intermediaire, justifie-la avec un commentaire.

---

## 5. Checklist avant merge d'un nouveau composant

- [ ] Aucune couleur hex en dur dans `style={}` (sauf exceptions §1)
- [ ] Textes sur fond `--X-bg` utilisent `--X-text`, pas `--X`
- [ ] Test visuel en **dark mode** (`data-theme="dark"` sur `<html>`)
- [ ] Aucune utilisation de `--text-muted` pour du texte critique
- [ ] Font sizes dans l'echelle 11/12/13/14/15/18
- [ ] Espacement dans l'echelle 4/8/12/16/20/32
- [ ] Contraste WCAG AA verifie sur les paires non-standards (4.5:1 pour texte normal, 3:1 pour ≥18pt ou ≥14pt bold)

---

## 6. Comment verifier un contraste

Dans la console navigateur :

```js
// Ratio de contraste entre 2 couleurs (retourne N:1)
function contrast(c1, c2) {
  function lum(c) {
    var [r,g,b] = c.match(/\w\w/g).map(function (x) { return parseInt(x,16)/255; });
    return [r,g,b].map(function (v) { return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); })
      .reduce(function (s,v,i) { return s + v*[0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  var l1 = lum(c1), l2 = lum(c2);
  return ((Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05)).toFixed(2) + ":1";
}
contrast("1c1917", "fafaf9");  // → "18.33:1"
contrast("2e1065", "a78bfa");  // → "2.89:1" ❌
```

---

## 7. Historique des corrections dark

| Date | Correction |
|------|-----------|
| 2026-04-18 | Phase 1 : `--text-muted` 2.30→3.2:1, `--text-secondary` 4.08→6.5:1, `--purple` 2.89→5:1, `--success` 4.53→5.5:1, `--purple-text` 4.37→6.3:1 |
| 2026-04-18 | Phase 2 : DetView hero card (bg hardcoded dark permanent), textes navy remplaces par `var(--info-text)` / `var(--danger-text)`, dots etape `var(--border)` |

Fichiers encore a traiter (hex hardcode) : `main.tsx` (34), `TeamPanel.tsx` (27), `ScanBL.tsx` (21). A faire en sessions ulterieures.

---

## 8. Ressources

- **Theme source** : `src/styles/theme.css`
- **Types domaine** : `src/types.ts`
- **WCAG AA** : 4.5:1 texte normal, 3:1 texte large (≥18pt ou ≥14pt bold)
- **Tool externe** : [webaim.org/resources/contrastchecker/](https://webaim.org/resources/contrastchecker/)
