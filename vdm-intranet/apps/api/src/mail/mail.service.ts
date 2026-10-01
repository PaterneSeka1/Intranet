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
    const subject = 'Réinitialisation de votre mot de passe — VdM Intranet'
    const safeFirstName = escapeHtml(firstName)
    const html = `
      <p>Bonjour ${safeFirstName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe sur VdM Intranet.</p>
      <p><a href="${resetUrl}">Cliquer ici pour choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `

    if (!this.transporter) {
      this.logger.warn(`SMTP non configuré — lien de réinitialisation pour ${to} : ${resetUrl}`)
      return
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? '"VdM Intranet" <[EMAIL_ADDRESS]>',
      to,
      subject,
      html,
    })
  }

  async sendLaunchInvitation(
    to: string,
    firstName: string,
    matricule: string | null,
    setupUrl: string
  ): Promise<void> {
    const subject = 'Bienvenue sur l’intranet du Veilleur des Médias — activez votre compte'
    const safeFirstName = escapeHtml(firstName)
    const loginUrl = setupUrl.split('/reinitialiser-mot-de-passe')[0] + '/login'
    // Les stagiaires n'ont pas de matricule : ils se connectent avec leur adresse email.
    const identifier = matricule
      ? `votre matricule <strong>${escapeHtml(matricule)}</strong> ou votre adresse email <strong>${escapeHtml(to)}</strong>`
      : `votre adresse email <strong>${escapeHtml(to)}</strong>`
    const html = `
      <p>Bonjour ${safeFirstName},</p>
      <p>Nous avons le plaisir de vous annoncer le lancement officiel de l’intranet du Veilleur des Médias, votre nouvel espace de travail commun.</p>
      <p>Votre compte a été créé. Pour l’activer, il vous suffit de choisir votre mot de passe en cliquant sur le lien ci-dessous :</p>
      <p><a href="${setupUrl}">Activer mon compte et choisir mon mot de passe</a></p>
      <p>Ce lien est personnel et valable 7 jours. Passé ce délai, vous pourrez en obtenir un nouveau depuis la page de connexion, rubrique « Mot de passe oublié ».</p>
      <p>Une fois votre mot de passe défini, connectez-vous sur <a href="${loginUrl}">${escapeHtml(loginUrl)}</a> avec ${identifier}.</p>
      <p>Pour toute question, veillez contacter Paterne SEKA au mail suivant : paterne@veilleurdesmedias.com.</p>
      <p>Bonne découverte,<br>La Direction des services clients et innovation<br>Veilleur des Médias</p>
    `

    if (!this.transporter) {
      this.logger.warn(`SMTP non configuré — lien d'activation pour ${to} : ${setupUrl}`)
      return
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? '"VdM Intranet" <[EMAIL_ADDRESS]>',
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
