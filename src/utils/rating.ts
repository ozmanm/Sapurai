import type { Dossier } from '../types';

/**
 * Helpers pour le rating client (feedback a la cloture du dossier).
 *
 * Ratings : 1 = Tres satisfait, 2 = Correct, 3 = Probleme signale.
 * Valeurs derivees depuis le doc /tracking/{tokId} par useData (mergees sur Dossier).
 */

export interface RatingStats {
  total: number;         // nombre de dossiers avec un rating
  good: number;          // rating 1 ou 2
  problems: number;      // rating 3
  goodPct: number;       // pourcentage 0-100
}

/**
 * Calcule les stats de satisfaction sur un jeu de dossiers.
 * Ignore les dossiers sans rating.
 */
export function ratingStats(dos: Dossier[]): RatingStats {
  var rated = dos.filter(function (d) { return d.rating === 1 || d.rating === 2 || d.rating === 3; });
  var good = rated.filter(function (d) { return d.rating === 1 || d.rating === 2; }).length;
  var problems = rated.filter(function (d) { return d.rating === 3; }).length;
  var goodPct = rated.length > 0 ? Math.round(good / rated.length * 100) : 0;
  return { total: rated.length, good: good, problems: problems, goodPct: goodPct };
}

/**
 * Renvoie les dossiers avec rating = 3 (problemes signales), tries du plus
 * recent au plus ancien par ratingAt. Utilise sur le Dashboard pour liste
 * des problemes a traiter.
 */
export function dossiersWithProblems(dos: Dossier[]): Dossier[] {
  return dos
    .filter(function (d) { return d.rating === 3; })
    .slice()
    .sort(function (a, b) {
      var aA = a.ratingAt || "";
      var bA = b.ratingAt || "";
      return aA < bA ? 1 : aA > bA ? -1 : 0;
    });
}

export var RATING_REASON_LABELS: Record<string, string> = {
  retard: "Retard",
  communication: "Communication",
  tarif: "Tarif",
  qualite: "Qualite",
  autre: "Autre",
};
