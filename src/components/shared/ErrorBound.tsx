import React from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundProps {
  children?: ReactNode;
  onClose?: () => void;
}

interface ErrorBoundState {
  err: Error | null;
}

class ErrorBound extends React.Component<ErrorBoundProps, ErrorBoundState> {
  constructor(props: ErrorBoundProps) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err: err }; }
  render() {
    if (this.state.err) {
      return React.createElement("div", { style: { padding: 20, textAlign: "center" } },
        React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u26A0\uFE0F"),
        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#991b1b", marginBottom: 8 } }, "Erreur d'affichage"),
        React.createElement("div", { style: { fontSize: 13, color: "#78716c", marginBottom: 12, fontFamily: "var(--font-mono)", background: "#fef2f2", padding: 12, borderRadius: 8, textAlign: "left", wordBreak: "break-all" } }, String(this.state.err.message || this.state.err)),
        React.createElement("button", { onClick: () => { this.setState({ err: null }); if (this.props.onClose) this.props.onClose(); }, style: { background: "#1c1917", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" } }, "Fermer")
      );
    }
    return this.props.children;
  }
}

export default ErrorBound;
