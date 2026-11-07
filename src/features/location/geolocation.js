// A one-time, user-initiated GPS request. We do not store or transmit coordinates.
export const LOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 15000,
});

export function normalizePosition(position) {
  const { latitude, longitude, accuracy } = position?.coords ?? {};
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error("Your device returned an invalid location.");
  }
  return {
    lat: latitude,
    lng: longitude,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
  };
}

export function requestCurrentLocation(geolocation = globalThis.navigator?.geolocation) {
  return new Promise((resolve, reject) => {
    if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
      reject(new Error("Location is unavailable. Open MyArah over HTTPS and check Safari settings."));
      return;
    }
    try {
      geolocation.getCurrentPosition(
        (position) => {
          try { resolve(normalizePosition(position)); }
          catch (error) { reject(error); }
        },
        reject,
        LOCATION_OPTIONS
      );
    } catch (error) {
      reject(error);
    }
  });
}

export function getLocationErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return "Location access was denied. Allow location access for this website in Safari settings.";
    case 2:
      return "Your location is temporarily unavailable. Try outdoors or check Location Services.";
    case 3:
      return "Location timed out. Please try again.";
    default:
      return error?.message || "Unable to find your location. Please try again.";
  }
}
