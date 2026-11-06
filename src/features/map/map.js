import * as maplibregl from "https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs";
import { INITIAL_CAMERA, getMapStyle } from "./config.js";
import { styleTropicalAtlas } from "./styles/tropical-atlas.js";

export function createMap({ theme, onLoad }) {
  const map = new maplibregl.Map({
    container: "map",
    style: getMapStyle(theme),
    // Transform the provider's actual vector style before MapLibre renders it.
    transformStyle: (_previous, incoming) => styleTropicalAtlas(incoming, theme),
    center: INITIAL_CAMERA.center,
    zoom: INITIAL_CAMERA.zoom,
    bearing: INITIAL_CAMERA.bearing,
    pitch: INITIAL_CAMERA.pitch,
    minZoom: 2.5,
    maxPitch: 0,
    dragRotate: false,
    touchPitch: false,
    renderWorldCopies: false,
    attributionControl: true,
    antialias: false,
  });

  map.touchZoomRotate.disableRotation();
  map.once("load", onLoad);

  map.on("error", (event) => {
    console.warn("MyArah map resource failed:", event.error);
  });

  return map;
}

export function setMapTheme(map, theme) {
  // Do not re-create the Map instance: keep camera, gestures and controls.
  map.setStyle(getMapStyle(theme), {
    transformStyle: (_previous, incoming) => styleTropicalAtlas(incoming, theme),
  });
}
