// src/services/assembleData.ts
//
// Phase C C1 : reducer PUR qui assemble la forme `data` consommee par l'app a partir de
// l'enveloppe (doc mono : cfg/name/status/... + arrays residuels) et des arrays issus des
// sous-collections (lecture Phase C). La forme de sortie est IDENTIQUE au doc mono Phase A,
// pour que les composants ne sachent rien de la bascule (transparence consumer).
//
// Testable hors React/Firestore. SUB_KEYS vient de dualwrite (source de verite UNIQUE du
// mapping sous-collection ; cf. SUBCOLLECTIONS) — le test neutralise l'import firebase
// transitif via des mocks vides (assembleData n'appelle aucune fonction firebase).

import { SUB_KEYS } from './dualwrite';

/* eslint-disable @typescript-eslint/no-explicit-any -- formes `data` arbitraires (mono loose) */

/**
 * Combine l'enveloppe mono avec les arrays issus des sous-collections.
 *
 * IMPORTANT — semantique `!== undefined` (NE PAS "simplifier" en `||`) :
 *  - subArrays[k] === undefined  -> listener sub PAS encore fire -> fallback sur l'array de
 *    l'enveloppe mono (dual-ecrit, en phase). Evite un flicker vers vide a l'hydratation.
 *  - subArrays[k] === []         -> listener fire et legitimement VIDE -> precedence sub.
 * Le `||` marcherait par accident sur des arrays (truthy) mais effacerait la distinction
 * "pas charge" vs "charge vide" -> garder `!== undefined` explicite.
 */
export function assembleData(
  envelope: Record<string, any> | null,
  subArrays: Record<string, any[] | undefined>,
): Record<string, any> {
  var base = envelope || {};
  var out: Record<string, any> = Object.assign({}, base);
  SUB_KEYS.forEach(function (k) {
    out[k] = subArrays[k] !== undefined ? subArrays[k] : (base[k] || []);
  });
  return out;
}

/**
 * Extrait les 5 arrays d'un objet `data`. Sert au listener mono (flag-on) a CONSERVER les
 * arrays courants — possedes par les sub-listeners — au lieu de les ecraser avec l'enveloppe.
 * `undefined` par cle absente (et donc fallback sur l'enveloppe cote assembleData).
 */
export function extractArrays(data: Record<string, any> | null): Record<string, any[] | undefined> {
  var out: Record<string, any[] | undefined> = {};
  SUB_KEYS.forEach(function (k) { out[k] = data ? data[k] : undefined; });
  return out;
}
