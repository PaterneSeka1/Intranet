# Liste des Tâches — Sécurité & Bugs

## Nouvelle tâche — Gouvernance utilisateurs, admins et onglets — 2026-07-26

Source de vérité ajoutée : `contexte_vdm_compact_avec_schema.md`.

> Cette tâche remplace l'hypothèse précédente où la DAF était traitée comme admin globale des onglets.

- `[x]` Lire et analyser le nouveau fichier de contexte VDM
- `[x]` Mettre à jour les fichiers de tâche avant toute modification de code
- `[x]` Backend — Restreindre les admins globaux à `CTO_ADMIN` et `PDG`
- `[x]` Backend — Donner au `CTO_ADMIN` un niveau supérieur : il peut modifier le `PDG`, le `PDG` ne peut pas modifier le CTO/super admin
- `[x]` Backend — Traiter la DAF et les directeurs/responsables comme responsables de leur périmètre département/BU, pas comme admins globaux
- `[x]` Backend — Autoriser les responsables de département/BU à créer et gérer les onglets de leur propre département/BU
- `[x]` Frontend — Aligner les pages `utilisateurs` et `onglets` avec la nouvelle hiérarchie CTO/PDG/DAF/directeurs
- `[x]` Validation — Lancer formatage et builds API/Web
- `[x]` Audit final — Contrôler les permissions, mettre à jour `TACHE.md` et `SESSION_HANDOFF.md`

### Audit gouvernance — 2026-07-26

- `CTO_ADMIN` et `PDG` sont les seuls rôles globaux pour utilisateurs, onglets, pilotage, rapports, présence et annonces.
- `CTO_ADMIN` peut gérer les comptes `CTO_ADMIN`/`PDG`; `PDG` ne peut ni modifier ces comptes, ni attribuer ces rôles.
- `DAF` est retiré des accès globaux et devient gestionnaire de son périmètre BU/département pour utilisateurs, onglets, pilotage, rapports, présence et mandats.
- Les responsables BU conservent la gestion de leurs onglets BU ; les responsables pôle restent scopés pôle pour présence/pilotage/rapports.
- Frontend aligné : pages `utilisateurs`, `onglets`, `annonces`, `presences`, sidebar et managers.
- Aucune migration ni seed requis : aucun changement de schéma Prisma.
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK.
- `git diff --check` : OK.

//SESSION GOUVERNANCE TERMINEE

## Clarification — Rattachement BU/département sans responsabilité — 2026-07-26

- `[x]` Confirmer que le rattachement `businessUnitId`/`poleId` ne donne pas automatiquement un droit de gestion.
- `[x]` Frontend — Préserver la BU/le pôle quand un utilisateur change vers un rôle employé non-responsable.
- `[x]` Frontend — Clarifier les libellés des rôles employés pour indiquer qu'ils peuvent être rattachés à une BU sans être responsables.
- `[x]` Validation — Lancer formatage et build web.

## Ajustement — Rapports DAF & widget annonces — 2026-07-26

- `[x]` Rapports — Limiter la DAF responsable au rapport présences/absences, mais sur tout le personnel sans exception.
- `[x]` Navigation — Ajouter une entrée claire pour les rapports DAF.
- `[x]` Annonces — Limiter la bannière défilante aux annonces épinglées.
- `[x]` Widget — Ajouter un widget annonces distinct pour les annonces actives non épinglées.
- `[x]` Documentation — Mettre à jour `TACHE.md` et `SESSION_HANDOFF.md`.
- `[x]` Validation — Lancer formatage et build web.

### Audit rapports DAF & annonces — 2026-07-26

- `DAF` peut exporter uniquement le rapport `Présences / absences`, pour tout le personnel sans exception.
- Les exports `activité`, `connexions` et `rapport général` sont refusés côté API pour `DAF`.
- Le menu DAF affiche `Pilotage & rapports`.
- La bannière défilante affiche uniquement les annonces épinglées.
- Le widget `Annonces` affiche les annonces actives non épinglées, avec fallback sur les épinglées.
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK.

- `[x]` Tâche 1 : Base de données — Schéma Prisma & Migrations
  - `[x]` Mettre à jour `schema.prisma` avec `mustChangePassword`, `failedLoginAttempts` et `lockoutUntil`
  - `[x]` Ajouter la migration SQL `20260726000000_add_user_login_security`
  - `[x]` Appliquer le schéma sur la base locale (`npx prisma db push --schema packages/database/prisma/schema.prisma`)
- `[x]` Tâche 2 : Seed — Mettre à jour `seed.ts`
  - `[x]` Mettre `mustChangePassword: true` pour les utilisateurs seedés
  - `[x]` Lancer le seed (`npm run db:seed`)
- `[x]` Tâche 3 : Backend API — Sécurité & Auth
  - `[x]` Implémenter la comparaison systématique (`dummyHash`) et la non-énumération dans `auth.service.ts`
  - `[x]` Implémenter le verrouillage de compte après 5 échecs consécutifs dans `auth.service.ts`
  - `[x]` Mettre à jour `jwt.strategy.ts` pour retourner `mustChangePassword`
  - `[x]` Mettre à jour `jwt-auth.guard.ts` pour bloquer les routes si `mustChangePassword` est vrai
  - `[x]` Renforcer les DTOs avec la regex de complexité de mot de passe (`create-user.dto.ts`, `update-user.dto.ts`, `reset-password.dto.ts`)
  - `[x]` Mettre à jour `users.service.ts` pour gérer `mustChangePassword` et les conflits d'unicité `P2002`
- `[x]` Tâche 4 : Backend API — Sécurisation IP, E-mails, Thèmes & Exports
  - `[x]` Configurer "trust proxy" dans `main.ts`
  - `[x]` Mettre à jour `getIp(req)` dans `presence.controller.ts` pour utiliser `req.ip`
  - `[x]` Assainir `firstName` par escape HTML dans `mail.service.ts`
  - `[x]` Valider le theming dans `settings.service.ts`
  - `[x]` Valider les dates de début/fin des rapports dans `reports.service.ts`
- `[x]` Tâche 5 : Backend API — Correctifs de présence & Mandats
  - `[x]` Rendre `processEndDay` atomique (`updateMany` + vérification de count)
  - `[x]` Catcher la contrainte d'unicité dans `processFirstLogin`
  - `[x]` Conserver `isNightShift` du groupe dans `presence.schedule.service.ts` lors des mandats
  - `[x]` Supprimer la fonction morte `getDailyMandate` de `presence.schedule.service.ts`
- `[x]` Tâche 6 : Frontend Web — Prise en charge de la rotation forcée de mot de passe
  - `[x]` Mettre à jour le type `User` dans `user.ts`
  - `[x]` Créer le composant `MustChangePasswordGuard.tsx`
  - `[x]` Intégrer le Guard dans le layout protégé (`layout.tsx`)
  - `[x]` Mettre à jour `MonProfilClient.tsx` pour restreindre la vue en cas de changement obligatoire
- `[x]` Tâche 7 : Frontend Web — Autres correctifs
  - `[x]` Mettre à jour le statut HTTP 403 dans `api.ts`
  - `[x]` Corriger l'incohérence DAF sur les onglets (`onglets/page.tsx` et `TabsManager.tsx`) — hypothèse remplacée par la nouvelle gouvernance du 2026-07-26
  - `[x]` Remplacer `|| undefined` par `|| null` pour vider les champs dans `UsersManager.tsx` et `ParametresClient.tsx`
  - `[x]` Échapper `vdm_bg_image` dans `BgRestorer.tsx`
- `[x]` Tâche 8 : Validation
  - `[x]` Lancer le formatage (`npm run format`)
  - `[x]` Lancer le build de l'API (`npm run build:api`)
  - `[x]` Lancer le build du Frontend (`npm run build:web`)

## Audit final — 2026-07-26

- Code backend et frontend implémenté.
- `npx prisma validate --schema packages/database/prisma/schema.prisma` : OK.
- `npm run db:generate` : OK.
- `npx prisma db push --schema packages/database/prisma/schema.prisma` : OK hors sandbox ; base déjà synchronisée.
- `npm run db:seed` : OK hors sandbox ; 22 utilisateurs, 7 BU, 5 pôles, 4 groupes, 22 onglets.
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK.

//SESSION TERMINEE

# Plan d'implémentation — Sécurité & Bugs Intranet VDM

Ce plan détaille les modifications à apporter au portail intranet pour corriger les failles de sécurité (haute, moyenne, faible) et résoudre les anomalies critiques, élevées, moyennes et faibles identifiées.

## User Review Required

> [!IMPORTANT]
> **Migration de Base de Données requise :**
> L'ajout des champs `mustChangePassword` (rotation de mot de passe forcée), `failedLoginAttempts` (sécurité contre brute-force), et `lockoutUntil` (verrouillage temporaire de compte) requiert une migration Prisma (`npx prisma migrate dev`).
>
> **Correction de gouvernance :**
> L'ancien comportement où la DAF était traitée comme admin globale est remplacé par la règle issue de `contexte_vdm_compact_avec_schema.md` : seuls `CTO_ADMIN` et `PDG` sont admins globaux. Le `CTO_ADMIN` reste supérieur au `PDG`. La DAF et les responsables/directeurs gèrent uniquement leur périmètre département/BU.
>
> **Complexité de Mot de Passe renforcée :**
> Tout nouveau mot de passe (à la création de compte, au profil ou lors d'un reset) devra désormais respecter :
>
> - Au moins 8 caractères
> - Au moins une majuscule et une minuscule
> - Au moins un chiffre
> - Au moins un caractère spécial parmi `@$!%*?&._-`

---

## Proposed Changes

### 1. Base de données & Seed

#### [MODIFY] [schema.prisma](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/packages/database/prisma/schema.prisma)

- Ajouter les nouveaux champs de sécurité sur le modèle `User` :
  ```prisma
  mustChangePassword  Boolean   @default(false)
  failedLoginAttempts Int       @default(0)
  lockoutUntil        DateTime?
  ```

#### [MODIFY] [seed.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/packages/database/prisma/seed.ts)

- Lors de la création des ~20 utilisateurs seedés d'origine (dans la méthode `prisma.user.upsert`), définir `mustChangePassword: true` pour forcer la rotation de leur mot de passe lors de leur premier login.

---

### 2. Authentification & Sécurité (Backend API)

#### [MODIFY] [auth.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/auth/auth.service.ts)

- **Énumération de compte & Timing (Login) :**
  - Comparer systématiquement le mot de passe fourni via `bcrypt.compare` contre le hash réel de l'utilisateur s'il existe, ou contre un hash factice (`dummyHash`) s'il n'existe pas.
  - Lever une exception `UnauthorizedException('Identifiants invalides')` uniformément dans les deux cas.
  - Ne renvoyer "Compte désactivé" que si le mot de passe fourni est valide ET que le compte n'est pas actif.
- **Verrouillage après échecs répétés :**
  - Si l'utilisateur est temporairement verrouillé (`lockoutUntil > now`), rejeter la connexion immédiatement.
  - Si la comparaison de mot de passe échoue, incrémenter `failedLoginAttempts`. Si ce nombre atteint 5, définir `lockoutUntil = Date.now() + 15 minutes` et réinitialiser `failedLoginAttempts = 0`.
  - Si la connexion réussit, réinitialiser `failedLoginAttempts = 0` et `lockoutUntil = null`.

#### [MODIFY] [jwt.strategy.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/auth/strategies/jwt.strategy.ts)

- Inclure le champ `mustChangePassword` dans le `select` Prisma de la validation du token JWT pour le propager au Guard.

#### [MODIFY] [jwt-auth.guard.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/common/guards/jwt-auth.guard.ts)

- Si `user.mustChangePassword` est `true`, bloquer toutes les requêtes de l'API (lancer une `ForbiddenException('Changement de mot de passe obligatoire.')`), sauf pour les endpoints d'identité (`GET /auth/me`, `GET /users/me`), de déconnexion (`POST /auth/logout`), et de mise à jour du profil/mot de passe (`PATCH /users/me`).

#### [MODIFY] [create-user.dto.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/users/dto/create-user.dto.ts), [update-user.dto.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/users/dto/update-user.dto.ts), [reset-password.dto.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/auth/dto/reset-password.dto.ts)

- Ajouter la validation regex `@Matches` sur le champ `password` / `newPassword` pour imposer la complexité.

#### [MODIFY] [users.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/users/users.service.ts)

- Dans `create(dto)` : forcer `mustChangePassword: true` pour tout nouvel utilisateur et catcher les conflits d'unicité `P2002` pour renvoyer une `BadRequestException` propre.
- Dans `update(id, dto)` : si `dto.password` est modifié par l'admin, forcer `mustChangePassword: true` et catcher les conflits d'unicité `P2002`.
- Dans `updateMe(id, dto)` : si le mot de passe est modifié avec succès par l'utilisateur connecté, définir `mustChangePassword: false`.

#### [MODIFY] [main.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/main.ts)

- Configurer le "trust proxy" sur l'application NestExpressApplication :
  ```typescript
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.set('trust proxy', true)
  ```

#### [MODIFY] [presence.controller.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.controller.ts)

- Utiliser directement `req.ip` dans la méthode `getIp(req)` au lieu de l'en-tête potentiellement falsifiable `X-Forwarded-For`.

#### [MODIFY] [mail.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/mail/mail.service.ts)

- Échapper les caractères HTML spéciaux du prénom de l'utilisateur (`firstName`) via une fonction helper d'escape HTML avant de l'injecter dans le template de reset de mot de passe.

#### [MODIFY] [settings.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/settings/settings.service.ts)

- Ajouter une validation stricte côté serveur dans `upsertMany` :
  - Vérifier que les variables de couleur hexadécimales correspondent au pattern regex hex (`^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`).
  - Vérifier que l'opacité est un entier entre 0 et 100.
  - Vérifier que l'URL d'image ou logo commence par `http://`, `https://`, ou `data:image/`.
  - Empêcher la présence de balises HTML dans le nom et sous-titre de l'application.

#### [MODIFY] [reports.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.service.ts)

- Valider que `dateFrom` et `dateTo` sont des formats de date valides (`!isNaN(Date.parse(val))`) avant de générer les filtres de présence, d'activité ou de connexions. Lever une `BadRequestException` en cas d'erreur.

---

### 3. Bugs de présence & Mandats (Backend API)

#### [MODIFY] [presence.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.ts)

- **Double-tap / End Day non atomique (`processEndDay`) :**
  - Utiliser `updateMany` conditionné sur `officialDepartureTime: null` :
    ```typescript
    const result = await tx.presence.updateMany({
      where: { id: presence.id, officialDepartureTime: null },
      data: { ... }
    })
    if (result.count === 0) {
      throw new BadRequestException("Départ déjà enregistré pour aujourd'hui.")
    }
    const updated = await tx.presence.findUniqueOrThrow({ where: { id: presence.id } })
    ```
- **Race condition dans `processFirstLogin` :**
  - Catcher l'exception Prisma `P2002` (conflit d'unicité sur `userId_date`).
  - En cas de conflit, récupérer l'enregistrement déjà créé par l'autre requête concurrente et le renvoyer de façon transparente sans erreur 500.

#### [MODIFY] [presence.schedule.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.schedule.service.ts)

- **Mandats journaliers & Night Shift :**
  - Modifier `getScheduleSource` pour renvoyer `isNightShift: user.scheduleGroup?.isNightShift ?? false` au lieu d'un `false` inconditionnel en cas de mandat journalier actif.
- **Nettoyage :**
  - Supprimer la fonction inutilisée/morte `getDailyMandate`.

---

### 4. Correctifs Frontend Web

#### [MODIFY] [user.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/types/user.ts)

- Ajouter `mustChangePassword?: boolean` dans l'interface `User`.

#### [NEW] [MustChangePasswordGuard.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/auth/MustChangePasswordGuard.tsx)

- Créer un composant client minimaliste qui redirige l'utilisateur vers `/mon-profil` si `mustChangePassword` est vrai et qu'il navigue sur une autre page.

#### [MODIFY] [layout.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/layout.tsx>)

- Injecter le composant `<MustChangePasswordGuard mustChangePassword={!!user.mustChangePassword} />` dans le layout protégé.

#### [MODIFY] [MonProfilClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/profile/MonProfilClient.tsx)

- Si `user.mustChangePassword` est vrai :
  - Forcer `activeTab` à `'password'`.
  - Masquer/désactiver l'onglet d'information.
  - Masquer/désactiver le bouton de retour ou d'annulation.
  - Afficher une bannière d'alerte rouge : « Pour des raisons de sécurité, vous devez modifier votre mot de passe temporaire pour pouvoir continuer à utiliser l'application. »

#### [MODIFY] [api.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/api.ts)

- **Erreur 403 & Redirection :**
  - Ne rediriger vers `/login` que si le statut HTTP est `401`.
  - Laisser les erreurs `403` lever une exception `ApiError` normalement pour permettre aux formulaires et pages d'afficher le message d'erreur d'accès refusé ou de changement de mot de passe.

#### [MODIFY] [page.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/onglets/page.tsx>)

- Conserver `'DAF'` dans `CAN_VIEW`, mais retirer `DAF` de `canManageAll` : la DAF gère uniquement son périmètre BU/département.

#### [MODIFY] [TabsManager.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/tabs/TabsManager.tsx)

- Permettre au bouton de création d'onglet de s'afficher pour le rôle DAF uniquement si une BU/direction lui est assignée.

#### [MODIFY] [UsersManager.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/users/UsersManager.tsx)

- Remplacer `|| undefined` par `|| null` pour les champs relationnels `businessUnitId`, `poleId` et `managerId` afin de permettre à l'administrateur de vider explicitement ces valeurs lors de la modification d'un compte.

#### [MODIFY] [ParametresClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/parametres/ParametresClient.tsx)

- Remplacer `|| undefined` par `|| null` pour `expectedDepartureTime`, `businessUnitId` et `poleId` pour le formulaire des groupes horaires afin de pouvoir les dissocier.

#### [MODIFY] [BgRestorer.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/ui/BgRestorer.tsx)

- Échapper les guillemets de `m['vdm_bg_image']` via `.replace(/"/g, '\\"')` avant de l'injecter dans la propriété CSS `--vdm-bg-image`.

---

## Verification Plan

### Automated Tests

- Vérifier le bon formatage du code et l'absence d'erreurs TypeScript :
  - `npm run format`
  - `npm run build:api`
  - `npm run build:web`

### Manual Verification

- **Vérification d'atomicité :**
  - Simuler deux check-out simultanés pour vérifier que l'un d'eux lève correctement une `BadRequestException` sans écraser silencieusement le premier départ.
- **Vérification gouvernance onglets :**
  - Se connecter avec un compte CTO et vérifier la gestion globale des onglets.
  - Se connecter avec un compte PDG et vérifier la gestion globale des onglets hors modification du CTO/super admin.
  - Se connecter avec un compte DAF ou responsable/directeur et vérifier que la création/gestion d'onglets est limitée à son département/BU.
- **Vérification Force Rotation (seed) :**
  - Se connecter avec n'importe quel compte seedé pour la première fois et vérifier qu'il est redirigé vers l'écran de profil pour changer son mot de passe, avec interdiction d'accéder aux autres pages.
- **Vérification d'énumération :**
  - Tenter de se connecter avec un nom d'utilisateur inexistant ou erroné, et vérifier que la durée de réponse (temps CPU consommé par bcrypt) et le message d'erreur ("Identifiants invalides") sont identiques.
