/**
 * Sprint 42 F42.1 - Tests rules Firebase via emulateur.
 *
 * Valide les corrections de securite Sprint 40 F40.1 (P0.1 auto-adhesion) :
 *  - Un utilisateur ne peut pas s'auto-greffer dans une company sans invitation valide
 *  - Un utilisateur ne peut pas changer son propre role apres creation
 *  - Un utilisateur ne peut pas lire les fichiers d'un autre tenant
 *  - Un createur d'invite doit etre admin de la company concernee
 *
 * Prerequis : Firebase emulator suite installe + lance.
 *   npx firebase emulators:start --only firestore
 * Puis lancer : npm test -- --run src/__tests__/rules
 *
 * Ces tests sont SKIPPED par defaut (require emulateur). Pour les activer :
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npm test -- --run src/__tests__/rules
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

var EMULATOR_RUNNING = !!process.env.FIRESTORE_EMULATOR_HOST;
var describeOrSkip = EMULATOR_RUNNING ? describe : describe.skip;

describeOrSkip('Firestore rules — securite multi-tenant (Sprint 42 F42.1)', () => {
  var testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    var rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    testEnv = await initializeTestEnvironment({
      projectId: 'sapurai-test',
      firestore: {
        rules: fs.readFileSync(rulesPath, 'utf8'),
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // P0.1 - Auto-adhesion bloquee
  // ──────────────────────────────────────────────────────────────────────────

  it('refuse auto-join admin sans invitation', async () => {
    // Une company existante existe deja avec un membre legitime
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'Company A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/legitOwner'), {
        email: 'owner@a.com', role: 'admin', joinedAt: '2026-01-01',
      });
    });

    // Attaquant essaie de s'ajouter comme admin de companyA
    var attacker = testEnv.authenticatedContext('attackerUid', { email: 'attacker@evil.com' });
    await assertFails(
      setDoc(doc(attacker.firestore(), 'companies/companyA/members/attackerUid'), {
        email: 'attacker@evil.com',
        role: 'admin',
        joinedAt: '2026-05-16',
      })
    );
  });

  it('refuse auto-join avec un inviteCode qui ne correspond pas a l email', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/owner'), {
        email: 'o@a.com', role: 'admin',
      });
      // Invitation pour user@legit.com
      await setDoc(doc(ctx.firestore(), 'invites/ABCD12'), {
        companyId: 'companyA',
        assignedEmail: 'user@legit.com',
        role: 'viewer',
        createdBy: 'o@a.com',
      });
    });

    // Attaquant avec un autre email essaie d'utiliser cette invite
    var attacker = testEnv.authenticatedContext('attackerUid', { email: 'attacker@evil.com' });
    await assertFails(
      setDoc(doc(attacker.firestore(), 'companies/companyA/members/attackerUid'), {
        email: 'attacker@evil.com',
        role: 'viewer',
        inviteCode: 'ABCD12',
        joinedAt: '2026-05-16',
      })
    );
  });

  it('refuse upgrade de role via invitation (viewer demande mais admin envoye)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/owner'), {
        email: 'o@a.com', role: 'admin',
      });
      await setDoc(doc(ctx.firestore(), 'invites/ABCD12'), {
        companyId: 'companyA',
        assignedEmail: 'user@legit.com',
        role: 'viewer',  // invitation pour role viewer uniquement
        createdBy: 'o@a.com',
      });
    });

    // L'invite legitime essaie de devenir admin
    var user = testEnv.authenticatedContext('userUid', { email: 'user@legit.com' });
    await assertFails(
      setDoc(doc(user.firestore(), 'companies/companyA/members/userUid'), {
        email: 'user@legit.com',
        role: 'admin',  // tentative d'elevation
        inviteCode: 'ABCD12',
        joinedAt: '2026-05-16',
      })
    );
  });

  it('autorise auto-join avec une invitation valide et role correct', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/owner'), {
        email: 'o@a.com', role: 'admin',
      });
      await setDoc(doc(ctx.firestore(), 'invites/ABCD12'), {
        companyId: 'companyA',
        assignedEmail: 'user@legit.com',
        role: 'viewer',
        createdBy: 'o@a.com',
      });
    });

    var user = testEnv.authenticatedContext('userUid', { email: 'user@legit.com' });
    await assertSucceeds(
      setDoc(doc(user.firestore(), 'companies/companyA/members/userUid'), {
        email: 'user@legit.com',
        role: 'viewer',
        inviteCode: 'ABCD12',
        joinedAt: '2026-05-16',
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // P0.1 - users.companyId / role immutables (sauf super-admin)
  // ──────────────────────────────────────────────────────────────────────────

  it('refuse update de users.companyId par self', async () => {
    var user = testEnv.authenticatedContext('userUid', { email: 'user@test.com' });
    // Setup initial via rules (creation autorisee)
    await setDoc(doc(user.firestore(), 'users/userUid'), {
      email: 'user@test.com', companyId: 'companyA', role: 'viewer',
    });

    // Tentative changement de companyId
    await assertFails(
      setDoc(doc(user.firestore(), 'users/userUid'), {
        email: 'user@test.com', companyId: 'companyB', role: 'viewer',
      })
    );
  });

  it('refuse update de users.role par self (elevation interdite)', async () => {
    var user = testEnv.authenticatedContext('userUid', { email: 'user@test.com' });
    await setDoc(doc(user.firestore(), 'users/userUid'), {
      email: 'user@test.com', companyId: 'companyA', role: 'viewer',
    });

    await assertFails(
      setDoc(doc(user.firestore(), 'users/userUid'), {
        email: 'user@test.com', companyId: 'companyA', role: 'admin',
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // P0.1 - Invitations top-level : seul admin de la company peut creer
  // ──────────────────────────────────────────────────────────────────────────

  it('refuse creation d invite par un non-membre', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/owner'), {
        email: 'o@a.com', role: 'admin',
      });
    });

    var stranger = testEnv.authenticatedContext('strangerUid', { email: 'stranger@x.com' });
    await assertFails(
      setDoc(doc(stranger.firestore(), 'invites/HACK01'), {
        companyId: 'companyA',
        assignedEmail: 'me@evil.com',
        role: 'admin',
        createdBy: 'stranger@x.com',
      })
    );
  });

  it('refuse creation d invite par un member non-admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/viewerUid'), {
        email: 'v@a.com', role: 'viewer',  // viewer, pas admin
      });
    });

    var viewer = testEnv.authenticatedContext('viewerUid', { email: 'v@a.com' });
    await assertFails(
      setDoc(doc(viewer.firestore(), 'invites/HACK02'), {
        companyId: 'companyA',
        assignedEmail: 'me@evil.com',
        role: 'admin',
        createdBy: 'v@a.com',
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // P0.1 - Files : acces par membership (pas par users.companyId auto-declare)
  // ──────────────────────────────────────────────────────────────────────────

  it('refuse acces a un fichier d un autre tenant', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/companyA'), { name: 'A' });
      await setDoc(doc(ctx.firestore(), 'companies/companyA/members/userA'), {
        email: 'a@a.com', role: 'admin',
      });
      await setDoc(doc(ctx.firestore(), 'users/userA'), {
        email: 'a@a.com', companyId: 'companyA', role: 'admin',
      });
      await setDoc(doc(ctx.firestore(), 'files/lt-file-companyB-abc-doc.pdf'), {
        data: 'base64...',
      });
    });

    // userA est dans companyA, essaie de lire un fichier de companyB
    var userA = testEnv.authenticatedContext('userA', { email: 'a@a.com' });
    await assertFails(getDoc(doc(userA.firestore(), 'files/lt-file-companyB-abc-doc.pdf')));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Companies/create : 1er createur uniquement
  // ──────────────────────────────────────────────────────────────────────────

  it('autorise creation d une company qui n existe pas', async () => {
    var user = testEnv.authenticatedContext('founderUid', { email: 'founder@new.com' });
    await assertSucceeds(
      setDoc(doc(user.firestore(), 'companies/newCo'), { name: 'New Co' })
    );
  });

  it('refuse creation d une company deja existante (squatting)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/existing'), { name: 'Existing' });
    });

    var attacker = testEnv.authenticatedContext('attackerUid', { email: 'a@evil.com' });
    await assertFails(
      setDoc(doc(attacker.firestore(), 'companies/existing'), { name: 'Hijacked' })
    );
  });
});
