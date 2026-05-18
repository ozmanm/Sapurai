#!/usr/bin/env node
/**
 * Sprint 46 - Migration des TC en statut KATI vers TRANSIT.
 *
 * KATI a ete retire du cycle de vie Sprint 46 (cf. tcStateMachine.ts).
 * Les TC encore dans ce statut en prod sont migres vers TRANSIT (statut
 * generique "en route", prudent : pas de presomption d'arrivee Bamako).
 *
 * Le champ `dak` (date arrivee Kati) est PRESERVE (deprecated mais lecture
 * pour exports legacy).
 *
 * Idempotent : `if (tc.st !== 'KATI') continue;` au debut de chaque iteration.
 * Re-execution sans risque - les TC deja migres sont skip silencieusement.
 *
 * Met a jour le mono-doc /companies/{cid} ET la sous-collection
 * /companies/{cid}/tcs/{tcid} (coherence dual-write Phase A).
 *
 * Usage :
 *   node scripts/migrate-kati-to-transit.mjs                     # dry-run, toutes companies
 *   node scripts/migrate-kati-to-transit.mjs --apply             # ecriture toutes companies
 *   node scripts/migrate-kati-to-transit.mjs --only=c_mocpodna9egt --apply
 *
 * Prerequis :
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import admin from 'firebase-admin';

var args = process.argv.slice(2);
var APPLY = args.indexOf('--apply') >= 0;
var DRY = !APPLY;

var onlyArg = args.find(function (a) { return a.indexOf('--only=') === 0; });
var ONLY_CID = onlyArg ? onlyArg.split('=')[1] : null;

async function migrateOneCompany(db, companyId) {
  var monoRef = db.collection('companies').doc(companyId);
  var monoSnap = await monoRef.get();
  if (!monoSnap.exists) {
    return { skipped: true, reason: 'company introuvable' };
  }
  var data = monoSnap.data() || {};
  var tcs = Array.isArray(data.tcs) ? data.tcs : [];

  // Idempotence : on detecte les TC en KATI a migrer
  var katiTcs = tcs.filter(function (tc) { return tc && tc.st === 'KATI'; });
  if (katiTcs.length === 0) {
    return { migrated: 0, skipped: false };
  }

  // Cible : passer st='KATI' a st='TRANSIT', preserver dak (legacy)
  var newTcs = tcs.map(function (tc) {
    if (tc && tc.st === 'KATI') {
      return Object.assign({}, tc, { st: 'TRANSIT' });
    }
    return tc;
  });

  if (DRY) {
    return { migrated: katiTcs.length, dryRun: true, sample: katiTcs.slice(0, 3).map(function (t) { return t.n || t.id; }) };
  }

  // Step 1 : update mono-doc
  await monoRef.update({ tcs: newTcs });

  // Step 2 : update sous-collection /companies/{cid}/tcs/{tcid}
  // (coherence dual-write Phase A : meme transition cote sub-collection)
  var subWrites = 0;
  for (var i = 0; i < katiTcs.length; i++) {
    var tc = katiTcs[i];
    if (!tc.id) continue;
    var subRef = monoRef.collection('tcs').doc(String(tc.id));
    try {
      var subSnap = await subRef.get();
      if (subSnap.exists && subSnap.data() && subSnap.data().st === 'KATI') {
        await subRef.update({ st: 'TRANSIT' });
        subWrites++;
      }
    } catch (e) {
      // sub-doc inexistant ou autre : on ne bloque pas, le mono-doc est source de verite
      console.warn('  [sub-coll] ' + companyId + '/tcs/' + tc.id + ' update skipped:', e.message);
    }
  }

  return { migrated: katiTcs.length, subWrites: subWrites, sample: katiTcs.slice(0, 3).map(function (t) { return t.n || t.id; }) };
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

  var grandTotal = 0;
  var totalSubWrites = 0;
  var affected = [];

  for (var doc of snap.docs) {
    var result = await migrateOneCompany(db, doc.id);
    if (result.skipped) {
      console.log('  - ' + doc.id + ' : skip (' + result.reason + ')');
      continue;
    }
    if (result.migrated === 0) {
      // Silencieux : aucun TC en KATI
      continue;
    }
    var sampleStr = result.sample && result.sample.length > 0 ? ' [' + result.sample.join(', ') + (result.migrated > 3 ? ', ...' : '') + ']' : '';
    console.log('  - ' + doc.id + ' : ' + result.migrated + ' TC migres' + (result.subWrites !== undefined ? ' (' + result.subWrites + ' sub-docs)' : '') + sampleStr);
    grandTotal += result.migrated;
    if (result.subWrites) totalSubWrites += result.subWrites;
    affected.push({ companyId: doc.id, count: result.migrated });
  }

  console.log('\nResume global :');
  console.log('  TC KATI -> TRANSIT : ' + grandTotal);
  if (!DRY) console.log('  sub-coll updates : ' + totalSubWrites);
  console.log(APPLY ? '\nEcritures appliquees.' : '\nDRY-RUN. Relancer avec --apply pour ecrire.');

  if (grandTotal === 0) {
    console.log('\n=> Aucun TC en KATI detecte. Migration deja faite ou base saine.');
  }

  process.exit(0);
}

main().catch(function (err) {
  console.error('Erreur :', err);
  process.exit(1);
});
