'use client'

import { API_BASE } from './api-base'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOptions = RequestInit & {
  /** Désactive la redirection /login sur 401 (utilisé uniquement par la connexion elle-même). */
  skipAuthRedirect?: boolean
  timeoutMs?: number
  defaultErrorMessage?: string
}

const DEFAULT_TIMEOUT_MS = 30_000

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`
  }
}

async function rawFetch(path: string, opts: RequestOptions = {}): Promise<Response> {
  const { skipAuthRedirect, timeoutMs, defaultErrorMessage, signal, ...requestInit } = opts
  const controller = signal ? null : new AbortController()
  const tid = controller
    ? setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS)
    : null
  try {
    return await fetch(`${API_BASE}/api${path}`, {
      credentials: 'include',
      ...requestInit,
      headers: { 'Content-Type': 'application/json', ...requestInit.headers },
      signal: signal ?? controller?.signal,
    })
  } finally {
    if (tid) clearTimeout(tid)
  }
}

/**
 * Client HTTP unique pour toutes les routes `/api/*` appelées depuis le navigateur.
 * Seule une réponse 401 (session expirée ou absente) déclenche la redirection vers /login ;
 * un 403 est un refus applicatif (hors périmètre) que l'appelant doit pouvoir afficher lui-même.
 */
async function assertOk(res: Response, opts: RequestOptions): Promise<Response> {
  if (res.status === 401) {
    if (!opts.skipAuthRedirect) redirectToLogin()
    throw new ApiError(
      res.status,
      opts.skipAuthRedirect
        ? 'Identifiant ou mot de passe incorrect.'
        : 'Session expirée. Redirection vers la connexion…'
    )
  }
  if (!res.ok) {
    let message = opts.defaultErrorMessage ?? `Erreur ${res.status}`
    try {
      const body = await res.json()
      message = body?.message ?? message
    } catch {
      /* réponse non JSON : message par défaut conservé */
    }
    throw new ApiError(res.status, message)
  }
  return res
}

export async function apiFetch<T>(path: string, init?: RequestOptions): Promise<T> {
  const res = await rawFetch(path, init)
  await assertOk(res, init ?? {})
  return res.json() as Promise<T>
}

export async function apiFetchVoid(path: string, init?: RequestOptions): Promise<void> {
  const res = await rawFetch(path, init)
  await assertOk(res, init ?? {})
}

export async function apiFetchBlob(path: string, init?: RequestOptions): Promise<Blob> {
  const res = await rawFetch(path, { timeoutMs: 60_000, ...init })
  await assertOk(res, init ?? {})
  return res.blob()
}
