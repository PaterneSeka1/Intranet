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
