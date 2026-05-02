import { useEffect, useState, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, VAPID_PUBLIC_KEY, getMessagingSafe, fcmGetToken, fcmOnMessage } from '../firebase';

/**
 * Hook FCM (Firebase Cloud Messaging) — Phase 1.3 PWA optim.
 *
 * Demande la permission notif APRES la 1ere action utilisateur (pas au load,
 * sinon Chrome bloque le prompt). Stocke le token sur /users/{uid}.fcmToken.
 * Ecoute aussi les messages foreground et les remonte via le callback.
 *
 * Permission lifecycle :
 * - 'default' : pas demande -> on attend une interaction puis on prompt
 * - 'granted' : token recupere et stocke
 * - 'denied' : on respecte, on ne re-demande plus (l'user ira changer dans
 *   les params browser s'il regrette)
 *
 * Le SW dedie est /firebase-messaging-sw.js (a la racine, charge auto par FCM).
 */

interface UseFCMOpts {
  uid: string | null;
  onForegroundMessage?: (title: string, body: string, data?: any) => void;
}

export default function useFCM(opts: UseFCMOpts) {
  var uid = opts.uid;
  var onMsg = opts.onForegroundMessage;
  var [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  var [token, setToken] = useState<string | null>(null);
  var [supported, setSupported] = useState<boolean>(false);
  var registeredRef = useRef<boolean>(false);

  // Detection support au mount
  useEffect(function () {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) { setSupported(false); return; }
    if (!('serviceWorker' in navigator)) { setSupported(false); return; }
    setSupported(true);
  }, []);

  // Ecoute foreground messages (app ouverte)
  useEffect(function () {
    if (!supported || permission !== 'granted') return;
    var unsub: (() => void) | null = null;
    getMessagingSafe().then(function (msg) {
      if (!msg) return;
      unsub = fcmOnMessage(msg, function (payload: any) {
        var n = payload && payload.notification ? payload.notification : {};
        if (onMsg) onMsg(n.title || 'Sapurai', n.body || '', payload.data || {});
      });
    });
    return function () { if (unsub) unsub(); };
  }, [supported, permission, onMsg]);

  // Enregistrement token apres permission granted
  useEffect(function () {
    if (!supported || !uid) return;
    if (permission !== 'granted') return;
    if (registeredRef.current) return;
    registeredRef.current = true;
    (async function () {
      try {
        var msg = await getMessagingSafe();
        if (!msg) return;
        // SW dedie : Firebase utilise /firebase-messaging-sw.js par defaut
        var swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
          || await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        var t = await fcmGetToken(msg, {
          vapidKey: VAPID_PUBLIC_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (t) {
          setToken(t);
          // Stocker sur /users/{uid}.fcmToken pour permettre au backend / Worker
          // de pousser une notif a cet utilisateur.
          await setDoc(doc(db, 'users', uid), { fcmToken: t, fcmUpdatedAt: new Date().toISOString() }, { merge: true });
        }
      } catch (e) {
        console.warn('[useFCM] getToken failed:', e);
        registeredRef.current = false;
      }
    })();
  }, [supported, uid, permission]);

  /**
   * Declenche le prompt de permission. A appeler depuis un handler utilisateur
   * (clic, etc.), pas au load — sinon Chrome bloque le prompt silencieusement.
   */
  async function requestPermission(): Promise<NotificationPermission> {
    if (!supported) return 'denied';
    if (Notification.permission !== 'default') {
      setPermission(Notification.permission);
      return Notification.permission;
    }
    var result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }

  return {
    supported: supported,
    permission: permission,
    token: token,
    requestPermission: requestPermission,
  };
}
