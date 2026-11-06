# MyArah

Malaysia-first navigation project, rebuilt using a lightweight map-first architecture.

## Current milestone: Tropical Atlas cartography

A real, full-screen, north-up 2D map built with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) v6.16.0 and [OpenFreeMap](https://openfreemap.org/quick_start/) vector tiles. Drag to pan or pinch to zoom.

**Tropical Atlas** offers:

- **Day:** warm limestone land, soft green vegetation, teal water, cream roads and subdued gold highways.
- **Night:** deep petrol land, forest-green parks, blue-green water, clear pale labels and muted gold highways.
- Automatic system light/dark appearance and a manually persistent theme toggle.
- Road geometry, zoom behavior, map attribution, language labels, camera and gestures inherited from the original provider styles.
- No CSS map inversion or fictional geographic data.

This is still a **plain map**, without search, location, routing, turn-by-turn guidance, traffic, voice, lane guidance, speed limits, road elevations or 3D mode.

## Architecture

```text
MyArah/
├── .github/workflows/validate.yml
├── .gitignore
├── package.json              # Tests only; no production dependencies/build step
├── README.md
├── index.html
├── tests/atlas-style.test.mjs
└── src/
    ├── main.js
    ├── features/
    │   ├── map/
    │   │   ├── config.js    # External style URLs and initial camera
    │   │   ├── map.js       # MapLibre creation and theme application
    │   │   └── styles/
    │   │       ├── palettes.js      # Design color roles
    │   │       └── tropical-atlas.js # Source-preserving layer recoloring
    │   └── theme/
    │       └── theme.js     # System theme and localStorage preference
    └── styles/
        ├── tokens.css       # UI overlay colors
        ├── base.css
        └── map.css
```

### How styles work

The app loads the existing OpenFreeMap **Positron** (day) and **Dark** (night) styles at runtime. MapLibre's `transformStyle` callback recolors the recognized base-style layers before drawing, keeping all original sources, layer geometry, road width/zoom expressions and symbol layout untouched. MapLibre's `setStyle` performs theme changes without creating another map instance.

The two source styles have **different layer IDs**, so `tropical-atlas.js` targets recognized layer semantics while leaving unknown layers unchanged. If upstream layer names or structures change, review the overrides and test live rendering again. Original provider sprite, font and source URLs are not rewritten.

### Development / tests

GitHub Pages can serve the repository root without compilation. Internet access is needed for MapLibre and map tiles. Do not open the HTML directly as `file://`.

Use Node.js 22+ and `npm test` to run local color-transformation tests, or let the GitHub Actions workflow run on pushes and pull requests. Tests use built-in Node APIs and do not require `npm install` or external test packages.

**Important:** Unit tests do not replace real iPhone Safari checks. Compare Kuala Lumpur, Johor Bahru, Penang, East Malaysia and motorway interchanges at different zooms; check day/night contrast, font readability and roads visually.

### Theme persistence

When no preference exists, MyArah follows the device. Tapping the toggle saves `myarah.map.theme` as `light` or `dark` in localStorage.

## Previous prototype

The pre-redesign app is preserved at [`archive/pre-revamp-2026-11-07`](../../tree/archive/pre-revamp-2026-11-07), from commit `82862a90c3137e226922a39688791c4dc9e56c76`. Deleting old Cloudflare Worker source from `main` did not remove independently deployed Workers.

## Next milestone

Test Tropical Atlas on a real iPhone, then tune any remaining road/label contrast issues before adding search or navigation controls.
