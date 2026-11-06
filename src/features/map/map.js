import * as maplibregl from "https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs";
import { INITIAL_CAMERA, getMapStyle } from "./config.js";

export function createMap({ theme, onLoad }) {
  const map = new maplibregl.Map({
    container: "map",
    style: getMapStyle(theme),
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

  // Keep this first version north-up and two-dimensional. Pinch zoom remains active.
  map.touchZoomRotate.disableRotation();
  map.once("load", onLoad);

  // Individual tile failures can be transient; the UI timeout in main.js
  // handles the case where the initial map cannot finish loading.
  map.on("error", (event) => {
    console.warn("MyArah map resource failed:", event.error);
  });

  return map;
}
