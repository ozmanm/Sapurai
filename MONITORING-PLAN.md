# Sapurai — Plan de monitoring concurrentiel

> Process operationnel pour garder `COMPETITIVE-BRIEF.md` + battle cards + playbooks a jour.
> Rythme : trimestriel (ou sur alerte).
> Derniere revue : 2026-04-18 | Prochaine : 2026-07-18

---

## Philosophie

Un brief competitif + des battle cards ont une **duree de vie de 3-6 mois** avant d'etre obsoletes. Sans monitoring actif, ces documents deviennent un faux filet de securite — ils rassurent mais ne protegent plus.

Le monitoring n'est pas un audit annuel couteux. C'est un **ritual mensuel/trimestriel leger** qui produit 3 livrables :

1. **Newsletter interne** : "Ce qui a change chez nos concurrents ce trimestre"
2. **Decisions** : ajustement positioning, pricing, roadmap si besoin
3. **Mise a jour des docs** : COMPETITIVE-BRIEF, battle cards, WIN-VS-WEBGRAM

---

## Rituals mensuels — **15 min chacun**

### Ritual 1 — Pulse WEBGRAM (le principal)

**Frequence** : 1 fois par mois, premier vendredi

**Actions**
1. Ouvrir `agencewebgram.com` → section "blog" et "solutions"
2. Noter tout nouveau article mentionnant "transit", "transitaire", "douane", "logistique corridor"
3. Verifier LinkedIn de WEBGRAM : nouveaux posts, nouveaux recrutements
4. Verifier pricing page (toujours absent ?)
5. Verifier si demo video / use case transitaire est publie

**Signaux d'alerte**
- ≥ 2 articles transit specifiques dans le mois → WEBGRAM s'interesse au segment
- Recrutement "Product Manager Transit" ou "Solutions Logistique" → structure dediee
- Mention publique d'un client transitaire specifique → cas client = signal commercial

**Sortie** : 1-2 lignes dans `MONITORING-LOG.md` (fichier a creer au 1er mois)

### Ritual 2 — Pulse Fleetever + concurrents secondaires

**Frequence** : 1 fois par mois, meme jour

**Actions**
1. `fleetever.com` → blog, news, pricing page
2. Communique de presse sur Classe-Export, Supply Chain Magazine
3. Sociale : LinkedIn, Twitter → nouveaux posts
4. Appvizer reviews → evolution note, nouveaux avis

**Signaux d'alerte**
- Expansion explicite Afrique Ouest (nouveau bureau, embauches locales)
- Partenariat avec une compagnie maritime ou banque senegalaise
- Changement de modele (vers B2B transitaire plutot que B2B chargeur)

### Ritual 3 — Pulse portails carriers + DPWorld

**Frequence** : 1 fois par mois

**Actions**
1. Portails CMA-CGM, Maersk, MSC : nouveaux features client-facing
2. DPWorld Dakar : nouveautes du portail tracking
3. Gainde2000 / douane Senegal : annonces

**Signaux d'alerte**
- Un carrier lance un "dashboard transitaire" ou "marketplace transitaires"
- DPWorld lance un portail "commissionaire" (au-dela du simple tracking container)
- Nouvelle reglementation qui change les franchises / cautions

---

## Ritual trimestriel — **2h**

### Pulse approfondi tous les 3 mois

**Frequence** : 2026-07, 2026-10, 2027-01, 2027-04...

**Actions**
1. Relire `COMPETITIVE-BRIEF.md` en entier
2. Verifier chaque affirmation : est-elle toujours vraie ?
3. Tester Google : recherches "transitaire dakar logiciel", "gestion transit corridor", "logiciel surestaries" → voir qui ressort, dans quel ordre
4. Verifier review sites (G2, Capterra si applicable) pour nouvelles mentions
5. Verifier annuaires transitaires Senegal/Mali pour nouveaux entrants
6. Regarder le pipeline commercial Sapurai : les prospects ont-ils mentionne de nouveaux concurrents ?
7. Les deals gagnes/perdus : pourquoi ? Quel concurrent cite ?

**Sortie obligatoire** : update en entrees numerotees dans :
- `COMPETITIVE-BRIEF.md` section concurrents (ajouter/retirer)
- `SALES-BATTLECARDS.md` (ajouter concurrent si nouveau)
- `WIN-VS-WEBGRAM.md` si signal d'escalade active
- `NOTES-PRODUCT.md` si decouverte nouvelle feature attendue

---

## Ritual par evenement — **variable**

### Trigger : perte d'un deal

**Action immediate (semaine suivante)**
1. Interview courte client perdu (15 min tel) : pourquoi, qui a gagne, qu'est-ce qui a manque
2. Documenter dans `LOST-DEALS.md` (fichier a creer a la 1ere perte)
3. Si pattern : > 2 pertes sur le meme theme, alerte et ajustement produit/messaging

### Trigger : gain d'un deal competitif

**Action** : meme chose, positive side — pourquoi nous, qu'est-ce qui a pese, quelle est leur experience depuis. Nourrit temoignages et battle cards.

### Trigger : annonce majeure concurrent

- Levee de fonds notable
- Acquisition
- Lancement module transit-specifique
- Partenariat strategique avec une instance gouvernementale / carrier

**Action** : update immediate du brief + reunion strategique interne (meme solo-founder : 30 min de reflexion structuree)

---

## Sources a surveiller — liste operationnelle

### Sources quotidiennes (scan rapide si possible)

- **Google News** alertes : "transitaire Senegal", "transitaire Mali", "logiciel transit Afrique"
- **LinkedIn** : WEBGRAM, Fleetever, AGL, CMA-CGM Senegal
- **Twitter/X** : #TransitAfrique, #Logistique225 (Cote d'Ivoire), #LogistiqueSN

### Sources hebdo

- Supply Chain Magazine (France)
- Classe-Export
- Jeune Afrique (section logistique/infrastructure)
- Lesoleil.sn (actualite Senegal)

### Sources mensuelles

- Rapports analystes Gartner/Forrester (transport, supply chain) — si accessible
- Publications Banque Mondiale / African Development Bank sur logistique
- Rapports annuels chambres de commerce Senegal/Mali

### Sources trimestrielles

- Revue complete revue sites (Capterra, G2, SoftwareConnect) — recherche "freight forwarding Africa"
- Conferences sectorielles : Logisticon, Africa Logistics Summit, Africa Supply Chain in Action

---

## Tableau de bord — `MONITORING-LOG.md`

Creer ce fichier au 1er ritual (soit le premier vendredi de mai 2026) avec la structure :

```markdown
# Monitoring Log — Sapurai

## 2026-05-01 (mois 1)

### WEBGRAM
- Article #1 "L'ERP dans la logistique" (https://...) — generique, pas d'action
- LinkedIn : 2 posts, 0 recrutement nouveau
- Pricing : toujours absent
- Verdict : aucun signal d'escalade, monitoring normal

### Fleetever
- RAS

### DPWorld
- RAS

### Decisions
- Aucune
- Prochaine revue : 2026-06-05
```

---

## Process d'escalade

Si **2 signaux d'alerte** parmi les suivants se cumulent dans la meme fenetre de 3 mois, **declencher une revue strategique** :

1. WEBGRAM lance module transit dedie OU hire Product Manager transit
2. Fleetever ouvre bureau Dakar OU partenariat banque senegalaise
3. DPWorld lance portail "commissionaire"
4. Un carrier (CMA-CGM, Maersk) lance dashboard transitaire inland tracking
5. Reglementation douane/transit change les regles de surestaries
6. Un nouveau concurrent vertical emerge (signale par un prospect ou un deal perdu)

**Revue strategique** : 2-4h seul (ou en equipe si on est plusieurs) pour :
- Reevaluer le positioning
- Ajuster la roadmap produit si necessaire (que faut-il accelerer ? Couper ?)
- Mettre a jour les battle cards
- Decider d'une communication externe (post blog, annonce, rebrand)

---

## Qui fait quoi (pour l'instant : solo-founder)

Tant que Sapurai = 1-2 personnes : **tout par le founder**. Ca prend ~1h/mois + 2h/trimestre + occasionnel ad-hoc.

Quand Sapurai = 3+ personnes :
- Commercial/Head of Sales : ritual mensuel sur les concurrents qui apparaissent dans les deals
- Product : ritual trimestriel sur les features concurrents
- Founder : escalade et decisions strategiques

---

## Metrique de succes du monitoring

Le monitoring fonctionne si :

1. **Nous ne sommes jamais surpris** par un move concurrent majeur
2. **Les battle cards restent pertinentes** quand un prospect mentionne un concurrent
3. **La roadmap produit integre les signaux** (ex : si WEBGRAM mentionne DPWorld, nous renforcons notre moat DPWorld)
4. **Chaque deal perdu enseigne quelque chose** qu'on encode dans les docs

Le monitoring echoue si :

1. Les docs ne sont pas mis a jour pendant 6+ mois
2. Un prospect nous surprend en citant un concurrent inconnu
3. Nous decouvrons une annonce concurrent par hasard (reseau social personnel) vs dans le ritual

---

## Prochaine action

1. [ ] **2026-05-01** : premier ritual mensuel, creer `MONITORING-LOG.md`
2. [ ] **2026-07-18** : premier ritual trimestriel (revue complete brief)
3. [ ] **Continu** : flagger les deals perdus dans `LOST-DEALS.md` (a creer a la 1ere perte)

---

*Ce plan est lui-meme a reviser dans 12 mois — peut-etre que le rythme mensuel/trimestriel est trop ou pas assez selon l'evolution du marche.*
