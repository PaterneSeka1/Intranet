-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "hiddenAt" TIMESTAMP(3);
