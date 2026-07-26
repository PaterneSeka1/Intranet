import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const GENERIC_FORGOT_MESSAGE =
  'Si un compte existe avec cet identifiant, un email de réinitialisation a été envoyé.'
const LOGIN_LOCKOUT_THRESHOLD = 5
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000
const DUMMY_PASSWORD_HASH = '$2b$12$HXZCb0hKybfZviyWhzG7OuCBpE5Q1sPotwOIqU6koYWqrMZ/Da5uG'

const USER_SELECT = {
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
    private readonly mailService: MailService
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } })
    const now = new Date()

    if (user?.lockoutUntil && user.lockoutUntil > now) {
      throw new UnauthorizedException(
        'Compte temporairement verrouillé. Réessayez dans quelques minutes.'
      )
    }

    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
    if (!user) throw new UnauthorizedException('Identifiants invalides')
    if (!valid) {
      await this.registerFailedLogin(user)
      throw new UnauthorizedException('Identifiants invalides')
    }
    if (!user.isActive) throw new UnauthorizedException('Compte désactivé')

    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const [safe, todayPresence] = await Promise.all([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now, failedLoginAttempts: 0, lockoutUntil: null },
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

  async forgotPassword(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    })

    // Réponse volontairement générique — ne jamais révéler si le compte existe ou a un email.
    if (user && user.isActive && user.email) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      })

      const frontendUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000'
      const resetUrl = `${frontendUrl}/reinitialiser-mot-de-passe?token=${rawToken}`
      await this.mailService.sendPasswordReset(
        user.email,
        user.firstName ?? user.username,
        resetUrl
      )
    }

    return { message: GENERIC_FORGOT_MESSAGE }
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } })

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré.')
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    ])

    return { message: 'Mot de passe réinitialisé avec succès.' }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT })
    if (!user) throw new NotFoundException('Utilisateur introuvable.')
    return user
  }

  cookieName() {
    return this.config.get<string>('COOKIE_NAME') ?? 'vdm_token'
  }

  private async registerFailedLogin(user: { id: string; failedLoginAttempts: number }) {
    const failedLoginAttempts = user.failedLoginAttempts + 1
    if (failedLoginAttempts >= LOGIN_LOCKOUT_THRESHOLD) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: new Date(Date.now() + LOGIN_LOCKOUT_MS),
        },
      })
      return
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts },
    })
  }

  cookieOptions(isLogout = false) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '8h'
    const secureFlagEnv = this.config.get<string>('COOKIE_SECURE')
    const secure =
      secureFlagEnv !== undefined
        ? secureFlagEnv === 'true'
        : this.config.get('NODE_ENV') === 'production'
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure,
      domain,
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
