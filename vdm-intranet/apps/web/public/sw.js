// VDM Intranet — Service Worker
// Rôle : satisfaire le critère PWA pour l'installation.
// Pas de cache agressif : l'intranet doit toujours charger les données fraîches.

const VERSION = 'vdm-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Supprimer les anciens caches si le numéro de version change
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ne pas intercepter les appels API — toujours réseau
  if (url.pathname.startsWith('/api/')) return

  // Pour tout le reste : réseau en priorité, pas de cache
  event.respondWith(fetch(request))
})
