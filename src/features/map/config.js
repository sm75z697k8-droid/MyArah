// Provider styles are real vector maps, not generated or simulated map data.
// Keep style URLs separate from UI and map-controller logic.
export const MAP_STYLES = Object.freeze({
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
});

export const INITIAL_CAMERA = Object.freeze({
  center: [105.5, 4.5], // Between Peninsular and East Malaysia.
  zoom: 4.5,
  bearing: 0,
  pitch: 0,
});

export function getMapStyle(theme) {
  return MAP_STYLES[theme === "dark" ? "dark" : "light"];
}
