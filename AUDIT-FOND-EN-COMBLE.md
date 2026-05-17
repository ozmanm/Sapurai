# Audit fond en comble - Logitrans

Date: 2026-05-15

## Synthese executive

Le projet fonctionne et les tests unitaires passent, mais la logique metier n'est pas protegee au bon endroit. Les statuts conteneur/dossier, les droits Firestore et les ecritures de donnees reposent trop sur l'interface. Cela explique les incoherences visibles: un dossier peut etre "En transit" alors que l'arrivee navire est future, un TC peut etre dispatche hors sequence, et un role limite peut techniquement modifier plus que ce que l'UI laisse penser.

Points bloquants a traiter en premier:

1. Securite multi-tenant Firestore: auto-adhesion possible a une societe active si l'ID est connu.
2. Invariants metier TC/dossier non centralises: statut futur/impossible possible.
3. Modele de donnees "un document company complet" fragile: pertes de mises a jour concurrentes et limite Firestore 1 Mio.
4. Tracking public incoherent avec les statuts reels.
5. Dette qualite: typecheck casse, audit npm critique, lint trop bruyant.

## P0 - Critique

### 1. Auto-adhesion et elevation possible via les regles Firestore

Fichiers: `firestore.rules:41`, `firestore.rules:53`, `firestore.rules:61`, `firestore.rules:96`, `firestore.rules:135`, `storage.rules:5`.

Constat:
- Un utilisateur authentifie peut ecrire son propre document `/users/{uid}` sans contrainte de schema ni role.
- Il peut creer `/companies/{companyId}/members/{uid}` si la societe est active, sans invitation ni validation admin.
- La regle ne limite pas le role demande dans ce document membre.
- Les invitations top-level peuvent etre creees par tout utilisateur authentifie pour une company active.
- Les fichiers base64 se basent sur `users/{uid}.companyId`, que l'utilisateur peut lui-meme modifier.
- Storage autorise `read, write` a tout utilisateur authentifie sur `/files/{fileId}`.

Impact:
Un utilisateur qui connait ou devine un `companyId` peut potentiellement devenir membre, choisir un role fort, lire la company et modifier le document principal si son role passe `admin`, `editor` ou `agent`.

Correction attendue:
- Interdire la creation libre de membres.
- Exiger une invitation valide ou une action admin cote serveur.
- Verrouiller le schema de `members`: role impose par invitation existante, pas par le client.
- Interdire aux utilisateurs de changer eux-memes `companyId` et `role` dans `/users/{uid}`.
- Refaire les regles `/files` et `storage.rules` avec appartenance verifiee par membership, pas par profil utilisateur auto-declare.

### 2. Les statuts metier peuvent contredire la date d'arrivee

Fichiers: `src/hooks/useConteneurActions.ts:41`, `src/hooks/useConteneurActions.ts:89`, `src/utils/dossierStatus.ts:19`, `src/hooks/useAppLogic.ts:80`, `src/components/dossiers/DetView.tsx`, `src/components/conteneurs/TcTimeline.tsx`.

Constat:
- `dispatch()` exige BAE ou Pregate, mais ne verifie pas que le TC est au port ni que `dos.da <= aujourd'hui`.
- `advance()` verifie seulement la transition de statut, pas les dates ni les preconditions dossier.
- `computeDossierStatus()` ignore `dos.da`.
- L'auto-sync ne retrograde que `PORT -> ATTENDU` quand `da` redevient future; elle ne corrige pas `DISPATCHE`, `TRANSIT`, `KATI`, etc.
- Les timelines affichent les etapes comme faites uniquement avec l'ordre du statut.

Impact:
Cas observe: dossier avec `da = 30/05/2026`, TC dispatche/chargement, dossier `EN_TRANSIT`. La date future et l'etat operationnel ne peuvent pas tous deux etre vrais sans une notion d'estimation/prevision.

Correction attendue:
- Creer un service unique d'invariants: `canDispatchTc`, `canAdvanceTc`, `deriveTcDisplayState`, `deriveDossierStatus`.
- Bloquer dispatch/advance si l'arrivee est future, sauf override admin explicite avec motif.
- Recalculer dossier et TC apres toute modification `da`, sync DPWorld/CMA/import.
- Faire dependre le rendu timeline de l'etat derive, pas seulement de `tc.st`.

### 3. Ecritures Firestore en document complet: risque fort de pertes de donnees

Fichier: `src/useData.ts:441`, `src/useData.ts:461`.

Constat:
- `save(newData)` fait un `setDoc(companies/{companyId}, clean)` du document complet.
- Les actions manipulent des tableaux (`dos`, `tcs`, `dep`, `chs`, `logs`, `cfg`) cote client.
- Les imports, dispatchs, syncs et edits peuvent s'ecraser entre deux onglets ou deux utilisateurs.
- Le README signale deja une future migration si le document depasse 500 KiB, mais le code ne bloque pas.

Impact:
En production multi-utilisateur, une action tardive peut ecraser une action plus recente. Le modele atteindra aussi la limite Firestore de 1 Mio.

Correction attendue:
- Migrer vers sous-collections: `dossiers`, `tcs`, `depenses`, `chauffeurs`, `logs`.
- Utiliser transactions/batches et champs versionnes.
- A court terme: refuser sauvegarde si revision distante changee, afficher conflit, limiter taille.

## P1 - Majeur

### 4. Tracking public aligne sur de mauvais codes statut

Fichier: `src/TrackingPage.tsx:48`.

Constat:
Le tracking public utilise `DISPATCH` et `RETOUR`, alors que le domaine utilise `DISPATCHE` et `RETURNED`.

Impact:
Un conteneur dispatche ou retourne peut etre affiche au mauvais niveau de progression cote client.

Correction:
Utiliser les constantes domaine (`TC_STATUSES`) ou une map canonique unique.

### 5. Statuts dossier contradictoires entre domaine, types et UI

Fichiers: `src/domain/statuses.ts:23`, `src/constants/statuts.ts:37`, `src/types.ts`.

Constat:
Le domaine type `DossierStatus` connait `INITIALISE | ACTIF | CLOTURE | ARCHIVE`, alors que l'UI et la logique manipulent `SECURISE` et `EN_TRANSIT`.

Impact:
Les garde-fous TypeScript ne protegent pas les vrais statuts metier; des normalisations peuvent retomber sur `ACTIF`.

Correction:
Definir une enum canonique unique et supprimer les fallbacks `string` quand c'est possible.

### 6. Depenses: ancien et nouveau modele cohabitent

Fichier: `src/components/dossiers/NDepForm.tsx:110`.

Constat:
- Ancien champ `s` et nouveau champ `status` cohabitent.
- Pour une depense `a_payer`, `mt` est force a `0`.
- Les totaux historiques utilisent souvent `mt`, donc les impayes peuvent disparaitre des totaux/marges.

Impact:
Marge, impayes et total dossier peuvent etre faux.

Correction:
Conserver `amountTtc`/`amountHt` independamment du paiement, et calculer `paidAmount` separement.

### 7. Pieces jointes: limite UI incompatible avec Firestore

Fichiers: `src/components/dossiers/NDepForm.tsx:36`, `src/fileStore.ts`.

Constat:
L'UI autorise 4 Mo, mais `fileStore` stocke le base64 dans un document Firestore. Un document Firestore est limite a environ 1 Mio, et le base64 grossit le fichier.

Impact:
Uploads instables ou impossibles pour des justificatifs reels.

Correction:
Basculer les fichiers vers Firebase Storage avec regles tenant strictes, ou limiter sous 600-700 Ko en attendant.

### 8. Typecheck casse alors que le build passe

Commandes:
- `npm.cmd run typecheck` echoue.
- `npm.cmd run build` passe.

Erreurs:
- `src/pages/SuperAdmin.tsx:83` utilise `PaymentMethod` sans import.
- `src/services/__tests__/dpworld.test.ts:318` assigne `dpwSyncedAt` sur un type qui ne le declare pas.

Impact:
Le build peut deployer du code avec erreurs TypeScript.

Correction:
Inclure `npm run typecheck` dans la CI/deploy et corriger les deux erreurs.

### 9. Vulnerabilites npm importantes

Commande: `npm.cmd audit --audit-level=moderate`.

Resultat:
11 vulnerabilites: 4 moderate, 5 high, 2 critical.

Points sensibles:
- `jspdf <=4.2.0`: injections PDF/HTML critiques.
- `xlsx`: prototype pollution et ReDoS, pas de fix disponible.
- `vite`, `rollup`, `picomatch`, `protobufjs`, `dompurify`.

Impact:
Projet expose a des fichiers importes et exports; `xlsx` et `jspdf` sont dans le chemin utilisateur.

Correction:
Remplacer `xlsx` si possible, mettre a jour `jspdf`/toolchain, sandboxer les imports, limiter tailles fichiers.

### 10. Sync DPWorld/CMA/Carrier applique des patchs sans recalcul global fiable

Fichiers: `src/hooks/useDPWorldSync.ts`, `src/hooks/useCarrierSync.ts`, `src/services/dpworld.ts`, `src/services/cma.ts`.

Constat:
Les syncs modifient dossier/TC, mais ne passent pas toutes par le meme moteur d'invariants et de statut dossier.

Impact:
Une source officielle peut corriger une date ou un TC sans remettre le dossier dans un etat coherent.

Correction:
Toute sync doit finir par `reconcileCompanyState()` ou equivalent: TC, dossier, alertes, logs de conflit.

## P2 - Important

### 11. Creation dossier par defaut a aujourd'hui

Fichier: `src/components/dossiers/NDosForm.tsx:27`.

Constat:
Un nouveau dossier prend `da = today()` par defaut. Donc les TC peuvent etre crees `PORT` meme si la vraie ETA n'est pas connue.

Correction:
Rendre la date obligatoire ou creer en `ATTENDU` tant qu'aucune source fiable n'a confirme l'arrivee.

### 12. Edition dossier peut recreer des TC existants

Fichier: `src/hooks/useDossierActions.ts`.

Constat:
Lors d'une edition, les TC `PORT/ATTENDU` du dossier peuvent etre supprimes/recrees depuis le formulaire.

Impact:
Perte possible d'IDs, notes, champs DPWorld, dates et historique local.

Correction:
Faire une reconciliation par numero TC avec preservation des champs existants.

### 13. Role editor ignore cote UI, agent trop large cote regles

Fichiers: `src/App.tsx:30`, `firestore.rules:56`.

Constat:
L'UI donne `canEdit` a `admin | agent`, pas a `editor`. Les regles donnent update company a `admin | editor | agent`.

Impact:
Les droits reels et les droits affiches divergent. Un agent peut modifier le document complet si ses credentials le permettent.

Correction:
Clarifier la matrice de permissions et l'appliquer dans les regles + UI + actions.

### 14. Invitations legacy / top-level incoherentes

Fichiers: `src/useData.ts:616`, `firestore.rules:97`.

Constat:
Le code parle de `assignedEmail`, d'autres chemins utilisent `forEmail`. Les regles top-level ne verifient pas que le createur est admin de la company.

Correction:
Unifier le modele d'invitation et bloquer creation/update hors admin ou Cloud Function.

### 15. Documentation et encodage

Constat:
Plusieurs fichiers contiennent des caracteres corrompus (`Ã©`, `â€”`). La documentation de tests/architecture n'est pas totalement synchronisee avec l'etat actuel.

Correction:
Normaliser en UTF-8, ajouter un check, mettre a jour README/PRODUCT/PROJET apres les corrections structurelles.

## Verification effectuee

Commandes executees:

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

Resultats:
- Tests: 19 fichiers, 349 tests OK.
- Lint: OK mais 701 warnings.
- Typecheck: KO, 2 erreurs.
- Build: OK.
- Audit npm: KO, 11 vulnerabilites dont 2 critiques.

## Plan de correction recommande

### Phase 1 - Verrouiller les risques critiques

1. Corriger les regles Firestore/Storage: membres, users, invites, files.
2. Ajouter tests de regles Firebase pour auto-join, role forge, file access, invite forge.
3. Introduire un moteur unique d'invariants TC/dossier.
4. Corriger tracking public `DISPATCHE/RETURNED`.
5. Faire passer `typecheck` dans le pipeline.

### Phase 2 - Stabiliser la logique metier

1. Refondre les statuts dossier en enum canonique.
2. Recalculer les statuts apres import, sync, edit date, dispatch, advance.
3. Corriger depenses/marges/impayes.
4. Corriger upload fichiers ou migrer vers Storage strict.
5. Eviter la creation `PORT` par defaut si ETA inconnue.

### Phase 3 - Durcir la plateforme

1. Migrer le document company vers sous-collections.
2. Ajouter transactions, revisions et resolution de conflits.
3. Reduire les warnings lint et bloquer les categories critiques.
4. Remplacer ou isoler les dependances vulnerables (`xlsx`, `jspdf`).
5. Nettoyer docs et encodage.

## Conclusion

Le probleme principal n'est pas un bug isole dans l'ecran dossier. C'est une absence de couche metier centrale et une separation insuffisante entre donnees, permissions et UI. Tant que les transitions restent dispersees dans les hooks/composants et que Firestore accepte des ecritures larges, les incoherences reviendront.

La priorite absolue est de fermer les failles de membership/roles, puis de rendre impossible par code un statut qui contredit la date d'arrivee.
