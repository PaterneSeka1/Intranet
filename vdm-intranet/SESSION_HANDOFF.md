# SESSION_HANDOFF.md - Relais de Session

Ce document résume le statut actuel du projet à la fin de cette session pour permettre au prochain agent IA de reprendre le travail facilement.

---

## 1. Statut Actuel

Les correctifs sécurité et bugs listés dans `TACHE.md` ont été implémentés, le schéma Prisma a été appliqué à la base locale et le seed a été exécuté.

### Nouvelle demande réalisée — Gouvernance rôles & onglets

- Nouveau fichier analysé : `contexte_vdm_compact_avec_schema.md`.
- Règle source : seuls `CTO_ADMIN` et `PDG` sont admins globaux.
- Hiérarchie admin : `CTO_ADMIN` est supérieur au `PDG` et peut modifier le compte PDG ; le `PDG` ne doit pas modifier le CTO/super admin.
- Correction d'hypothèse : la DAF n'est pas admin globale ; elle doit être traitée comme responsable/directrice de son périmètre département/BU.
- Les directeurs/responsables doivent pouvoir créer et gérer les onglets de leur département/BU, comme les responsables de BU.
- Clarification du 2026-07-27 : le `PDG` reste admin global des onglets et peut créer pour toutes les BU sans exception ; la `DAF` crée et gère uniquement les onglets de sa BU/direction.
- Le champ `Manager direct` sert au rattachement hiérarchique et ne détermine pas le créateur ni le périmètre des onglets.
- `TACHE.md` a été mis à jour avant les modifications de code, conformément à la demande utilisateur.

### Nouvelle demande réalisée — Masquage IP/géolocalisation pour les rôles employés (2026-07-28)

- Demande : les employés ne doivent plus voir leur adresse IP dans leurs plateformes ; seuls les responsables doivent tout voir, y compris la géolocalisation.
- `presence.service.ts::getMyConnections` neutralise désormais `ipAddress` pour les rôles accueil, en plus de `address`/`mapsUrl` déjà masqués.
- `presence.service.ts::getTodayAllPresences` applique désormais `redactPresenceForRole`, ce qu'il ne faisait pas contrairement aux autres méthodes du service.
- `recordLoginLog`/`recordLogoutLog` ne renvoient plus l'objet `ConnectionLog` complet (IP, latitude/longitude, adresse) dans la réponse HTTP ; seul `{ id }` est retourné, ces champs n'étant consommés par aucun appelant frontend.
- `MonHistoriqueClient.tsx` masque la colonne IP pour les rôles accueil, au même titre que la colonne adresse GPS (`showGeolocation`).
- Les listes de rôles "accueil uniquement" codées en dur dans `accueil/page.tsx`, `mon-historique/page.tsx` et `presences/page.tsx` ont été remplacées par la constante partagée `ACCUEIL_ONLY_ROLES` (`types/user.ts`).
- Aucune fuite trouvée côté Pilotage/rapports CSV : déjà réservés aux rôles responsables via `assertAllowed` (`pilotage.service.ts`, `reports.service.ts`).
- `TACHE.md` a été mis à jour avec le détail de ce correctif.

### Nouvelle demande réalisée — 7 nouvelles fonctionnalités (2026-07-28)

Demande : ajouter les fonctionnalités identifiées comme utiles lors d'un audit complet du repo (hors périmètre RH classique, déjà couvert par un outil externe). Plan détaillé conçu et validé avec l'utilisateur (mode plan) avant implémentation, avec 4 décisions d'architecture actées explicitement :

- Export PDF via **Puppeteer** (HTML→PDF brandé), pas pdfkit.
- Permissions **centralisées dans un seul fichier backend**, sans nouveau modèle DB ni UI de gestion.
- Reporting BU→CTO→PDG en **rollup automatique en lecture**, pas de workflow de soumission.
- Sessions actives en **historique lecture seule** (réutilise `ConnectionLog`), pas de `jti`/table `Session`/révocation.

Fonctionnalités livrées, dans l'ordre d'implémentation :

1. **Migration Prisma** — modèles `PublicHoliday` et `Notification` (+ enum `NotificationType`), appliqués via `db:push` (blocage `prisma migrate dev` P3006 déjà connu).
2. **Permissions centralisées** — `common/permissions.ts` regroupe désormais 16 nouvelles constantes ; toutes les listes de rôles dupliquées dans `pilotage`/`reports`/`presence`/`tabs`/`announcements`/`users` ont été remplacées par des imports, sans changement de comportement (vérifié par tests réels, notamment la restriction DAF sur les rapports étendus).
3. **Jours fériés** — module `public-holidays` (CRUD `CTO_ADMIN`), intégré à `pilotage.service.ts::getSummary`, onglet dédié dans `/parametres`, affichage widget calendrier + bannière `/presences`. 7 jours fixes CI seedés ; fêtes mobiles à saisir manuellement.
4. **Sessions actives** — nouvel onglet "Sécurité" dans `/mon-profil`, réutilise `GET /presence/my-connections` (ajout de `userAgent` au select, sans démasquer IP/GPS pour les rôles accueil), parsing user-agent maison sans nouvelle dépendance.
5. **Reporting hiérarchique** — `GET /pilotage/period-report?period=week|month`, agrégation par BU hors week-ends, nouvelle section `PeriodReportSection` dans `/pilotage` (BarChart + LineChart).
6. **Centre de notifications** — module `notifications` avec gateway Socket.IO **authentifiée au handshake** (parsing manuel du cookie JWT, rejet si invalide — contrairement au gateway `announcements` existant, non modifié car hors périmètre), déclenchée sur création de mandat et publication d'annonce, cloche `NotificationsBell` visible pour tous les rôles (y compris accueil).
7. **Export PDF** — dépendance `puppeteer` ajoutée, `reports.service.ts` refactorisé (extraction des requêtes en méthodes `get*Rows`/`getGeneralData` réutilisables), singleton `PdfBrowserService` avec `app.enableShutdownHooks()` ajouté à `main.ts`, 4 routes `/reports/*/pdf`, bouton PDF ajouté dans `PilotageClient`.
8. **Recherche globale** — module `search` (réimplémente les scopes existants par domaine, jamais plus permissif qu'eux), composant `GlobalSearch` monté dans `Sidebar`/`MobileSidebarToggle`.

Tests end-to-end réels effectués (API démarrée en mode dev, comptes seedés, mots de passe changés temporairement puis base reseedée) :

- Handshake Socket.IO `/notifications` : rejeté sans cookie (`io server disconnect`), accepté avec cookie valide, réception `notification:new` confirmée en moins d'une seconde après création d'un mandat.
- 4 PDF générés avec succès (`file` confirme `PDF document`), rendu visuel vérifié (branding, tableau, en-tête/pied de page).
- Parité de permissions DAF confirmée entre CSV et PDF (403 sur activité/connexions/général, 200 sur présences).
- Scope de la recherche globale confirmé : un `RESPONSABLE_BU` ne retrouve pas un utilisateur d'une autre BU, mais se retrouve lui-même.
- `TACHE.md` mis à jour avec le détail complet de cette session.

### Nouvelle demande réalisée — Identité visuelle : logo entreprise & icônes PWA (2026-07-28)

- `logo_intranet.png` (planche complète avec texte et bande de fonctionnalités) supprimé après extraction précise de l'emblème circulaire vers `icon-192.png`/`icon-512.png` (référencés uniquement dans `manifest.ts`, aucun autre usage — conformément à la demande explicite de l'utilisateur).
- `logo_entreprise.png` (nouveau logo officiel "Veilleur des Médias") activé comme logo de l'entreprise via le paramètre `vdm_logo` existant (`AppSetting`), repris automatiquement par tous les consommateurs déjà en place (Sidebar, MobileSidebarToggle, pages login/mot-de-passe-oublié/réinitialisation, favicon).
- **Bug découvert et corrigé** : `middleware.ts` bloquait (redirection `/login`) l'accès non authentifié aux fichiers publics statiques (`manifest.webmanifest`, `sw.js`, `offline.html`, icônes, logo) — cassait silencieusement l'installabilité PWA depuis la toute première visite (le manifeste renvoyait la page HTML de login au lieu du JSON) et empêchait l'affichage du logo sur `/login` elle-même. Matcher étendu pour exclure ces fichiers, même principe que l'exclusion déjà en place pour `favicon.ico`.
- Correctif complémentaire : `settings.service.ts::isValidImageUrl` accepte désormais les chemins relatifs racine (`/logo_entreprise.png`), pas seulement `http(s)://`/`data:image/`.
- Point d'attention laissé ouvert : le favicon (fallback `vdm_favicon || vdm_logo`) utilise maintenant le bandeau large `logo_entreprise.png` faute de favicon dédié — rendu potentiellement écrasé dans l'onglet navigateur ; un `vdm_favicon` carré dédié pourrait être ajouté si besoin.
- Test réel effectué : `PATCH /settings` avec cookie CTO_ADMIN, puis vérification `curl` que tous les fichiers publics renvoient du contenu valide (200, bytes corrects) sans cookie, et qu'une page protégée redirige toujours (307). Base reseedée après test (le paramètre `vdm_logo` survit au reseed, non couvert par le nettoyage de `seed.ts`).

### Nouvelle demande réalisée — Démarrage automatique de PostgreSQL (2026-07-29)

- Problème signalé par l'utilisateur comme récurrent : `npm run dev:api` échouait par intermittence avec `PrismaClientInitializationError: Can't reach database server at localhost:5434`.
- Cause identifiée : le daemon Docker Desktop n'est pas relancé automatiquement (ex. après redémarrage du Mac), donc le conteneur `vdm_postgres` défini dans `docker-compose.yml` n'existe pas quand l'API démarre.
- Créé `scripts/ensure-db.sh` : vérifie si le daemon Docker répond (`docker info`), lance Docker Desktop (`open -a Docker`, macOS uniquement) et attend son démarrage jusqu'à 120s si besoin, démarre le conteneur via `docker compose up -d postgres`, puis attend que Postgres réponde (`pg_isready`, jusqu'à 30s) avant de rendre la main.
- Ajouté dans `package.json` racine : `db:up` (exécute le script directement) et `predev:api`, qui se déclenche automatiquement avant `dev:api` via le hook npm standard `pre<script>` — aucune action manuelle requise avant de lancer l'API.
- Testé en conditions réelles : conteneur et daemon Docker arrêtés puis `npm run dev:api` relance les deux automatiquement et l'API démarre sans erreur Prisma.
- `README.md` et `CLAUDE.md` mis à jour pour documenter ce comportement.

### Nouvelle demande réalisée — Page "hors ligne" affichée trop souvent (2026-07-29)

- Demande : l'utilisateur tombe systématiquement sur un écran "hors ligne" en naviguant, alors que web/API/Postgres tournent tous normalement (vérifié : `curl /api/health` → 200 pendant l'incident).
- **Cause racine trouvée (confirmée par reproduction)** : `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` dans `apps/api/src/app.module.ts:26`, combiné à `ThrottlerGuard` posé en garde globale (`APP_GUARD`, ligne 41), limitait **toute** l'API à 10 requêtes/minute par IP — y compris `GET /auth/me`, `/announcements`, `/settings`, `/notifications/unread-count`, `/pilotage/*`, etc. Un seul chargement de page protégée (auth/me + annonces + paramètres + notifications + données de la page) dépasse déjà ce quota à lui seul ; toute navigation normale déclenchait donc un `429 Too Many Requests`, traité comme une panne par `getCurrentUserState()` (`unavailable: true`) → écran "Service temporairement indisponible" (`ServiceUnavailablePage.tsx`), visuellement proche du vrai fallback PWA (`public/sw.js`/`offline.html`), d'où la confusion initiale du diagnostic précédent.
- Reproduit en isolant le rate-limiter : boucle de requêtes `fetch` locales vers `/api/health` → succès jusqu'à la 10e, puis `429` en boucle jusqu'à expiration de la fenêtre de 60s.
- **Correctif** : `apps/api/src/app.module.ts:26` — limite globale relevée à `300` req/min (`ttl: 60000, limit: 300`). Les endpoints sensibles au brute-force (`POST /auth/login` 5/min, `/auth/forgot-password` 3/heure, `/auth/reset-password` 5/min dans `auth.controller.ts`) gardent leurs propres surcharges `@Throttle`, plus strictes et déjà correctement scopées — non modifiées.
- Correctif complémentaire conservé de la première tentative de diagnostic (moins critique mais toujours utile) : `apps/web/src/lib/auth.ts` — `getCurrentUserState`/`serverFetch` utilisent `fetchWithTimeout` (8s) et `getCurrentUserState` retente une fois avant de conclure à une vraie panne, pour absorber un aléa réseau transitoire réel (indépendant du rate limit).
- Validation : reproduction du 429 avant correctif, confirmation de sa disparition après (60/60 requêtes locales en rafale sans 429) ; `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npm run build:api` OK ; `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK.

### Nouvelle demande réalisée — "Mon historique" vide : bug du changement de mot de passe obligatoire (2026-07-29)

- Demande : vérifier que la page `/mon-historique` charge bien les données.
- Le code de la page (`mon-historique/page.tsx`, `presence.controller.ts::getMyConnections`, `presence.service.ts::getMyConnections`) est correct et fonctionnel — vérifié en le relisant en détail, rien à corriger côté fetch/affichage.
- **Vraie cause de la page vide, trouvée en base** : les tables `presences`, `activity_logs` et `connection_logs` sont toutes à 0 ligne, y compris pour l'utilisateur actuellement connecté (`mustChangePassword = false` chez lui, mais toujours 0 présence). 21 des 22 comptes seedés ont encore `mustChangePassword = true`.
- **Bug identifié dans `LoginClient.tsx`** : quand `user.mustChangePassword` est vrai, le frontend redirigeait immédiatement vers `/mon-profil` (`handleSubmit`) sans jamais regarder `requiresFirstLoginGeolocation` (pourtant renvoyé par `POST /auth/login`, `auth.service.ts:83`) — la géolocalisation obligatoire de 1ère connexion (`/presence/first-login`, qui crée le `Presence` du jour ET le `ConnectionLog`) n'était donc **jamais déclenchée** pour un compte forcé à changer son mot de passe. Après le changement de mot de passe, `MonProfilClient.tsx::handlePasswordSubmit` ne fait qu'un `router.refresh()`, sans jamais repasser par ce flux non plus. Résultat : un compte fraîchement seedé/réinitialisé n'a jamais de présence ni d'historique de connexion tant qu'il n'a pas fait un second cycle login/logout un jour où le mot de passe n'a plus besoin d'être changé.
- **Correctif** : `apps/web/src/components/auth/LoginClient.tsx::handleSubmit` — la géolocalisation (`requiresFirstLoginGeolocation`) est désormais vérifiée **avant** `mustChangePassword`. Le flux GPS → `/presence/first-login` s'exécute d'abord si nécessaire ; l'utilisateur atterrit ensuite sur `/accueil`, puis `MustChangePasswordGuard` (déjà en place dans `(protected)/layout.tsx`) le renvoie vers `/mon-profil` comme avant.
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK.
- **Non fait** : le correctif ne rétro-répare pas les comptes déjà bloqués sans présence pour aujourd'hui (dont l'utilisateur en session actuellement) — il faudra qu'ils se déconnectent/reconnectent une fois pour déclencher la géolocalisation et voir apparaître leurs premières lignes d'historique.

### Nouvelle demande réalisée — Widgets flottants absents pour les rôles accueil (2026-07-31)

- Demande : ajouter les widgets flottants (annonces, horloge, calendrier, météo) pour tous les employés sans exception.
- Cause trouvée : `(protected)/layout.tsx` rend deux arborescences selon `isAccueilOnly(user.role)` ; la branche `MobileSidebarToggle` passe `showWidgets` à `LiveAnnouncements`, mais la branche dédiée aux rôles accueil (`EMPLOYE`, `CONSULTANT`, `STAGIAIRE`, `PRESTATAIRE`) ne le faisait pas — `Widgets.tsx` lui-même n'impose aucune restriction de rôle.
- Correctif : ajout de la prop `showWidgets` sur l'appel `LiveAnnouncements` de la branche `isAccueilOnly` (`layout.tsx`).
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK.

### Nouvelle demande réalisée — Synchronisation automatique de SESSION_HANDOFF.md/TACHE.md (2026-07-31)

- Demande : mettre à jour automatiquement ces deux fichiers après chaque requête, sans intervention manuelle.
- Mécanisme retenu : Stop hook (`.claude/settings.local.json`, personnel à ce poste, non versionné) plutôt qu'un appel récursif `claude -p` — écarté après test réel, car bloqué par le trust-dialog du CLI en mode non interactif sur ce poste (workspace non marqué "trusted" dans `~/.claude.json`, donc `Edit`/`--allowedTools` refusés même en `-p`).
- `.claude/hooks/sync-md-docs.sh` détecte les changements de code non commités dans `vdm-intranet/apps`/`vdm-intranet/packages`, compare à un hash stocké dans `.claude/.md-sync-state` (gitignored), et bloque la fin de tour (`decision: "block"`) tant que `SESSION_HANDOFF.md`/`TACHE.md` n'ont pas été mis à jour et que le hash n'a pas été rafraîchi.
- Portée volontairement limitée à ces deux fichiers (pas README.md/CLAUDE.md/METHODE_DE_TRAVAIL.md), et au déclenchement uniquement quand du code a changé (pas sur un tour purement conversationnel) — choix validés avec l'utilisateur.
- Limite connue : le watcher de settings d'une session déjà démarrée ne surveille pas un `.claude/settings.local.json` créé après son lancement ; un `/hooks` ou un redémarrage peut être nécessaire pour l'activer immédiatement dans une session en cours (les nouvelles sessions le chargent normalement au démarrage).

### Correctif — Annonces épinglées absentes du widget flottant (2026-07-31)

- Demande : les annonces épinglées doivent aussi apparaître dans le widget flottant "Annonces", fixées en haut.
- Bug trouvé dans `AnnouncementWidget` (`Widgets.tsx`) : la logique n'affichait les annonces épinglées que s'il n'existait aucune annonce non épinglée (fallback), au lieu de les afficher en priorité — comportement inverse de ce qu'implique un épinglage. Le tri backend (`isPinned: 'desc'` puis `publishedAt: 'desc'`, `announcements.service.ts::findAll`) était déjà correct ; seul le frontend cassait cet ordre.
- Correctif : `Widgets.tsx::AnnouncementWidget` sépare désormais les annonces épinglées (toujours affichées, en tête) des non épinglées (complètent la liste jusqu'à 3 éléments au total).
- Ancienne description à corriger : le widget n'affiche plus seulement les "annonces actives non épinglées avec fallback sur les épinglées" — voir section "Fonctionnalités Réalisées" mise à jour ci-dessous.
- Suite immédiate (même jour) : demande complémentaire pour que **toutes** les annonces actives s'affichent dans le widget, avec défilement. `AnnouncementWidget` (`Widgets.tsx`) ne limite plus à 3 éléments : les épinglées restent affichées en bloc fixe en haut (non scrollable), les non épinglées sont listées en dessous dans une zone scrollable (`max-h-56 overflow-y-auto`). Extraction d'un sous-composant `AnnouncementItem` pour éviter la duplication de rendu entre les deux blocs.
- Correctif suivant (même jour) : en conditions réelles avec beaucoup d'annonces épinglées, le bloc épinglé (non scrollable) grossissait sans limite et faisait déborder le widget de l'écran (constaté par capture d'écran utilisateur sur `/annonces`). `AnnouncementWidget` fusionne désormais épinglées + non épinglées en une seule liste (épinglées toujours en premier) dans une unique zone scrollable, sous un en-tête fixe ; le widget entier est plafonné à `max-h-[min(60vh,26rem)]`.
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK.

### Correctif — Rechargement de la page de login sur erreur (2026-07-31)

- Demande : ajouter un toast sur la page de connexion, retirer le rechargement de page en cas d'erreur.
- **Cause trouvée** : `api.ts::req` redirige/recharge vers `/login?from=...` sur tout statut `401` — logique correcte pour une session expirée sur une route protégée, mais appliquée aussi à `POST /auth/login` lui-même, dont un mauvais mot de passe renvoie légitimement un 401 ; la page de login se rechargeait donc sur elle-même à chaque tentative échouée.
- Correctif : ajout d'une option `skipAuthRedirect` sur `req` (`api.ts`), activée uniquement pour `api.auth.login`, pour désactiver cette redirection sur l'endpoint de connexion.
- `LoginClient.tsx` remplace le bandeau d'erreur inline (`error`/`setError`) par `toast.error(...)`, conforme à la convention déjà en place ailleurs (`MonProfilClient.tsx`).
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK.

### Nouvelle fonctionnalité réalisée — Suppression de notifications (2026-07-31)

- Demande : pouvoir supprimer les notifications depuis la cloche `NotificationsBell`.
- Backend : `notifications.service.ts::remove(id, userId)` (vérifie l'ownership via `findFirst` avant `delete`, même pattern que `markRead`) ; route `DELETE /notifications/:id` ajoutée dans `notifications.controller.ts`.
- Frontend : `notificationsApi.remove(id)` ajouté dans `lib/notifications.ts` ; `NotificationsBell.tsx` affiche désormais un bouton ✕ par notification (visible au survol), suppression avec mise à jour optimiste de la liste et du compteur non lus.
- Validation : `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npx tsc --noEmit -p apps/web/tsconfig.json` OK.
- Non fait : pas de suppression groupée ("tout supprimer") — non demandée, seule la suppression unitaire par notification a été implémentée.

### Ajustement — Widget annonces : titre seul cliquable avec détails en modale (2026-08-03)

- Demande : dans le widget flottant "Annonces", n'afficher que le titre de chaque annonce et le rendre cliquable pour accéder à tous les détails.
- `Widgets.tsx::AnnouncementItem` n'affiche plus l'aperçu du corps du message ; seul le titre reste visible, sous forme de bouton cliquable.
- Nouveau sous-composant `AnnouncementDetailModal` (`Widgets.tsx`), qui réutilise le composant générique `Modal` (`components/ui/Modal.tsx`) déjà utilisé ailleurs dans l'app, plutôt que d'introduire un nouveau pattern de modale.
- La modale affiche le titre, la date complète, le badge épinglée/unité d'affaires, le corps intégral du message et l'auteur (`createdBy`).
- Aucune page de détail dédiée n'existait pour un usage tous rôles (la page `/annonces` est réservée à `CTO_ADMIN`/`PDG` pour la gestion) ; la modale a donc été préférée à une nouvelle route.
- Ajustement complémentaire (même jour) : la zone cliquable a été étendue à toute la ligne de l'annonce (badge épinglée + date + titre), pas seulement au texte du titre — `AnnouncementItem` est désormais un `<button>` pleine largeur.
- Ajustement complémentaire (même jour) : léger effet de survol (`hover:bg-gray-50`, coins arrondis, transition douce) ajouté sur toute la ligne, pas seulement sur le titre.
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK.

### Nouvelle demande réalisée — Intégration Congés : statut EN_CONGE & widget "Employés en congé" (2026-08-04)

- Demande : un employé en congé approuvé (app externe VEDEM/CONGE, `/Users/macbookpro/VEDEM/CONGE`, Next.js/Prisma/MongoDB séparée de ce repo) ne doit plus être marqué "Absent" dans l'Intranet ; ajouter un widget "Employés en congé" visible par toute l'entreprise.
- Décisions actées avec l'utilisateur avant implémentation : rapprochement d'identité par `matricule` (Congé) == `username` (login Intranet), email en repli ; widget placé sur `/accueil` uniquement (visible par tous les rôles, y compris accueil) ; autorisation explicite de modifier le repo VEDEM/CONGE.
- Côté CONGE : nouvel endpoint `GET /api/leaves/active` (`app/api/leaves/active/route.ts`, jour unique ou plage `from`/`to`), protégé par secret partagé `INTRANET_SYNC_SECRET` — sur le même modèle que l'endpoint cron `auto-approve-overdue` déjà existant.
- Côté vdm-intranet : nouveau module `apps/api/src/leaves/` — `LeaveSyncService` (client HTTP vers CONGE, cache 60s, dégradation silencieuse si non configuré), `leave-match.util.ts` (matching + labels FR des types de congé), endpoint public `GET /leaves/on-leave/today` pour le widget.
- `presence.service.ts` et `pilotage.service.ts` calculent désormais un statut synthétique `EN_CONGE` partout où `ABSENT` était déduit (jamais persisté en DB, même principe que `ABSENT` lui-même) : `getTodayAllPresences`, `getTodayPresence`, `getSummary`, `getPresenceByBu`, `getPeriodReport`.
- Frontend : nouveau composant `EmployeesOnLeaveCard.tsx` sur `/accueil` ; badge/compteur "En congé" sur `/presences` ; KPI + barre "En congé" sur `/pilotage`.
- **Décision de confidentialité notable** : le widget public (`/leaves/on-leave/today`) n'expose jamais le _type_ de congé — CONGE a des catégories de santé sensibles (maladie, menstruel, maternité/paternité) qui ne doivent pas être diffusées à toute l'entreprise. Le type n'apparaît que dans les vues déjà réservées aux managers (`/presence/today/all`) ou à l'intéressé lui-même (`/presence/today`).
- Tests réels effectués : API démarrée en mode dev, base reseedée, faux serveur HTTP local simulant l'endpoint CONGE. Confirmé par `curl` le cas par défaut (intégration non configurée → comportement inchangé) et le cas positif (congé simulé → `EN_CONGE` correct sur toutes les vues, compteurs Pilotage ajustés, y compris le rapport hebdomadaire par plage de dates). Base et mot de passe de test restaurés après coup.
- **Non complété** : vérification visuelle dans un vrai navigateur — l'outil de navigateur MCP (Docker/Playwright) s'est interrompu en cours de session après plusieurs contournements réseau nécessaires (accès à l'hôte depuis le conteneur, CORS, attribut `Domain` du cookie de session). Seule la donnée servie par l'API a été vérifiée, pas le rendu final des composants.
- **Reste à faire par l'utilisateur** : définir `CONGE_API_URL`/`CONGE_API_SECRET` (vdm-intranet) et `INTRANET_SYNC_SECRET` (VEDEM/CONGE, même valeur) en environnement réel — tant qu'ils sont vides, l'intégration reste désactivée sans erreur.
- `TACHE.md` mis à jour avec le détail complet de cette session.

### Audit complet du dépôt & corrections (2026-08-03)

- Demande : analyser l'intégralité du dépôt (backend, frontend, base de données, documentation) pour relever toute incohérence/incompréhension, puis tout corriger.
- Sécurité : reset de compte par un admin (`users.service.ts::update`) réinitialise maintenant `failedLoginAttempts`/`lockoutUntil` (sinon un compte verrouillé restait bloqué malgré la réinitialisation) ; `mapsUrl` n'est plus jamais accepté depuis le client sur `login-log`/`logout-log`, toujours reconstruit côté serveur.
- Backend : `search.service.ts` aligné sur `announcements.service.ts` pour le bypass admin (annonces inactives/expirées visibles par CTO_ADMIN/PDG en recherche globale, comme dans la liste complète) ; `tabs.service.ts::update()` revalide désormais l'unicité d'URL pour les onglets globaux (trou non couvert par la contrainte DB `@@unique([businessUnitId, url])`, qui ignore les `NULL`) ; nettoyage de code mort et d'incohérences mineures (`hasPresenceToday`, journalisation `SCHEDULE_GROUP_*`, taille max de `icon`, export `ConnectionLogType`).
- Base de données : nouvelle migration corrective `20260803120000_fix_schema_integrity` (FK/colonnes manquantes sur `announcements`, ordre de l'enum `Role` avec `EMPLOYE`, FK sur `Presence.sourceConnectionLogId`) — additive, n'altère aucune migration existante. Hiérarchie `managerUsername` complétée dans `seed.ts` pour les comptes restés sans manager, en s'appuyant uniquement sur les rattachements explicitement documentés dans `contexte_vdm_compact_avec_schema.md` (aucun lien hiérarchique inventé pour RBU_INFO/RBU_EREP/RBU_ANALYSES, dont seule une coordination opérationnelle du CTO est documentée).
- Frontend : client HTTP unique (`lib/http.ts`) remplaçant 8+ implémentations locales divergentes du traitement 401/403 (désormais seul un 401 redirige vers `/login`) ; lien Sidebar manquant ajouté pour DAF/RESPONSABLE_BU/RESPONSABLE_POLE vers `/utilisateurs` (accès backend scopé déjà réel, `CAN_VIEW_USERS`/`scopeWhere`, mais sans navigation) ; `GlobalSearch` rendue visible sur desktop (n'existait que dans le header mobile).
- Documentation : `README.md` (description widget annonces obsolète), `METHODE_DE_TRAVAIL.md` et `.agents/AGENTS.md` (rôle `EMPLOYE` manquant dans la liste des rôles standards sans géolocalisation) mis à jour.
- Non résolu (arbitrage explicite avec l'utilisateur) : l'historique des migrations Prisma reste structurellement cassé au-delà des 3 points corrigés — `0004_module4_tabs` et `20260630000001_module3_presence` sont deux migrations concurrentes recréant tout le schéma initial en double (committées ensemble). Seul un squash/rebase complet de l'historique réglerait ce point ; l'utilisateur a choisi des migrations correctives additives plutôt qu'une réécriture d'historique, donc `prisma migrate deploy` sur une base neuve resterait bloqué avant même d'atteindre la nouvelle migration.
- Non appliqué à la base locale : la migration corrective n'a pas été exécutée (pas d'accès PostgreSQL dans cet environnement) ; certaines de ses instructions (renommage/ajout de colonnes déjà présentes via `db push`) échoueraient si rejouées telles quelles sur la base actuelle — à adapter avant tout `migrate deploy` réel, ou à réserver à une base neuve.
- Validation : `npx tsc --noEmit` (api/web/database), `npm run build:api`, `npm run build:web` (après nettoyage `.next`), `npx prisma validate`, `npm run db:generate`, `npm run format` : OK.

### Ajustement — Widget "Employés en congé" déplacé de l'accueil vers un widget flottant global (2026-08-06)

- Demande : le widget "Employés en congé" (ajouté le 2026-08-04 sur `/accueil` uniquement) ne doit plus être sur la page accueil.
- Clarifié avec l'utilisateur (choix explicite parmi plusieurs options) : le transformer en widget flottant global — visible sur toutes les pages protégées, comme Annonces/Horloge/Calendrier/Météo — plutôt qu'une nouvelle page dédiée ou un doublon.
- `accueil/page.tsx` : retrait de la carte `EmployeesOnLeaveCard` et du fetch `/leaves/on-leave/today` associé, devenus inutiles sur cette page.
- `EmployeesOnLeaveCard.tsx` supprimé (composant inline devenu orphelin, plus aucune référence dans le repo).
- `Widgets.tsx` : nouveau widget flottant "Congés" (clé `leave`, toggle indépendant dans la barre de bascules, visibilité persistée en `localStorage` comme les autres), données récupérées côté client via `leavesApi.onLeaveToday()` (existant, non modifié) — aucun changement backend ni base de données, aucune exposition du type de congé ou de l'email (restriction déjà en place côté API depuis la session du 2026-08-04).
- Le widget est monté globalement via `LiveAnnouncements` (rendu dans les deux branches de `(protected)/layout.tsx`), donc visible pour tous les rôles sur toutes les pages protégées, pas seulement l'accueil.
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `npx prettier --write` puis `--check` sur `Widgets.tsx`/`accueil/page.tsx` OK.
- **Non fait** : vérification visuelle réelle du rendu du nouveau widget flottant dans un navigateur (même limite que la session du 2026-08-04 — pas d'outil navigateur disponible dans cet environnement).
- `TACHE.md` mis à jour avec le détail de cet ajustement.

### Nouvelle demande réalisée — Horaires variables par jour/semaine/mois : mandats étendus & planning mensuel (2026-08-06)

- Demande : configurer, pour certains employés (cas cible : Pôle TV/Radio, BU INFO), des heures d'arrivée qui varient par jour/semaine/mois, avec rotation jour/nuit/week-end sur un même mois.
- Décisions actées avec l'utilisateur : ouverture de la configuration aux Responsables BU/Pôle (déjà satisfaite par le scoping existant `canMandateUser`/`buildUserScope`, aucun changement de permission nécessaire) ; calendrier mensuel visuel complet plutôt qu'un simple formulaire enrichi ; introduction de Jest dans `apps/api` avant de livrer, compte tenu de la sensibilité du calcul de retard (franchissement de minuit).
- Base de données : `DailyMandate` gagne `expectedDepartureTime`/`isNightShift` (colonnes additives nullables). Le blocage `prisma migrate dev` P3006 (historique cassé, documenté depuis le 2026-08-03) a été retrouvé à l'identique ; contourné par `db push` + migration écrite à la main pour la traçabilité, sans toucher à l'historique existant.
- Backend : deux gaps corrigés dans `presence.schedule.service.ts` — `getDepartureScheduleSource` ignorait les mandats jusqu'ici, et `isNightShift` n'était jamais surchargeable par un mandat (désormais `mandat ?? groupe ?? false`, pour qu'un mandat "week-end" puisse désactiver explicitement le mode nuit du groupe par défaut). Nouvel endpoint `POST /presence/mandates/bulk` (upsert transactionnel, un employé × plusieurs jours) ; `GET /presence/mandates` accepte `from`/`to`/`userId`, ce dernier composé en `AND` du scope BU/Pôle existant pour qu'un responsable ne puisse jamais élargir son périmètre de lecture via ce paramètre.
- Tests : Jest introduit dans `apps/api` (absent du projet jusqu'ici) — 18 tests couvrant la résolution mandat > groupe > individuel, le franchissement de minuit en équipe de nuit (avec un test démontrant la régression si `isNightShift` n'est pas propagé), et le scoping des permissions du nouvel endpoint bulk.
- Frontend : nouveau calendrier mensuel (`PlanningCalendar.tsx`, route `/presences/planning`) — sélection multi-jours (clic, "tous les samedis/dimanches"), modèles cliquables issus des `ScheduleGroup` de la BU/Pôle de l'employé, saisie libre. `MandatesManager.tsx` enrichi (heure de départ + case "équipe de nuit") pour le mandat unitaire.
- **Non fait (volontaire)** : aucun `ScheduleGroup` "nuit"/"week-end" créé pour le Pôle TV/Radio — les heures réelles n'ont pas été fournies par l'utilisateur et n'ont pas été inventées ; à créer via `/parametres` (CTO_ADMIN) pour que ces modèles apparaissent dans le calendrier.
- Validation : `npm run build:api` OK, `npm run build:web` OK (route `/presences/planning` listée), `npx jest` (`apps/api`) 18/18 OK, `npx tsc --noEmit -p apps/api/tsconfig.json` OK.
- **Non fait** : vérification visuelle réelle du calendrier dans un navigateur (même limite que les sessions précédentes — pas d'outil navigateur dans cet environnement).
- `TACHE.md` mis à jour avec le détail complet de cette session.

### Ajustement — Onglet "Emploi du temps" & règle CTO ne gère pas le PDG (2026-08-06)

- Demande : un onglet de navigation dédié pour gérer l'emploi du temps de tout le monde, visible par le PDG et le CTO_ADMIN, avec une règle explicite : le CTO_ADMIN ne peut pas gérer l'emploi du temps du PDG (le PDG, lui, peut gérer celui de tout le monde) ; les Responsables BU gèrent leur BU, les Responsables de département (mappé sur `Pôle`, seul concept analogue dans ce repo) gèrent leur périmètre.
- La majeure partie de la hiérarchie demandée était déjà en place depuis la session précédente du même jour (`canMandateUser`/`buildUserScope`) ; seule la restriction CTO→PDG était réellement nouvelle.
- Backend : `presence.service.ts::canMandateUser` refuse désormais absolument un `CTO_ADMIN` ciblant un `PDG`, vérifié en tête de fonction pour ne jamais être contournable (y compris via le repli `createdById` de `deleteMandate`, pour un mandat qui aurait été créé avant l'introduction de cette règle). 5 nouveaux tests Jest couvrent ce cas et prouvent l'absence de régression sur l'accès global du PDG.
- Frontend : nouvel item de navigation "Emploi du temps" dans `Sidebar.tsx` (`/presences/planning`), ajouté pour `CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU`, `RESPONSABLE_POLE`. Le PDG est retiré des sélecteurs d'employé et les boutons d'action (Mandater/Supprimer) sont masqués sur ses lignes, uniquement quand le rôle courant est `CTO_ADMIN` — anticipation côté UI de la règle backend, pour éviter un aller-retour en erreur 403.
- **Décision d'interprétation** : la restriction porte sur la _gestion_ (créer/modifier/supprimer un mandat), pas sur la _lecture_ — le CTO_ADMIN voit toujours le planning du PDG dans les tableaux, seuls les boutons d'action sont masqués. Aucune restriction de lecture n'a été demandée explicitement.
- **Assomption à confirmer** : `DAF` a été inclus dans le nouvel onglet Sidebar par cohérence avec son périmètre BU déjà existant côté backend, bien que non explicitement nommé par l'utilisateur (qui a cité PDG, CTO, Responsables BU et Responsables de département).
- Validation : `npx tsc --noEmit` (api + web), `npm run build:api`, `npm run build:web`, `npx jest` (`apps/api`, 23/23) : OK.
- `TACHE.md` mis à jour avec le détail complet de cet ajustement.

### Correctif — Lien actif Sidebar & filtre BU sur les sélecteurs employé (2026-08-06)

- Demande : « Présences » et « Emploi du temps » s'allumaient tous les deux en même temps dans la Sidebar quand on est sur `/presences/planning` ; ajouter un filtre par BU pour retrouver un employé plus facilement dans les longues listes.
- `Sidebar.tsx` : la détection d'item actif calcule désormais le préfixe le plus long parmi les items du rôle courant (au lieu de tester chaque item indépendamment), donc un seul item est actif à la fois même quand une route est imbriquée sous une autre (`/presences/planning` sous `/presences`).
- `PlanningCalendar.tsx` et `MandatesManager.tsx` : nouveau sélecteur « Filtrer par BU » (affiché seulement si plusieurs BU sont présentes) qui restreint la liste du sélecteur « Employé » ; réinitialise la sélection si l'employé choisi sort du filtre.
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `npm run build:web` OK, `npx prettier --write` OK.
- `TACHE.md` mis à jour avec le détail complet de ce correctif.

### Correctif — Absence marquée trop tôt / hors jour de travail (2026-08-06)

- Demande : un employé ne doit pas être marqué "Absent" tant que son heure d'arrivée attendue n'est pas encore dépassée, ni si ce n'est pas son jour de travail.
- **Bug confirmé** dans 4 méthodes (`getTodayPresence`/`getTodayAllPresences` dans `presence.service.ts`, `getSummary`/`getPresenceByBu` dans `pilotage.service.ts`) : toutes déduisaient "Absent" par défaut dès qu'aucune `Presence` n'existait pour le jour, sans vérifier l'heure ni le jour de travail — indice trouvé côté frontend : `PresencesPageClient.tsx` affichait déjà une bannière "les absences affichées sont normales" les week-ends, un contournement qui masquait la donnée plutôt que de la corriger.
- `PresenceScheduleService.isArrivalOverdue(expectedTime, now, isNightShift)` (nouveau) : vrai uniquement si l'heure attendue + tolérance (`PRESENCE_LATE_TOLERANCE_MINUTES`) est dépassée — réutilise le même calcul de délai que `calculatePresenceStatus` (y compris le franchissement de minuit en équipe de nuit), pour que "déjà arrivé" et "pas encore arrivé" ne divergent jamais.
- Deux nouveaux statuts calculés à la volée (jamais persistés, même principe que `EN_CONGE`) : `REPOS` (pas le jour de travail — week-end/férié sans mandat, ou aucun planning défini ; un mandat explicite prime toujours sur le week-end/férié par défaut) et `EN_ATTENTE` (jour de travail, heure attendue pas encore dépassée).
- `getTodayAllPresences` gère aussi la navigation par date passée/future de `/presences?date=...` : une date passée sans présence reste directement `ABSENT` (jour déjà terminé), une date future n'est jamais `ABSENT` (`EN_ATTENTE`).
- `PresenceScheduleService` est désormais exportée par `PresenceModule` et réutilisée par `PilotageModule`/`PilotageService`, pour que `getSummary`/`getPresenceByBu` (KPI "aujourd'hui" de `/pilotage`) appliquent exactement la même règle — nouveaux compteurs `dayOff`/`pending`, `absent` corrigé pour ne plus les inclure.
- Frontend : nouveaux badges/libellés "Repos"/"En attente" (`accueil/page.tsx`, `PresenceTable.tsx`), compteurs correspondants sur `/presences` (`PresencesPageClient.tsx`, bannière week-end reformulée pour ne plus affirmer que "les absences sont normales" — plus toujours vrai avec un mandat explicite), nouvelle tuile KPI "Repos / en attente" sur `/pilotage` (`PilotageClient.tsx`).
- 10 tests ajoutés (`presence.schedule.service.spec.ts`, `presence.service.spec.ts`), horloge système simulée via `jest.useFakeTimers()` pour des cas déterministes (avant/après l'heure attendue, week-end avec/sans mandat, date passée/future).
- Non fait (hors périmètre) : `getPeriodReport` (rapport hebdo/mensuel) garde son propre modèle d'exclusion des week-ends, non aligné sur la notion de mandat-sur-jour-non-travaillé — à traiter séparément si besoin.
- `TACHE.md` mis à jour avec le détail complet de ce correctif.

### Nouvelle demande réalisée — Jours de travail récurrents par employé, à la création (2026-08-06)

- Demande : pouvoir marquer, à la création d'un employé (et modifiable ensuite), ses jours de travail récurrents — par défaut Lundi-Vendredi — pour ne plus avoir à reconfigurer le planning chaque semaine/mois ; réglage modifiable, notamment via le calendrier de planification pour les mois qui diffèrent du motif par défaut.
- Décision actée avec l'utilisateur (question posée explicitement) : un jour hors motif récurrent (et sans mandat explicite ce jour-là) ne doit plus jamais être compté "Absent" nulle part dans l'app — comportement branché dans le mécanisme `REPOS`/`EN_ATTENTE` livré dans le correctif précédent du même jour, plutôt que réinventé.
- Point de méthode notable : `presence.service.ts`, `presence.schedule.service.ts` et `pilotage.service.ts` étaient édités en direct par l'utilisateur dans son IDE pendant cette conversation (confirmé explicitement après question) ; l'implémentation a donc été séquencée en deux phases (réglage employé d'abord, câblage dans le calcul d'absence ensuite, après confirmation que les édits en cours étaient sauvegardés) et les 3 fichiers relus intégralement juste avant d'y toucher.
- Base de données : `User.workingDays Int[] @default([1,2,3,4,5])` (convention `Date.getUTCDay()`, 0=Dimanche…6=Samedi) ; tableau vide valide et significatif (planning entièrement défini par mandats, ex. rotation Pôle TV/Radio). Migration écrite à la main `20260806140000_add_user_working_days` (même contournement P3006 que les migrations précédentes), appliquée via `db push`.
- Backend : nouvel utilitaire partagé `common/working-days.util.ts` (`isRecurringWorkDay`, `DEFAULT_WORKING_DAYS`) remplaçant la fonction locale `isWeekendDate` (dupliquée dans `presence.service.ts` et `pilotage.service.ts`) par un calcul par employé. Branché dans `getTodayPresence`/`getTodayAllPresences` et `getSummary`/`getPresenceByBu` (le calcul `isNonWorkingDefault`, auparavant global avant la boucle, est désormais par utilisateur, dans la boucle). Champ exposé sur `create-user.dto.ts`/`update-user.dto.ts` (validation `IsInt`/`Min(0)`/`Max(6)`/`ArrayMaxSize(7)`, pas de taille minimale) et sur `SAFE_SELECT` de `users.service.ts` (normalisation dédupliquée/triée à la création/modification).
- Hors périmètre, assumé explicitement dans le code : `getPeriodReport` (rapport agrégé par BU de `/pilotage`) garde encore le motif par défaut global (`isRecurringWorkDay(undefined, d)`, strictement équivalent à l'ancien comportement) plutôt qu'un calcul pleinement per-employé, qui nécessiterait de restructurer sa boucle jour→utilisateurs — à faire séparément si besoin.
- Frontend : nouvelle section "📅 Jours de travail récurrents" dans le formulaire de création/modification employé (`UsersManager.tsx`), 7 boutons Lun-Dim, Lun-Ven cochés par défaut à la création. `PlanningCalendar.tsx` reflète désormais le motif réel de l'employé sélectionné (au lieu d'un week-end fixe `weekdayIdx >= 5`) pour griser ses jours hors motif.
- Tests : 8 nouveaux tests Jest (`working-days.util.spec.ts` + extension de `presence.service.spec.ts` : motif personnalisé Mardi-Samedi, tableau vide retombant sur le défaut, widget individuel `getTodayPresence`) — 43/43 OK au total.
- Validation : `npx prisma validate`, `npm run db:generate`, `npx prisma db push` OK. `npx tsc --noEmit` (api + web) OK. `npx jest` (`apps/api`) 43/43 OK. `npm run build:api` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK. `npm run format` OK. `git diff --check` OK.
- Non fait : vérification visuelle réelle dans un navigateur (même limite que les sessions précédentes — pas d'outil navigateur disponible dans cet environnement).
- `TACHE.md` mis à jour avec le détail complet de cette demande.

### Ajustement — Retrait de la barre de recherche globale dans la Sidebar (2026-08-06)

- Demande : retirer complètement la barre de recherche de la Sidebar.
- `Sidebar.tsx` : suppression du bloc de rendu `<GlobalSearch dark />` (section "Recherche globale (desktop)") et de son import ; aucune autre modification.
- Composant `GlobalSearch` et module backend `search` non touchés — `GlobalSearch` reste monté dans `MobileSidebarToggle` (header mobile), seule l'occurrence desktop de la Sidebar est supprimée.
- Validation : `npx tsc --noEmit -p apps/web/tsconfig.json` OK.
- `TACHE.md` mis à jour avec cet ajustement.
- Note : `apps/web/tsconfig.tsbuildinfo` régénéré par ce `tsc --noEmit` (artefact de build, sans changement fonctionnel) — même changement que ci-dessus, pas une nouvelle modification.

### Fonctionnalités Réalisées

- **Sécurité login** :
  - Comparaison bcrypt systématique avec hash factice pour limiter l'énumération de comptes.
  - Verrouillage temporaire après 5 échecs consécutifs, avec reset des compteurs après connexion réussie.
  - Propagation de `mustChangePassword` via JWT et blocage des routes API tant que le mot de passe temporaire n'est pas remplacé.
- **Rotation forcée du mot de passe** :
  - Nouveaux champs Prisma : `mustChangePassword`, `failedLoginAttempts`, `lockoutUntil`.
  - Migration SQL ajoutée : `packages/database/prisma/migrations/20260726000000_add_user_login_security/migration.sql`.
  - Les utilisateurs seedés et les comptes créés/réinitialisés par admin doivent changer leur mot de passe.
  - Le profil utilisateur désactive l'onglet informations et force l'onglet mot de passe quand la rotation est obligatoire.
- **Validation des mots de passe** :
  - Complexité imposée côté API sur création utilisateur, update utilisateur et reset token.
  - Validation miroir côté profil frontend.
- **Durcissements API** :
  - `trust proxy` activé et IP lue via `req.ip`.
  - Prénom échappé dans les emails de reset.
  - Paramètres de thème validés côté serveur.
  - Dates de rapports validées avec contrôle de l'ordre début/fin.
- **Présence et mandats** :
  - `processEndDay` rendu atomique via `updateMany` conditionnel.
  - `processFirstLogin` gère les conflits d'unicité `P2002`.
  - Les mandats conservent `isNightShift` du groupe horaire.
  - Fonction morte `getDailyMandate` supprimée.
  - Un employé n'est jamais marqué `ABSENT` avant que son heure d'arrivée attendue (+ tolérance) ne soit dépassée (`EN_ATTENTE` avant), ni si ce n'est pas son jour de travail — week-end/férié sans mandat, ou aucun planning défini (`REPOS`) ; un mandat explicite prime toujours sur le week-end/férié par défaut. Appliqué de façon cohérente sur `/presence/today`, `/presence/today/all` et les KPI "aujourd'hui" de `/pilotage` (`getSummary`/`getPresenceByBu`).
  - Chaque employé a désormais un motif hebdomadaire récurrent (`workingDays`, défaut Lundi-Vendredi, modifiable à la création/modification) qui détermine ce "jour de travail" par employé plutôt qu'une hypothèse week-end globale ; un mandat explicite continue de primer dans les deux sens.
- **Frontend** :
  - Guard `MustChangePasswordGuard` ajouté au layout protégé.
  - Login redirige directement vers `/mon-profil` si `mustChangePassword` est vrai.
  - Les erreurs HTTP `403` applicatives ne redirigent plus vers `/login`.
  - Le layout protégé distingue maintenant une session expirée/invalide d'une API indisponible : `401/403` retourne vers `/login`, tandis qu'une erreur réseau/API down affiche `ServiceUnavailablePage`.
  - Ancienne hypothèse remplacée : la DAF ne doit plus gérer globalement les onglets ; elle doit être limitée à son périmètre département/BU.
  - Les champs relationnels vidés en admin envoient `null`.
  - `vdm_bg_image` est échappé avant injection CSS.
  - La gestion des annonces utilise maintenant un select `Actions à effectuer` par annonce.
  - Le select `Manager direct` de création/modification utilisateur liste uniquement `CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU` et `RESPONSABLE_POLE`.
  - Un rôle générique `EMPLOYE` existe pour les salariés qui ne sont ni consultants, ni stagiaires, ni prestataires.
- **Gouvernance rôles & périmètres** :
  - `CTO_ADMIN` et `PDG` sont les seuls admins globaux.
  - `CTO_ADMIN` peut gérer/modifier les comptes `CTO_ADMIN` et `PDG`; `PDG` ne peut pas modifier ces comptes ni attribuer ces rôles.
  - `DAF` est scopée sur sa BU/direction pour utilisateurs, onglets, pilotage, rapports, présence et mandats.
  - `PDG` peut créer des onglets globaux ou ciblés pour toutes les BU ; `DAF` peut créer et gérer ses propres onglets DAF si sa BU est assignée.
  - Le seed rattache `CTO` et `DAF` au `PDG` comme manager direct, tout en attribuant les onglets `DAF` à l'utilisateur `DAF`.
  - Le rattachement `businessUnitId`/`poleId` reste indépendant du rôle de responsable : un consultant, stagiaire ou prestataire peut appartenir à une BU sans obtenir de droits de gestion.
  - `EMPLOYE`, `CONSULTANT`, `STAGIAIRE` et `PRESTATAIRE` sont des rôles standards sans droits de gestion.
  - Les annonces globales sont réservées à `CTO_ADMIN` et `PDG`.
  - Les mandats de présence sont alignés : `PDG` global, `DAF` sur sa BU, responsables BU/pôle sur leur périmètre.
  - Frontend aligné sur utilisateurs, onglets, annonces, présences et sidebar.
- **Rapports DAF & annonces** :
  - `DAF` peut exporter uniquement le rapport `Présences / absences`, pour tout le personnel sans exception.
  - Les exports `activité`, `connexions` et `rapport général` sont refusés côté API pour `DAF`.
  - La bannière défilante affiche uniquement les annonces épinglées.
  - Le widget `Annonces` affiche toutes les annonces actives (épinglées en tête) dans une seule liste scrollable, widget plafonné en hauteur (`max-h-[min(60vh,26rem)]`) quel que soit le nombre d'annonces (corrigé le 2026-07-31 — auparavant limité à 3 éléments avec fallback inversé sur les épinglées, puis bloc épinglé non plafonné qui pouvait déborder de l'écran).
  - Depuis le 2026-08-03, chaque annonce du widget n'affiche plus que son titre (bouton cliquable) ; le clic ouvre une modale (`AnnouncementDetailModal`) avec tous les détails (corps complet, date, épinglage, unité d'affaires, auteur).
- **Icônes image pour onglets** :
  - Le champ `icon` accepte une image optimisée.
  - Le sélecteur d'icônes des onglets permet d'importer une image locale via le bouton `IMG`.
  - L'image est redimensionnée côté navigateur à 128px max, encodée en WebP si possible, puis affichée en `object-contain`.
- **Actualisation temps réel des annonces** :
  - Socket.IO est ajouté au backend Nest et au frontend Next.
  - Le namespace `/announcements` émet `announcements:changed` après création, modification, activation/désactivation ou suppression.
  - Le frontend écoute cet événement et recharge `/api/announcements?active=true`, puis met à jour la bannière et le widget annonces.
  - Le socket ne diffuse qu'un signal de changement ; les données restent récupérées via l'API authentifiée existante.
- **Corrections complémentaires annonces** :
  - Les annonces ciblées BU sont désormais visibles uniquement par les utilisateurs de la BU concernée, en plus des annonces globales.
  - `CTO_ADMIN` et `PDG` conservent l'accès complet à la gestion des annonces ; les autres rôles ne peuvent lire que les annonces actives de leur périmètre.
  - Création et modification valident les textes, la BU ciblée, les dates invalides et l'ordre publication/expiration.
  - La date d'expiration choisie dans le formulaire expire en fin de journée.
  - La bannière mémorise la version masquée d'une annonce : une annonce épinglée modifiée réapparaît automatiquement.
  - `LiveAnnouncements` se resynchronise aussi par intervalle de secours et au moment de l'expiration d'une annonce.
  - Le parsing CORS API/Socket.IO ignore les espaces et valeurs vides dans `CORS_ORIGINS`.

---

## 2. Validation Effectuée

- `npm run format` : OK.
- `npm run type-check --workspace=apps/api` : OK.
- `npm run type-check --workspace=apps/web` : OK.
- `npm run db:generate` : OK.
- `npx prisma validate --schema packages/database/prisma/schema.prisma` : OK.
- `npx prisma db push --schema packages/database/prisma/schema.prisma` : OK hors sandbox ; base déjà synchronisée.
- `npm run db:seed` : OK hors sandbox ; 22 utilisateurs, 7 BU, 5 pôles, 4 groupes, 22 onglets.
- `npm run build:api` : OK.
- `npm run build:web` : OK.
- `git diff --check` : OK.
- Note build Web : un cache `.next` incohérent a été nettoyé avant le dernier `npm run build:web`.
- Dernière validation web ciblée : `npm run type-check --workspace=apps/web -- --incremental false` : OK.
- Dernière validation ciblée onglets/managers/auth : `npm run type-check --workspace=apps/api`, `npm run type-check --workspace=apps/web -- --incremental false`, `npx tsc --noEmit -p packages/database/tsconfig.json`, `npx prettier --check packages/database/prisma/seed.ts apps/web/src/components/users/UsersManager.tsx apps/web/src/lib/auth.ts apps/web/src/app/(protected)/layout.tsx` et `git diff --check` : OK.
- Dernier build web propre : `rm -rf apps/web/.next`, puis `npm run build --workspace=apps/web` : OK.
- Dernière migration ciblée : enum PostgreSQL `Role` enrichi avec `EMPLOYE`; 6 comptes seed convertis en `EMPLOYE`.
- Note migration : `prisma migrate deploy` reste bloqué par l'ancienne migration échouée `20260630000001_module3_presence`; l'ajout local de `EMPLOYE` a été appliqué par SQL ciblé.
- `npm audit --omit=dev` : vulnérabilités restantes détectées dans l'arbre de dépendances ; les corrections complètes proposées incluent des upgrades majeurs Nest 11 et Next 16, à planifier séparément.
- Validation ciblée masquage IP/géolocalisation (2026-07-28) : `npx tsc --noEmit -p apps/api/tsconfig.json`, `npx tsc --noEmit -p apps/web/tsconfig.json`, `npm run format`, `rm -rf apps/web/.next` puis `npm run build:web`, `npm run build:api`, `git diff --check` : OK.
- Validation 7 nouvelles fonctionnalités (2026-07-28) : `tsc --noEmit` après chaque chantier, `npm run format`, `npm run build:api`, `npm run build:web` (build final) : OK. `npm install puppeteer --workspace=apps/api` : OK (Chromium téléchargé avec succès, ~300 Mo, dans `~/.cache/puppeteer`).
- Tests réels effectués en démarrant l'API en mode dev (`npm run dev:api`) avec des comptes seedés (mot de passe changé temporairement pour lever `mustChangePassword`, base reseedée après tests) : handshake Socket.IO `/notifications` (rejet non authentifié, réception temps réel confirmée), génération des 4 PDF, parité de permissions DAF CSV/PDF, scope de la recherche globale par rôle.
- Audit complet & corrections (2026-08-03) : `npx tsc --noEmit -p apps/api/tsconfig.json`, `npx tsc --noEmit -p apps/web/tsconfig.json --incremental false`, `npx tsc --noEmit -p packages/database/tsconfig.json`, `npx prisma validate`, `npm run db:generate`, `npm run build:api`, `rm -rf apps/web/.next` puis `npm run build:web`, `npm run format` : OK. Pas d'accès PostgreSQL dans cet environnement : migration corrective, `db push` et `db:seed` non exécutés (à faire hors sandbox avant de considérer les correctifs base de données/seed comme appliqués).
- Widget congés déplacé en widget flottant global (2026-08-06) : `npx tsc --noEmit -p apps/web/tsconfig.json`, `npx prettier --check` sur les fichiers modifiés : OK. ESLint non exécutable dans cet environnement (`next lint` demande une configuration interactive absente du repo — préexistant, sans rapport avec ce changement).
- Horaires variables & planning mensuel (2026-08-06) : `npm run build:api` OK, `npm run build:web` OK, `npx jest` (`apps/api`, nouvelle suite) 18/18 OK, `npx tsc --noEmit -p apps/api/tsconfig.json` OK.
- Onglet "Emploi du temps" & règle CTO/PDG (2026-08-06) : `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `npm run build:api` OK, `npm run build:web` OK, `npx jest` (`apps/api`) 23/23 OK, `npx prettier --write` sur les fichiers modifiés OK.
- Lien actif Sidebar & filtre BU (2026-08-06) : `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `npm run build:web` OK, `npx prettier --write` OK.
- Correctif absence marquée trop tôt/hors jour de travail (2026-08-06) : `npm run format` OK, `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npx tsc --noEmit -p apps/web/tsconfig.json` OK, `npx jest` (`apps/api`) 45/45 OK (35 préexistants + 10 nouveaux), `npm run build:api` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK, `git diff --check` OK.
- Jours de travail récurrents par employé (2026-08-06) : `npx prisma validate` OK, `npm run db:generate` OK, `npx prisma db push` OK, `npx tsc --noEmit -p apps/api/tsconfig.json` OK, `npx tsc --noEmit -p apps/web/tsconfig.json --incremental false` OK, `npx jest` (`apps/api`) 43/43 OK (35 préexistants + 8 nouveaux), `npm run build:api` OK, `rm -rf apps/web/.next` puis `npm run build:web` OK, `npm run format` OK, `git diff --check` OK.

### Notes d'Environnement

- Les commandes Prisma et seed doivent charger le `.env` racine avant exécution si elles sont lancées via workspace.
- L'accès PostgreSQL local nécessite une exécution hors sandbox dans cet environnement.
- `docker ps` : disponible dans ce shell au 2026-07-28 (le conteneur `vdm_postgres` tourne sur le port 5434) — la note précédente indiquant `docker` indisponible ne s'applique plus à cet environnement.
- Depuis le 2026-07-29, `npm run dev:api` démarre automatiquement Docker Desktop (si arrêté) et le conteneur `vdm_postgres` via le hook `predev:api` → `scripts/ensure-db.sh` ; ne plus diagnostiquer `PrismaClientInitializationError: Can't reach database server` comme un problème d'environnement avant d'avoir vérifié que ce hook s'est bien exécuté (voir sa sortie `[db] ...` dans les logs de démarrage).
- `node dist/main` (`start:prod`) échoue avec `MODULE_NOT_FOUND` après `nest build` dans cet environnement (résolution de module cassée sur les imports relatifs comme `./app.controller`) ; utiliser `npm run dev:api` (`ts-node-dev`) pour toute vérification runtime locale, non affecté par ce problème.

---

## 3. Prochaines Étapes

- Tester manuellement :
  - Connexion d'un compte seedé et redirection vers `/mon-profil`.
  - Changement de mot de passe puis accès normal aux pages protégées.
  - Accès CTO à la gestion globale des utilisateurs et onglets.
  - Accès PDG à la gestion globale des onglets pour toutes les BU, hors modification du CTO/super admin côté utilisateurs.
  - Accès DAF/directeur/responsable à la création et gestion d'onglets limitée à son département/BU.
  - Vérifier qu'un manager direct `PDG` sur `CTO` ou `DAF` ne change pas le périmètre BU des onglets.
  - Vérifier qu'une session expirée ou un cookie invalide renvoie vers `/login` au lieu de la page `Service temporairement indisponible`.
  - Vérifier que la page annonces est refusée à la DAF et accessible au CTO/PDG.
  - Vérifier que le bandeau défile uniquement avec les annonces épinglées.
  - Vérifier qu'avec un grand nombre d'annonces (épinglées et non épinglées) le widget reste plafonné en hauteur et que toute la liste défile correctement (épinglées en tête).
  - Vérifier que les actions de `/annonces` sont disponibles dans le select `Actions à effectuer`.
  - Créer/modifier un utilisateur et vérifier que `Manager direct` ne propose que CTO, PDG, DAF et responsables.
  - Créer/modifier un utilisateur avec le rôle `Employé` et vérifier qu'il reste sans droits de gestion.
  - Vérifier avec un utilisateur rattaché à une BU que les annonces d'une autre BU ne sont pas affichées.
  - Modifier une annonce épinglée déjà fermée côté utilisateur et vérifier qu'elle réapparaît dans la bannière.
  - Créer une annonce avec expiration au jour J et vérifier qu'elle reste visible jusqu'à la fin de cette journée.
  - Créer/modifier un onglet avec une image locale comme icône et vérifier son affichage dans la grille.
  - Ouvrir deux sessions, créer/modifier une annonce depuis une session admin et vérifier l'actualisation automatique du widget et de la bannière dans l'autre session.
  - Se connecter avec un compte `EMPLOYE`/`CONSULTANT`/`STAGIAIRE`/`PRESTATAIRE` et vérifier que la page "Mon historique" n'affiche plus ni la colonne IP ni la colonne adresse GPS.
  - Se connecter avec un compte responsable (`CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU`, `RESPONSABLE_POLE`) et vérifier que l'IP et la géolocalisation restent visibles là où elles l'étaient déjà (Mon historique, Pilotage, exports CSV).
  - Créer un jour férié récurrent dans `/parametres` et vérifier son affichage dans le widget calendrier et la bannière `/presences` à la date correspondante.
  - Vérifier que chaque rôle (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU, RESPONSABLE_POLE, EMPLOYE) garde exactement les mêmes accès qu'avant le refactor de `common/permissions.ts` — en particulier le refus DAF sur les rapports étendus (CSV et PDF).
  - Comparer le taux de présence hebdomadaire affiché dans la nouvelle section "Reporting hiérarchique" de `/pilotage` à une somme manuelle jour par jour pour une BU connue.
  - Consulter l'onglet "Sécurité" de `/mon-profil` avec un compte accueil et vérifier l'absence d'IP/GPS dans les connexions listées.
  - Créer un mandat pour un utilisateur connecté dans un autre onglet/navigateur et vérifier la réception immédiate de la notification (cloche) sans rafraîchir la page.
  - Télécharger un rapport en PDF depuis `/pilotage` pour un rôle CTO_ADMIN (doit réussir sur les 4 rapports) et pour un rôle DAF (doit échouer sur activité/connexions/général, comme en CSV).
  - Utiliser la recherche globale (icône dans la sidebar) avec un compte `RESPONSABLE_POLE` et vérifier qu'aucun utilisateur hors de son pôle n'apparaît dans les résultats.
  - Vérifier en production que les bibliothèques système Chromium (`libnss3`, `libatk-bridge2.0-0`, etc.) sont installées sur le VPS avant le premier déploiement post-export PDF, faute de quoi `puppeteer.launch()` échouera.
  - Supprimer une notification lue et une notification non lue depuis la cloche `NotificationsBell`, et vérifier qu'elle disparaît de la liste, que le compteur non lus se met à jour si besoin, et qu'elle ne réapparaît pas après rafraîchissement de la page.
  - Hors sandbox : appliquer la migration corrective `20260803120000_fix_schema_integrity` sur une base neuve (ou adapter/ignorer manuellement les instructions déjà couvertes par `db push` sur la base locale actuelle — renommage `createdBy`→`createdById` et ajout `isActive` sur `announcements` en particulier), puis relancer `npm run db:seed` pour vérifier que la hiérarchie `managerUsername` complétée s'applique sans erreur (le script lève une exception explicite si un `managerUsername` ne résout à aucun compte seedé).
  - Se connecter avec un compte `DAF`/`RESPONSABLE_BU`/`RESPONSABLE_POLE` et vérifier l'apparition du nouveau lien Sidebar « Utilisateurs BU »/« Utilisateurs Pôle », l'accès en lecture seule scopé à son périmètre (pas de bouton créer/modifier), et l'absence d'accès aux utilisateurs hors périmètre.
  - Vérifier que la recherche globale (icône dans la Sidebar) est bien visible et utilisable sur desktop, pas seulement sur mobile.
  - Modifier l'URL d'un onglet global existant vers une URL déjà utilisée par un autre onglet global, et vérifier qu'une erreur claire ("Cet URL existe déjà dans les onglets globaux.") est renvoyée au lieu d'une création silencieuse de doublon.
  - Provoquer un verrouillage de compte (5 échecs de connexion), puis faire réinitialiser son mot de passe par un CTO_ADMIN/PDG, et vérifier que le compte peut se reconnecter immédiatement (sans attendre l'expiration des 15 minutes de verrouillage).
  - Naviguer sur l'ensemble des pages protégées avec chaque rôle et vérifier qu'une session expirée redirige systématiquement vers `/login` (401), sans jamais le faire sur un refus applicatif (403) qui doit rester affiché sur place.
  - Vérifier que le widget flottant "Congés" apparaît bien sur des pages autres que l'accueil (ex. `/presences`, `/pilotage`), qu'il liste correctement les employés en congé du jour, que son bouton de bascule fonctionne et persiste après rafraîchissement, et que la page accueil ne l'affiche plus.
  - Créer un `ScheduleGroup` "nuit" et un "week-end" pour le Pôle TV/Radio (`/parametres`, CTO_ADMIN), puis vérifier qu'ils apparaissent comme modèles cliquables dans `/presences/planning` pour un employé de ce pôle.
  - Sur `/presences/planning`, sélectionner un `RESPONSABLE_POLE` et vérifier qu'il ne voit que les employés de son pôle dans le sélecteur, qu'il ne peut pas peindre un mois pour un employé hors périmètre (même en manipulant l'URL/la requête), et que le calendrier affiche correctement les jours déjà mandatés (arrivée/départ/pastille "Nuit").
  - Peindre une rotation jour/nuit/week-end sur un mois complet pour un même employé, puis vérifier sur `/presence/today`/`/presence/today/all` que le statut de retard est calculé correctement pour un jour de nuit (arrivée juste après minuit) — pas seulement en test unitaire.
  - Vérifier qu'un mandat créé via l'ancien formulaire simple (arrivée seule, sans heure de départ) continue de retomber correctement sur l'heure de départ du groupe/individuelle, sans régression.
  - Se connecter avec un compte `CTO_ADMIN` et vérifier que le PDG n'apparaît ni dans le sélecteur "Employé" de `/presences/planning`, ni dans celui du formulaire "Nouveau mandat", et que les boutons "Mandater"/"Supprimer" sont absents sur les lignes/mandats du PDG (sans erreur visible, juste l'action masquée).
  - Se connecter avec un compte `PDG` et vérifier qu'il peut au contraire créer, peindre un mois et supprimer un mandat du `CTO_ADMIN` sans restriction.
  - Vérifier que l'onglet "Emploi du temps" apparaît dans la Sidebar pour CTO_ADMIN, PDG, DAF, RESPONSABLE_BU, RESPONSABLE_POLE, et est absent pour EMPLOYE/CONSULTANT/STAGIAIRE/PRESTATAIRE.
  - Naviguer vers `/presences/planning` et vérifier que seul "Emploi du temps" est surligné dans la Sidebar (plus "Présences" en même temps) ; vérifier que "Présences" reste bien surligné seul sur `/presences`.
  - Sur `/presences/planning` et sur le formulaire "Nouveau mandat" (`/presences`), sélectionner une BU dans "Filtrer par BU" et vérifier que la liste "Employé" se restreint correctement, et qu'elle repasse à "Sélectionner un employé…" si l'employé précédemment choisi n'appartient plus au filtre.
  - Sur `/accueil`, se connecter un jour de semaine avant son heure d'arrivée attendue et vérifier le badge "En attente" (pas "Non enregistré"/"Absent") ; revenir après l'heure attendue sans se connecter et vérifier le badge "Non enregistré" (`ABSENT`).
  - Sur `/presences` un samedi/dimanche, vérifier que les employés sans mandat ce jour affichent "Repos" (pas "Absent"), et qu'un employé mandaté ce jour-là (rotation week-end) reste suivi normalement (peut afficher "En attente" puis "Absent"/"Présent"/"En retard" selon l'heure).
  - Naviguer vers une date passée sur `/presences` (sélecteur de date) et vérifier que les employés sans présence ce jour-là affichent directement "Absent" (jamais "En attente", le jour est terminé).
  - Créer un jour férié dans `/parametres`, puis vérifier sur `/presences` à cette date que les employés sans mandat affichent "Repos", et sur `/pilotage` que les compteurs "Repos / en attente" et "Absents" reflètent ce jour correctement (le total `Employés actifs` = Présents + En retard + En congé + Absents + Repos/en attente).
  - Comparer manuellement les compteurs de `/pilotage` (Présents/En retard/En congé/Repos-en attente/Absents) à `/presences` pour la même journée et vérifier leur cohérence.
  - Créer un employé avec un motif "Mardi-Samedi" (décocher Lundi/Dimanche, cocher Samedi) et vérifier sur `/presences` qu'il affiche "Repos" le dimanche et le lundi, et un statut normal (Présent/En retard/Absent selon l'heure) le samedi — jour normalement "Repos" par défaut pour tout le monde.
  - Vérifier qu'un employé créé sans toucher à la nouvelle section "Jours de travail récurrents" garde le motif par défaut Lundi-Vendredi et n'a aucune régression sur `/accueil`, `/presences` et les KPI `/pilotage`.
  - Décocher tous les jours d'un employé (motif entièrement vide) et vérifier via le calendrier `/presences/planning` que seuls les jours mandatés explicitement comptent comme jour de travail, tout le reste affichant "Repos".
