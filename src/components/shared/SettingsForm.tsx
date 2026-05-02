import { useState, lazy, Suspense } from 'react';

// TeamPanel charge en lazy — pas necessaire sauf si l'admin ouvre le tab Equipe
var TeamPanel = lazy(function () { return import('../../TeamPanel.tsx'); });

interface TeamProps {
  members: any[];
  currentUid: string;
  createInvite: (role: string, email: string, assignments?: any[], responsabilites?: string) => Promise<string>;
  addMemberByEmail: (email: string, role: string, name?: string) => Promise<string>;
  updateMemberRole: (uid: string, role: string) => Promise<void>;
  updateMemberAssignments: (memberName: string, assignments: any[]) => Promise<void>;
  removeMember: (uid: string) => Promise<void>;
  dos: any[];
}

interface SettingsFormProps {
  cfg: any;
  sv: (data: any) => void;
  db: any;
  nf: (m: string, t?: string) => void;
  onClose: () => void;
  // Preferences
  theme?: string;
  toggleTheme?: () => void;
  // Equipe (optionnel : disponible uniquement pour les admins)
  teamProps?: TeamProps;
}

function SettingsForm(p: SettingsFormProps) {
  var [tab, setTab] = useState("pref");
  var hasTeam = !!(p.teamProps && p.teamProps.members && p.teamProps.currentUid);

  function renderTab(key: string, label: string, visible?: boolean) {
    if (visible === false) return null;
    var isActive = tab === key;
    return (
      <button
        key={key}
        role="tab"
        aria-selected={isActive}
        onClick={function () { setTab(key); }}
        style={{
          background: "transparent",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          border: "none",
          borderBottom: isActive ? "2px solid var(--btn-primary-bg)" : "2px solid transparent",
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: isActive ? 700 : 500,
          cursor: "pointer",
          minHeight: 44,
          whiteSpace: "nowrap" as const,
          marginBottom: -1,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div>
      {/* TabBar */}
      <div role="tablist" aria-label="Sections des parametres" style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {renderTab("pref", "Preferences")}
        {renderTab("team", "Equipe (" + (hasTeam ? String((p.teamProps as TeamProps).members.length) : "0") + ")", hasTeam)}
      </div>

      {/* Tab Preferences */}
      {tab === "pref" ? (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--text-primary)" }}>{"Apparence"}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>{"Theme clair ou sombre selon vos preferences."}</div>
            {p.toggleTheme ? (
              <button onClick={p.toggleTheme} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: 48, width: "100%" }}>
                <span style={{ fontSize: 20 }}>{p.theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}</span>
                <div style={{ textAlign: "left" as const, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{p.theme === "dark" ? "Mode clair" : "Mode sombre"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{"Actuellement : " + (p.theme === "dark" ? "sombre" : "clair")}</div>
                </div>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{"\u2192"}</span>
              </button>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 16 }}>
            <button onClick={p.onClose} style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", minHeight: 44, fontSize: 14 }}>{"Fermer"}</button>
          </div>
        </div>
      ) : null}

      {/* Tab Equipe */}
      {tab === "team" && hasTeam ? (
        <Suspense fallback={<div style={{ padding: 20, textAlign: "center" as const, color: "var(--text-muted)" }}>{"Chargement..."}</div>}>
          <TeamPanel
            members={(p.teamProps as TeamProps).members}
            currentUid={(p.teamProps as TeamProps).currentUid}
            createInvite={(p.teamProps as TeamProps).createInvite}
            addMemberByEmail={(p.teamProps as TeamProps).addMemberByEmail}
            updateMemberRole={(p.teamProps as TeamProps).updateMemberRole}
            updateMemberAssignments={(p.teamProps as TeamProps).updateMemberAssignments}
            removeMember={(p.teamProps as TeamProps).removeMember}
            dos={(p.teamProps as TeamProps).dos || []}
            onClose={p.onClose}
            embedded={true}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default SettingsForm;
