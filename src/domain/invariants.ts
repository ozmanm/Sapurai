/**
 * Sprint 40 F40.4 - Invariants metier centralises.
 *
 * Source de verite unique pour les regles qui decident si une transition TC ou
 * un statut dossier est valide. Avant ce sprint, ces regles etaient dispersees
 * dans `useConteneurActions.dispatch/advance`, `utils/dossierStatus.computeDossierStatus`,
 * `components/dossiers/DetView.tsx` (timeline) et chaque sync (DPWorld/CMA/Carrier).
 *
 * Resultat : un dossier pouvait etre EN_TRANSIT alors que la date d'arrivee
 * du navire (`dos.da`) etait dans le futur. Ce module l'empeche.
 *
 * API publique :
 *  - `canDispatchTc(tc, dos)` : autoriser ou non un dispatch (PORT -> DISPATCHE)
 *  - `canAdvanceTc(tc, dos, ns)` : autoriser ou non une transition de statut TC
 *  - `deriveDossierStatus(dos, tcs)` : calcule le statut dossier en prenant
 *    `da` ET les statuts TC en compte (au lieu de juste tc.st)
 *  - `reconcileDossierState(dos, tcs)` : applique tout (a appeler apres save/sync)
 */

import type { Dossier, Conteneur } from '../types';
import type { DossierStatus, TcStatus } from './statuses';
import { canTcTransition } from './tcStateMachine';

export interface InvariantResult {
  ok: boolean;
  reason?: string;
}

var TRANSIT_STATES: TcStatus[] = ['DISPATCHE', 'TRANSIT', 'KATI', 'BAMAKO'];

/**
 * Indique si la date d'arrivee du dossier est dans le futur (navire pas encore arrive).
 * Compare au jour pres (ignore l'heure).
 */
export function isDaFuture(dos: Dossier | null | undefined): boolean {
  if (!dos || !dos.da) return false;
  var arrivee = new Date(dos.da);
  arrivee.setHours(0, 0, 0, 0);
  var aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return arrivee.getTime() > aujourdhui.getTime();
}

/**
 * Indique si un TC peut etre dispatche (PORT -> DISPATCHE).
 * Pre-requis :
 *  - tc.st === 'PORT' (le TC est au port)
 *  - dos.da n'est pas dans le futur (le navire est effectivement arrive)
 *  - dos a une autorisation de sortie : BAE obtenu OU Pregate (pn) presente
 */
export function canDispatchTc(tc: Conteneur | null | undefined, dos: Dossier | null | undefined): InvariantResult {
  if (!tc || !dos) return { ok: false, reason: 'TC ou dossier manquant' };
  if (tc.st !== 'PORT') return { ok: false, reason: 'TC doit etre au port (actuel: ' + (tc.st || 'inconnu') + ')' };
  if (isDaFuture(dos)) return { ok: false, reason: "Date d'arrivee " + dos.da + " encore dans le futur — TC ne peut pas etre dispatche" };
  if (!dos.pn && dos.as2 !== 'OBTENU') return { ok: false, reason: 'BAE ou Pregate requis avant dispatch' };
  return { ok: true };
}

/**
 * Indique si un TC peut transiter du statut courant `tc.st` vers `ns`.
 * Combine la machine d'etat (transitions autorisees) avec les regles
 * de coherence date :
 *  - PORT : interdit si dos.da est dans le futur
 *  - DISPATCHE : interdit si dos.da est dans le futur (et meme regles que canDispatchTc
 *    si on passe par advance directement)
 */
export function canAdvanceTc(
  tc: Conteneur | null | undefined,
  dos: Dossier | null | undefined,
  ns: string,
): InvariantResult {
  if (!tc || !dos) return { ok: false, reason: 'TC ou dossier manquant' };
  var transitionCheck = canTcTransition(tc.st || null, ns);
  if (!transitionCheck.valid) {
    return { ok: false, reason: transitionCheck.reason || 'Transition non autorisee' };
  }
  // Regle date : PORT et DISPATCHE necessitent que le navire soit arrive
  if ((ns === 'PORT' || ns === 'DISPATCHE') && isDaFuture(dos)) {
    return {
      ok: false,
      reason: "Date d'arrivee " + dos.da + " encore dans le futur — TC ne peut pas passer en " + ns,
    };
  }
  // Pour DISPATCHE on revalide aussi les prerequis dispatch (BAE/Pregate + tc.st === 'PORT')
  if (ns === 'DISPATCHE') {
    var dispatchCheck = canDispatchTc(tc, dos);
    if (!dispatchCheck.ok) return dispatchCheck;
  }
  return { ok: true };
}

/**
 * Calcule le statut dossier attendu en prenant en compte `da` ET les statuts TC.
 *
 * Regle prioritaire Sprint 40 : si `da` est dans le futur, le dossier est
 * FORCEMENT en INITIALISE peu importe les `tc.st` (qui peuvent etre incoherents
 * a cause de saisies passees).
 *
 * Sinon, applique la logique existante de `computeDossierStatus` :
 *  - INITIALISE : tous TC ATTENDU ou aucun TC
 *  - EN_TRANSIT : tous TC actifs en DISPATCHE/TRANSIT/KATI/BAMAKO
 *  - SECURISE   : au moins un TC en PORT
 *
 * CLOTURE / ARCHIVE : statuts manuels, jamais ecrases.
 *
 * Retourne `null` si le statut ne doit pas changer (pratique pour `reconcile`).
 */
export function deriveDossierStatus(
  dos: Dossier,
  dosTcs: Conteneur[],
): DossierStatus | null {
  // Statuts manuels : on n'ecrase jamais
  if (dos.st === 'CLOTURE' || dos.st === 'ARCHIVE') return null;
  if (!dosTcs || dosTcs.length === 0) return null;

  // Sprint 40 F40.4 : si da est dans le futur, forcer INITIALISE
  // (peu importe les tc.st qui peuvent etre incoherents).
  if (isDaFuture(dos)) {
    return dos.st !== 'INITIALISE' ? 'INITIALISE' : null;
  }

  var atPort = dosTcs.filter(function (c) { return c.st === 'PORT'; }).length;
  var inTransit = dosTcs.filter(function (c) { return TRANSIT_STATES.indexOf(c.st as TcStatus) >= 0; }).length;
  var attendu = dosTcs.filter(function (c) { return c.st === 'ATTENDU'; }).length;
  var returned = dosTcs.filter(function (c) { return c.st === 'RETURNED'; }).length;

  if (attendu === dosTcs.length) {
    return dos.st !== 'INITIALISE' ? 'INITIALISE' : null;
  }

  var actifs = dosTcs.length - returned;
  if (actifs > 0 && inTransit === actifs && atPort === 0) {
    return dos.st !== 'EN_TRANSIT' ? 'EN_TRANSIT' : null;
  }

  if (atPort > 0) {
    return dos.st !== 'SECURISE' ? 'SECURISE' : null;
  }

  return null;
}

/**
 * Reconcilie l'etat d'un dossier ET de ses TC apres une operation
 * (save, sync DPWorld/CMA, edit date `da`, dispatch, advance).
 *
 * - Recalcule le statut dossier via `deriveDossierStatus`
 * - Si `da` est dans le futur, retro-pose les TC en ATTENDU (ils n'auraient
 *   jamais du etre marques PORT/DISPATCHE/etc. — incoherence detectee)
 *
 * Retourne la nouvelle liste de dossiers et de TC. Si rien ne change, retourne
 * les memes references (pas de re-render inutile).
 */
export interface ReconcileOptions {
  /** Si true, retrograde les TC incoherents (PORT/DISPATCHE/... avec da future) en ATTENDU. */
  fixTcStatusOnFutureDa?: boolean;
}

export function reconcileDossierState(
  dosList: Dossier[],
  tcsList: Conteneur[],
  options: ReconcileOptions = {},
): { dos: Dossier[]; tcs: Conteneur[] } {
  var newDos = dosList;
  var newTcs = tcsList;
  var fixTcs = options.fixTcStatusOnFutureDa !== false;  // defaut true

  // Etape 1 : si da future + fixTcs, retrograder les TC incoherents en ATTENDU
  if (fixTcs) {
    var futureDosIds: Record<string, true> = {};
    dosList.forEach(function (d) {
      if (isDaFuture(d) && d.st !== 'CLOTURE' && d.st !== 'ARCHIVE') {
        futureDosIds[d.id] = true;
      }
    });
    var hasIncoherentTc = tcsList.some(function (tc) {
      return tc.did && futureDosIds[tc.did] && tc.st && tc.st !== 'ATTENDU';
    });
    if (hasIncoherentTc) {
      newTcs = tcsList.map(function (tc) {
        if (tc.did && futureDosIds[tc.did] && tc.st && tc.st !== 'ATTENDU') {
          // Retrograder en ATTENDU + clear les dates de sortie si presentes
          var fixed: any = Object.assign({}, tc, { st: 'ATTENDU' });
          delete fixed.dsp;
          delete fixed.dtk;
          delete fixed.dak;
          delete fixed.dab;
          delete fixed.dr;
          return fixed;
        }
        return tc;
      });
    }
  }

  // Etape 2 : recalculer le statut dossier
  var anyDosChanged = false;
  var nextDos = newDos.map(function (d) {
    var dosTcs = newTcs.filter(function (t) { return t.did === d.id; });
    var newSt = deriveDossierStatus(d, dosTcs);
    if (newSt && newSt !== d.st) {
      anyDosChanged = true;
      return Object.assign({}, d, { st: newSt });
    }
    return d;
  });
  if (anyDosChanged) newDos = nextDos;

  return { dos: newDos, tcs: newTcs };
}
