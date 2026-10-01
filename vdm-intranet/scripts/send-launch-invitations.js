#!/usr/bin/env node
/**
 * Envoi des invitations du lancement officiel (lien de création du mot de passe, valable 7 jours).
 * Utilise AuthService.sendLaunchInvitation de l'API compilée (apps/api/dist) — même SMTP, mêmes
 * jetons que l'application.
 *
 * À lancer UNIQUEMENT sur décision du DSI, depuis la racine du dépôt :
 *   node scripts/send-launch-invitations.js           # essai à blanc : liste destinataires et exclus
 *   node scripts/send-launch-invitations.js --send    # envoi réel
 *
 * Prérequis : API compilée et à jour (bash scripts/deploy.sh).
 * Relancer --send renvoie un nouveau lien à tout le monde et invalide le précédent.
 */
const path = require('path')

const API_DIR = path.resolve(__dirname, '../apps/api')
// ConfigModule charge ../../.env relativement au répertoire courant : se placer comme pm2.
process.chdir(API_DIR)

const { NestFactory } = require(require.resolve('@nestjs/core', { paths: [API_DIR] }))
const { AppModule } = require(path.join(API_DIR, 'dist/app.module.js'))
const { AuthService } = require(path.join(API_DIR, 'dist/auth/auth.service.js'))
const { PrismaService } = require(path.join(API_DIR, 'dist/prisma/prisma.service.js'))

const normalize = (v) => (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Chaque règle doit correspondre à exactement UN compte, sinon le script s'arrête sans rien envoyer.
const EXCLUSIONS = [
  { label: 'Paterne', match: (u) => normalize(u.email) === 'paterne@veilleurdesmedias.com' },
  { label: 'Franck Ouffouet', match: (u) => normalize(u.email) === 'franck@veilleurdesmedias.com' },
  {
    label: 'Fabrice',
    match: (u) =>
      normalize(u.firstName) === 'fabrice' ||
      normalize(u.fullName).split(/\s+/).includes('fabrice'),
  },
]

const SEND = process.argv.includes('--send')
const DELAY_MS = 2000 // espacement des envois pour ne pas être limité par le SMTP OVH

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const prisma = app.get(PrismaService)
    const auth = app.get(AuthService)

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, firstName: true, fullName: true, matricule: true },
      orderBy: { fullName: 'asc' },
    })

    const excluded = []
    for (const rule of EXCLUSIONS) {
      const hits = users.filter(rule.match)
      if (hits.length !== 1) {
        console.error(
          `ARRÊT : la règle d'exclusion « ${rule.label} » correspond à ${hits.length} compte(s) au lieu de 1 :`,
          hits.map((u) => `${u.fullName} <${u.email}>`)
        )
        process.exitCode = 1
        return
      }
      excluded.push(hits[0])
    }
    const excludedIds = new Set(excluded.map((u) => u.id))
    const targets = users.filter((u) => !excludedIds.has(u.id))

    console.log(`Comptes actifs : ${users.length}`)
    console.log(`Exclus (${excluded.length}) :`)
    excluded.forEach((u) => console.log(`  - ${u.fullName} <${u.email}>`))
    console.log(`Destinataires (${targets.length}) :`)
    targets.forEach((u) =>
      console.log(`  - ${u.fullName} <${u.email}>  matricule=${u.matricule ?? '—'}`)
    )

    if (!SEND) {
      console.log('\nEssai à blanc : aucun email envoyé. Relancer avec --send pour envoyer.')
      return
    }

    console.log('\nEnvoi en cours…')
    const failures = []
    for (const [i, u] of targets.entries()) {
      try {
        await auth.sendLaunchInvitation(u.id)
        console.log(`  [${i + 1}/${targets.length}] OK      ${u.email}`)
      } catch (err) {
        failures.push(u)
        console.log(`  [${i + 1}/${targets.length}] ÉCHEC   ${u.email} — ${err.message}`)
      }
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS))
    }

    console.log(
      `\nTerminé : ${targets.length - failures.length} envoyé(s), ${failures.length} échec(s).`
    )
    if (failures.length) {
      console.log('Échecs :', failures.map((u) => u.email).join(', '))
      process.exitCode = 1
    }
  } finally {
    await app.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
