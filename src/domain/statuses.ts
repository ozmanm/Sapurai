/**
 * Sprint 38A - Types canoniques de statuts metier + helpers de normalisation.
 *
 * Pour des raisons de retrocompatibilite, les interfaces Dossier/Conteneur/Depense
 * dans types.ts conservent `| string` dans leurs unions (cf. critique 4). Le risque
 * d'avoir une faute de frappe ou une valeur inattendue persiste donc cote types.
 *
 * Pour les CALCULS METIER (alertes, filtres, transitions), passer par les helpers
 * de ce module : ils valident la valeur d'entree et ramenent les valeurs hors-spec
 * a une valeur connue / safe.
 *
 * Source de verite TC : `tcStateMachine.ts` (TC_STATUSES + canTcTransition).
 */

import { TC_STATUSES } from './tcStateMachine';
import type { TcStatus } from './tcStateMachine';

export type { TcStatus };

/**
 * Statuts canoniques d'un Dossier.
 */
export type DossierStatus = 'INITIALISE' | 'ACTIF' | 'CLOTURE' | 'ARCHIVE';
export var DOSSIER_STATUSES: DossierStatus[] = ['INITIALISE', 'ACTIF', 'CLOTURE', 'ARCHIVE'];

/**
 * Valide qu'une valeur est un TcStatus canonique. Sinon retourne `fallback`.
 * Par defaut `fallback = 'ATTENDU'` (statut neutre de creation).
 */
export function normalizeTcStatus(value: unknown, fallback: TcStatus = 'ATTENDU'): TcStatus {
  if (typeof value !== 'string') return fallback;
  if (TC_STATUSES.indexOf(value as TcStatus) >= 0) return value as TcStatus;
  return fallback;
}

/**
 * Valide qu'une valeur est un DossierStatus canonique. Sinon retourne `fallback`.
 * Par defaut `fallback = 'ACTIF'`.
 */
export function normalizeDossierStatus(value: unknown, fallback: DossierStatus = 'ACTIF'): DossierStatus {
  if (typeof value !== 'string') return fallback;
  if (DOSSIER_STATUSES.indexOf(value as DossierStatus) >= 0) return value as DossierStatus;
  return fallback;
}

/**
 * Vrai si la valeur est un statut TC connu.
 */
export function isKnownTcStatus(value: unknown): value is TcStatus {
  return typeof value === 'string' && TC_STATUSES.indexOf(value as TcStatus) >= 0;
}

/**
 * Vrai si la valeur est un statut Dossier connu.
 */
export function isKnownDossierStatus(value: unknown): value is DossierStatus {
  return typeof value === 'string' && DOSSIER_STATUSES.indexOf(value as DossierStatus) >= 0;
}
