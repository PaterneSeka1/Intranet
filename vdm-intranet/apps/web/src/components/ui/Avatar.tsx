import { UserPhoto } from './UserPhoto'

const SIZES = {
  sm: { box: 'w-7 h-7', text: 'text-[10px]', dot: 'w-2 h-2' },
  md: { box: 'w-9 h-9', text: 'text-xs', dot: 'w-2.5 h-2.5' },
  lg: { box: 'w-12 h-12', text: 'text-sm', dot: 'w-3 h-3' },
}

interface AvatarProps {
  /** Affiche la photo de profil RH de cet utilisateur si elle existe (initiales sinon). */
  userId?: string | null
  firstName?: string | null
  lastName?: string | null
  username: string
  size?: keyof typeof SIZES
  /** Pastille verte "en ligne" en bas à droite — omise si undefined (pas juste false). */
  online?: boolean
  className?: string
}

function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  username: string
) {
  const f = firstName?.trim()
  const l = lastName?.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  return username.slice(0, 2).toUpperCase()
}

/** Avatar partagé : photo de profil RH si `userId` est fourni et qu'elle existe, initiales sinon —
 * cf. logique dupliquée dans UsersManager.tsx et Sidebar.tsx, factorisée ici pour la messagerie. */
export function Avatar({
  userId,
  firstName,
  lastName,
  username,
  size = 'md',
  online,
  className = '',
}: AvatarProps) {
  const s = SIZES[size]
  const initials = getInitials(firstName, lastName, username)
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`${s.box} relative overflow-hidden rounded-full bg-[#F28C38]/10 flex items-center justify-center`}
      >
        <span className={`${s.text} font-bold text-[#F28C38]`}>{initials}</span>
        <UserPhoto userId={userId} />
      </div>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${s.dot} rounded-full border-2 border-white ${
            online ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        />
      )}
    </div>
  )
}
