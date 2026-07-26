import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly transporter: nodemailer.Transporter | null

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')
    const user = this.config.get<string>('SMTP_USER')
    const pass = this.config.get<string>('SMTP_PASS')

    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(this.config.get('SMTP_PORT') ?? 587),
          secure: this.config.get('SMTP_SECURE') === 'true',
          auth: user ? { user, pass } : undefined,
        })
      : null
  }

  async sendPasswordReset(to: string, firstName: string, resetUrl: string): Promise<void> {
    const subject = 'Réinitialisation de votre mot de passe — VDM Intranet'
    const safeFirstName = escapeHtml(firstName)
    const html = `
      <p>Bonjour ${safeFirstName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe sur l'intranet Veilleur des Médias.</p>
      <p><a href="${resetUrl}">Cliquer ici pour choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `

    if (!this.transporter) {
      this.logger.warn(`SMTP non configuré — lien de réinitialisation pour ${to} : ${resetUrl}`)
      return
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? '"VDM Intranet" <[EMAIL_ADDRESS]>',
      to,
      subject,
      html,
    })
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
