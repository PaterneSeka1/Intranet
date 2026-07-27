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
- **Onglets** : onglets globaux ou ciblés BU selon le périmètre du rôle
- **Annonces** : gestion réservée à `CTO_ADMIN` et `PDG`
- **Actions annonces** : les actions par annonce sont regroupées dans un select `Actions à effectuer`
- **Annonces ciblées** : les utilisateurs voient les annonces globales et celles de leur BU uniquement
- **Bannière annonces** : affiche seulement les annonces actives épinglées
- **Widget annonces** : affiche les annonces actives non épinglées, avec fallback sur les épinglées
- **Actualisation annonces** : Socket.IO signale les changements et le client recharge l'API authentifiée
- **Manager direct** : seuls `CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU` et `RESPONSABLE_POLE` sont proposés comme managers directs

## Déploiement OVH (TODO)

```bash
# PM2
pm2 start ecosystem.config.js

# Nginx (configuration à créer)
# SSL via Let's Encrypt
```

## Validation

```bash
npm run type-check --workspace=apps/api
npm run type-check --workspace=apps/web
npm run build:api
rm -rf apps/web/.next   # recommandé avant build web si cache Next/PWA incohérent
npm run build:web
```

## Prochaines étapes

Voir `TACHE.md` et `SESSION_HANDOFF.md` pour l'état détaillé, les validations exécutées et les tests manuels recommandés.
