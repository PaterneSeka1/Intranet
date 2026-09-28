-- Audience symétrique des onglets et dossiers : on remplace "BU propriétaire (businessUnitId) +
-- BU destinataires (*_shares)" par une simple liste de BU concernées, ou isGlobal. Les données
-- existantes sont converties (propriétaire + destinataires -> liste) avant suppression des
-- anciennes colonnes et tables.

-- CreateTable
CREATE TABLE "portal_tab_business_units" (
    "tabId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_tab_business_units_pkey" PRIMARY KEY ("tabId","businessUnitId")
);

-- CreateTable
CREATE TABLE "portal_tab_folder_business_units" (
    "folderId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_tab_folder_business_units_pkey" PRIMARY KEY ("folderId","businessUnitId")
);

-- AlterTable
ALTER TABLE "portal_tabs" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "portal_tab_folders" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- Conversion des dossiers : global si pas de BU, sinon BU d'origine + BU destinataires.
UPDATE "portal_tab_folders" SET "isGlobal" = true WHERE "businessUnitId" IS NULL;

INSERT INTO "portal_tab_folder_business_units" ("folderId", "businessUnitId")
SELECT "id", "businessUnitId" FROM "portal_tab_folders" WHERE "businessUnitId" IS NOT NULL
UNION
SELECT "folderId", "businessUnitId" FROM "portal_tab_folder_shares";

-- Conversion des onglets hors dossier : même règle. Un onglet rangé dans un dossier hérite
-- désormais de l'audience du dossier (même BU d'origine, par construction) : il ne garde aucune
-- audience propre.
UPDATE "portal_tabs" SET "isGlobal" = true WHERE "businessUnitId" IS NULL AND "folderId" IS NULL;

INSERT INTO "portal_tab_business_units" ("tabId", "businessUnitId")
SELECT "id", "businessUnitId" FROM "portal_tabs"
WHERE "businessUnitId" IS NOT NULL AND "folderId" IS NULL
UNION
SELECT s."tabId", s."businessUnitId" FROM "portal_tab_shares" s
JOIN "portal_tabs" t ON t."id" = s."tabId"
WHERE t."folderId" IS NULL;

-- Onglet rangé dans un dossier et partagé en direct avec d'autres BU : ces BU s'ajoutent à
-- l'audience du dossier plutôt que de perdre l'accès.
INSERT INTO "portal_tab_folder_business_units" ("folderId", "businessUnitId")
SELECT DISTINCT t."folderId", s."businessUnitId" FROM "portal_tab_shares" s
JOIN "portal_tabs" t ON t."id" = s."tabId"
WHERE t."folderId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "portal_tabs" DROP CONSTRAINT "portal_tabs_businessUnitId_fkey";
ALTER TABLE "portal_tab_folders" DROP CONSTRAINT "portal_tab_folders_businessUnitId_fkey";

-- DropIndex
DROP INDEX "portal_tabs_businessUnitId_url_key";

-- AlterTable
ALTER TABLE "portal_tabs" DROP COLUMN "businessUnitId";
ALTER TABLE "portal_tab_folders" DROP COLUMN "businessUnitId";

-- DropTable
DROP TABLE "portal_tab_shares";
DROP TABLE "portal_tab_folder_shares";

-- CreateIndex
CREATE INDEX "portal_tab_business_units_businessUnitId_idx" ON "portal_tab_business_units"("businessUnitId");
CREATE INDEX "portal_tab_folder_business_units_businessUnitId_idx" ON "portal_tab_folder_business_units"("businessUnitId");
CREATE INDEX "portal_tabs_folderId_idx" ON "portal_tabs"("folderId");

-- AddForeignKey
ALTER TABLE "portal_tab_business_units" ADD CONSTRAINT "portal_tab_business_units_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "portal_tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_tab_business_units" ADD CONSTRAINT "portal_tab_business_units_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_tab_folder_business_units" ADD CONSTRAINT "portal_tab_folder_business_units_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "portal_tab_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_tab_folder_business_units" ADD CONSTRAINT "portal_tab_folder_business_units_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
