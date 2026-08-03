export { PrismaClient } from '@prisma/client'
export type {
  User,
  BusinessUnit,
  Pole,
  ScheduleGroup,
  DailyMandate,
  Presence,
  ConnectionLog,
  PortalTab,
  Announcement,
  ActivityLog,
  PublicHoliday,
  Notification,
  Role,
  PresenceStatus,
  ConnectionLogType,
  LogAction,
  NotificationType,
} from '@prisma/client'

import { PrismaClient } from '@prisma/client'

// Singleton Prisma client (évite les connexions multiples en dev)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['warn', 'error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
