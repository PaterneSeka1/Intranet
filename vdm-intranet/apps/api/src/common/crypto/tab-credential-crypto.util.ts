import * as crypto from 'crypto'

// Chiffrement des mots de passe partagés rattachés aux onglets (PortalTabCredential.passwordEnc).
// AES-256-GCM via le module `crypto` natif de Node — aucune dépendance à ajouter, même approche
// que apps/api/src/chat/chat.storage.ts pour un utilitaire de fonctions pures (pas un service
// Nest, donc lecture directe de process.env plutôt qu'injection de ConfigService).

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const KEY_LENGTH_BYTES = 32

let cachedKey: Buffer | null = null

/**
 * Clé de chiffrement lue depuis TAB_CREDENTIALS_ENCRYPTION_KEY (32 octets encodés en base64,
 * générés par ex. avec `openssl rand -base64 32`). Fail fast si absente ou de mauvaise longueur :
 * un identifiant partagé mal protégé ne doit jamais être stocké silencieusement.
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.TAB_CREDENTIALS_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "TAB_CREDENTIALS_ENCRYPTION_KEY n'est pas définie : impossible de chiffrer/déchiffrer un identifiant partagé. Générer une clé avec `openssl rand -base64 32` et la renseigner dans .env."
    )
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `TAB_CREDENTIALS_ENCRYPTION_KEY doit décoder en ${KEY_LENGTH_BYTES} octets (base64 de 32 octets, ex. généré par \`openssl rand -base64 32\`) — ${key.length} octet(s) trouvé(s).`
    )
  }

  cachedKey = key
  return cachedKey
}

/** Chiffre un secret en clair (mot de passe) → "base64(iv):base64(authTag):base64(ciphertext)". */
export function encryptCredentialSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
}

/**
 * Déchiffre un secret produit par encryptCredentialSecret. Lève une erreur explicite si le
 * format est invalide ou si l'authTag ne correspond pas (donnée corrompue/falsifiée) — ne
 * retourne jamais de texte partiellement déchiffré.
 */
export function decryptCredentialSecret(payload: string): string {
  const parts = payload.split(':')
  if (parts.length !== 3) {
    throw new Error('Format de secret chiffré invalide (identifiant partagé).')
  }
  const [ivB64, authTagB64, ciphertextB64] = parts
  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
