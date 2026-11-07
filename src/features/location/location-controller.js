import { requestCurrentLocation, getLocationErrorMessage } from "./geolocation.js";

export function createLocationController({ button, status, map, overlay, requestLocation = requestCurrentLocation }) {
  let notificationTimeout;

  function notify(message, duration = 0, isError = false) {
    window.clearTimeout(notificationTimeout);
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.hidden = false;
    if (duration > 0) {
      notificationTimeout = window.setTimeout(() => { status.hidden = true; }, duration);
    }
  }

  button.addEventListener("click", async () => {
    if (button.disabled) return;

    // Restart the short success pulse for each new GPS request.
    button.removeAttribute("data-bubble");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    notify("Finding your location…");

    try {
      const position = await requestLocation();
      overlay.show(position);

      // Only user taps move the map; no continuous following or GPS watcher.
      const zoom = Math.max(map.getZoom(), 15);
      const target = { center: [position.lng, position.lat], zoom };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        map.jumpTo(target);
      } else {
        map.flyTo({ ...target, duration: 850, essential: false });
      }

      const accuracyMessage = position.accuracy === null
        ? "Location found."
        : `Location found · estimated accuracy ±${Math.round(position.accuracy)} m`;
      notify(accuracyMessage, 4500);
      button.setAttribute("data-bubble", "success");
    } catch (error) {
      notify(getLocationErrorMessage(error), 8500, true);
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });
}
