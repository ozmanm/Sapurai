interface BilanViewProps {
  dos: any[];
  tcs: any[];
  dep: any[];
  urgences: any[];
  alertes: any[];
}

function BilanView(p: BilanViewProps) {
  var enCours = p.dos.filter(function (d) { return d.st !== "CLOTURE" && d.st !== "ARCHIVE"; }).length;
  var clotures = p.dos.filter(function (d) { return d.st === "CLOTURE"; }).length;
  var attendu = p.tcs.filter(function (c) { return c.st === "ATTENDU"; }).length;
  var atPort = p.tcs.filter(function (c) { return c.st === "PORT"; }).length;
  var inTransit = p.tcs.filter(function (c) { return c.st !== "PORT" && c.st !== "ATTENDU" && c.st !== "RETURNED"; }).length;
  var returned = p.tcs.filter(function (c) { return c.st === "RETURNED"; }).length;
  var payees = p.dep.filter(function (f) { return f.s === "PAYE"; }).length;
  var impayees = p.dep.filter(function (f) { return f.s !== "PAYE"; }).length;
  var critiques = p.urgences.filter(function (u) { return u.level === "critical"; }).length;
  var warnings = p.urgences.filter(function (u) { return u.level === "warning"; }).length;
  var ok = critiques === 0 && warnings === 0;
  return (
    <div>
      <div style={{ textAlign: "center", padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 40 }}>{ok ? "\u2705" : "\u26A0\uFE0F"}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, color: ok ? "var(--success-text)" : "var(--warning-text)" }}>{ok ? "Tout est sous controle" : String(critiques + warnings) + " point(s) a regler"}</div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{"Situation actuelle"}</div>
      <div className="lt-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{"DOSSIERS"}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{String(enCours) + " en cours"}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{String(clotures) + " cloture(s)"}</div></div>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{"CONTENEURS"}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{(attendu > 0 ? String(attendu) + " attendu | " : "") + String(atPort) + " port | " + String(inTransit) + " transit | " + String(returned) + " ret."}</div></div>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{"DEPENSES"}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{String(payees) + " payee(s) | " + String(impayees) + " impayee(s)"}</div></div>
        <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{"FRANCHISES"}</div><div style={{ fontSize: 12, fontWeight: 700, color: p.alertes.length > 0 ? "var(--danger)" : "var(--success)" }}>{p.alertes.length > 0 ? String(p.alertes.length) + " alerte(s)" : "Aucune alerte"}</div></div>
      </div>
      {critiques > 0 || warnings > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{"A regler demain"}</div>
          {p.urgences.map(function (u, i) { return <div key={i} style={{ background: u.level === "critical" ? "var(--danger-light)" : "var(--warning-bg)", borderRadius: 8, padding: 8, marginBottom: 4, fontSize: 12, fontWeight: 600, color: u.level === "critical" ? "var(--danger-text)" : "var(--warning-text)" }}>{u.cat + " " + u.msg + " - " + u.sub}</div>; })}
        </div>
      ) : null}
      <div style={{ textAlign: "center", padding: 16, background: "var(--success-bg)", borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success-text)" }}>{"Bonne fin de journee!"}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{"Tout est sauvegarde."}</div>
      </div>
    </div>
  );
}

export default BilanView;
