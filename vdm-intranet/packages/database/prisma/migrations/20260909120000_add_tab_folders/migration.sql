-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogAction" ADD VALUE 'TAB_REORDERED';
ALTER TYPE "LogAction" ADD VALUE 'TAB_FOLDER_CREATED';
ALTER TYPE "LogAction" ADD VALUE 'TAB_FOLDER_UPDATED';
ALTER TYPE "LogAction" ADD VALUE 'TAB_FOLDER_DELETED';
ALTER TYPE "LogAction" ADD VALUE 'TAB_FOLDER_REORDERED';

-- AlterTable
ALTER TABLE "portal_tabs" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "portal_tab_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "businessUnitId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_tab_folders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "portal_tabs" ADD CONSTRAINT "portal_tabs_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "portal_tab_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_tab_folders" ADD CONSTRAINT "portal_tab_folders_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_tab_folders" ADD CONSTRAINT "portal_tab_folders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

