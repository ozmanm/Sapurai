var FEATURES = [
  { ic: "📦", title: "Suivi conteneurs", desc: "Suivez chaque TC de Port a Bamako avec alertes franchises en temps reel." },
  { ic: "💰", title: "Depenses & impaye", desc: "Enregistrez HT/TTC, marquez les paiements, visualisez l'impaye instantanement." },
  { ic: "📲", title: "Partage client QR", desc: "Generez un lien + QR code que le client scanne pour voir ses conteneurs." },
];

interface OnboardingModalProps {
  companyName?: string;
  onClose: () => void;
}

function OnboardingModal(p: OnboardingModalProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-primary)", borderRadius: 20, maxWidth: 420, width: "100%", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div style={{ background: "var(--btn-primary-bg)", padding: "28px 28px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{"🚢"}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: 0.5 }}>{"Bienvenue sur Sapurai"}</div>
          {p.companyName ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>{p.companyName}</div> : null}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 8, lineHeight: 1.5 }}>{"La plateforme de gestion de transit intelligente."}</div>
        </div>

        {/* Features */}
        <div style={{ padding: "20px 24px 8px" }}>
          {FEATURES.map(function (f) {
            return (
              <div key={f.ic} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: 24, flexShrink: 0, width: 36, textAlign: "center" }}>{f.ic}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ padding: "16px 24px 24px" }}>
          <button
            onClick={p.onClose}
            style={{ width: "100%", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 12, padding: "15px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", minHeight: 52 }}
          >
            {"C'est parti \u2192"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default OnboardingModal;
