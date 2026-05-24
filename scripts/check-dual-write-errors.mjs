#!/usr/bin/env node
/**
 * scripts/check-dual-write-errors.mjs
 *
 * Affiche les N dernieres erreurs du dual-write Phase A pour une company.
 * Outil de diagnostic pour la fenetre d'observation : repere les `prevRead/getDoc : timeout`
 * (canari reseau terrain post-fix beta Sprint 46) et autres erreurs mirror.
 *
 * Usage :
 *   node scripts/check-dual-write-errors.mjs --cid=<COMPANY_ID>
 *   node scripts/check-dual-write-errors.mjs --cid=<COMPANY_ID> --limit=50
 *
 * Prerequis :
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import admin from 'firebase-admin';

var args = process.argv.slice(2);
var cidArg = args.find(function (a) { return a.startsWith('--cid='); });
var limitArg = args.find(function (a) { return a.startsWith('--limit='); });

if (!cidArg) {
  console.error('Usage : node scripts/check-dual-write-errors.mjs --cid=<COMPANY_ID> [--limit=50]');
  process.exit(1);
}
var cid = cidArg.slice(6);
var limit = limitArg ? parseInt(limitArg.slice(8), 10) : 20;

admin.initializeApp({ credential: admin.credential.applicationDefault() });
var db = admin.firestore();

(async function () {
  console.log('check-dual-write-errors');
  console.log('  cid   :', cid);
  console.log('  limit :', limit);
  console.log('');

  // dual_write_errors recent
  var dweRef = db.collection('companies/' + cid + '/dual_write_errors');
  var snap;
  try {
    snap = await dweRef.orderBy('ts', 'desc').limit(limit).get();
  } catch (e) {
    console.error('Erreur lecture dual_write_errors :', e && e.message ? e.message : e);
    process.exit(1);
  }

  console.log('=== dual_write_errors (top ' + limit + ' recents) : ' + snap.size + ' entrees ===');

  // Compteur par type pour reperer rapidement les patterns
  var byType = {};
  snap.forEach(function (d) {
    var x = d.data();
    var type = (x.entity || '?') + (x.mirrorTarget && x.mirrorTarget.indexOf('prevRead') === 0 ? ' [CANARI]' : '');
    byType[type] = (byType[type] || 0) + 1;
  });
  if (snap.size === 0) {
    console.log('  (aucune erreur — beta tient, reseau stable)');
  } else {
    console.log('  Repartition par type :');
    Object.keys(byType).sort().forEach(function (k) {
      console.log('    ' + k + ' : ' + byType[k]);
    });
    console.log('');
    console.log('  Detail (5 plus recents) :');
    var i = 0;
    snap.forEach(function (d) {
      if (i >= 5) return;
      i++;
      var x = d.data();
      var ts = x.ts && x.ts.toDate ? x.ts.toDate().toISOString() : '?';
      var who = x.uid ? ' uid=' + String(x.uid).slice(0, 8) : '';
      console.log('    [' + ts + ']' + who + ' ' + (x.mirrorTarget || '?') + ' -> ' + String(x.errorMessage || '?').slice(0, 120));
    });
  }
  console.log('');

  // Note canari beta
  console.log('Canari beta : surveille `prevRead/getDoc : timeout` -> indique un delete potentiellement saute (reseau terrain).');
  console.log('Zero entree = beta tient meme sur connexion pourrie.');
})().catch(function (err) {
  console.error('Erreur :', err);
  process.exit(1);
});
