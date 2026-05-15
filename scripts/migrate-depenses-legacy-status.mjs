#!/usr/bin/env node
/**
 * Sprint 38C - Migration Depense.s legacy -> Depense.status canonique.
 *
 * Pour chaque company, parcourt le tableau `dep[]` et :
 *   - Si `status` absent + `s === 'PAYE'` => set status = 'payee'
 *   - Si `status` absent + `s === 'ATT'`  => set status = 'a_payer'
 *   - Si `status` absent + s absent       => set status = 'a_payer' (defaut prudent)
 *   - Garde `s` pour retrocompatibilite jusqu'au cleanup Sprint suivant.
 *
 * Usage :
 *   node scripts/migrate-depenses-legacy-status.mjs            # dry-run par defaut
 *   node scripts/migrate-depenses-legacy-status.mjs --apply    # ecriture reelle
 *
 * Requiert un service account Firebase Admin via la variable d'env :
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import admin from 'firebase-admin';

var APPLY = process.argv.indexOf('--apply') >= 0;
var DRY = !APPLY;

function deriveStatus(s) {
  if (s === 'PAYE') return 'payee';
  if (s === 'ATT') return 'a_payer';
  return 'a_payer';
}

async function main() {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  var db = admin.firestore();

  console.log(DRY ? '[DRY-RUN] Aucune ecriture' : '[APPLY] Ecritures actives');

  var snap = await db.collection('companies').get();
  console.log('Companies a traiter :', snap.size);

  var totalMigrated = 0;
  var totalSkipped = 0;

  for (var doc of snap.docs) {
    var data = doc.data() || {};
    var dep = Array.isArray(data.dep) ? data.dep : [];
    var changed = false;
    var migratedInCompany = 0;

    var newDep = dep.map(function (d) {
      if (d.status === 'en_attente_facture' || d.status === 'a_payer' || d.status === 'payee') {
        totalSkipped++;
        return d;
      }
      var newStatus = deriveStatus(d.s);
      migratedInCompany++;
      totalMigrated++;
      changed = true;
      return Object.assign({}, d, { status: newStatus });
    });

    if (changed) {
      console.log('  - ' + doc.id + ' : ' + migratedInCompany + ' depenses migrees');
      if (APPLY) {
        await db.collection('companies').doc(doc.id).update({ dep: newDep });
      }
    }
  }

  console.log('\nResume :');
  console.log('  Migrees : ' + totalMigrated);
  console.log('  Deja OK : ' + totalSkipped);
  console.log(APPLY ? 'Ecritures appliquees.' : 'DRY-RUN. Relancer avec --apply pour ecrire.');

  process.exit(0);
}

main().catch(function (err) {
  console.error('Erreur :', err);
  process.exit(1);
});
