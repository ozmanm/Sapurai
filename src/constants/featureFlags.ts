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

// ── Phase C (bascule des LECTURES vers les sous-collections) ──────────────────
// Compagnies dont les listeners LISENT depuis /companies/{cid}/{dossiers,tcs,...} au lieu
// du doc mono. Vide = personne (comportement Phase A strictement inchange). Pour basculer
// une compagnie : ajouter son cid + redeployer le front. Generalisation finale (C5) : ['*'].
// readonly : ce flag se change en EDITANT la constante (= deploiement), jamais en mutate runtime.
export var SUB_READ_COMPANIES: readonly string[] = [];

// Predicat PUR (liste injectee) pour pouvoir tester les cas positifs sans muter la constante.
export function matchesSubRead(list: readonly string[], companyId: string | undefined | null): boolean {
  if (!companyId) return false;
  if (list.indexOf('*') >= 0) return true;          // C5 : generalisation a toutes les compagnies
  return list.indexOf(companyId) >= 0;
}

export function shouldReadFromSub(companyId: string | undefined | null): boolean {
  return matchesSubRead(SUB_READ_COMPANIES, companyId);
}

// CMA-CGM sync : trial expire -> API retourne 429 sur chaque call. false = AUCUNE call CMA
// (auto-poll + manuel, via fetchCarrier cma-branch ET fetchCMA). Rallumer = flip true +
// redeploy front le jour ou une cle API payante est obtenue.
export var CMA_ENABLED: boolean = false;
