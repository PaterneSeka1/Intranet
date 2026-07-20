import { fetchSettings } from '@/lib/settings'
import { ForgotPasswordClient } from '@/components/auth/ForgotPasswordClient'

export default async function ForgotPasswordPage() {
  const settings = await fetchSettings()
  const s = Object.fromEntries(settings.map(x => [x.key, x.value]))

  return (
    <ForgotPasswordClient
      initialAppName={s['vdm_app_name'] || 'VDM Intranet'}
      initialAppSubtitle={s['vdm_app_subtitle'] || 'Veilleur des Médias — Abidjan'}
      initialLogo={s['vdm_logo']}
    />
  )
}
