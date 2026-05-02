// Validation d'input — utilitaires
// validate(value, rules) -> null si OK, sinon message d'erreur
import React from 'react';
import type { ValidationRules, ValidateAllResult } from '../types';

/**
 * Valide une valeur selon les regles fournies.
 * Retourne null si OK, sinon un message d'erreur.
 */
export function validate(value: string | number | null | undefined, rules: ValidationRules): string | null {
  var v: string | number | null | undefined = typeof value === 'string' ? value.trim() : value;
  if (rules.required && (v === '' || v === null || v === undefined)) {
    return 'Ce champ est requis';
  }
  if (typeof v === 'string' && v.length > 0) {
    if (rules.maxLen && v.length > rules.maxLen) {
      return 'Maximum ' + rules.maxLen + ' caracteres';
    }
    if (rules.pattern && !rules.pattern.test(v)) {
      return rules.patternMsg || 'Format invalide';
    }
  }
  if (rules.minVal !== undefined || rules.maxVal !== undefined) {
    var n = typeof v === 'number' ? v : parseFloat(v as string);
    if (!isNaN(n)) {
      if (rules.minVal !== undefined && n < rules.minVal) {
        return 'Minimum ' + rules.minVal;
      }
      if (rules.maxVal !== undefined && n > rules.maxVal) {
        return 'Maximum ' + rules.maxVal;
      }
    }
  }
  return null;
}

/**
 * Valide plusieurs champs d'un coup.
 */
export function validateAll(fields: Record<string, [string | number | null | undefined, ValidationRules]>): ValidateAllResult {
  var errors: Record<string, string> = {};
  var firstError: string | null = null;
  for (var key in fields) {
    var entry = fields[key];
    var err = validate(entry[0], entry[1]);
    if (err) {
      errors[key] = err;
      if (!firstError) firstError = key + ' : ' + err;
    }
  }
  return { errors: errors, hasErrors: Object.keys(errors).length > 0, firstError: firstError };
}

/**
 * Composant d'erreur inline sous un champ.
 *
 * Pour l'accessibilite : si `id` est fourni, le div recoit `id={id}` et
 * `role="alert"`. L'input associe peut alors utiliser :
 *   aria-invalid={!!msg} aria-describedby={msg ? id : undefined}
 *
 * Sans id fourni, le composant garde le comportement legacy (compatible).
 */
export function FieldError(p: { msg?: string | null; id?: string }): React.ReactElement | null {
  if (!p.msg) return null;
  var props: any = { style: { fontSize: 11, color: 'var(--danger)', marginTop: 3, fontWeight: 500 } };
  if (p.id) { props.id = p.id; props.role = 'alert'; }
  return React.createElement('div', props, p.msg);
}
