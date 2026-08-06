-- Étend DailyMandate pour supporter des rotations de créneaux (jour/nuit/week-end) sur un même
-- mois, en plus de la simple heure d'arrivée dérogatoire déjà existante.
-- Colonnes additives, nullables : aucune donnée existante à backfiller, migration non destructive.
-- Comme pour les migrations correctives précédentes (cf. 20260803120000_fix_schema_integrity),
-- `prisma migrate deploy` reste bloqué sur une base neuve par l'historique cassé documenté dans
-- TACHE.md (0004_module4_tabs / 20260630000001_module3_presence) ; ce fichier a été appliqué en
-- local via `db push` et sert de référence pour un futur déploiement sur base neuve.

-- 1. Heure de départ dérogatoire pour ce jour (ex: mandat "nuit" isolé qui doit aussi fixer un
--    départ différent de l'horaire par défaut de l'employé).
ALTER TABLE "daily_mandates" ADD COLUMN "expectedDepartureTime" TEXT;

-- 2. Override explicite du flag nuit du groupe horaire pour ce jour précis. NULL = hérite du
--    groupe horaire de l'employé (comportement inchangé) ; `true`/`false` prime sur le groupe,
--    ce qui permet par exemple à un mandat "week-end" de désactiver explicitement le mode nuit
--    même si le groupe par défaut de l'employé est un groupe de nuit (rotation Pôle TV/Radio).
ALTER TABLE "daily_mandates" ADD COLUMN "isNightShift" BOOLEAN;
