// src/fileStore.ts
//
// Sprint 42 F42.3 - Migration vers Firebase Storage avec fallback Firestore base64.
//
// AVANT (legacy) : stockage base64 dans Firestore (limite ~800 KB / fichier,
//   et compte dans la limite globale 1 MiB du document company-related).
//   Saturait rapidement et bloquait les uploads de scan BL / factures > 500 KB.
//
// MAINTENANT : Firebase Storage (limite ~5 Go par defaut, scaling natif).
//   Convention de chemin : `/files/{companyId}/{fileId}` pour aligner avec
//   storage.rules (Sprint 40 F40.1) qui valide le membership par companyId.
//   Le `fileId` reste de la forme `lt-file-{companyId}-{...}` pour compat
//   ascendante avec les fichiers deja indexes par cette cle dans Firestore.
//
// COMPATIBILITE : `get(key)` essaie d'abord Storage, fallback sur Firestore
//   (legacy). Les anciens fichiers continueront a fonctionner jusqu'a
//   migration explicite. Les nouveaux uploads vont directement dans Storage.

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  ref, uploadString, getDownloadURL, deleteObject, getBytes,
} from 'firebase/storage';
import { db, storage } from './firebase.js';

function extractCompanyId(key: string): string | null {
  // Format attendu : lt-file-{companyId}-{rest}
  var match = /^lt-file-([^-]+)-/.exec(key);
  return match ? match[1] : null;
}

function storagePathFromKey(key: string): string | null {
  var cid = extractCompanyId(key);
  if (!cid) return null;
  return 'files/' + cid + '/' + key;
}

export var fileStore = {
  /**
   * Sauvegarde un fichier en base64 vers Firebase Storage (recommande).
   * Si le format de cle ne permet pas d'extraire un companyId, fallback Firestore.
   */
  set: async function (key: string, value: string): Promise<void> {
    var path = storagePathFromKey(key);
    if (path) {
      try {
        var format: 'data_url' | 'base64' = value.indexOf('data:') === 0 ? 'data_url' : 'base64';
        await uploadString(ref(storage, path), value, format);
        return;
      } catch (e) {
        // Fallback Firestore en cas d'erreur Storage (quota, permissions)
        // eslint-disable-next-line no-console -- observabilite degradation Storage->Firestore (rare, signale via warn)
        console.warn('[fileStore] Storage upload failed, fallback Firestore', e);
      }
    }
    await setDoc(doc(db, 'files', key), { data: value, ts: Date.now() });
  },

  /**
   * Lit un fichier. Cherche d'abord dans Storage (nouveaux uploads),
   * puis Firestore (anciens uploads legacy).
   */
  get: async function (key: string): Promise<{ value: string } | null> {
    var path = storagePathFromKey(key);
    if (path) {
      try {
        var bytes = await getBytes(ref(storage, path));
        var bin = '';
        var u8 = new Uint8Array(bytes);
        for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        var b64 = btoa(bin);
        return { value: 'data:application/octet-stream;base64,' + b64 };
      } catch (e: any) {
        if (e && e.code && e.code.indexOf('not-found') < 0 && e.code.indexOf('object-not-found') < 0) {
          // eslint-disable-next-line no-console -- observabilite erreur Storage read (filtre les not-found legitimes)
          console.warn('[fileStore] Storage read error, fallback Firestore', e);
        }
      }
    }
    var snap = await getDoc(doc(db, 'files', key));
    if (snap.exists()) return { value: snap.data().data };
    return null;
  },

  /**
   * Retourne une URL signee pour acces direct (utile pour <a href> / <img src>).
   * Retourne null si non disponible (fichier legacy en Firestore).
   */
  getDownloadUrl: async function (key: string): Promise<string | null> {
    var path = storagePathFromKey(key);
    if (!path) return null;
    try {
      return await getDownloadURL(ref(storage, path));
    } catch (_e) {
      return null;
    }
  },

  /**
   * Supprime un fichier. Tente Storage puis Firestore (legacy).
   */
  delete: async function (key: string): Promise<void> {
    var path = storagePathFromKey(key);
    if (path) {
      try { await deleteObject(ref(storage, path)); } catch (_) { /* not found ok */ }
    }
    try { await deleteDoc(doc(db, 'files', key)); } catch (_) { /* not found ok */ }
  },
};
