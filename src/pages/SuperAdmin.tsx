import { useState, useEffect } from 'react';
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import type { BillingStatus, PlanType, PaymentMethod } from '../types.js';

// Firebase User minimal pour SuperAdmin (lu : uid, email)
interface FirebaseUserLike { uid: string; email: string | null }
interface SuperAdminProps { user: FirebaseUserLike; logout: () => void; }

interface CompanyRow {
  id: string;
  name?: string;
  cfg?: { name?: string };
  dos?: unknown[];
  tcs?: unknown[];
  chs?: unknown[];
  dep?: unknown[];
  logs?: Array<{ d?: string; a?: string; }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- doc Firestore avec champs heterogenes, large par design
  [key: string]: any;
}

interface MemberRow {
  uid: string;
  name?: string;
  email?: string;
  role?: string;
  joinedAt?: string;
}

interface SuperAdminRow {
  uid: string;
  email?: string;
  createdAt?: string;
  role?: string;
  createdBy?: string;
}

interface BillingInfo {
  billingStatus?: string;
  plan?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  lastPaymentAt?: string;
  paymentMethod?: string;
  internalNotes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export default function SuperAdmin({ user, logout }: SuperAdminProps) {
  var [companies, setCompanies] = useState<CompanyRow[]>([]);
  var [loading, setLoading] = useState(true);
  var [err, setErr] = useState('');
  var [expanded, setExpanded] = useState<string | null>(null);
  var [members, setMembers] = useState<Record<string, MemberRow[]>>({});
  var [loadingMembers, setLoadingMembers] = useState<string | null>(null);
  var [billing, setBilling] = useState<Record<string, BillingInfo>>({});
  var [geminiKey, setGeminiKey] = useState('');
  var [expandedBilling, setExpandedBilling] = useState<string | null>(null);
  // Sprint 36 : edition inline du billing profile (notes + actions plan/trial/suspension)
  var [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  var [saving, setSaving] = useState<Record<string, boolean>>({});

  // Sprint 37 : gestion des super-admins (lecture + ajout + retrait)
  var [superAdmins, setSuperAdmins] = useState<SuperAdminRow[]>([]);
  var [addingAdmin, setAddingAdmin] = useState(false);
  var [newUid, setNewUid] = useState('');
  var [newEmail, setNewEmail] = useState('');
  var [newRole, setNewRole] = useState<'owner' | 'admin'>('admin');
  var [savingAdmin, setSavingAdmin] = useState(false);

  /**
   * Met a jour le BillingProfile d'une company. Cree le profile s'il n'existe pas.
   * Set automatiquement updatedAt + updatedBy (super-admin courant).
   * Refresh le state local pour affichage immediat.
   */
  async function updateBilling(companyId: string, updates: Record<string, any>): Promise<void> {
    setSaving(function (prev) { return Object.assign({}, prev, { [companyId]: true }); });
    try {
      var current = billing[companyId] || {};
      // Defauts si le profile n'existe pas encore
      var base = {
        billingStatus: (current.billingStatus || 'trial') as BillingStatus,
        plan: (current.plan || 'trial') as PlanType,
        paymentMethod: (current.paymentMethod || 'manual') as PaymentMethod,
      };
      var merged = Object.assign({}, base, current, updates, {
        updatedAt: new Date().toISOString(),
        updatedBy: (user && user.email) || 'super-admin',
      });
      await setDoc(doc(db, 'companies', companyId, 'billing', 'profile'), merged, { merge: true });
      setBilling(function (prev) { return Object.assign({}, prev, { [companyId]: merged as BillingInfo }); });
    } catch (e: unknown) {
      setErr('Erreur mise a jour billing : ' + (e instanceof Error ? e.message : 'inconnue'));
    }
    setSaving(function (prev) { return Object.assign({}, prev, { [companyId]: false }); });
  }

  /**
   * Prolonge la duree d'essai de N jours a partir d'aujourd'hui (reset le statut a trial).
   */
  function extendTrial(companyId: string, days: number): void {
    var newEnd = new Date();
    newEnd.setDate(newEnd.getDate() + days);
    updateBilling(companyId, { billingStatus: 'trial', trialEndsAt: newEnd.toISOString().split('T')[0] });
  }

  /**
   * Toggle suspension (avec confirmation pour la mise en suspension).
   */
  function toggleSuspend(companyId: string, currentlySuspended: boolean): void {
    if (!currentlySuspended) {
      // Suspendre : confirmation
      var name = (companies.find(function (c) { return c.id === companyId; }) || {}).name || companyId;
      if (!window.confirm("Suspendre l'acces de \"" + name + "\" ? L'utilisateur ne pourra plus ecrire dans Firestore.")) return;
      updateBilling(companyId, { billingStatus: 'suspended' });
    } else {
      // Reactiver : pas de confirmation, on remet en trial (le super-admin peut ensuite changer le plan)
      updateBilling(companyId, { billingStatus: 'trial' });
    }
  }

  /**
   * Sprint 37 - Charge la liste des super-admins depuis /superAdmins.
   */
  async function loadSuperAdmins(): Promise<void> {
    try {
      var snap = await getDocs(collection(db, 'superAdmins'));
      var list: SuperAdminRow[] = [];
      snap.forEach(function (d) { list.push(Object.assign({ uid: d.id }, d.data())); });
      list.sort(function (a, b) { return (a.email || a.uid).localeCompare(b.email || b.uid); });
      setSuperAdmins(list);
    } catch (e: unknown) {
      setErr('Erreur chargement super-admins : ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  }

  /**
   * Sprint 37 - Ajoute un super-admin en creant /superAdmins/{uid}.
   * Validations basiques : UID non vide + au moins 20 chars, email format simple.
   */
  async function addSuperAdmin(): Promise<void> {
    var uidClean = (newUid || '').trim();
    var emailClean = (newEmail || '').trim().toLowerCase();
    if (uidClean.length < 20) { setErr('UID invalide (28 caracteres attendus depuis Firebase Auth)'); return; }
    if (!emailClean || emailClean.indexOf('@') < 0 || emailClean.indexOf('.') < 0) { setErr('Email invalide'); return; }
    if (superAdmins.find(function (sa) { return sa.uid === uidClean; })) {
      setErr('Ce UID est deja super-admin'); return;
    }
    setSavingAdmin(true);
    setErr('');
    try {
      var profile = {
        email: emailClean,
        createdAt: new Date().toISOString(),
        role: newRole,
        createdBy: (user && user.email) || 'super-admin',
      };
      await setDoc(doc(db, 'superAdmins', uidClean), profile);
      setSuperAdmins(function (prev) {
        var next = prev.slice();
        next.push(Object.assign({ uid: uidClean }, profile));
        next.sort(function (a, b) { return (a.email || a.uid).localeCompare(b.email || b.uid); });
        return next;
      });
      setAddingAdmin(false);
      setNewUid('');
      setNewEmail('');
      setNewRole('admin');
    } catch (e: unknown) {
      setErr('Erreur ajout super-admin : ' + (e instanceof Error ? e.message : 'inconnue'));
    }
    setSavingAdmin(false);
  }

  /**
   * Sprint 37 - Retire un super-admin. Bloque l'auto-retrait pour eviter
   * le verrouillage complet (il faut toujours au moins un super-admin actif).
   */
  async function removeSuperAdmin(uid: string, email: string): Promise<void> {
    if (user && user.uid === uid) {
      setErr('Tu ne peux pas te retirer toi-meme.');
      return;
    }
    if (superAdmins.length <= 1) {
      setErr('Impossible de retirer le dernier super-admin.');
      return;
    }
    if (!window.confirm('Retirer ' + (email || uid) + ' des super-admins ?')) return;
    try {
      await deleteDoc(doc(db, 'superAdmins', uid));
      setSuperAdmins(function (prev) { return prev.filter(function (sa) { return sa.uid !== uid; }); });
    } catch (e: unknown) {
      setErr('Erreur retrait : ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  }

  /**
   * Enregistre les notes internes saisies dans la textarea.
   */
  function saveNotes(companyId: string): void {
    var draft = notesDraft[companyId];
    if (draft === undefined) return;
    updateBilling(companyId, { internalNotes: draft }).then(function () {
      // Clear le draft une fois sauvegarde
      setNotesDraft(function (prev) {
        var next = Object.assign({}, prev);
        delete next[companyId];
        return next;
      });
    });
  }

  async function load() {
    setLoading(true);
    setErr('');
    try {
      var snap = await getDocs(collection(db, 'companies'));
      var list: CompanyRow[] = [];
      snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
      list.sort(function (a, b) { return (a.name || a.id).localeCompare(b.name || b.id); });
      setCompanies(list);

      // Load billing profiles in parallel
      var billingMap: Record<string, BillingInfo> = {};
      await Promise.all(list.map(async function (c) {
        try {
          var bSnap = await getDoc(doc(db, 'companies', c.id, 'billing', 'profile'));
          if (bSnap.exists()) billingMap[c.id] = bSnap.data() as BillingInfo;
        } catch (_e) { /* pas de billing */ }
      }));
      setBilling(billingMap);

      var globalSnap = await getDoc(doc(db, 'config', 'global'));
      if (globalSnap.exists()) setGeminiKey(globalSnap.data().geminiKey || '');
    } catch (e) {
      setErr('Erreur de chargement : ' + e.message);
    }
    setLoading(false);
  }

  useEffect(function () { load(); loadSuperAdmins(); }, []);

  async function toggleMembers(companyId: string) {
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

  var total = companies.length;
  var suspended = companies.filter(function (c) {
    var b = billing[c.id];
    return b && b.billingStatus === 'suspended';
  }).length;
  var trial = companies.filter(function (c) {
    var b = billing[c.id];
    return !b || b.billingStatus === 'trial';
  }).length;
  var active = total - suspended - trial;

  function statusBadge(cId: string) {
    var b = billing[cId];
    var st = b ? b.billingStatus : 'trial';
    var plan = b ? b.plan : 'trial';
    var colors: Record<string, { bg: string; fg: string }> = {
      trial: { bg: 'var(--info-bg)', fg: 'var(--info-text)' },
      active: { bg: 'var(--success-light)', fg: 'var(--success)' },
      past_due: { bg: 'var(--warning-bg)', fg: 'var(--warning-text)' },
      suspended: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
    };
    var c = colors[st] || { bg: 'var(--bg-secondary)', fg: 'var(--text-muted)' };
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
          {st === 'trial' ? 'Essai' : st === 'active' ? 'Actif' : st === 'past_due' ? 'Impayé' : 'Suspendu'}
        </span>
        <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}>
          {plan}
        </span>
      </span>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', fontFamily: 'var(--font-sans)' }}>
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

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
        {err ? (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger-text)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: '1px solid var(--danger-border)' }}>{err}</div>
        ) : null}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>Chargement...</div>
        ) : (
          <>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Entreprises</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {total} totale{total !== 1 ? 's' : ''}
                </div>
              </div>
              <button onClick={load} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Actualiser
              </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Actives', value: active, color: 'var(--success)' },
                { label: 'Essai', value: trial, color: 'var(--info-text)' },
                { label: 'Suspendues', value: suspended, color: 'var(--danger)' },
                { label: 'Total entreprises', value: total, color: 'var(--text-primary)' },
              ].map(function (kpi) {
                return (
                  <div key={kpi.label} style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '16px 18px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color, marginBottom: 4 }}>{kpi.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{kpi.label}</div>
                  </div>
                );
              })}
            </div>

            {companies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>Aucune entreprise trouvée</div>
            ) : (
              <div>
                {companies.map(function (c) {
                  var dosCount = (c.dos || []).length;
                  var tcsCount = (c.tcs || []).length;
                  var chsCount = (c.chs || []).length;
                  var depCount = (c.dep || []).length;
                  var logs = c.logs || [];
                  var lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
                  var isExpanded = expanded === c.id;
                  var memberList = members[c.id] || [];
                  var isLoadingM = loadingMembers === c.id;
                  var showBilling = expandedBilling === c.id;

                  return (
                    <div key={c.id} style={{ background: 'var(--bg-primary)', borderRadius: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
                      <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{c.name || '(sans nom)'}</span>
                            {statusBadge(c.id)}
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
                          <button
                            onClick={function () { setExpandedBilling(showBilling ? null : c.id); }}
                            style={{ background: showBilling ? 'var(--info-bg)' : 'var(--bg-secondary)', color: showBilling ? 'var(--info-text)' : 'var(--text-tertiary)', border: '1px solid ' + (showBilling ? 'var(--info-border)' : 'var(--border)'), borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            Abonnement
                          </button>
                          <button
                            onClick={function () { toggleMembers(c.id); }}
                            style={{ background: isExpanded ? 'var(--info-bg)' : 'var(--bg-secondary)', color: isExpanded ? 'var(--info-text)' : 'var(--text-tertiary)', border: '1px solid ' + (isExpanded ? 'var(--info-border)' : 'var(--border)'), borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {isExpanded ? 'Masquer' : 'Membres'}
                          </button>
                        </div>
                      </div>

                      {/* Billing detail + actions (Sprint 36) */}
                      {showBilling ? (function () {
                        var b = billing[c.id] || {};
                        var currentPlan = (b.plan || 'trial') as PlanType;
                        var currentStatus = (b.billingStatus || 'trial') as BillingStatus;
                        var isSuspended = currentStatus === 'suspended';
                        var draftValue = notesDraft[c.id];
                        var notesValue = draftValue !== undefined ? draftValue : (b.internalNotes || '');
                        var hasUnsavedNotes = draftValue !== undefined && draftValue !== (b.internalNotes || '');
                        var isSaving = !!saving[c.id];
                        return (
                          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--bg-tertiary)' }}>
                            {/* Infos en lecture */}
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Abonnement</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Fin essai : <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{b.trialEndsAt || '---'}</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Maj : <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{b.updatedAt ? b.updatedAt.split('T')[0] : '---'}</span>
                                {b.updatedBy ? <span style={{ color: 'var(--text-muted)' }}> par {b.updatedBy}</span> : null}
                              </div>
                            </div>

                            {/* Actions Plan */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Plan</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {(['trial', 'standard', 'pro'] as PlanType[]).map(function (planOption) {
                                  var isActive = currentPlan === planOption;
                                  return (
                                    <button
                                      key={planOption}
                                      disabled={isSaving || isActive}
                                      onClick={function () { updateBilling(c.id, { plan: planOption }); }}
                                      style={{
                                        background: isActive ? 'var(--btn-primary-bg)' : 'var(--bg-primary)',
                                        color: isActive ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                                        border: '1px solid ' + (isActive ? 'var(--btn-primary-bg)' : 'var(--border)'),
                                        borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                                        cursor: isActive || isSaving ? 'default' : 'pointer',
                                        opacity: isSaving && !isActive ? 0.5 : 1,
                                        minHeight: 32,
                                      }}>
                                      {planOption}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Actions Trial */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Prolonger essai</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {[14, 30].map(function (days) {
                                  return (
                                    <button
                                      key={days}
                                      disabled={isSaving}
                                      onClick={function () { extendTrial(c.id, days); }}
                                      style={{
                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                        border: '1px solid var(--border)', borderRadius: 6,
                                        padding: '5px 12px', fontSize: 12, fontWeight: 600,
                                        cursor: isSaving ? 'default' : 'pointer',
                                        opacity: isSaving ? 0.5 : 1,
                                        minHeight: 32,
                                      }}>
                                      +{days}j
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Action Suspension */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Acces</div>
                              <button
                                disabled={isSaving}
                                onClick={function () { toggleSuspend(c.id, isSuspended); }}
                                style={{
                                  background: isSuspended ? 'var(--success)' : 'var(--danger)',
                                  color: 'white',
                                  border: 'none', borderRadius: 6,
                                  padding: '6px 16px', fontSize: 12, fontWeight: 700,
                                  cursor: isSaving ? 'default' : 'pointer',
                                  opacity: isSaving ? 0.5 : 1,
                                  minHeight: 32,
                                }}>
                                {isSuspended ? 'Reactiver' : 'Suspendre'}
                              </button>
                            </div>

                            {/* Notes internes */}
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Notes internes</div>
                              <textarea
                                value={notesValue}
                                onChange={function (e) {
                                  var v = e.target.value;
                                  setNotesDraft(function (prev) { return Object.assign({}, prev, { [c.id]: v }); });
                                }}
                                placeholder="Note libre (contact commercial, remarques, etc.)"
                                rows={3}
                                style={{
                                  width: '100%',
                                  background: 'var(--bg-primary)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  padding: '8px 10px',
                                  fontSize: 12,
                                  fontFamily: 'var(--font-sans)',
                                  resize: 'vertical',
                                  boxSizing: 'border-box',
                                }}
                              />
                              {hasUnsavedNotes ? (
                                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                                  <button
                                    disabled={isSaving}
                                    onClick={function () { saveNotes(c.id); }}
                                    style={{
                                      background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                      border: 'none', borderRadius: 6,
                                      padding: '5px 14px', fontSize: 12, fontWeight: 700,
                                      cursor: isSaving ? 'default' : 'pointer',
                                      opacity: isSaving ? 0.5 : 1,
                                      minHeight: 32,
                                    }}>
                                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                                  </button>
                                  <button
                                    onClick={function () {
                                      setNotesDraft(function (prev) {
                                        var next = Object.assign({}, prev);
                                        delete next[c.id];
                                        return next;
                                      });
                                    }}
                                    style={{
                                      background: 'transparent', color: 'var(--text-tertiary)',
                                      border: '1px solid var(--border)', borderRadius: 6,
                                      padding: '5px 14px', fontSize: 12, fontWeight: 600,
                                      cursor: 'pointer',
                                      minHeight: 32,
                                    }}>
                                    Annuler
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })() : null}

                      {/* Members */}
                      {isExpanded ? (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', background: 'var(--bg-tertiary)' }}>
                          {isLoadingM ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Chargement...</div>
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

            {/* Super-admins (Sprint 37) */}
            <div style={{ marginTop: 24, background: 'var(--bg-primary)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Super-admins</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {superAdmins.length} compte{superAdmins.length !== 1 ? 's' : ''} avec acces super-admin
                  </div>
                </div>
                {!addingAdmin ? (
                  <button
                    onClick={function () { setAddingAdmin(true); setErr(''); }}
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 32 }}>
                    + Ajouter
                  </button>
                ) : null}
              </div>

              {/* Form ajout */}
              {addingAdmin ? (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12, marginBottom: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
                    Nouveau super-admin
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>UID Firebase (28 caracteres)</label>
                    <input
                      type="text"
                      value={newUid}
                      onChange={function (e) { setNewUid(e.target.value); }}
                      placeholder="Copie depuis Firebase Auth > Users > UID"
                      style={{ width: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={function (e) { setNewEmail(e.target.value); }}
                      placeholder="prenom@example.com"
                      style={{ width: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Role</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['owner', 'admin'] as Array<'owner' | 'admin'>).map(function (r) {
                        var active = newRole === r;
                        return (
                          <button
                            key={r}
                            onClick={function () { setNewRole(r); }}
                            style={{
                              background: active ? 'var(--btn-primary-bg)' : 'var(--bg-primary)',
                              color: active ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                              border: '1px solid ' + (active ? 'var(--btn-primary-bg)' : 'var(--border)'),
                              borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', minHeight: 28,
                            }}>
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      disabled={savingAdmin}
                      onClick={function () { addSuperAdmin(); }}
                      style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: savingAdmin ? 'default' : 'pointer', opacity: savingAdmin ? 0.5 : 1, minHeight: 32 }}>
                      {savingAdmin ? 'Ajout...' : 'Ajouter'}
                    </button>
                    <button
                      onClick={function () { setAddingAdmin(false); setNewUid(''); setNewEmail(''); setNewRole('admin'); setErr(''); }}
                      style={{ background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 32 }}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Liste */}
              {superAdmins.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Aucun super-admin enregistre (anomalie)</div>
              ) : (
                <div>
                  {superAdmins.map(function (sa) {
                    var isSelf = user && user.uid === sa.uid;
                    var roleColor = sa.role === 'owner' ? 'var(--purple)' : 'var(--info-text)';
                    var roleBg = sa.role === 'owner' ? 'var(--purple-bg)' : 'var(--info-bg)';
                    return (
                      <div key={sa.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          {(sa.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sa.email || '(sans email)'}
                            {isSelf ? <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(toi)</span> : null}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sa.uid}
                          </div>
                        </div>
                        <span style={{ background: roleBg, color: roleColor, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                          {sa.role || 'admin'}
                        </span>
                        {sa.createdAt ? (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {sa.createdAt.split('T')[0]}
                          </span>
                        ) : null}
                        {!isSelf ? (
                          <button
                            onClick={function () { removeSuperAdmin(sa.uid, sa.email || ''); }}
                            title="Retirer ce super-admin"
                            style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0, minHeight: 28 }}>
                            Retirer
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gemini key (read-only) */}
            {geminiKey ? (
              <div style={{ marginTop: 24, background: 'var(--bg-primary)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Clé API Gemini (scan BL)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {geminiKey.substring(0, 8)}...{geminiKey.slice(-4)}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
