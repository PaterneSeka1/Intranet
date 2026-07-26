import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'

type AnnouncementChangeAction = 'created' | 'updated' | 'deleted'

function corsOrigins() {
  const origins =
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  return origins.length ? origins : ['http://localhost:3000']
}

@WebSocketGateway({
  namespace: '/announcements',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
export class AnnouncementsGateway {
  @WebSocketServer()
  private server?: Server

  emitChanged(action: AnnouncementChangeAction, id: string) {
    this.server?.emit('announcements:changed', { action, id, at: new Date().toISOString() })
  }
}
