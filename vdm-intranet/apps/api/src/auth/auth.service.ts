import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

const USER_SELECT = {
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
  businessUnit: { select: { id: true, name: true, code: true } },
  pole: { select: { id: true, name: true, code: true } },
  manager: { select: { id: true, username: true, fullName: true } },
} as const

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } })
    if (!user) throw new UnauthorizedException('Identifiants invalides')
    if (!user.isActive) throw new UnauthorizedException('Compte désactivé')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Identifiants invalides')

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const [safe, todayPresence] = await Promise.all([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
        select: USER_SELECT,
      }),
      this.prisma.presence.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        select: { id: true },
      }),
    ])

    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role })
    return {
      token,
      user: safe,
      requiresFirstLoginGeolocation: todayPresence === null,
    }
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT })
  }

  cookieName() {
    return this.config.get<string>('COOKIE_NAME') ?? 'vdm_token'
  }

  cookieOptions(isLogout = false) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '8h'
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('NODE_ENV') === 'production',
      maxAge: isLogout ? 0 : parseMs(expiresIn),
      path: '/',
    }
  }
}

function parseMs(s: string): number {
  const n = parseInt(s)
  if (s.endsWith('d')) return n * 86_400_000
  if (s.endsWith('h')) return n * 3_600_000
  if (s.endsWith('m')) return n * 60_000
  return 8 * 3_600_000
}
