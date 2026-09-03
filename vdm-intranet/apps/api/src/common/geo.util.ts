const EARTH_RADIUS_METERS = 6_371_000

/**
 * Distance orthodromique (formule de Haversine) entre deux points GPS, en mètres. Utilisée pour
 * comparer la position d'une première connexion du jour au lieu de travail de référence
 * (cf. PresenceService.processFirstLogin / WorkplaceLocation) — suffisamment précise sur des
 * distances de l'ordre du kilomètre, sans dépendance externe.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a))
}
