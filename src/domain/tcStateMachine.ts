/**
 * Sprint 38B - Machine d'etat des conteneurs (TC).
 *
 * Definit les transitions de statut valides et permet de detecter les
 * regressions ou les sauts d'etape suspects (ex: PORT -> BAMAKO sans DISPATCHE).
 *
 * Cycle de vie nominal Dakar -> Bamako :
 *
 *   ATTENDU  -> PORT       (le navire arrive et decharge)
 *   PORT     -> DISPATCHE  (BAD obtenu, TC sort du terminal sur camion)
 *   DISPATCHE -> TRANSIT   (camion en route vers Bamako)
 *   TRANSIT  -> KATI       (etape frontiere Mali)
 *   KATI     -> BAMAKO     (arrive a destination)
 *   BAMAKO   -> RETURNED   (TC vide retourne a Dakar)
 *
 * Raccourcis tolerees (cas reels) :
 *   - TRANSIT  -> BAMAKO   (si pas de passage Kati identifie)
 *   - TRANSIT  -> RETURNED (TC livre + retour rapide, dates condensees)
 *   - BAMAKO   -> KATI -> RETURNED (TC peut rebrousser par Kati au retour)
 *   - DISPATCHE -> RETURNED (pour les dossiers locaux Dakar)
 *
 * Transitions BLOQUEES (regression ou impossibilite metier) :
 *   - RETURNED -> n'importe quoi (un TC retourne ne peut pas repartir)
 *   - PORT -> ATTENDU (regression de statut)
 *   - ATTENDU -> autre que PORT (le TC doit forcement etre dechargé d'abord)
 *
 * Le contournement est possible via `force: true` pour les cas exceptionnels
 * (correction manuelle d'une erreur de saisie).
 */

export type TcStatus =
  | 'ATTENDU'
  | 'PORT'
  | 'DISPATCHE'
  | 'TRANSIT'
  | 'KATI'
  | 'BAMAKO'
  | 'RETURNED';

export var TC_STATUSES: TcStatus[] = ['ATTENDU', 'PORT', 'DISPATCHE', 'TRANSIT', 'KATI', 'BAMAKO', 'RETURNED'];

/**
 * Table des transitions autorisees. Chaque clef = statut de depart,
 * valeur = liste des statuts d'arrivee autorises.
 */
var TRANSITIONS: Record<TcStatus, TcStatus[]> = {
  ATTENDU: ['PORT'],
  PORT: ['DISPATCHE'],
  DISPATCHE: ['TRANSIT', 'RETURNED'],  // RETURNED pour dossier Dakar local
  TRANSIT: ['KATI', 'BAMAKO', 'RETURNED'],
  KATI: ['BAMAKO', 'RETURNED'],
  BAMAKO: ['KATI', 'RETURNED'],         // KATI au retour
  RETURNED: [],                          // statut terminal
};

export interface TransitionResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifie si une transition de statut TC est autorisee.
 * Retourne { valid: true } si OK, { valid: false, reason: '...' } sinon.
 */
export function canTcTransition(from: string | undefined | null, to: string): TransitionResult {
  // Statut d'arrivee invalide
  if (TC_STATUSES.indexOf(to as TcStatus) < 0) {
    return { valid: false, reason: 'Statut cible inconnu : ' + to };
  }
  // Pas de statut initial : on autorise (creation TC)
  if (!from) return { valid: true };
  // Statut courant invalide : on accepte mais on warn (cas legacy possible)
  if (TC_STATUSES.indexOf(from as TcStatus) < 0) {
    return { valid: true, reason: 'Statut courant non-standard : ' + from };
  }
  // Meme statut : no-op accepte
  if (from === to) return { valid: true };
  // Verifie la table de transitions
  var allowed = TRANSITIONS[from as TcStatus];
  if (allowed.indexOf(to as TcStatus) < 0) {
    return {
      valid: false,
      reason: 'Transition interdite ' + from + ' -> ' + to +
        '. Transitions autorisees depuis ' + from + ' : ' +
        (allowed.length > 0 ? allowed.join(', ') : '(aucune, statut terminal)'),
    };
  }
  return { valid: true };
}

/**
 * Indique si un statut est terminal (aucune transition sortante).
 */
export function isTerminalStatus(status: string): boolean {
  if (TC_STATUSES.indexOf(status as TcStatus) < 0) return false;
  return TRANSITIONS[status as TcStatus].length === 0;
}
