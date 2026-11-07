import { createThemeController } from "./features/theme/theme.js";
import { createLocationController } from "./features/location/location-controller.js";
import { createLocationOverlay } from "./features/location/location-overlay.js";

const toggle = document.getElementById("theme-toggle");
const status = document.getElementById("map-status");
const locateButton = document.getElementById("locate-button");
const locationStatus = document.getElementById("location-status");
let map = null;
let setMapTheme = null;
let mapReady = false;

function showFailure() {
  if (mapReady) return;
  status.hidden = false;
  status.classList.add("is-error");
  status.textContent = "The map could not load. Check your connection and reload this page.";
}

const theme = createThemeController(toggle, (newTheme) => {
  if (map && setMapTheme) setMapTheme(map, newTheme);
});

const timeout = window.setTimeout(showFailure, 20000);

async function start() {
  try {
    const mapModule = await import("./features/map/map.js");
    setMapTheme = mapModule.setMapTheme;
    map = mapModule.createMap({
      theme: theme.getTheme(),
      onLoad: () => {
        mapReady = true;
        window.clearTimeout(timeout);
        status.hidden = true;
        status.classList.remove("is-error");
        locateButton.disabled = false;
      },
    });

    const overlay = createLocationOverlay(map, mapModule.MapMarker);
    createLocationController({
      button: locateButton,
      status: locationStatus,
      map,
      overlay,
    });
  } catch (error) {
    window.clearTimeout(timeout);
    console.error("MyArah initialization failed:", error);
    showFailure();
  }
}

void start();
