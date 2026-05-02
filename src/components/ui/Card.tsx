import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  variant?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children?: ReactNode;
}

var BASE = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '12px 14px',
};

var VARIANTS = {
  default:  {},
  flat:     { border: 'none', background: 'var(--bg-tertiary)' },
  success:  { background: 'var(--success-bg)', border: '1px solid var(--success-border)' },
  warning:  { background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' },
  danger:   { background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' },
  info:     { background: 'var(--info-bg)', border: '1px solid var(--info-border)' },
};

export default function Card(p: CardProps) {
  var variant = VARIANTS[p.variant || 'default'] || VARIANTS.default;
  var style = Object.assign({}, BASE, variant, p.style || {});

  return (
    <div className={p.className || ''} style={style} onClick={p.onClick}>
      {p.title ? <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{p.title}</div> : null}
      {p.children}
    </div>
  );
}
