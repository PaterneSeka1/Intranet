import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { Role } from '@prisma/client'
import {
  CAN_MANAGE_USERS,
  CAN_MANAGE_USERS_BU_SCOPE,
  CAN_MANAGE_USERS_SCOPED_WRITE,
  PROTECTED_ADMIN_ROLES,
} from '../common/permissions'

/** Champs administratifs qu'un manager scopé (DAF/RESPONSABLE_BU) peut corriger. */
const SCOPED_ADMIN_FIELDS = ['firstName', 'lastName', 'email', 'password'] as const

/** Champs de planning qu'un manager scopé (DAF/RESPONSABLE_BU/RESPONSABLE_POLE) peut ajuster. */
const SCOPED_SCHEDULE_FIELDS = [
  'scheduleGroupId',
  'individualExpectedArrivalTime',
  'individualExpectedDepartureTime',
  'workingDays',
] as const

/** Rôles qu'un manager scopé ne peut jamais gérer via l'action scopée (pairs/supérieurs). */
const SCOPED_WRITE_FORBIDDEN_TARGET_ROLES: Role[] = [
  Role.CTO_ADMIN,
  Role.PDG,
  Role.DAF,
  Role.RESPONSABLE_BU,
]

const SAFE_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  scheduleGroupId: true,
  individualExpectedArrivalTime: true,
  individualExpectedDepartureTime: true,
  workingDays: true,
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
      const inScope =
        Object.keys(where).length === 0 ||
        ('businessUnitId' in where && user.businessUnit?.id === where.businessUnitId) ||
        ('poleId' in where && (user as { pole?: { id: string } }).pole?.id === where.poleId) ||
        ('id' in where && user.id === where.id)
      if (!inScope) throw new NotFoundException('Utilisateur introuvable')
    }
    return user
  }

  async create(dto: CreateUserDto, requester: Requester) {
    this.assertCanCreateRole(requester, dto.role)

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const fullName = [dto.firstName, dto.lastName].filter(Boolean).join(' ')
    const { password, ...rest } = dto
    if (rest.workingDays !== undefined) {
      rest.workingDays = this.normalizeWorkingDays(rest.workingDays)
    }
    try {
      return await this.prisma.user.create({
        data: { ...rest, passwordHash, fullName, mustChangePassword: true },
        select: SAFE_SELECT,
      })
    } catch (err: unknown) {
      if (isPrismaCode(err, 'P2002')) {
        throw new BadRequestException('Identifiant ou adresse e-mail déjà utilisé.')
      }
      throw err
    }
  }

  async update(id: string, dto: UpdateUserDto, requester: Requester) {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, firstName: true, lastName: true },
    })
    if (!current) throw new NotFoundException('Utilisateur introuvable.')
    this.assertCanManageTarget(requester, current.role, dto.role)

    const data: Record<string, unknown> = { ...dto }
    delete data.currentPassword

    if (dto.workingDays !== undefined) {
      data.workingDays = this.normalizeWorkingDays(dto.workingDays)
    }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12)
      data.mustChangePassword = true
      data.failedLoginAttempts = 0
      data.lockoutUntil = null
      delete data.password
    }

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      data.fullName = [dto.firstName ?? current?.firstName, dto.lastName ?? current?.lastName]
        .filter(Boolean)
        .join(' ')
    }

    try {
      const updated = await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT })
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Utilisateur introuvable.')
      if (isPrismaCode(err, 'P2002')) {
        throw new BadRequestException('Identifiant ou adresse e-mail déjà utilisé.')
      }
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
        throw new BadRequestException(
          'Le mot de passe actuel est requis pour effectuer ce changement.'
        )
      }
      const current = await this.prisma.user.findUnique({
        where: { id },
        select: { passwordHash: true },
      })
      if (!current) throw new NotFoundException('Utilisateur introuvable.')
      const valid = await bcrypt.compare(dto.currentPassword, current.passwordHash)
      if (!valid) {
        throw new BadRequestException('Mot de passe actuel incorrect.')
      }
      data.passwordHash = await bcrypt.hash(data.password as string, 12)
      data.mustChangePassword = false
      data.failedLoginAttempts = 0
      data.lockoutUntil = null
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
      ]
        .filter(Boolean)
        .join(' ')
    }
    try {
      return await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT })
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Cette adresse e-mail est déjà utilisée par un autre compte.')
      }
      throw err
    }
  }

  async setActive(id: string, isActive: boolean, requester: Requester) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, businessUnitId: true, poleId: true },
    })
    if (!target) throw new NotFoundException('Utilisateur introuvable.')

    if (CAN_MANAGE_USERS.includes(requester.role)) {
      this.assertCanManageTarget(requester, target.role)
    } else {
      // Managers scopés (DAF, RESPONSABLE_BU) : activation/désactivation limitée à leur périmètre.
      this.assertCanManageScopedTarget(requester, target, SCOPED_ADMIN_FIELDS)
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: { isActive },
        select: SAFE_SELECT,
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Utilisateur introuvable.')
      throw err
    }
  }

  /**
   * Modification scopée d'un utilisateur par un manager de périmètre (DAF, RESPONSABLE_BU,
   * RESPONSABLE_POLE) : jamais le rôle, la BU, le pôle ou le manager — uniquement les champs
   * administratifs courants (DAF/RESPONSABLE_BU) et/ou de planning (tous les trois), et jamais
   * sur un pair/supérieur hiérarchique ni sur soi-même (cf. `/users/me` pour l'auto-édition).
   */
  async updateScoped(id: string, dto: UpdateUserDto, requester: Requester) {
    if (id === requester.id) {
      throw new ForbiddenException('Utilisez votre profil pour modifier votre propre compte.')
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: {
        role: true,
        businessUnitId: true,
        poleId: true,
        firstName: true,
        lastName: true,
      },
    })
    if (!current) throw new NotFoundException('Utilisateur introuvable.')

    const allowedFields: readonly (keyof UpdateUserDto)[] =
      requester.role === Role.RESPONSABLE_POLE
        ? SCOPED_SCHEDULE_FIELDS
        : [...SCOPED_ADMIN_FIELDS, ...SCOPED_SCHEDULE_FIELDS]

    this.assertCanManageScopedTarget(requester, current, allowedFields)

    const data: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (dto[key] !== undefined) data[key] = dto[key]
    }

    if (data.workingDays !== undefined) {
      data.workingDays = this.normalizeWorkingDays(data.workingDays as number[])
    }
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password as string, 12)
      data.mustChangePassword = true
      data.failedLoginAttempts = 0
      data.lockoutUntil = null
      delete data.password
    }
    if (data.firstName !== undefined || data.lastName !== undefined) {
      data.fullName = [
        (data.firstName as string | undefined) ?? current.firstName,
        (data.lastName as string | undefined) ?? current.lastName,
      ]
        .filter(Boolean)
        .join(' ')
    }

    try {
      return await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Utilisateur introuvable.')
      if (isPrismaCode(err, 'P2002')) {
        throw new BadRequestException('Identifiant ou adresse e-mail déjà utilisé.')
      }
      throw err
    }
  }

  private assertCanManageScopedTarget(
    requester: Requester,
    target: { role: Role; businessUnitId: string | null; poleId: string | null },
    fields: readonly (keyof UpdateUserDto)[]
  ) {
    if (!CAN_MANAGE_USERS_SCOPED_WRITE.includes(requester.role)) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cet utilisateur.')
    }
    if (SCOPED_WRITE_FORBIDDEN_TARGET_ROLES.includes(target.role)) {
      throw new ForbiddenException('Vous ne pouvez pas modifier ce compte.')
    }

    if (CAN_MANAGE_USERS_BU_SCOPE.includes(requester.role)) {
      if (!requester.businessUnitId || target.businessUnitId !== requester.businessUnitId) {
        throw new ForbiddenException('Cet utilisateur ne fait pas partie de votre BU.')
      }
      return
    }

    if (requester.role === Role.RESPONSABLE_POLE) {
      if (!requester.poleId || target.poleId !== requester.poleId) {
        throw new ForbiddenException('Cet utilisateur ne fait pas partie de votre pôle.')
      }
      // Un responsable de pôle ne touche jamais aux champs administratifs, seulement au planning.
      if (fields.some((f) => (SCOPED_ADMIN_FIELDS as readonly string[]).includes(f))) {
        throw new ForbiddenException('Vous ne pouvez modifier que le planning de cet utilisateur.')
      }
      return
    }

    throw new ForbiddenException('Vous ne pouvez pas modifier cet utilisateur.')
  }

  private normalizeWorkingDays(days: number[]): number[] {
    return Array.from(new Set(days)).sort((a, b) => a - b)
  }

  private scopeWhere(requester: Requester) {
    const { role, businessUnitId, poleId, id } = requester
    if (CAN_MANAGE_USERS.includes(role)) return {}
    if (CAN_MANAGE_USERS_BU_SCOPE.includes(role) && businessUnitId) return { businessUnitId }
    if (role === Role.RESPONSABLE_POLE && poleId) return { poleId }
    return { id }
  }

  private assertCanCreateRole(requester: Requester, role: Role) {
    if (!CAN_MANAGE_USERS.includes(requester.role)) {
      throw new ForbiddenException('Vous ne pouvez pas créer un utilisateur.')
    }
    if (requester.role === Role.PDG && PROTECTED_ADMIN_ROLES.includes(role)) {
      throw new ForbiddenException('Seul le CTO peut créer un compte CTO ou PDG.')
    }
  }

  private assertCanManageTarget(requester: Requester, targetRole: Role, nextRole?: Role) {
    if (requester.role === Role.CTO_ADMIN) return
    if (requester.role !== Role.PDG) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cet utilisateur.')
    }
    if (PROTECTED_ADMIN_ROLES.includes(targetRole)) {
      throw new ForbiddenException('Seul le CTO peut modifier un compte CTO ou PDG.')
    }
    if (nextRole && PROTECTED_ADMIN_ROLES.includes(nextRole)) {
      throw new ForbiddenException('Seul le CTO peut attribuer le rôle CTO ou PDG.')
    }
  }
}

function isPrismaCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === code
  )
}
