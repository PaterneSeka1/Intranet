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

## Ajustement — Images personnalisées pour les icônes d'onglets — 2026-07-26

- `[x]` Backend — Autoriser une icône image optimisée dans le champ `icon`.
- `[x]` Frontend — Ajouter un bouton de sélection d'image dans la liste des icônes.
- `[x]` Frontend — Redimensionner l'image avant sauvegarde et adapter son affichage dans les cartes.
- `[x]` Validation — Lancer formatage et builds API/Web.

### Audit icônes image — 2026-07-26

- Les onglets acceptent désormais une icône image optimisée dans `icon`.
- Le sélecteur d'icône propose un bouton `IMG` pour importer une image locale.
- L'image est redimensionnée côté navigateur à 128px max et encodée en WebP si possible.
- Les cartes et la prévisualisation affichent les images en `object-contain` pour préserver les proportions.
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK.
- `git diff --check` : OK.

## Ajustement — Actualisation temps réel des annonces — 2026-07-26

- `[x]` Dépendances — Ajouter Socket.IO côté API et client web.
- `[x]` Backend — Créer un gateway Socket.IO pour diffuser les changements d'annonces.
- `[x]` Backend — Émettre un événement après création, modification, activation/désactivation ou suppression d'une annonce.
- `[x]` Frontend — Connecter le layout protégé au socket et refetch les annonces actives.
- `[x]` Frontend — Alimenter automatiquement la bannière et le widget annonces avec l'état temps réel.
- `[x]` Validation — Lancer formatage et builds API/Web.

### Audit temps réel annonces — 2026-07-26

- Socket.IO est ajouté côté API (`@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`) et côté web (`socket.io-client`).
- Le namespace `/announcements` émet `announcements:changed` après création, modification, activation/désactivation ou suppression.
- L'événement socket ne transporte pas la liste des annonces ; le client refetch `/api/announcements?active=true` avec les cookies existants.
- La bannière et le widget partagent le même état client temps réel via `LiveAnnouncements`.
- Les règles existantes restent conservées : bannière = annonces épinglées ; widget = annonces actives non épinglées avec fallback épinglé.
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK après nettoyage du cache `.next`.
- `git diff --check` : OK.
- `npm audit --omit=dev` : vulnérabilités restantes détectées dans l'arbre de dépendances ; les corrections complètes proposées impliquent notamment des migrations majeures Nest 11 et Next 16, à traiter dans une tâche séparée.

## Analyse complète & corrections annonces — 2026-07-26

- `[x]` Audit — Relire le flux annonces backend/frontend : API, DTOs, permissions, bannière, widget, layout et temps réel.
- `[x]` Backend — Filtrer les annonces ciblées BU pour les utilisateurs non globaux : annonces globales + annonces de leur BU uniquement.
- `[x]` Backend — Conserver la visibilité complète pour `CTO_ADMIN` et `PDG`, et la liste active filtrée quand `active=true`.
- `[x]` Backend — Valider et nettoyer les champs d'annonce : titre, corps, BU ciblée, dates invalides, expiration avant publication.
- `[x]` Backend — Normaliser le namespace Socket.IO `/announcements` et le parsing des origines CORS.
- `[x]` Frontend — Corriger la date d'expiration issue du calendrier pour expirer en fin de journée.
- `[x]` Frontend — Valider le formulaire avant envoi et garder un tri stable après création/modification/activation.
- `[x]` Frontend — Faire réapparaître une annonce épinglée modifiée même si l'ancienne version avait été masquée.
- `[x]` Frontend — Renforcer `LiveAnnouncements` avec resynchronisation, refresh périodique et refresh programmé à l'expiration.
- `[x]` Validation — Lancer type-checks, builds API/Web et contrôle du diff.

### Audit annonces corrigées — 2026-07-26

- Les utilisateurs non `CTO_ADMIN`/`PDG` ne voient plus les annonces ciblées sur une autre BU.
- Les annonces globales restent visibles par tous les utilisateurs authentifiés quand elles sont actives et dans leur fenêtre de publication.
- `CTO_ADMIN` et `PDG` gardent l'accès complet à la gestion des annonces ; `DAF` et autres rôles restent refusés sur la page `/annonces`.
- Une BU inexistante ou une date incohérente retourne maintenant une erreur métier propre au lieu d'un état incohérent ou d'une erreur Prisma brute.
- Une annonce modifiée réapparaît dans la bannière si l'utilisateur avait masqué une ancienne version.
- Le widget et la bannière utilisent le même état live, rafraîchi par Socket.IO, par intervalle de secours et au moment de l'expiration d'une annonce.
- `npm run type-check --workspace=apps/api` : OK.
- `npm run type-check --workspace=apps/web` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK.
- `git diff --check` : OK.

## Ajustement — Actions annonces & managers directs — 2026-07-27

- `[x]` Annonces — Remplacer les boutons d'action par un select `Actions à effectuer`.
- `[x]` Annonces — Garder les actions existantes : activer/désactiver, modifier, supprimer.
- `[x]` Utilisateurs — Limiter le select `Manager direct` aux rôles de direction/responsabilité.
- `[x]` Build Web — Supprimer `apps/web/.next` avant le build propre pour éviter les manifestes incohérents et le fallback hors connexion.
- `[x]` Documentation — Mettre à jour les fichiers `.md`.

### Audit actions & managers — 2026-07-27

- La page `/annonces` affiche un select par annonce avec les actions disponibles.
- Le select `Manager direct` affiche uniquement les utilisateurs actifs avec les rôles `CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU` ou `RESPONSABLE_POLE`.
- Les rôles `CONSULTANT`, `STAGIAIRE` et `PRESTATAIRE` ne sont plus proposés comme managers directs.
- `npm run type-check --workspace=apps/web -- --incremental false` : OK.
- `rm -rf apps/web/.next` : effectué avant build.
- `npm run build --workspace=apps/web` : OK.

## Ajustement — Rôle employé générique — 2026-07-27

- `[x]` Base de données — Ajouter le rôle Prisma `EMPLOYE`.
- `[x]` Migration — Ajouter `20260727000000_add_employe_role`.
- `[x]` API — Traiter `EMPLOYE` comme rôle sans droits de gestion, accueil uniquement.
- `[x]` API — Autoriser `EMPLOYE` à lire les onglets actifs de sa BU, comme les autres rôles standards.
- `[x]` Frontend — Ajouter `EMPLOYE` aux types, labels, badges, sidebar et formulaire utilisateur.
- `[x]` Frontend — Utiliser `EMPLOYE` comme rôle par défaut à la création d'utilisateur.
- `[x]` Seed — Reclasser les comptes nominatifs non-consultants en `EMPLOYE`.
- `[x]` Documentation — Mettre à jour les fichiers `.md`.

### Audit rôle employé — 2026-07-27

- `EMPLOYE` couvre les salariés qui ne sont ni consultants, ni stagiaires, ni prestataires.
- `EMPLOYE` reste rattachable à une BU/un pôle mais ne reçoit aucun droit de gestion.
- `EMPLOYE` n'apparaît pas dans le select `Manager direct`.
- La base locale contient 6 comptes `EMPLOYE` après mise à jour ciblée.
- `prisma migrate deploy` reste bloqué par l'ancienne migration échouée `20260630000001_module3_presence`; l'enum local a donc été appliqué par SQL ciblé.
- `npx prisma validate --schema packages/database/prisma/schema.prisma` : OK.
- `npm run db:generate` : OK.
- `npm run type-check --workspace=apps/api` : OK.
- `npm run type-check --workspace=apps/web -- --incremental false` : OK.
- `npx tsc --noEmit -p packages/database/tsconfig.json` : OK après suppression de l'export obsolète `TabType`.
- `npm run build:api` : OK.
- `rm -rf apps/web/.next` : effectué avant build.
- `npm run build:web` : OK.

## Clarification — Onglets PDG/DAF & managers directs — 2026-07-27

- `[x]` Frontend utilisateurs — Ne plus traiter `CTO_ADMIN` comme rôle sans BU afin de conserver son rattachement `DT`.
- `[x]` Seed — Rattacher le `CTO` et la `DAF` au `PDG` comme manager direct.
- `[x]` Seed — Garder la création des onglets DAF par la `DAF`, et non par son manager direct.
- `[x]` Frontend auth — Distinguer une API indisponible d'une session expirée : `401/403` renvoie vers `/login`, erreur réseau/API down affiche la page indisponible.
- `[x]` Documentation — Aligner `README.md`, `TACHE.md`, `SESSION_HANDOFF.md` et `contexte_vdm_compact_avec_schema.md`.

### Audit onglets PDG/DAF & managers — 2026-07-27

- `PDG` reste admin global des onglets : il peut créer des onglets globaux ou ciblés pour toutes les BU sans exception.
- `DAF` n'est pas admin globale, mais peut créer et gérer ses propres onglets sur sa BU/direction.
- `Manager direct` reste un rattachement hiérarchique ; il ne détermine pas qui crée les onglets ni le périmètre d'accès.
- Le seed assigne `PDG` comme manager direct du `CTO` et de la `DAF`.
- Le seed attribue les onglets `DAF` à l'utilisateur `DAF`; les autres onglets initiaux restent attribués au `CTO`.
- Une session expirée ou invalide ne doit plus afficher `Service temporairement indisponible`; elle redirige vers `/login`.
- `npm run type-check --workspace=apps/api` : OK.
- `npm run type-check --workspace=apps/web -- --incremental false` : OK.
- `npx tsc --noEmit -p packages/database/tsconfig.json` : OK.
- `npx prettier --check packages/database/prisma/seed.ts apps/web/src/components/users/UsersManager.tsx` : OK.
- `git diff --check` : OK.

## Correctif sécurité — Masquage IP/géolocalisation pour les rôles employés — 2026-07-28

Demande : les employés ne doivent plus voir leur adresse IP ni leur géolocalisation dans leurs plateformes ; seuls les responsables doivent tout voir.

- `[x]` Backend — Masquer `ipAddress` dans l'historique de connexions (`getMyConnections`) pour les rôles accueil, comme l'adresse GPS et `mapsUrl`.
- `[x]` Backend — Appliquer la redaction de géolocalisation par rôle dans `getTodayAllPresences` (méthode oubliée lors du premier passage de `redactPresenceForRole`).
- `[x]` Backend — Ne plus renvoyer l'objet `ConnectionLog` complet (IP, latitude/longitude, adresse) dans les réponses `login-log`/`logout-log` ; ces champs n'étaient consommés par aucun appelant.
- `[x]` Frontend — Masquer la colonne IP du tableau "Mon historique" pour les rôles accueil, au même titre que la colonne adresse GPS.
- `[x]` Frontend — Remplacer les listes de rôles "accueil uniquement" codées en dur (`accueil/page.tsx`, `mon-historique/page.tsx`, `presences/page.tsx`) par la constante partagée `ACCUEIL_ONLY_ROLES` de `types/user.ts`, pour éviter toute divergence future.
- `[x]` Validation — Lancer formatage et builds API/Web.
- `[x]` Documentation — Mettre à jour `TACHE.md` et `SESSION_HANDOFF.md`.

### Audit correctif IP/géolocalisation — 2026-07-28

- Rôles accueil (`EMPLOYE`, `CONSULTANT`, `STAGIAIRE`, `PRESTATAIRE`) : IP et géolocalisation totalement masquées, côté API (source de vérité) et côté interface.
- Rôles responsables (`CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU`, `RESPONSABLE_POLE`) : accès inchangé à l'IP et à la géolocalisation (page Pilotage, journal d'activité, exports CSV), déjà réservés à ces rôles via `assertAllowed`.
- Aucun changement de schéma Prisma ni de migration requis.
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK après nettoyage du cache `.next`.
- `git diff --check` : OK.

## Nouvelles fonctionnalités — Jours fériés, permissions, reporting, notifications, PDF, recherche — 2026-07-28

Demande : ajouter les 7 fonctionnalités identifiées lors de l'audit du repo (hors périmètre RH classique — congés/documents administratifs — déjà couvert par un outil externe). Plan détaillé validé avec l'utilisateur avant implémentation (`EnterPlanMode`), décisions actées : PDF via Puppeteer, permissions centralisées sans UI/DB, reporting BU→CTO→PDG en rollup automatique, sessions actives en lecture seule.

- `[x]` Migration Prisma — Modèles `PublicHoliday` et `Notification` (+ enum `NotificationType`), appliqués via `db:push` (P3006 déjà connu sur `prisma migrate dev`, cf. session `EMPLOYE`).
- `[x]` Backend — Centraliser dans `common/permissions.ts` toutes les listes de rôles dupliquées dans `pilotage`/`reports`/`presence`/`tabs`/`announcements`/`users` (16 nouvelles constantes, câblage des constantes historiques `CAN_VIEW_USERS`/`CAN_MANAGE_USERS` sur `users.controller.ts`), sans changement de comportement.
- `[x]` Backend + Frontend — Module `public-holidays` (CRUD CTO_ADMIN) + intégration `pilotage.service.ts::getSummary` (`isPublicHoliday`) + onglet "Jours fériés" dans `/parametres` + affichage widget calendrier et bannière `/presences`. Seed : 7 jours fixes CI.
- `[x]` Backend + Frontend — Sessions actives : ajout `userAgent` au select de `getMyConnections` (sans le démasquer pour les rôles accueil), nouvel onglet "Sécurité" dans `/mon-profil` (lecture seule, parsing UA maison sans dépendance).
- `[x]` Backend + Frontend — Reporting hiérarchique : `pilotage.service.ts::getPeriodReport` (agrégation semaine/mois par BU, hors week-ends) + section `PeriodReportSection` dans `/pilotage` (BarChart taux par BU + LineChart tendance).
- `[x]` Backend + Frontend — Centre de notifications : modèle `Notification`, module `notifications` avec gateway Socket.IO **authentifiée** (parsing manuel du cookie JWT au handshake, rejet si invalide — contrairement au gateway `announcements` existant), déclencheurs sur `createMandate` et `announcements.create`, cloche `NotificationsBell` montée dans `Sidebar`, `MobileSidebarToggle` et le header "accueil seul".
- `[x]` Backend + Frontend — Export PDF : dépendance `puppeteer`, refactor de `reports.service.ts` (extraction des requêtes Prisma en méthodes réutilisables `get*Rows`/`getGeneralData`), singleton `PdfBrowserService` (`OnModuleInit`/`OnModuleDestroy`, `app.enableShutdownHooks()` ajouté à `main.ts`), `ReportsPdfService` (rendu HTML→PDF brandé), 4 nouvelles routes `/reports/*/pdf`, bouton PDF à côté du bouton CSV dans `PilotageClient`.
- `[x]` Backend + Frontend — Recherche globale : module `search` (réimplémente les scopes existants de `users`/`tabs`/`announcements`, jamais plus permissif), composant `GlobalSearch` (debounce 300ms) monté dans `Sidebar` et `MobileSidebarToggle`.
- `[x]` Validation — `tsc --noEmit` après chaque chantier, `npm run format`, `npm run build:api`, `npm run build:web` (build final).
- `[x]` Tests end-to-end réels (API démarrée en mode dev, comptes seedés) : handshake Socket.IO rejeté sans cookie / accepté avec cookie valide + réception temps réel confirmée ; 4 PDF générés et rendu visuel vérifié ; parité de permissions DAF CSV/PDF confirmée (403 sur activité/connexions/général, 200 sur présences) ; scope recherche confirmé pour un `RESPONSABLE_BU` (ne trouve pas un utilisateur d'une autre BU) ; base reseedée après tests pour repartir d'un état propre.
- `[x]` Documentation — Mettre à jour `TACHE.md` et `SESSION_HANDOFF.md`.

### Audit nouvelles fonctionnalités — 2026-07-28

- Aucune régression fonctionnelle sur le refactor de permissions : la réécriture de la condition DAF (`CAN_EXPORT_EXTENDED_REPORTS`) a été vérifiée équivalente et testée en conditions réelles.
- Le gateway `notifications` authentifie son handshake (contrairement à `announcements`, laissé inchangé, hors périmètre demandé) — pattern à réutiliser pour tout futur namespace Socket.IO sensible.
- Puppeteer téléchargé avec succès (~300 Mo Chromium) en local ; notes opérationnelles VPS consignées dans le plan (bibliothèques système Linux requises, RAM du process persistant, nécessité de `enableShutdownHooks` pour un arrêt propre).
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK après nettoyage du cache `.next`.
- `git diff --check` : OK.

## Identité visuelle — Logo entreprise & icônes PWA — 2026-07-28

Demande : intégrer un nouveau logo pour la PWA, puis un second logo distinct comme logo officiel de l'entreprise ; supprimer le premier visuel (une planche complète, pas une icône) une fois les icônes PWA extraites.

- `[x]` Recadrage précis de l'emblème circulaire depuis `logo_intranet.png` (planche complète avec texte "INTRANET" et bande de fonctionnalités, exclus du recadrage) → génération de `icon-192.png` et `icon-512.png`, référencés uniquement dans `manifest.ts` (aucun autre usage, conformément à la demande).
- `[x]` Suppression de `logo_intranet.png` (fichier source de la planche, plus nécessaire une fois les icônes extraites).
- `[x]` `logo_entreprise.png` (nouveau logo "Veilleur des Médias" fourni par l'utilisateur) déposé dans `public/` et activé comme logo de l'entreprise via le paramètre existant `vdm_logo` (mécanisme déjà en place : Sidebar, MobileSidebarToggle, pages login/mot-de-passe-oublié/réinitialisation, favicon).
- `[x]` Correctif — `settings.service.ts::isValidImageUrl` n'acceptait que `http(s)://` et `data:image/`, rejetant les chemins relatifs (`/logo_entreprise.png`) pourtant déjà utilisés comme fallback ailleurs dans le code (`/icon.svg`) ; ajout du support des chemins relatifs racine.
- `[x]` **Bug découvert et corrigé** — `middleware.ts` redirigeait vers `/login` toute requête non authentifiée vers des fichiers publics statiques (`manifest.webmanifest`, `sw.js`, `offline.html`, icônes PWA, logo), cassant silencieusement l'installabilité PWA (le manifeste renvoyait du HTML au lieu du JSON) et l'affichage du logo sur la page de connexion elle-même. Matcher étendu pour exclure ces fichiers, sur le même principe que l'exclusion déjà en place pour `favicon.ico`.
- `[x]` Validation — `tsc --noEmit`, `npm run format`, `npm run build:api`, `npm run build:web`.
- `[x]` Test réel : API + Web démarrés en mode dev, paramètre `vdm_logo` appliqué via `PATCH /settings` (comme le ferait un admin), vérification `curl` que `manifest.webmanifest`/`sw.js`/`offline.html`/les icônes/le logo renvoient bien du contenu valide (200, bytes PNG/JSON corrects) sans cookie de session, et qu'une page protégée continue de rediriger correctement (307). Base reseedée après test (le paramètre `vdm_logo` persiste au reseed, `AppSetting` n'étant pas vidé par `seed.ts`).
- `[x]` Documentation — Mettre à jour `TACHE.md` et `SESSION_HANDOFF.md`.

### Audit identité visuelle & correctif middleware — 2026-07-28

- Le favicon (`layout.tsx` : `vdm_favicon || vdm_logo || '/icon.svg'`) utilise maintenant `logo_entreprise.png` par défaut, faute de `vdm_favicon` dédié — ce logo étant un bandeau large (2172×724), le rendu dans l'onglet navigateur (case carrée) peut sembler écrasé. À surveiller ; un favicon carré dédié pourrait être ajouté via `vdm_favicon` si le rendu ne convient pas.
- Le bug de middleware corrigé ici affectait potentiellement l'installation PWA depuis le tout premier chargement de `/login`, avant même la correction des icônes PWA de cette session — les deux correctifs sont complémentaires et nécessaires ensemble pour une PWA installable.
- `npm run format` : OK.
- `npm run build:api` : OK.
- `npm run build:web` : OK après nettoyage du cache `.next`.
- `git diff --check` : OK.

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

---

## Fix récurrent — Démarrage automatique de PostgreSQL avant l'API — 2026-07-29

Signalé par l'utilisateur comme un problème trop récurrent : `npm run dev:api` échoue par intermittence avec `PrismaClientInitializationError: Can't reach database server at localhost:5434`, faute de conteneur Postgres actif.

- `[x]` Diagnostiquer la cause : le daemon Docker Desktop n'est pas relancé automatiquement (ex. après redémarrage du Mac), donc le conteneur `vdm_postgres` (`docker-compose.yml`) n'existe pas au démarrage de l'API
- `[x]` Créer `scripts/ensure-db.sh` : démarre Docker Desktop si besoin (`open -a Docker`, avec attente jusqu'à 120s), lance `docker compose up -d postgres`, attend `pg_isready` (jusqu'à 30s)
- `[x]` Ajouter `db:up` et `predev:api` dans `package.json` racine, déclenchés automatiquement avant `npm run dev:api` via le hook npm `pre<script>`
- `[x]` Validation — testé en conditions réelles : Docker/Postgres arrêtés puis `npm run dev:api` relance tout automatiquement, API démarrée sans erreur Prisma
- `[x]` Documentation — `README.md`, `CLAUDE.md`, `SESSION_HANDOFF.md` mis à jour

//SESSION TERMINEE

## Fix — Page "hors ligne" affichée trop souvent en navigation — 2026-07-29

Signalé par l'utilisateur : navigation qui retombe systématiquement sur un écran "hors ligne", alors que web/API/DB tournent normalement — gênant l'usage courant.

- `[x]` Diagnostiquer les deux mécanismes pouvant produire cet écran : fallback PWA réel (`public/sw.js`/`public/offline.html`) vs `ServiceUnavailablePage.tsx` déclenché par `(protected)/layout.tsx` sur échec de `getCurrentUserState()`
- `[x]` Première hypothèse (aléa réseau transitoire) — [MODIFY] [auth.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/auth.ts) : ajout de `fetchWithTimeout` (8s) + retry dans `getCurrentUserState`, timeout aussi sur `serverFetch` — correctif utile mais insuffisant, le symptôme persistait
- `[x]` **Cause racine trouvée par reproduction** : `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` (`app.module.ts:26`) posé en garde globale (`APP_GUARD`) limite **toute** l'API à 10 req/min/IP, y compris `/auth/me`, `/announcements`, `/settings`, `/notifications/*`, `/pilotage/*` — un seul chargement de page protégée dépasse déjà ce quota, d'où un `429` systématique traité comme panne
- `[x]` Reproduit isolément : boucle `fetch` locale vers `/api/health` → OK jusqu'à la 10e requête, puis `429` en rafale jusqu'à expiration de la fenêtre de 60s
- `[x]` [MODIFY] [app.module.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/app.module.ts) — limite globale relevée à `300` req/min ; les surcharges `@Throttle` existantes sur `login`/`forgot-password`/`reset-password` (`auth.controller.ts`) restent inchangées (déjà correctement scopées pour la protection anti brute-force)
- `[x]` Validation — reproduction du 429 confirmée avant correctif puis disparition après (60/60 requêtes locales en rafale sans 429) ; `npx tsc --noEmit -p apps/api/tsconfig.json`, `npm run build:api`, `npx tsc --noEmit -p apps/web/tsconfig.json`, `rm -rf apps/web/.next` puis `npm run build:web` : OK
- `[ ]` Vérification manuelle — naviguer plusieurs minutes sur toutes les pages protégées en conditions réelles et confirmer que l'écran "service indisponible" n'apparaît plus

//SESSION TERMINEE

## Fix — "Mon historique" ne charge aucune donnée — 2026-07-29

Demande : vérifier que `/mon-historique` charge bien les données.

- `[x]` Relire le code de la page/API (`mon-historique/page.tsx`, `presence.controller.ts`/`presence.service.ts::getMyConnections`) — correct, aucun bug de fetch/affichage
- `[x]` Constater en base que `presences`, `activity_logs` et `connection_logs` sont à 0 ligne, y compris pour l'utilisateur en session (21/22 comptes ont encore `mustChangePassword = true`)
- `[x]` Identifier la cause : dans `LoginClient.tsx`, un compte avec `mustChangePassword = true` était redirigé vers `/mon-profil` sans jamais passer par la géolocalisation obligatoire (`requiresFirstLoginGeolocation`, `auth.service.ts:83`) ni par `/presence/first-login` — aucune présence/`ConnectionLog` n'est donc jamais créée le jour du changement de mot de passe forcé, ni ensuite via `MonProfilClient.tsx::handlePasswordSubmit` (simple `router.refresh()`)
- `[x]` [MODIFY] [LoginClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/auth/LoginClient.tsx) — vérifier `requiresFirstLoginGeolocation` avant `mustChangePassword` dans `handleSubmit` ; le flux GPS s'exécute d'abord, `MustChangePasswordGuard` renvoie ensuite vers `/mon-profil` comme avant
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json`, `rm -rf apps/web/.next` puis `npm run build:web` : OK
- `[ ]` Non rétro-compatible : les comptes déjà bloqués sans présence du jour (dont le compte en session actuelle) doivent se déconnecter/reconnecter une fois pour déclencher la géolocalisation et faire apparaître leurs premières lignes d'historique
- `[ ]` Vérification manuelle — se déconnecter/reconnecter avec un compte `mustChangePassword = true` et vérifier que l'écran GPS apparaît avant le changement de mot de passe forcé, puis que `/mon-historique` affiche la ligne de connexion du jour

//SESSION TERMINEE

## Fix — Widgets flottants absents pour les rôles accueil — 2026-07-31

Demande : ajouter les widgets flottants (annonces, horloge, calendrier, météo) pour tous les employés sans exception.

- `[x]` Diagnostiquer la cause : `(protected)/layout.tsx` rend deux arborescences selon `isAccueilOnly(user.role)` ; la branche `MobileSidebarToggle` passe `showWidgets` à `LiveAnnouncements`, mais la branche dédiée aux rôles accueil (`EMPLOYE`, `CONSULTANT`, `STAGIAIRE`, `PRESTATAIRE`) ne le faisait pas
- `[x]` [MODIFY] [layout.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/layout.tsx>) — ajout de la prop `showWidgets` sur l'appel `LiveAnnouncements` de la branche `isAccueilOnly`
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`

### Audit widgets accueil — 2026-07-31

- Les rôles accueil (`EMPLOYE`, `CONSULTANT`, `STAGIAIRE`, `PRESTATAIRE`) reçoivent désormais les mêmes widgets flottants (annonces, horloge, calendrier, météo) que les autres rôles.
- `Widgets.tsx` lui-même n'impose aucune restriction de rôle ; le blocage venait uniquement du layout parent.
- `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.

//SESSION TERMINEE

## Automatisation — Synchronisation automatique SESSION_HANDOFF.md/TACHE.md — 2026-07-31

Demande : automatiser la mise à jour de `SESSION_HANDOFF.md`/`TACHE.md` après chaque requête, sans intervention manuelle.

- `[x]` Choisir le mécanisme : Stop hook (`.claude/settings.local.json`, personnel/non versionné) plutôt qu'un appel récursif `claude -p` — écarté après test réel (bloqué par le trust-dialog du CLI en mode non interactif sur ce poste)
- `[x]` Créer `.claude/hooks/sync-md-docs.sh` : détecte les changements de code non commités dans `vdm-intranet/apps`/`vdm-intranet/packages`, compare à un hash stocké dans `.claude/.md-sync-state` (gitignored), et bloque la fin de tour (`decision: "block"`) tant que les deux fichiers n'ont pas été mis à jour
- `[x]` Enregistrer le hook dans `.claude/settings.local.json` (racine `/Users/macbookpro/YAGAMI/Intranet`, hors du dossier `vdm-intranet`)
- `[x]` Ajouter `.claude/.md-sync-state` (et `.claude/settings.local.json`) au `.gitignore` racine
- `[x]` Validation — `jq -e` sur le hook, test manuel du script (détection + idempotence après écriture du hash)

### Audit synchronisation automatique — 2026-07-31

- Portée volontairement limitée à `SESSION_HANDOFF.md`/`TACHE.md` (pas les autres `.md` du projet), déclenchement uniquement quand du code a changé dans `apps`/`packages` — choix validés avec l'utilisateur.
- Limite connue : le watcher de settings d'une session déjà démarrée ne surveille pas un `.claude/settings.local.json` créé après son lancement ; un `/hooks` ou un redémarrage peut être nécessaire pour l'activer immédiatement dans une session en cours (les nouvelles sessions le chargent normalement au démarrage).
- Fichiers spécifiques à ce poste (`settings.local.json`, `.md-sync-state`), non partagés avec l'équipe.

//SESSION TERMINEE

## Fix — Annonces épinglées absentes du widget flottant — 2026-07-31

Demande : dans le widget "Annonces", les annonces épinglées doivent aussi apparaître, fixées en haut.

- `[x]` Diagnostiquer la cause : `AnnouncementWidget` (`Widgets.tsx`) n'affichait les annonces épinglées qu'en fallback (aucune annonce non épinglée disponible), au lieu de les afficher en priorité et en permanence en tête de liste
- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — `AnnouncementWidget` place désormais les annonces épinglées en tête (toujours affichées), complétées par les annonces non épinglées jusqu'à 3 éléments au total
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`, correction de la description obsolète du comportement du widget

### Audit widget annonces épinglées — 2026-07-31

- Le tri backend (`announcements.service.ts::findAll`, `orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }]`) était déjà correct ; seul le frontend cassait cet ordre en priorisant les non épinglées.
- Le widget affiche maintenant les annonces épinglées en premier et de façon permanente, puis complète avec les annonces non épinglées les plus récentes jusqu'à 3 éléments.
- Aucun changement backend, base de données ou permission requis.

## Ajustement — Widget annonces : afficher toutes les annonces avec défilement — 2026-07-31

Demande complémentaire, même jour : toutes les annonces actives doivent s'afficher dans le widget, avec possibilité de scroller.

- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — `AnnouncementWidget` ne limite plus la liste à 3 éléments : bloc épinglées fixe en haut (non scrollable) + bloc non épinglées scrollable (`max-h-56 overflow-y-auto`) en dessous
- `[x]` Extraction du sous-composant `AnnouncementItem` pour partager le rendu entre les deux blocs sans duplication
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`

## Correctif — Widget annonces débordant l'écran avec beaucoup d'épinglées — 2026-07-31

Signalé par capture d'écran utilisateur sur `/annonces` : avec un grand nombre d'annonces épinglées, le bloc fixe (non scrollable) grossissait sans limite et le widget débordait de l'écran. Demande : plafonner la taille du widget et faire défiler l'ensemble de la liste.

- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — `AnnouncementWidget` fusionne épinglées + non épinglées en une seule liste (épinglées en premier) dans une unique zone scrollable, sous un en-tête fixe (`shrink-0`)
- `[x]` Widget entier plafonné à `max-h-[min(60vh,26rem)]` quel que soit le nombre d'annonces
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`

//SESSION TERMINEE

## Fix — Rechargement de la page de login sur erreur de connexion — 2026-07-31

Demande : ajouter un toast d'erreur sur la page de connexion et retirer le rechargement de page en cas d'erreur.

- `[x]` Diagnostiquer la cause : `api.ts::req` redirigeait/rechargeait (`window.location.href = '/login?...'`) sur **tout** statut 401, y compris la réponse de `POST /auth/login` en cas de mauvais identifiants — comportement correct pour une session expirée sur une route protégée, mais provoquant un rechargement intempestif de la page de connexion elle-même sur un simple mot de passe incorrect
- `[x]` [MODIFY] [api.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/api.ts) — ajout de l'option `skipAuthRedirect` sur `req`, activée uniquement pour `api.auth.login`, pour ne plus rediriger/recharger sur un 401 de connexion
- `[x]` [MODIFY] [LoginClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/auth/LoginClient.tsx) — remplacement du bandeau d'erreur inline (`error`/`setError`) par `toast.error(...)`, conforme à la convention déjà utilisée ailleurs (`MonProfilClient.tsx`)
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`

//SESSION TERMINEE

## Fix — Suppression de notifications — 2026-07-31

Demande : pouvoir supprimer les notifications depuis la cloche `NotificationsBell`.

- `[x]` Backend — Ajouter `notifications.service.ts::remove(id, userId)` (vérification ownership via `findFirst` avant `delete`, même pattern que `markRead`)
- `[x]` Backend — Ajouter la route `DELETE /notifications/:id` dans `notifications.controller.ts`
- `[x]` Frontend — Ajouter `notificationsApi.remove(id)` dans `lib/notifications.ts`
- `[x]` Frontend — [MODIFY] [NotificationsBell.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/notifications/NotificationsBell.tsx) — bouton de suppression par notification (visible au survol), suppression optimiste de la liste et du compteur non lus
- `[x]` Validation — `npx tsc --noEmit -p apps/api/tsconfig.json`, `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[ ]` Vérification manuelle — supprimer une notification lue et une non lue depuis la cloche, vérifier la disparition immédiate et la mise à jour du compteur

//SESSION TERMINEE

## Ajustement — Widget annonces : titre seul cliquable avec détails en modale — 2026-08-03

Demande : dans le widget flottant "Annonces", n'afficher que le titre de chaque annonce, et le rendre cliquable pour ouvrir tous les détails.

- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — `AnnouncementItem` n'affiche plus l'aperçu du corps du message (`line-clamp-2`), seul le titre reste visible, sous forme de bouton
- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — nouveau sous-composant `AnnouncementDetailModal`, réutilisant le composant `Modal` déjà utilisé ailleurs dans l'app (`components/ui/Modal.tsx`), affichant titre, date complète, badge épinglée/unité d'affaires, corps intégral et auteur
- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — `AnnouncementWidget` garde en état l'annonce sélectionnée (`useState`) et ouvre la modale au clic sur le titre
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`
- `[ ]` Vérification manuelle — cliquer sur le titre d'une annonce dans le widget flottant et vérifier l'ouverture de la modale avec tous les détails (corps complet, date, épinglage, unité d'affaires, auteur)

### Ajustement — Zone cliquable étendue à toute la ligne — 2026-08-03

Demande complémentaire, même jour : rendre toute la ligne de l'annonce cliquable, pas seulement le texte du titre.

- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — `AnnouncementItem` transformé en `<button>` pleine largeur englobant le badge épinglée, la date et le titre, au lieu d'un `<button>` limité au seul texte du titre
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`

Note : re-déclenchement du hook de synchronisation sans nouveau changement de code — seul `tsconfig.tsbuildinfo` (artefact de build) a été régénéré par la re-vérification `tsc --noEmit` ci-dessus.

### Ajustement — Léger effet de survol sur toute la ligne — 2026-08-03

Demande complémentaire, même jour : ajouter un léger effet de survol visible sur toute la ligne de l'annonce, pas seulement sur le titre.

- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — `AnnouncementItem` : ajout de `hover:bg-gray-50`, coins arrondis (`rounded-lg`) et transition douce (`transition-colors`) sur le bouton pleine ligne, avec léger padding horizontal compensé par une marge négative pour ne pas décaler l'alignement avec le reste du widget
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`

## Audit complet du dépôt & corrections — 2026-08-03

Demande : analyser l'intégralité du dépôt pour relever les incohérences/incompréhensions, puis tout corriger. Audit mené via 3 agents en parallèle (backend, frontend, base de données) + vérifications manuelles ciblées sur chaque finding avant correction.

- `[x]` Backend — `users.service.ts::update()` réinitialise désormais `failedLoginAttempts`/`lockoutUntil` quand un admin force le changement de mot de passe d'un compte (auparavant seul `updateMe` le faisait ; un compte verrouillé réinitialisé par un admin restait bloqué jusqu'à 15 min de plus).
- `[x]` Backend — `mapsUrl` n'est plus jamais accepté depuis le client sur `login-log`/`logout-log` (`LoginLogDto`, `presence.service.ts`) : toujours reconstruit côté serveur via `buildMapsUrl`, comme c'était déjà le cas pour l'arrivée/le départ officiels.
- `[x]` Backend — `search.service.ts::searchAnnouncements` applique désormais le même bypass admin que `announcements.service.ts::findAll` : `CTO_ADMIN`/`PDG` retrouvent aussi les annonces inactives/expirées/futures via la recherche globale.
- `[x]` Backend — `tabs.service.ts::update()` revalide maintenant l'unicité d'URL (même contrôle manuel que `create()` pour les onglets globaux, où `@@unique([businessUnitId, url])` ignore les `NULL` côté PostgreSQL) et catche `P2002` proprement au lieu de laisser remonter une 500.
- `[x]` Backend — nettoyage : fonction morte `hasPresenceToday` supprimée ; `presence.service.ts` journalise désormais les groupes horaires avec `SCHEDULE_GROUP_CREATED/UPDATED/DELETED` au lieu de `CREATE/UPDATE/DELETE` génériques (labels déjà prêts côté `PilotageClient.tsx`, jusqu'ici jamais atteints) ; `icon` sur `CreateTabDto`/`UpdateTabDto` plafonné à 60 000 caractères au lieu de 100 000 (proportionné à une image 128×128 WebP/PNG) ; export `ConnectionLogType` ajouté à `packages/database/src/index.ts`.
- `[x]` Base de données — nouvelle migration `20260803120000_fix_schema_integrity` (n'altère aucune migration existante) : FK manquantes + colonne `createdById` (au lieu de `createdBy`) + colonne `isActive` sur `announcements` (écarts entre `0004_module4_tabs` et le schéma actuel, comblés jusqu'ici via `db push`) ; ré-création de l'enum `Role` dans l'ordre déclaré par `schema.prisma` (`EMPLOYE` avait été ajouté en fin d'enum physique par `20260727000000_add_employe_role`) ; FK ajoutée sur `Presence.sourceConnectionLogId -> ConnectionLog`.
- `[x]` Base de données — `schema.prisma` : relation Prisma explicite `Presence.sourceConnectionLogId -> ConnectionLog` (`onDelete: SetNull`) là où ce champ n'était qu'une colonne texte sans intégrité référentielle.
- `[x]` Base de données — `seed.ts` : hiérarchie `managerUsername` complétée pour les comptes pôle/BU/équipe restés sans manager (pôles INFO → `RBU_INFO`, consultants → responsable de leur pôle, équipes EREP/Analyses/SCI → responsable de BU, `RBU_SCI` → `CTO` car seule relation hiérarchique directe documentée dans `contexte_vdm_compact_avec_schema.md`, DT → `CTO`). `RBU_INFO`/`RBU_EREP`/`RBU_ANALYSES` restent volontairement sans manager : seule une coordination opérationnelle du CTO est documentée pour ces BU, pas un lien hiérarchique — aucun rattachement inventé. `LILIANE_KONAN` rattachée à `POLE_QSC` (comme `ANDREAS_BONI`, incohérence de rattachement corrigée).
- `[x]` Frontend — client HTTP unique (`lib/http.ts`, `apiFetch`/`apiFetchVoid`/`apiFetchBlob`) remplaçant 8 implémentations locales divergentes (`api.ts`, `presence.ts`, `pilotage.ts`, `announcements.ts`, `notifications.ts`, `public-holidays.ts`, `tabs.ts`, `search.ts`, `settings.ts`, `csv-export.ts`, `pdf-export.ts`, plus les fetch locaux de `UsersManager.tsx`/`MonProfilClient.tsx`) : seul un 401 redirige vers `/login` (plus jamais un 403, qui reste un refus applicatif affichable par l'appelant) ; `UsersManager.tsx`/`MonProfilClient.tsx` utilisent maintenant `api.users.*` (nouvel `api.users.updateMe`) au lieu de dupliquer un fetch.
- `[x]` Frontend — Sidebar : ajout du lien « Utilisateurs BU »/« Utilisateurs Pôle » manquant pour `DAF`/`RESPONSABLE_BU`/`RESPONSABLE_POLE`, qui avaient déjà un accès backend scopé réel (`CAN_VIEW_USERS`, `users.service.ts::scopeWhere`) mais aucun moyen d'y accéder depuis la navigation.
- `[x]` Frontend — `GlobalSearch` (recherche globale) rendue visible sur desktop dans `Sidebar.tsx` : elle n'était montée que dans le header mobile (`MobileSidebarToggle.tsx`, conteneur `lg:hidden`), invisible au-delà du breakpoint `lg`.
- `[x]` Documentation — `README.md` : description du widget annonces mise à jour (obsolète depuis les ajustements du 2026-07-31/2026-08-03 ci-dessus). `METHODE_DE_TRAVAIL.md` et `.agents/AGENTS.md` : ajout du rôle `EMPLOYE` (créé le 2026-07-27) dans la liste des rôles standards sans accès géolocalisation, qui ne mentionnait encore que `CONSULTANT`/`STAGIAIRE`/`PRESTATAIRE`.
- `[ ]` Non fait (arbitrage explicite avec l'utilisateur) — l'historique des migrations reste structurellement cassé au-delà des 3 points corrigés ci-dessus : `0004_module4_tabs` et `20260630000001_module3_presence` sont deux migrations concurrentes recréant intégralement le même schéma initial (y compris `CREATE TYPE "Role"` en double), committées ensemble dans un unique commit initial. Un `prisma migrate deploy` sur une base neuve échouerait donc avant même d'atteindre la nouvelle migration corrective. Seul un squash/rebase complet de l'historique (option explicitement écartée par l'utilisateur en faveur de migrations correctives additives) résoudrait ce point ; `db push` reste donc requis en attendant.
- `[ ]` Non fait — la migration corrective `20260803120000_fix_schema_integrity` n'a pas été appliquée à la base locale (pas d'accès PostgreSQL dans cet environnement d'exécution ; cf. notes d'environnement). Les parties déjà couvertes par `db push` historique (`createdById`, `isActive` sur `announcements`) provoqueront des erreurs "colonne/contrainte déjà existante" si cette migration est rejouée telle quelle sur la base locale actuelle : à adapter (ou à appliquer sur une base neuve) avant tout `migrate deploy` réel.

### Audit complet & corrections — 2026-08-03

- 3 agents d'audit indépendants (backend/frontend/base de données) + vérification manuelle de chaque finding critique avant correction (plusieurs findings initiaux invalidés ou affinés après lecture du code réel, ex. l'accès `/utilisateurs` pour DAF/RESPONSABLE_BU/RESPONSABLE_POLE était un vrai accès scopé backend, pas une coquille frontend ; la contrainte d'unicité onglets était déjà compensée côté `create()`, le vrai trou était dans `update()`).
- Aucune régression : `npx tsc --noEmit` (api, web, database), `npm run build:api`, `npm run build:web` (après nettoyage `.next`) : OK. `npx prisma validate` : OK. `npm run db:generate` : OK.
- `npm run format` : OK.
- Non appliqué à la base locale : migration corrective (pas d'accès DB dans cet environnement), seed non relancé (aurait nécessité `db:seed` hors sandbox).
- Historique des migrations : problème structurel documenté ci-dessus, non résolu (hors périmètre de l'option choisie par l'utilisateur).

## Intégration Congés — statut EN_CONGE & widget "Employés en congé" — 2026-08-04

Demande : un employé en congé approuvé ne doit plus être marqué "Absent" ; ajouter un widget "Employés en congé" visible par tout le monde. L'app externe VEDEM/CONGE (`/Users/macbookpro/VEDEM/CONGE`, Next.js/Prisma/MongoDB, séparée de ce repo) est la source de vérité des congés. Décisions actées avec l'utilisateur avant implémentation : rapprochement par matricule Congé == login (`username`) Intranet, avec email en repli ; widget sur la page Accueil uniquement (visible par tous les rôles, y compris accueil) ; modification du repo VEDEM/CONGE autorisée.

- `[x]` [NEW] Côté CONGE — [route.ts](file:///Users/macbookpro/VEDEM/CONGE/app/api/leaves/active/route.ts) : nouvel endpoint `GET /api/leaves/active` (jour unique `?date=` ou plage `?from=&to=` pour les rapports), renvoie les congés `APPROVED` chevauchant la fenêtre, protégé par secret partagé `INTRANET_SYNC_SECRET` (header `x-intranet-secret` ou `Authorization: Bearer`), variable ajoutée à `.env.example`/`.env.production.example`.
- `[x]` [NEW] Côté vdm-intranet — module `apps/api/src/leaves/` : [leave-sync.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/leaves/leave-sync.service.ts) (client HTTP + cache 60s, dégradation silencieuse si `CONGE_API_URL`/`CONGE_API_SECRET` absents — jamais de crash), [leave-match.util.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/leaves/leave-match.util.ts) (rapprochement matricule/email + labels FR des types de congé), `leaves.service.ts`/`leaves.controller.ts` (`GET /leaves/on-leave/today`, volontairement sans le type de congé — donnée de santé sensible pour un endpoint visible par tous sans restriction de rôle).
- `[x]` [MODIFY] [presence.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.ts) — `getTodayAllPresences`/`getTodayPresence` renvoient un statut synthétique `EN_CONGE` (jamais persisté en DB, calculé comme `ABSENT` l'était déjà) quand un utilisateur sans présence du jour correspond à un congé actif ; `email` ajouté à `USER_SUMMARY` pour le rapprochement.
- `[x]` [MODIFY] [pilotage.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/pilotage/pilotage.service.ts) — `getSummary`/`getPresenceByBu`/`getPeriodReport` distinguent désormais un compteur `onLeave` d'`absent` (KPI global, répartition par BU, rapport hebdo/mensuel avec appel unique à la plage `from`/`to` puis test jour par jour en mémoire).
- `[x]` [NEW] [EmployeesOnLeaveCard.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/EmployeesOnLeaveCard.tsx) — widget "Employés en congé" ajouté sur `/accueil` (nom, rôle, BU, dates ; sans le type de congé), alimenté par `GET /leaves/on-leave/today`.
- `[x]` [MODIFY] `PresenceTable.tsx`/`PresencesPageClient.tsx` — badge et compteur "En congé" (4e tuile) sur la page Présences ; tooltip du badge avec type/dates pour les rôles qui voient déjà le tableau détaillé.
- `[x]` [MODIFY] `PilotageClient.tsx` — KPI "En congé" et 3e barre dans le graphique Présences par BU.
- `[x]` [MODIFY] `accueil/page.tsx` — carte "Ma journée" affiche `En congé` (au lieu de `Non enregistré`) quand l'utilisateur courant est en congé sans présence du jour.
- `[x]` Validation — `npm run build:api` : OK. `npm run build:web` : OK. Côté CONGE, `npm run typecheck` remonte des erreurs pré-existantes sans rapport avec ce changement (client Prisma généré désynchronisé du schéma sur des fichiers non touchés : `salary-slips`, `leave-requests/[id]/sheet`, etc.) ; le nouveau fichier `app/api/leaves/active/route.ts` ne remonte aucune erreur.
- `[x]` Tests réels — API démarrée en mode dev, base reseedée (`SEED_PASSWORD`/`DATABASE_URL` à exporter explicitement pour ce script, non lus depuis le `.env` racine par le workspace `packages/database`), faux serveur HTTP local simulant `GET /api/leaves/active` : confirmé par `curl` le cas par défaut (intégration non configurée → comportement inchangé, `EN_CONGE` jamais renvoyé) et le cas positif (congé simulé sur un utilisateur sans présence du jour → `status: "EN_CONGE"` sur `/presence/today/all`, `onLeave` peuplé sur `/presence/today`, compteurs `/pilotage/summary`/`/pilotage/presence-by-bu` ajustés, plage `/pilotage/period-report?period=week` correcte sur 2 jours ouvrés). Base et mot de passe du compte de test restaurés après les tests.
- `[ ]` Vérification visuelle navigateur non complétée — l'outil de navigateur (MCP Docker/Playwright) s'est interrompu en cours de session (connexion fermée sur tous les appels suivants) après plusieurs contournements réseau nécessaires (`host.docker.internal`, CORS, cookie `Domain`) ; seule la donnée servie par l'API a été vérifiée (`curl`), pas le rendu final du widget/badges dans un vrai navigateur.
- `[ ]` Non fait — configuration de production : définir `CONGE_API_URL` + `CONGE_API_SECRET` côté vdm-intranet, et `INTRANET_SYNC_SECRET` (même valeur) côté VEDEM/CONGE ; tant que ces variables sont vides, l'intégration reste désactivée sans erreur (comportement actuel par défaut).

### Audit intégration congés — 2026-08-04

- Le statut `EN_CONGE` suit exactement le même principe que `ABSENT` : jamais écrit en base, calculé à la volée à chaque lecture — aucune migration Prisma requise sur `vdm-intranet`.
- Confidentialité : seules les vues déjà scopées par rôle (`/presence/today` pour soi-même, `/presence/today/all` pour les managers via `leaveTypeLabel`) reçoivent le type de congé ; le widget public `GET /leaves/on-leave/today` ne le renvoie jamais, pour ne pas exposer des catégories de santé sensibles (maladie, menstruel, maternité/paternité) à toute l'entreprise.
- Rapprochement d'identité confirmé par l'utilisateur : en déploiement, le `matricule` Congé correspond au `username` (login) Intranet et à l'email — `matchLeaveToUser` teste matricule d'abord, email en repli.
- `npm run build:api` : OK.
- `npm run build:web` : OK.
- Contexte détaillé et contrat d'intégration consignés en mémoire (`reference_conge_app.md`) pour les futures sessions.

//SESSION TERMINEE

## Ajustement — Widget "Employés en congé" déplacé de l'accueil vers un widget flottant global — 2026-08-06

Demande : le widget "Employés en congé" (ajouté le 2026-08-04, sur `/accueil` uniquement) ne doit plus être sur la page accueil. Clarifié avec l'utilisateur (choix explicite parmi plusieurs options proposées) : le transformer en widget flottant global — visible sur toutes les pages protégées, comme Annonces/Horloge/Calendrier/Météo — plutôt qu'une nouvelle page dédiée ou un doublon en plus de la carte existante.

- `[x]` [MODIFY] [accueil/page.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/accueil/page.tsx>) — retrait de la carte `EmployeesOnLeaveCard` et du fetch `/leaves/on-leave/today` associé, devenus inutiles sur cette page
- `[x]` [DELETE] [EmployeesOnLeaveCard.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/EmployeesOnLeaveCard.tsx) — composant inline devenu orphelin, plus aucune référence dans le repo
- `[x]` [MODIFY] [Widgets.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/widgets/Widgets.tsx) — nouveau widget flottant "Congés" (clé `leave`), même conventions que les widgets existants (toggle indépendant dans la barre de bascules, visibilité persistée en `localStorage`, style glassmorphism `CARD`) ; données récupérées côté client via `leavesApi.onLeaveToday()` (existant, non modifié), sans exposer le type de congé ni l'email (restriction déjà en place côté API, cf. session du 2026-08-04)
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK ; `npx prettier --write` puis `--check` sur les fichiers modifiés : OK
- `[ ]` Vérification manuelle navigateur non effectuée — pas de contrôle visuel réel du rendu du nouveau widget flottant (même limite que la session du 2026-08-04)
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`

### Audit ajustement widget congés — 2026-08-06

- Le widget est désormais monté globalement via `Widgets.tsx` (rendu par `LiveAnnouncements`, monté dans les deux branches de `(protected)/layout.tsx`) — visible sur toutes les pages protégées, tous rôles, comme les autres widgets flottants ; la page accueil ne l'affiche plus.
- Aucun changement backend ni base de données : réutilise `GET /leaves/on-leave/today` et `leavesApi.onLeaveToday()` tels quels.
- `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.
- `npm run format` (Prettier) : OK — a reformaté `Widgets.tsx` après l'ajout du widget.
- ESLint non exécutable dans cet environnement (`next lint` demande une configuration interactive absente du repo) — préexistant, sans rapport avec ce changement.

## Horaires variables par jour/semaine/mois — mandats étendus & planning mensuel — 2026-08-06

Demande : pouvoir configurer, pour certains employés, une heure d'arrivée qui varie par jour, semaine ou mois — cas cible : le Pôle TV/Radio (BU INFO), où un même employé peut alterner jour/nuit/week-end sur un même mois. Décisions actées avec l'utilisateur avant implémentation : ouverture aux Responsables BU/Pôle (déjà satisfaite par le scoping existant `canMandateUser`/`buildUserScope`, aucun changement de permission nécessaire) ; calendrier mensuel visuel complet plutôt qu'un simple formulaire enrichi ; introduction de Jest dans `apps/api` (absent du projet jusqu'ici) pour couvrir la logique de résolution d'horaire avant de la livrer, compte tenu de la sensibilité du calcul de retard (franchissement de minuit).

- `[x]` [MODIFY] [schema.prisma](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/packages/database/prisma/schema.prisma) — `DailyMandate` gagne `expectedDepartureTime`/`isNightShift` (colonnes additives, nullables, non destructives).
- `[x]` [NEW] [20260806120000_add_mandate_departure_and_night_shift/migration.sql](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/packages/database/prisma/migrations/20260806120000_add_mandate_departure_and_night_shift/migration.sql) — appliqué en local via `db push` (blocage `prisma migrate dev` P3006 déjà connu et documenté depuis la session du 2026-08-03, historique cassé non touché) ; fichier écrit à la main pour la traçabilité d'un futur déploiement sur base neuve.
- `[x]` [MODIFY] [create-mandate.dto.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/dto/create-mandate.dto.ts) — `expectedDepartureTime`/`isNightShift` optionnels.
- `[x]` [NEW] [bulk-create-mandate.dto.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/dto/bulk-create-mandate.dto.ts) — DTO de création en masse (1 employé, jusqu'à 62 jours), première utilisation de `@ValidateNested`/`@Type` dans le repo.
- `[x]` [MODIFY] [presence.schedule.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.schedule.service.ts) — corrige un gap préexistant (`getDepartureScheduleSource` ignorait les mandats) et propage `isNightShift` du mandat en priorité sur le groupe via `??` (pas `||`, pour qu'un mandat `false` explicite prime sur un groupe de nuit).
- `[x]` [MODIFY] [presence.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.ts) — `createMandate` étendu ; nouvelle `bulkCreateMandates` (upsert transactionnel sur `[userId, date]`, réutilise `canMandateUser`) ; `getMandates` accepte `from`/`to`/`userId`, le filtre `userId` étant composé en `AND` du scope BU/Pôle existant (jamais en remplacement, pour ne pas ouvrir de fuite de périmètre à un responsable).
- `[x]` [MODIFY] [presence.controller.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.controller.ts) — route `POST /presence/mandates/bulk` (même garde `CAN_MANAGE_MANDATES`) ; query params étendus sur `GET /presence/mandates`.
- `[x]` [NEW] Jest introduit dans `apps/api` (absent du projet jusqu'ici) — `jest`/`ts-jest`/`@nestjs/testing` ajoutés, config `jest` dans `package.json`, scripts `test`/`test:watch` (+ `test:api` à la racine).
- `[x]` [NEW] [presence.schedule.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.schedule.service.spec.ts) + [presence.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.spec.ts) — 18 tests : résolution mandat > groupe > individuel (arrivée et départ), franchissement de minuit en équipe de nuit (avec régression volontairement démontrée si `isNightShift` n'est pas propagé), scoping BU/Pôle de `bulkCreateMandates`, non-fuite du filtre `userId` sur `getMandates`.
- `[x]` [MODIFY] [presence.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/presence.ts) — types `DailyMandate` étendus, `bulkCreateMandates`, `mandatesRange`.
- `[x]` [MODIFY] [MandatesManager.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/MandatesManager.tsx) — heure de départ + case "équipe de nuit" dans le formulaire de mandat unitaire ; lien vers le nouveau calendrier mensuel.
- `[x]` [NEW] [PlanningCalendar.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/PlanningCalendar.tsx) — calendrier mensuel par employé : sélection multi-jours (clic, "tous les samedis"/"tous les dimanches", par jour de semaine), modèles cliquables issus des `ScheduleGroup` de la BU/Pôle de l'employé, saisie libre arrivée/départ/nuit, application en masse.
- `[x]` [NEW] [presences/planning/page.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/presences/planning/page.tsx>) — nouvelle route, réservée aux rôles `CAN_MANAGE_MANDATES` (redirection sinon).
- `[x]` Validation — `npm run build:api` : OK. `npm run build:web` : OK (nouvelle route `/presences/planning` listée). `npx jest` (`apps/api`) : 18/18 tests OK. `npx tsc --noEmit -p apps/api/tsconfig.json` : OK.
- `[ ]` Non fait (volontaire) — aucun `ScheduleGroup` "nuit"/"week-end" créé pour le Pôle TV/Radio : les heures réelles n'ont pas été fournies par l'utilisateur et n'ont pas été inventées. À créer via `/parametres` (CTO_ADMIN) pour que ces modèles apparaissent comme raccourcis cliquables dans le calendrier.
- `[ ]` Vérification visuelle navigateur non effectuée — même limite que les sessions précédentes (pas d'outil navigateur disponible dans cet environnement) ; seuls les builds, le typecheck et les tests unitaires ont validé le rendu/la logique.
- Note migration — le blocage `prisma migrate dev`/`deploy` (P3006, historique `0004_module4_tabs`/`20260630000001_module3_presence` cassé) a été retrouvé à l'identique lors de cette session ; contourné par `db push` + migration écrite à la main, conformément au choix déjà tranché par l'utilisateur le 2026-08-03 (pas de squash/rebase d'historique).

## Onglet "Emploi du temps" & règle CTO ne gère pas le PDG — 2026-08-06

Demande : ajouter un onglet de navigation dédié pour gérer l'emploi du temps de tout le monde, visible par le PDG et le CTO_ADMIN. Règle explicite de l'utilisateur : le CTO_ADMIN ne peut pas gérer l'emploi du temps du PDG, alors que le PDG peut gérer celui de tout le monde (y compris le CTO_ADMIN) ; les Responsables BU gèrent leur BU, les Responsables de département (= `Pôle` dans ce repo — mapping retenu en l'absence d'un modèle "département" distinct) gèrent leur périmètre. Le reste de la hiérarchie (PDG global, RESPONSABLE_BU scopé BU, RESPONSABLE_POLE scopé Pôle) était déjà satisfait par `canMandateUser`/`buildUserScope` (session du 2026-08-06 précédente) — seule la restriction CTO→PDG était réellement nouvelle.

- `[x]` [MODIFY] [presence.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.ts) — `canMandateUser` refuse désormais absolument un `CTO_ADMIN` ciblant un `PDG` (vérifié avant toute autre règle, y compris le repli `createdById` de `deleteMandate`, pour ne jamais être contournable) ; `createMandate`/`bulkCreateMandates` sélectionnent désormais `role` sur l'utilisateur cible pour permettre ce contrôle.
- `[x]` [NEW] Tests — [presence.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.spec.ts) : 5 tests ajoutés (CTO refusé sur `createMandate`/`bulkCreateMandates`/`deleteMandate` ciblant le PDG même en tant que créateur du mandat ; PDG explicitement autorisé sur le CTO_ADMIN dans les deux sens, pour prouver l'absence de régression sur l'accès global du PDG).
- `[x]` [MODIFY] [Sidebar.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/sidebar/Sidebar.tsx) — nouvel item "Emploi du temps" (`/presences/planning`) ajouté aux blocs `CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU` ("Emploi du temps BU"), `RESPONSABLE_POLE` ("Emploi du temps Pôle"). `DAF` inclus par cohérence avec son périmètre BU déjà existant côté backend (`CAN_MANAGE_MANDATES`), bien que non explicitement nommé dans la demande — à corriger si ce n'était pas voulu.
- `[x]` [MODIFY] [PresenceTable.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/PresenceTable.tsx) — le bouton "Mandater" par ligne est masqué pour la ligne du PDG quand le rôle courant est `CTO_ADMIN` (nouvelle prop `currentUserRole`), pour éviter un aller-retour en erreur 403.
- `[x]` [MODIFY] [MandatesManager.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/MandatesManager.tsx) — même traitement : le PDG est retiré du sélecteur "Employé" du formulaire de mandat unitaire, et le bouton "Supprimer" est masqué sur les mandats du PDG, pour un `CTO_ADMIN`.
- `[x]` [MODIFY] [PresencesPageClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/PresencesPageClient.tsx) / [presences/page.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/presences/page.tsx>) — propagation de `currentUserRole` jusqu'aux deux composants ci-dessus.
- `[x]` [MODIFY] [presences/planning/page.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/presences/planning/page.tsx>) — le PDG est retiré côté serveur de la liste d'employés sélectionnables dans le calendrier mensuel quand le rôle courant est `CTO_ADMIN`.
- `[x]` Validation — `npx tsc --noEmit -p apps/api/tsconfig.json` : OK. `npx tsc --noEmit -p apps/web/tsconfig.json` : OK. `npm run build:api` : OK. `npm run build:web` : OK. `npx jest` (`apps/api`) : 23/23 tests OK. `npx prettier --write` sur tous les fichiers modifiés : OK.
- Choix d'interprétation à valider avec l'utilisateur — la restriction porte uniquement sur la **gestion** (création/modification/suppression de mandat) ; la **lecture** reste globale pour le CTO_ADMIN (visibilité du planning du PDG dans les tableaux/listes, boutons d'action masqués mais lignes toujours visibles). Aucune restriction de lecture n'a été demandée explicitement.
- `[ ]` Non fait (volontaire, hors périmètre de cette demande) — aucun `ScheduleGroup` "nuit"/"week-end" créé pour le Pôle TV/Radio (cf. session précédente du même jour) : toujours en attente des heures réelles à fournir par l'utilisateur.

## Correctif lien actif Sidebar & filtre BU sur les sélecteurs employé — 2026-08-06

Demande : corriger le lien actif de la Sidebar (« Présences » et « Emploi du temps » s'allumaient tous les deux en même temps sur `/presences/planning`) et ajouter un filtre par BU pour sélectionner l'employé plus facilement dans les écrans de gestion de l'emploi du temps.

- `[x]` [MODIFY] [Sidebar.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/sidebar/Sidebar.tsx) — la détection d'item actif ne se fait plus indépendamment par item (`pathname.startsWith(hrefPath + '/')` faisait matcher `/presences` en préfixe de `/presences/planning`) : un seul item est désormais actif à la fois, celui dont le `href` correspond le plus précisément au chemin courant (préfixe le plus long parmi les items du rôle). Généralise correctement à toute future route imbriquée sous un item existant.
- `[x]` [MODIFY] [PlanningCalendar.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/PlanningCalendar.tsx) — nouveau sélecteur « Filtrer par BU » (affiché seulement si plus d'une BU présente dans le périmètre), qui restreint la liste du sélecteur « Employé » ; réinitialise l'employé sélectionné s'il sort du filtre choisi.
- `[x]` [MODIFY] [MandatesManager.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/MandatesManager.tsx) — même filtre « Filtrer par BU » ajouté dans le formulaire « Nouveau mandat », pour cohérence (même problème de liste longue à parcourir) ; réinitialisé à l'ouverture du formulaire.
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK. `npm run build:web` : OK. `npx prettier --write` sur les 3 fichiers modifiés : OK.
- Note — le filtre BU utilise l'`id` de la BU dans `PlanningCalendar` (disponible sur `PresenceRow['user']`) et le `name` dans `MandatesManager` (seul champ disponible sur son `UserOption` plus restreint) ; `BusinessUnit.name` étant `@unique` en base, les deux approches sont équivalentes en pratique.

//SESSION TERMINEE

## Correctif — Absence marquée trop tôt / hors jour de travail — 2026-08-06

Demande : un employé ne doit pas être marqué "Absent" tant que son heure d'arrivée attendue n'est pas encore dépassée, ni si ce n'est pas son jour de travail (week-end/férié sans mandat, ou aucun planning défini).

- `[x]` Audit — `getTodayAllPresences`/`getTodayPresence` (`presence.service.ts`) et `getSummary`/`getPresenceByBu` (`pilotage.service.ts`) déduisaient tous "Absent" par défaut dès qu'aucune `Presence` n'existait pour le jour, sans tenir compte de l'heure ni du jour de travail — bug confirmé par le contournement déjà en place côté frontend (`PresencesPageClient.tsx` affichait une bannière "les absences affichées sont normales" les week-ends, au lieu de corriger la donnée).
- `[x]` [MODIFY] [presence.schedule.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.schedule.service.ts) — nouvelle méthode `isArrivalOverdue(expectedTime, now, isNightShift)` : vrai uniquement si l'heure attendue + tolérance (`PRESENCE_LATE_TOLERANCE_MINUTES`) est dépassée.
- `[x]` [MODIFY] [presence.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.ts) — injection de `PublicHolidaysService` ; nouveaux statuts calculés (jamais persistés, même principe que `EN_CONGE`) : `REPOS` (pas le jour de travail — week-end/férié sans mandat, ou aucun planning défini ; un mandat explicite prime toujours sur le week-end/férié par défaut) et `EN_ATTENTE` (jour de travail, heure attendue pas encore dépassée). `getTodayAllPresences` gère aussi la navigation par date passée/future (`/presences?date=...`) : une date passée sans présence reste directement `ABSENT` (jour terminé), une date future ne peut jamais être `ABSENT` (`EN_ATTENTE`).
- `[x]` [MODIFY] [presence.module.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.module.ts) — exporte désormais aussi `PresenceScheduleService` (réutilisé par `PilotageService`) ; importe `PublicHolidaysModule`.
- `[x]` [MODIFY] [pilotage.module.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/pilotage/pilotage.module.ts) / [pilotage.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/pilotage/pilotage.service.ts) — `getSummary`/`getPresenceByBu` appliquent la même règle pour les KPI "aujourd'hui" (nouveaux compteurs `dayOff`/`pending`, `absent` corrigé pour ne plus les inclure).
- `[x]` [NEW] Tests — [presence.schedule.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.schedule.service.spec.ts) (`isArrivalOverdue`, franchissement de minuit équipe de nuit) et [presence.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.spec.ts) (`REPOS`/`EN_ATTENTE`/`ABSENT` sur `getTodayAllPresences`/`getTodayPresence`, mandat explicite un jour de week-end, dates passées/futures) — 10 tests ajoutés, horloge système simulée via `jest.useFakeTimers()`.
- `[x]` [MODIFY] [presence.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/presence.ts) / [pilotage.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/pilotage.ts) — types étendus (`PresenceStatus` avec `REPOS`/`EN_ATTENTE`, `Summary`/`PresenceByBu` avec `dayOff`/`pending`, `TodayPresenceResult.status`).
- `[x]` [MODIFY] [accueil/page.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/accueil/page.tsx>) / [PresenceTable.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/PresenceTable.tsx) — badges/libellés "Repos" et "En attente" ; l'accueil utilise désormais le statut calculé par l'API au lieu de retomber sur `ABSENT` par défaut côté client.
- `[x]` [MODIFY] [PresencesPageClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/PresencesPageClient.tsx) — compteurs "En attente"/"Repos" ajoutés ; bannière week-end reformulée (n'affirme plus que "les absences sont normales", ce qui n'est plus toujours vrai avec un mandat explicite).
- `[x]` [MODIFY] [PilotageClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/pilotage/PilotageClient.tsx) — nouvelle tuile KPI "Repos / en attente" sur le tableau de bord.
- `[x]` Validation — `npm run format` OK. `npx tsc --noEmit -p apps/api/tsconfig.json` OK. `npx tsc --noEmit -p apps/web/tsconfig.json` OK. `npx jest` (`apps/api`) : 45/45 OK. `npm run build:api` OK. `rm -rf apps/web/.next` puis `npm run build:web` OK. `git diff --check` OK.
- `[ ]` Non fait (hors périmètre de cette demande) — `getPeriodReport` (rapport hebdo/mensuel de `/pilotage`) garde son propre modèle d'exclusion des week-ends (déjà en place) et n'a pas été aligné sur la nouvelle notion de mandat-sur-jour-non-travaillé ; à traiter séparément si un besoin de reporting rétrospectif précis sur les rotations week-end émerge.
- `[ ]` Vérification visuelle navigateur non effectuée — même limite que les sessions précédentes (pas d'outil navigateur disponible dans cet environnement) ; seuls les builds, le typecheck et les tests unitaires ont validé le rendu/la logique.

### Audit correctif absence — 2026-08-06

- Bug confirmé dans 4 méthodes distinctes (2 dans `presence.service.ts`, 2 dans `pilotage.service.ts`), toutes suivant le même anti-pattern « aucune Presence enregistrée aujourd'hui ⇒ ABSENT », sans jamais vérifier l'heure ni le jour de travail.
- Le contournement frontend préexistant (bannière week-end dans `PresencesPageClient.tsx`) a été retiré au profit d'une donnée correcte à la source ; un mandat explicite un jour de week-end/férié reste suivi normalement (peut être réellement `ABSENT`/`LATE`).
- `PresenceScheduleService.isArrivalOverdue` réutilise le même calcul de délai (`calculateDelayMinutes`, avec gestion du franchissement de minuit pour les équipes de nuit) que `calculatePresenceStatus`, pour ne jamais faire diverger la définition du retard entre "déjà arrivé" et "pas encore arrivé".
- `PresenceScheduleService` est désormais partagée entre `PresenceModule` et `PilotageModule` (export ajouté) plutôt que dupliquée, pour garantir que la tolérance de retard (`PRESENCE_LATE_TOLERANCE_MINUTES`) ne puisse jamais diverger entre les deux modules.
- `npm run format` : OK.
- `npx tsc --noEmit -p apps/api/tsconfig.json` : OK.
- `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.
- `npx jest` (`apps/api`) : 45/45 tests OK (35 préexistants + 10 nouveaux).
- `npm run build:api` : OK.
- `npm run build:web` : OK (cache `.next` nettoyé avant build).
- `git diff --check` : OK.

## Jours de travail récurrents par employé, à la création — 2026-08-06

Demande : pouvoir marquer, à la création d'un employé (et modifiable ensuite), ses jours de travail récurrents — par défaut Lundi-Vendredi — pour ne plus avoir à reconfigurer le planning chaque semaine/mois. Décision actée avec l'utilisateur (question posée explicitement en cours de tâche) : un jour hors motif récurrent, sans mandat explicite ce jour-là, ne doit plus jamais être compté "Absent" nulle part dans l'app — branché dans le mécanisme `REPOS`/`EN_ATTENTE` du correctif précédent du même jour plutôt que réinventé.

- `[x]` Point de méthode — `presence.service.ts`/`presence.schedule.service.ts`/`pilotage.service.ts` étaient édités en direct par l'utilisateur dans son IDE pendant cette conversation (confirmé après question explicite) : implémentation séquencée en deux phases (réglage employé d'abord, câblage dans le calcul d'absence ensuite, après confirmation de sauvegarde), 3 fichiers relus intégralement juste avant modification.
- `[x]` [MODIFY] [schema.prisma](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/packages/database/prisma/schema.prisma) — `User.workingDays Int[] @default([1,2,3,4,5])` (convention `Date.getUTCDay()`, 0=Dimanche…6=Samedi) ; tableau vide valide (planning entièrement défini par mandats).
- `[x]` [NEW] Migration [20260806140000_add_user_working_days](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/packages/database/prisma/migrations/20260806140000_add_user_working_days/migration.sql) — écrite à la main (même contournement P3006 que les migrations précédentes), appliquée via `db push`.
- `[x]` [NEW] [working-days.util.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/common/working-days.util.ts) — `isRecurringWorkDay`/`DEFAULT_WORKING_DAYS`, remplace la fonction locale `isWeekendDate` dupliquée dans `presence.service.ts` et `pilotage.service.ts`.
- `[x]` [MODIFY] [presence.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.ts) — `workingDays` ajouté à `USER_SUMMARY` et au lookup de `getTodayPresence` ; `isNonWorkingDay`/`isNonWorkingDefault` calculés par employé (auparavant globaux avant la boucle) dans `getTodayPresence`/`getTodayAllPresences`.
- `[x]` [MODIFY] [pilotage.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/pilotage/pilotage.service.ts) — même traitement par employé dans `getSummary`/`getPresenceByBu`. `getPeriodReport` conservé volontairement sur le motif par défaut global (`isRecurringWorkDay(undefined, d)`, strictement équivalent à l'ancien comportement) — restructurer sa boucle jour→utilisateurs pour un calcul pleinement per-employé est laissé hors périmètre.
- `[x]` [MODIFY] [create-user.dto.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/users/dto/create-user.dto.ts) / [update-user.dto.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/users/dto/update-user.dto.ts) — champ `workingDays?: number[]` (`IsInt`/`Min(0)`/`Max(6)` par élément, `ArrayMaxSize(7)`, pas de taille minimale : tableau vide valide).
- `[x]` [MODIFY] [users.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/users/users.service.ts) — `workingDays` ajouté à `SAFE_SELECT` ; normalisation (dédupliqué + trié) à la création/modification si le champ est fourni.
- `[x]` [MODIFY] [UsersManager.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/users/UsersManager.tsx) — nouvelle section "📅 Jours de travail récurrents" (7 boutons Lun-Dim), Lun-Ven cochés par défaut à la création, préremplis depuis le compte à l'édition.
- `[x]` [MODIFY] [PlanningCalendar.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/PlanningCalendar.tsx) / [presence.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/presence.ts) — le calendrier grise désormais les jours hors motif réel de l'employé sélectionné (au lieu d'un week-end fixe `weekdayIdx >= 5`).
- `[x]` [NEW] Tests — [working-days.util.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/common/working-days.util.spec.ts) + extension de [presence.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.spec.ts) (motif Mardi-Samedi, tableau vide → défaut, widget individuel) — 8 tests ajoutés, 43/43 au total.
- `[x]` Validation — `npx prisma validate` OK, `npm run db:generate` OK, `npx prisma db push` OK, `npx tsc --noEmit` (api + web) OK, `npx jest` (`apps/api`) 43/43 OK, `npm run build:api` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK, `npm run format` OK, `git diff --check` OK.
- `[ ]` Non fait — vérification visuelle réelle dans un navigateur (pas d'outil navigateur disponible dans cet environnement).
- `[ ]` Hors périmètre, assumé — `getPeriodReport` non aligné sur le motif per-employé (cf. ci-dessus).

### Audit jours de travail récurrents — 2026-08-06

- Le motif `workingDays` par défaut (Lundi-Vendredi) reproduit exactement l'ancien comportement global `isWeekendDate` pour tout employé non reconfiguré — aucune régression attendue sur les comptes existants.
- Un mandat explicite continue de primer sur le motif récurrent dans les deux sens (fait travailler un jour normalement off, ou inversement), comportement inchangé du correctif précédent.
- `npm run format` : OK.
- `npx tsc --noEmit -p apps/api/tsconfig.json` : OK.
- `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.
- `npx jest` (`apps/api`) : 43/43 tests OK (35 préexistants + 8 nouveaux).
- `npm run build:api` : OK.
- `npm run build:web` : OK (cache `.next` nettoyé avant build).
- `git diff --check` : OK.

//SESSION TERMINEE

## Ajustement — Retrait de la barre de recherche globale dans la Sidebar — 2026-08-06

Demande : retirer complètement la barre de recherche de la Sidebar.

- `[x]` [MODIFY] [Sidebar.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/sidebar/Sidebar.tsx) — suppression du bloc `<GlobalSearch dark />` (section "Recherche globale (desktop)") et de son import ; aucune autre modification.
- `[x]` Validation — `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`.

### Audit retrait barre de recherche Sidebar — 2026-08-06

- Le composant `GlobalSearch` et le module backend `search` ne sont pas touchés : `GlobalSearch` reste monté dans `MobileSidebarToggle.tsx` (header mobile), seule l'occurrence desktop de la Sidebar est supprimée.
- Changement purement suppressif sans impact fonctionnel côté API.
- `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.

//SESSION TERMINEE

## Ajustement — Interdiction de l'auto-mandat pour les responsables — 2026-08-06

Demande : les responsables ne doivent pas pouvoir définir eux-mêmes leur propre emploi du temps, à l'exception du PDG.

- `[x]` [MODIFY] [presence.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.ts) — `canMandateUser` refuse désormais toute auto-cible (`requester.id === target.id`) pour tout rôle autre que `PDG`, vérifiée avant les règles de portée BU/Pôle existantes (donc avant `CAN_VIEW_PRESENCE_GLOBAL`/`CAN_VIEW_PRESENCE_BU_SCOPE`/`RESPONSABLE_POLE`) — s'applique à `CTO_ADMIN`, `DAF`, `RESPONSABLE_BU`, `RESPONSABLE_POLE`. Signature étendue avec `target.id`. `deleteMandate` ferme le repli `createdById` pour ce cas, sur le même principe que la règle CTO_ADMIN/PDG déjà en place.
- `[x]` [MODIFY] [presences/planning/page.tsx](<file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/app/(protected)/presences/planning/page.tsx>) — l'utilisateur courant est retiré de la liste des employés sélectionnables dans le calendrier mensuel, sauf s'il est PDG (règle fusionnée avec le filtre CTO_ADMIN→PDG déjà en place).
- `[x]` [MODIFY] [MandatesManager.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/presence/MandatesManager.tsx) — même filtre sur le sélecteur du formulaire "Nouveau mandat" ; bouton "Supprimer" masqué sur les mandats de l'utilisateur courant, sauf PDG.
- `[x]` [NEW] Tests — [presence.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/presence/presence.service.spec.ts) : 5 tests ajoutés (`createMandate`/`bulkCreateMandates`/`deleteMandate` refusés pour un responsable ciblant lui-même, même en tant que créateur du mandat ; PDG explicitement autorisé à se mandater/se supprimer lui-même).
- `[x]` Validation — `npx tsc --noEmit -p apps/api/tsconfig.json` : OK. `npx tsc --noEmit -p apps/web/tsconfig.json` : OK. `npx jest` (`apps/api`) : 48/48 tests OK (43 préexistants + 5 nouveaux).
- `[x]` Documentation — mise à jour de `TACHE.md`/`SESSION_HANDOFF.md`.

### Audit interdiction auto-mandat — 2026-08-06

- Le repli `createdById` de `deleteMandate` aurait pu contourner la nouvelle règle pour un mandat auto-créé avant son introduction (ex. un `RESPONSABLE_BU` s'étant déjà mandaté lui-même) — fermé explicitement en tête de fonction, même schéma que la règle CTO_ADMIN/PDG existante.
- Aucune régression sur les règles de portée existantes : un responsable garde intégralement ses droits de mandat sur les employés de son périmètre, seule l'auto-cible est désormais refusée.
- `npx tsc --noEmit -p apps/api/tsconfig.json` : OK.
- `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.
- `npx jest` (`apps/api`) : 48/48 tests OK (43 préexistants + 5 nouveaux).

## Correctif — Pilotage & Rapports non adaptés au motif de travail propre à chaque utilisateur — 2026-08-06

Demande : corriger Pilotage et Rapports pour qu'ils s'adaptent au motif de travail (`workingDays`), aux mandats et aux congés propres à chaque utilisateur, au lieu d'un motif global Lundi-Vendredi appliqué à tout le monde — dette explicitement documentée comme "hors périmètre" lors du correctif "Absence marquée trop tôt / hors jour de travail" du même jour.

- `[x]` [MODIFY] [pilotage.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/pilotage/pilotage.service.ts) — `getPeriodReport` (rapport hebdo/mensuel par BU de `/pilotage`) : la liste unique de "jours ouvrés" (Lun-Ven global) est remplacée par un calcul jour × utilisateur — motif `workingDays` propre à chaque employé, jour férié, et mandat explicite (toujours prioritaire, y compris hors motif/jour férié). Un jour hors périmètre de l'utilisateur (repos) n'est plus compté ni dans son total ni en "absent". Le champ `workingDays` par BU redevient un décompte de jours distincts effectivement travaillés par au moins un utilisateur de cette BU (son ancienne sémantique globale n'avait plus de sens per-utilisateur).
- `[x]` [MODIFY] [public-holidays.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/public-holidays/public-holidays.service.ts) — nouvelle méthode `getHolidaysInRange(from, to)` (un seul aller-retour DB, `Map` indexée par date ISO), pour éviter un appel `isHoliday` par jour dans la boucle de `getPeriodReport`.
- `[x]` [MODIFY] [reports.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.service.ts) — `getGeneralData`/`generalCsv` ("Rapport général") : le fallback naïf `pres ? statut : 'Absent'` (ignorait motif de travail, mandat, congé, heure attendue) est remplacé par le même calcul de statut que `/pilotage::getSummary` (présence enregistrée > congé actif > mandat/motif de travail > heure attendue dépassée), avec les mêmes libellés `REPOS`/`EN_ATTENTE`/`EN_CONGE` que `/presences`. Nouvelles dépendances injectées : `PresenceScheduleService`, `PublicHolidaysService`, `LeaveSyncService`.
- `[x]` [MODIFY] [reports-pdf.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports-pdf.service.ts) — `generalHtml` (PDF "Rapport général") consomme désormais le même statut pré-calculé que le CSV, au lieu de dupliquer son propre fallback `'Absent'`.
- `[x]` [MODIFY] [reports.module.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.module.ts) — imports `PresenceModule`/`PublicHolidaysModule`/`LeavesModule` ajoutés, même principe que `PilotageModule`.
- `[x]` Validation — `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `npx jest` (`apps/api`) 48/48 OK (aucun test existant cassé), `npm run build:api` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK, `npx prettier --check` sur les 5 fichiers modifiés OK.
- `[x]` Documentation — `TACHE.md`/`SESSION_HANDOFF.md` mis à jour.

### Audit Pilotage & Rapports par utilisateur — 2026-08-06

- Aucun changement de contrat API : les types `PeriodReport`/`PeriodReportBu` (frontend, `lib/pilotage.ts`) et les colonnes CSV/PDF du rapport général restent identiques — seul le calcul sous-jacent change.
- Aucune régression sur les permissions : `assertAllowed`/`buildUserWhere` de `pilotage.service.ts` et `reports.service.ts` non modifiés (DAF toujours limitée au rapport présence, scoping BU/Pôle inchangé).
- Non fait (hors périmètre explicite de cette demande) : le rapport de période (`getPeriodReport`) ne recalcule pas la logique "pas encore arrivé ≠ absent" pour le jour courant s'il est inclus dans la plage (`effectiveEnd === today`) — un jour non terminé peut donc encore afficher "absent" prématurément dans le rapport hebdo/mensuel en cours, limitation préexistante non liée à l'adaptation par utilisateur demandée ici, à traiter séparément si besoin.
- Pas de migration Prisma ni de changement de schéma requis (tous les champs utilisés — `workingDays`, `scheduleGroupId`, `individualExpectedArrivalTime` — existaient déjà).

## Nouvelle fonctionnalité — Synthèse par personne (absences, retards, minutes) dans le rapport de présences — 2026-08-06

Demande : le rapport doit contenir le nombre total d'absences par personne, le nombre de jours de retard et le nombre de minutes de retard par personne. Décision actée avec l'utilisateur (question posée explicitement) : ajouter cette synthèse par personne **en plus** du détail jour par jour déjà présent dans le "Rapport de présences" (CSV et PDF), sans le remplacer ni créer un rapport séparé.

- `[x]` [NEW] [reports.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.service.ts) — nouvelle méthode `getPresenceSummaryRows(requester, dateFrom?, dateTo?)` : calcule par personne, sur la période, `absences`, `lateDays` et `lateMinutesTotal`. L'absence n'étant jamais persistée en DB (seuls `PRESENT`/`LATE` le sont), elle est recalculée jour par jour avec exactement la même règle que `getSummary`/`getPeriodReport` (motif `workingDays` propre à l'utilisateur, mandat explicite toujours prioritaire même hors motif/férié, jour férié, congé actif exclu du décompte) — y compris la règle "pas encore arrivé ≠ absent" pour le jour courant (`PresenceScheduleService.isArrivalOverdue`), un jour strictement passé étant lui directement compté absent sans vérification d'heure. `lateDays`/`lateMinutesTotal` proviennent uniquement des `Presence` réellement enregistrées en `LATE` sur la période.
- `[x]` [MODIFY] [reports.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.service.ts) — `presenceCsv` ajoute désormais un premier tableau "Utilisateur / Nom complet / Rôle / BU / Pôle / Absences / Jours de retard / Minutes de retard (total)" avant le détail journalier existant (même pattern de concaténation multi-tableaux que `generalCsv`).
- `[x]` [MODIFY] [reports-pdf.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports-pdf.service.ts) — `presencePdf`/`presenceHtml` ajoutent la même synthèse par personne en tête du PDF "Rapport de présences", avant le tableau détaillé jour par jour.
- `[x]` [NEW] Tests — [reports.service.spec.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.service.spec.ts) (nouveau fichier, premier test du module `reports`) : 10 tests couvrant retard/minutes cumulées depuis une présence enregistrée, exclusion "repos" (hors motif, sans mandat), mandat explicite qui rend un jour hors motif comptable, exclusion congé, exclusion jour férié, "pas encore arrivé" du jour courant (avant/après heure attendue), et jour strictement passé directement absent.
- `[x]` Validation — `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `npx jest` (`apps/api`) 58/58 OK (48 préexistants + 10 nouveaux), `npm run build:api` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK, `npx prettier --check` OK, `git diff --check` OK.
- `[x]` Documentation — `TACHE.md`/`SESSION_HANDOFF.md` mis à jour.

### Audit synthèse par personne — 2026-08-06

- Aucun changement de contrat pour les autres rapports (Activité, Connexions, Général) ni pour `/pilotage` — seul le "Rapport de présences" (CSV + PDF) est enrichi.
- Aucune régression de permissions : `getPresenceSummaryRows` réutilise `assertAllowed(requester, 'presence')`/`buildUserWhere(requester, 'presence')`, identiques à `getPresenceRows` (DAF conserve l'accès complet au périmètre personnel, limité au rapport présence).
- Non fait (hors périmètre) : pas de tri/filtre dédié sur le tableau de synthèse (ex. trier par nombre d'absences décroissant) — les lignes suivent le même ordre que la liste utilisateurs (`role` puis `lastName`), non demandé explicitement.

## Rapports : export Excel natif, refonte visuelle PDF & période sur le Rapport général — 2026-08-06

Demande : améliorer la mise en page des fichiers exportés et du rapport PDF, et pouvoir choisir une période d'exportation. Décisions actées avec l'utilisateur (question posée explicitement, 3 choix) : ajouter la période au "Rapport général" (jusqu'ici figé sur "aujourd'hui") plutôt que le laisser en instantané ; refonte visuelle complète des PDF (pas de simple ajustement) ; passage des CSV en Excel natif `.xlsx` (pas un CSV amélioré).

- `[x]` [MODIFY] [reports.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.service.ts) — extraction du calcul d'assiduité de `getPresenceSummaryRows` dans une méthode privée partagée `computeAttendanceSummaries(users, userWhere, start, end)` ; `getGeneralData` accepte désormais `dateFrom`/`dateTo` (défaut : aujourd'hui, comportement inchangé si absents) et renvoie en plus `absences`/`lateDays`/`lateMinutesTotal` par utilisateur sur la période choisie ; `connectionsCount` (comptées sur la période) remplace `connectionsToday` (comptées sur le seul jour courant). Nouvelle méthode publique `periodLabel(dateFrom?, dateTo?, fallbackNote?)` (libellé de période pour l'en-tête des exports), réutilisée par les deux services d'export. Les méthodes de construction CSV (`toCsv`, `presenceCsv`/`activityCsv`/`connectionsCsv`/`generalCsv`) sont retirées d'ici et reconstruites dans `reports-excel.service.ts`, même principe que `ReportsPdfService` qui ne construisait déjà que sa propre sortie.
- `[x]` [NEW] [reports-excel.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports-excel.service.ts) — génère de vrais classeurs `.xlsx` (dépendance `exceljs`) pour les 4 rapports : bandeau de marque (logo, titre, période), en-tête de tableau coloré, volet gelé + filtre automatique sous l'en-tête, lignes zébrées, alignement numérique à droite, note de pied de page.
- `[x]` [MODIFY] [reports-pdf.service.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports-pdf.service.ts) — refonte complète du gabarit commun (`renderShell`) : bandeau logo + titre + période, cartes de statistiques clés par rapport (ex. absences cumulées, connexions sur la période), tableaux avec en-tête répété à chaque page (`page-break-inside: avoid`), pied de page avec numérotation et mention "usage interne". `generalPdf` accepte désormais `dateFrom`/`dateTo`.
- `[x]` [NEW] [assets/logo.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/assets/logo.ts) — logo `logo_entreprise.png` redimensionné (420px de large) et encodé en base64, intégré directement au bundle TypeScript (évite de dépendre d'un fichier statique copié au build, `nest build` ne copiant pas les assets non-TS par défaut).
- `[x]` [MODIFY] [reports.controller.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.controller.ts) — les 4 routes CSV (`/reports/presence`, `/activity`, `/connections`, `/general`) renvoient désormais un `.xlsx` (`Content-Type` `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) ; `/reports/general` et `/reports/general/pdf` acceptent maintenant `from`/`to`, comme les 3 autres rapports.
- `[x]` [MODIFY] [reports.module.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/api/src/reports/reports.module.ts) — nouveau provider `ReportsExcelService`.
- `[x]` [MODIFY] [PilotageClient.tsx](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/components/pilotage/PilotageClient.tsx) — le "Rapport général" a désormais un sélecteur de dates (`hasDateRange: true`, comme les 3 autres rapports, défaut mois en cours) ; boutons renommés "Excel" ; noms de fichiers en `.xlsx`.
- `[x]` [NEW] [lib/excel-export.ts](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/apps/web/src/lib/excel-export.ts) — remplace `lib/csv-export.ts` (supprimé) ; `downloadExcelBlob` au lieu de `downloadCsvBlob`.
- `[x]` [MODIFY] [package.json](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/package.json) racine — `overrides` ajouté (`"@types/node": "^22.0.0"`) après un conflit de types `Buffer` détecté au type-check : `@fast-csv/format`/`@fast-csv/parse` (dépendances transitives d'`exceljs`) embarquaient chacune leur propre `@types/node@14` imbriqué, en conflit avec le `@types/node@22` du monorepo. `node_modules`/`package-lock.json` régénérés entièrement pour dédupliquer.
- `[x]` Validation — `npx jest` (`apps/api`) 58/58 OK (aucune régression, dont les 10 tests de `getPresenceSummaryRows` inchangés). `npm run type-check --workspace=apps/api` OK. `npm run build:api` OK. `npm run type-check --workspace=apps/web` OK. `npm run build:web` OK.
- `[x]` Documentation — `TACHE.md`/`SESSION_HANDOFF.md` mis à jour.
- `[ ]` Non fait — vérification visuelle réelle du rendu Excel/PDF dans un tableur/lecteur PDF (pas d'outil de rendu visuel disponible dans cet environnement) ; seule la génération sans erreur et la structure du contenu ont été vérifiées.

### Audit rapports Excel/PDF & période — 2026-08-06

- Aucun changement de permissions : `assertAllowed`/`buildUserWhere` non touchés, la restriction DAF (rapport présence uniquement) s'applique identiquement aux nouvelles routes Excel.
- Le cast `LOGO_BUFFER as any` dans `reports-excel.service.ts::buildSheet` (paramètre `buffer` de `workbook.addImage`) est un contournement de typage isolé (incompatibilité entre TypeScript 5.5 et le `Buffer` générique de `@types/node` 22 dans les `.d.ts` d'`exceljs`), sans impact runtime — un vrai `Buffer` est passé dans tous les cas.
- Le champ `connectionsToday` du rapport général est renommé `connectionsCount` (compte désormais les connexions sur la période choisie, pas uniquement le jour courant) — aucun autre consommateur dans le repo (vérifié par recherche globale).
- `npx jest` (`apps/api`) : 58/58 tests OK.
- `npm run type-check --workspace=apps/api` : OK.
- `npm run build:api` : OK.
- `npm run type-check --workspace=apps/web` : OK.
- `npm run build:web` : OK.

## Fix — Blocage bloquant à la première connexion (géolocalisation vs changement de mot de passe obligatoire) — 2026-08-20

Demande : un utilisateur en première connexion (ou après réinitialisation de mot de passe par un admin) reste bloqué au lieu de pouvoir se connecter.

- `[x]` Reproduit la cause : tout compte avec `mustChangePassword = true` et aucune présence enregistrée aujourd'hui déclenche `requiresFirstLoginGeolocation = true` (`auth.service.ts::login`). `LoginClient.tsx::handleSubmit` donne priorité à la géolocalisation (choix acté le 2026-07-29, cf. section ci-dessus « Mon historique » vide) et appelle `POST /presence/first-login` **avant** de laisser passer le changement de mot de passe.
- `[x]` Identifié que `POST /presence/first-login` n'a jamais été ajouté à la liste blanche `PASSWORD_CHANGE_ALLOWED_ROUTES` de [jwt-auth.guard.ts](file:///c:/Users/ACCES%20LIBRE/VEDEM/Intranet/vdm-intranet/apps/api/src/common/guards/jwt-auth.guard.ts) (ajoutée le 2026-07-26, avant le correctif du 2026-07-29) : le garde renvoie donc `403 Forbidden` sur cet appel tant que `mustChangePassword` est vrai. `GeoLocationScreen.tsx` affiche alors l'erreur serveur sans échappatoire (seulement « Réessayer » ou « Se déconnecter »), et comme la présence du jour n'est jamais créée, le blocage persiste à chaque tentative de reconnexion, pas seulement le jour même — régression jamais refermée depuis le 2026-07-29 (case « Vérification manuelle » restée non cochée dans la section correspondante).
- `[x]` [MODIFY] [jwt-auth.guard.ts](file:///c:/Users/ACCES%20LIBRE/VEDEM/Intranet/vdm-intranet/apps/api/src/common/guards/jwt-auth.guard.ts) — ajout de `'POST /presence/first-login'` à `PASSWORD_CHANGE_ALLOWED_ROUTES`, cohérent avec le choix produit déjà fait (géolocalisation prioritaire sur le changement de mot de passe obligatoire).
- `[ ]` Validation — `npm`/`node` indisponibles dans cet environnement d'édition (poste sans PATH configuré) : le changement n'a **pas** pu être type-checké/buildé ici. Relire attentivement le diff avant merge et lancer `npm run type-check --workspace=apps/api` puis `npm run build:api` sur un poste où l'environnement Node est disponible.
- `[ ]` Non rétro-compatible : les comptes déjà bloqués avant ce correctif doivent simplement se reconnecter (aucune donnée corrompue à réparer, la présence du jour sera créée normalement au prochain login).
- `[ ]` Vérification manuelle — se connecter avec un compte fraîchement créé/réinitialisé (`mustChangePassword = true`, aucune présence aujourd'hui) et vérifier que l'écran de géolocalisation aboutit (pas de 403), puis que le changement de mot de passe obligatoire s'affiche ensuite normalement sur `/mon-profil`.

## Audit complet du dépôt & corrections — enrichissement des rôles, fiabilité backend, CI, accessibilité — 2026-08-24

Demande : analyse complète du dépôt (backend, frontend, rôles/permissions, infra) puis correction de l'ensemble des points relevés, partie par partie. Session menée sans accès Docker/PostgreSQL local (pas de `db:push`/`db:seed`/démarrage réel possible) — toutes les corrections livrées sont donc du code pur, sans nouvelle migration Prisma appliquée.

### 1. Rôles enrichis (`common/permissions.ts`)

- `[x]` `CAN_MANAGE_USERS_BU_SCOPE` : commentaire corrigé pour clarifier qu'elle est **lecture seule** (`scopeWhere`/recherche) — elle ne donnait déjà aucun droit d'écriture malgré son nom, source de confusion relevée par l'audit.
- `[x]` [NEW] `CAN_MANAGE_USERS_SCOPED_WRITE` (DAF, RESPONSABLE_BU, RESPONSABLE_POLE) + `users.service.ts::updateScoped`/`assertCanManageScopedTarget` + route `PATCH /users/:id/scoped` — un manager scopé peut désormais corriger nom/e-mail/mot de passe (DAF, RESPONSABLE_BU) et/ou le planning (les trois rôles) des utilisateurs de son périmètre, jamais son rôle/BU/pôle/manager, jamais un pair ou supérieur (CTO_ADMIN/PDG/DAF/RESPONSABLE_BU), jamais lui-même (doit passer par `/users/me`). `setActive` (activer/désactiver) étendu à DAF/RESPONSABLE_BU avec la même vérification de périmètre.
- `[x]` [NEW] `CAN_MANAGE_HOLIDAYS` (CTO_ADMIN, DAF) — `public-holidays.controller.ts` : la DAF peut désormais créer/modifier/supprimer des jours fériés (jusqu'ici verrouillé sur `CAN_MANAGE_SETTINGS`, qui mélangeait à tort branding technique et calendrier RH/paie).
- `[x]` [NEW] `CAN_MANAGE_ANNOUNCEMENTS_BU_SCOPE` (DAF, RESPONSABLE_BU) — `announcements.service.ts` (`create`/`update`/`remove`/`findAll`) : un manager scopé peut publier/gérer des annonces strictement limitées à sa propre BU (jamais globales, jamais une autre BU), avec une vue de gestion dédiée (`findAll(requester, false)` renvoie tout le statut de sa BU) distincte de la vue "widget" classique (`activeOnly=true`, inchangée : global + sa BU, actives uniquement).
- `[x]` [NEW] `CAN_MANAGE_SCHEDULE_GROUPS_BU_SCOPE` (RESPONSABLE_BU) — `presence.controller.ts`/`presence.service.ts` (`createScheduleGroup`/`updateScheduleGroup`/`deleteScheduleGroup`) : un responsable de BU peut créer ses propres groupes horaires (ex. le modèle nuit/week-end du Pôle TV/Radio, en attente depuis plusieurs sessions faute d'action CTO), toujours forcés sur sa propre BU, jamais globaux ni sur une autre BU.
- `[x]` PDG : accès en lecture seule à l'organigramme (BU, Pôles, groupes horaires, jours fériés) via un nouveau composant dédié [ParametresReadOnly.tsx](apps/web/src/components/parametres/ParametresReadOnly.tsx) (pas de partage de code avec `ParametresClient.tsx`, pour ne prendre aucun risque de faire fuiter un contrôle de mutation vers un rôle qui ne doit pas écrire) ; `parametres/page.tsx` route désormais CTO_ADMIN → `ParametresClient` (gestion complète), PDG → `ParametresReadOnly` (lecture seule), tout autre rôle → refusé comme avant. Entrée Sidebar "Organisation" ajoutée pour le PDG.
- `[x]` [NEW] Tests — `users.service.spec.ts` (12 tests), `announcements.service.spec.ts` (10 tests), `presence.schedule-groups.spec.ts` (7 tests) : couvrent le scoping BU/pôle, l'interdiction de gérer un pair/supérieur, l'interdiction d'auto-ciblage et la préservation des champs sensibles (rôle/BU/pôle/manager jamais modifiables via ces routes) même si fournis dans le payload.
- `[ ]` Non fait (suite logique, hors périmètre de cette session) : câblage de l'UI pour que DAF/RESPONSABLE_BU/RESPONSABLE_POLE utilisent réellement ces nouveaux droits depuis `/utilisateurs`, `/annonces` et `/presences/planning` (aujourd'hui, seuls les endpoints API existent) — ces pages affichent encore l'UI pensée pour leurs anciens droits, plus restreints.

### 2. Fiabilité backend

- `[x]` [MODIFY] `app.service.ts`/`app.controller.ts` — `/health` interroge désormais réellement PostgreSQL (`SELECT 1` via Prisma) et renvoie `503` si la base est injoignable au lieu de toujours répondre `200` ; version lue dynamiquement depuis `package.json` au lieu du littéral figé `'1.0.0-module1'`.
- `[x]` [NEW] `common/filters/all-exceptions.filter.ts` (`AllExceptionsFilter`, `app.useGlobalFilters`) — filtre d'exception global : journalise systématiquement toute erreur 5xx (avec un identifiant de corrélation renvoyé au client) via `Logger`, ne renvoie jamais un message Prisma brut sur une erreur imprévue. Auparavant seuls 2 fichiers sur 87 utilisaient `Logger`.
- `[x]` [NEW] `config/env.validation.ts` (fonction `validate` de `ConfigModule.forRoot`) — l'API refuse désormais de démarrer si `DATABASE_URL`/`JWT_SECRET` sont absents/vides ou si `JWT_SECRET` fait moins de 32 caractères, au lieu d'échouer tardivement et silencieusement au premier `jwtService.sign()`. Pas de nouvelle dépendance (pas de Joi), validation écrite à la main.
- `[x]` [MODIFY] `reports.controller.ts` — `@Throttle({ default: { ttl: 60_000, limit: 10 } })` au niveau du contrôleur : les 10 routes d'export (Puppeteer/ExcelJS, coûteuses en mémoire) ont désormais une limite dédiée plus stricte que le quota global de l'API (300/min), pour éviter qu'une boucle de retry ou un abus ne sature le VPS.
- `[x]` [NEW] `packages/database/prisma/migrations/migration_lock.toml` — fichier standard Prisma manquant, régénéré (`provider = "postgresql"`) ; son absence confirmait que l'historique de migrations n'était jamais passé par un `prisma migrate dev` propre.
- `[x]` [MODIFY] `docker-compose.yml` — `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` n'ont plus de valeur par défaut faible (`vdm_user`/`vdm_password`) ; `docker compose up` échoue désormais immédiatement si ces variables ne sont pas définies (`${VAR:?message}`), au lieu de démarrer silencieusement avec des identifiants devinables si le `.env` de l'environnement cible est mal chargé.
- `[x]` [NEW] Tests — `app.service.spec.ts` (2 tests), `config/env.validation.spec.ts` (5 tests).

### 3. Intégration continue

- `[x]` [NEW] `.github/workflows/ci.yml` (à la racine du dépôt Git, au-dessus de `vdm-intranet/`) — pipeline GitHub Actions sur push/PR vers `main` : Postgres éphémère en service, `prisma migrate deploy`, `prettier --check`, `type-check` API+Web, `jest` API, `build:api`, `build:web`, `npm audit` informatif. Aucun pipeline CI n'existait jusqu'ici — c'était l'élément identifié comme empêchant toute détection automatique des problèmes ci-dessous avant un incident réel.
- `[x]` **Baseline Prisma corrigée (décision validée explicitement par l'utilisateur cette session, revenant sur le refus du 2026-08-03 compte tenu du nouveau contexte : déploiement OVH toujours "TODO", donc aucune base de production à réconcilier)** — les 9 anciens dossiers de migrations (`0004_module4_tabs`, `20260630000001_module3_presence` — les deux baselines concurrentes recréant `business_units` en double — et les 7 migrations incrémentales appliquées jusqu'ici via `db push` : `20260720102947`, `20260726000000`, `20260727000000`, `20260803120000`, `20260806120000`, `20260806140000`, `20260821120000`) sont remplacés par une unique migration `20260824000000_init_baseline`, générée par `prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script` (aucune connexion base de données requise). Vérifié par relecture : 28 tables/10 enums générés, présence confirmée de tous les champs ajoutés par les migrations incrémentales (`mustChangePassword`, `failedLoginAttempts`, `lockoutUntil`, `workingDays`, `expectedDepartureTime`/`isNightShift`, `sourceConnectionLogId`, tables `public_holidays`/`notifications`, valeur d'enum `EMPLOYEE_REPORT_EXPORTED`).
- `[x]` `.github/workflows/ci.yml` — retrait du `continue-on-error: true` sur l'étape `prisma migrate deploy`, devenu inutile.
- `[x]` Validation — `npx prisma validate --schema packages/database/prisma/schema.prisma` OK, `npm run db:generate` OK (client Prisma régénéré sans erreur), `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npm run build:api` OK, `npx jest` (`apps/api`) 102/102 OK (aucune régression, ces tests ne touchent jamais une vraie base de données).
- `[ ]` Non fait — `npx prisma migrate deploy` n'a pas pu être exécuté contre une vraie base neuve dans cet environnement (pas d'accès Docker/PostgreSQL) ; la génération SQL a été vérifiée par lecture directe plutôt que par exécution réelle. **À vérifier en priorité au premier push** : la nouvelle CI (`.github/workflows/ci.yml`) exécute justement ce test contre un Postgres éphémère — surveiller le premier run.
- `[ ]` Non fait — aucune base de développement locale existante n'a été migrée/réconciliée (`prisma migrate resolve`) : sans accès Docker, impossible de vérifier si une base locale existe quelque part avec un historique `_prisma_migrations` à réconcilier. D'après l'audit de cette session, aucune base locale n'a jamais appliqué les migrations via `migrate dev`/`deploy` (uniquement `db push`, qui ne peuple pas cette table) — un `db push` normal continuera donc de fonctionner sans étape supplémentaire sur une base de dev existante.

### 4. Frontend — accessibilité & correctifs ciblés

- `[x]` [MODIFY] `ParametresClient.tsx` — `apiReq` (fetch brut local, ne redirigeait jamais vers `/login` sur une session expirée) remplacé par un alias vers `apiFetch` (`lib/http.ts`), le client HTTP unique déjà utilisé partout ailleurs depuis le 2026-08-03.
- `[x]` [MODIFY] `components/ui/Modal.tsx` — focus initial posé sur le premier élément focusable à l'ouverture, restauration du focus sur l'élément précédemment actif à la fermeture, piège de focus (Tab/Shift+Tab ne sortent plus vers le contenu masqué derrière le fond assombri). Aucune gestion de focus n'existait auparavant.
- `[x]` [MODIFY] `components/ui/DataTable.tsx` — en-têtes de colonnes triables rendus accessibles au clavier (`role="button"`, `tabIndex`, `Entrée`/`Espace`, `aria-sort`) ; bouton d'effacement de la recherche : `type="button"` + `aria-label` ajoutés (incohérence avec `Modal.tsx`, qui les avait déjà).
- `[x]` [MODIFY] `components/presence/PlanningCalendar.tsx` — la case de calendrier n'est plus un `<button>` contenant un second `<span role="button">` (imbrication d'éléments interactifs invalide en HTML, second contrôle inutilisable au clavier) ; restructurée en `<div role="button" tabIndex={0}>` avec gestion clavier explicite, contenant un vrai `<button>` pour "Supprimer ce jour".
- `[x]` [MODIFY] `app/manifest.ts` — le type MIME de l'icône personnalisée (`vdm_favicon`/`vdm_logo`) est désormais détecté depuis le contenu réel (data URI ou extension de fichier) au lieu d'être toujours codé en dur `image/jpeg`, alors que `logo_entreprise.png` est un PNG.
- `[ ]` Non fait (hors périmètre de cette session, à traiter séparément si voulu) : découpage des plus gros composants (`ParametresClient.tsx` ~2500 lignes, `PilotageClient.tsx`, `PlanningCalendar.tsx`, `UsersManager.tsx`), centralisation des listes de rôles dupliquées dans ~12 fichiers frontend, introduction d'ESLint (API et Web), introduction de tests frontend (Jest/RTL), introduction de React Query/SWR, consolidation de la couleur de marque (238 occurrences en dur), migration vers `next/image`, gestion de mise à jour du service worker.

### Validation

- `npx tsc --noEmit -p apps/api/tsconfig.json` : OK.
- `npx tsc --noEmit -p apps/web/tsconfig.json` : OK.
- `npx jest` (`apps/api`) : 102/102 OK (95 préexistants + 7 nouveaux sur `app.service`/`env.validation`, en plus des 29 nouveaux tests de la partie rôles).
- `npm run build:api` : OK.
- `rm -rf apps/web/.next` puis `npm run build:web` : OK.
- `npx prettier --write` sur tous les fichiers modifiés : OK.
- `.github/workflows/ci.yml` validé syntaxiquement (parsing YAML) — non exécuté sur GitHub dans cette session (pas de push effectué).
- Non fait — aucun accès Docker/PostgreSQL dans cet environnement : `db:push`, `db:seed`, démarrage réel de l'API/du frontend et vérification visuelle dans un navigateur n'ont pas pu être effectués. Aucune modification de schéma Prisma n'a cependant été nécessaire (tous les enrichissements de rôles sont purement applicatifs, `common/permissions.ts`).
