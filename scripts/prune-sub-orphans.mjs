#!/usr/bin/env node
/**
 * Sprint 45 - Prune sub-doc orphelins (sans correspondance dans le mono-doc array).
 *
 * Cas d'usage : nettoyer le drift initial detecte le 2026-05-17 ou un mirror
 * Phase A initial a cree des sub-docs avec des IDs Firestore auto-gen (xmoh*)
 * qui ne correspondent pas aux IDs `mid()` du mono-array.
 *
 * Idempotent : on lit le mono pour extraire ses IDs, puis on parcourt chaque
 * sub-doc et supprime ceux dont l'ID n'est pas dans le set du mono.
 *
 * Usage :
 *   node scripts/prune-sub-orphans.mjs --cid=<COMPANY_ID>            # dry-run
 *   node scripts/prune-sub-orphans.mjs --cid=<COMPANY_ID> --apply    # ecriture
 *   node scripts/prune-sub-orphans.mjs --cid=<COMPANY_ID> --entities=tcs,dep
 *
 * Prerequis :
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import admin from 'firebase-admin';

var args = process.argv.slice(2);
var APPLY = args.indexOf('--apply') >= 0;
var DRY = !APPLY;
var cidArg = args.find(function (a) { return a.startsWith('--cid='); });
var entArg = args.find(function (a) { return a.startsWith('--entities='); });

if (!cidArg) {
  console.error('Usage : node scripts/prune-sub-orphans.mjs --cid=<COMPANY_ID> [--apply] [--entities=tcs,dep]');
  process.exit(1);
}
var CID = cidArg.split('=')[1];

// Specs : (clef array mono, nom sous-collection)
var ALL_SPECS = [
  { key: 'dos', path: 'dossiers' },
  { key: 'tcs', path: 'tcs' },
  { key: 'chs', path: 'chs' },
  { key: 'dep', path: 'dep' },
  // Note : on ne prune PAS logs - append-only, et c'est mono qui peut etre en avance
];
var entitiesFilter = entArg ? entArg.split('=')[1].split(',').map(function (s) { return s.trim(); }) : null;
var SPECS = entitiesFilter
  ? ALL_SPECS.filter(function (s) { return entitiesFilter.indexOf(s.key) >= 0; })
  : ALL_SPECS;

var BATCH_CHUNK = 400;

async function main() {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  var db = admin.firestore();

  console.log(DRY ? '[DRY-RUN] Aucune suppression' : '[APPLY] Suppressions actives');
  console.log('company : ' + CID);
  console.log('entites : ' + SPECS.map(function (s) { return s.path; }).join(', '));

  var monoDoc = await db.doc('companies/' + CID).get();
  if (!monoDoc.exists) {
    console.error('Company introuvable : ' + CID);
    process.exit(1);
  }
  var data = monoDoc.data() || {};

  var grandTotal = 0;
  for (var i = 0; i < SPECS.length; i++) {
    var spec = SPECS[i];
    var monoArr = Array.isArray(data[spec.key]) ? data[spec.key] : [];
    var monoIds = new Set(monoArr.map(function (item) { return item && item.id ? String(item.id) : null; }).filter(Boolean));

    var subSnap = await db.collection('companies/' + CID + '/' + spec.path).get();
    var orphans = [];
    subSnap.forEach(function (d) {
      if (!monoIds.has(d.id)) orphans.push(d.id);
    });

    console.log('\n[' + spec.path + '] mono=' + monoIds.size + ' sub=' + subSnap.size + ' orphans=' + orphans.length);
    if (orphans.length > 0) {
      console.log('  Sample : ' + orphans.slice(0, 5).join(', '));
    }
    grandTotal += orphans.length;

    if (APPLY && orphans.length > 0) {
      var collRef = db.collection('companies/' + CID + '/' + spec.path);
      for (var off = 0; off < orphans.length; off += BATCH_CHUNK) {
        var slice = orphans.slice(off, off + BATCH_CHUNK);
        var batch = db.batch();
        slice.forEach(function (id) { batch.delete(collRef.doc(id)); });
        await batch.commit();
      }
      console.log('  -> ' + orphans.length + ' supprimes');
    }
  }

  console.log('\n=== TOTAL : ' + grandTotal + ' orphans ' + (APPLY ? 'supprimes' : 'a supprimer (lancer --apply)') + ' ===');
}

main().catch(function (err) {
  console.error('Erreur :', err);
  process.exit(1);
});
