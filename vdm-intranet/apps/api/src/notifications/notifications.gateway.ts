import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'

function corsOrigins() {
  const origins =
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  return origins.length ? origins : ['http://localhost:3000']
}

/** Extrait la valeur d'un cookie nommé depuis l'en-tête brut `Cookie` d'un handshake WebSocket. */
function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const raw = client.handshake.headers.cookie
      if (!raw) throw new Error('no cookie')
      const cookieName = this.config.get<string>('COOKIE_NAME') ?? 'vdm_token'
      const token = parseCookie(raw, cookieName)
      if (!token) throw new Error('no token')

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      })
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      })
      if (!user?.isActive) throw new Error('inactive')

      client.data.userId = user.id
      await client.join(`user:${user.id}`)
    } catch {
      client.disconnect(true)
    }
  }

  emitToUser(userId: string) {
    this.server?.to(`user:${userId}`).emit('notification:new', { at: new Date().toISOString() })
  }

  emitToUsers(userIds: string[]) {
    if (!userIds.length) return
    this.server
      ?.to(userIds.map((id) => `user:${id}`))
      .emit('notification:new', { at: new Date().toISOString() })
  }
}
