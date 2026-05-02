import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface OverlayProps {
  close: () => void;
  title: string;
  w?: number;
  children?: ReactNode;
}

// Id unique pour chaque instance (aria-labelledby)
var overlayIdCounter = 0;

function Overlay(p: OverlayProps) {
  var overlayRef = useRef(null);
  var titleId = useRef("overlay-title-" + (++overlayIdCounter));

  // Close on Escape key
  useEffect(function () {
    function onKey(e) { if (e.key === "Escape") p.close(); }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
  }, [p.close]);

  // Trap focus inside modal
  useEffect(function () {
    if (overlayRef.current) {
      var first = overlayRef.current.querySelector("button, input, select, textarea, [tabindex]");
      if (first) first.focus();
    }
  }, []);

  return (
    <div onClick={p.close} role="dialog" aria-modal="true" aria-labelledby={titleId.current} style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
      <div ref={overlayRef} className="lt-overlay-inner" onClick={function (e) { e.stopPropagation(); }} style={{ background: "var(--bg-primary)", borderRadius: 14, width: "100%", maxWidth: p.w || 700, maxHeight: "94vh", overflow: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 id={titleId.current} style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{p.title || "Dialogue"}</h2>
          <button onClick={p.close} aria-label="Fermer le dialogue" style={{ background: "var(--bg-secondary)", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>{"x"}</button>
        </div>
        {p.children}
      </div>
    </div>
  );
}

export default Overlay;
