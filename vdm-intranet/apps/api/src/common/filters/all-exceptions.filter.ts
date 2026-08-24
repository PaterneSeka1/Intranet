import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'

/**
 * Filtre d'exception global : journalise systématiquement les erreurs (avec un identifiant de
 * corrélation) et renvoie une réponse JSON cohérente, sans jamais exposer de détail interne
 * (stack trace, message Prisma brut) pour une erreur non prévue (5xx).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const requestId = randomUUID()

    const { status, message } = this.resolve(exception)

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} → ${status} : ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined
      )
    } else {
      this.logger.warn(`[${requestId}] ${request.method} ${request.url} → ${status} : ${message}`)
    }

    response.status(status).json({
      statusCode: status,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }

  private resolve(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const body = exception.getResponse()
      const message =
        typeof body === 'string' ? body : ((body as { message?: string }).message ?? body)
      return {
        status: exception.getStatus(),
        message: (Array.isArray(message) ? message.join(', ') : message) as string,
      }
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Jamais le message Prisma brut (peut contenir des noms de colonnes/contraintes internes).
      return { status: HttpStatus.BAD_REQUEST, message: 'Requête invalide.' }
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erreur interne du serveur.' }
  }

  private describe(exception: unknown): string {
    if (exception instanceof Error) return exception.message
    try {
      return JSON.stringify(exception)
    } catch {
      return String(exception)
    }
  }
}
