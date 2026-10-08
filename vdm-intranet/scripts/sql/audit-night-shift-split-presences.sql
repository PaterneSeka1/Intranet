-- ============================================================================
-- Audit — présences d'équipe de nuit découpées en deux (lecture seule)
-- ============================================================================
-- Contexte : avant le correctif "date de poste" (PresenceScheduleService.resolveShiftDate),
-- la présence était rattachée à la date UTC du calendrier. Un employé de nuit arrivé la veille
-- vers 22h, puis reconnecté après minuit (jeton expiré au bout de 8h), recevait une SECONDE
-- présence le lendemain : arrivée à 00h0x (faux retard), puis départ du matin enregistré sur
-- celle-ci, laissant la vraie présence de 22h sans départ.
--
-- Ce script ne modifie RIEN (transaction READ ONLY). Il liste :
--   1. les paires de présences consécutives qui correspondent à ce découpage ;
--   2. les présences de nuit restées sans départ (départ refusé "Aucune arrivée enregistrée").
--
-- Usage (sur le VPS) :
--   psql "$DATABASE_URL" -f scripts/sql/audit-night-shift-split-presences.sql
-- Pour un export CSV, remplacer la requête voulue par \copy (...) TO 'fichier.csv' CSV HEADER.
--
-- Limites :
--   - "nuit" = flag du mandat du jour s'il existe, sinon flag du groupe ACTUEL de l'employé
--     (un employé ayant changé de groupe depuis peut être manqué ou remonté à tort) ;
--   - les heures sont en UTC (= heure d'Abidjan).
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

-- Fenêtre d'analyse : à ajuster si besoin.
\set since '''2026-01-01'''

-- ----------------------------------------------------------------------------
-- 1. Postes de nuit découpés : présence J (arrivée le soir) + présence J+1
--    (arrivée après minuit, moins de 18h plus tard).
-- ----------------------------------------------------------------------------
WITH night_presences AS (
  SELECT
    p.*,
    COALESCE(m."isNightShift", g."isNightShift", false) AS is_night
  FROM presences p
  JOIN users u ON u.id = p."userId"
  LEFT JOIN schedule_groups g ON g.id = u."scheduleGroupId"
  LEFT JOIN daily_mandates m ON m."userId" = p."userId" AND m.date = p.date
  WHERE p.date >= :since::date
)
SELECT
  u.matricule,
  COALESCE(u."fullName", u."firstName" || ' ' || u."lastName")          AS employe,
  g.name                                                                 AS groupe,
  evening.date                                                           AS date_presence_soir,
  evening.id                                                             AS id_presence_soir,
  to_char(evening."officialArrivalTime", 'YYYY-MM-DD HH24:MI')           AS arrivee_reelle,
  to_char(evening."officialDepartureTime", 'YYYY-MM-DD HH24:MI')         AS depart_soir_enregistre,
  night.date                                                             AS date_presence_doublon,
  night.id                                                               AS id_presence_doublon,
  to_char(night."officialArrivalTime", 'YYYY-MM-DD HH24:MI')             AS arrivee_doublon,
  night.status                                                           AS statut_doublon,
  night."delayMinutes"                                                   AS retard_doublon_min,
  to_char(night."officialDepartureTime", 'YYYY-MM-DD HH24:MI')           AS depart_reel,
  -- Heures comptées aujourd'hui (doublon seul) vs heures réelles du poste (soir → départ).
  round(extract(epoch FROM night."officialDepartureTime" - night."officialArrivalTime") / 3600.0, 2)
                                                                         AS heures_comptees_doublon,
  round(extract(epoch FROM night."officialDepartureTime" - evening."officialArrivalTime") / 3600.0, 2)
                                                                         AS heures_reelles_poste
FROM night_presences evening
JOIN night_presences night
  ON night."userId" = evening."userId"
 AND night.date = evening.date + 1
JOIN users u ON u.id = evening."userId"
LEFT JOIN schedule_groups g ON g.id = u."scheduleGroupId"
WHERE (evening.is_night OR night.is_night)
  AND extract(hour FROM evening."officialArrivalTime") >= 12
  AND extract(hour FROM night."officialArrivalTime") < 12
  AND night."officialArrivalTime" - evening."officialArrivalTime" < interval '18 hours'
ORDER BY evening.date DESC, employe;

-- ----------------------------------------------------------------------------
-- 2. Présences de nuit sans départ (jour déjà terminé) — inclut les départs refusés
--    faute de présence à la date du lendemain.
-- ----------------------------------------------------------------------------
SELECT
  u.matricule,
  COALESCE(u."fullName", u."firstName" || ' ' || u."lastName")  AS employe,
  g.name                                                         AS groupe,
  p.date,
  p.id                                                           AS id_presence,
  to_char(p."officialArrivalTime", 'YYYY-MM-DD HH24:MI')         AS arrivee,
  p.status,
  p."delayMinutes"                                               AS retard_min
FROM presences p
JOIN users u ON u.id = p."userId"
LEFT JOIN schedule_groups g ON g.id = u."scheduleGroupId"
LEFT JOIN daily_mandates m ON m."userId" = p."userId" AND m.date = p.date
WHERE p.date >= :since::date
  AND p.date < current_date - 1
  AND p."officialDepartureTime" IS NULL
  AND COALESCE(m."isNightShift", g."isNightShift", false)
ORDER BY p.date DESC, employe;

ROLLBACK;
