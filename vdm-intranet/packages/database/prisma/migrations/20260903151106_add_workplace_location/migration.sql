-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE 'WORKPLACE_LOCATION_UPDATED';

-- AlterTable
ALTER TABLE "presences" ADD COLUMN     "distanceFromWorkplaceMeters" DOUBLE PRECISION,
ADD COLUMN     "isOffSite" BOOLEAN;

-- CreateTable
CREATE TABLE "workplace_locations" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 150,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workplace_locations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "workplace_locations" ADD CONSTRAINT "workplace_locations_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

