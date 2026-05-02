// src/fileStore.js
// Stockage de fichiers en base64 dans Firestore (forfait gratuit Firebase)
// Limite : ~800KB par fichier (Firestore doc limit ~1MB)
// Note : Firebase Storage nécessite le forfait Blaze (payant)

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.js';

export var fileStore = {
  set: function (key: string, value: string): Promise<void> {
    return setDoc(doc(db, 'files', key), { data: value, ts: Date.now() });
  },
  get: function (key: string): Promise<{ value: string } | null> {
    return getDoc(doc(db, 'files', key)).then(function (snap) {
      if (snap.exists()) return { value: snap.data().data };
      return null;
    });
  },
  delete: function (key: string): Promise<void> {
    return deleteDoc(doc(db, 'files', key));
  }
};
