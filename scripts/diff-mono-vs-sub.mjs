#!/usr/bin/env node
/**
 * Sprint 44 instrumentation — diff entre mono-doc /companies/{cid} et
 * ses sous-collections /companies/{cid}/{coll}.
 *
 * A executer pendant la fenetre d'observation Phase A (7 jours) pour valider
 * que le dual-write garde les deux modeles synchrones.
 *
 * Usage :
 *   node scripts/diff-mono-vs-sub.mjs --cid=<COMPANY_ID>
 *   node scripts/diff-mono-vs-sub.mjs --cid=<COMPANY_ID> --entities=dos,tcs
 *   node scripts/diff-mono-vs-sub.mjs --cid=<COMPANY_ID> --verbose
 *
 * Critere de feu vert pour Phase C : 7 jours consecutifs avec
 *   onlyMono:0 onlySub:0 fieldDiffs:0 pour toutes les entites.
 *
 * Prerequis :
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import admin from 'firebase-admin';

// ──────────────────────────────────────────────────────────────────────────
// Args parsing
// ──────────────────────────────────────────────────────────────────────────

var args = process.argv.slice(2);
var opts = { cid: null, entities: ['dos', 'tcs', 'chs', 'dep', 'logs'], verbose: false };
for (var i = 0; i < args.length; i++) {
  var a = args[i];
  if (a.startsWith('--cid=')) opts.cid = a.slice(6);
  else if (a.startsWith('--entities=')) opts.entities = a.slice(11).split(',');
  else if (a === '--verbose' || a === '-v') opts.verbose = true;
}

if (!opts.cid) {
  console.error('Usage : node scripts/diff-mono-vs-sub.mjs --cid=<COMPANY_ID> [--entities=dos,tcs] [--verbose]');
  process.exit(1);
}

// Mapping entite -> nom de sous-collection
// (cf. src/services/dualwrite.ts SUBCOLLECTIONS)
var SUBCOLLECTION_PATH = {
  dos: 'dossiers',
  tcs: 'tcs',
  chs: 'chs',
  dep: 'dep',
  logs: 'logs',
};

// ──────────────────────────────────────────────────────────────────────────
// Diff helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Compare deux objets shallow (champ par champ niveau 1, valeurs primitives
 * ou JSON.stringify pour objets/arrays imbriques).
 * Retourne un array de { field, mono, sub }.
 */
function compareShallow(monoItem, subItem) {
  var diffs = [];
  var keys = new Set([...Object.keys(monoItem || {}), ...Object.keys(subItem || {})]);
  for (var key of keys) {
    var m = monoItem ? monoItem[key] : undefined;
    var s = subItem ? subItem[key] : undefined;
    var mStr = m === undefined ? '__undefined__' : JSON.stringify(m);
    var sStr = s === undefined ? '__undefined__' : JSON.stringify(s);
    if (mStr !== sStr) {
      diffs.push({ field: key, mono: m, sub: s });
    }
  }
  return diffs;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  var db = admin.firestore();

  console.log('Diff mono-doc vs sous-collections');
  console.log('  cid     :', opts.cid);
  console.log('  entities:', opts.entities.join(','));
  console.log('');

  var monoDoc = await db.doc('companies/' + opts.cid).get();
  if (!monoDoc.exists) {
    console.error('Company ' + opts.cid + ' introuvable dans Firestore');
    process.exit(1);
  }
  var monoData = monoDoc.data();

  var globalStatus = { ok: true };

  for (var e = 0; e < opts.entities.length; e++) {
    var entity = opts.entities[e];
    var subPath = SUBCOLLECTION_PATH[entity];
    if (!subPath) {
      console.warn('Entite inconnue : ' + entity + ' (skip)');
      continue;
    }

    var monoArray = Array.isArray(monoData[entity]) ? monoData[entity] : [];
    var subSnap = await db.collection('companies/' + opts.cid + '/' + subPath).get();
    var subData = subSnap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });

    var monoIds = new Set(monoArray.map(function (x) { return x.id; }).filter(Boolean));
    var subIds = new Set(subData.map(function (x) { return x.id; }));

    var onlyMono = [...monoIds].filter(function (i) { return !subIds.has(i); });
    var onlySub = [...subIds].filter(function (i) { return !monoIds.has(i); });

    // Field-by-field diff pour IDs communs
    var fieldDiffs = [];
    var commonIds = [...monoIds].filter(function (i) { return subIds.has(i); });
    for (var c = 0; c < commonIds.length; c++) {
      var id = commonIds[c];
      var m = monoArray.find(function (x) { return x.id === id; });
      var s = subData.find(function (x) { return x.id === id; });
      var fd = compareShallow(m, s);
      if (fd.length > 0) fieldDiffs.push({ id: id, diff: fd });
    }

    var status = onlyMono.length === 0 && onlySub.length === 0 && fieldDiffs.length === 0 ? 'OK' : 'DRIFT';
    if (status === 'DRIFT') globalStatus.ok = false;

    console.log('[' + entity + ' -> ' + subPath + '] ' + status);
    console.log('  mono       : ' + monoArray.length + ' items');
    console.log('  sub        : ' + subData.length + ' items');
    console.log('  onlyMono   : ' + onlyMono.length + (opts.verbose && onlyMono.length ? ' -> ' + onlyMono.slice(0, 5).join(',') : ''));
    console.log('  onlySub    : ' + onlySub.length + (opts.verbose && onlySub.length ? ' -> ' + onlySub.slice(0, 5).join(',') : ''));
    console.log('  fieldDiffs : ' + fieldDiffs.length);
    if (opts.verbose && fieldDiffs.length > 0) {
      console.log('  Sample (5 premiers) :');
      console.log(JSON.stringify(fieldDiffs.slice(0, 5), null, 2));
    }
    console.log('');
  }

  console.log('Resultat global : ' + (globalStatus.ok ? 'OK (zero drift)' : 'DRIFT detecte'));
  process.exit(globalStatus.ok ? 0 : 2);
}

main().catch(function (err) {
  console.error('Erreur :', err);
  process.exit(1);
});
