# Sapurai — Notes produit a valider avec Ibrahima

> Fichier de capture des questions metier / incoherences fonctionnelles decouvertes
> pendant les refactors techniques. A relire et decider avant les gros chantiers.
>
> Derniere mise a jour : 2026-04-18

---

## 🚨 A valider — bloquant pour le refactor E

### 1. Cloture d'un dossier et statut des conteneurs

**Contexte technique** — revele par F.1 (tests useAppLogic)

Il existe 2 chemins pour cloturer un dossier :

| Chemin | Code | Comportement actuel |
|--------|------|---------------------|
| **Manuel** | `closeDos(dosId)` (bouton "Cloturer" dans DetView) | Passe le dossier a CLOTURE, ne touche PAS aux TCs |
| **Automatique** | `advance()` → le dernier TC passe RETURNED | Passe le dossier a CLOTURE avec tous les TCs deja RETURNED |

**Incoherence** : apres un `closeDos` manuel, on peut se retrouver avec :
- Un dossier en **CLOTURE**
- Des TCs du dossier en **BAMAKO**, **KATI**, voire **PORT**

Ce qui peut casser :
- Stats financieres (dossier cloture compte dans les terminees, TC actif compte dans les en cours)
- Urgences magasinage / surestaries (un TC au PORT continue d'etre alerte meme si dossier cloture)
- Export PDF/Excel (mix statuts)
- Page Caut (dossier cloture mais TCs en circulation)

**Question a Ibrahima** :

Est-ce qu'un agent cloture parfois un dossier **volontairement** avec des TCs qui ne sont pas retournes ? Ex : cloture anticipee parce que le client a paye et pris sa marchandise, ou parce que le dossier a bascule sur un autre transitaire ?

**3 options selon la reponse** :

| Si... | Alors... |
|-------|----------|
| **Oui, cas metier valide** | Autoriser sans cascade. Ajouter un warning UI "Des TCs ne sont pas retournes — voulez-vous les marquer RETURNED ?". Documenter dans l'UI. |
| **Non, c'est toujours un bug ou un oubli** | `closeDos` doit cascader les TCs en RETURNED automatiquement. Meme logique que l'auto-cloture. |
| **Oui parfois, mais rare** | Garder comportement actuel + ajouter une confirmation "Des TCs ne sont pas RETURNED. Continuer ?". Ne rien casser en retroactif. |

**Blocage refactor E** : au split de `useAppLogic` vers `useDossiers`, je dois choisir ou mettre la logique de `closeDos`. Si elle cascade sur les TCs, elle appartient a un hook qui voit les 2 entites. Si elle ne cascade pas, `useDossiers` seul suffit. Donc decision produit **prealable**.

---

## ⚠ A decouper en refactor — decision technique prise

### 2. Separation logique / UI dans les hooks

**Contexte technique** — revele par F.1

Le hook `useAppLogic` appelle `setMl({t: "pregate"})` dans `toggleDepSt` pour ouvrir une modale quand une depense DPWORLD passe payee sans pregate. C'est un couplage fort entre logique metier (paiement) et UI (modale).

**Decision technique prise** : au refactor E, les hooks domaine retourneront des **valeurs structurees** (pattern `useMutation`). La consommation UI (ouvrir une modale) reviendra a `App.tsx`.

Exemple :
```ts
// Avant (couple UI)
toggleDepSt(depId);
// → declenche setMl en interne si DPWORLD + paye + !pn

// Apres (pur domaine)
var result = toggleDepSt(depId);
// → retourne { ok: true, needsPregate?: { did: string } }
// App.tsx : if (result.needsPregate) setMl({ t: 'pregate', did: result.needsPregate.did });
```

**Pas de blocage produit** — decision technique pure.

---

## 📋 Questions ouvertes (non bloquantes, a valider au fil de l'eau)

Ces questions ne bloquent pas un refactor immediat mais meritent une reponse
a un moment donne pour clarifier le produit.

### 3. Reasonage "autorisation dispatch"

Le code actuel : un TC ne peut etre dispatche que si **`pn` OU `as2 === "OBTENU"`**.

- `pn` = numero pregate paye
- `as2` = statut BAE (Bon A Enlever)

**Question** : est-il **possible et correct** de dispatcher avec juste le BAE, sans le pregate paye ? Ou faut-il les deux ?

### 4. `addDos` et TC doublons

Si un TC avec le meme numero existe deja dans un autre dossier (meme ferme), le code l'ignore silencieusement (affiche juste un warning dans la notif).

**Question** : est-ce qu'un TC peut legitimement **reapparaitre** (rotation, retour apres annulation, etc.) ? Si oui, le comportement "ignorer" est mauvais. Si non, c'est OK mais peut-etre meriter un message d'erreur plus fort.

### 5. Logs limitees a 500 entries

`wLog` tronque les logs a 500 dernieres entrees. Au-dela, historique perdu.

**Question** : si un client regarde l'historique d'un dossier 2 ans apres, les 500 dernieres entrees suffisent ? Ou il faut garder plus, peut-etre paginer, peut-etre archiver ?

### 6. Statuts dossier "ACTIF" vs "INITIALISE"

Le code a parfois `st === "ACTIF"` (Dos.tsx filtre), parfois `st === "INITIALISE" || "SECURISE" || "EN_TRANSIT"` (dispatch). Les statuts dossier visibles : INITIALISE, SECURISE, EN_TRANSIT, CLOTURE, ARCHIVE. Le "ACTIF" dans le filtre semble etre un raccourci = "non cloture et non archive". Coherent mais rendent les queries moins obvious.

**Question** : renommer ? Clarifier dans la doc ? Ou laisser en l'etat ?

---

## 🔬 Pour rappel — TODO dans le code

Liste des commentaires `// TODO` dans le code (hors node_modules), a reviewer
periodiquement :

```bash
grep -rn "// TODO\|// FIXME" src/ --include="*.ts" --include="*.tsx"
```

Au 2026-04-18 :
- 2 TODO dans `src/hooks/__tests__/useAppLogic.test.ts` (lies aux points 1 et 2 ci-dessus)

---

## Historique des decisions prises

### 2026-04-18

- **TODO #1** (couplage `toggleDepSt` ↔ modale pregate) : decide **Option A — return value**. Pattern applique a tous les hooks domaine au refactor E.
- **TODO #2** (cascade `closeDos` sur TCs) : **en attente input Ibrahima**. Bloque le split `useDossiers` en E.
