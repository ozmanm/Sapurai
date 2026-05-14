/**
 * Migration Sprint 34 — Initialise les champs billing pour les companies legacy.
 *
 * Usage :
 *   1. Creer un projet Firebase, telecharger la cle de service admin :
 *      Console Firebase > Parametres > Comptes de service > "Generer une cle privee"
 *   2. Placer le fichier .json a cote ou passer le chemin en variable :
 *      set FIREBASE_SERVICE_ACCOUNT=chemin/vers/service-account.json
 *   3. Installer firebase-admin (dev dependency) :
 *      npm install --save-dev firebase-admin
 *   4. Lancer :
 *      node scripts/migrate-billing-legacy.mjs
 *
 * Ce que fait le script :
 *   - Parcourt toutes les companies existantes
 *   - Si /billing/profile n'existe PAS, cree un profil trial par defaut
 *   - Ajoute trialEndsAt = aujourd'hui + 30 jours
 *   - Log tout (dry-run possible avec --dry)
 *
 * Securite :
 *   - Ne touche PAS les profils billing existants
 *   - --dry pour voir ce qui serait modifie sans ecrire
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const IS_DRY = process.argv.includes('--dry');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './service-account.json';

let app;
try {
  const serviceAccount = (await import('fs')).existsSync(serviceAccountPath)
    ? JSON.parse((await import('fs')).readFileSync(serviceAccountPath, 'utf-8'))
    : null;
  if (!serviceAccount) {
    console.error('Fichier service account introuvable. Set FIREBASE_SERVICE_ACCOUNT ou place service-account.json a la racine.');
    process.exit(1);
  }
  app = initializeApp({ credential: cert(serviceAccount) });
} catch (e) {
  console.error('Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = getFirestore(app);

async function migrate() {
  const now = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const companiesSnap = await db.collection('companies').listDocuments();

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of companiesSnap) {
    try {
      const billingRef = doc.collection('billing').doc('profile');
      const billingSnap = await billingRef.get();

      if (billingSnap.exists) {
        skipped++;
        continue;
      }

      const profile = {
        billingStatus: 'trial',
        plan: 'trial',
        trialEndsAt: trialEnd,
        subscriptionEndsAt: null,
        lastPaymentAt: null,
        paymentMethod: 'manual',
        internalNotes: 'Migre automatiquement Sprint 34',
        updatedAt: now,
        updatedBy: 'system:migration-sprint-34',
      };

      if (IS_DRY) {
        console.log(`[DRY] Creerait billing pour ${doc.id}:`, JSON.stringify(profile));
      } else {
        await billingRef.set(profile);
        console.log(`[OK]  Billing cree pour ${doc.id}`);
      }
      created++;
    } catch (e) {
      console.error(`[ERR] ${doc.id}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nRapport : ${created} crees, ${skipped} deja presents, ${errors} erreurs`);
  if (IS_DRY) console.log('(dry-run: aucune ecriture reelle)');

  process.exit(errors > 0 ? 1 : 0);
}

migrate();
