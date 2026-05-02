import type { CSSProperties, ReactNode } from 'react';

interface BadgeProps {
  variant?: string;
  bg?: string;
  color?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

var BASE = {
  display: 'inline-flex', alignItems: 'center',
  padding: '2px 8px', borderRadius: 5,
  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
};

var VARIANTS = {
  success:  { background: 'var(--success-light)', color: 'var(--success-text)' },
  danger:   { background: 'var(--danger-bg)', color: 'var(--danger)' },
  warning:  { background: 'var(--warning-bg)', color: 'var(--warning-text)' },
  info:     { background: 'var(--info-bg)', color: 'var(--info)' },
  purple:   { background: 'var(--purple-bg)', color: 'var(--purple)' },
  neutral:  { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
};

export default function Badge(p: BadgeProps) {
  var variant = VARIANTS[p.variant || 'neutral'] || VARIANTS.neutral;
  var style = Object.assign({}, BASE, variant, p.style || {});

  if (p.bg) style.background = p.bg;
  if (p.color) style.color = p.color;

  return <span style={style}>{p.children}</span>;
}
