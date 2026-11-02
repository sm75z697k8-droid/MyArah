# MyArah v3 — Malaysia Map UI

A minimal, premium, iPhone-first map prototype with an interactive map. Inspired by the clarity of modern navigation apps, without using Apple branding or proprietary assets.

## Included
- Responsive map-first UI and iPhone safe-area support
- Pan/zoom, five sample Malaysian city destinations, and animated map camera
- Location button (needs browser permission and HTTPS)
- Light and dark basemaps, tilted camera (3D perspective, **not** 3D buildings), north reset
- Accessible search dialog, reduced-motion preferences, and proper map attribution

## Publish on GitHub Pages from an iPhone
1. Create or open a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the **root** of the repository.
3. Go to Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
4. Open the GitHub Pages URL in Safari. To install the shortcut, choose Share → Add to Home Screen.

No build step, package manager, server, or API key is required for this demo. Internet access is needed to load MapLibre and tiles from their public hosting services.

## Limitations
- Search uses only the five sample cities; not a live Malaysian addresses database.
- No driving route, turn-by-turn navigation, traffic, spoken directions, or flood/toll data.
- The 3D toggle tilts a raster map, it does not show extruded buildings.
- GPS is a one-time location fix, not continuous navigation tracking.
- Public tile/demo hosting has usage terms and limits. For a production navigation service, select a properly licensed map tile provider and routing/geocoding APIs.

## Credits
Map engine: [MapLibre GL JS](https://maplibre.org/). Map imagery: [CARTO basemaps](https://carto.com/basemaps/) and [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Attribution appears on the map.
