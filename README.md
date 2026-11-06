# MyArah

A Malaysia-first navigation project, currently being rebuilt with a map-first approach.

## Current milestone: plain interactive map

The `main` branch currently includes:

- A real, full-screen, interactive vector map, powered by [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) v6.16.0 and [OpenFreeMap](https://openfreemap.org/quick_start/).
- Map panning and pinch-to-zoom, with the initial view centered between Peninsular and East Malaysia.
- Two map styles: OpenFreeMap **Positron** (light) and **Dark**, following device appearance unless manually overridden by the small theme button.
- A safe-area-aware layout for iPhone Safari, map attribution and a connection-failure message.

Not implemented: search, GPS location, routing, turn-by-turn guidance, voice, traffic, lane guidance, speed limits, road elevation or 3D mode. No simulated navigation or live-data claims are made.

## File structure

```text
MyArah/
├── .gitignore
├── README.md
├── index.html
└── src/
    ├── main.js
    ├── features/
    │   ├── map/
    │   │   ├── config.js
    │   │   └── map.js
    │   └── theme/
    │       └── theme.js
    └── styles/
        ├── tokens.css
        ├── base.css
        └── map.css
```

Static ES modules keep this project editable directly from an iPhone using GitHub; no build step or npm install is required. Internet access is required to load the MapLibre package and OpenFreeMap tiles.

## Preview

Serve the root directory over HTTPS (for example, GitHub Pages if configured). Do not open `index.html` as a local `file://` URL: ES module imports typically require an HTTP(S) origin.

## Theme behavior

Initially follows the device light/dark setting. Tapping the theme button sets an explicit choice in `localStorage`, which remains in effect on future visits. To return to automatic appearance, clear the site's stored preference `myarah.map.theme`. Changing map styles keeps the current camera position.

## Architecture notes

- External map styles: `src/features/map/config.js`. OpenFreeMap provides the map data; theme colors are owned by the provider style JSON, not the CSS token file.
- Rendering and gestures: `src/features/map/map.js`.
- Persisted theme and system appearance: `src/features/theme/theme.js`.
- Loading/error state and startup: `src/main.js`.
- CSS design tokens, base layout and map UI are kept separate.

A custom Malaysian cartographic theme can be developed later after the provider styles have been tested on iPhone. Confirm provider availability, licensing and usage policies before scaling beyond this prototype.

## Previous app

The complete pre-redesign prototype is preserved in branch [`archive/pre-revamp-2026-11-07`](../../tree/archive/pre-revamp-2026-11-07), original commit `82862a90c3137e226922a39688791c4dc9e56c76`. Earlier Cloudflare Worker deployments are not automatically disabled by removing their source code from `main`.

## Next milestone

Review the daylight/night cartography on-device, then add the minimal reusable app controls and search interface.
