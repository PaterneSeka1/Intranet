import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export const MAX_FILES_PER_MESSAGE = 5
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15 Mo

// Liste noire (pas blanche) : on bloque les formats exécutables/scripts, on laisse passer tout le
// reste (images, PDF, bureautique, archives…) — cohérent avec un usage de messagerie interne.
const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.msi',
  '.com',
  '.scr',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.jar',
  '.dll',
  '.wsf',
  '.wsh',
  '.msc',
  '.hta',
  '.reg',
  '.cpl',
])

/** Dossier de stockage des pièces jointes du chat, créé au besoin. */
export function chatUploadsDir(): string {
  const configured = process.env.CHAT_UPLOADS_DIR
  const dir = configured ? path.resolve(configured) : path.resolve(process.cwd(), 'uploads', 'chat')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function isDangerousFilename(originalName: string): boolean {
  return DANGEROUS_EXTENSIONS.has(path.extname(originalName).toLowerCase())
}

/** Nom de fichier aléatoire (jamais le nom d'origine) pour éviter collisions et traversée de chemin. */
export function randomStorageFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '')
  return `${crypto.randomUUID()}${ext}`
}
