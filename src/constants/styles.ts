// Styles partages pour les formulaires
// IS = Input Style, LS = Label Style
import type { CSSProperties } from 'react';

export var IS: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  minHeight: 44,
  background: "var(--bg-secondary)",
  color: "var(--text-input)",
};

export var LS: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  marginBottom: 4,
};
