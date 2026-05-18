/**
 * Sprint 38B - Machine d'etat des conteneurs (TC).
 *
 * Definit les transitions de statut valides et permet de detecter les
 * regressions ou les sauts d'etape suspects (ex: PORT -> BAMAKO sans DISPATCHE).
 *
 * Cycle de vie nominal Dakar -> Bamako (Sprint 46) :
 *
 *   ATTENDU   -> PORT       (le navire arrive et decharge)
 *   PORT      -> ASSIGNE    (transitaire choisit un camion + chauffeur, RDV pris au port)
 *   ASSIGNE   -> DISPATCHE  (camion charge effectivement le TC + sortie terminal)
 *   DISPATCHE -> TRANSIT    (camion en route vers Bamako)
 *   TRANSIT   -> BAMAKO     (arrivee destination)
 *   BAMAKO    -> RETURNED   (TC vide retourne a Dakar)
 *
 * Raccourcis tolerees (cas reels) :
 *   - PORT     -> DISPATCHE (chargement immediat sans etape assignation explicite)
 *   - TRANSIT  -> RETURNED  (TC livre + retour rapide, dates condensees)
 *   - DISPATCHE -> RETURNED (pour les dossiers locaux Dakar)
 *   - ASSIGNE  -> PORT      (annulation assignation, le camion ne vient pas)
 *
 * Transitions BLOQUEES (regression ou impossibilite metier) :
 *   - RETURNED -> n'importe quoi (un TC retourne ne peut pas repartir)
 *   - PORT     -> ATTENDU (regression de statut)
 *   - ATTENDU  -> autre que PORT (le TC doit forcement etre decharge d'abord)
 *
 * KATI a ete retire du cycle de vie Sprint 46. Les TC en KATI ont ete migres
 * vers TRANSIT. Le champ legacy `dak` est conserve en lecture seule.
 *
 * Le contournement est possible via `force: true` pour les cas exceptionnels
 * (correction manuelle d'une erreur de saisie).
 */

export type TcStatus =
  | 'ATTENDU'
  | 'PORT'
  | 'ASSIGNE'
  | 'DISPATCHE'
  | 'TRANSIT'
  | 'BAMAKO'
  | 'RETURNED';

export var TC_STATUSES: TcStatus[] = ['ATTENDU', 'PORT', 'ASSIGNE', 'DISPATCHE', 'TRANSIT', 'BAMAKO', 'RETURNED'];

/**
 * Table des transitions autorisees. Chaque clef = statut de depart,
 * valeur = liste des statuts d'arrivee autorises.
 */
var TRANSITIONS: Record<TcStatus, TcStatus[]> = {
  ATTENDU: ['PORT'],
  PORT: ['ASSIGNE', 'DISPATCHE'],       // DISPATCHE direct = "chargement immediat"
  ASSIGNE: ['DISPATCHE', 'PORT'],       // PORT = annulation assignation
  DISPATCHE: ['TRANSIT', 'RETURNED'],   // RETURNED pour dossier Dakar local
  TRANSIT: ['BAMAKO', 'RETURNED'],
  BAMAKO: ['RETURNED'],
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
