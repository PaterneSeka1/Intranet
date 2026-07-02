-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PDG', 'CTO_ADMIN', 'DAF', 'RESPONSABLE_BU', 'RESPONSABLE_POLE', 'CONSULTANT', 'STAGIAIRE', 'PRESTATAIRE');

-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "ConnectionLogType" AS ENUM ('LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('LOGIN', 'LOGOUT', 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'GEOLOCATION', 'TAB_CREATED', 'TAB_UPDATED', 'TAB_DELETED', 'TAB_ENABLED', 'TAB_DISABLED', 'REPORT_EXPORTED', 'PRESENCE_REPORT_EXPORTED', 'ACTIVITY_REPORT_EXPORTED', 'CONNECTION_REPORT_EXPORTED', 'GENERAL_REPORT_EXPORTED');

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "expectedArrivalTime" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "poleId" TEXT,
    "isNightShift" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "role" "Role" NOT NULL,
    "businessUnitId" TEXT,
    "poleId" TEXT,
    "managerId" TEXT,
    "scheduleGroupId" TEXT,
    "individualExpectedArrivalTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "PresenceStatus" NOT NULL,
    "expectedArrivalTime" TEXT NOT NULL,
    "officialArrivalTime" TIMESTAMP(3),
    "delayMinutes" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "address" TEXT,
    "mapsUrl" TEXT,
    "sourceConnectionLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConnectionLogType" NOT NULL,
    "date" DATE NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "address" TEXT,
    "mapsUrl" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isFirstConnectionOfDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_mandates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "expectedArrivalTime" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_tabs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "businessUnitId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "LogAction" NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_units_name_key" ON "business_units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_code_key" ON "business_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "poles_code_key" ON "poles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_groups_code_key" ON "schedule_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "presences_userId_date_key" ON "presences"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_mandates_userId_date_key" ON "daily_mandates"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "portal_tabs_businessUnitId_url_key" ON "portal_tabs"("businessUnitId", "url");

-- AddForeignKey
ALTER TABLE "poles" ADD CONSTRAINT "poles_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_groups" ADD CONSTRAINT "schedule_groups_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_groups" ADD CONSTRAINT "schedule_groups_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "poles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "poles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_scheduleGroupId_fkey" FOREIGN KEY ("scheduleGroupId") REFERENCES "schedule_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_logs" ADD CONSTRAINT "connection_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_mandates" ADD CONSTRAINT "daily_mandates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_mandates" ADD CONSTRAINT "daily_mandates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_tabs" ADD CONSTRAINT "portal_tabs_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_tabs" ADD CONSTRAINT "portal_tabs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

