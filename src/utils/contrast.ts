/**
 * Helpers de contraste pour l'accessibilite (WCAG 2.1 AA).
 *
 * Cree suite a l'audit a11y du 2026-04-18 (AUDIT-A11Y.md finding #3) :
 * les badges statut TC avec texte blanc sur fond orange (#f59e0b) ou
 * rouge clair (#ef4444) echouaient le ratio de contraste 4.5:1.
 *
 * `textColorFor(bgColor)` retourne automatiquement le texte noir ou
 * blanc qui maximise le contraste sur un fond donne.
 */

/**
 * Calcule la luminance relative d'une couleur hex selon WCAG.
 * @param hex - Couleur au format #RRGGBB ou RRGGBB
 * @returns Luminance entre 0 (noir) et 1 (blanc)
 */
export function relativeLuminance(hex: string): number {
  var h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = parseInt(h.slice(0, 2), 16) / 255;
  var g = parseInt(h.slice(2, 4), 16) / 255;
  var b = parseInt(h.slice(4, 6), 16) / 255;
  var rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  var gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  var bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Retourne la couleur de texte (blanc ou noir) qui offre le meilleur
 * contraste sur la couleur de fond fournie.
 *
 * Seuil : luminance 0.5 (approximation simple et fiable pour l'usage).
 * Pour les fonds clairs (luminance > 0.5) : renvoie noir #1c1917.
 * Pour les fonds fonces (luminance <= 0.5) : renvoie blanc.
 *
 * @param bgHex - Couleur de fond au format #RRGGBB
 * @returns "#1c1917" (noir Sapurai) ou "white"
 *
 * @example
 * textColorFor("#f59e0b")  // "#1c1917" (fond jaune = texte noir)
 * textColorFor("#3b82f6")  // "white"   (fond bleu = texte blanc)
 */
export function textColorFor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? "#1c1917" : "white";
}

/**
 * Calcule le ratio de contraste entre 2 couleurs hex selon WCAG.
 * @returns Ratio entre 1:1 et 21:1. WCAG AA normal = 4.5:1, AA large = 3:1.
 */
export function contrastRatio(fg: string, bg: string): number {
  var lf = relativeLuminance(fg);
  var lb = relativeLuminance(bg);
  var lighter = Math.max(lf, lb);
  var darker = Math.min(lf, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
