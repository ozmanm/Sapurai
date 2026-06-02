// src/useData.js
// Structure Firestore:
// /companies/{companyId} -> { dos, tcs, chs, dep, logs, cfg, name }
// /companies/{companyId}/members/{uid} -> { email, role, name, joinedAt }
// /companies/{companyId}/invites/{code} -> { role, createdBy, expiresAt }
// /users/{uid} -> { companyId, role, email }
//
// Sprint 46 lint cleanup : ce fichier centralise tous les listeners Firestore + le save() avec dual-write.
// Les `console.warn`/`console.error` sont volontaires : observabilite sur erreurs listener, save, FCM,
// tracking sync, dualwrite. Disable file-level pour eviter 17 lignes de bruit. Si un log debug est
// ajoute par erreur, le retirer (pas le justifier).
/* eslint-disable no-console */

import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, setDoc, onSnapshot, collection, deleteDoc, addDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { mirrorToSubcollections, logMirrorResult, persistMirrorErrors } from './services/dualwrite';
import { resolvePrevSnapshot } from './services/prevSnapshot';

var EMPTY = { dos: [], tcs: [], chs: [], dep: [], logs: [], cfg: { fp: 10, ft: 23, fm: 20 } };

export default function useData(uid: string, email: string) {
  var [data, setData] = useState<any>(null);
  var [loading, setLoading] = useState<boolean>(true);
  var [userInfo, setUserInfo] = useState<any>(null); // { companyId, role }
  var [members, setMembers] = useState<any[]>([]);
  var [needSetup, setNeedSetup] = useState<boolean>(false);
  var [notifs, setNotifs] = useState<any[]>([]);
  var [ratings, setRatings] = useState<Record<string, any>>({}); // tokId -> { rating, ratingComment, ratingReasons, ratingAt }
  var [saveError, setSaveError] = useState<string | null>(null);
  var [saveOk, setSaveOk] = useState(false);

  // 1. Check if user belongs to a company
  useEffect(function () {
    if (!uid) { setLoading(false); return; }

    var ref = doc(db, 'users', uid);
    var unsub = onSnapshot(ref, function (snap) {
      if (snap.exists()) {
        var info = snap.data();
        if (info.companyId) {
          setUserInfo(info);
          setNeedSetup(false);
        } else {
          setNeedSetup(true);
          setLoading(false);
        }
      } else {
        // 1. Check sessionStorage: pending join after account creation in Login.jsx (invite flow)
        var pendingJoin = null;
        try { pendingJoin = JSON.parse(sessionStorage.getItem('lt_pending_join') || 'null'); } catch (_e) {}
        if (pendingJoin && pendingJoin.code && pendingJoin.name) {
          sessionStorage.removeItem('lt_pending_join');
          joinWithCode(pendingJoin.code, pendingJoin.name).catch(function (e) {
            // Stocke l'erreur pour affichage ulterieur (ex: email ne matche pas assignedEmail)
            try { sessionStorage.setItem('lt_join_error', (e && e.message) || 'Erreur a la jointure'); } catch (_e) {}
            console.warn('[useData] joinWithCode failed:', e);
            setNeedSetup(true);
            setLoading(false);
          });
          return;
        }
        // 2. Legacy fallback: localStorage for existing anonymous sessions
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem('lt_session') || 'null'); } catch (_e) {}
        if (saved && saved.companyId) {
          setDoc(doc(db, 'companies', saved.companyId, 'members', uid), {
            email: email || '',
            name: saved.name || '',
            role: saved.role || 'viewer',
            joinedAt: new Date().toISOString()
          }).catch(function (e) { console.error('Legacy join member:', e); });
          setDoc(doc(db, 'users', uid), {
            companyId: saved.companyId,
            role: saved.role || 'viewer',
            email: email || '',
            name: saved.name || ''
          }).catch(function (e) { console.error('Legacy join user:', e); });
          return;
        }
        setNeedSetup(true);
        setLoading(false);
      }
    }, function (err) { console.error('Listener user:', err); });

    return function () { unsub(); };
  }, [uid]);

  // 2. Listen to company data once we have companyId
  useEffect(function () {
    if (!userInfo || !userInfo.companyId) return;

    var ref = doc(db, 'companies', userInfo.companyId);
    var unsub = onSnapshot(ref, async function (snap) {
      var compData = snap.exists() ? snap.data() : EMPTY;
      // Inject global Gemini key if company doesn't have its own
      if (!compData.cfg || !compData.cfg.geminiKey) {
        try {
          var globalSnap = await getDoc(doc(db, 'config', 'global'));
          if (globalSnap.exists() && globalSnap.data().geminiKey) {
            compData = Object.assign({}, compData, {
              cfg: Object.assign({}, compData.cfg || {}, { geminiKey: globalSnap.data().geminiKey })
            });
          }
        } catch (_e) {}
      }
      setData(compData);
      setLoading(false);
    }, function (err) { console.error('Listener company:', err); });

    return function () { unsub(); };
  }, [userInfo]);

  // 3. Load members (for admin)
  useEffect(function () {
    if (!userInfo || !userInfo.companyId) return;

    var membersRef = collection(db, 'companies', userInfo.companyId, 'members');
    var unsub = onSnapshot(membersRef, function (snap) {
      var list = [];
      snap.forEach(function (d) { list.push(Object.assign({ uid: d.id }, d.data())); });
      setMembers(list);
    }, function (err) { console.error('Listener members:', err); });

    return function () { unsub(); };
  }, [userInfo]);

  // 4. Touch lastSeen — timestamp on load + every 5 min
  useEffect(function () {
    if (!userInfo || !userInfo.companyId || !uid) return;
    function touch() {
      setDoc(
        doc(db, 'companies', userInfo.companyId, 'members', uid),
        { lastSeen: new Date().toISOString() },
        { merge: true }
      ).catch(function () {});
    }
    touch();
    var iv = setInterval(touch, 5 * 60 * 1000);
    return function () { clearInterval(iv); };
  }, [userInfo]);

  // 4bis. Listener ratings client : parcourt /tracking ou companyId == cid
  // et construit un index tokId -> { rating, ratingComment, ratingReasons, ratingAt }.
  // Ensuite on merge sur `dos` au moment du retour (via computed data).
  useEffect(function () {
    if (!userInfo || !userInfo.companyId) return;
    var q = query(collection(db, 'tracking'), where('companyId', '==', userInfo.companyId));
    var unsub = onSnapshot(q, function (snap) {
      var idx: Record<string, any> = {};
      snap.forEach(function (d) {
        var t = d.data();
        if (typeof t.rating === 'number') {
          // Convertit Timestamp Firestore -> ISO string pour usage cote UI
          var atIso = "";
          if (t.ratingAt) {
            if (typeof t.ratingAt === 'object' && t.ratingAt.toDate) atIso = t.ratingAt.toDate().toISOString();
            else if (typeof t.ratingAt === 'string') atIso = t.ratingAt;
          }
          idx[d.id] = {
            rating: t.rating,
            ratingComment: t.ratingComment || undefined,
            ratingReasons: t.ratingReasons || undefined,
            ratingAt: atIso,
          };
        }
      });
      setRatings(idx);
    }, function (err) { console.error('Listener ratings:', err); });
    return function () { unsub(); };
  }, [userInfo]);

  // 5. Notifications listener (for agents)
  useEffect(function () {
    if (!userInfo || !userInfo.companyId) return;
    var notifsRef = collection(db, 'companies', userInfo.companyId, 'notifications');
    var unsub = onSnapshot(notifsRef, function (snap) {
      var agentNm = (userInfo.name || '').trim().toUpperCase();
      var role = (userInfo.role || '').trim().toLowerCase();
      var list = [];
      snap.forEach(function (d) {
        var n = d.data();
        if (n.read) return;
        if (!n.for) return;
        var target = String(n.for).trim().toUpperCase();
        // Match nom (cas agent) OU role 'ADMIN' si user est admin (Sprint C.2)
        if (target === agentNm || (target === 'ADMIN' && role === 'admin')) {
          list.push(Object.assign({ id: d.id }, n));
        }
      });
      list.sort(function (a, b) { return a.dt < b.dt ? 1 : -1; });
      setNotifs(list);
    }, function (err) { console.error('Listener notifs:', err); });
    return function () { unsub(); };
  }, [userInfo]);

  // Push notif via Worker FCM proxy — best-effort, ne bloque jamais le flow Firestore
  // Recupere les fcmToken des destinataires (members.fcmToken) et appelle le Worker.
  async function pushFCM(targets: string[], title: string, body: string, data?: Record<string, string>) {
    try {
      // Recupere les UIDs cibles dans members
      var snap = await getDocs(collection(db, 'companies', (userInfo && userInfo.companyId) || '', 'members'));
      var tokens: string[] = [];
      snap.forEach(function (memberDoc: any) {
        var m = memberDoc.data();
        var matchAdmin = targets.indexOf('ADMIN') >= 0 && m.role === 'admin';
        var matchByName = targets.some(function (t) { return (m.name || '').toUpperCase() === t.toUpperCase(); });
        if (matchAdmin || matchByName) {
          // On va lire users/{uid}.fcmToken
          tokens.push(memberDoc.id);
        }
      });
      if (tokens.length === 0) return;
      // Recupere les tokens depuis /users/{uid}
      var fcmTokens: string[] = [];
      for (var i = 0; i < tokens.length; i++) {
        try {
          var us = await getDoc(doc(db, 'users', tokens[i]));
          if (us.exists() && us.data().fcmToken) fcmTokens.push(us.data().fcmToken);
        } catch (_e) { /* skip */ }
      }
      if (fcmTokens.length === 0) return;
      // Appel Worker (POST JSON, fire-and-forget — pas de bloquage si Worker down)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fetch('https://fcm-proxy.ozmanm10.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: fcmTokens,
          title: title,
          body: body,
          data: data || {},
        }),
      }).catch(function (e) { console.warn('[pushFCM] worker call failed:', e); });
    } catch (e) {
      console.warn('[pushFCM] failed:', e);
    }
  }

  async function sendNotif(agentNm, msg) {
    if (!userInfo || !userInfo.companyId) return;
    await addDoc(collection(db, 'companies', userInfo.companyId, 'notifications'), {
      for: (agentNm || '').toUpperCase(),
      msg: msg || '',
      dt: new Date().toISOString(),
      read: false
    });
    // Push FCM en parallele (best-effort)
    if (agentNm) pushFCM([agentNm], 'Sapurai', msg || '', { tag: 'notif-agent' });
  }

  // Sprint C.2 : notification systematique aux admins pour chaque action agent
  // (upload doc, modification etat dossier/TC). Utilise le marqueur 'ADMIN'
  // pour cibler tous les utilisateurs avec role admin de la company.
  async function notifyAdmins(msg) {
    if (!userInfo || !userInfo.companyId) return;
    await addDoc(collection(db, 'companies', userInfo.companyId, 'notifications'), {
      for: 'ADMIN',
      msg: msg || '',
      from: userInfo.name || userInfo.email || '',
      dt: new Date().toISOString(),
      read: false
    });
    // Push FCM aux admins
    pushFCM(['ADMIN'], 'Sapurai — action agent', msg || '', { tag: 'notif-admin' });
  }

  async function markNotifsRead() {
    if (!userInfo || !userInfo.companyId || notifs.length === 0) return;
    for (var i = 0; i < notifs.length; i++) {
      await setDoc(doc(db, 'companies', userInfo.companyId, 'notifications', notifs[i].id), { read: true }, { merge: true });
    }
  }

  // Helper: generate unpredictable tracking token
  function genTokId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // Share tracking — write public tracking doc with UUID tokId
  async function shareTracking(dosId) {
    if (!userInfo || !userInfo.companyId) return null;
    var cur = data || EMPTY;
    var d = (cur.dos || []).find(function (x) { return x.id === dosId; });
    if (!d) return null;
    // Generer un tokId stable si absent, et le persister sur le dossier
    var tokId = d.tokId;
    if (!tokId) {
      tokId = genTokId();
      var newDos = (cur.dos || []).map(function (x) { return x.id === dosId ? Object.assign({}, x, { tokId: tokId }) : x; });
      // Merge setDoc direct sur le doc company (contourne save() fire-and-forget)
      await setDoc(doc(db, 'companies', userInfo.companyId), { dos: newDos }, { merge: true });
      setData(Object.assign({}, cur, { dos: newDos }));
    }
    var tcList = (cur.tcs || []).filter(function (t) { return t.did === dosId; });
    var chsList = cur.chs || [];
    var trackDoc: any = {
      companyId: userInfo.companyId,
      cl: d.cl || "",
      bl: d.bl || "",
      cp: d.cp || "",
      da: d.da || "",
      dosSt: d.st || "",   // snapshot du statut dossier pour le widget rating client
      coName: cur.name || "SAPURAI",
      tcs: tcList.map(function (tc) {
        var ch = tc.ch ? chsList.find(function (c) { return c.nm === tc.ch; }) : null;
        return { n: tc.n || "", ty: tc.ty || "20GP", st: tc.st || "PORT", ch: tc.ch || "", cm: ch ? ch.cm || "" : "", tl: ch ? ch.tl || "" : "" };
      }),
      shared: true,
      updatedAt: new Date().toISOString()
    };
    // Sprint 25 #3 : timeline voyage + navire (si recuperee via API armateur)
    if (Array.isArray(d.timeline) && d.timeline.length > 0) trackDoc.timeline = d.timeline;
    if (d.vesselName) trackDoc.vesselName = d.vesselName;
    if (d.voyageNumber) trackDoc.voyageNumber = d.voyageNumber;
    // merge: true pour preserver les champs ecrits par le client (rating, ratingAt...)
    await setDoc(doc(db, "tracking", tokId), trackDoc, { merge: true });
    return "/t/" + tokId;
  }

  // Share client tracking — public URL showing all dossiers for a client
  async function shareClientTracking(clientName) {
    if (!userInfo || !userInfo.companyId) return null;
    var cur = data || EMPTY;
    var dos2 = cur.dos || [];
    var tcs2 = cur.tcs || [];
    var chs2 = cur.chs || [];
    var clientDos = dos2.filter(function (d) { return (d.cl || "") === clientName; });
    if (clientDos.length === 0) return null;
    // Look up or generate stable token for this client
    var cfg = cur.cfg || {};
    var clientTokens = cfg.clientTokens || {};
    var tokId = clientTokens[clientName];
    if (!tokId) {
      tokId = genTokId();
      var newClientTokens = Object.assign({}, clientTokens, {});
      newClientTokens[clientName] = tokId;
      var newCfg = Object.assign({}, cfg, { clientTokens: newClientTokens });
      await setDoc(doc(db, 'companies', userInfo.companyId), { cfg: newCfg }, { merge: true });
      setData(Object.assign({}, cur, { cfg: newCfg }));
    }
    var trackDoc: any = {
      companyId: userInfo.companyId,
      type: "client",
      cl: clientName,
      coName: cur.name || "SAPURAI",
      dos: clientDos.map(function (d) {
        var tcList = tcs2.filter(function (t) { return t.did === d.id; });
        return {
          bl: d.bl || "", cp: d.cp || "", da: d.da || "",
          tcs: tcList.map(function (tc) {
            var ch = tc.ch ? chs2.find(function (c) { return c.nm === tc.ch; }) : null;
            return { n: tc.n || "", ty: tc.ty || "20GP", st: tc.st || "PORT", ch: tc.ch || "", cm: ch ? ch.cm || "" : "", tl: ch ? ch.tl || "" : "" };
          })
        };
      }),
      shared: true,
      updatedAt: new Date().toISOString()
    };
    // merge: true pour preserver d'eventuels champs rating sur docs client multi-dossier
    await setDoc(doc(db, "tracking", tokId), trackDoc, { merge: true });
    return "/t/" + tokId;
  }

  // Auto-sync all shared tracking docs on save
  async function syncTracking(newData) {
    if (!userInfo || !userInfo.companyId) return;
    var dos2 = newData.dos || [];
    var tcs2 = newData.tcs || [];
    var chs2 = newData.chs || [];
    // Sync per-dossier tracking docs (only those with tokId)
    for (var i = 0; i < dos2.length; i++) {
      var d2 = dos2[i];
      if (!d2.tokId) continue;
      try {
        var tRef = doc(db, "tracking", d2.tokId);
        var tSnap = await getDoc(tRef);
        if (tSnap.exists() && tSnap.data().shared) {
          var tcl = tcs2.filter(function (t) { return t.did === d2.id; });
          await setDoc(tRef, {
            companyId: userInfo.companyId,
            cl: d2.cl || "", bl: d2.bl || "", cp: d2.cp || "", da: d2.da || "",
            dosSt: d2.st || "",   // snapshot du statut pour widget rating
            coName: newData.name || "SAPURAI",
            tcs: tcl.map(function (tc) {
              var ch2 = tc.ch ? chs2.find(function (c) { return c.nm === tc.ch; }) : null;
              return { n: tc.n || "", ty: tc.ty || "20GP", st: tc.st || "PORT", ch: tc.ch || "", cm: ch2 ? ch2.cm || "" : "", tl: ch2 ? ch2.tl || "" : "" };
            }),
            shared: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });   // merge pour preserver le rating ecrit par le client
        }
      } catch (e) { console.error('Tracking sync BL:', e); }
    }
    // Sync per-client tracking docs (via cfg.clientTokens)
    var clientTokens = (newData.cfg && newData.cfg.clientTokens) || {};
    var clientNames = Object.keys(clientTokens);
    for (var j = 0; j < clientNames.length; j++) {
      var cl2 = clientNames[j];
      var clTokId = clientTokens[cl2];
      if (!clTokId) continue;
      try {
        var clRef = doc(db, "tracking", clTokId);
        var clSnap = await getDoc(clRef);
        if (clSnap.exists() && clSnap.data().shared) {
          var clDos = dos2.filter(function (d) { return d.cl === cl2; });
          await setDoc(clRef, {
            companyId: userInfo.companyId,
            type: "client",
            cl: cl2,
            coName: newData.name || "SAPURAI",
            dos: clDos.map(function (d) {
              var tcl2 = tcs2.filter(function (t) { return t.did === d.id; });
              return {
                bl: d.bl || "", cp: d.cp || "", da: d.da || "",
                tcs: tcl2.map(function (tc) {
                  var ch3 = tc.ch ? chs2.find(function (c) { return c.nm === tc.ch; }) : null;
                  return { n: tc.n || "", ty: tc.ty || "20GP", st: tc.st || "PORT", ch: tc.ch || "", cm: ch3 ? ch3.cm || "" : "", tl: ch3 ? ch3.tl || "" : "" };
                })
              };
            }),
            shared: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });  // merge pour preserver d'eventuels champs rating
        }
      } catch (e) { console.error('Tracking sync client:', e); }
    }
  }

  // Sanitize : Firestore refuse les undefined. Nettoie recursivement les objets/arrays.
  function sanitize(v: any): any {
    if (v === undefined) return null;
    if (v === null) return null;
    if (Array.isArray(v)) {
      return v.map(function (x) { return sanitize(x); }).filter(function (x) { return x !== null || true; });
    }
    if (typeof v === 'object' && v.constructor === Object) {
      var out: Record<string, any> = {};
      Object.keys(v).forEach(function (k) {
        var sv = sanitize(v[k]);
        if (sv !== undefined) out[k] = sv;
      });
      return out;
    }
    return v;
  }

  async function save(newData) {
    if (!userInfo || !userInfo.companyId) return;
    setData(newData);
    setSaveError(null);
    setSaveOk(false);
    var clean = sanitize(newData);
    // Sprint 38E - Capteur taille document Firestore.
    // Limite hard Firestore = 1 048 576 bytes (1 MiB). On warn a 500 KB pour anticiper
    // une migration vers sous-collections (/companies/{id}/dossiers/{dosId} etc.)
    // bien avant l'erreur bloquante "Document exceeds the maximum size".
    try {
      var docSize = JSON.stringify(clean).length;
      if (docSize > 500000) {
        console.warn(
          '[Firestore size warning] companyId=' + userInfo.companyId +
          ' taille=' + Math.round(docSize / 1024) + ' KB (' + docSize + ' bytes). ' +
          'Limite hard = 1024 KB. Envisager migration en sous-collections.'
        );
      }
    } catch (_e) { /* ignore : sanitize() doit garantir la serialisabilite */ }
    // Sprint 46 hotfix incident 2026-05-24 (beta) : prevSnapshot lu depuis Firestore (verite),
    // pas depuis le React state qui peut etre EMPTY/stale. Logique extraite + testee dans
    // services/prevSnapshot.ts (backlog G : barriere CI). Floor = data React (jamais `{}`).
    var prevSnapshot = await resolvePrevSnapshot(
      db, userInfo.companyId, (data as unknown as Record<string, unknown>) || {},
    );
    setDoc(doc(db, 'companies', userInfo.companyId), clean).then(function () {
      setSaveOk(true);
      setTimeout(function () { setSaveOk(false); }, 2000);
      // Miroir sous-collections en arriere-plan (non bloquant).
      mirrorToSubcollections(db, userInfo.companyId, clean, prevSnapshot)
        .then(function (stats) {
          logMirrorResult(userInfo.companyId, stats);
          // Sprint 44 instrumentation : persiste les erreurs en Firestore pour audit
          // ulterieur pendant la fenetre d'observation Phase A.
          persistMirrorErrors(db, userInfo.companyId, stats);
        })
        .catch(function (e) { console.warn('[dualwrite] uncaught', e); });
    }).catch(function (err) {
      console.error('Save error:', err);
      // Message detaille pour aider au diagnostic terrain (code + raison)
      var detail = err && err.code ? err.code : (err && err.message ? err.message : 'inconnue');
      if (err && err.code === 'permission-denied') {
        setSaveError("Permissions insuffisantes (" + detail + "). Demandez a l'admin de verifier vos acces.");
      } else {
        setSaveError("Erreur sauvegarde : " + detail);
      }
    });
    // Sync tracking docs in background
    syncTracking(newData).catch(function (e) { console.error('Tracking sync:', e); });
  }

  // Create a new company (first user)
  async function createCompany(companyName, userName) {
    var companyId = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    
    // 1. Add user as admin member FIRST (allows subsequent company read/write)
    await setDoc(doc(db, 'companies', companyId, 'members', uid), {
      email: email,
      name: userName,
      role: 'admin',
      joinedAt: new Date().toISOString()
    });
    
    // 2. Check for existing data to migrate
    var existingData = EMPTY;
    try {
      var oldRef = doc(db, 'users', uid);
      var oldSnap = await getDoc(oldRef);
      if (oldSnap.exists()) {
        var old = oldSnap.data();
        if (old.dos && old.dos.length > 0) {
          existingData = { dos: old.dos || [], tcs: old.tcs || [], chs: old.chs || [], dep: old.dep || [], logs: old.logs || [], cfg: old.cfg || { fp: 10, ft: 23, fm: 20 } };
        }
      }
    } catch (_e) { }

    // 3. Create company doc
    await setDoc(doc(db, 'companies', companyId), Object.assign({}, existingData, { name: companyName }));
    
    // 4. Link user to company
    await setDoc(doc(db, 'users', uid), {
      companyId: companyId,
      role: 'admin',
      email: email,
      name: userName
    });

    // 5. Save session so admin can reconnect after logout
    try {
      localStorage.setItem('lt_session', JSON.stringify({
        companyId: companyId,
        role: 'admin',
        name: userName
      }));
    } catch (_e) {}
  }

  // Join company with invite code
  // - Valide assignedEmail match (email obligatoire sur l'invite)
  // - Applique responsabilites sur le membre (champ info)
  // - Si assignments[] present, ajoute l'agent comme Intervenant sur chacun de ces dossiers
  //   avec ses taches et permission voirDepenses precises
  async function joinWithCode(code, userName) {
    var invRef = doc(db, 'invites', code.trim().toUpperCase());
    var invSnap = await getDoc(invRef);

    if (!invSnap.exists()) throw new Error("Code d'invitation invalide");
    var inv = invSnap.data();
    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) throw new Error("Code expire");
    if (!inv.companyId) throw new Error("Code invalide (pas de company)");

    // Validation email
    if (inv.assignedEmail && (email || '').toLowerCase().trim() !== String(inv.assignedEmail).toLowerCase().trim()) {
      throw new Error("Ce code d'invitation est reserve a " + inv.assignedEmail);
    }

    // Add as member
    // Sprint 40 F40.1 - les rules Firestore exigent inviteCode dans le memberData
    // pour valider l'auto-creation. La rule hasValidInvite() lookup /invites/{code}
    // et verifie companyId + assignedEmail + role + non utilisee.
    var inviteCode = String(code || '').trim().toUpperCase();
    var memberData: Record<string, any> = {
      email: email,
      name: userName,
      role: inv.role || 'viewer',
      joinedAt: new Date().toISOString(),
      inviteCode: inviteCode,
    };
    if (inv.responsabilites) memberData.responsabilites = inv.responsabilites;
    await setDoc(doc(db, 'companies', inv.companyId, 'members', uid), memberData);

    // Link user
    await setDoc(doc(db, 'users', uid), {
      companyId: inv.companyId,
      role: inv.role || 'viewer',
      email: email,
      name: userName
    });

    // Appliquer les assignments dossiers : ajouter l'agent comme Intervenant sur chaque dossier
    // Note : on lit le doc company AVANT de supprimer l'invite (race condition safe)
    if (Array.isArray(inv.assignments) && inv.assignments.length > 0) {
      try {
        var compRef = doc(db, 'companies', inv.companyId);
        var compSnap = await getDoc(compRef);
        if (compSnap.exists()) {
          var compData = compSnap.data() || {};
          var dosList = (compData.dos || []).slice();
          var newIntervId = function () { return Math.random().toString(36).slice(2, 12); };
          var modified = false;
          inv.assignments.forEach(function (a: any) {
            if (!a.dosId) return;
            var idx = dosList.findIndex(function (d: any) { return d.id === a.dosId; });
            if (idx < 0) return;
            var existingItv = (dosList[idx].itv || []).slice();
            // Si l'agent est deja intervenant (rare, edge case), on met a jour ses taches/voirDepenses
            var existIdx = existingItv.findIndex(function (i: any) { return (i.nm || '').toUpperCase() === userName.toUpperCase(); });
            var newIv = {
              id: existIdx >= 0 ? existingItv[existIdx].id : newIntervId(),
              nm: userName,
              role: 'AGENT',
              taches: Array.isArray(a.taches) ? a.taches : [],
              voirDepenses: !!a.voirDepenses,
            };
            if (existIdx >= 0) existingItv[existIdx] = Object.assign({}, existingItv[existIdx], newIv);
            else existingItv.push(newIv);
            dosList[idx] = Object.assign({}, dosList[idx], { itv: existingItv });
            modified = true;
          });
          if (modified) {
            await setDoc(compRef, { dos: dosList }, { merge: true });
          }
        }
      } catch (e) {
        console.warn('[joinWithCode] Apply assignments failed:', e);
      }
    }

    // Marquer puis supprimer l'invite consommee
    await updateDoc(invRef, { usedBy: uid });
    await deleteDoc(invRef);

    // Save session
    try {
      localStorage.setItem('lt_session', JSON.stringify({
        companyId: inv.companyId,
        role: inv.role || 'viewer',
        name: userName
      }));
    } catch (_e) {}
  }

  // Generate invite code (admin only)
  // Signature : email (obligatoire), assignments (array dossier+taches+voirDepenses), responsabilites
  async function createInvite(role, assignedEmail, assignments, responsabilites) {
    if (!userInfo || userInfo.role !== 'admin') return null;
    if (!assignedEmail || !String(assignedEmail).trim()) throw new Error("Email de l'agent requis");
    var normalizedEmail = String(assignedEmail).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Email invalide");

    var code = Math.random().toString(36).slice(2, 8).toUpperCase();
    var expires = new Date();
    expires.setDate(expires.getDate() + 7);

    // Normalise assignments : drop entries sans dosId, taches->array
    var cleanedAssignments: Array<{ dosId: string; taches: string[]; voirDepenses: boolean }> = [];
    if (Array.isArray(assignments)) {
      assignments.forEach(function (a: any) {
        if (!a || !a.dosId) return;
        cleanedAssignments.push({
          dosId: String(a.dosId),
          taches: Array.isArray(a.taches) ? a.taches.filter(function (t: any) { return typeof t === 'string'; }) : [],
          voirDepenses: !!a.voirDepenses,
        });
      });
    }

    var invData: Record<string, any> = {
      companyId: userInfo.companyId,
      role: role,
      assignedEmail: normalizedEmail,
      createdBy: email,
      createdAt: new Date().toISOString(),
      expiresAt: expires.toISOString(),
    };
    if (cleanedAssignments.length > 0) invData.assignments = cleanedAssignments;
    if (responsabilites && String(responsabilites).trim()) invData.responsabilites = String(responsabilites).trim();

    await setDoc(doc(db, 'invites', code), invData);

    return code;
  }

  // Add member by email (admin only) — generates a shareable invite link
  async function addMemberByEmail(memberEmail, role, name) {
    if (!userInfo || userInfo.role !== 'admin') return null;

    var code = Math.random().toString(36).slice(2, 8).toUpperCase();
    var expires = new Date();
    expires.setDate(expires.getDate() + 7);

    // Sprint 41 F41.6 - Fix P2.14 : unification sur `assignedEmail` (champ canonique).
    // Avant : addMemberByEmail() ecrivait `forEmail` alors que createInvite() et
    // les firestore.rules attendent `assignedEmail`. Les invites etaient ignorees.
    var normalizedMemberEmail = String(memberEmail || '').toLowerCase().trim();
    await setDoc(doc(db, 'invites', code), {
      companyId: userInfo.companyId,
      role: role,
      createdBy: email,
      assignedEmail: normalizedMemberEmail,
      forName: name || '',
      createdAt: new Date().toISOString(),
      expiresAt: expires.toISOString()
    });

    return window.location.origin + '/?invite=' + code;
  }

  // Update member role (admin only)
  async function updateMemberRole(memberUid, newRole) {
    if (!userInfo || userInfo.role !== 'admin') return;
    
    await setDoc(doc(db, 'companies', userInfo.companyId, 'members', memberUid), 
      { role: newRole }, { merge: true });
    await setDoc(doc(db, 'users', memberUid), { role: newRole }, { merge: true });
  }

  // Update assignments d'un membre (agent) sur les dossiers de la company.
  // assignmentsList : Array<{dosId, taches, voirDepenses}>
  // Pour chaque dossier de la company :
  //  - Si dosId est dans assignmentsList -> ajoute/maj l'agent comme Intervenant (taches + voirDepenses)
  //  - Sinon -> retire l'agent comme Intervenant si present
  // Persiste en une seule transaction (setDoc merge).
  async function updateMemberAssignments(memberName, assignmentsList) {
    if (!userInfo || userInfo.role !== 'admin') return;
    if (!memberName) throw new Error("Nom membre requis");
    var assignments = Array.isArray(assignmentsList) ? assignmentsList : [];
    var assignMap: Record<string, { taches: string[]; voirDepenses: boolean }> = {};
    assignments.forEach(function (a: any) {
      if (a && a.dosId) {
        assignMap[a.dosId] = {
          taches: Array.isArray(a.taches) ? a.taches : [],
          voirDepenses: !!a.voirDepenses,
        };
      }
    });

    var compRef = doc(db, 'companies', userInfo.companyId);
    var compSnap = await getDoc(compRef);
    if (!compSnap.exists()) throw new Error("Company introuvable");
    var compData = compSnap.data() || {};
    var dosList = (compData.dos || []).slice();
    var nameUp = String(memberName).toUpperCase();
    var newId = function () { return Math.random().toString(36).slice(2, 12); };

    // Sprint C.1 : verifier l'exclusivite avant ecriture
    // Aucun dossier de assignMap ne doit avoir DEJA un AGENT different
    var conflicts: string[] = [];
    dosList.forEach(function (d: any) {
      if (!assignMap[d.id]) return;
      var otherAgent = (d.itv || []).find(function (i: any) {
        return (i.role || '').toUpperCase() === 'AGENT' && i.nm && (i.nm || '').toUpperCase() !== nameUp;
      });
      if (otherAgent) conflicts.push((d.cl || '?') + ' / ' + (d.bl || '?') + ' (deja assigne a ' + otherAgent.nm + ')');
    });
    if (conflicts.length > 0) {
      throw new Error("Conflit d'exclusivite : " + conflicts.join(', '));
    }

    var newDosList = dosList.map(function (d: any) {
      var existingItv = (d.itv || []).slice();
      var existIdx = existingItv.findIndex(function (i: any) { return (i.nm || '').toUpperCase() === nameUp; });
      var assign = assignMap[d.id];
      if (assign) {
        var iv = {
          id: existIdx >= 0 ? existingItv[existIdx].id : newId(),
          nm: memberName,
          role: existIdx >= 0 ? (existingItv[existIdx].role || 'AGENT') : 'AGENT',
          taches: assign.taches,
          voirDepenses: assign.voirDepenses,
          tachesDone: existIdx >= 0 ? (existingItv[existIdx].tachesDone || []) : [],
        };
        if (existIdx >= 0) existingItv[existIdx] = Object.assign({}, existingItv[existIdx], iv);
        else existingItv.push(iv);
      } else if (existIdx >= 0) {
        // Retirer l'intervenant qui n'est plus assigne
        existingItv.splice(existIdx, 1);
      } else {
        return d; // pas de changement
      }
      return Object.assign({}, d, { itv: existingItv });
    });

    await setDoc(compRef, { dos: newDosList }, { merge: true });
  }

  // Remove member (admin only)
  async function removeMember(memberUid) {
    if (!userInfo || userInfo.role !== 'admin' || memberUid === uid) return;
    var target = members.find(function (m) { return m.uid === memberUid; });
    if (target && target.role === 'admin') {
      var adminCount = members.filter(function (m) { return m.role === 'admin'; }).length;
      if (adminCount <= 1) throw new Error("Impossible de supprimer le dernier administrateur");
    }
    await deleteDoc(doc(db, 'companies', userInfo.companyId, 'members', memberUid));
    await deleteDoc(doc(db, 'users', memberUid));
  }

  // Merge des ratings client sur les dossiers (source verite = /tracking/{tokId})
  var dataWithRatings = (function () {
    var src = data || EMPTY;
    if (!src.dos || src.dos.length === 0 || Object.keys(ratings).length === 0) return src;
    var mergedDos = src.dos.map(function (d: any) {
      if (!d.tokId) return d;
      var r = ratings[d.tokId];
      if (!r) return d;
      return Object.assign({}, d, {
        rating: r.rating,
        ratingComment: r.ratingComment,
        ratingReasons: r.ratingReasons,
        ratingAt: r.ratingAt,
      });
    });
    return Object.assign({}, src, { dos: mergedDos });
  })();

  return {
    data: dataWithRatings,
    save: save,
    loading: loading,
    role: userInfo ? userInfo.role : null,
    companyId: userInfo ? userInfo.companyId : null,
    members: members,
    needSetup: needSetup,
    createCompany: createCompany,
    joinWithCode: joinWithCode,
    createInvite: createInvite,
    addMemberByEmail: addMemberByEmail,
    updateMemberRole: updateMemberRole,
    updateMemberAssignments: updateMemberAssignments,
    removeMember: removeMember,
    shareTracking: shareTracking,
    shareClientTracking: shareClientTracking,
    agentName: userInfo ? (userInfo.name || "") : "",
    notifs: notifs,
    sendNotif: sendNotif,
    notifyAdmins: notifyAdmins,
    markNotifsRead: markNotifsRead,
    saveError: saveError,
    saveOk: saveOk,
  };
}
