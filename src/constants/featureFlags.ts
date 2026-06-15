/**
 * featureFlags.ts — Drapeaux de fonctionnalites par compagnie.
 *
 * Permet d'exposer certaines fonctionnalites instables (ex: Sync armateur CMA)
 * uniquement a une liste restreinte de compagnies (beta-testeurs) avant
 * generalisation a tous les utilisateurs.
 *
 * Pour ajouter / retirer une compagnie : modifier la liste BETA_COMPANIES
 * et redeployer le front. Pas besoin de migration Firestore.
 */

// Liste des companyId autorises a tester les features beta.
// Pour ouvrir a tous : remplacer par ['*'] ou rendre isBetaCompany toujours true.
export var BETA_COMPANIES: string[] = [
  'c_mocpodna9egt',  // General Transit Dakar (Ousmane / fondateur)
  'c_mni2tj7llujy',  // Integrated Services (compagnie de test / QA)
];

/**
 * Retourne true si la compagnie est autorisee a utiliser les features beta.
 * Notamment : Sync armateur CMA (auto + manuel).
 */
export function isBetaCompany(companyId: string | undefined | null): boolean {
  if (!companyId) return false;
  return BETA_COMPANIES.indexOf(companyId) >= 0;
}
