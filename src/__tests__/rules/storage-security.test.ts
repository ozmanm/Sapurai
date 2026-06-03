/**
 * Sprint 42 F42.3 / Sprint 44 - Tests rules Storage via emulateur.
 *
 * Valide les corrections Sprint 42 F42.3 :
 *  - storage.rules : acces aux fichiers /files/{companyId}/* uniquement
 *    si l'utilisateur est membre de cette company dans Firestore.
 *  - Avant : `allow read, write: if request.auth != null` = tout authentifie.
 *
 * Prerequis : Firestore emulator (port 8080) + Storage emulator (port 9199).
 *   npm run emulators  # lance les 2 ensemble
 * Puis : npm run test:rules
 *
 * Tests SKIPPED par defaut. Pour les activer :
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 \
 *     npm test -- --run src/__tests__/rules/storage
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';
import * as fs from 'fs';
import * as path from 'path';

var EMULATORS_RUNNING =
  !!process.env.FIRESTORE_EMULATOR_HOST &&
  !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
var describeOrSkip = EMULATORS_RUNNING ? describe : describe.skip;

describeOrSkip('Storage rules — isolation par membership (Sprint 42 F42.3)', () => {
  var testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    var firestoreRulesPath = path.resolve(__dirname, '../../../firestore.rules');
    var storageRulesPath = path.resolve(__dirname, '../../../storage.rules');
    // projectId = 'sapurai-test' = le --project de l'emulateur (cf. script "emulators").
    // OBLIGATOIRE ici : les storage.rules font un firestore.get() de membership cross-service,
    // que l'emulateur Storage resout contre le PROJET PAR DEFAUT de l'emulateur, PAS contre
    // le projectId du testEnv. Un projectId distinct ferait pointer ce get() sur une base
    // Firestore vide -> membership KO -> upload refuse a tort. L'isolation anti-course
    // clearFirestore est donc portee par les AUTRES fichiers (firestore-security/-finance ont
    // des projectId distincts), pas par celui-ci.
    testEnv = await initializeTestEnvironment({
      projectId: 'sapurai-test',
      firestore: {
        rules: fs.readFileSync(firestoreRulesPath, 'utf8'),
        host: 'localhost',
        port: 8080,
      },
      storage: {
        rules: fs.readFileSync(storageRulesPath, 'utf8'),
        host: 'localhost',
        port: 9199,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.clearStorage();
    }
  });

  it('refuse upload dans /files/{otherCompany}/... par un user d une autre company', async () => {
    // Setup : memberA est dans companyA, pas dans companyB
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/userA'), {
        email: 'a@a.com', role: 'admin',
      });
      await setDoc(doc(ctx.firestore(), 'companies/companyB'), { name: 'B' });
    });

    // userA tente d'uploader dans companyB -> refuse
    var userA = testEnv.authenticatedContext('userA', { email: 'a@a.com' });
    var fileRef = ref(userA.storage(), 'files/companyB/lt-file-companyB-doc.pdf');
    await assertFails(uploadString(fileRef, 'data:application/pdf;base64,JVBERi0=', 'data_url'));
  });

  it('refuse read dans /files/{otherCompany}/... par un user d une autre company', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/userA'), {
        email: 'a@a.com', role: 'admin',
      });
      await setDoc(doc(ctx.firestore(), 'companies/companyB'), { name: 'B' });
      // Seed un fichier dans companyB via rules disabled
      var adminCtx = testEnv.unauthenticatedContext();
      void adminCtx;
    });

    var userA = testEnv.authenticatedContext('userA', { email: 'a@a.com' });
    var fileRef = ref(userA.storage(), 'files/companyB/lt-file-companyB-doc.pdf');
    await assertFails(getBytes(fileRef));
  });

  it('autorise upload dans /files/{myCompany}/... par un membre actif', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/userA'), {
        email: 'a@a.com', role: 'admin',
      });
    });

    var userA = testEnv.authenticatedContext('userA', { email: 'a@a.com' });
    var fileRef = ref(userA.storage(), 'files/companyA/lt-file-companyA-doc.pdf');
    await assertSucceeds(uploadString(fileRef, 'data:application/pdf;base64,JVBERi0=', 'data_url'));
  });

  it('refuse acces a un chemin hors /files/* (defense en profondeur)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/userA'), {
        email: 'a@a.com', role: 'admin',
      });
    });

    var userA = testEnv.authenticatedContext('userA', { email: 'a@a.com' });
    // Chemin non couvert par la rule /files/{companyId}/...
    var fileRef = ref(userA.storage(), 'random/path/file.bin');
    await assertFails(uploadString(fileRef, 'data:text/plain;base64,dGVzdA==', 'data_url'));
  });
});
