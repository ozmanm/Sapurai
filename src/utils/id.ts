/**
 * Genere un identifiant unique court (ex: "xm5k2a9z")
 */
export function mid(): string {
  return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
