import { fetchSettings } from '@/lib/settings'
import { ResetPasswordClient } from '@/components/auth/ResetPasswordClient'

interface Props {
  searchParams: { token?: string }
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const settings = await fetchSettings()
  const s = Object.fromEntries(settings.map(x => [x.key, x.value]))

  return (
    <ResetPasswordClient
      token={searchParams.token}
      initialAppName={s['vdm_app_name'] || 'VDM Intranet'}
      initialAppSubtitle={s['vdm_app_subtitle'] || 'Veilleur des Médias — Abidjan'}
      initialLogo={s['vdm_logo']}
    />
  )
}
