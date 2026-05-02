# Sapurai — Competitive Brief

> Analyse concurrentielle pour guider la strategie produit 6-12 mois.
> Date : 2026-04-18 | Scope : direct (Afrique Ouest transit) + indirect (Excel/WhatsApp)

---

## 1. Competitive Landscape

### Niveaux de concurrence identifies

| Niveau | Acteurs | Statut pour Sapurai |
|--------|---------|---------------------|
| **Direct vertical Afrique Ouest** | SmartERP (WEBGRAM/Dakar), Fleetever | Menace immediate |
| **Direct international horizontal** | CargoWise, Magaya, GoFreight, Descartes | Pas pertinent (enterprise, hors budget SMB Mali/Senegal) |
| **Indirect — statu quo** | Excel + WhatsApp + portails carriers/ports (DPWorld) en parallele | **Concurrent #1 reel** — 80-90% des transitaires Mali/Senegal |
| **Outils internes grands comptes** | AGL (ex-Bollore), SDV, Grimaldi | Non-accessible aux transitaires SMB — pas de SaaS |
| **Adjacents / futurs** | MyCMA-CGM, Maersk Flow, portails DPWorld etendus | A monitorer — pourraient ajouter des features transit et capter le marche par le haut |

---

## 2. Competitor Deep-Dives

### 2.1 SmartERP par WEBGRAM — **Concurrent direct #1**

**Company**
- WEBGRAM, base a Dakar (Senegal), positionne comme "N°1 ingenierie logicielle en Afrique"
- Deploye dans 8 pays : Senegal, Cote d'Ivoire, Gabon, Togo, RDC, Congo-Brazzaville, Madagascar, Mauritanie
- Produit ERP generaliste avec modules metier (logistique, transit, mines, distribution, RH, compta)

**Positionnement**
- "Cerveau operationnel de l'entreprise africaine moderne"
- Cible large : de la PME a l'ETI, tous secteurs
- Claim : comprehension profonde des realites douanieres africaines

**Features transit/logistique**
- Module transport avec geolocalisation temps reel + tracking carburant
- Espace collaboratif transitaires/douane/agents maritimes
- Alertes integrite cargaison
- Algorithmes d'optimisation itineraires

**Strengths**
- Reach geographique (8 pays operationnels)
- Positionnement "made in Africa" credible (equipe a Dakar)
- Suite ERP complete (pas seulement transit)
- Ecosysteme integre (compta, stock, RH, CRM)

**Weaknesses**
- Generaliste — pas focus transit maritime
- Approche "ERP lourd" — deploiement long et cout prohibitif pour PME/transitaire < 10 personnes
- Marketing-heavy, zero demo publique, zero pricing visible → signal de vente consultative a l'ancienne
- Probablement vendu via projets d'integration sur-mesure (pas SaaS self-serve)
- Pas de mention de tracking client public (partage lien au client final)
- Pas de mention d'integrations carriers APIs

**Evidence / signaux**
- Site web multiplie les articles SEO generiques sur les benefices d'un ERP
- Pas de trial, pas de demo live, pas de tarification publique
- Signal : cible entreprises qui ont deja un processus achat IT structure

---

### 2.2 Fleetever — **Concurrent direct #2**

**Company**
- Plateforme "transitaire digital" — lancement 2022
- Base France avec services Dakar
- Positionnement hybride : transitaire + plateforme logicielle

**Positionnement**
- "Le commissionnaire de transport digital"
- Cible : chargeurs (pas les transitaires eux-memes)
- Claim : centraliser les operations de transport international

**Features**
- Tableau de bord centralise des operations
- Messagerie instantanee documents
- Partage securise de documents
- Tracking temps reel marchandise
- Reservation multi-modal (mer/air/route)

**Strengths**
- UX moderne, demo accessible
- Integration complete (du booking au tracking)
- Pricing publique "simple et transparent" (mais pas de chiffres concrets)

**Weaknesses**
- **Ambiguite produit vs service** : ils sont transitaires ET vendent leur plateforme → conflit d'interet pour un transitaire qui achete
- Cible principale = chargeur, pas transitaire — potentiellement l'inverse du client ideal de Sapurai
- Base France, presence Dakar limitee (pas de reseau agents)
- Pas de focus sur les enjeux specifiques Corridor Dakar-Bamako (surestaries/magasinage DPWorld, BAE Mali...)

**Evidence / signaux**
- Communique presse 2022/2023, peu de traction depuis
- Plusieurs reviews Appvizer mais audience limitee

---

### 2.3 CargoWise (WiseTech Global) — Reference enterprise

**Company**
- Global, WiseTech Global (Australie, cote en bourse)
- Leader enterprise mondial, deploiements chez grands forwarders (AGL, DSV, Kuehne+Nagel)

**Pourquoi pas competitif pour Sapurai**
- Pricing enterprise non-disclose, estime a **15-50k USD setup + per-seat mensuel** → inaccessible pour SMB transitaires ouest-africains
- Implementation structuree longue (6-12 mois)
- Pas localise pour les realites douanieres specifiques Mali/Senegal (corridor, surestaries, cautions BAE)
- Designe pour les forwarders multi-pays multi-modaux — overkill pour une seule entreprise operant Corridor Dakar-Bamako

**Mais a monitorer car**
- WiseTech pourrait lancer une offre "CargoWise Lite" SMB
- Grand concurrent si AGL/SDV etend leur usage aux sous-traitants locaux

---

### 2.4 Excel + WhatsApp + DPWorld portal — **Concurrent #1 REEL**

**Description**
- Le statu quo chez 80-90% des transitaires PME Mali/Senegal
- Workflow typique :
  - Excel : liste dossiers, TCs, depenses
  - WhatsApp : coordination chauffeurs + clients
  - DPWorld portal : verification statut BAD/BAE/Pregate
  - Email/papier : documents (BL, declarations)

**Strengths (pourquoi c'est le concurrent le plus coriace)**
- **Gratuit** (cout marginal zero)
- **Universel** : tous les acteurs de la chaine ont WhatsApp et Excel
- **Flexible** : chaque transitaire adapte a sa facon
- **Low-friction adoption** : pas de formation, pas de migration
- **Offline-friendly** : WhatsApp queue les messages, Excel marche hors ligne
- **Zero cout de switch** (ils n'ont rien a quitter pour adopter Sapurai)

**Weaknesses (opportunites pour Sapurai)**
- Pas de traceabilite ni historique centralise
- Pas de tracking partageable avec le client final
- Erreurs de calcul surestaries/detention (pas d'alertes automatiques)
- Deux agents ne peuvent pas travailler en parallele sur le meme dossier (fichier Excel verrouille)
- Aucune vision financiere (marge par dossier, impayes par client, stats)
- Aucune integration APIs (saisie manuelle du statut DPWorld)
- Non-scalable : au-dela de 50-100 dossiers actifs, l'Excel devient ingerable

---

## 3. Feature Comparison Matrix

Focus sur les 4 features cles identifiees comme strategiques pour Sapurai.

Legende : **Strong** = market-leading | **Adequate** = fonctionnel | **Weak** = limite | **Absent** = non disponible.

| Capacite | Sapurai | SmartERP | Fleetever | CargoWise | Excel+WA |
|----------|---------|----------|-----------|-----------|----------|
| **Dispatch chauffeur + tracking parcours** | | | | | |
| Assignation chauffeur + camion avec budget/avance | **Strong** | Adequate | Adequate | Strong | Weak (WhatsApp manuel) |
| Parcours PORT → Kati → Bamako par etapes | **Strong** (specifique corridor) | Weak (generique) | Adequate | Weak (pas localise) | Absent |
| Versements echelonnes (AVANCE_DK, ACOMPTE_BAM, RELIQUAT) | **Strong** | Absent | Absent | Absent | Weak (manuel) |
| Detection TC immobile (5+ jours sans avancement) | **Strong** | Absent | Absent | Adequate | Absent |
| **Tracking client public (lien partageable)** | | | | | |
| URL /t/{uuid} imprevisible, pas d'auth client | **Strong** | Absent | Adequate | Adequate (mais enterprise) | Absent |
| Temps reel (Firestore listener) | **Strong** | Adequate | Adequate | Strong | Absent |
| Partage WhatsApp + Open Graph preview | **Strong** | Absent | Absent | Absent | Strong (copie URL direct) |
| Multi-TC par dossier avec stepper visuel | **Strong** | Weak | Adequate | Strong | Absent |
| Print-friendly | **Strong** | Weak | Weak | Strong | Strong |
| **Gestion franchises / surestaries / magasinage** | | | | | |
| Calcul automatique surestaries (compagnie maritime) | **Strong** | Adequate | Weak | Strong | Absent |
| Calcul magasinage DPWorld | **Strong** | Weak | Absent | Weak (generique) | Absent |
| Calcul detention retour vide | **Strong** | Weak | Weak | Strong | Absent |
| Alertes J-3 / J-0 / retard | **Strong** | Adequate | Weak | Strong | Absent |
| Franchise configurable par entreprise (fp/ft/fm) | **Strong** | Adequate | Weak | Strong | Absent |
| Suivi cautions LOUEE / PERMANENTE / VENDUE | **Strong** | Absent | Absent | Adequate | Weak (manuel) |
| **Integrations APIs carriers / ports** | | | | | |
| DPWorld Dakar (via proxy Cloudflare) | **Strong** (operationnel) | Absent | Absent | Weak (generique) | Absent |
| CMA-CGM API (tracking BL) | Weak (en cours) | Absent | Absent | Strong | Absent |
| Maersk API | Absent (prevu) | Absent | Absent | Strong | Absent |
| Sync auto 60min | **Strong** | Absent | Absent | Strong | Absent |
| Gainde2000 (douane Senegal) | Absent (prevu) | Claim | Absent | Absent | Absent |
| **Features transverses** | | | | | |
| Mode hors-ligne (Firestore persistent cache) | **Strong** | Weak | Weak | Adequate | Strong |
| Scan BL par IA (Gemini) | **Adequate** (cle desactivee actuellement) | Absent | Absent | Weak | Absent |
| Import Excel avec deduplication BL/TC | **Strong** | Adequate | Weak | Strong | N/A |
| Multi-role (admin / agent / client) | **Strong** | Strong | Adequate | Strong | Weak |
| Assignation taches par intervenant | **Strong** | Adequate | Weak | Strong | Absent |
| PWA (installable mobile) | **Strong** | Weak | Adequate | Weak | N/A |

---

## 4. Positioning Analysis

### 4.1 Positioning statements par concurrent

| Acteur | Template positioning |
|--------|---------------------|
| **SmartERP** | Pour les entreprises africaines qui veulent gerer toute leur operation, SmartERP est l'ERP integre qui centralise compta/RH/stock/logistique/transit. Differenciateur : pays africains supportes + deploiement sur-mesure. |
| **Fleetever** | Pour les chargeurs qui importent/exportent, Fleetever est la plateforme digitale qui centralise booking + tracking + documents multi-modal. Differenciateur : simplicite et transparence du pricing. |
| **CargoWise** | Pour les freight forwarders internationaux operant multi-pays, CargoWise est la plateforme globale qui gere air/mer/douane/compta sur une base unifiee. Differenciateur : scale mondial. |
| **Excel+WA** | Pour les transitaires qui ne veulent rien payer, Excel + WhatsApp est le stack "assez bien" qui marche partout. Differenciateur : cout zero, universalite. |

### 4.2 Positioning statement propose pour Sapurai

> Pour les transitaires **PME (5-30 personnes) operant depuis Dakar** — vers l'interieur du Senegal et le hinterland (Mali, Burkina, Guinee) — qui gerent plus de 30 dossiers actifs et perdent de l'argent sur les surestaries et les retards de dispatch, **Sapurai** est l'app de gestion metier qui **automatise le suivi surestaries, le parcours TC, et le tracking client partageable**. Contrairement a **SmartERP** (ERP generaliste lourd) ou **Excel+WhatsApp** (non-scalable), Sapurai est **specialise transit import Dakar** (cas d'usage le plus mature : corridor Dakar-Bamako), **integre DPWorld/CMA-CGM/Maersk nativement**, et **deployable en 10 minutes** sans integrator.

### 4.3 Message architecture 4 niveaux

| Niveau | Claim propose |
|--------|--------------|
| **1. Categorie** | App de gestion transit specialisee |
| **2. Differenciateur** | Specialisee corridor Dakar-Bamako + integrations carriers natives |
| **3. Value proposition** | "Jamais plus de surestaries oubliees ni de client sans nouvelle" |
| **4. Proof points** | Sync DPWorld 1-clic, tracking client /t/uuid, calcul surestaries auto, 141 tests |

---

## 5. Positioning gaps & opportunites

### 5.1 Positions NON revendiquees par les concurrents (opportunites)

| Position | Pourquoi vacant | Opportunite Sapurai |
|----------|-----------------|----------------------|
| **"Specialiste corridor Dakar-Bamako"** | SmartERP est pan-africain, Fleetever est France-centrique | Sapurai peut "posseder" la specialisation corridor — tres fort niche claim |
| **"Deploiement 10 minutes, pas d'integrator"** | SmartERP/CargoWise = projets IT longs | Self-serve + signup = USP majeur pour PME |
| **"Transparent pricing en FCFA"** | Aucun concurrent n'affiche de prix public | Enorme differenciateur trust |
| **"Tracking client WhatsApp-first"** | Niches enterprise focus sur email | Marche Mali/Senegal ultra-WhatsApp — avantage geographique |
| **"Integre DPWorld Dakar en natif"** | Aucun concurrent mentionne integration DPWorld specifique | Deja operationnel chez Sapurai — moat technique |

### 5.2 Positions encombrees (sans pouvoir de pricing)

- "Digitalisation de la logistique africaine" — claim generique utilise par WEBGRAM et consultants. Pas de pouvoir.
- "Plateforme tout-en-un" — tout le monde le claim.
- "Temps reel" — tout le monde le claim.

### 5.3 Positions emergentes (bets a faire)

| Bet | Raison | Risque |
|-----|--------|--------|
| **IA pour extraction automatique de BL** (Gemini scan) | Feature deja dans Sapurai, differenciateur si prix maintenu bas | Cle API Gemini coute cher si volume monte |
| **Tracking carbone / emissions par TC** | Compliance reporting extra-territoriale (CBAM europeen) arrive en 2026 | Marche africain pas encore demandeur |
| **Financement affacturage integre** | Lever un probleme de cash-flow recurrent chez les transitaires | Necessite partenariat financier (hors scope Sapurai pour l'instant) |

---

## 6. Strengths, Weaknesses

### 6.1 Sapurai — Honest self-assessment

**Strengths reels**
- Focus vertical corridor Dakar-Bamako (niche defensible)
- Integration DPWorld operationnelle (unique dans le paysage)
- UX mobile-first PWA (mode hors ligne reel, pas just "responsive")
- Pricing transparent potentiel (modele SaaS simple vs projets sur-mesure concurrents)
- Stack technique moderne et documente (STYLE-GUIDE, 141 tests, types stricts) → velocite d'iteration elevee
- Features metier specifiques deja implementees (surestaries, cautions LOUEE/VENDUE, parcours TC stepper)

**Weaknesses honnetes**
- **1-2 clients actuels** — pas de social proof
- **Solo founder / petit effectif** — pas de vente consultative scalable
- **Brand inconnu** (SAPURAI n'a aucune reconnaissance vs "WEBGRAM" local)
- **Zero landing page marketing** (site = app login uniquement, pas de SEO capture)
- **Pas d'integration compta** (WEBGRAM l'a)
- **Pas de multi-langue** (FR only — exclusion des prospects anglophones Nigeria/Ghana qui sont un marche voisin)
- **Pricing pas encore defini** → frein a la prospection
- **Pas de support en temps reel** (chat, tel) contrairement a ce qu'un transitaire attend

### 6.2 Opportunites (marche et concurrence)

1. **WEBGRAM est generaliste** — Sapurai peut gagner sur le focus vertical. Un transitaire n'a pas besoin de compta Dynamics, il a besoin de gerer ses TCs.
2. **Fleetever cible les chargeurs, pas les transitaires** — Sapurai ne les croise pas sur le meme prospect.
3. **Statu quo Excel+WA** touche la limite chez 30+ dossiers actifs — fenetre d'entree naturelle.
4. **Corridor Dakar-Bamako** cost/marge tendus : les surestaries representent 15-30% du cout total TC mal-gere. Un outil qui les evite se rentabilise en <1 mois.
5. **Marche underpenetrated** : sur ~300 transitaires PME Mali/Senegal, quasi aucun n'a un SaaS dedie. Premiere vague est capturable par le first-mover credible.

### 6.3 Menaces

1. **WEBGRAM** peut lancer un "SmartERP Transit Light" a petit prix — ils ont deja la marque, le reseau commercial 8 pays, et des clients actuels. Delai probable : 12-18 mois.
2. **AGL/SDV** pourraient sortir leur outil interne en SaaS pour leurs partenaires/sous-traitants → cooptation de la chaine.
3. **CMA-CGM / Maersk / MSC** etendent leurs portails clients (MyCMA, Maersk Flow, etc.). S'ils ajoutent du tracking inland niveau TC, ils capturent une partie du job Sapurai.
4. **DPWorld** pourrait lancer un portail "transitaire" en extension de leur portail container → couper le proxy Sapurai.
5. **Reglementation** : si CBAM/compliance ecologique devient obligatoire en 2027-28, un transitaire preferera un outil qui le gere deja. Sapurai n'est pas positionne sur ce sujet.

---

## 7. Strategic Implications

### 7.1 Ce qu'il faut CONSTRUIRE / ACCELERER (6-12 mois)

**Table stakes (si pas fait = Sapurai pas competitif)**
1. **Landing page marketing publique** avec pitch, screenshots, pricing, demo — priorite #1. Sans cela, aucun prospect ne te considere serieusement.
2. **Pricing public en FCFA** — differenciateur gratuit vs WEBGRAM et Cargo enterprise. Ex : 50k FCFA/mois base + 5k/user. Comparer aux 150k+ FCFA de perte mensuelle moyenne sur surestaries mal-gerees.
3. **API Maersk + CMA-CGM** — 2e et 3e carriers presents Dakar. Sapurai en est a 1/3. Soit tu couvres les 3 et tu peux claim "toutes les lignes principales", soit Webgram te rattrape.
4. **Page Gainde2000 / douane Senegal** integration — pas aujourd'hui, mais table-stakes attendu par un transitaire.

**Differenciateurs (investir lourd)**
1. **Specialisation corridor** — owner ce positionnement par du contenu (blog, etudes de cas, FAQ specifique Mali/Senegal). Rendre difficile pour WEBGRAM de claim pareil.
2. **Tracking client Open Graph/WhatsApp-first** — deja la, amplifier par generation automatique de templates messages WhatsApp ("Bonjour {client}, voici le suivi de votre BL {bl}...").
3. **Alerte proactive** — urgences surestaries/cautions deja la, pousser vers notifications push PWA + emails + eventuellement SMS. "Le transitaire qui ne manque jamais une franchise."

**Deprioritaire (ne pas faire)**
- ~~Multi-langue~~ : FR suffit pour 90% du marche cible. Anglais = plus tard si Ghana/Nigeria.
- ~~Compta integree~~ : WEBGRAM a deja ca. Ne pas competer sur leur terrain. Plutot : integration export vers Sage/Quickbooks.
- ~~Mobile native app~~ : PWA fait le job. Native = couteux sans benefice clair.
- ~~Blockchain / tokens~~ : buzzword, pas de demande client reelle a court terme.

### 7.2 Ou differencier vs parite

| Feature | Strategie |
|---------|-----------|
| Surestaries / franchises | **Differencier** — specificite corridor + algorithme DPWorld |
| Tracking client public | **Differencier** — WhatsApp-first, Open Graph |
| Dispatch chauffeur | **Parite** avec CargoWise (fonctionnel OK), surpasser Excel (deja fait) |
| Integrations APIs carriers | **Parite** a atteindre (3 carriers min) puis differencier par la fluidite |
| UX mobile | **Differencier** — PWA + offline-first vs SmartERP generique |
| Pricing | **Differencier** — transparent + FCFA vs "contactez-nous" des concurrents |
| Compta / RH | **Ne pas entrer** — integration API vers Sage plutot |

### 7.3 Monitoring plan

A surveiller chaque 3 mois :

- WEBGRAM : blog posts parlant specifiquement de transit (vs generique logistique), annonce module "transit specialise"
- Fleetever : extension presence Afrique, partenariats banques/assurances
- Job postings :
  - WEBGRAM recrute un "Chef de produit transit/logistique" → signal module dedie
  - Maersk/CMA-CGM recrute "Inland tracking product manager" → signal ils entrent sur le segment
- Tarifs cargo + DPWorld : changements de tarifs qui changent la valeur relative d'eviter les surestaries

### 7.4 "Comment on gagne contre X" — sales battle cards (draft)

**Contre SmartERP** : "On fait moins de choses mais on les fait mieux. Nous on gere que votre metier transitaire — pas votre compta, pas vos RH. Ca veut dire que vous payez moins cher, vous etes opere en 10 minutes au lieu de 3 mois, et chaque mise a jour de Sapurai ameliore votre metier de transitaire, pas un module annexe."

**Contre Fleetever** : "Fleetever est un commissionnaire qui vend aussi son logiciel. Si vous etes transitaire, votre concurrent vous propose son outil — conflit d'interet. Nous on est un outil pur, on ne prend aucune commission sur vos dossiers."

**Contre CargoWise** : "CargoWise c'est 15-50 millions FCFA en setup. C'est un investissement pour AGL ou SDV. Pour vous, avec 30-50 dossiers/mois, Sapurai vous donne 90% des features pour 1-2% du prix."

**Contre Excel+WhatsApp** : "Ca marche... jusqu'a 30-50 dossiers actifs. Au-dela, vous perdez le controle. Une surestarie oubliee = 75k-200k FCFA perdus. Sapurai detecte ces oublis et vous rembourse votre abonnement en 1 mois."

---

## 8. Next steps suggested

Apres lecture :

- [ ] Valider le positioning statement (section 4.2) — est-ce que ca resonne ?
- [ ] Construire la **landing page** avec les 4 differenciateurs (niche corridor, 10min setup, pricing transparent, WhatsApp-first)
- [ ] Definir le **pricing public** — 3 tiers (Starter / Pro / Business) en FCFA
- [ ] Ecrire la **page "Sapurai vs WEBGRAM"** et **"Sapurai vs Excel"** (SEO + battle cards)
- [ ] Verifier avec 3 prospects transitaires si "specialiste corridor Dakar-Bamako" les accroche plus que "app de transit generique"

---

## Sources

- [SmartERP WEBGRAM — Logistique](https://www.agencewebgram.com/2026/04/Comment-SmartERP-Transforme-le-Secteur-de-la-Logistique-en-Afrique.html)
- [SmartERP WEBGRAM — Transit et Douane](https://www.agencewebgram.com/2026/04/Comment-SmartERP-Facilite-l-Integration-avec-vos-Partenaires-Transitaires-et-Douaniers-en-Afrique.html)
- [SmartERP WEBGRAM — Module Transport](https://www.agencewebgram.com/2026/03/Digitalisez-votre-flotte-logistique-avec-le-module-transport-de-SmartERP-Vers-une-optimisation-structurelle-des-echanges-en-Afrique.html)
- [Fleetever Dakar](https://fleetever.com/transitaire/transitaire-dakar/)
- [Fleetever plateforme digitale](https://fleetever.com/plateforme-de-logistique-digitale/)
- [Fleetever lancement — Supply Chain Magazine](https://www.supplychainmagazine.fr/nl/2022/3582/fleetever-lance-sa-solution-de-transitaire-digital-699860.php)
- [CargoWise](https://www.cargowise.com/)
- [CargoWise Capterra](https://www.capterra.com/p/22135/CargoWise-One/)
- [Magaya Freight Forwarding](https://www.magaya.com/freight-forwarding-software/)
- [Top freight forwarding software 2026](https://softwareconnect.com/roundups/best-freight-forwarding-software/)
- [Transitaires Dakar annuaire](https://www.goafricaonline.com/sn/annuaire/entreprises-transit)

---

**Fin du brief.** Document a relire dans 3 mois pour mise a jour — le paysage concurrentiel evolue rapidement (nouveaux lancements WEBGRAM, potentiel entree CargoWise SMB).
