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
  Ticket,
  Search,
  Sparkles,
  createLucideIcon,
  type LucideIcon,
} from 'lucide-react'

// Logos de réseaux sociaux : lucide-react 1.x a retiré les icônes de marques. Glyphes au trait
// dans le style lucide (24x24, currentColor) pour rester homogènes avec le reste du registre.
const Facebook = createLucideIcon('facebook', [
  ['path', { d: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z', key: 'fb' }],
])
const Linkedin = createLucideIcon('linkedin', [
  [
    'path',
    {
      d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z',
      key: 'li1',
    },
  ],
  ['rect', { width: '4', height: '12', x: '2', y: '9', key: 'li2' }],
  ['circle', { cx: '4', cy: '4', r: '2', key: 'li3' }],
])
const Tiktok = createLucideIcon('tiktok', [
  ['path', { d: 'M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5', key: 'tt' }],
])
const Instagram = createLucideIcon('instagram', [
  ['rect', { width: '20', height: '20', x: '2', y: '2', rx: '5', ry: '5', key: 'ig1' }],
  ['path', { d: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z', key: 'ig2' }],
  ['line', { x1: '17.5', x2: '17.51', y1: '6.5', y2: '6.5', key: 'ig3' }],
])
const Youtube = createLucideIcon('youtube', [
  [
    'path',
    {
      d: 'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17',
      key: 'yt1',
    },
  ],
  ['path', { d: 'm10 15 5-3-5-3z', key: 'yt2' }],
])

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
  ticket: Ticket,
  search: Search,
  sparkles: Sparkles,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Tiktok,
  instagram: Instagram,
  youtube: Youtube,
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
