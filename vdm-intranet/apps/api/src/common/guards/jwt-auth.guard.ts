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
