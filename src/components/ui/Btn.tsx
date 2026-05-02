import type { CSSProperties, ReactNode } from 'react';

interface BtnProps {
  variant?: string;
  size?: string;
  disabled?: boolean;
  type?: 'button' | 'reset' | 'submit';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
  children?: ReactNode;
}

var BASE = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  border: 'none', borderRadius: 8, padding: '10px 16px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44, minWidth: 44,
  transition: 'opacity .15s',
};

var VARIANTS = {
  primary:  { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' },
  success:  { background: 'var(--success)', color: 'white' },
  danger:   { background: 'var(--danger)', color: 'white' },
  warning:  { background: 'var(--warning)', color: 'white' },
  ghost:    { background: 'transparent', color: 'var(--btn-ghost-text)', border: '1px solid var(--btn-ghost-border)' },
  link:     { background: 'none', color: 'var(--btn-link)', padding: 0, minHeight: 'auto', minWidth: 'auto' },
};

var SIZES = {
  sm: { padding: '6px 10px', fontSize: 12, minHeight: 32, minWidth: 32 },
  md: {},
  lg: { padding: '12px 20px', fontSize: 14, minHeight: 48 },
};

export default function Btn(p: BtnProps) {
  var variant = VARIANTS[p.variant || 'primary'] || VARIANTS.primary;
  var size = SIZES[p.size || 'md'] || {};
  var style = Object.assign({}, BASE, variant, size, p.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}, p.style || {});

  return (
    <button
      type={p.type || 'button'}
      className={'lt-btn ' + (p.className || '')}
      style={style}
      onClick={p.disabled ? undefined : p.onClick}
      disabled={p.disabled}
      aria-label={p.ariaLabel}
    >
      {p.children}
    </button>
  );
}
