import type { Dossier, Conteneur } from '../types';

/**
 * Calcul du statut attendu d'un dossier selon l'etat de ses TC.
 *
 * Regles metier :
 *  - INITIALISE : aucun TC encore au port (tous ATTENDU ou pas de TC)
 *  - SECURISE   : au moins un TC est arrive a Dakar (PORT) mais pas tous dispatches
 *  - EN_TRANSIT : tous les TC actifs sont effectivement en transit (DISPATCHE,
 *                 TRANSIT, BAMAKO) et au moins un l'est
 *  - CLOTURE / ARCHIVE : statuts manuels, jamais ecrases par le calcul auto
 *
 * Retourne `null` si le statut ne doit PAS changer (eg. dossier deja CLOTURE
 * ou aucun changement detecte).
 */

// Sprint 46 : KATI retire, ASSIGNE non inclus (TC encore au port)
var TRANSIT_STATES = ["DISPATCHE", "TRANSIT", "BAMAKO"];

export function computeDossierStatus(
  dos: Dossier,
  dosTcs: Conteneur[],
): string | null {
  // Statuts manuels : on n'ecrase jamais
  if (dos.st === "CLOTURE" || dos.st === "ARCHIVE") return null;
  if (dosTcs.length === 0) return null;

  // Sprint 40 F40.5 - si da est dans le futur, le dossier reste INITIALISE
  // peu importe les tc.st (qui peuvent etre incoherents). Cf. invariants.ts.
  if (dos.da) {
    var arr = new Date(dos.da); arr.setHours(0, 0, 0, 0);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    if (arr.getTime() > today.getTime()) {
      return dos.st !== "INITIALISE" ? "INITIALISE" : null;
    }
  }

  // Sprint 46 : PORT et ASSIGNE comptent tous deux comme "au port"
  var atPort = dosTcs.filter(function (c) { return c.st === "PORT" || c.st === "ASSIGNE"; }).length;
  var inTransit = dosTcs.filter(function (c) { return TRANSIT_STATES.indexOf(c.st) >= 0; }).length;
  var attendu = dosTcs.filter(function (c) { return c.st === "ATTENDU"; }).length;
  var returned = dosTcs.filter(function (c) { return c.st === "RETURNED"; }).length;

  // Tous attendus => INITIALISE (pas encore arrive)
  if (attendu === dosTcs.length) {
    return dos.st !== "INITIALISE" ? "INITIALISE" : null;
  }

  // Tous les TC actifs sont en transit (et au moins un l'est) => EN_TRANSIT
  // (RETURNED compte aussi : un TC retourne est passe en transit puis revenu)
  var actifs = dosTcs.length - returned;
  if (actifs > 0 && inTransit === actifs && atPort === 0) {
    return dos.st !== "EN_TRANSIT" ? "EN_TRANSIT" : null;
  }

  // Au moins un TC au port => SECURISE
  if (atPort > 0) {
    return dos.st !== "SECURISE" ? "SECURISE" : null;
  }

  return null;
}

/**
 * Applique le statut auto sur une liste de dossiers. Pratique pour les
 * actions qui modifient plusieurs dossiers ou plusieurs TC en batch.
 */
export function applyAutoStatus(
  dosList: Dossier[],
  tcsList: Conteneur[],
): Dossier[] {
  return dosList.map(function (d) {
    var dosTcs = tcsList.filter(function (t) { return t.did === d.id; });
    var newSt = computeDossierStatus(d, dosTcs);
    if (newSt && newSt !== d.st) {
      return Object.assign({}, d, { st: newSt });
    }
    return d;
  });
}
