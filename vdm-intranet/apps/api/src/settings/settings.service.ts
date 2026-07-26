import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export type SettingPair = { key: string; value: string }

const HEX_COLOR_KEYS = new Set(['vdm_sidebar_active', 'vdm_sidebar_text'])
const BACKGROUND_KEYS = new Set(['vdm_app_bg', 'vdm_login_bg'])
const IMAGE_URL_KEYS = new Set(['vdm_logo', 'vdm_favicon', 'vdm_bg_image'])
const TEXT_KEYS = new Set(['vdm_app_name', 'vdm_app_subtitle'])
const OPACITY_KEYS = new Set(['vdm_bg_image_opacity'])
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getAll(): Promise<SettingPair[]> {
    return this.prisma.appSetting.findMany({ select: { key: true, value: true } })
  }

  async upsertMany(settings: SettingPair[]): Promise<SettingPair[]> {
    if (!Array.isArray(settings)) {
      throw new BadRequestException('Liste de paramètres invalide.')
    }
    settings.forEach(validateSetting)

    await this.prisma.$transaction(
      settings.map(({ key, value }) =>
        this.prisma.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    )
    return this.getAll()
  }

  deleteKey(key: string) {
    return this.prisma.appSetting.deleteMany({ where: { key } })
  }
}

function validateSetting(setting: SettingPair) {
  if (typeof setting !== 'object' || setting === null) {
    throw new BadRequestException('Paramètre invalide.')
  }

  const { key, value } = setting

  if (typeof key !== 'string' || typeof value !== 'string') {
    throw new BadRequestException('Paramètre invalide.')
  }

  if (HEX_COLOR_KEYS.has(key) && value && !HEX_COLOR_REGEX.test(value)) {
    throw new BadRequestException(`Couleur invalide pour ${key}.`)
  }

  if (BACKGROUND_KEYS.has(key) && value && !isValidBackground(value)) {
    throw new BadRequestException(`Fond invalide pour ${key}.`)
  }

  if (key === 'vdm_sidebar_hover' && value && !isValidRgba(value)) {
    throw new BadRequestException('Couleur de survol invalide.')
  }

  if (OPACITY_KEYS.has(key) && value && !isValidOpacityPercent(value)) {
    throw new BadRequestException(`Opacité invalide pour ${key}.`)
  }

  if (IMAGE_URL_KEYS.has(key) && value && !isValidImageUrl(value)) {
    throw new BadRequestException(`URL d'image invalide pour ${key}.`)
  }

  if (TEXT_KEYS.has(key) && /<[^>]*>/.test(value)) {
    throw new BadRequestException(`Texte invalide pour ${key}.`)
  }
}

function isValidBackground(value: string): boolean {
  if (HEX_COLOR_REGEX.test(value)) return true
  if (isValidCssImageUrl(value)) return true

  const gradient = value.match(
    /^linear-gradient\(\s*(\d{1,3})deg\s*,\s*(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3})\s+0%\s*,\s*(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3})\s+100%\s*\)$/
  )
  if (!gradient) return false

  const angle = Number(gradient[1])
  return Number.isInteger(angle) && angle >= 0 && angle <= 360
}

function isValidRgba(value: string): boolean {
  const rgba = value.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+|1\.0+)\s*\)$/
  )
  if (!rgba) return false

  const channels = rgba.slice(1, 4).map(Number)
  const alpha = Number(rgba[4])
  return (
    channels.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255) &&
    alpha >= 0 &&
    alpha <= 1
  )
}

function isValidOpacityPercent(value: string): boolean {
  if (!/^\d+$/.test(value)) return false
  const opacity = Number(value)
  return opacity >= 0 && opacity <= 100
}

function isValidImageUrl(value: string): boolean {
  return (
    value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/')
  )
}

function isValidCssImageUrl(value: string): boolean {
  const match = value.match(/^url\((["']?)(.+)\1\)$/)
  return match ? isValidImageUrl(match[2]) : false
}
