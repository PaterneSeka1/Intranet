# CLAUDE.md - Portail Intranet Veilleur des Médias

Ce fichier sert de guide pour les modèles d'IA afin de comprendre l'environnement de développement, les commandes de build, l'architecture du projet et les standards de codage.

---

## 1. Architecture du Projet

Le projet est un monorepo structuré comme suit :
* `apps/web` : Interface utilisateur Web construite avec Next.js (app router), Tailwind CSS et des composants React.
* `apps/api` : Backend API construit avec NestJS et Prisma ORM.
* `packages/database` : Package de base de données partagé contenant le schéma Prisma, les migrations et les scripts d'initialisation (seed).

---

## 2. Commandes de Build et d'Exécution Courantes

Toutes les commandes doivent être exécutées depuis le répertoire racine (`/vdm-intranet`) :

### Commandes de Développement & Build
* **Lancer l'API en mode dev** : `npm run dev:api`
* **Lancer le Frontend Web en mode dev** : `npm run dev:web`
* **Compiler l'API (production)** : `npm run build:api`
* **Compiler le Frontend Web (production)** : `npm run build:web`
* **Formater automatiquement le code (Prettier)** : `npm run format`

### Commandes de Base de Données (Prisma)
* **Générer le client Prisma** : `npm run db:generate`
* **Appliquer les migrations de base de données** : `npm run db:migrate`
* **Pousser le schéma local vers la base de données** : `npm run db:push`
* **Remplir la base de données (seed)** : `npm run db:seed`
* **Réinitialiser la base de données** : `npm run db:reset`
* **Lancer Prisma Studio** : `npm run db:studio`

---

## 3. Technologies et Standards de Codage

### Backend (NestJS / Prisma)
* Utilisation stricte de TypeScript.
* Assurer que les ressources sensibles (ex: données de géolocalisation) sont vérifiées par rapport aux rôles de l'utilisateur avant d'être renvoyées dans les réponses de l'API.
* Utiliser le décorateur `@CurrentUser()` pour accéder au contexte de l'utilisateur connecté.
* Respecter l'architecture NestJS contrôleur-service.

### Frontend (Next.js / Tailwind CSS)
* Utiliser les conventions App Router de Next.js 14.
* Implémenter des designs modernes et premium (palettes de couleurs harmonieuses, effets de flou/verre, grilles responsives).
* Assurer que les composants gèrent correctement l'affichage conditionnel selon les rôles (ex: masquer les coordonnées GPS et les adresses pour les utilisateurs standards).
