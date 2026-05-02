# Regles de travail — Sapurai

## Processus obligatoire

1. **Toujours planifier avant de modifier** — Ne jamais editer, creer ou supprimer de fichiers sans validation prealable de l'utilisateur. Presenter le plan (fichiers concernes, nature des changements) et attendre l'aval explicite.
2. **Mettre a jour le suivi** — Apres chaque serie de modifications validees, mettre a jour `CHANGELOG-AUDIT.md` (section FAIT ou PAS FAIT selon le cas).
3. **Verifier apres modification** — Apres chaque changement, lancer `npm run build` et `npm run lint` pour s'assurer que rien n'est casse.

## Communication

- Langue : **francais** (code en anglais, commentaires et echanges en francais)
- Etre concis et aller droit au but
- Presenter les options clairement quand il y a un choix a faire

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src/useData.ts` | Hook central Firestore (listeners, CRUD, invites) |
| `src/hooks/useAppLogic.ts` | Orchestrator (compose 11 hooks specialises) |
| `src/hooks/useAppMetrics.ts` | Counters, urgences, alertes |
| `src/hooks/useDossierActions.ts` | CRUD dossiers (addDos, patchDos, closeDos) |
| `src/main.tsx` | Entry point, routing, auth guard |
| `src/App.tsx` | Shell principal (sidebar + pages) |
| `src/types.ts` | Types domaine stricts (Dossier, Conteneur, Depense, Chauffeur, Intervenant) |
| `firestore.rules` | Regles de securite Firestore (multi-tenant) |
| `CHANGELOG-AUDIT.md` | Suivi des travaux (fait / pas fait) |
| `STYLE-GUIDE.md` | Regles design + dark mode + interdiction hex hardcoded |

## Scripts

```bash
npm run dev          # Serveur de dev
npm run build        # Build production
npm run lint         # ESLint (0 erreurs attendues)
npm test             # Vitest (28 tests)
npm run deploy       # Build + deploy Firebase
```
