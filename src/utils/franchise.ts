import type { Dossier } from '../types';

/**
 * Calcul des franchises (compagnie, magasinage DPWorld, retour vide).
 *
 * Utilise par l'auto-stub Depenses : defaults intelligents selon type
 * de dossier et destination, avec overrides possibles au niveau du Dossier
 * (champs frCp / frMg / frRt).
 */

export type RegionLivraison = "DAKAR" | "THIES" | "SENEGAL" | "CORRIDOR";

var CORRIDOR_KEYWORDS = ["mali", "bamako", "burkina", "ouaga", "niger"];

/**
 * Deduit la region de livraison depuis le champ destination (dos.cr).
 * Heuristique simple sur mots-cles. En cas de doute => DAKAR.
 */
export function regionFromDestination(dest?: string): RegionLivraison {
  if (!dest) return "DAKAR";
  var d = dest.toLowerCase();
  if (d.indexOf("dakar") >= 0) return "DAKAR";
  if (d.indexOf("thies") >= 0 || d.indexOf("thiès") >= 0) return "THIES";
  for (var i = 0; i < CORRIDOR_KEYWORDS.length; i++) {
    if (d.indexOf(CORRIDOR_KEYWORDS[i]) >= 0) return "CORRIDOR";
  }
  return "SENEGAL";
}

/**
 * Franchise magasinage DPWorld (jours avant facturation) par type de dossier.
 * IMPORT=10j, TRANSIT=21j, VEHICULE=5j, defaut=10j.
 */
export function defaultFranchiseMagasinage(type?: string): number {
  if (type === "IMPORT") return 10;
  if (type === "TRANSIT") return 21;
  if (type === "VEHICULE") return 5;
  return 10;
}

/**
 * Franchise compagnie armateur (surestaries port, TC plein).
 * Standard : 10j sauf derogation client.
 */
export function defaultFranchiseCompagnie(): number {
  return 10;
}

/**
 * Franchise retour vide (detention conteneur) selon region livraison.
 * DAKAR=4j, THIES=5j, SENEGAL=8j, CORRIDOR=23j.
 */
export function defaultFranchiseRetourVide(region: RegionLivraison): number {
  if (region === "DAKAR") return 4;
  if (region === "THIES") return 5;
  if (region === "CORRIDOR") return 23;
  return 8; // SENEGAL
}

/**
 * Franchise magasinage effective sur un dossier (override > default).
 */
export function getFranchiseMagasinage(dos: Dossier): number {
  if (dos.frMg !== undefined && dos.frMg !== null) return dos.frMg;
  return defaultFranchiseMagasinage(dos.td);
}

/**
 * Franchise compagnie effective sur un dossier (override > default).
 */
export function getFranchiseCompagnie(dos: Dossier): number {
  if (dos.frCp !== undefined && dos.frCp !== null) return dos.frCp;
  return defaultFranchiseCompagnie();
}

/**
 * Franchise retour vide effective sur un dossier (override > default via destination).
 */
export function getFranchiseRetourVide(dos: Dossier): number {
  if (dos.frRt !== undefined && dos.frRt !== null) return dos.frRt;
  return defaultFranchiseRetourVide(regionFromDestination(dos.cr));
}
