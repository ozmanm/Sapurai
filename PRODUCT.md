# Product

## Register

product

## Users

**Transitaires (freight forwarders) basés à Dakar, Sénégal**, qui orchestrent l'arrivée et la livraison de conteneurs maritimes vers :

- l'intérieur du Sénégal (Touba, Thiès, Kaolack)
- l'hinterland enclavé : Mali (Bamako, Kati), Burkina Faso, Guinée

### Profil utilisateur principal

- **Métier traditionnel, peu numérisé.** Habitués au cahier papier, à Excel, à WhatsApp éclaté entre 30+ conversations. Beaucoup ont 10-30 ans d'expérience terrain.
- **Réticents au changement.** Comme leurs interlocuteurs (douane, agents compagnies maritimes, chauffeurs), ils sont méfiants vis-à-vis des outils qui demandent un apprentissage long ou qui changent leurs habitudes brutalement.
- **Multi-device.** Au bureau (desktop) pour la saisie en début/fin de journée, sur smartphone Android (4G dégradée fréquente) en déplacement port + douane + clients.
- **Petites équipes** : 1 patron-fondateur + 1 à 5 agents qui partagent les dossiers, parfois 1 comptable.

### Contexte d'usage

- **Multi-tenant B2B** : chaque compagnie de transit a son espace isolé.
- Le transitaire **partage** des liens de tracking publics à ses clients finaux (importateurs au Sénégal/Mali) qui voient l'avancement de leur conteneur sans avoir à appeler le bureau.
- Travail souvent **hors ligne** : 4G instable au port de Dakar, dans le Sahel, sur la route de Bamako.

### Job to be done

> *"Suivre 30+ dossiers en parallèle sans rater une surestarie, coordonner agents-chauffeurs-douane-armateur, et donner à mon client final l'info qu'il cherche sans qu'il m'appelle 5 fois par jour."*

## Product Purpose

Sapurai remplace le triptyque **cahier + Excel + WhatsApp éclaté** des transitaires de Dakar par un système qui :

- **Anticipe les surestaries** (alertes J-3 avant expiration de franchise) plutôt que constater les pénalités après coup.
- **Synchronise automatiquement** avec DPWorld (port de Dakar : statuts BAD, BAE, Pregate) et les armateurs (CMA-CGM via API Track & Trace, autres en roadmap).
- **Partage le suivi au client final** via un lien public unique par dossier (`/t/<token>`), réduisant les appels téléphoniques.
- **Trace toutes les charges** par TC, garantit la facture finale propre, calcule la marge dossier.

### Succès (mesuré par)

- 0 surestarie oubliée par mois (vs 2-3 actuellement chez les non-utilisateurs)
- Réduction de 50% des appels client "où est mon conteneur ?"
- Adoption complète par 2-5 agents d'une compagnie en moins de 2 semaines, sans formation lourde

## Brand Personality

**Fiable. Robuste. Anticipateur.**

- **Fiable** : la source officielle prime sur la saisie locale. Quand l'armateur dit "ETA 06/05", Sapurai écrase la saisie agent. C'est lui qui facture, c'est lui qui fait foi.
- **Robuste** : utilisable en 4G dégradée, sur Android low-end, hors ligne. Pas de panne quand le réseau lâche au port.
- **Anticipateur** : alertes J-3 avant échéance, pas notifications post-mortem. Le transitaire prend une décision **avant** la pénalité.

### Tone

Rassurant, pas révolutionnaire. Sapurai doit ressembler à un **outil métier sérieux**, pas à une **disruption tech-bro**. Les utilisateurs cibles (transitaires expérimentés, douaniers, agents compagnies maritimes) sont méfiants vis-à-vis de l'innovation pour l'innovation. L'app doit dire *"je connais ton métier"*, pas *"je vais le révolutionner"*.

## Anti-references

Pas de site/app en référence négative explicite. Mais une **règle d'or** filtre tout :

> **Si l'utilisateur doit "apprendre" Sapurai plus de 5 minutes, c'est raté.**

L'info qu'il cherche doit être visible **sans effort** : sans modal à fermer, sans tutorial à suivre, sans menu caché à découvrir. Conséquences directes :

- ❌ Pas de SaaS-template lourd (Salesforce, SAP, Zoho) avec 100 menus et 50 onglets.
- ❌ Pas de SaaS-flashy fintech (Revolut, N26) avec gradients néon, animations bouncy, vocabulaire VC.
- ❌ Pas de glassmorphism décoratif (Apple Big Sur), pas de hero-metric template SaaS B2B.
- ❌ Pas de modal comme premier réflexe : si une action peut être inline, elle l'est.
- ❌ Pas de jargon tech (no "workflow", no "dashboard", no "synchronization in progress"). Le mot du métier prime : "BL", "BAD", "BAE", "Pregate", "Surestaries", "Caution".

## Design Principles

1. **Source vérifiée et explicite.** Chaque donnée porte sa provenance : badge `📡 CMA` quand l'ETA vient de l'armateur, `Sync DPWorld` pour BAD/BAE, saisie manuelle sinon. Pas de mystère sur l'origine.

2. **L'armateur fait foi.** Sur les données métier officielles (date arrivée, statut TC), la source externe (CMA, DPWorld) écrase la saisie agent. Le transitaire facture sur la base de ce que l'armateur dit, pas l'inverse.

3. **Anticiper, pas constater.** Toutes les alertes sont J-3 minimum avant échéance (surestaries, retour vide, expiration BAD). L'agent prend la décision avant la pénalité, pas pour la subir.

4. **Le client voit sans appeler.** Le tracking public (`/t/<token>`) est un produit dans le produit : un client malien à Bamako voit son conteneur progresser sans téléphoner à son transitaire à Dakar.

5. **Desktop ET mobile en parité.** Pas de "mobile-first" qui pénalise le bureau, pas de "desktop-first" qui pénalise le terrain. Les agents Sapurai utilisent les deux dans la même journée.

6. **Friction zéro pour utilisateur réticent.** L'info qu'il cherche est visible en moins de 5 secondes, sans formation, sans onboarding intrusif. Si une feature demande explication, elle est mal conçue.

## Accessibility & Inclusion

- **WCAG 2.1 AA** : contrastes vérifiés, touch targets 44×44 minimum, semantic HTML, focus management, screen reader supporté.
- **Mode sombre** : implémenté, nice-to-have. Doit rester **lisible** dans toutes les conditions (lumière directe au port, écran sale au volant, 4G qui ne charge pas les SVG). Pas de mode sombre "stylé mais cassé en pleine lumière".
- **`prefers-reduced-motion`** respecté globalement (animations désactivées si l'utilisateur l'a demandé dans son OS).
- **Langue** : français uniquement pour MVP. Pas de plan bambara/dioula/anglais à court terme.
- **Hors ligne critique** : 4G dégradée fréquente. Service Worker + cache IndexedDB Firestore garantissent que l'app fonctionne même sans connexion (synchro au retour).
- **Devices low-end** : Android <2 GB RAM, processeurs anciens, écrans bas de gamme. Bundle Vite optimisé en lazy-loading par route, pas de dépendance lourde inutile.
- **RTL** : non concerné (pas d'arabe imposé en marché Sénégal/Mali/Burkina côté logistique).
