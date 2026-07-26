import type { MetadataRoute } from 'next'
import { fetchSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await fetchSettings()
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]))
  const appName = s['vdm_app_name'] || 'VDM Intranet'
  const shortName = appName.split(' ')[0] || 'VDM'
  const customIcon = s['vdm_favicon'] || s['vdm_logo']

  return {
    name: appName,
    short_name: shortName,
    description: "Portail interne Veilleur des Médias — Abidjan, Côte d'Ivoire",
    start_url: '/accueil',
    display: 'standalone',
    orientation: 'any',
    background_color: '#060A0F',
    theme_color: '#F28C38',
    categories: ['business', 'productivity'],
    icons: [
      ...(customIcon
        ? [{ src: customIcon, sizes: 'any', type: 'image/jpeg', purpose: 'any' as const }]
        : []),
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
