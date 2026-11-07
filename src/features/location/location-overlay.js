import { createAccuracyGeometry } from "./accuracy.js";

const SOURCE_ID = "myarah-gps-accuracy";
const FILL_ID = "myarah-gps-accuracy-fill";
const OUTLINE_ID = "myarah-gps-accuracy-outline";

// Custom marker remains attached to the geographic coordinates even when
// the basemap style changes. Accuracy layers must be recreated on style.load.
export function createLocationOverlay(map, Marker) {
  let position = null;
  let marker = null;

  function updateAccuracy() {
    if (!position) return;
    const data = createAccuracyGeometry(position);

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data });
    } else {
      map.getSource(SOURCE_ID).setData(data);
    }

    // Keep the translucent circle below labels and the HTML position marker.
    const firstLabel = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
    if (!map.getLayer(FILL_ID)) {
      map.addLayer({
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": "#378BDD",
          "fill-opacity": 0.13,
        },
      }, firstLabel);
    }
    if (!map.getLayer(OUTLINE_ID)) {
      map.addLayer({
        id: OUTLINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#378BDD",
          "line-width": 1.2,
          "line-opacity": 0.5,
        },
      }, firstLabel);
    }
  }

  map.on("style.load", updateAccuracy);

  function show(positionUpdate) {
    position = { ...positionUpdate };
    if (!marker) {
      const element = document.createElement("div");
      element.className = "user-location-marker";
      element.setAttribute("aria-hidden", "true");
      const dot = document.createElement("span");
      dot.className = "user-location-dot";
      element.append(dot);
      marker = new Marker({ element, anchor: "center" })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
    } else {
      marker.setLngLat([position.lng, position.lat]);
    }
    updateAccuracy();
  }

  return { show };
}
