import { fetchSettings } from '@/lib/settings'
import { LoginClient } from '@/components/auth/LoginClient'

export default async function LoginPage() {
  const settings = await fetchSettings()
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]))

  return (
    <LoginClient
      initialAppName={s['vdm_app_name'] || 'Intranet Veilleur des Médias'}
      initialAppSubtitle={s['vdm_app_subtitle'] || 'Veilleur des Médias — Abidjan'}
      initialLogo={s['vdm_logo']}
    />
  )
}
