/**
 * Validation des variables d'environnement au démarrage (fail-fast).
 *
 * Sans ceci, une variable requise absente (ex. `JWT_SECRET`) laisse l'application démarrer
 * normalement et ne casse qu'au premier usage réel (ex. `jwtService.sign()` au premier login) —
 * un échec tardif et silencieux plutôt qu'un refus immédiat et explicite au démarrage.
 */
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const

const MIN_JWT_SECRET_LENGTH = 32

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_VARS.filter((key) => {
    const value = config[key]
    return value === undefined || value === null || String(value).trim() === ''
  })
  if (missing.length) {
    throw new Error(
      `Configuration invalide : variable(s) d'environnement manquante(s) ou vide(s) : ${missing.join(', ')}. ` +
        'Vérifiez votre fichier .env (voir .env.example).'
    )
  }

  const jwtSecret = String(config.JWT_SECRET)
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `Configuration invalide : JWT_SECRET est trop court (${jwtSecret.length} caractères, ${MIN_JWT_SECRET_LENGTH} minimum). ` +
        "Utilisez un secret aléatoire robuste, jamais la valeur d'exemple de .env.example."
    )
  }

  return config
}
