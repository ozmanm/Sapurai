# Reprise d'audit - 2026-05-17

## Etat depuis la reprise du 16/05

Le projet a encore avance dans le bon sens.

Corrections constatees:

- `xlsx` a ete retire de `package.json` et remplace par `exceljs`.
- `npm audit --audit-level=moderate` est maintenant OK: 0 vulnerabilite.
- `NDepForm` ne force plus `mt = 0` pour les depenses non payees.
- `fileStore` migre les nouveaux fichiers vers Firebase Storage avec fallback Firestore legacy.
- `firebase.json` declare maintenant `storage.rules` et les emulateurs.
- Des tests de rules Firebase ont ete ajoutes sous `src/__tests__/rules`.
- DPWorld, CMA et Carrier appellent maintenant `reconcileDossierState()`.

Verification:

```powershell
npm.cmd run typecheck
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
npm.cmd audit --audit-level=moderate
npm.cmd run test:rules
```

Resultats:

- Typecheck: OK.
- Tests applicatifs: OK, 380 tests passes.
- Tests rules: 11 tests presents mais skipped dans `npm test`.
- Build: OK.
- Lint: OK avec 762 warnings.
- Audit npm: OK, 0 vulnerabilite.
- `npm run test:rules`: KO, script casse car `cross-env` n'est pas installe.

## P0 - Critique restant

### 1. Update complet de `/companies/{companyId}` toujours autorise a `agent` et `editor`

Fichier: `firestore.rules:92`.

La regle racine reste:

```js
allow update: if isSuperAdmin() ||
  (memberHasRole(companyId, ['admin', 'editor', 'agent']) && isCompanyActive(companyId));
```

Tant que toute la donnee metier reste dans un document company unique (`dos`, `tcs`, `dep`, `chs`, `cfg`, `logs`), un role operationnel peut techniquement modifier tout le tenant par une requete directe.

Impact:

- Les restrictions UI restent contournables.
- Les invariants front ne sont pas une protection serveur.
- Un agent/editor peut corrompre finances, dossiers, chauffeurs ou configuration.

Correction attendue:

- A court terme: `diff().affectedKeys()` par role sur le document company.
- A moyen terme: sous-collections et rules par ressource.
- Idealement: mutations sensibles via Cloud Functions / transactions serveur.

## P1 - Majeur

### 2. `test:rules` est present mais inexecutable

Fichiers: `package.json`, `src/__tests__/rules/firestore-security.test.ts`.

Le script utilise:

```json
"test:rules": "cross-env FIRESTORE_EMULATOR_HOST=localhost:8080 vitest --run src/__tests__/rules"
```

Mais `cross-env` n'est pas dans les dependances. Resultat:

```text
'cross-env' n’est pas reconnu
```

Impact:

Le garde-fou securite le plus important existe, mais il ne tourne pas dans le pipeline actuel.

Correction:

- Ajouter `cross-env` en devDependency, ou remplacer le script par une commande compatible Windows/PowerShell.
- Ajouter une etape CI qui lance l'emulateur puis `test:rules`.

### 3. `src/firestore.rules` contient des regles anciennes et permissives

Fichier: `src/firestore.rules`.

Ce fichier n'est pas celui de `firebase.json` ni celui charge par les tests rules, mais il contient encore:

- `users/{uid}` read/write libre par self.
- `companies/{companyId}` create libre et update via admin/agent.
- `members/{memberId}` create libre par self.
- `tracking` write par tout auth.
- `files` read/write par tout auth.

Impact:

Risque humain: confusion, copie/deploiement accidentel, audit futur sur mauvais fichier.

Correction:

- Supprimer `src/firestore.rules`, ou le remplacer par un commentaire unique qui pointe vers `/firestore.rules`.

### 4. Les invariants sont branches sur les syncs, mais pas encore sur import/edit dossier

Corrige:

- `src/hooks/useDPWorldSync.ts` appelle `reconcileDossierState()`.
- `src/hooks/useCMASync.ts` appelle `reconcileDossierState()`.
- `src/hooks/useCarrierSync.ts` appelle `reconcileDossierState()`.

Reste ouvert:

- `src/hooks/useDossierActions.ts:74` (`editDos`) recree encore des TC sans reconcile.
- `src/hooks/useDossierActions.ts:165` (`patchDos`) sauvegarde encore le dossier sans reconcile.
- `src/hooks/useImportActions.ts:94` (`bulkImport`) sauvegarde `dos/tcs` sans reconcile.

Impact:

Une modification manuelle de `da`, un import ou une edition dossier peut encore produire des incoherences `da future` / TC avance.

Correction:

- Passer `editDos`, `patchDos`, `bulkImport` par `reconcileDossierState()`.
- Ajouter tests d'integration sur ces trois entrees.

### 5. Migration Storage incomplete autour des limites et fallback

Fichiers:

- `src/fileStore.ts`
- `src/components/dossiers/NDepForm.tsx:41`
- `src/components/dossiers/JdocView.tsx:28`
- `src/pages/AgentView.tsx:107`

Constat:

- `NDepForm` limite encore a 600 Ko avec message "limite Firestore", alors que le nouveau chemin vise Storage.
- `JdocView` et `AgentView` acceptent encore 4 Mo.
- Si Storage echoue, `fileStore.set()` fallback sur Firestore, ce qui peut casser pour les fichiers > 600-800 Ko.
- `fileStore.get()` renvoie les fichiers Storage comme `data:application/octet-stream`, en perdant le MIME d'origine.
- `storage.rules` verifie le membership, mais pas `isCompanyActive`.

Impact:

Uploads inegaux selon l'ecran, fallback Firestore dangereux pour les gros fichiers, preview moins fiable.

Correction:

- Choisir une strategie unique: soit Storage obligatoire, soit fallback limite.
- Stocker `contentType`/metadata et restituer le MIME.
- Supprimer le fallback Firestore pour les nouveaux fichiers > seuil legacy.
- Ajouter le controle suspension dans `storage.rules`.

### 6. `exceljs` corrige la securite mais ajoute un gros chunk

Fichiers: `src/ImportExcel.tsx`, `src/utils/export.ts`.

Bon:

- `xlsx` est retire.
- `npm audit` est propre.
- `exceljs` est lazy-loaded.

Reste:

- Build signale `exceljs.min` a environ 936 Ko minifie / 270 Ko gzip.
- Les handlers `onClick` appellent les exports async sans `await`/`catch`.

Impact:

Pas bloquant, mais erreurs d'export silencieuses possibles cote UI.

Correction:

- Ajouter gestion d'erreur/toast sur export.
- Eventuellement isoler l'import/export Excel dans un worker si l'UI freeze sur gros fichiers.

## P2 - Important

### 7. `ACTIF` reste present dans beaucoup de fixtures et types

Fichiers:

- `src/types.ts:130`
- nombreux tests sous `src/hooks/__tests__`, `src/services/__tests__`, `src/utils/__tests__`.

Le domaine canonique a bien retire `ACTIF`, mais les fixtures continuent a l'utiliser largement.

Correction:

- Nettoyer les fixtures.
- Retirer `ACTIF` du type `Dossier.st` quand la migration est terminee.

### 8. Document company unique toujours fragile

Fichier: `src/useData.ts:461`.

`save()` ecrit toujours le document complet avec `setDoc`. Les risques de conflit multi-utilisateur, ecrasement offline et limite 1 Mio restent ouverts.

Correction:

- Court terme: revision/version et detection conflit.
- Moyen terme: sous-collections.

### 9. Lint plus bruyant qu'avant

Resultat actuel:

- 762 warnings contre 723 lors de la reprise precedente.

Cause probable:

- Ajout `exceljs` / rules tests / nouveaux `any`.

Correction:

- Nettoyage par lots.
- Passer `no-unused-vars`, `react-hooks/exhaustive-deps` et certains `no-console` en erreur une fois le bruit reduit.

## Verdict

La trajectoire est bonne: securite dependances resolue, typecheck/build/tests OK, syncs metier mieux reconciliees.

Mais le projet n'est pas encore ferme cote production:

1. La regle `companies.update` reste trop large.
2. Les tests rules existent mais ne tournent pas.
3. Import/edit dossier contournent encore le moteur d'invariants.
4. La migration fichiers Storage doit etre rendue coherente et sans fallback dangereux.

Ordre recommande:

1. Corriger `test:rules` et faire tourner les tests emulateur.
2. Restreindre `companies.update`.
3. Supprimer `src/firestore.rules`.
4. Brancher `reconcileDossierState()` sur `editDos`, `patchDos`, `bulkImport`.
5. Finaliser la politique fichier Storage/fallback.
