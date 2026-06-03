/**
 * Backlog O (Sprint 47) - Tests rules field-level financier via emulateur.
 *
 * Verifie le durcissement par tier des sous-collections (reclassification Sprint 47) :
 *  - Tier 1 (dossiers, admin-only) : rv, pf, gar_frais, gar_caution, gar_*_unit (MONTANTS
 *                                    strategiques) -> editor/agent ne peuvent PAS changer
 *  - Tier 3 (dep, admin+editor)    : mt, ht        -> agent ne peut PAS changer (editor oui)
 *  - Tier 3 (tcs, admin+editor)    : pc            -> agent ne peut PAS changer (editor oui)
 *  - Operationnel (libre)          : gar_statut/gar_contact/gar_tel, dep.s/status -> tous
 *                                    (constatations tracees par wLog, pas des engagements
 *                                    chiffres ; 4-eyes ecarte sur les statuts). Tier 2 dissous.
 *
 * Decision de cadrage (cf. echange Sprint 47) : enforcement sur UPDATE uniquement, CREATE
 * reste permissif (l'UI masque les financiers a la creation, payload create neutre). Le
 * vecteur de fraude est la mutation, pas la creation.
 *
 * !!! TEST CRITIQUE !!! Les cas "reecrit <champ protege> a l'identique -> ALLOW" sont les
 * SEULS qui distinguent l'implementation correcte (diff().affectedKeys(), base VALEUR) d'une
 * fausse "simplification" en keys().hasAny() (base PRESENCE). Sans eux, une reecriture du
 * mirror batch.set full-doc (qui renvoie toutes les clefs presentes) serait refusee a tort,
 * et O serait incompatible avec le write-model Phase A. Si quelqu'un reecrit la rule en
 * keys().hasAny(...), CES tests doivent casser. Ne pas les retirer "parce qu'ils font doublon".
 *
 * Prerequis : Firebase emulator lance.
 *   npm run emulators        (ou npx firebase emulators:start --only firestore)
 * Puis : npm run test:rules
 * SKIPPED par defaut sans FIRESTORE_EMULATOR_HOST (gate local, non bloquant CI).
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

var EMULATOR_RUNNING = !!process.env.FIRESTORE_EMULATOR_HOST;
var describeOrSkip = EMULATOR_RUNNING ? describe : describe.skip;

// Baselines seedes avant chaque test (valeurs non-neutres pour que tout changement diff).
var DOS_BASE = {
  id: 'd1', did: 'd1', st: 'INITIALISE', cl: 'Client X', bl: 'BL-001',
  rv: 1000, pf: 500,
  gar_frais: 0, gar_caution: 0, gar_frais_unit: 0, gar_caution_unit: 0,
  gar_statut: '', gar_contact: '', gar_tel: '',
};
var DEP_BASE = {
  id: 'p1', did: 'd1', lib: 'Frais divers', mt: 1000, ht: 800, s: 'IMPAYE',
};
var TC_BASE = {
  id: 't1', did: 'd1', n: 'TCNU1234567', ty: '20GP', po: 'Dakar', pc: 500, st: 'PORT',
};

describeOrSkip('Firestore rules — financier field-level par tier (backlog O)', () => {
  var testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    var rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    // projectId DISTINCT de firestore-security.test.ts ('sapurai-test') : vitest lance les
    // fichiers en parallele et clearFirestore() est scope par projectId. Sans cette
    // isolation, le beforeEach d'un fichier efface les seeds de l'autre -> PERMISSION_DENIED
    // intermittent sur les assertSucceeds (les get(member) des rules ne trouvent plus le doc).
    testEnv = await initializeTestEnvironment({
      projectId: 'sapurai-test-finance',
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
    // Seed : company + 3 membres (admin/editor/agent) + 1 doc baseline par sous-collection.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      var db = ctx.firestore();
      await setDoc(doc(db, 'companies/co1'), { name: 'Co1' });
      await setDoc(doc(db, 'companies/co1/members/adminUid'), { email: 'a@co1.com', role: 'admin' });
      await setDoc(doc(db, 'companies/co1/members/editorUid'), { email: 'e@co1.com', role: 'editor' });
      await setDoc(doc(db, 'companies/co1/members/agentUid'), { email: 'g@co1.com', role: 'agent' });
      await setDoc(doc(db, 'companies/co1/dossiers/d1'), DOS_BASE);
      await setDoc(doc(db, 'companies/co1/dep/p1'), DEP_BASE);
      await setDoc(doc(db, 'companies/co1/tcs/t1'), TC_BASE);
    });
  });

  function db(uid: string) {
    return testEnv.authenticatedContext(uid, { email: uid + '@co1.com' }).firestore();
  }
  // setDoc full-doc = exactement le mirror batch.set(docRef, item) de production (update).
  function dosRef(uid: string) { return doc(db(uid), 'companies/co1/dossiers/d1'); }
  function depRef(uid: string) { return doc(db(uid), 'companies/co1/dep/p1'); }
  function tcRef(uid: string) { return doc(db(uid), 'companies/co1/tcs/t1'); }

  // ── DOSSIERS — Tier 1 (rv/pf/gar_*) admin-only ──

  it('dossiers : admin change rv -> ALLOW', async () => {
    await assertSucceeds(setDoc(dosRef('adminUid'), Object.assign({}, DOS_BASE, { rv: 9000 })));
  });

  it('dossiers : editor change rv -> DENY', async () => {
    await assertFails(setDoc(dosRef('editorUid'), Object.assign({}, DOS_BASE, { rv: 9000 })));
  });

  it('dossiers : agent change rv -> DENY', async () => {
    await assertFails(setDoc(dosRef('agentUid'), Object.assign({}, DOS_BASE, { rv: 9000 })));
  });

  it('dossiers : editor change gar_frais (montant) -> DENY', async () => {
    await assertFails(setDoc(dosRef('editorUid'), Object.assign({}, DOS_BASE, { gar_frais: 5000 })));
  });

  it('dossiers : agent change gar_caution (montant) -> DENY', async () => {
    await assertFails(setDoc(dosRef('agentUid'), Object.assign({}, DOS_BASE, { gar_caution: 5000 })));
  });

  // Reclassification Sprint 47 : gar_statut/gar_contact/gar_tel = etats operationnels (ex hors
  // Tier 1). Un toggle de statut garantie / une coordonnee n'est pas un engagement chiffre :
  // editor ET agent peuvent les changer (updateGarantie en prod tourne sous session editor/agent).
  it('dossiers : editor change gar_statut (operationnel) -> ALLOW', async () => {
    await assertSucceeds(setDoc(dosRef('editorUid'), Object.assign({}, DOS_BASE, { gar_statut: 'VERSEE' })));
  });

  it('dossiers : agent change gar_statut (operationnel) -> ALLOW', async () => {
    await assertSucceeds(setDoc(dosRef('agentUid'), Object.assign({}, DOS_BASE, { gar_statut: 'VERSEE' })));
  });

  it('dossiers : agent change gar_contact+gar_tel (operationnel) -> ALLOW', async () => {
    await assertSucceeds(setDoc(dosRef('agentUid'),
      Object.assign({}, DOS_BASE, { gar_contact: 'Armateur X', gar_tel: '770000000' })));
  });

  it('dossiers : editor change st (champ neutre operationnel) -> ALLOW', async () => {
    await assertSucceeds(setDoc(dosRef('editorUid'), Object.assign({}, DOS_BASE, { st: 'PORT' })));
  });

  it('dossiers : agent change st (champ neutre) -> ALLOW', async () => {
    await assertSucceeds(setDoc(dosRef('agentUid'), Object.assign({}, DOS_BASE, { st: 'PORT' })));
  });

  // !!! CRITIQUE : prouve que la rule est base VALEUR (affectedKeys), pas base PRESENCE.
  it('CRITIQUE dossiers : editor REECRIT rv a l identique (no-diff) -> ALLOW', async () => {
    // Meme full-doc que le seed : diff vide -> affectedKeys() vide -> rule passe.
    // Si la rule etait keys().hasAny([...]), ce cas serait refuse a tort (mirror casse).
    await assertSucceeds(setDoc(dosRef('editorUid'), Object.assign({}, DOS_BASE, { st: 'PORT' })));
    await assertSucceeds(setDoc(dosRef('editorUid'), Object.assign({}, DOS_BASE)));
  });

  // ── DEP — Tier 3 (mt/ht) admin+editor ; s/status operationnel libre (Tier 2 dissous) ──

  it('dep : admin change s (statut) -> ALLOW', async () => {
    await assertSucceeds(setDoc(depRef('adminUid'), Object.assign({}, DEP_BASE, { s: 'PAYE' })));
  });

  // Reclassification Sprint 47 : dep.s (statut paiement) = etat operationnel. Un toggle
  // IMPAYE->PAYE est une constatation (la facture EST payee), tracee par wLog, pas une
  // signature financiere -> editor ET agent peuvent le changer (toggleDepSt en prod).
  it('dep : editor change s (operationnel, ex-Tier 2) -> ALLOW', async () => {
    await assertSucceeds(setDoc(depRef('editorUid'), Object.assign({}, DEP_BASE, { s: 'PAYE' })));
  });

  it('dep : agent change s (operationnel, ex-Tier 2) -> ALLOW', async () => {
    await assertSucceeds(setDoc(depRef('agentUid'), Object.assign({}, DEP_BASE, { s: 'PAYE' })));
  });

  it('dep : editor change mt (Tier 3) -> ALLOW', async () => {
    await assertSucceeds(setDoc(depRef('editorUid'), Object.assign({}, DEP_BASE, { mt: 2000 })));
  });

  it('dep : agent change mt (Tier 3) -> DENY', async () => {
    await assertFails(setDoc(depRef('agentUid'), Object.assign({}, DEP_BASE, { mt: 2000 })));
  });

  it('dep : agent change ht (Tier 3) -> DENY', async () => {
    await assertFails(setDoc(depRef('agentUid'), Object.assign({}, DEP_BASE, { ht: 700 })));
  });

  it('dep : editor change lib (champ neutre) -> ALLOW', async () => {
    await assertSucceeds(setDoc(depRef('editorUid'), Object.assign({}, DEP_BASE, { lib: 'Autre' })));
  });

  it('dep : agent change lib (champ neutre) -> ALLOW', async () => {
    await assertSucceeds(setDoc(depRef('agentUid'), Object.assign({}, DEP_BASE, { lib: 'Autre' })));
  });

  // !!! CRITIQUE : symetrie base-valeur sur dep.
  it('CRITIQUE dep : agent REECRIT mt+s a l identique (no-diff) -> ALLOW', async () => {
    await assertSucceeds(setDoc(depRef('agentUid'), Object.assign({}, DEP_BASE, { lib: 'Autre' })));
    await assertSucceeds(setDoc(depRef('agentUid'), Object.assign({}, DEP_BASE, { lib: 'Autre' })));
  });

  // ── TCS — Tier 3 (pc) admin+editor ──

  it('tcs : admin change pc -> ALLOW', async () => {
    await assertSucceeds(setDoc(tcRef('adminUid'), Object.assign({}, TC_BASE, { pc: 800 })));
  });

  it('tcs : editor change pc (Tier 3) -> ALLOW', async () => {
    await assertSucceeds(setDoc(tcRef('editorUid'), Object.assign({}, TC_BASE, { pc: 800 })));
  });

  it('tcs : agent change pc (Tier 3) -> DENY', async () => {
    await assertFails(setDoc(tcRef('agentUid'), Object.assign({}, TC_BASE, { pc: 800 })));
  });

  it('tcs : agent change po (champ neutre) -> ALLOW', async () => {
    await assertSucceeds(setDoc(tcRef('agentUid'), Object.assign({}, TC_BASE, { po: 'Thies' })));
  });

  // !!! CRITIQUE : symetrie base-valeur sur tcs.
  it('CRITIQUE tcs : agent REECRIT pc a l identique (no-diff) -> ALLOW', async () => {
    await assertSucceeds(setDoc(tcRef('agentUid'), Object.assign({}, TC_BASE, { po: 'Thies' })));
    await assertSucceeds(setDoc(tcRef('agentUid'), Object.assign({}, TC_BASE, { po: 'Thies' })));
  });

});
