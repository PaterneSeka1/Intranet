-- CreateTable
CREATE TABLE "portal_tab_shares" (
    "tabId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_tab_shares_pkey" PRIMARY KEY ("tabId","businessUnitId")
);

-- CreateIndex
CREATE INDEX "portal_tab_shares_businessUnitId_idx" ON "portal_tab_shares"("businessUnitId");

-- AddForeignKey
ALTER TABLE "portal_tab_shares" ADD CONSTRAINT "portal_tab_shares_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "portal_tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_tab_shares" ADD CONSTRAINT "portal_tab_shares_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "portal_tab_folder_shares" (
    "folderId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_tab_folder_shares_pkey" PRIMARY KEY ("folderId","businessUnitId")
);

-- CreateIndex
CREATE INDEX "portal_tab_folder_shares_businessUnitId_idx" ON "portal_tab_folder_shares"("businessUnitId");

-- AddForeignKey
ALTER TABLE "portal_tab_folder_shares" ADD CONSTRAINT "portal_tab_folder_shares_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "portal_tab_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_tab_folder_shares" ADD CONSTRAINT "portal_tab_folder_shares_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
