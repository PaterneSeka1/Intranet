# VDM Intranet

Portail intranet de **Veilleur des Médias** — gestion des présences, rôles, BU, onglets, annonces, pilotage et exports.

## Stack technique

| Couche          | Technologie                          |
| --------------- | ------------------------------------ |
| Frontend        | Next.js 14 (App Router) + TypeScript |
| UI              | Tailwind CSS + shadcn/ui             |
| Backend         | NestJS + TypeScript                  |
| Base de données | PostgreSQL                           |
| ORM             | Prisma                               |
| Auth            | JWT + cookies sécurisés              |
| Temps réel      | Socket.IO                            |
| Graphiques      | Recharts                             |
| Exports         | CSV + PDF                            |
| Déploiement     | VPS OVH + Nginx + PM2                |

## Structure

```text
vdm-intranet/
├── apps/
│   ├── web/          # Next.js App Router (port 3000)
│   └── api/          # NestJS REST API  (port 3001)
├── packages/
│   └── database/     # Prisma schema, client, migrations, seed
├── docker-compose.yml
├── package.json      # npm workspaces root
├── tsconfig.base.json
├── .env.example
└── README.md
```

## Prérequis

- Node.js >= 20
- npm >= 9
- Docker & Docker Compose (pour PostgreSQL local)

## Installation

```bash
# 1. Cloner le dépôt
git clone <repo-url> vdm-intranet
cd vdm-intranet

# 2. Copier les variables d'environnement
cp .env.example .env
# Remplir les valeurs dans .env

# 3. Installer les dépendances
npm install

# 4. Démarrer PostgreSQL
docker compose up -d

# 5. Générer le client Prisma
npm run db:generate

# 6. Appliquer les migrations
npm run db:migrate

# 7. Charger les données de test
npm run db:seed
```

## Démarrage en développement

```bash
# Lancer frontend et backend en parallèle
npm run dev

# Ou séparément :
npm run dev:web   # http://localhost:3000
npm run dev:api   # http://localhost:3001
```

> `npm run dev:api` démarre automatiquement Docker Desktop (si arrêté) et le conteneur PostgreSQL avant de lancer l'API (hook `predev:api` → `scripts/ensure-db.sh`). Pour ne démarrer que la base sans l'API : `npm run db:up`.

## Commandes base de données

```bash
npm run db:generate   # Regénérer le client Prisma après modification du schema
npm run db:migrate    # Créer et appliquer une migration
npm run db:push       # Push schema sans migration (dev rapide)
npm run db:studio     # Ouvrir Prisma Studio (GUI)
npm run db:seed       # Charger les données de test
npm run db:reset      # Réinitialiser la base et re-seeder
```

## Comptes de test (seed)

Tous les comptes seedés utilisent le mot de passe défini par `SEED_PASSWORD` dans `.env`.
À la première connexion, ils doivent obligatoirement remplacer ce mot de passe.

| Username         | Mot de passe     | Rôle             |
| ---------------- | ---------------- | ---------------- |
| CTO              | `$SEED_PASSWORD` | CTO_ADMIN        |
| PDG              | `$SEED_PASSWORD` | PDG              |
| DAF              | `$SEED_PASSWORD` | DAF              |
| RBU_INFO         | `$SEED_PASSWORD` | RESPONSABLE_BU   |
| RBU_EREP         | `$SEED_PASSWORD` | RESPONSABLE_BU   |
| RBU_SCI          | `$SEED_PASSWORD` | RESPONSABLE_BU   |
| RBU_ANALYSES     | `$SEED_PASSWORD` | RESPONSABLE_BU   |
| POLE_PRESSE_JOUR | `$SEED_PASSWORD` | RESPONSABLE_POLE |
| POLE_NUIT        | `$SEED_PASSWORD` | RESPONSABLE_POLE |
| POLE_TVRADIO     | `$SEED_PASSWORD` | RESPONSABLE_POLE |
| ANGE_KAPET       | `$SEED_PASSWORD` | EMPLOYE          |
| LILIANE_KONAN    | `$SEED_PASSWORD` | EMPLOYE          |
| ANDREAS_BONI     | `$SEED_PASSWORD` | EMPLOYE          |
| ME_KOUAKOU       | `$SEED_PASSWORD` | EMPLOYE          |
| JOSEPH_TANO      | `$SEED_PASSWORD` | EMPLOYE          |
| HENRI_AMAN       | `$SEED_PASSWORD` | EMPLOYE          |
| CONS_PJ_1        | `$SEED_PASSWORD` | CONSULTANT       |
| CONS_NUIT_1      | `$SEED_PASSWORD` | CONSULTANT       |
| CONS_TVR_1       | `$SEED_PASSWORD` | CONSULTANT       |
| STAG_EREP_1      | `$SEED_PASSWORD` | STAGIAIRE        |
| STAG_TECH_1      | `$SEED_PASSWORD` | STAGIAIRE        |
| GLENN_BOLDCODE   | `$SEED_PASSWORD` | PRESTATAIRE      |

## Business Units

- Direction Générale (`DG`)
- Direction Technique (`DT`)
- Direction Administrative et Financière (`DAF`)
- Information (`INFO`)
- E-Réputation (`EREP`)
- SCI (`SCI`)
- Analyses Médiatiques (`ANALYSES`)

## Règles métier clés

- **Présence** : fixée uniquement à la **première connexion du jour**
- **Géolocalisation** : obligatoire à la première connexion, refus = connexion bloquée
- **Horaire prioritaire** : 1. mandat journalier → 2. groupe horaire → 3. heure individuelle
- **Employés standards** : `EMPLOYE`, `CONSULTANT`, `STAGIAIRE` et `PRESTATAIRE` sont rattachables à une BU/un pôle sans droits de gestion
- **Onglets** : `CTO_ADMIN` et `PDG` peuvent créer des onglets globaux ou ciblés pour toutes les BU ; `DAF` et `RESPONSABLE_BU` créent et gèrent uniquement les onglets de leur propre BU
- **Annonces** : gestion réservée à `CTO_ADMIN` et `PDG`
- **Actions annonces** : les actions par annonce sont regroupées dans un select `Actions à effectuer`
- **Annonces ciblées** : les utilisateurs voient les annonces globales et celles de leur BU uniquement
- **Bannière annonces** : affiche seulement les annonces actives épinglées
- **Widget annonces** : affiche toutes les annonces actives (épinglées en tête) dans une liste unique scrollable plafonnée en hauteur ; chaque ligne n'affiche que le titre, cliquable, et ouvre une modale avec les détails complets
- **Actualisation annonces** : Socket.IO signale les changements et le client recharge l'API authentifiée
- **Manager direct** : seuls `CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU` et `RESPONSABLE_POLE` sont proposés comme managers directs ; ce rattachement hiérarchique ne remplace pas le périmètre BU utilisé pour les onglets

## Déploiement OVH

Sur le VPS (première installation) :

```bash
# 1. Cloner le dépôt et installer les dépendances
git clone <repo-url> vdm-intranet && cd vdm-intranet
npm ci

# 2. Créer et remplir le .env de production (jamais committé — voir .env.example)
cp .env.example .env
# Remplir DATABASE_URL/JWT_SECRET (≥32 caractères aléatoires)/SMTP_*/CORS_ORIGINS/
# NEXT_PUBLIC_API_URL/NEXT_PUBLIC_APP_URL/COOKIE_DOMAIN/COOKIE_SECURE/CONGE_* avec les vraies
# valeurs de production directement sur le serveur.

# 3. Base de données
docker compose up -d
npm run db:generate
npm run db:migrate      # prisma migrate deploy — historique de migrations validé sur base neuve
npm run db:seed         # à sauter si vous ne voulez pas des comptes de démo

# 4. Builds (npm run build:web copie automatiquement les NEXT_PUBLIC_*/COOKIE_NAME du .env
# racine vers apps/web/.env.production.local — voir scripts/copy-web-env.js — avant d'appeler
# next build, faute de quoi Next.js ne les verrait jamais et retomberait sur localhost)
npm run build:api
npm run build:web

# 5. PM2 (ecosystem.config.js à la racine — voir ce fichier pour le détail des 2 process)
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # une seule fois, pour survivre à un reboot du VPS

# 6. Nginx — voir deployment/nginx/vdm-intranet.conf (reverse proxy + support WebSocket
# Socket.IO), à adapter avec les vrais domaines puis à activer via certbot pour le SSL.
```

Pour un redéploiement (mise à jour de code existante) : `git pull`, `npm ci`, étapes 3 (uniquement `db:migrate` si nouvelles migrations) et 4, puis `pm2 restart ecosystem.config.js`.

**Puppeteer (exports PDF)** : installer les dépendances système Chromium sur le VPS avant le premier export (`apt-get install -y libnss3 libatk-bridge2.0-0 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2` sur Debian/Ubuntu — liste indicative, `puppeteer.launch()` échoue explicitement dans les logs PM2 si une lib manque).

### Checklist intégration Congés (VEDEM/CONGE — déjà en ligne)

L'app CONGE (dépôt séparé, Next.js/Prisma/MongoDB) est **déjà déployée en production**, contrairement au reste de cet Intranet. À ne pas oublier lors du déploiement pour que l'intégration fonctionne réellement (statut "en congé", widget "Employés en congé", sélecteur "employé CONGE existant" à la création d'un compte) :

1. **Renseigner en production** `CONGE_API_URL` et `CONGE_API_SECRET` (`.env` de vdm-intranet) — voir `.env.example` pour le format ; tant qu'ils sont vides, toute l'intégration reste désactivée en silence (aucune erreur, mais aucun effet non plus).
2. `CONGE_API_SECRET` doit être **strictement identique** à `INTRANET_SYNC_SECRET` côté CONGE en production.
3. Vérifier que l'instance CONGE en ligne expose bien `GET /api/employees` (nouvel endpoint requis par le sélecteur de création d'employé, en plus de `GET /api/leaves/active` déjà utilisé pour les congés) — s'il n'a pas encore été développé/déployé côté dépôt CONGE, le sélecteur restera invisible même si vdm-intranet est à jour. Contrat détaillé dans `TACHE.md` (section "Sélecteur employé CONGE existant").
4. Après déploiement, tester `GET /leaves/on-leave/today` et `GET /leaves/conge-employees` (connecté en CTO_ADMIN/PDG) : les deux doivent répondre sans 401/timeout.

## Validation

```bash
npx prettier --check "**/*.{ts,tsx,json,yaml,md}" --ignore-path .gitignore
npm run type-check --workspace=apps/api
npm run type-check --workspace=apps/web
npm run test:api
npm run build:api
rm -rf apps/web/.next   # recommandé avant build web si cache Next/PWA incohérent
npm run build:web
npm audit --omit=dev    # informatif — voir TACHE.md pour l'état connu des dépendances vulnérables
```

## Prochaines étapes

Voir `TACHE.md` et `SESSION_HANDOFF.md` pour l'état détaillé, les validations exécutées et les tests manuels recommandés.
