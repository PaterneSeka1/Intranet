export function escapeCssString(value: string): string {
  return value.replace(/"/g, '\\"')
}

export function opacityPercentToCss(value: number): string {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))
  return (clamped / 100).toFixed(2)
}

export function opacitySettingToPercent(value: string | undefined, fallback = 30): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback

  const percent = parsed <= 1 ? parsed * 100 : parsed
  return Math.min(100, Math.max(0, Math.round(percent)))
}

export function opacitySettingToCss(value: string | undefined, fallback = 30): string {
  return opacityPercentToCss(opacitySettingToPercent(value, fallback))
}
