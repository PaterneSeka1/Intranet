import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export type SettingPair = { key: string; value: string }

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getAll(): Promise<SettingPair[]> {
    return this.prisma.appSetting.findMany({ select: { key: true, value: true } })
  }

  async upsertMany(settings: SettingPair[]): Promise<SettingPair[]> {
    await this.prisma.$transaction(
      settings.map(({ key, value }) =>
        this.prisma.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    )
    return this.getAll()
  }

  deleteKey(key: string) {
    return this.prisma.appSetting.deleteMany({ where: { key } })
  }
}
