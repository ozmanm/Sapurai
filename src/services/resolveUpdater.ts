// src/services/resolveUpdater.ts
//
// Backlog N (Sprint 46 hotfix beta) : primitive PURE extraite du fix E (closure stale).
// Resout un argument de save() (valeur OU updater fonctionnel) contre la verite synchrone
// portee par un ref, PUIS ecrit le resultat dans le ref (write-back synchrone). C'est ce
// write-back qui ferme la fenetre des deletes rapproches : un 2e save avant re-render lit
// le post-state du 1er via `ref.current`, pas le React state fige de la closure.
//
// Pourquoi le write-back vit ICI (et pas laisse inline dans save()) : pour qu'il soit
// couvert par un test pur. Si quelqu'un retire `ref.current = next`, le cas rapid-succession
// ET le cas value-path->ref cassent (cf. resolveUpdater.test.ts). Verrouille l'ex-ligne 461.

export type Updater<T> = T | ((prev: T) => T);
export interface RefLike<T> { current: T | null; }

/**
 * Resout `arg` contre `ref.current` (fallback sur `fallback` si le ref est `null`, ex:
 * pre-hydratation), ecrit le resultat dans `ref.current` (write-back synchrone) et le
 * retourne.
 *
 * - `arg` fonction -> applique a la base resolue.
 * - `arg` valeur   -> utilisee telle quelle (la base est ignoree), MAIS le ref est tout
 *   de meme mis a jour : un updater suivant (ex: deleteDos apres un addDos value-path
 *   rapproche) doit voir cette valeur, pas un ref stale du dernier value-save.
 *
 * @param ref objet `{ current }` mutable (React ref ou stub `{ current }` de test).
 * @param fallback valeur de repli si `ref.current == null`. Cote useData : le React state
 *   courant, JAMAIS `{}` (cf. invariant prevSnapshot, incident 2026-05-24).
 */
export function resolveUpdater<T>(arg: Updater<T>, ref: RefLike<T>, fallback: T): T {
  var base = ref.current != null ? ref.current : fallback;
  var next = (typeof arg === 'function') ? (arg as (prev: T) => T)(base) : arg;
  ref.current = next;
  return next;
}
