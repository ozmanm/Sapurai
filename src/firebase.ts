// src/firebase.ts — Projet Sapurai
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported as messagingSupported, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCYMOYJwigfnDmThyZo35SI4C_IK0NP-so",
  authDomain: "sapurai-84984.firebaseapp.com",
  projectId: "sapurai-84984",
  storageBucket: "sapurai-84984.firebasestorage.app",
  messagingSenderId: "347109027508",
  appId: "1:347109027508:web:c1b9ab8df00292f9eb71e1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore avec cache local = fonctionne hors ligne
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Sprint 42 F42.3 - Firebase Storage pour les pieces jointes (fileStore).
// Bucket par defaut configure dans firebaseConfig.storageBucket.
// Note : Storage necessite le plan Blaze pour les uploads. Sur Spark, le
// fallback Firestore (legacy) reste actif via fileStore.ts.
export const storage = getStorage(app);

// FCM (Cloud Messaging) — Phase 1.3 PWA optim
// Cle VAPID publique (safe en client) : a regenerer dans Firebase Console -> Cloud Messaging -> Web Push certificates
export const VAPID_PUBLIC_KEY = 'BInLHtdZFzL9qe11TcdujcngsPwoAe9U0ctDNwm4erx79kueF7yYaQ7XIqWF2GqTHqzEnbz82ANe1Q1p4VH1luA';

// URL du Worker Cloudflare qui detient la Server Key et envoie les push.
// A configurer apres deploy du Worker (cf. README workers/fcm-proxy).
export const FCM_PROXY_URL = 'https://fcm-proxy.ozmanm10.workers.dev';

// Lazy init Messaging — peut throw sur browsers non supportes (Safari < 16, etc.)
// On wrap dans une promise pour eviter les crashes en SSR / iOS ancien.
let messagingInstance: Messaging | null = null;
let messagingChecked = false;

export async function getMessagingSafe(): Promise<Messaging | null> {
  if (messagingChecked) return messagingInstance;
  messagingChecked = true;
  try {
    const supported = await messagingSupported();
    if (!supported) return null;
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (e) {
    // eslint-disable-next-line no-console -- diagnostic init FCM (echec silencieux sinon, signale via warn)
    console.warn('[firebase] getMessaging not supported:', e);
    return null;
  }
}

export { getToken as fcmGetToken, onMessage as fcmOnMessage };

