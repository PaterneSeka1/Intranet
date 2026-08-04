import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { PresenceModule } from './presence/presence.module'
import { TabsModule } from './tabs/tabs.module'
import { PilotageModule } from './pilotage/pilotage.module'
import { ReportsModule } from './reports/reports.module'
import { AnnouncementsModule } from './announcements/announcements.module'
import { SettingsModule } from './settings/settings.module'
import { PublicHolidaysModule } from './public-holidays/public-holidays.module'
import { NotificationsModule } from './notifications/notifications.module'
import { SearchModule } from './search/search.module'
import { LeavesModule } from './leaves/leaves.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    PresenceModule,
    TabsModule,
    PilotageModule,
    ReportsModule,
    AnnouncementsModule,
    SettingsModule,
    PublicHolidaysModule,
    NotificationsModule,
    SearchModule,
    LeavesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
