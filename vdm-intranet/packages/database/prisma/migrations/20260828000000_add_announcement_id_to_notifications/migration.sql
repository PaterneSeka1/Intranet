-- Lie chaque notification "ANNOUNCEMENT_PUBLISHED" à son annonce d'origine, afin que la
-- suppression d'une annonce supprime automatiquement (cascade) toutes les notifications
-- qui la concernent.

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "announcementId" TEXT;

-- CreateIndex
CREATE INDEX "notifications_announcementId_idx" ON "notifications"("announcementId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
