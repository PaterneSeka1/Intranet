import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { Response } from 'express'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Connexion — retourne le cookie JWT' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user, requiresFirstLoginGeolocation } = await this.authService.login(dto.username, dto.password)
    res.cookie(this.authService.cookieName(), token, this.authService.cookieOptions())
    return { user, requiresFirstLoginGeolocation }
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Déconnexion — supprime le cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.authService.cookieName(), this.authService.cookieOptions(true))
    return { message: 'Déconnecté avec succès' }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté' })
  async me(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id)
  }
}
