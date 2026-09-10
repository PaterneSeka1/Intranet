-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogAction" ADD VALUE 'TAB_CREDENTIAL_SET';
ALTER TYPE "LogAction" ADD VALUE 'TAB_CREDENTIAL_DELETED';
ALTER TYPE "LogAction" ADD VALUE 'TAB_CREDENTIAL_VIEWED';

-- CreateTable
CREATE TABLE "portal_tab_credentials" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "notes" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_tab_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_tab_credentials_tabId_key" ON "portal_tab_credentials"("tabId");

-- AddForeignKey
ALTER TABLE "portal_tab_credentials" ADD CONSTRAINT "portal_tab_credentials_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "portal_tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_tab_credentials" ADD CONSTRAINT "portal_tab_credentials_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
