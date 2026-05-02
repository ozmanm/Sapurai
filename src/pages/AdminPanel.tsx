// src/pages/AdminPanel.jsx — Super-admin company management panel
import { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, getDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

interface AdminPanelProps { user: any; logout: () => void; }
type CompanyRow = { id: string; name?: string; status?: string; [key: string]: any };
type MemberRow = { uid: string; name?: string; email?: string; [key: string]: any };

export default function AdminPanel({ user, logout }: AdminPanelProps) {
  var [companies, setCompanies] = useState<CompanyRow[]>([]);
  var [loading, setLoading] = useState(true);
  var [saving, setSaving] = useState(null);
  var [confirmDelete, setConfirmDelete] = useState(null);
  var [deleting, setDeleting] = useState(null);
  var [err, setErr] = useState('');
  var [geminiKey, setGeminiKey] = useState('');
  var [geminiSaved, setGeminiSaved] = useState(false);
  var [expanded, setExpanded] = useState(null);
  var [members, setMembers] = useState<Record<string, MemberRow[]>>({});
  var [loadingMembers, setLoadingMembers] = useState(null);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      var snap = await getDocs(collection(db, 'companies'));
      var list: CompanyRow[] = [];
      snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
      list.sort(function (a, b) { return (a.name || a.id).localeCompare(b.name || b.id); });
      setCompanies(list);
    } catch (e) {
      setErr('Erreur de chargement : ' + e.message + ' — vérifiez les Firestore Rules');
    }
    try {
      var globalSnap = await getDoc(doc(db, 'config', 'global'));
      if (globalSnap.exists()) setGeminiKey(globalSnap.data().geminiKey || '');
    } catch (e) {}
    setLoading(false);
  }

  useEffect(function () { load(); }, []);

  async function toggleStatus(companyId, currentStatus) {
    var newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    setSaving(companyId);
    try {
      await setDoc(doc(db, 'companies', companyId), { status: newStatus }, { merge: true });
      setCompanies(function (prev) {
        return prev.map(function (c) {
          return c.id === companyId ? Object.assign({}, c, { status: newStatus }) : c;
        });
      });
    } catch (e) {
      setErr('Erreur : ' + e.message);
    }
    setSaving(null);
  }

  async function saveGeminiKey() {
    await setDoc(doc(db, 'config', 'global'), { geminiKey: geminiKey.trim() }, { merge: true });
    setGeminiSaved(true);
    setTimeout(function () { setGeminiSaved(false); }, 2000);
  }

  async function deleteCompany(companyId) {
    setDeleting(companyId);
    setConfirmDelete(null);
    setErr('');
    try {
      // 1. Fetch members
      var membersSnap = await getDocs(collection(db, 'companies', companyId, 'members'));
      // 2. Detach each member from their /users/{uid} doc
      var detachPromises = [];
      membersSnap.forEach(function (m) {
        detachPromises.push(
          updateDoc(doc(db, 'users', m.id), { companyId: null }).catch(function (err) { console.error('Detach member ' + m.id + ':', err); })
        );
      });
      await Promise.all(detachPromises);
      // 3. Delete member docs
      var deletePromises = [];
      membersSnap.forEach(function (m) {
        deletePromises.push(deleteDoc(doc(db, 'companies', companyId, 'members', m.id)));
      });
      await Promise.all(deletePromises);
      // 4. Delete company doc
      await deleteDoc(doc(db, 'companies', companyId));
      // 5. Remove from local state
      setCompanies(function (prev) { return prev.filter(function (c) { return c.id !== companyId; }); });
    } catch (e) {
      setErr('Erreur suppression : ' + e.message);
    }
    setDeleting(null);
  }

  async function toggleMembers(companyId) {
    if (expanded === companyId) { setExpanded(null); return; }
    setExpanded(companyId);
    if (members[companyId]) return;
    setLoadingMembers(companyId);
    try {
      var snap = await getDocs(collection(db, 'companies', companyId, 'members'));
      var list: MemberRow[] = [];
      snap.forEach(function (m) { list.push(Object.assign({ uid: m.id }, m.data())); });
      list.sort(function (a, b) { return (a.name || a.email || '').localeCompare(b.name || b.email || ''); });
      setMembers(function (prev) { return Object.assign({}, prev, { [companyId]: list }); });
    } catch (e) {
      setErr('Erreur chargement membres : ' + e.message);
    }
    setLoadingMembers(null);
  }

  var activeCount = companies.filter(function (c) { return c.status !== 'blocked'; }).length;
  var blockedCount = companies.filter(function (c) { return c.status === 'blocked'; }).length;
  var totalMembers = Object.values(members).reduce(function (sum, list) { return sum + list.length; }, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, color: 'var(--text-primary)' }}>SAPURAI</span>
          <span style={{ background: 'var(--purple)', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, letterSpacing: 1 }}>SUPER-ADMIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.email}</span>
          <button onClick={logout} style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Déconnexion</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>
        {/* Title + stats */}
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Gestion des comptes</div>
            {!loading ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                {companies.length} entreprise{companies.length !== 1 ? 's' : ''} · <span style={{ color: 'var(--success)', fontWeight: 600 }}>{activeCount} actives</span>{blockedCount > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {blockedCount} bloquées</span> : ''}
              </div>
            ) : null}
          </div>
          <button onClick={load} disabled={loading} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        {/* Error */}
        {err ? (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger-text)', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, border: '1px solid var(--danger-border)' }}>{err}</div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>Chargement des entreprises...</div>
        ) : companies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>Aucune entreprise trouvée</div>
        ) : (
          <div>
            {companies.map(function (c) {
              var isBlocked = c.status === 'blocked';
              var isSaving = saving === c.id;
              var isDeleting = deleting === c.id;
              var isConfirming = confirmDelete === c.id;
              var dosCount = (c.dos || []).length;
              var tcsCount = (c.tcs || []).length;
              var chsCount = (c.chs || []).length;
              var depCount = (c.dep || []).length;
              var logs = c.logs || [];
              var lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
              var isExpanded = expanded === c.id;
              var memberList = members[c.id] || [];
              var isLoadingM = loadingMembers === c.id;
              return (
                <div key={c.id} style={{ background: 'var(--bg-primary)', borderRadius: 12, marginBottom: 8, border: isBlocked ? '1px solid var(--danger-border)' : '1px solid var(--border)', opacity: (isSaving || isDeleting) ? 0.7 : 1 }}>
                  <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 3 }}>
                        {c.name || '(sans nom)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>{c.id}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>{dosCount} dossier{dosCount !== 1 ? 's' : ''}</span>
                        <span>{tcsCount} conteneur{tcsCount !== 1 ? 's' : ''}</span>
                        <span>{chsCount} chauffeur{chsCount !== 1 ? 's' : ''}</span>
                        <span>{depCount} depense{depCount !== 1 ? 's' : ''}</span>
                      </div>
                      {lastLog ? (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Derniere activite : {lastLog.d ? lastLog.d.split('T')[0] : '---'}{lastLog.a ? ' — ' + lastLog.a : ''}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ background: isBlocked ? 'var(--danger-light)' : 'var(--success-light)', color: isBlocked ? 'var(--danger)' : 'var(--success)', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        {isBlocked ? 'Bloqué' : 'Actif'}
                      </span>
                      <button
                        onClick={function () { toggleMembers(c.id); }}
                        style={{ background: isExpanded ? 'var(--info-bg)' : 'var(--bg-secondary)', color: isExpanded ? 'var(--info-text)' : 'var(--text-tertiary)', border: '1px solid ' + (isExpanded ? 'var(--info-border)' : 'var(--border)'), borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {isExpanded ? 'Masquer' : 'Membres'}
                      </button>
                      <button
                        disabled={isSaving || isDeleting}
                        onClick={function () { toggleStatus(c.id, c.status); }}
                        style={{ background: isBlocked ? 'var(--success)' : 'var(--danger)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: (isSaving || isDeleting) ? 'not-allowed' : 'pointer' }}>
                        {isSaving ? '...' : isBlocked ? 'Débloquer' : 'Bloquer'}
                      </button>
                      {isConfirming ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={function () { deleteCompany(c.id); }}
                            style={{ background: 'var(--danger-text)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            Confirmer
                          </button>
                          <button
                            onClick={function () { setConfirmDelete(null); }}
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isDeleting}
                          onClick={function () { setConfirmDelete(c.id); }}
                          style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: isDeleting ? 'not-allowed' : 'pointer' }}>
                          {isDeleting ? '...' : 'Supprimer'}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', background: 'var(--bg-tertiary)' }}>
                      {isLoadingM ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Chargement des membres...</div>
                      ) : memberList.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Aucun membre</div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>{memberList.length} membre{memberList.length !== 1 ? 's' : ''}</div>
                          {memberList.map(function (m) {
                            var roleColor = m.role === 'admin' ? 'var(--purple)' : m.role === 'agent' ? 'var(--info)' : 'var(--text-tertiary)';
                            var roleBg = m.role === 'admin' ? 'var(--purple-bg)' : m.role === 'agent' ? 'var(--info-bg)' : 'var(--bg-secondary)';
                            return (
                              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                  {(m.name || m.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.name || '(sans nom)'}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                                </div>
                                <span style={{ background: roleBg, color: roleColor, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                                  {m.role || 'membre'}
                                </span>
                                {m.joinedAt ? (
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {m.joinedAt.split('T')[0]}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Gemini API key */}
        <div style={{ marginTop: 24, background: 'var(--bg-primary)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Clé API Gemini (scan BL)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={geminiKey}
              onChange={function (e) { setGeminiKey(e.target.value); setGeminiSaved(false); }}
              placeholder="AIza..."
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }}
            />
            <button
              onClick={saveGeminiKey}
              disabled={!geminiKey.trim()}
              style={{ background: geminiSaved ? 'var(--success)' : 'var(--btn-primary-bg)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: geminiKey.trim() ? 'pointer' : 'not-allowed', opacity: geminiKey.trim() ? 1 : 0.5 }}>
              {geminiSaved ? 'Sauvegardé !' : 'Sauvegarder'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Utilisée par tous les comptes pour le scan automatique de BL. Obtenir une clé sur aistudio.google.com
          </div>
        </div>

        {/* Firestore rules reminder */}
        <div style={{ marginTop: 16, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--warning-text)' }}>
          <strong>Rappel Firestore Rules :</strong> Assurez-vous que votre UID est autorisé à lire toutes les companies dans les règles Firestore. Sinon les données n'apparaîtront pas.
        </div>
      </div>
    </div>
  );
}
