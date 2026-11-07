// Geodesic approximation of the device-reported horizontal accuracy radius.
// Radius is meters; ring coordinates are [longitude, latitude] in WGS84.
const EARTH_RADIUS_METERS = 6371008.8;
const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

export function createAccuracyGeometry({ lng, lat, accuracy }, segments = 64) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) ||
      !Number.isFinite(accuracy) || accuracy <= 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const latitude = lat * TO_RADIANS;
  const longitude = lng * TO_RADIANS;
  const distance = accuracy / EARTH_RADIUS_METERS;
  const ring = [];

  for (let i = 0; i <= segments; i++) {
    const bearing = 2 * Math.PI * i / segments;
    const latitude2 = Math.asin(
      Math.sin(latitude) * Math.cos(distance) +
      Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing)
    );
    const longitude2 = longitude + Math.atan2(
      Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
      Math.cos(distance) - Math.sin(latitude) * Math.sin(latitude2)
    );
    ring.push([longitude2 * TO_DEGREES, latitude2 * TO_DEGREES]);
  }

  // Ensure a properly closed GeoJSON linear ring.
  ring[segments] = [...ring[0]];

  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ring] },
    }],
  };
}
