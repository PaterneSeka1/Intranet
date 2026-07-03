// VDM Intranet — Service Worker v2
// Cache la page offline et la sert quand le réseau est indisponible.

const VERSION = 'vdm-v2'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Appels API — toujours réseau, jamais de fallback
  if (url.pathname.startsWith('/api/')) return

  // Requêtes de navigation — fallback offline si réseau indisponible
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // Ressources statiques — réseau uniquement (pas de cache agressif)
  event.respondWith(fetch(request))
})
