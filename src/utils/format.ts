import type { Conteneur } from '../types';

/**
 * Formate une date ISO en date francaise (ex: "23/02/2026")
 * Retourne "---" si la date est absente.
 */
export function fd(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "---";
}

/**
 * Formate un montant en FCFA (ex: "150 000 FCFA")
 */
export function fm(n: number | null | undefined): string {
  return (n || 0).toLocaleString("fr-FR") + " FCFA";
}

/**
 * Resume les conteneurs par type (ex: "2 20GP, 1 40HC")
 */
export function tcSum(tcs: Conteneur[]): string {
  var m: Record<string, number> = {};
  tcs.forEach(function (c) {
    var k = c.ty || "?";
    m[k] = (m[k] || 0) + 1;
  });
  return Object.keys(m)
    .map(function (k) { return String(m[k]) + " " + k; })
    .join(", ");
}
