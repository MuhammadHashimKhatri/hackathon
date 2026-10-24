// Spec §9 Camera check-in — Haversine distance to the office

const EARTH_RADIUS_M = 6_371_008.8; // mean radius
const rad = (deg) => (deg * Math.PI) / 180;

// a, b: { lat, lng } in degrees -> metres along the surface.
export function haversineMeters(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinRadius(point, office, radiusM) {
  return haversineMeters(point, office) <= radiusM;
}
