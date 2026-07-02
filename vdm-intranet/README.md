# VDM Intranet

Portail intranet de **Veilleur des Médias** — gestion des présences, rôles, BU, onglets, pilotage et exports.

## Stack technique

| Couche      | Technologie                        |
|-------------|------------------------------------|
| Frontend    | Next.js 14 (App Router) + TypeScript |
| UI          | Tailwind CSS + shadcn/ui           |
| Backend     | NestJS + TypeScript                |
| Base de données | PostgreSQL                     |
| ORM         | Prisma                             |
| Auth        | JWT + cookies sécurisés            |
| Graphiques  | Recharts                           |
| Exports     | CSV + PDF                          |
| Déploiement | VPS OVH + Nginx + PM2              |

## Structure

```
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

| Username         | Mot de passe | Rôle              |
|------------------|-------------|-------------------|
| CTO              | 1234        | CTO_ADMIN         |
| PDG              | 1234        | PDG               |
| DAF              | 1234        | DAF               |
| RBU_INFO         | 1234        | RESPONSABLE_BU    |
| RBU_EREP         | 1234        | RESPONSABLE_BU    |
| RBU_SCI          | 1234        | RESPONSABLE_BU    |
| RBU_ANALYSES     | 1234        | RESPONSABLE_BU    |
| POLE_PRESSE_JOUR | 1234        | RESPONSABLE_POLE  |
| POLE_NUIT        | 1234        | RESPONSABLE_POLE  |
| POLE_TVRADIO     | 1234        | RESPONSABLE_POLE  |
| CONS_PJ_1        | 1234        | CONSULTANT        |
| CONS_NUIT_1      | 1234        | CONSULTANT        |
| CONS_TVR_1       | 1234        | CONSULTANT        |
| STAG_EREP_1      | 1234        | STAGIAIRE         |
| STAG_TECH_1      | 1234        | STAGIAIRE         |
| GLENN_BOLDCODE   | 1234        | PRESTATAIRE       |

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
- **Onglets** : chaque onglet appartient à une BU, aucun onglet global

## Déploiement OVH (TODO)

```bash
# PM2
pm2 start ecosystem.config.js

# Nginx (configuration à créer)
# SSL via Let's Encrypt
```

## Prochaines étapes

Voir les `TODO` dans le code pour les parties non encore implémentées.
Module suivant à développer : `apps/api` (NestJS — auth, users, presence).
