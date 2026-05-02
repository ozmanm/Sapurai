import type { CSSProperties, ReactNode } from 'react';
import { IS, LS } from '../../constants/styles.js';

interface FormFieldProps {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  value?: string | number;
  onChange?: (e: any) => void;
  placeholder?: string;
  disabled?: boolean;
  inputStyle?: CSSProperties;
  style?: CSSProperties;
  hint?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  children?: ReactNode;
}

export default function FormField(p: FormFieldProps) {
  var id = p.id || p.name || '';
  var inputStyle = Object.assign({}, IS, p.inputStyle || {});

  return (
    <div style={p.style || {}}>
      {p.label ? <label htmlFor={id} style={LS}>{p.label}</label> : null}
      {p.type === 'select' ? (
        <select id={id} name={p.name} value={p.value} onChange={p.onChange} style={inputStyle} disabled={p.disabled}>
          {p.children}
        </select>
      ) : p.type === 'textarea' ? (
        <textarea id={id} name={p.name} value={p.value} onChange={p.onChange} placeholder={p.placeholder} rows={p.rows || 3} style={inputStyle} disabled={p.disabled} />
      ) : (
        <input id={id} name={p.name} type={p.type || 'text'} value={p.value} onChange={p.onChange} placeholder={p.placeholder} style={inputStyle} disabled={p.disabled} min={p.min} max={p.max} step={p.step} />
      )}
      {p.hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.hint}</div> : null}
    </div>
  );
}
