# Migration Firestore — Single document → Subcollections

> Plan de migration du schema actuel (1 document par entreprise) vers des subcollections granulaires.
> **Statut** : plan redige, non execute. A relire avant declenchement.
> Derniere revision : 2026-04-18

---

## 1. Contexte — pourquoi migrer

### Probleme actuel

Toutes les donnees d'une entreprise vivent dans un seul document Firestore :

```
/companies/{companyId}
  ├── name
  ├── cfg { fp, ft, fm, clientTokens, ... }
  ├── dos: [ ... ]      // tableau de dossiers
  ├── tcs: [ ... ]      // tableau de conteneurs
  ├── chs: [ ... ]      // tableau de chauffeurs
  ├── dep: [ ... ]      // tableau de depenses
  └── logs: [ ... ]     // tableau des logs
```

La fonction `save(newData)` fait `setDoc(doc(db, 'companies', companyId), newData)` — elle **reecrit l'integralite** du document a chaque modification.

### Limites rencontrees ou a venir

| Probleme | Impact |
|----------|--------|
| **Limite Firestore : 1 MiB par document** | L'app plante brutalement des que la somme depasse. Aucun warning progressif. |
| **Bande passante** | Chaque toggle (ex : marquer une depense payee) relit ET reecrit plusieurs Ko. Genant en 3G au Mali. |
| **Conflits multi-utilisateur** | Deux agents qui modifient en parallele : le dernier `sv()` ecrase le premier (non transactionnel). |
| **Cout reads** | Chaque `onSnapshot` sur le doc recupere **tout** a chaque modification, meme d'un champ qui ne nous interesse pas. |
| **Scan complet cote client** | Toute query (filtre, tri, search) se fait en RAM cote React, pas cote Firestore. Pas scalable. |

### Ce que la migration apporte

- Pas de limite pratique de volume (jusqu'a 1 GB par collection, millions de docs)
- Reads selectifs : listener par dossier, par TC, par page affichee
- Writes granulaires : modifier un seul TC ne touche pas les autres
- Query server-side possibles (indexes Firestore)
- Transactions Firestore utilisables pour la coherence

---

## 2. Seuils de declenchement — quand executer

**A lire en premier.** Si aucun seuil n'est atteint, archive ce document et reviens dans 3-6 mois.

### Seuils techniques

| Seuil | Valeur | Action |
|-------|--------|--------|
| Taille du doc `/companies/{cid}` | > **500 KiB** (moitie de la limite) | Planifier la migration dans le trimestre |
| Taille du doc | > **800 KiB** | Declencher **immediatement** — plantage imminent |
| Latence de save() ressentie | > 2s sur connexion normale | Probable signe de doc trop gros |
| Erreurs `resource-exhausted` dans les logs | > 0 | Declencher immediatement |

### Seuils business

| Seuil | Action |
|-------|--------|
| **10 clients actifs** sur l'app | Commencer a verifier la taille des docs regulierement (1x/mois) |
| **20 clients actifs** | La migration devient non-negociable — planifier la date |
| **Nouveau client gros volume** (> 500 dossiers/an) | Migrer **avant** de l'onboarder |

### Comment mesurer la taille du doc

Dans la console Firebase → Firestore → document `/companies/{cid}` → bouton menu (⋮) → **Document size**. Ou via CLI :
```bash
firebase firestore:export gs://{bucket}/backup
# Puis verifier la taille du fichier exporte
```

### Indicateur visuel a ajouter dans l'app (optionnel, recommande)

Dans le panneau Admin, afficher la taille estimee du doc company avec un code couleur :
- vert < 300 KiB
- jaune 300-600 KiB
- rouge > 600 KiB

5 lignes de code, tres utile pour surveiller sans aller dans la console.

---

## 3. Schema actuel

Voir la representation dans la section 1. Document unique par entreprise, tableaux imbriques.

Listeners actifs (cf `src/useData.ts`) :
- `users/{uid}` — profil utilisateur, determine `companyId`
- `companies/{cid}` — tout le doc, une seule source
- `companies/{cid}/members` — liste des membres
- `companies/{cid}/notifications` — notifs agents

Les subcollections `members`, `notifications` et `invites` sont **deja** dans un pattern subcollection — c'est bien. La migration ne les concerne pas.

---

## 4. Schema cible

```
/companies/{companyId}
  ├── name
  ├── cfg { fp, ft, fm, clientTokens, ... }
  ├── status                 // ACTIVE | BLOCKED (deja la)
  ├── meta {
  │     dosCount: number,
  │     tcsCount: number,
  │     updatedAt: ISO
  │   }
  │
  ├── dossiers/{dosId}       // un doc par dossier
  ├── tcs/{tcId}             // un doc par conteneur
  ├── chs/{chId}             // un doc par chauffeur
  ├── dep/{depId}            // un doc par depense
  ├── logs/{logId}           // un doc par log (append-only)
  ├── members/{uid}          // deja existant
  └── notifications/{nid}    // deja existant
```

### Indexes Firestore a creer

```
// dossiers
- companyId + st (pour filtrer ACTIF/CLOTURE/ARCHIVE)
- companyId + cl (pour filtrer par client)
- companyId + updatedAt desc (pour tri)

// tcs
- did + st (TCs d'un dossier filtres par statut)
- st + dsp (TCs DISPATCHE tries par date)

// dep
- did (depenses d'un dossier)
- s + dt (impayees par date)
```

Ces indexes doivent etre declares dans `firestore.indexes.json` et deployes **avant** la phase C.

---

## 5. Strategie — dual-write progressif

**Pas de big bang.** On vise zero downtime et zero perte de donnees.

### Principe

1. **Phase A** — L'app continue de lire/ecrire dans l'ancien doc single. On ajoute **en plus** l'ecriture dans les subcollections pour tout nouveau change. C'est un filet.
2. **Phase B** — Script de backfill qui explode le doc single existant en subcollections. L'app continue sur l'ancien.
3. **Phase C** — Switch des listeners : l'app lit les subcollections. L'ancien doc devient fallback read-only.
4. **Phase D** — Nettoyage : suppression des tableaux dans le doc single, suppression du code de dual-write.

Chaque phase est **reversible** (cf section 10) et peut rester en prod plusieurs jours/semaines si besoin.

### Pattern de dual-write (phase A)

```ts
// Simplifie
async function save(newData) {
  // 1. Ancien chemin (authoritative pour l'instant)
  await setDoc(doc(db, 'companies', cid), newData);
  // 2. Nouveau chemin (fire-and-forget, non bloquant)
  await mirrorToSubcollections(cid, newData).catch(logError);
}
```

L'ancien chemin reste la source de verite. Si `mirrorToSubcollections` echoue, on log mais on ne bloque pas l'utilisateur.

---

## 6. Prerequis & dependances

| Prerequis | Pourquoi | Effort |
|-----------|----------|--------|
| **Blaze plan** Firebase (pay-as-you-go) | Cloud Functions pour le backfill (phase B) ou script Node local avec service account | Activer la facturation |
| **Service account Firebase** avec role `Firestore Admin` | Script de backfill en dehors du navigateur | Generer dans Firebase Console |
| **firebase-admin** installe localement | Lancer le script de backfill | `npm i firebase-admin` (dev dep) |
| **Indexes Firestore** declares dans `firestore.indexes.json` | Queries de phase C fonctionnelles | ~10 indexes a declarer |
| **SDK Firebase ^10.x** | Deja en place (10.14.x), OK | — |
| **Tests de regression** pour les CRUD dossiers/TCs/dep | Valider chaque phase sans casser | A ecrire (2-3 jours) |
| **Backup Firestore avant chaque phase** | Rollback possible | `firebase firestore:export` |

---

## 7. Risques & points de vigilance

| Risque | Mitigation |
|--------|-----------|
| **Ecriture ancien doc OK, ecriture subcollection KO** → desynchro | Toujours traiter les subcollections en fire-and-forget en phase A, backfill regulier pour rattraper |
| **Limite batch Firestore : 500 writes par batch** | Splitter les backfills par chunks de 400 (marge de securite) |
| **Listeners double** — onSnapshot sur doc single ET sur subcollections simultanement en phase C | Pattern clair : une seule source de verite par phase, pas les deux |
| **`save()` fire-and-forget** | Deja un probleme existant, cf race condition tokId (resolue en setDoc merge direct). A formaliser en phase A. |
| **Cache local Firestore (`persistentLocalCache`)** — cache potentiellement incoherent pendant la transition | Tester en mode incognito a chaque phase |
| **Transactions** — mise a jour atomique dossier + TC | Firestore transactions fonctionnent sur subcollections, pas sur un tableau imbrique. Apres migration, c'est mieux. Avant, ca n'existe pas. |
| **Regles Firestore nouvelles** — permissions par subcollection | Ecrire et tester les regles **avant** d'activer la phase C |
| **Cout explose si mal dimensionne** | Chaque toggle d'un TC = 1 write, pas N. Mais surveiller les listeners qui recuperent 1000+ docs a chaque fois. |
| **Logs append-only** — volume peut exploser | Decision en phase D : garder tous les logs ? ou TTL 90 jours ? |

---

## 8. Metriques a surveiller

A mettre en place **avant** de commencer la phase A.

| Metrique | Ou | Seuil d'alerte |
|----------|----|--------------:|
| Taille doc `/companies/{cid}` | Firestore console ou script | > 800 KiB |
| Latence save() cote client | Ajouter un `performance.now()` dans `save()` | > 2s |
| Erreurs Firestore (read/write) | `console.error` → envoyer vers une collection `errors/` | > 5 par heure |
| Desynchro ancien/nouveau (phase A) | Script de check quotidien : compter `dos` dans doc vs docs dans subcollection | diff > 0 |
| Cost Firebase | Console Billing | +20% vs mois precedent |

### Dashboard admin (optionnel)

Petit tableau dans AdminPanel affichant les 5 metriques en live. 50 lignes de React.

---

## 9. Phases detaillees

### Phase A — Dual-write (1 semaine de prod)

**Objectif** : toute nouvelle modification est ecrite dans l'ancien doc ET dans les subcollections. Zero changement visible pour l'utilisateur.

**Changements code**
- `src/useData.ts`
  - Nouvelle fonction `mirrorToSubcollections(cid, newData)` qui fait un batch d'ecritures dans `companies/{cid}/dossiers`, `/tcs`, `/chs`, `/dep`, `/logs`
  - `save(newData)` appelle `setDoc(doc)` puis `mirrorToSubcollections` en fire-and-forget
- `src/services/dualwrite.ts` (nouveau) — contient la logique de miroir, isolee du reste
- `firestore.rules` — ajouter regles permissives en write pour les nouvelles subcollections (read restreint aux membres)

**Migration donnees**
- Aucune pour l'instant. Les docs existants ne sont pas touches. Seuls les **nouveaux writes** alimentent les subcollections.

**Tests de validation**
- Creer un nouveau dossier → verifier que `companies/{cid}/dossiers/{did}` existe avec le bon contenu
- Modifier un TC → verifier que `companies/{cid}/tcs/{tcid}` est a jour
- Suppression → verifier que le doc subcollection est bien supprime aussi
- Tester sur 2 comptes differents simultanement pour verifier l'isolation
- Test mode hors-ligne : Firestore doit queuer les writes et tout sync au retour

**Critere de passage a la phase B**
- 7 jours de prod sans erreur de miroir dans les logs
- Script de check quotidien confirme que 100% des nouveaux dossiers/TCs/dep ont leur double dans les subcollections

**Effort** : 1 jour de code + 1 semaine d'observation.

---

### Phase B — Backfill des donnees existantes (1 journee d'execution)

**Objectif** : migrer tous les docs existants dans les subcollections. A la fin, chaque entreprise a son doc single **et** ses subcollections completes et synchrones.

**Changements code**
- Pas de changement cote app
- Nouveau script `scripts/backfill-subcollections.ts` (Node, firebase-admin)
  - Pour chaque `companies/{cid}` :
    - Lire le doc
    - Batch write tous les `dos[]` dans `dossiers/`
    - Batch write tous les `tcs[]` dans `tcs/`
    - Idem pour `chs`, `dep`, `logs`
    - Chunking par 400 (limite batch 500 - marge)
    - Log les erreurs dans un fichier `backfill-errors.log`
  - Option `--dry-run` pour tester sans ecrire

**Migration donnees**
- Executee **une seule fois** par le script
- `npm run backfill -- --dry-run` pour compter
- `npm run backfill` pour executer
- Re-executable si partiel (idempotent grace a `setDoc` qui ecrase)

**Tests de validation**
- Apres backfill : pour 3 comptes au hasard, diff entre `doc.dos.length` et `count(dossiers/)` → doit etre 0
- Idem pour tcs, chs, dep, logs
- Query une subcollection au hasard et verifier que les champs sont tous presents
- L'app doit continuer de fonctionner normalement (phase A toujours active, lit toujours l'ancien doc)

**Critere de passage a la phase C**
- Diff 0 entre ancien et nouveau pour **toutes** les entreprises
- Stabilite 3 jours supplementaires avec dual-write actif

**Effort** : 1/2 jour ecriture script + 1/2 jour execution/verification.

---

### Phase C — Switch des reads (1-2 semaines)

**Objectif** : l'app lit les subcollections. L'ancien doc company reste en sync (dual-write toujours actif) mais n'est plus la source pour l'affichage.

**Changements code**
- `src/useData.ts` — refonte majeure
  - Supprimer le listener unique sur `companies/{cid}`
  - Ajouter 5 listeners : `dossiers/`, `tcs/`, `chs/`, `dep/`, `logs/` (limite a 100 derniers)
  - Reconstruire `data = { dos, tcs, chs, dep, logs, cfg, name }` a partir des listeners
  - `cfg` et `name` restent sur le doc principal (toujours lus via `companies/{cid}`)
- `src/hooks/useAppLogic.ts`
  - Remplacer `sv(newData)` par des operations granulaires :
    - `addDos()` → `setDoc(dossiers/{did})`
    - `editDos()` → `updateDoc(dossiers/{did})`
    - `deleteDos()` → `deleteDoc(dossiers/{did})` + cascade sur TCs/dep associes
    - Idem pour tcs, chs, dep
  - `wLog()` → `addDoc(logs/)`
  - Le dual-write vers l'ancien doc reste actif en fire-and-forget jusqu'a phase D
- `firestore.rules` — resserrer les regles subcollections (read/write pour membres uniquement, write admin/editor selon le cas)

**Migration donnees**
- Aucune (subcollections deja alimentees en phase B, mises a jour en phase A)

**Tests de validation**
- Lister tous les ecrans : Dashboard, Dossiers, TCs, Depenses, Chauffeurs, Stats, Cautions, Detail dossier
- Pour chacun : verifier que les donnees affichees sont identiques a avant
- Performance : la page Dossiers doit se charger **plus vite** qu'avant (listener selectif)
- Tester creation/modification/suppression sur chaque entite
- Tester mode hors-ligne
- Tester partage tracking public (pas d'impact, tracking est deja une collection separee)

**Critere de passage a la phase D**
- 14 jours de prod sans regression reportee
- Metriques : latence < latence pre-migration, cost < +10%, erreurs stables

**Effort** : 3-4 jours de code (gros refactor useData + useAppLogic) + 2 semaines d'observation.

---

### Phase D — Nettoyage (1/2 journee)

**Objectif** : retirer le code de compatibilite, reduire la taille du doc company a sa forme minimale.

**Changements code**
- `src/useData.ts`
  - Supprimer `mirrorToSubcollections()`
  - Supprimer `dualwrite.ts`
  - `save()` devient uniquement pour `cfg` et `name`, renommer en `saveMeta()`
- `src/hooks/useAppLogic.ts`
  - Supprimer les appels fire-and-forget vers l'ancien doc
- Script `scripts/cleanup-legacy-doc.ts`
  - Pour chaque `companies/{cid}` : `updateDoc(cid, { dos: deleteField(), tcs: deleteField(), chs: deleteField(), dep: deleteField(), logs: deleteField() })`
  - Resultat : doc company ne contient plus que `name`, `cfg`, `status`, `meta`
- `firestore.rules` — retirer les exceptions de write sur les champs devenus inutiles

**Migration donnees**
- Script `cleanup-legacy-doc` execute une fois
- Backup obligatoire avant execution

**Tests de validation**
- Toutes les pages continuent de fonctionner (normalement rien ne change cote client)
- Taille du doc `/companies/{cid}` passe sous les 20 KiB
- Les logs (collection) fonctionnent toujours

**Critere de fin**
- Doc company < 20 KiB pour toutes les entreprises
- Aucun appel a `mirrorToSubcollections` ou equivalent dans le code
- CHANGELOG-AUDIT.md mis a jour

**Effort** : 1/2 jour code + 1/2 jour execution + verifications.

---

## 10. Rollback par phase

| Phase | Rollback | Temps |
|-------|----------|-------|
| **A** | Revert commit `src/useData.ts`, supprimer `dualwrite.ts`. Les subcollections peuplees restent orphelines (inoffensives). | 10 min |
| **B** | Aucun code a changer. Les subcollections backfillees restent ignorees. Si l'etat est corrompu : `firebase firestore:delete --all-collections` sur les subcollections uniquement (garder `members`, `notifications`, `invites`). | 30 min |
| **C** | Revert du gros commit. Restaurer le listener unique. Les writes vers l'ancien doc n'ayant jamais cesse (dual-write actif), l'ancien doc est a jour. | 30 min |
| **D** | Impossible de rollback sans backup : les champs `dos`, `tcs`, etc. ont ete supprimes du doc company. **Toujours faire un backup Firestore juste avant la phase D.** | Depend du backup |

### Script de backup manuel

```bash
# Avant chaque phase
firebase firestore:export gs://sapurai-84984-backups/backup-$(date +%Y%m%d-%H%M%S)
```

Necessite d'avoir un bucket Cloud Storage actif (Blaze plan).

---

## 11. Estimation effort total

| Phase | Dev | Observation | Total |
|-------|-----|-------------|-------|
| A — Dual-write | 1 j | 1 semaine | 1 j travail, 1 semaine calendaire |
| B — Backfill | 1 j | — | 1 j |
| C — Switch reads | 3-4 j | 2 semaines | 4 j travail, 2 semaines calendaire |
| D — Cleanup | 0.5 j | — | 0.5 j |
| **Total** | **6-7 jours de dev** | | **3-4 semaines calendaires** |

### Risques sur l'effort

- **+2 jours** si les tests de regression phase C revelent des bugs sur des pages secondaires (Stats, Cautions)
- **+1 jour** si les indexes Firestore prennent plus de temps a builder que prevu
- **+1 jour** pour le dashboard metriques si tu veux l'inclure avant la phase A

### Quand ne pas faire la migration

- Si aucun seuil de la section 2 n'est atteint
- Si tu n'as pas 3-4 semaines calendaires de disponibilite pour observer sans pivoter vers autre chose
- Si tu es sur le point de partir en vacances — ne pas declencher une phase juste avant
- Si tu travailles seul et que tu n'as pas backup humain en cas de probleme prod

---

## Annexes

### Script de check taille doc (a lancer mensuellement)

```ts
// scripts/check-doc-sizes.ts
import * as admin from 'firebase-admin';
admin.initializeApp();

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('companies').get();
  for (const d of snap.docs) {
    const json = JSON.stringify(d.data());
    const kib = (json.length / 1024).toFixed(1);
    const color = kib > 600 ? '🔴' : kib > 300 ? '🟡' : '🟢';
    console.log(`${color} ${d.id} — ${kib} KiB — ${d.data().name}`);
  }
}
main();
```

Execution : `npx ts-node scripts/check-doc-sizes.ts`

### References

- [Firestore limits](https://firebase.google.com/docs/firestore/quotas)
- [Data model best practices](https://firebase.google.com/docs/firestore/best-practices)
- Code source `src/useData.ts` lignes 77-100 (listener actuel)
