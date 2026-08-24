import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service'

const { version } = require('../package.json') as { version: string }

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<{ status: string; timestamp: string; version: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp: new Date().toISOString(),
        version,
        detail: 'Base de données injoignable.',
      })
    }
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version,
    }
  }
}
