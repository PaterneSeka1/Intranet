'use client'

import { useState } from 'react'
import { API_BASE } from '@/lib/api-base'

// Utilisateurs sans photo RH déjà constatés pendant la session : évite de relancer une requête
// (404) à chaque rendu d'avatar — la messagerie en affiche beaucoup.
const missingPhotos = new Set<string>()

interface UserPhotoProps {
  userId?: string | null
  /** Classes de l'image, à poser dans un conteneur `relative overflow-hidden` qui affiche déjà
   * les initiales : la photo les recouvre une fois chargée, sinon les initiales restent visibles. */
  className?: string
}

/** Photo de profil issue de l'app RH (servie par GET /api/users/:id/photo). */
export function UserPhoto({
  userId,
  className = 'absolute inset-0 w-full h-full',
}: UserPhotoProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!userId || failed || missingPhotos.has(userId)) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${API_BASE}/api/users/${encodeURIComponent(userId)}/photo`}
      alt=""
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => {
        missingPhotos.add(userId)
        setFailed(true)
      }}
      className={`${className} object-cover ${loaded ? '' : 'invisible'}`}
    />
  )
}
