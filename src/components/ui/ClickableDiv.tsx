import type { CSSProperties, ReactNode, KeyboardEvent, MouseEvent } from 'react';

/**
 * Div cliquable accessible au clavier.
 *
 * Resout le finding #4 de l'audit a11y : 77 <div onClick> dans le code
 * n'avaient ni role="button", ni tabindex, ni support Enter/Space.
 * Consequence : un utilisateur keyboard-only ne pouvait pas activer ces
 * elements (urgences, cards cliquables, rows de liste).
 *
 * Usage :
 *   // Avant
 *   <div onClick={handleClick} style={...}>...</div>
 *
 *   // Apres
 *   <ClickableDiv onClick={handleClick} label="Voir le dossier" style={...}>
 *     ...
 *   </ClickableDiv>
 *
 * Alternative : convertir en <button> quand la semantique permet. Ce
 * composant sert quand <button> n'est pas possible (element qui doit etre
 * un div pour des raisons de layout / nesting autorise / styles).
 */

interface ClickableDivProps {
  onClick: (e?: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
  label?: string;          // aria-label, requis si le contenu n'est pas descriptif
  style?: CSSProperties;
  className?: string;
  disabled?: boolean;
  stopPropagation?: boolean; // si true, arrete la propagation au parent (clic imbrique)
  title?: string;
}

export default function ClickableDiv(p: ClickableDivProps) {
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (p.disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (p.stopPropagation) e.stopPropagation();
      p.onClick();
    }
  }
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (p.disabled) return;
    if (p.stopPropagation) e.stopPropagation();
    p.onClick(e);
  }
  return (
    <div
      role="button"
      tabIndex={p.disabled ? -1 : 0}
      aria-label={p.label}
      aria-disabled={p.disabled}
      title={p.title}
      onClick={handleClick}
      onKeyDown={onKey}
      style={Object.assign({ cursor: p.disabled ? 'default' : 'pointer' }, p.style || {})}
      className={p.className}
    >
      {p.children}
    </div>
  );
}
