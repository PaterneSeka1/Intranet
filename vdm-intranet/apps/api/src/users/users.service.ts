import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { Role } from '@prisma/client'

const SAFE_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  scheduleGroupId: true,
  individualExpectedArrivalTime: true,
  businessUnit: { select: { id: true, name: true, code: true } },
  pole: { select: { id: true, name: true, code: true } },
  manager: { select: { id: true, username: true, fullName: true } },
} as const

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(requester: Requester) {
    const where = this.scopeWhere(requester)
    return this.prisma.user.findMany({
      where,
      select: SAFE_SELECT,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      take: 500,
    })
  }

  async findOne(id: string, requester?: Requester) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    if (requester) {
      const where = this.scopeWhere(requester)
      const inScope = Object.keys(where).length === 0 ||
        ('businessUnitId' in where && user.businessUnit?.id === where.businessUnitId) ||
        ('poleId' in where && (user as { pole?: { id: string } }).pole?.id === where.poleId) ||
        ('id' in where && user.id === where.id)
      if (!inScope) throw new NotFoundException('Utilisateur introuvable')
    }
    return user
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12)
    const fullName = [dto.firstName, dto.lastName].filter(Boolean).join(' ')
    const { password, ...rest } = dto
    return this.prisma.user.create({
      data: { ...rest, passwordHash, fullName },
      select: SAFE_SELECT,
    })
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = { ...dto }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12)
      delete data.password
    }

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const current = await this.prisma.user.findUnique({
        where: { id },
        select: { firstName: true, lastName: true },
      })
      data.fullName = [
        dto.firstName ?? current?.firstName,
        dto.lastName ?? current?.lastName,
      ].filter(Boolean).join(' ')
    }

    try {
      const updated = await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT })
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') throw new NotFoundException('Utilisateur introuvable.')
      throw err
    }
  }

  async updateMe(id: string, dto: UpdateUserDto) {
    const allowed: (keyof UpdateUserDto)[] = ['firstName', 'lastName', 'email', 'password']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (dto[key] !== undefined) data[key] = dto[key]
    }
    if (data.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Le mot de passe actuel est requis pour effectuer ce changement.')
      }
      const current = await this.prisma.user.findUnique({ where: { id }, select: { passwordHash: true } })
      if (!current) throw new NotFoundException('Utilisateur introuvable.')
      const valid = await bcrypt.compare(dto.currentPassword, current.passwordHash)
      if (!valid) {
        throw new BadRequestException('Mot de passe actuel incorrect.')
      }
      data.passwordHash = await bcrypt.hash(data.password as string, 12)
      delete data.password
    }
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const current = await this.prisma.user.findUnique({
        where: { id },
        select: { firstName: true, lastName: true },
      })
      data.fullName = [
        (data.firstName as string | undefined) ?? current?.firstName,
        (data.lastName as string | undefined) ?? current?.lastName,
      ].filter(Boolean).join(' ')
    }
    try {
      return await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT })
    } catch (err: unknown) {
      if (
        typeof err === 'object' && err !== null && 'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Cette adresse e-mail est déjà utilisée par un autre compte.')
      }
      throw err
    }
  }

  async setActive(id: string, isActive: boolean) {
    try {
      return await this.prisma.user.update({ where: { id }, data: { isActive }, select: SAFE_SELECT })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') throw new NotFoundException('Utilisateur introuvable.')
      throw err
    }
  }

  private scopeWhere(requester: Requester) {
    const { role, businessUnitId, poleId, id } = requester
    if (([Role.CTO_ADMIN, Role.PDG, Role.DAF] as Role[]).includes(role)) return {}
    if (role === Role.RESPONSABLE_BU && businessUnitId) return { businessUnitId }
    if (role === Role.RESPONSABLE_POLE && poleId) return { poleId }
    return { id }
  }
}
