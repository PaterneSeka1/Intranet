import { parseUserAgent } from '@/lib/user-agent'

export class GeoError extends Error {}

const HIGH_ACCURACY: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
// Les Mac n'ont pas de GPS : CoreLocation échoue souvent en haute précision
// alors qu'une position Wi-Fi standard est disponible.
const STANDARD_ACCURACY: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 60000,
}

function requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  )
}

async function sitePermissionState(): Promise<PermissionState | null> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' })
    return status?.state ?? null
  } catch {
    return null
  }
}

async function describeError(err: GeolocationPositionError): Promise<string> {
  const { os, browser } = parseUserAgent(navigator.userAgent)
  const isMac = os === 'macOS'
  const appName = browser === 'Navigateur inconnu' ? 'votre navigateur' : browser

  if (err.code === err.PERMISSION_DENIED) {
    // Site autorisé mais refus quand même : c'est le système qui bloque le navigateur.
    const siteState = await sitePermissionState()
    if (isMac && siteState !== 'denied') {
      return `macOS bloque la localisation pour ${appName}. Ouvrez Réglages Système → Confidentialité et sécurité → Service de localisation, activez le service et cochez ${appName}, puis quittez complètement le navigateur (Cmd+Q) et rouvrez-le.`
    }
    if (siteState !== 'denied') {
      return `Le système bloque la localisation pour ${appName}. Activez le service de localisation de l'ordinateur et autorisez ${appName}, puis relancez le navigateur.`
    }
    return "Vous avez refusé l'accès à la localisation pour ce site. Autorisez-la via l'icône à gauche de la barre d'adresse, puis réessayez."
  }

  if (err.code === err.POSITION_UNAVAILABLE) {
    return isMac
      ? "Impossible de déterminer votre position. Sur Mac, le Wi-Fi doit être activé (même si vous êtes connecté par câble) et le Service de localisation activé dans Réglages Système → Confidentialité et sécurité."
      : 'Impossible de déterminer votre position. Vérifiez que la localisation (et le Wi-Fi) de votre appareil est activée.'
  }

  return isMac
    ? 'La demande de localisation a expiré. Vérifiez que le Wi-Fi est activé, puis réessayez.'
    : 'La demande de localisation a expiré. Réessayez.'
}

/**
 * Obtient la position de l'utilisateur : haute précision d'abord, puis précision
 * standard si la position est indisponible ou trop lente (cas fréquent sur Mac).
 * Rejette avec une GeoError dont le message est affichable tel quel.
 */
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new GeoError("La géolocalisation n'est pas supportée par votre navigateur.")
  }

  try {
    return await requestPosition(HIGH_ACCURACY)
  } catch (err) {
    const geoErr = err as GeolocationPositionError
    if (geoErr.code !== geoErr.PERMISSION_DENIED) {
      try {
        return await requestPosition(STANDARD_ACCURACY)
      } catch (retryErr) {
        throw new GeoError(await describeError(retryErr as GeolocationPositionError))
      }
    }
    throw new GeoError(await describeError(geoErr))
  }
}
