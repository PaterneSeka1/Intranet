import {
  Newspaper,
  Bell,
  PlayCircle,
  X,
  Users,
  Briefcase,
  Folder,
  Mail,
  ClipboardList,
  NotebookPen,
  BarChart3,
  GitBranch,
  Triangle,
  Cloud,
  Sheet,
  Link2,
  type LucideIcon,
} from 'lucide-react'

/**
 * Registre des icônes disponibles pour les onglets/raccourcis (remplace l'ancienne
 * palette d'emojis). La clé est stockée telle quelle dans `Tab.icon` en base.
 */
export const TAB_ICON_REGISTRY: Record<string, LucideIcon> = {
  newspaper: Newspaper,
  bell: Bell,
  'play-circle': PlayCircle,
  x: X,
  users: Users,
  briefcase: Briefcase,
  folder: Folder,
  mail: Mail,
  'clipboard-list': ClipboardList,
  'notebook-pen': NotebookPen,
  'bar-chart': BarChart3,
  'git-branch': GitBranch,
  triangle: Triangle,
  cloud: Cloud,
  sheet: Sheet,
  link: Link2,
}

export const TAB_ICON_PRESETS = Object.keys(TAB_ICON_REGISTRY)

export const DEFAULT_TAB_ICON = 'link'
export const DEFAULT_TAB_COLOR = '#F28C38'

export function isImageIcon(value?: string | null) {
  return !!value && (/^data:image\//.test(value) || /^https?:\/\//.test(value))
}

/** Ajoute un canal alpha (00-ff) à une couleur hexadécimale #rrggbb. */
export function withAlpha(hex: string, alphaHex: string) {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alphaHex}` : hex
}

/**
 * Rendu unifié de l'icône d'un onglet : image uploadée/URL, ou icône vectorielle du
 * registre teintée dans la couleur choisie pour l'onglet. Toute valeur héritée (ancien
 * emoji, texte libre non reconnu) retombe sur l'icône par défaut plutôt que d'afficher
 * un caractère brut.
 */
export function TabIcon({
  value,
  color,
  className = 'w-8 h-8',
  imageClassName = 'rounded-lg',
}: {
  value?: string | null
  color?: string | null
  className?: string
  imageClassName?: string
}) {
  if (isImageIcon(value)) {
    return (
      <span
        className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden`}
      >
        <img
          src={value ?? ''}
          alt=""
          className={`w-full h-full object-contain ${imageClassName}`}
        />
      </span>
    )
  }

  const Icon = (value && TAB_ICON_REGISTRY[value]) || TAB_ICON_REGISTRY[DEFAULT_TAB_ICON]
  return (
    <span
      style={{ color: color || DEFAULT_TAB_COLOR }}
      className={`${className} inline-flex shrink-0 items-center justify-center`}
    >
      <Icon className="w-[60%] h-[60%]" strokeWidth={1.75} />
    </span>
  )
}
