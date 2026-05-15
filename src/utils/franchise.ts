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


/**
 * Sprint 38D - Helpers de calcul jours surestaries/detention (source de verite unique).
 *
 * Auparavant duplique dans `src/hooks/useConteneurActions.ts` (tcFranchise) et
 * `src/utils/date.ts` (calcAlertesFranchise). Si demain on change la regle
 * (j+1 inclusif, gestion BAD, etc.), on le fait ICI uniquement.
 *
 * Regle inclusive : le jour de chargement / d'arrivee compte.
 *   Du 01/03 au 24/03 = 24 jours (et non 23). Donc +1 sur le diff.
 */

/**
 * Jours de surestaries port pour un TC.
 *  - Si BAD obtenu + date validite (bv) : decompte depuis bv (debut surestaries)
 *  - Sinon : decompte depuis date arrivee navire (da)
 *  - dateFin = tc.dsp si dispatche, sinon aujourd'hui
 *  - Clamp a 0 si BAD pas encore expire (joursSur < 0)
 */
export function joursSurestariesPort(d: Dossier, dateFin?: string | null): number {
  if (!d.da) return 0;
  var startSur = (d.bs === 'OBTENU' && d.bv) ? new Date(d.bv) : new Date(d.da);
  startSur.setHours(0, 0, 0, 0);
  var end = dateFin ? new Date(dateFin) : new Date();
  end.setHours(0, 0, 0, 0);
  var jours = Math.floor((end.getTime() - startSur.getTime()) / 864e5) + 1;
  return jours < 0 ? 0 : jours;
}

/**
 * Jours de detention conteneur (sortie terminal -> retour vide).
 *  - dsp = date dispatch (sortie terminal)
 *  - dr = date retour vide (si null : aujourd'hui)
 */
export function joursDetention(dsp: string | null | undefined, dr?: string | null): number {
  if (!dsp) return 0;
  var start = new Date(dsp);
  start.setHours(0, 0, 0, 0);
  var end = dr ? new Date(dr) : new Date();
  end.setHours(0, 0, 0, 0);
  var jours = Math.floor((end.getTime() - start.getTime()) / 864e5) + 1;
  return jours < 0 ? 0 : jours;
}
