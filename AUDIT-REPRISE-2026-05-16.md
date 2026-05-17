# Reprise d'audit - 2026-05-16

## Etat global

Le projet a beaucoup progresse depuis le premier audit:

- `npm run typecheck` passe.
- `npm test -- --run` passe: 21 fichiers, 380 tests.
- `npm run build` passe.
- `deploy` lance maintenant `typecheck` avant `vite build`.
- `DossierStatus` a ete corrige: `INITIALISE | SECURISE | EN_TRANSIT | CLOTURE | ARCHIVE`.
- `TrackingPage` utilise maintenant `DISPATCHE` et `RETURNED`.
- Un moteur `src/domain/invariants.ts` existe avec `canDispatchTc`, `canAdvanceTc`, `deriveDossierStatus`, `reconcileDossierState`.
- Les regles Firestore/Storage ont ete durcies contre l'auto-greffe directe.

Il reste cependant des risques importants. Le projet est plus sain, mais pas encore verrouille.

## P0 - Critique restant

### 1. Les roles `agent` et `editor` peuvent toujours mettre a jour tout le document company

Fichier: `firestore.rules:92`.

La regle autorise:

```js
allow update: if isSuperAdmin() ||
  (memberHasRole(companyId, ['admin', 'editor', 'agent']) && isCompanyActive(companyId));
```

Comme le modele principal reste un gros document `/companies/{companyId}` contenant `dos`, `tcs`, `dep`, `chs`, `logs`, `cfg`, un agent ou editor peut techniquement envoyer un update complet qui modifie tout: finances, configuration, autres dossiers, logs, chauffeurs, etc.

Impact:
- Les restrictions UI ne sont pas une securite.
- Une erreur client ou un utilisateur malveillant avec role `agent` peut corrompre le tenant complet.
- Les corrections metier cote front restent contournables.

Correction attendue:
- A court terme, limiter les champs modifiables par role avec `diff().affectedKeys()`.
- Idealement, migrer vers sous-collections et regles par ressource: dossier, TC, depense, chauffeur, fichier.
- Sortir les operations sensibles vers Cloud Functions ou transactions server-side.

### 2. Les invariants ne sont pas appliques partout

Fichiers:
- `src/hooks/useDPWorldSync.ts:154`, `src/hooks/useDPWorldSync.ts:187`, `src/hooks/useDPWorldSync.ts:249`, `src/hooks/useDPWorldSync.ts:302`
- `src/hooks/useCarrierSync.ts:57`, `src/hooks/useCarrierSync.ts:100`
- `src/hooks/useDossierActions.ts:74`, `src/hooks/useDossierActions.ts:106`, `src/hooks/useDossierActions.ts:165`
- `src/hooks/useImportActions.ts:25`, `src/hooks/useImportActions.ts:94`

Le moteur `reconcileDossierState()` existe, mais plusieurs chemins continuent a sauvegarder directement `dos`/`tcs`:

- sync DPWorld dossier et syncAll
- sync Carrier/CMA
- import Excel
- edition dossier
- patch dossier/date

Impact:
Un `da` futur peut encore etre combine a des TC deja avances si le changement vient d'une sync, d'un import ou d'une edition de dossier, sauf cas couverts ailleurs. Les tests couvrent les invariants, mais pas encore tous les points d'entree.

Correction attendue:
- Appeler `reconcileDossierState(newDos, newTcs)` juste avant chaque `sv(...)` qui modifie `dos` ou `tcs`.
- Ajouter tests d'integration par point d'entree: `editDos`, `patchDos(da future)`, `syncDPWorld`, `syncCarrier`, `bulkImport`.

## P1 - Majeur

### 3. Les regles membres/invitations sont mieux protegees, mais le schema reste trop libre

Fichiers: `firestore.rules:108`, `firestore.rules:157`.

Bon point:
- La creation membre exige maintenant premier createur ou invitation valide.
- L'invitation top-level exige un admin.
- `users.companyId` et `users.role` sont immuables en update self.

Reste:
- Le create initial `/users/{uid}` accepte encore n'importe quel schema.
- Le create member via invitation verifie le role, mais ne limite pas toute la forme du document.
- `createInvite` accepte `role` cote app; les rules ne limitent pas explicitement les roles autorises.
- Les admins peuvent updater un member sans schema strict.

Correction:
- Ajouter `hasOnly([...])` et contraintes de type sur `users`, `members`, `invites`.
- Limiter les roles a une liste fermee dans les rules.

### 4. Storage: acces par membership, mais pas par suspension

Fichier: `storage.rules:12`.

Storage verifie seulement l'existence du membership. Il ne verifie pas `billingStatus != suspended`, contrairement a plusieurs writes Firestore.

Impact:
Une company suspendue peut encore lire/ecrire ses fichiers Storage si un membre existe.

Correction:
Ajouter le check `isCompanyActive` equivalent dans les regles Storage, ou bloquer l'ecriture Storage pour comptes suspendus.

### 5. Modele document unique toujours fragile

Fichier: `src/useData.ts:441`, `src/useData.ts:461`.

Le `save()` fait toujours un `setDoc(companies/{companyId}, clean)` complet. Le warning 500 KB existe, mais il ne protege ni contre:

- ecrasement concurrent entre utilisateurs/onglets;
- conflit offline;
- limite Firestore 1 Mio;
- update trop large par role operationnel.

Correction:
- Version/revision a court terme.
- Migration sous-collections a moyen terme.

### 6. Depenses: impayes encore sous-comptes

Fichier: `src/components/dossiers/NDepForm.tsx:110`.

Pour `status !== "payee"`, `mtFinal = 0`. Donc une facture `a_payer` garde `ht`, mais les anciens totaux qui lisent `mt` peuvent sous-evaluer les couts et marges.

Correction:
- Separer montant facture et montant paye.
- Ne pas encoder le statut paiement dans le montant.

### 7. Fichiers: limite UI toujours incompatible avec Firestore base64

Fichier: `src/components/dossiers/NDepForm.tsx:36`.

L'UI autorise 4 Mo, alors que le stockage base64 Firestore reste limite par la taille document. Storage est durci, mais le code justificatif utilise encore le store base64.

Correction:
- Limite temporaire 600-700 KB, ou migration effective des justificatifs vers Storage.

### 8. Dependances vulnerables toujours presentes

Commande: `npm.cmd audit --audit-level=moderate`.

Resultat:
- 11 vulnerabilites.
- 2 critiques: `jspdf`, `protobufjs`.
- 5 high: `xlsx`, `vite`, `rollup`, `picomatch`, `flatted`.
- `xlsx` n'a pas de fix disponible.

Correction:
- `npm audit fix` pour ce qui est patchable.
- Remplacer/isoler `xlsx`.
- Mettre a jour ou encadrer `jspdf`.

## P2 - Important

### 9. `ACTIF` reste dans beaucoup de tests et donnees de setup

Fichiers: plusieurs tests `src/hooks/__tests__/*`, `src/utils/__tests__/*`.

Le domaine canonique ne connait plus `ACTIF`, mais beaucoup de fixtures l'utilisent encore. Cela ne casse pas le typecheck car les objets sont souvent `any`/partiels, mais cela entretient l'ancien vocabulaire.

Correction:
- Remplacer les fixtures `ACTIF` par `INITIALISE`, `SECURISE` ou `EN_TRANSIT` selon le cas.
- Ajouter un test anti-regression qui refuse `ACTIF` dans les fixtures metier centrales.

### 10. Creation dossier par defaut toujours a aujourd'hui

Fichier: `src/components/dossiers/NDosForm.tsx:27`.

Un nouveau dossier prend encore `today()` comme date d'arrivee par defaut. Si l'utilisateur ne corrige pas, les TC peuvent demarrer `PORT`.

Correction:
- Rendre `da` vide/obligatoire.
- Ou creer `ATTENDU` tant qu'une source fiable n'a pas confirme l'arrivee.

### 11. Edition dossier recree toujours les TC PORT/ATTENDU

Fichier: `src/hooks/useDossierActions.ts:74`.

`editDos` supprime les TC `PORT/ATTENDU` puis recree les TC depuis le formulaire.

Impact:
Perte possible d'IDs, notes, champs sync, historique local.

Correction:
- Reconciliation par numero TC.

### 12. Lint toujours trop bruyant

Commande: `npm.cmd run lint`.

Resultat:
- 0 erreur.
- 723 warnings.

Impact:
Les vrais signaux sont noyes. Certains warnings sont pertinents: deps React hooks, `any`, console, unused.

Correction:
- Nettoyer par lots.
- Passer certaines categories critiques en erreur apres reduction.

## Verification executee

```powershell
npm.cmd run typecheck
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

Resultats:

- Typecheck: OK.
- Tests: OK, 380 tests.
- Build: OK.
- Lint: OK avec 723 warnings.
- Audit npm: KO, 11 vulnerabilites.

## Verdict

Les corrections Sprint 40 vont dans le bon sens et corrigent plusieurs erreurs du premier audit. Mais le projet n'est pas encore "metier-safe" ni "rules-safe":

1. Le document company complet reste modifiable par des roles operationnels.
2. Les invariants existent mais ne sont pas encore la couche obligatoire avant chaque sauvegarde.
3. Les donnees financieres/fichiers/dependances restent des risques majeurs.

Prochaine action recommandee:

1. Restreindre `companies/{companyId}.update` par role et champs.
2. Brancher `reconcileDossierState()` dans tous les chemins de mutation `dos/tcs`.
3. Ajouter les tests rules Firebase, car ils manquent encore dans les commandes executees.
