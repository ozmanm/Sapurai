/**
 * Sprint 38C - Helpers canoniques pour le statut paiement d'une Depense.
 *
 * SOURCE DE VERITE = `Depense.status` ('en_attente_facture' | 'a_payer' | 'payee').
 *
 * Le champ legacy `Depense.s` ('PAYE' | 'ATT' | string) est DEPRECATED.
 * Ces helpers gerent la coexistence des deux modeles pour la phase de
 * migration. Utilise `getDepenseStatus()` partout dans le nouveau code,
 * et execute `scripts/migrate-depenses-legacy-status.mjs` une fois pour
 * propager `status` sur tous les enregistrements existants.
 *
 * Mapping legacy -> status :
 *   s === 'PAYE' => 'payee'
 *   s === 'ATT'  => 'a_payer'
 *   sinon         => 'a_payer' (defaut prudent, on suppose facture recue)
 */

import { guessStatus } from './stub';

export type DepenseStatus = 'en_attente_facture' | 'a_payer' | 'payee';

/**
 * Retourne le status effectif d'une depense (source de verite).
 * Si `status` existe, le retourne. Sinon resout depuis le legacy `s`.
 */
export function getDepenseStatus(dep: { s?: string; status?: string } | null | undefined): DepenseStatus {
  if (!dep) return 'a_payer';
  if (dep.status === 'en_attente_facture' || dep.status === 'a_payer' || dep.status === 'payee') {
    return dep.status as DepenseStatus;
  }
  return guessStatus({ s: dep.s });
}

/**
 * Vrai si la depense est payee (status === 'payee', legacy s === 'PAYE').
 */
export function isDepensePayee(dep: { s?: string; status?: string } | null | undefined): boolean {
  return getDepenseStatus(dep) === 'payee';
}

/**
 * Vrai si la depense est due (facture recue, en attente de paiement).
 */
export function isDepenseAPayer(dep: { s?: string; status?: string } | null | undefined): boolean {
  return getDepenseStatus(dep) === 'a_payer';
}

/**
 * Vrai si la depense est un stub (facture pas encore recue).
 */
export function isDepenseEnAttenteFacture(dep: { s?: string; status?: string } | null | undefined): boolean {
  return getDepenseStatus(dep) === 'en_attente_facture';
}

/**
 * Convertit un status canonique en valeur legacy `s` pour retrocompatibilite
 * pendant la phase de migration (a retirer quand `s` sera supprime du modele).
 */
export function statusToLegacyS(status: DepenseStatus): 'PAYE' | 'ATT' {
  return status === 'payee' ? 'PAYE' : 'ATT';
}
