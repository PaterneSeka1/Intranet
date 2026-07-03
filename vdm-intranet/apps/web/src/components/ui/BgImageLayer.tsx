'use client'

export function BgImageLayer() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'var(--vdm-bg-image, none)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 'var(--vdm-bg-image-opacity, 0.5)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}
