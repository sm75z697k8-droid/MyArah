import { getMapStyle } from "./features/map/config.js";
import { createThemeController } from "./features/theme/theme.js";

const toggle = document.getElementById("theme-toggle");
const status = document.getElementById("map-status");
let map = null;
let mapReady = false;
let timedOut = false;

function showFailure() {
  if (mapReady) return;
  timedOut = true;
  status.hidden = false;
  status.classList.add("is-error");
  status.textContent = "The map could not load. Check your connection and reload this page.";
}

const theme = createThemeController(toggle, (newTheme) => {
  if (map) {
    // MapLibre retains the current camera when swapping style documents.
    map.setStyle(getMapStyle(newTheme));
  }
});

const timeout = window.setTimeout(showFailure, 20000);

async function start() {
  try {
    // A dynamic import allows the page to show an error if the CDN is unavailable.
    const { createMap } = await import("./features/map/map.js");
    map = createMap({
      theme: theme.getTheme(),
      onLoad: () => {
        mapReady = true;
        window.clearTimeout(timeout);
        status.hidden = true;
        status.classList.remove("is-error");
      },
    });
  } catch (error) {
    window.clearTimeout(timeout);
    console.error("MyArah initialization failed:", error);
    showFailure();
  }
}

void start();
