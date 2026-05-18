#!/usr/bin/env node
/**
 * Sprint 43 Phase B - Backfill des sous-collections Firestore.
 *
 * Pour chaque company existante, parcourt les arrays imbriques
 * (dos, tcs, chs, dep, logs) du doc principal et les "explose" en
 * sous-collections individuelles `/companies/{cid}/{coll}/{id}`.
 *
 * Idempotent : `setDoc` ecrase, donc le script peut etre re-execute
 * sans risque. Utilise pour rattraper la divergence apres Phase A.
 *
 * Usage :
 *   node scripts/backfill-subcollections.mjs            # dry-run (defaut)
 *   node scripts/backfill-subcollections.mjs --apply    # ecriture reelle
 *   node scripts/backfill-subcollections.mjs --only=companyId   # une seule company
 *
 * Requiert un service account Firebase Admin :
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Limite batch Firestore = 500 writes par commit. On chunke a 400 par securite.
 */

import admin from 'firebase-admin';

var APPLY = process.argv.indexOf('--apply') >= 0;
var DRY = !APPLY;

var onlyArg = process.argv.find(function (a) { return a.indexOf('--only=') === 0; });
var ONLY_CID = onlyArg ? onlyArg.split('=')[1] : null;

var SUBCOLLECTIONS = [
  { key: 'dos', path: 'dossiers' },
  { key: 'tcs', path: 'tcs' },
  { key: 'chs', path: 'chs' },
  { key: 'dep', path: 'dep' },
  { key: 'logs', path: 'logs' },
];

var BATCH_CHUNK = 400;

async function backfillOneCompany(db, companyId, data) {
  var stats = { written: 0, skipped: 0, perColl: {} };

  for (var i = 0; i < SUBCOLLECTIONS.length; i++) {
    var spec = SUBCOLLECTIONS[i];
    var arr = Array.isArray(data[spec.key]) ? data[spec.key] : [];
    stats.perColl[spec.path] = arr.length;

    if (arr.length === 0) continue;

    var collRef = db.collection('companies').doc(companyId).collection(spec.path);

    // Sprint 45 fix : pour logs (append-only via rules), filtrer les IDs deja
    // existants avant de batch.set() - les rules logs/update sont super-admin only,
    // donc tenter de re-set un log existant fait fail tout le batch.
    var existingIds = new Set();
    if (spec.key === 'logs') {
      var existingSnap = await collRef.select().get();
      existingSnap.forEach(function (d) { existingIds.add(d.id); });
    }

    for (var off = 0; off < arr.length; off += BATCH_CHUNK) {
      var slice = arr.slice(off, off + BATCH_CHUNK);
      // Filtrer les logs deja existants
      var filtered = slice.filter(function (item) {
        if (spec.key !== 'logs') return true;
        var id = item && item.id;
        return id && !existingIds.has(String(id));
      });
      if (DRY) {
        stats.written += filtered.length;
        stats.skipped += slice.length - filtered.length;
        continue;
      }
      if (filtered.length === 0) continue;
      var batch = db.batch();
      for (var j = 0; j < filtered.length; j++) {
        var item = filtered[j];
        var id = item && item.id;
        if (!id) { stats.skipped++; continue; }
        batch.set(collRef.doc(String(id)), item);
      }
      await batch.commit();
      stats.written += filtered.length;
      stats.skipped += slice.length - filtered.length;
    }
  }

  return stats;
}

async function main() {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  var db = admin.firestore();

  console.log(DRY ? '[DRY-RUN] Aucune ecriture' : '[APPLY] Ecritures actives');
  if (ONLY_CID) console.log('Filtre : companyId = ' + ONLY_CID);

  var query = ONLY_CID
    ? db.collection('companies').where(admin.firestore.FieldPath.documentId(), '==', ONLY_CID)
    : db.collection('companies');

  var snap = await query.get();
  console.log('Companies a traiter :', snap.size);

  var grandTotal = { written: 0, skipped: 0 };

  for (var doc of snap.docs) {
    var companyId = doc.id;
    var data = doc.data() || {};
    var stats = await backfillOneCompany(db, companyId, data);
    grandTotal.written += stats.written;
    grandTotal.skipped += stats.skipped;
    console.log(
      '  - ' + companyId + ' :',
      'dos=' + stats.perColl.dossiers,
      'tcs=' + stats.perColl.tcs,
      'chs=' + stats.perColl.chs,
      'dep=' + stats.perColl.dep,
      'logs=' + stats.perColl.logs,
      'written=' + stats.written,
      stats.skipped > 0 ? '(skipped=' + stats.skipped + ' sans id)' : '',
    );
  }

  console.log('\nResume global :');
  console.log('  Writes : ' + grandTotal.written);
  console.log('  Skipped (sans id) : ' + grandTotal.skipped);
  console.log(APPLY ? 'Ecritures appliquees.' : 'DRY-RUN. Relancer avec --apply pour ecrire.');

  process.exit(0);
}

main().catch(function (err) {
  console.error('Erreur :', err);
  process.exit(1);
});
