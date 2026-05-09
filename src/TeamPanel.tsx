// src/TeamPanel.tsx
import { useState } from 'react';

var ROLES: Record<string, string> = { admin: 'Admin', agent: 'Agent', client: 'Client' };
var ROLE_COLOR_VAR: Record<string, string> = { admin: 'var(--danger)', agent: 'var(--info)', client: 'var(--success)' };

// Catalogue taches = mirror de IntervenantsView (source unique metier).
// Utilise pour cocher les responsabilites globales d'un membre a la creation de l'invite.
var TACHES_LIST: Array<{ k: string; l: string }> = [
  { k: 'BAD', l: 'BAD' },
  { k: 'BAE', l: 'BAE/Douane' },
  { k: 'PREGATE', l: 'Pregate' },
  { k: 'TRANSIT', l: 'Transit' },
  { k: 'LIVRAISON', l: 'Livraison' },
  { k: 'MANUT', l: 'Manutention' },
  { k: 'FACT', l: 'Facturation' },
];

function formatLastSeen(ts: string | null): { label: string; online: boolean } | null {
  if (!ts) return null;
  var diff = Date.now() - new Date(ts).getTime();
  var min = Math.floor(diff / 60000);
  if (min < 5) return { label: 'En ligne', online: true };
  if (min < 60) return { label: 'Il y a ' + min + ' min', online: false };
  var h = Math.floor(min / 60);
  if (h < 24) return { label: 'Il y a ' + h + 'h', online: false };
  var d = Math.floor(h / 24);
  if (d === 1) return { label: 'Hier', online: false };
  return { label: 'Il y a ' + d + ' jours', online: false };
}

interface TeamPanelProps { [key: string]: any; }

export default function TeamPanel(p: TeamPanelProps) {
  var [invCode, setInvCode] = useState('');
  var [invRole, setInvRole] = useState('agent');
  var [invEmail, setInvEmail] = useState('');
  var [invResponsabilites, setInvResponsabilites] = useState('');
  // Assignments par dossier : { dosId: { taches: [...], voirDepenses: bool } }
  var [invAssignments, setInvAssignments] = useState<Record<string, { taches: string[]; voirDepenses: boolean }>>({});
  var [dosSearch, setDosSearch] = useState('');
  // Edition assignments agent existant
  var [editingMember, setEditingMember] = useState<any | null>(null);
  var [editAssignments, setEditAssignments] = useState<Record<string, { taches: string[]; voirDepenses: boolean }>>({});
  var [editDosSearch, setEditDosSearch] = useState('');
  var [editSaving, setEditSaving] = useState(false);
  var [addEmail, setAddEmail] = useState('');
  var [addName, setAddName] = useState('');
  var [addRole, setAddRole] = useState('agent');
  var [addLink, setAddLink] = useState('');
  var [msg, setMsg] = useState('');
  var [tab, setTab] = useState('members');

  function toggleAssignDos(dosId: string) {
    setInvAssignments(function (prev) {
      var next = Object.assign({}, prev);
      if (next[dosId]) delete next[dosId];
      else next[dosId] = { taches: [], voirDepenses: false };
      return next;
    });
  }

  function toggleAssignTache(dosId: string, k: string) {
    setInvAssignments(function (prev) {
      if (!prev[dosId]) return prev;
      var cur = prev[dosId];
      var newTaches = cur.taches.indexOf(k) >= 0
        ? cur.taches.filter(function (x) { return x !== k; })
        : cur.taches.concat([k]);
      return Object.assign({}, prev, { [dosId]: { taches: newTaches, voirDepenses: cur.voirDepenses } });
    });
  }

  function toggleAssignVoirDepenses(dosId: string) {
    setInvAssignments(function (prev) {
      if (!prev[dosId]) return prev;
      var cur = prev[dosId];
      return Object.assign({}, prev, { [dosId]: { taches: cur.taches, voirDepenses: !cur.voirDepenses } });
    });
  }

  async function genCode() {
    setMsg('');
    if (!invEmail.trim()) { setMsg("Email de l'agent obligatoire"); return; }
    try {
      var assignmentsList = Object.keys(invAssignments).map(function (dosId) {
        return { dosId: dosId, taches: invAssignments[dosId].taches, voirDepenses: invAssignments[dosId].voirDepenses };
      });
      var code = await p.createInvite(invRole, invEmail.trim(), assignmentsList, invResponsabilites.trim());
      setInvCode(code);
      setMsg('Code genere pour ' + invEmail.trim() + (assignmentsList.length > 0 ? ' (' + assignmentsList.length + ' dossier(s) assigne(s))' : '') + ' !');
    } catch (e) { setMsg('Erreur: ' + e.message); }
  }

  // Ouvre la modale d'edition assignments pour un membre existant
  function openEditAssignments(m: any) {
    var existing: Record<string, { taches: string[]; voirDepenses: boolean }> = {};
    var nameUp = String(m.name || '').toUpperCase();
    (p.dos || []).forEach(function (d: any) {
      var iv = (d.itv || []).find(function (i: any) { return (i.nm || '').toUpperCase() === nameUp; });
      if (iv) {
        existing[d.id] = {
          taches: Array.isArray(iv.taches) ? iv.taches : [],
          voirDepenses: !!iv.voirDepenses,
        };
      }
    });
    setEditingMember(m);
    setEditAssignments(existing);
    setEditDosSearch('');
  }

  function toggleEditDos(dosId: string) {
    setEditAssignments(function (prev) {
      var next = Object.assign({}, prev);
      if (next[dosId]) delete next[dosId];
      else next[dosId] = { taches: [], voirDepenses: false };
      return next;
    });
  }

  function toggleEditTache(dosId: string, k: string) {
    setEditAssignments(function (prev) {
      if (!prev[dosId]) return prev;
      var cur = prev[dosId];
      var nt = cur.taches.indexOf(k) >= 0 ? cur.taches.filter(function (x) { return x !== k; }) : cur.taches.concat([k]);
      return Object.assign({}, prev, { [dosId]: { taches: nt, voirDepenses: cur.voirDepenses } });
    });
  }

  function toggleEditVoirDepenses(dosId: string) {
    setEditAssignments(function (prev) {
      if (!prev[dosId]) return prev;
      var cur = prev[dosId];
      return Object.assign({}, prev, { [dosId]: { taches: cur.taches, voirDepenses: !cur.voirDepenses } });
    });
  }

  async function saveAssignments() {
    if (!editingMember || !p.updateMemberAssignments) return;
    setEditSaving(true);
    try {
      var list = Object.keys(editAssignments).map(function (dosId) {
        return { dosId: dosId, taches: editAssignments[dosId].taches, voirDepenses: editAssignments[dosId].voirDepenses };
      });
      await p.updateMemberAssignments(editingMember.name, list);
      setMsg('Assignations mises a jour pour ' + (editingMember.name || editingMember.email));
      setEditingMember(null);
    } catch (e) { setMsg('Erreur: ' + e.message); }
    setEditSaving(false);
  }

  async function addByEmail() {
    if (!addEmail) { setMsg('Email requis'); return; }
    setMsg(''); setAddLink('');
    try {
      var link = await p.addMemberByEmail(addEmail, addRole, addName);
      setAddLink(link || '');
      setMsg('Lien genere pour ' + addEmail + ' (valable 7 jours)');
    } catch (e) { setMsg('Erreur: ' + e.message); }
  }

  var IS = { width: '100%', padding: '8px 11px', border: '2px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: 'var(--bg-primary)', color: 'var(--text-input)' };
  var LS = { display: 'block' as const, fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 };

  // Mode embedded : rendu inline dans un conteneur (ex: Paramètres) — pas de header fullscreen ni Retour
  var embedded = !!p.embedded;
  var wrapperStyle = embedded
    ? { padding: 0 }
    : { minHeight: '100vh', background: 'var(--bg-body)', fontFamily: 'var(--font-sans)' };
  var innerStyle = embedded
    ? { padding: 0 }
    : { maxWidth: 700, margin: '0 auto', padding: 20 };

  return (
    <div style={wrapperStyle}>
      {embedded ? null : (
        <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 1, color: 'var(--text-primary)' }}>SAPURAI</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gestion equipe</span>
          </div>
          <button onClick={p.onClose} style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Retour</button>
        </div>
      )}

      <div style={innerStyle}>
        {msg ? <div style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '8px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{msg}</div> : null}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
          {['members', 'invite', 'email'].map(function (t) {
            var labels: Record<string, string> = { members: 'Membres (' + String(p.members.length) + ')', invite: 'Code invitation', email: 'Ajouter par email' };
            var isActive = tab === t;
            return <button key={t} onClick={function () { setTab(t); }} style={{ background: isActive ? 'var(--btn-primary-bg)' : 'var(--bg-secondary)', color: isActive ? 'var(--btn-primary-text)' : 'var(--text-tertiary)', border: 'none', padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: t === 'members' ? '8px 0 0 8px' : t === 'email' ? '0 8px 8px 0' : '0' }}>{labels[t]}</button>;
          })}
        </div>

        {/* Members list */}
        {tab === 'members' ? (
          <div>
            {p.members.map(function (m: any) {
              var isMe = m.uid === p.currentUid;
              return <div key={m.uid} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 14, marginBottom: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{m.name || m.email}{isMe ? ' (vous)' : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Rejoint le {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('fr-FR') : '---'}</div>
                  {(function () {
                    var ls = formatLastSeen(m.lastSeen);
                    if (!ls) return null;
                    return (
                      <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ls.online ? 'var(--success)' : 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: ls.online ? 'var(--success)' : 'var(--text-tertiary)', fontWeight: ls.online ? 700 : 400 }}>{ls.label}</span>
                      </div>
                    );
                  })()}
                  {Array.isArray(m.taches) && m.taches.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {m.taches.map(function (tk: string) {
                        var lbl = TACHES_LIST.find(function (t) { return t.k === tk; });
                        return <span key={tk} style={{ background: 'var(--info-bg)', color: 'var(--info-text)', padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{lbl ? lbl.l : tk}</span>;
                      })}
                    </div>
                  ) : null}
                  {m.responsabilites ? (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>{m.responsabilites}</div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ background: ROLE_COLOR_VAR[m.role] || 'var(--text-tertiary)', color: 'white', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{ROLES[m.role] || m.role}</span>
                  {!isMe ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {m.role === 'agent' && p.updateMemberAssignments && p.dos ? (
                        <button onClick={function () { openEditAssignments(m); }} style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{"Gerer assignations"}</button>
                      ) : null}
                      <select value={m.role} onChange={function (e) { p.updateMemberRole(m.uid, e.target.value); setMsg('Role mis a jour'); }} style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-input)' }}>
                        <option value="admin">Admin</option>
                        <option value="agent">Agent</option>
                        <option value="client">Client</option>
                      </select>
                      <button onClick={function () { if (confirm('Retirer ' + (m.name || m.email) + ' ?')) { p.removeMember(m.uid); setMsg('Membre retire'); } }} style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Retirer</button>
                    </div>
                  ) : null}
                </div>
              </div>;
            })}
          </div>
        ) : null}

        {/* Invite by code — selecteur recherche dossiers + taches + voirDepenses */}
        {tab === 'invite' ? (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={LS}>Email de l'agent *</label>
              <input type="email" value={invEmail} onChange={function (e) { setInvEmail(e.target.value); }} placeholder="agent@example.com" style={IS} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{"Seule cette adresse pourra utiliser le code d'invitation."}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LS}>Role</label>
              <select value={invRole} onChange={function (e) { setInvRole(e.target.value); }} style={IS}>
                <option value="agent">Agent</option>
                <option value="client">Client (lecture seule)</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Selecteur dossiers — agent uniquement */}
            {invRole === 'agent' ? (
              <div style={{ marginBottom: 14 }}>
                <label style={LS}>Dossiers a assigner</label>
                {/* Liste des dossiers selectionnes (chips) */}
                {Object.keys(invAssignments).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {Object.keys(invAssignments).map(function (dosId) {
                      var d = (p.dos || []).find(function (x: any) { return x.id === dosId; });
                      if (!d) return null;
                      var assign = invAssignments[dosId];
                      return (
                        <div key={dosId} style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 8, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{(d.cl || '?') + ' \u2014 ' + (d.bl || '?')}</div>
                            <button type="button" onClick={function () { toggleAssignDos(dosId); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, fontWeight: 700 }}>{"\u00D7"}</button>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{"Taches"}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {TACHES_LIST.map(function (t) {
                              var active = assign.taches.indexOf(t.k) >= 0;
                              return (
                                <button
                                  key={t.k}
                                  type="button"
                                  onClick={function () { toggleAssignTache(dosId, t.k); }}
                                  style={{
                                    background: active ? 'var(--btn-primary-bg)' : 'var(--bg-primary)',
                                    color: active ? 'var(--btn-primary-text)' : 'var(--text-tertiary)',
                                    border: '1px solid ' + (active ? 'var(--btn-primary-bg)' : 'var(--border)'),
                                    borderRadius: 6,
                                    padding: '4px 8px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >{active ? '\u2713 ' : ''}{t.l}</button>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{"Permissions"}</div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={assign.voirDepenses} onChange={function () { toggleAssignVoirDepenses(dosId); }} />
                            <span style={{ color: 'var(--text-primary)' }}>{"Voir les depenses"}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {/* Recherche pour ajouter */}
                <input
                  type="search"
                  value={dosSearch}
                  onChange={function (e) { setDosSearch(e.target.value); }}
                  placeholder="Rechercher un dossier (client, BL, compagnie)..."
                  style={IS}
                />
                {dosSearch.trim().length >= 2 ? (
                  <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    {(function () {
                      var q = dosSearch.toLowerCase();
                      var matches = (p.dos || []).filter(function (d: any) {
                        if (invAssignments[d.id]) return false;
                        if (d.st === 'CLOTURE' || d.st === 'ARCHIVE') return false;
                        // Sprint C.1 : exclusivite — exclure dossiers deja assignes a un autre agent
                        var hasOtherAgent = (d.itv || []).some(function (iv: any) { return (iv.role || '').toUpperCase() === 'AGENT' && iv.nm; });
                        if (hasOtherAgent) return false;
                        return ((d.cl || '').toLowerCase().indexOf(q) >= 0)
                          || ((d.bl || '').toLowerCase().indexOf(q) >= 0)
                          || ((d.cp || '').toLowerCase().indexOf(q) >= 0);
                      }).slice(0, 10);
                      if (matches.length === 0) return <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' as const }}>{"Aucun dossier disponible (deja assigne a un autre agent, cloture ou archive)"}</div>;
                      return matches.map(function (d: any) {
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={function () { toggleAssignDos(d.id); setDosSearch(''); }}
                            style={{ width: '100%', textAlign: 'left' as const, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)', padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}
                          >
                            <div style={{ fontWeight: 600 }}>{(d.cl || '?') + ' \u2014 ' + (d.bl || '?')}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{(d.cp || '') + (d.cr ? ' \u00B7 ' + d.cr : '')}</div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{"Tapez 2 caracteres pour rechercher. " + (Object.keys(invAssignments).length === 0 ? "Aucun dossier assigne pour l'instant." : String(Object.keys(invAssignments).length) + " dossier(s) selectionne(s).")}</div>
                )}
              </div>
            ) : null}

            {invRole === 'agent' ? (
              <div style={{ marginBottom: 14 }}>
                <label style={LS}>Responsabilites (texte libre, optionnel)</label>
                <textarea value={invResponsabilites} onChange={function (e) { setInvResponsabilites(e.target.value); }} placeholder="Ex : gere les docs douane et le dispatch transit, interlocuteur principal DPWorld." maxLength={300} rows={3} style={Object.assign({}, IS, { fontFamily: 'inherit', resize: 'vertical' as const })} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{String(invResponsabilites.length) + '/300'}</div>
              </div>
            ) : null}
            <button onClick={genCode} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Generer un code</button>

            {invCode ? (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{"Code d'invitation pour " + invEmail + " (valable 7 jours)"}</div>
                <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, color: 'var(--text-primary)', background: 'var(--bg-secondary)', borderRadius: 8, padding: '14px 20px', fontFamily: 'monospace' }}>{invCode}</div>
                <button onClick={function () { navigator.clipboard.writeText(invCode).then(function () { setMsg('Code copie !'); }).catch(function () { setMsg('Erreur copie \u2014 copiez manuellement'); }); }} style={{ marginTop: 10, background: 'var(--success)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Copier</button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Add by email */}
        {tab === 'email' ? (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={LS}>Email du nouveau membre</label>
              <input value={addEmail} onChange={function (e) { setAddEmail(e.target.value); }} placeholder="agent@example.com" style={IS} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LS}>Nom (optionnel)</label>
              <input value={addName} onChange={function (e) { setAddName(e.target.value); }} placeholder="Moussa Traore" style={IS} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LS}>Role</label>
              <select value={addRole} onChange={function (e) { setAddRole(e.target.value); }} style={IS}>
                <option value="agent">Agent</option>
                <option value="client">Client (lecture seule)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button onClick={addByEmail} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Generer lien d'invitation</button>
            {addLink ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Partagez ce lien par WhatsApp ou SMS — il expire dans 7 jours :</div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 8, border: '1px solid var(--border)', color: 'var(--text-input)' }}>{addLink}</div>
                <button onClick={function () { navigator.clipboard.writeText(addLink).then(function () { setMsg('Lien copie !'); }).catch(function () { setMsg('Erreur copie \u2014 copiez manuellement'); }); }} style={{ background: 'var(--success)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Copier le lien</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Modale d'edition assignations agent existant */}
      {editingMember ? (
        <div onClick={function () { if (!editSaving) setEditingMember(null); }} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: 'var(--bg-primary)', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '94vh', overflow: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{"Assignations \u2014 " + (editingMember.name || editingMember.email)}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Object.keys(editAssignments).length + ' dossier(s) assigne(s)'}</div>
              </div>
              <button onClick={function () { setEditingMember(null); }} disabled={editSaving} style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', borderRadius: 8, width: 36, height: 36 }}>{"\u00D7"}</button>
            </div>

            {/* Liste des dossiers assignes (chips) */}
            {Object.keys(editAssignments).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {Object.keys(editAssignments).map(function (dosId) {
                  var d = (p.dos || []).find(function (x: any) { return x.id === dosId; });
                  if (!d) return null;
                  var assign = editAssignments[dosId];
                  return (
                    <div key={dosId} style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{(d.cl || '?') + ' \u2014 ' + (d.bl || '?')}</div>
                        <button type="button" onClick={function () { toggleEditDos(dosId); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, fontWeight: 700 }}>{"\u00D7"}</button>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{"Taches"}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {TACHES_LIST.map(function (t) {
                          var active = assign.taches.indexOf(t.k) >= 0;
                          return (
                            <button key={t.k} type="button" onClick={function () { toggleEditTache(dosId, t.k); }} style={{ background: active ? 'var(--btn-primary-bg)' : 'var(--bg-primary)', color: active ? 'var(--btn-primary-text)' : 'var(--text-tertiary)', border: '1px solid ' + (active ? 'var(--btn-primary-bg)' : 'var(--border)'), borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{active ? '\u2713 ' : ''}{t.l}</button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{"Permissions"}</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={assign.voirDepenses} onChange={function () { toggleEditVoirDepenses(dosId); }} />
                        <span style={{ color: 'var(--text-primary)' }}>{"Voir les depenses"}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center' as const, fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 12 }}>{"Aucun dossier assigne. Recherchez ci-dessous pour ajouter."}</div>
            )}

            {/* Recherche pour ajouter */}
            <input type="search" value={editDosSearch} onChange={function (e) { setEditDosSearch(e.target.value); }} placeholder="Rechercher un dossier (client, BL, compagnie)..." style={IS} />
            {editDosSearch.trim().length >= 2 ? (
              <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {(function () {
                  var q = editDosSearch.toLowerCase();
                  var editingName = editingMember && editingMember.name ? String(editingMember.name).toUpperCase() : '';
                  var matches = (p.dos || []).filter(function (d: any) {
                    if (editAssignments[d.id]) return false;
                    if (d.st === 'CLOTURE' || d.st === 'ARCHIVE') return false;
                    // Sprint C.1 : exclusivite — autoriser uniquement les dossiers sans agent
                    // OU dont l'agent assigne est l'editingMember (pour conserver les siens en mode edition)
                    var otherAgent = (d.itv || []).find(function (iv: any) {
                      return (iv.role || '').toUpperCase() === 'AGENT' && iv.nm && (iv.nm || '').toUpperCase() !== editingName;
                    });
                    if (otherAgent) return false;
                    return ((d.cl || '').toLowerCase().indexOf(q) >= 0)
                      || ((d.bl || '').toLowerCase().indexOf(q) >= 0)
                      || ((d.cp || '').toLowerCase().indexOf(q) >= 0);
                  }).slice(0, 10);
                  if (matches.length === 0) return <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' as const }}>{"Aucun dossier trouve"}</div>;
                  return matches.map(function (d: any) {
                    return (
                      <button key={d.id} type="button" onClick={function () { toggleEditDos(d.id); setEditDosSearch(''); }} style={{ width: '100%', textAlign: 'left' as const, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)', padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: 600 }}>{(d.cl || '?') + ' \u2014 ' + (d.bl || '?')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{(d.cp || '') + (d.cr ? ' \u00B7 ' + d.cr : '')}</div>
                      </button>
                    );
                  });
                })()}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 16 }}>
              <button onClick={function () { setEditingMember(null); }} disabled={editSaving} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer', minHeight: 44, fontSize: 14 }}>{"Annuler"}</button>
              <button onClick={saveAssignments} disabled={editSaving} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: editSaving ? 'default' : 'pointer', minHeight: 44, fontSize: 14, opacity: editSaving ? 0.6 : 1 }}>{editSaving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
