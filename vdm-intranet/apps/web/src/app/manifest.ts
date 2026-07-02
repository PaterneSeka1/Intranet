import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VDM Intranet',
    short_name: 'VDM',
    description: 'Portail interne Veilleur des Médias — Abidjan, Côte d\'Ivoire',
    start_url: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#060A0F',
    theme_color: '#F28C38',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
