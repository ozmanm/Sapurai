import type { CSSProperties, ReactNode } from 'react';

/**
 * EmptyState — composant unifie pour les ecrans vides (Sprint E.6 handoff).
 *
 * Usage typique :
 *   <EmptyState
 *     icon="📦"
 *     title="Aucun dossier"
 *     description="Creez votre premier dossier de transit pour demarrer."
 *     action={<button onClick={...}>+ Creer un dossier</button>}
 *   />
 *
 * Variant `compact` : pour les listes vides dans les tableaux/cards (padding reduit).
 * Variant `error`  : fond danger, bordure orange (utilise dans ErrorBound).
 */

interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'compact' | 'error';
  style?: CSSProperties;
}

export default function EmptyState(p: EmptyStateProps) {
  var variant = p.variant || 'default';
  var compact = variant === 'compact';
  var isError = variant === 'error';

  var rootStyle: CSSProperties = Object.assign({
    background: isError ? 'var(--danger-bg)' : 'var(--bg-primary)',
    border: '1px solid ' + (isError ? 'var(--danger-border)' : 'var(--border)'),
    borderRadius: compact ? 8 : 12,
    padding: compact ? '20px 16px' : '40px 24px',
    textAlign: 'center' as const,
    fontFamily: 'var(--font-sans)',
  }, p.style || {});

  var iconStyle: CSSProperties = {
    fontSize: compact ? 28 : 44,
    marginBottom: compact ? 8 : 14,
    lineHeight: 1,
    opacity: isError ? 1 : 0.85,
  };

  var titleStyle: CSSProperties = {
    fontSize: compact ? 14 : 17,
    fontWeight: 600,
    color: isError ? 'var(--danger-text)' : 'var(--text-primary)',
    marginBottom: 6,
    letterSpacing: '-0.01em',
  };

  var descStyle: CSSProperties = {
    fontSize: compact ? 12 : 13,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    maxWidth: 380,
    margin: '0 auto',
  };

  return (
    <div style={rootStyle}>
      {p.icon ? <div style={iconStyle} aria-hidden="true">{p.icon}</div> : null}
      <div style={titleStyle}>{p.title}</div>
      {p.description ? <div style={descStyle}>{p.description}</div> : null}
      {p.action ? <div style={{ marginTop: compact ? 12 : 18, display: 'inline-flex', gap: 8 }}>{p.action}</div> : null}
    </div>
  );
}
