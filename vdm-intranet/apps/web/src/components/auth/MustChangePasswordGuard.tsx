'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type Props = {
  mustChangePassword: boolean
}

export function MustChangePasswordGuard({ mustChangePassword }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (mustChangePassword && pathname !== '/mon-profil') {
      router.replace('/mon-profil')
    }
  }, [mustChangePassword, pathname, router])

  return null
}
