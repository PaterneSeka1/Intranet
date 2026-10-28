-- ============================================================================
-- Correction — présences de l'équipe de nuit (poste de 00:00) saisies en horaire individuel
-- ============================================================================
-- Contexte : l'équipe de nuit arrive la veille vers 22h pour le poste de 00:00 du lendemain
-- (arrivée lundi 22h = poste du mardi). Ses membres avaient un horaire INDIVIDUEL 00:00 → 09:00,
-- or les horaires individuels n'ont jamais de mode nuit (PresenceScheduleService.resolveShiftDate) :
--   - l'arrivée du soir créait une présence à la date du soir (retard ~ +1 380 min) ;
--   - la reconnexion du matin (jeton expiré) créait une seconde présence le lendemain
--     (retard ~ +450 à +600 min), portant le départ ;
--   - en semaine, l'arrivée de 22h tombait sur la présence du jour déjà existante et était perdue.
--
-- Ce script reconstruit UNE présence par poste, avec la même règle que resolveShiftDate pour un
-- poste de 00:00 (date de poste = minuit le plus proche) :
--   - arrivée = premier pointage du poste, parmi les arrivées enregistrées et les connexions
--     (LOGIN entre 18:00 et 06:00) du journal connection_logs, qui conserve les arrivées perdues ;
--   - départ  = dernier départ enregistré rattaché au poste ;
--   - heure attendue 00:00 / départ 09:00, retard et statut recalculés (tolérance 15 min,
--     PRESENCE_LATE_TOLERANCE_MINUTES en prod au 2026-10-28).
--
-- Prérequis : affecter d'abord ces employés au groupe de nuit "Nuit — 00h00" (NUIT_0000), sinon
-- l'application recréera des présences découpées dès la prochaine nuit.
--
-- Usage (sur le VPS) — SIMULATION par défaut (aperçu puis ROLLBACK, rien n'est modifié) :
--   psql "$DATABASE_URL" -f scripts/sql/fix-night-shift-presences.sql
-- Application réelle (après validation de l'aperçu et sauvegarde de la base) :
--   psql "$DATABASE_URL" -v apply=1 -f scripts/sql/fix-night-shift-presences.sql
--
-- Limites :
--   - une arrivée reconstruite depuis le journal de connexions reprend sa géolocalisation, mais
--     pas le contrôle "hors site" (isOffSite / distance laissés vides) ;
--   - les heures sont en UTC (= heure d'Abidjan) ;
--   - les postes postérieurs à aujourd'hui ne sont pas touchés (gérés par l'application).
-- ============================================================================

\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif

BEGIN;

-- Fenêtre et employés concernés : à ajuster si besoin.
\set since '''2026-10-01'''
\set matricules '''038'', ''051'', ''056'', ''024'''
\set tolerance 15

CREATE TEMP TABLE night_users ON COMMIT DROP AS
SELECT u.id AS user_id, u.matricule, COALESCE(u."fullName", u."firstName" || ' ' || u."lastName") AS employe
FROM users u
WHERE u.matricule IN (:matricules);

-- Présences existantes rattachées (par leur heure d'arrivée) à un poste de la fenêtre.
CREATE TEMP TABLE old_rows ON COMMIT DROP AS
SELECT p.*,
       (p."officialArrivalTime" + interval '12 hours')::date   AS arrival_shift,
       (p."officialDepartureTime" + interval '12 hours')::date AS departure_shift
FROM presences p
JOIN night_users n ON n.user_id = p."userId"
WHERE (p."officialArrivalTime" + interval '12 hours')::date BETWEEN :since::date AND current_date;

-- Candidats d'arrivée : arrivées enregistrées + connexions de soirée/nuit du journal.
CREATE TEMP TABLE arrival_candidates ON COMMIT DROP AS
SELECT o."userId" AS user_id, o.arrival_shift AS shift_date, o."officialArrivalTime" AS arrived_at,
       0 AS priority, o.id AS presence_id, NULL::text AS log_id
FROM old_rows o
UNION ALL
SELECT c."userId", (c."connectedAt" + interval '12 hours')::date, c."connectedAt",
       1, NULL, c.id
FROM connection_logs c
JOIN night_users n ON n.user_id = c."userId"
WHERE c.type = 'LOGIN'
  AND (c."connectedAt"::time >= time '18:00' OR c."connectedAt"::time < time '06:00')
  AND (c."connectedAt" + interval '12 hours')::date BETWEEN :since::date AND current_date;

-- Une ligne par poste : arrivée la plus tôt (à égalité, la présence enregistrée prime).
CREATE TEMP TABLE first_arrival ON COMMIT DROP AS
SELECT DISTINCT ON (user_id, shift_date) *
FROM arrival_candidates
ORDER BY user_id, shift_date, arrived_at, priority;

-- Départ le plus tardif rattaché au poste.
CREATE TEMP TABLE last_departure ON COMMIT DROP AS
SELECT DISTINCT ON ("userId", departure_shift)
       "userId" AS user_id, departure_shift AS shift_date, id AS presence_id, "officialDepartureTime"
FROM old_rows
WHERE "officialDepartureTime" IS NOT NULL
ORDER BY "userId", departure_shift, "officialDepartureTime" DESC;

CREATE TEMP TABLE new_rows ON COMMIT DROP AS
WITH base AS (
  SELECT a.user_id, a.shift_date, a.arrived_at, a.presence_id AS arrival_presence_id, a.log_id,
         -- id conservé seulement si une présence est déjà datée du poste (sinon nouvel id) : une
         -- présence ne peut ainsi jamais être réutilisée pour deux postes.
         COALESCE(
           (SELECT o.id FROM old_rows o WHERE o."userId" = a.user_id AND o.date = a.shift_date),
           'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)
         ) AS keep_id,
         (extract(epoch FROM date_trunc('minute', a.arrived_at) - a.shift_date::timestamp) / 60)::int AS delay
  FROM first_arrival a
)
SELECT
  b.keep_id                                                         AS id,
  b.user_id                                                         AS "userId",
  b.shift_date                                                      AS date,
  (CASE WHEN b.delay > :tolerance THEN 'LATE' ELSE 'PRESENT' END)::"PresenceStatus" AS status,
  '00:00'::text                                                     AS "expectedArrivalTime",
  b.arrived_at                                                      AS "officialArrivalTime",
  CASE WHEN b.delay > 0 THEN b.delay END                            AS "delayMinutes",
  '09:00'::text                                                     AS "expectedDepartureTime",
  d."officialDepartureTime",
  (extract(epoch FROM date_trunc('minute', d."officialDepartureTime")
                      - (b.shift_date + time '09:00')) / 60)::int   AS "departureDelayMinutes",
  COALESCE(ap.latitude, cl.latitude)                                AS latitude,
  COALESCE(ap.longitude, cl.longitude)                              AS longitude,
  COALESCE(ap.accuracy, cl.accuracy)                                AS accuracy,
  COALESCE(ap.address, cl.address)                                  AS address,
  COALESCE(ap."mapsUrl", cl."mapsUrl")                              AS "mapsUrl",
  dp."departureLatitude", dp."departureLongitude", dp."departureAccuracy",
  dp."departureAddress", dp."departureMapsUrl",
  ap."isOffSite",
  ap."distanceFromWorkplaceMeters",
  COALESCE(ap."sourceConnectionLogId", b.log_id)                    AS "sourceConnectionLogId",
  COALESCE(kp."createdAt", now())                                   AS "createdAt",
  now()                                                             AS "updatedAt"
FROM base b
LEFT JOIN old_rows ap ON ap.id = b.arrival_presence_id
LEFT JOIN connection_logs cl ON cl.id = b.log_id
LEFT JOIN last_departure d ON d.user_id = b.user_id AND d.shift_date = b.shift_date
LEFT JOIN old_rows dp ON dp.id = d.presence_id
LEFT JOIN old_rows kp ON kp.id = b.keep_id;

-- ----------------------------------------------------------------------------
-- Aperçu : un poste par ligne, avant → après.
-- ----------------------------------------------------------------------------
SELECT
  n.matricule,
  n.employe,
  r.date                                                       AS poste,
  to_char(r.date, 'TMDy')                                      AS jour,
  (SELECT string_agg(to_char(o.date, 'MM-DD') || ' ' || to_char(o."officialArrivalTime", 'HH24:MI')
                     || ' ' || o.status || COALESCE(' +' || o."delayMinutes", ''), ' ; ' ORDER BY o.date)
     FROM old_rows o
    WHERE o."userId" = r."userId"
      AND (o.arrival_shift = r.date OR o.departure_shift = r.date)) AS avant,
  to_char(r."officialArrivalTime", 'MM-DD HH24:MI')            AS arrivee,
  r.status,
  r."delayMinutes"                                             AS retard_min,
  to_char(r."officialDepartureTime", 'MM-DD HH24:MI')          AS depart,
  CASE WHEN EXISTS (SELECT 1 FROM old_rows o WHERE o.id = r.id) THEN 'mise à jour' ELSE 'créée' END
                                                               AS action
FROM new_rows r
JOIN night_users n ON n.user_id = r."userId"
ORDER BY n.employe, r.date;

-- Présences supprimées (fusionnées dans un autre poste).
SELECT n.employe, o.date, o.id, to_char(o."officialArrivalTime", 'MM-DD HH24:MI') AS arrivee, o.status
FROM old_rows o
JOIN night_users n ON n.user_id = o."userId"
WHERE o.id NOT IN (SELECT id FROM new_rows)
ORDER BY n.employe, o.date;

SELECT
  (SELECT count(*) FROM old_rows)                                 AS presences_avant,
  (SELECT count(*) FROM new_rows)                                 AS postes_apres,
  (SELECT count(*) FROM old_rows WHERE status = 'LATE')           AS retards_avant,
  (SELECT count(*) FROM new_rows WHERE status = 'LATE')           AS retards_apres;

-- ----------------------------------------------------------------------------
-- Écriture : remplacement des présences de la fenêtre par les postes reconstruits.
-- ----------------------------------------------------------------------------
DELETE FROM presences WHERE id IN (SELECT id FROM old_rows);
INSERT INTO presences (
  id, "userId", date, status, "expectedArrivalTime", "officialArrivalTime", "delayMinutes",
  "expectedDepartureTime", "officialDepartureTime", "departureDelayMinutes",
  latitude, longitude, accuracy, address, "mapsUrl",
  "departureLatitude", "departureLongitude", "departureAccuracy", "departureAddress", "departureMapsUrl",
  "isOffSite", "distanceFromWorkplaceMeters", "sourceConnectionLogId", "createdAt", "updatedAt"
)
SELECT
  id, "userId", date, status, "expectedArrivalTime", "officialArrivalTime", "delayMinutes",
  "expectedDepartureTime", "officialDepartureTime", "departureDelayMinutes",
  latitude, longitude, accuracy, address, "mapsUrl",
  "departureLatitude", "departureLongitude", "departureAccuracy", "departureAddress", "departureMapsUrl",
  "isOffSite", "distanceFromWorkplaceMeters", "sourceConnectionLogId", "createdAt", "updatedAt"
FROM new_rows;

\if :apply
  \echo '>>> Modifications appliquées (COMMIT).'
  COMMIT;
\else
  \echo '>>> SIMULATION : rien n''a été modifié (ROLLBACK). Relancer avec -v apply=1 pour appliquer.'
  ROLLBACK;
\endif
