# MyArah

Malaysia-first navigation web app, rebuilt using a lightweight modular, map-first architecture.

## Implemented

- Real full-screen north-up 2D map with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) v6.16.0 and [OpenFreeMap](https://openfreemap.org/quick_start/).
- Tropical Atlas cartography: warm limestone daytime and deep petrol nighttime colors.
- Theme switch and device dark-mode detection with persistent user preference.
- **Tap-to-locate:** one-time browser Geolocation API request, blue GPS marker, geographically sized estimated horizontal accuracy circle, and animated map recentering.
- Two compact frosted-glass controls with a thin stroke and subtle inner optical-edge highlight. No expensive distortion shader.
- Reduced-motion support, safe-area handling, GPS permission and timeout messages.

Not implemented: continuous position following, GPS heading, search, routing, turn-by-turn navigation, traffic, voice, lane guidance, speed limits, road elevations or 3D. The GPS position dot is the **most recently requested position**, not live continuous navigation.

## How to use location

Open from an HTTPS URL (for example GitHub Pages) in Safari, then tap the arrow button at the lower right. Safari requests permission as needed. MyArah **does not** request location on page load. If permission is denied, allow Location Services and website access in iPhone/Safari settings.

A blue dot marks the returned device coordinates; the translucent circle shows the device's reported horizontal accuracy radius in meters. An accuracy estimate does **not** guarantee actual precision. Pan freely afterward. Tap the button again to request an updated fix.

Your GPS coordinates remain in browser memory for the current page session. They are neither written to localStorage nor sent by our code to a backend. Map tiles are still fetched from the configured provider.

## File structure

```text
MyArah/
├── .github/workflows/validate.yml
├── .gitignore
├── index.html
├── package.json
├── README.md
├── tests/
│   ├── atlas-style.test.mjs
│   └── location.test.mjs
└── src/
    ├── main.js
    ├── features/
    │   ├── location/
    │   │   ├── geolocation.js        # Device request and errors
    │   │   ├── accuracy.js           # Geodesic radius polygon
    │   │   ├── location-overlay.js   # Map marker and accuracy layers
    │   │   └── location-controller.js # Button interaction
    │   ├── map/
    │   │   ├── config.js
    │   │   ├── map.js
    │   │   └── styles/
    │   │       ├── palettes.js
    │   │       └── tropical-atlas.js
    │   └── theme/
    │       └── theme.js
    └── styles/
        ├── tokens.css
        ├── base.css
        ├── map.css
        └── location.css
```

### Implementation notes

Changing between the two OpenFreeMap base styles with `setStyle()` can discard dynamically added GeoJSON layers. The GPS accuracy layer is automatically reconstructed on MapLibre's `style.load` event. The GPS dot is a normal coordinate-anchored MapLibre Marker and continues to follow map transforms. The map and its gestures are never recreated by theme switching.

The app has no production build step or runtime npm packages: GitHub Pages can serve the static ES modules directly. Node.js 22+ is used for local tests (`npm test`) and GitHub Actions runs the tests automatically on pushes and pull requests.

### On-device validation checklist

Check location grant, denial, timeout, initial camera recentering, repeated locate taps, panning away after locating, circle persistence through light/dark switching, map attribution visibility, button appearance in both modes, and Safari safe-area behavior. Automated unit tests cannot replace testing actual iPhone GPS/browser permissions.

### Archived prototype

The original version remains in [`archive/pre-revamp-2026-11-07`](../../tree/archive/pre-revamp-2026-11-07), original commit `82862a90c3137e226922a39688791c4dc9e56c76`.

## Next milestone

Validate on iPhone Safari, then introduce destination search and accurately anchored map pins.
