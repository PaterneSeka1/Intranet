-- Corrige des écarts entre l'historique des migrations trackées et le schéma Prisma actuel.
-- Ces écarts existent car les évolutions récentes ont été appliquées en local via `db push`
-- (cf. TACHE.md) plutôt que par migration : ce fichier aligne la définition SQL pour qu'un
-- futur `migrate deploy` sur une base neuve reste cohérent avec `schema.prisma` à partir d'ici.

-- 1. Table "announcements" (créée par 0004_module4_tabs) : la colonne s'appelait "createdBy"
--    au lieu de "createdById" (nom attendu par le client Prisma, aucun @map déclaré), la colonne
--    "isActive" n'existait pas du tout, et aucune contrainte de clé étrangère n'avait été posée
--    (contrairement à "portal_tabs" dans la même migration).
ALTER TABLE "announcements" RENAME COLUMN "createdBy" TO "createdById";
ALTER TABLE "announcements" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_businessUnitId_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Enum "Role" : `EMPLOYE` avait été ajouté en fin d'enum physique par
--    `20260727000000_add_employe_role` (ALTER TYPE ... ADD VALUE, sans BEFORE/AFTER), alors que
--    schema.prisma le déclare entre RESPONSABLE_POLE et CONSULTANT. On recrée le type dans le bon
--    ordre : nécessaire pour tout tri qui s'appuierait sur l'ordre physique de l'enum PostgreSQL.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('PDG', 'CTO_ADMIN', 'DAF', 'RESPONSABLE_BU', 'RESPONSABLE_POLE', 'EMPLOYE', 'CONSULTANT', 'STAGIAIRE', 'PRESTATAIRE');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";

-- 3. FK manquante pour Presence.sourceConnectionLogId -> ConnectionLog : ce champ existait comme
--    simple colonne texte sans intégrité référentielle depuis sa création.
ALTER TABLE "presences" ADD CONSTRAINT "presences_sourceConnectionLogId_fkey"
  FOREIGN KEY ("sourceConnectionLogId") REFERENCES "connection_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
