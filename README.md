# MyArah v4 — 2D / 3D Map Upgrade (built on your v3 files)

A minimal, premium, iPhone-first map prototype with an interactive map. Inspired by the clarity of modern navigation apps, without using Apple branding or proprietary assets.

## Included
- Responsive map-first UI and iPhone safe-area support
- Pan/zoom, five sample Malaysian city destinations, and animated map camera
- Location button (needs browser permission and HTTPS)
- Original light and dark CARTO basemaps, north reset, plus 2D and 3D map modes with *real building extrusions where OpenStreetMap geometry exists*
- Accessible search dialog, reduced-motion preferences, and proper map attribution

## Publish on GitHub Pages from an iPhone
1. Create or open a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the **root** of the repository.
3. Go to Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
4. Open the GitHub Pages URL in Safari. To install the shortcut, choose Share → Add to Home Screen.

No build step, package manager, server, or API key is required for this demo. Internet access is needed for MapLibre, the original CARTO raster map, and (in 3D) OpenFreeMap building vector data. Switching light/dark rebuilds the 3D overlay automatically.

## Limitations
- Search uses only the five sample cities; not a live Malaysian addresses database.
- No driving route, turn-by-turn navigation, traffic, spoken directions, or flood/toll data.
- The 3D toggle tilts and rotates the map, zooms closer when needed, and overlays real extruded building geometry from OpenFreeMap where mapped. Some locations have no 3D building geometry; this is **not** 3D terrain.
- GPS is a one-time location fix, not continuous navigation tracking.
- Public tile/demo hosting has usage terms and limits. For a production navigation service, select a properly licensed map tile provider and routing/geocoding APIs.

## Credits
Map engine: [MapLibre GL JS](https://maplibre.org/). Raster imagery: [CARTO basemaps](https://carto.com/basemaps/). 3D building geometry: [OpenFreeMap](https://openfreemap.org/), based on [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Attribution appears on the map.
