#!/usr/bin/env node
/**
 * Copie les variables d'environnement nécessaires à apps/web depuis le .env racine.
 *
 * Next.js ne charge automatiquement que les fichiers .env situés dans son propre répertoire
 * (apps/web/), jamais un .env parent. Sans ce script, NEXT_PUBLIC_API_URL/NEXT_PUBLIC_APP_URL
 * ne seraient jamais injectées au build de production : l'app servirait silencieusement l'URL
 * de repli http://localhost:3001, inutilisable pour un vrai visiteur (bug non détecté jusqu'ici
 * car en dev ce repli correspond par coïncidence à l'API locale).
 *
 * Liste blanche volontaire (jamais JWT_SECRET, DATABASE_URL, les secrets SMTP/CONGE, etc. — ces
 * secrets n'ont rien à faire dans un fichier lu par le frontend) vers
 * apps/web/.env.production.local, chargé par Next.js aussi bien au build qu'au démarrage en
 * production (fichier généré, gitignored, ne jamais éditer à la main ni committer).
 *
 * No-op silencieux si le .env racine est absent (ex. CI, où les variables nécessaires sont déjà
 * exportées directement dans l'environnement du job).
 */
const fs = require('fs')
const path = require('path')

const ROOT_ENV_PATH = path.join(__dirname, '..', '.env')
const WEB_ENV_PATH = path.join(__dirname, '..', 'apps', 'web', '.env.production.local')

// Variables sans préfixe NEXT_PUBLIC_ mais tout de même lues côté apps/web (jamais un secret).
const ALLOWED_EXACT = new Set(['COOKIE_NAME'])

function parseEnvFile(content) {
  const result = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

if (!fs.existsSync(ROOT_ENV_PATH)) {
  console.log('[copy-web-env] Pas de .env racine trouvé — étape ignorée (attendu en CI).')
  process.exit(0)
}

const rootEnv = parseEnvFile(fs.readFileSync(ROOT_ENV_PATH, 'utf8'))
const lines = []
for (const [key, value] of Object.entries(rootEnv)) {
  if (key.startsWith('NEXT_PUBLIC_') || ALLOWED_EXACT.has(key)) {
    lines.push(`${key}=${value}`)
  }
}

if (!lines.length) {
  console.log(
    '[copy-web-env] Aucune variable NEXT_PUBLIC_*/COOKIE_NAME trouvée dans .env — rien à copier.'
  )
  process.exit(0)
}

fs.writeFileSync(
  WEB_ENV_PATH,
  '# Généré automatiquement par scripts/copy-web-env.js depuis le .env racine.\n' +
    '# Ne pas éditer à la main, ne pas committer (voir .gitignore).\n' +
    lines.join('\n') +
    '\n'
)
console.log(
  `[copy-web-env] ${lines.length} variable(s) copiée(s) vers apps/web/.env.production.local`
)
