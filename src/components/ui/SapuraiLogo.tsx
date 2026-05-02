import type { CSSProperties } from 'react';

/**
 * Logo Sapurai (Sprint 1 refonte design — Logo A retenu).
 * Carre arrondi noir, "S" tracé comme une route avec pointillés ambre (#fbbf24)
 * = clin d'oeil supply chain + samourai.
 *
 * @param size      Taille du texte (px). Le carré logo prend size+2.
 * @param color     Couleur du fond (defaut : noir #0a0a09). Pour mode clair.
 * @param showText  Affiche "Sapurai" à droite (defaut : true).
 * @param style     Override CSS optionnel.
 */
interface SapuraiLogoProps {
  size?: number;
  color?: string;
  showText?: boolean;
  style?: CSSProperties;
}

function SapuraiLogo({ size = 14, color = "#0a0a09", showText = true, style }: SapuraiLogoProps) {
  var m = size + 2;
  var d = "M 42 12 C 42 12, 14 12, 14 22 C 14 30, 42 30, 42 38 C 42 48, 14 48, 14 48";
  var rootStyle: CSSProperties = Object.assign(
    {
      display: "inline-flex" as const,
      alignItems: "center" as const,
      gap: 6,
      color: color,
      fontSize: size,
      fontWeight: 700,
      letterSpacing: "-0.01em",
      fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
    },
    style || {},
  );
  return (
    <span style={rootStyle} aria-label="Sapurai">
      <svg width={m} height={m} viewBox="0 0 56 60" fill="none" aria-hidden="true">
        <rect width="56" height="60" rx="12" fill={color} />
        <path d={d} stroke="#ffffff" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d={d} stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" fill="none" strokeDasharray="2.2 3.5" />
      </svg>
      {showText ? <span>Sapurai</span> : null}
    </span>
  );
}

export default SapuraiLogo;
