# Sapurai — Executive One-Pager

> Pitch strategique 1 page. Usage : board, investisseurs, partenaires strategiques, recruits cle.
> Date : 2026-04-18

---

## Ce que nous faisons

**Sapurai est l'app de gestion metier pour les transitaires PME operant depuis Dakar.**

Cible : transitaires qui gerent l'import par le port de Dakar et la livraison vers :
- L'interieur du Senegal (Touba, Thies, Kaolack, Saint-Louis, Ziguinchor, Tambacounda...)
- Le hinterland (Mali / Bamako, Burkina / Ouagadougou, Guinee)

Le **corridor Dakar-Bamako** est notre cas d'usage le plus mature (integrations DPWorld, surestaries, cautions BAE Mali). Les autres destinations sont supportees et ameliorees en continu.

Nous automatisons ce qu'ils font mal aujourd'hui avec Excel et WhatsApp : le suivi des surestaries, le parcours des conteneurs, le tracking partage avec le client final.

## Le probleme

- **Centaines de transitaires PME** operent depuis Dakar (5-30 personnes)
- **80-90% utilisent Excel + WhatsApp + portails DPWorld** — non scalable > 30 dossiers actifs
- Les **surestaries oubliees coutent 15-30% du cout TC** mal-gere (75-200k FCFA/TC)
- Les **clients finaux appellent 3-5 fois par dossier** pour savoir ou en est leur conteneur

## Notre solution

| Fonctionnalite | Impact client |
|----------------|---------------|
| Alertes surestaries automatiques (DPWorld + compagnie + detention) | Evite 50-150k FCFA par mois de pertes |
| Tracking client public /t/{uuid} partageable WhatsApp | Reduit 70% des appels "ou est mon conteneur" |
| Integration DPWorld Dakar native | Sync statut BAD/BAE/Pregate en 1 clic |
| Dispatch chauffeur + parcours PORT→Kati→Bamako | Tracabilite pour blocages / detournements |
| PWA mobile-first + mode hors ligne | Fonctionne dans les zones 3G et blackouts |

## Positioning

Specialiste transit import depuis Dakar — **pas un ERP generaliste**, **pas un outil de chargeur**. Cas d'usage principal : corridor Dakar-Bamako (le plus mature). Extensions : interieur Senegal et autres pays hinterland.

## Concurrence et defensibilite

| Concurrent | Pourquoi nous gagnons |
|------------|-----------------------|
| **Excel + WhatsApp** (80% du marche) | Bascule naturelle > 30 dossiers actifs |
| **SmartERP (WEBGRAM)** | Eux = ERP generaliste 3-6 mois deploiement. Nous = specialiste, 10 min |
| **Fleetever** | Eux sont transitaires + vendent l'outil (conflit d'interet). Nous = pure tech |
| **CargoWise / Magaya** | Eux = enterprise 15-50M FCFA. Nous = SaaS SMB accessible |

**Moat** : integration DPWorld native (seul sur le marche), specialisation corridor, pricing FCFA transparent.

## Etat actuel

- ✅ App deployee, live sur https://sapurai-84984.web.app
- ✅ Stack technique moderne (React/TS, Firebase, 141 tests, types stricts)
- ✅ Features metier operationnelles (surestaries, dispatch, tracking, integration DPWorld)
- ✅ Documente : STYLE-GUIDE, types domaine, migration plan Firestore
- ⚠ 1-2 clients actuels — phase commerciale pas encore demarree
- ⚠ Pas de landing page publique, pas de pricing affiche

## Plan 6-12 mois

**Product (priorite ordre)**
1. Landing page + pricing public (2 semaines)
2. API Maersk + CMA-CGM (1-2 mois) → couvrir 3/3 carriers principaux
3. Gainde2000 douane Senegal (1 mois) → table-stakes attendu
4. Alertes push multi-canal (3 semaines)

**Go-to-market**
1. 10 prospects qualifies Dakar → pitch direct
2. Content SEO "corridor Dakar-Bamako" pour capturer les recherches
3. Sales battle cards (fait) + pages "vs SmartERP" / "vs Excel"

**Financier (objectif 12 mois)**
- 15 clients payants x 100k FCFA/mois = 1.5M FCFA/mois recurrent
- Coverage break-even solo-founder

## Appel (pour un partenaire / investisseur / recrue)

Nous cherchons :
- Un **premier commercial terrain Dakar** (pas du cold calling en ligne — du reseau local)
- **Partenariats DPWorld, carriers, associations de transitaires** pour co-marketing
- **Financement d'amorcage** : 20-50M FCFA pour 18 mois de runway + salaire commercial

---

*Contact : ibou1003@icloud.com / sapurailogistics@gmail.com*
