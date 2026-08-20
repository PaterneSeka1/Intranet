import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'

type JwtUser = {
  mustChangePassword?: boolean
}

const PASSWORD_CHANGE_ALLOWED_ROUTES = new Set([
  'GET /auth/me',
  'GET /users/me',
  'PATCH /users/me',
  'POST /auth/logout',
  // La géolocalisation de 1ère connexion du jour est prioritaire sur le
  // changement de mot de passe obligatoire (cf. LoginClient.tsx) : sans cette
  // route en liste blanche, un compte fraîchement créé/réinitialisé
  // (mustChangePassword=true + aucune présence du jour) reçoit un 403 sur
  // cet appel et reste bloqué indéfiniment sur l'écran de géolocalisation.
  'POST /presence/first-login',
])

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context)
  }

  handleRequest<TUser extends JwtUser>(
    err: unknown,
    user: TUser,
    _info?: unknown,
    context?: ExecutionContext
  ): TUser {
    if (err || !user) throw (err as Error) ?? new UnauthorizedException('Non authentifié')
    if (user.mustChangePassword && context && !this.isPasswordChangeAllowed(context)) {
      throw new ForbiddenException('Changement de mot de passe obligatoire.')
    }
    return user
  }

  private isPasswordChangeAllowed(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()
    const rawPath = req.path ?? req.url ?? req.originalUrl ?? ''
    const path =
      rawPath
        .split('?')[0]
        .replace(/^\/api(?=\/)/, '')
        .replace(/\/$/, '') || '/'
    return PASSWORD_CHANGE_ALLOWED_ROUTES.has(`${req.method} ${path}`)
  }
}
