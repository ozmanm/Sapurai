# Phase A — Fenêtre d'observation dual-write

> Statut Phase A : **EN COURS**
> Début : 2026-05-17 (backfill exécuté)
> Fin attendue : 2026-05-24 (7 jours consécutifs sans drift)

## Contexte

Le dual-write tourne en prod depuis le Sprint 43 (commit `e1ec02b`, ~12 mai 2026).
Le backfill Phase B a été exécuté le 2026-05-17 avec succès :
- 9 companies traitées
- 1040 writes (zero skipped)
- Zero drift au diff post-backfill

Cette fenêtre d'observation valide que :
1. Toute nouvelle modification utilisateur est correctement miroir dans les sous-collections
2. Aucune erreur silencieuse de mirror (collection `dual_write_errors`)
3. La cohérence mono-doc ↔ sous-collections se maintient dans le temps

## Critère de feu vert pour Phase C

**7 jours consécutifs** avec :
- `diff-mono-vs-sub.mjs` → exit code 0 (zero drift) pour `c_mocpodna9egt`
- Collection `companies/c_mocpodna9egt/dual_write_errors` reste vide OU
  ne contient que des erreurs identifiées et résolues

## Suivi quotidien

Lancer chaque jour :

```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\Ousmane\.secrets\sapurai-admin.json
node scripts/diff-mono-vs-sub.mjs --cid=c_mocpodna9egt
```

Et vérifier la collection `dual_write_errors` dans la console Firebase
(filtrer par `ts` desc, regarder les 50 derniers).

### Tableau de suivi

| Date | Diff exit code | onlyMono | onlySub | fieldDiffs | dual_write_errors nouveaux | Note |
|------|---|---|---|---|---|------|
| 2026-05-17 | 0 (post-backfill) | 0 | 0 | 0 | 0 | Backfill OK |
| 2026-05-18 | | | | | | |
| 2026-05-19 | | | | | | |
| 2026-05-20 | | | | | | |
| 2026-05-21 | | | | | | |
| 2026-05-22 | | | | | | |
| 2026-05-23 | | | | | | |
| 2026-05-24 | | | | | | Fin attendue |

## Que faire si drift détecté

1. **`fieldDiffs > 0`** : un dossier a divergé. Lancer `--verbose` pour voir les champs concernés. Cause probable : un hook qui modifie le mono-doc sans déclencher `save()` (raccourci hors flow normal).
2. **`onlyMono > 0`** : un dossier créé/modifié mais le mirror n'a jamais été ecrit. Vérifier `dual_write_errors` à la même date.
3. **`onlySub > 0`** : un dossier supprimé du mono-doc mais resté dans la sous-collection. Cause : la suppression n'a pas passé par `mirrorToSubcollections` (rare en Phase A).
4. **Erreurs dans `dual_write_errors`** : examiner les messages, fixer la cause, re-lancer le backfill ciblé pour rattraper.

## Phase C (déclenchement)

Après 7 jours zero drift, basculer la lecture :
- Modifier `useData.ts` pour `onSnapshot` sur chaque sous-collection au lieu du mono-doc
- Garder le dual-write actif (filet)
- Refactor 60 tests E2E
- Sprint 46 dédié
