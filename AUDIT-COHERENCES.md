# Audit cohérences métier — 2026-05-15

> Suite au cas remonté : dossier `BUILDERS MALI SARL` (BL `LHV3990909`)
> avec `da = 30/05/2026` (futur) mais TC marqués comme "Chargement"
> (DISPATCHE) et dossier en "En Transit".
>
> Le navire n'est pas encore arrivé et pourtant le système prétend que
> les conteneurs sont chargés.

## 🔴 Incohérences identifiées

### I1 — `advance()` n'empêche pas une transition vers PORT/DISPATCHE alors que `dos.da` est dans le futur

**Fichier** : `src/hooks/useConteneurActions.ts:83` (fonction `advance`)

**Symptôme** : le bouton "Arrivé au port" sur un TC `ATTENDU` peut être cliqué même si `dos.da` est encore dans le futur. Sapurai pose `tc.st = PORT` sans vérifier. L'agent peut ensuite cliquer "Dispatch" → `tc.st = DISPATCHE` toujours sans vérifier la date.

**Conséquences** :
- Timeline trompeur (étape "Port" cochée alors que le bateau n'est pas arrivé)
- Statut dossier passe SECURISE puis EN_TRANSIT à tort (via `computeDossierStatus`)
- Auto-stub Depenses risque de générer des factures (magasinage, surestaries) basées sur des dates impossibles

**Origine probable** :
- Saisie manuelle d'un agent (test, erreur de manip)
- Import Excel qui pose `tc.st = DISPATCHE` directement
- Anciens dossiers où l'ordre des actions n'a pas été respecté

---

### I2 — Timeline `DetView.tsx` coche les étapes en se basant uniquement sur `tc.st`, sans vérifier que les dates sont passées

**Fichier** : `src/components/dossiers/DetView.tsx:365-373`

```js
var stps = [
  { k: "ATTENDU", lbl: "Attendu", dt: null, done: stIdx >= 0 },
  { k: "PORT", lbl: "Port", dt: d.da || null, done: stIdx >= 1 },     // <-- d.da peut être futur !
  { k: "DISPATCHE", lbl: "Chargement", dt: tc.dsp || null, done: stIdx >= 2 },
  // ...
];
```

**Symptôme** : si `tc.st = "DISPATCHE"`, l'étape "Port" est cochée `done` même si `d.da` est demain. L'utilisateur voit une coche verte sur une étape qui n'a pas encore eu lieu.

**Conséquence** : confusion visuelle, l'utilisateur perd confiance dans le système.

---

### I3 — Le composant `TcTimeline.tsx` (modale détail TC) a le même bug

**Fichier** : `src/components/conteneurs/TcTimeline.tsx:55-63`

```js
return stepDefs.map(function (s, i) {
  return { ..., done: i <= curIdx, current: i === curIdx };
});
```

Même logique : `done` basé uniquement sur l'index de `tc.st`, jamais sur les dates.

---

### I4 — `computeDossierStatus` ne tient pas compte de `da > today`

**Fichier** : `src/utils/dossierStatus.ts:19`

**Symptôme** : si `tc.st = PORT` mais `da > today`, le dossier passe à SECURISE à tort. Idem pour EN_TRANSIT si DISPATCHE+.

**Conséquence** : alertes franchise déclenchées à tort, KPI Accueil faussés.

---

### I5 — Sync DPWorld pose `tc.st = "PORT"` sur `timeIn` sans vérifier le dossier

**Fichier** : `src/services/dpworld.ts:85-89`

```js
} else if (dpTc.timeIn) {
  if (tc.st === "ATTENDU") {
    patch.st = "PORT";   // <-- aucun check sur d.da
  }
}
```

**Risque** : si DPWorld renvoie un `timeIn` futur (improbable mais possible), Sapurai passerait le TC à PORT. En pratique très rare.

---

### I6 — Dépenses `s` vs `status` (déjà identifié Sprint 38C)

Le helper `getDepenseStatus()` gère la coexistence, mais le script de migration `scripts/migrate-depenses-legacy-status.mjs` n'a **pas encore été exécuté** sur la prod. Donc des dossiers peuvent avoir `s: PAYE` sans `status: payee`.

**Conséquence** : les nouveaux consommateurs (24 fichiers à migrer progressivement) doivent passer par `getDepenseStatus()` pour rester corrects.

---

### I7 — TC `DISPATCHE` sans `dsp` (déjà identifié Lot 1)

Le helper `detectTcConflict()` détecte ce cas comme `MISSING_DSP`. Mais les TC créés avant Lot 1 peuvent avoir cette incohérence en base sans être détectés.

---

## 🛠️ Fix proposés

### Fix F1 — Bloquer transition PORT/DISPATCHE si `dos.da` est dans le futur

Dans `advance()` (useConteneurActions.ts) :

```ts
// Pour PORT : on autorise même sans da (cas migration legacy), mais on
// refuse explicitement si da est dans le futur.
if (ns === "PORT" && dossier?.da) {
  var arrivee = new Date(dossier.da); arrivee.setHours(0, 0, 0, 0);
  var aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  if (arrivee.getTime() > aujourdhui.getTime()) {
    nf("Date arrivée " + dossier.da + " encore dans le futur — TC ne peut pas être marqué au port", "error");
    return;
  }
}
// Pour DISPATCHE : le TC doit être en PORT depuis au moins aujourd'hui
if (ns === "DISPATCHE" && dossier?.da) {
  var arrivee2 = new Date(dossier.da); arrivee2.setHours(0, 0, 0, 0);
  var aujourdhui2 = new Date(); aujourdhui2.setHours(0, 0, 0, 0);
  if (arrivee2.getTime() > aujourdhui2.getTime()) {
    nf("Date arrivée encore future — impossible de dispatcher un TC qui n'est pas arrivé", "error");
    return;
  }
}
```

### Fix F2 — Timeline `DetView.tsx` : `done` = `stIdx >= i` **ET** `(stp.dt === null OU stp.dt <= today)`

```ts
function isStepReallyDone(stIdx: number, i: number, dt: string | null): boolean {
  if (stIdx < i) return false;
  if (!dt) return true;  // pas de date specifique pour cette etape, on fait confiance au statut
  var d = new Date(dt); d.setHours(0, 0, 0, 0);
  var t = new Date(); t.setHours(0, 0, 0, 0);
  return d.getTime() <= t.getTime();
}
```

Style "futur" : si la date est dans le futur, afficher en pointillé avec mention "prévu" pour distinguer.

### Fix F3 — Idem pour `TcTimeline.tsx`

### Fix F4 — `computeDossierStatus` : forcer INITIALISE si `da > today`

```ts
if (dos.da) {
  var arr = new Date(dos.da); arr.setHours(0, 0, 0, 0);
  var today = new Date(); today.setHours(0, 0, 0, 0);
  if (arr.getTime() > today.getTime()) {
    // Navire pas encore arrivé : forcer INITIALISE peu importe les tc.st
    return dos.st !== "INITIALISE" ? "INITIALISE" : null;
  }
}
```

### Fix F5 — Script de diagnostic `scripts/audit-coherences.mjs`

Parcourt la base et liste :
- TC `st: PORT/DISPATCHE/+` avec dossier `da > today`
- TC `st: DISPATCHE` sans `dsp`
- TC `st: RETURNED` sans `dr`
- Dossier `SECURISE/EN_TRANSIT` avec `da > today`
- Dossier `EN_TRANSIT` sans aucun TC en TRANSIT_STATES
- Dépenses avec `s !== null` ET `status` absent (à migrer)
- Dépenses avec `s = 'PAYE'` ET `status = 'a_payer'` (contradiction)

Mode `--apply` pour proposer des corrections automatiques sur les cas simples (TC DISPATCHE sans dsp → revenir à PORT, etc.).

### Fix F6 — Tests régression

Ajouter dans `src/__tests__/scenarios/` :
- `coherence-da-future.test.ts` : un TC ne peut pas passer à PORT/DISPATCHE si `da > today`
- `coherence-status-dossier.test.ts` : un dossier avec `da > today` reste INITIALISE même si TC posés à PORT (cas legacy)

---

## 📊 Priorisation

| Fix | Impact | Effort | Priorité |
|---|---|---|---|
| F1 — Bloquer transitions premature | 🔴 Critique | 30 min | **P0** |
| F4 — computeDossierStatus tient compte de `da` | 🔴 Critique | 20 min | **P0** |
| F2 — Timeline DetView coche selon date | 🟠 UX important | 30 min | **P1** |
| F3 — Idem TcTimeline | 🟠 UX important | 15 min | **P1** |
| F5 — Script audit prod | 🟡 Diagnostic | 1 h | **P2** |
| F6 — Tests régression | 🟡 Sécurité | 30 min | **P2** |
| Migration data prod | 🟡 Une fois | 15 min | **P3** |

**Total Sprint 40 : ~3h** pour traiter P0 + P1 + P2.

---

## ✅ Validation avant fix

Avant de coder, valider avec l'utilisateur :

1. **Confirmer que c'est bien une saisie manuelle erronée** (pas une donnée DPWorld bizarre). Question : le BL `LHV3990909` a-t-il été ouvert manuellement avec date arrivée dans le futur, puis cliqué "Arrivé au port" prématurément ?

2. **Choisir la sévérité du blocage F1** :
   - **Strict** : refuser purement et simplement la transition
   - **Souple** : afficher un warning mais laisser passer (au cas où l'utilisateur sait ce qu'il fait)

3. **Choisir le comportement F4** :
   - **Strict** : forcer INITIALISE peu importe `tc.st` si `da > today`
   - **Souple** : laisser le statut TC pris en compte mais flag visuel "dates incohérentes"
