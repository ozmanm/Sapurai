// src/components/shared/Sprint46Toast.tsx
// Sprint 46 - Toast first-time-view pour signaler le nouveau cycle de vie TC.
//
// Affichage 1x seulement par utilisateur, persistance via localStorage.
// Clé : 'sapurai_sprint46_seen' = '1' une fois fermé/lu.

import { useEffect, useState } from 'react';

var LS_KEY = 'sapurai_sprint46_seen';

export default function Sprint46Toast() {
  var [visible, setVisible] = useState(false);

  useEffect(function () {
    try {
      var seen = localStorage.getItem(LS_KEY);
      if (!seen) setVisible(true);
    } catch (_e) { /* localStorage inaccessible : ne montre pas */ }
  }, []);

  function dismiss() {
    try { localStorage.setItem(LS_KEY, '1'); } catch (_e) { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div role="dialog" aria-labelledby="sprint46-title" style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      maxWidth: 380,
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderLeftWidth: 4,
      borderLeftColor: 'var(--info, var(--success))',
      borderRadius: 10,
      padding: '14px 16px 12px 16px',
      boxShadow: '0 6px 24px var(--shadow-lg)',
      zIndex: 100000,
      fontFamily: 'var(--font-sans)',
    }}>
      <div id="sprint46-title" style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
        Suivi conteneur — mise à jour
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
        Nouveau cycle de vie : un TC passe maintenant par <strong>Camion assigné</strong> avant <strong>Chargement / Sortie</strong>.
        Cliquez sur "Assigner camion" pour réserver, puis "Confirmer chargement" quand le camion arrive au port.
        L'étape <em>Kati</em> a été retirée du suivi.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={dismiss} style={{
          background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
          border: 'none', borderRadius: 8, padding: '7px 14px',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 36,
        }}>
          Compris
        </button>
      </div>
    </div>
  );
}
