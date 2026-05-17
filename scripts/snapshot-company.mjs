#!/usr/bin/env node
/**
 * Sprint 45 - Snapshot JSON local d'une company avant backfill.
 *
 * Alternative au `gcloud firestore export` qui requiert plan Blaze.
 * Lit /companies/{cid} + ses sous-collections existantes et dump en JSON local.
 * Suffisant comme filet de rollback pour un small dataset.
 *
 * Usage :
 *   node scripts/snapshot-company.mjs --cid=<COMPANY_ID> --out=snapshot.json
 *
 * Restaure (si rollback necessaire) : nouveau script restore-company.mjs
 * a ecrire si jamais on en a besoin. Pour l'instant on garde le JSON pour
 * pouvoir restaurer manuellement si besoin.
 *
 * Prerequis :
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import admin from 'firebase-admin';
import fs from 'fs';

var args = process.argv.slice(2);
var opts = { cid: null, out: null };
for (var i = 0; i < args.length; i++) {
  var a = args[i];
  if (a.startsWith('--cid=')) opts.cid = a.slice(6);
  else if (a.startsWith('--out=')) opts.out = a.slice(6);
}

if (!opts.cid) {
  console.error('Usage : node scripts/snapshot-company.mjs --cid=<COMPANY_ID> [--out=snapshot.json]');
  process.exit(1);
}
if (!opts.out) {
  opts.out = 'snapshot-' + opts.cid + '-' + new Date().toISOString().slice(0, 10) + '.json';
}

// Sous-collections a inclure dans le snapshot
var SUBCOLLECTIONS = ['members', 'billing', 'notifications', 'invites', 'dossiers', 'tcs', 'chs', 'dep', 'logs', 'dual_write_errors'];

async function main() {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  var db = admin.firestore();

  console.log('Snapshot company ' + opts.cid + ' -> ' + opts.out);

  // 1. Doc principal
  var monoDoc = await db.doc('companies/' + opts.cid).get();
  if (!monoDoc.exists) {
    console.error('Company introuvable : ' + opts.cid);
    process.exit(1);
  }

  var snapshot = {
    cid: opts.cid,
    capturedAt: new Date().toISOString(),
    main: monoDoc.data(),
    subcollections: {},
  };

  // 2. Sous-collections
  for (var s = 0; s < SUBCOLLECTIONS.length; s++) {
    var coll = SUBCOLLECTIONS[s];
    var subSnap = await db.collection('companies/' + opts.cid + '/' + coll).get();
    snapshot.subcollections[coll] = subSnap.docs.map(function (d) {
      return Object.assign({ _docId: d.id }, d.data());
    });
    console.log('  ' + coll + ' : ' + snapshot.subcollections[coll].length + ' docs');
  }

  // 3. Compteur du doc principal (taille bruts)
  snapshot.mainArrayCounts = {
    dos: (snapshot.main.dos || []).length,
    tcs: (snapshot.main.tcs || []).length,
    chs: (snapshot.main.chs || []).length,
    dep: (snapshot.main.dep || []).length,
    logs: (snapshot.main.logs || []).length,
  };
  console.log('  Main arrays :', snapshot.mainArrayCounts);

  // Write
  fs.writeFileSync(opts.out, JSON.stringify(snapshot, null, 2));
  var sizeKb = Math.round(fs.statSync(opts.out).size / 1024);
  console.log('\nSnapshot ecrit : ' + opts.out + ' (' + sizeKb + ' KB)');
  console.log('Garde ce fichier hors-repo pour le rollback potentiel.');
}

main().catch(function (err) {
  console.error('Erreur :', err);
  process.exit(1);
});
