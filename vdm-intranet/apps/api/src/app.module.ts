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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    PresenceModule,
    TabsModule,
    PilotageModule,
    ReportsModule,
    AnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
