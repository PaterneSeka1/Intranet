import { ServiceUnavailableException } from '@nestjs/common'
import { AppService } from './app.service'
import type { PrismaService } from './prisma/prisma.service'

describe('AppService — health check', () => {
  it('renvoie status "ok" quand la base de données répond', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const service = new AppService(prisma as unknown as PrismaService)

    const result = await service.health()

    expect(result.status).toBe('ok')
    expect(typeof result.version).toBe('string')
    expect(prisma.$queryRaw).toHaveBeenCalled()
  })

  it('lève une ServiceUnavailableException quand la base de données est injoignable', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')) }
    const service = new AppService(prisma as unknown as PrismaService)

    await expect(service.health()).rejects.toThrow(ServiceUnavailableException)
  })
})
