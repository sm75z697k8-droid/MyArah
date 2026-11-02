# MyArah v4 — 2D / 3D map

A minimal, mobile-first Malaysian map prototype designed for GitHub Pages and iPhone Safari.

## Upload to GitHub Pages
Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the root of the existing MyArah repository. In Settings → Pages, deploy from the `main` branch and `/ (root)`. No build step required.

## Features
- Interactive map using MapLibre GL JS and OpenFreeMap vector map styles
- 2D top-down and 3D perspective modes, with 3D buildings **only where the underlying vector style exposes building polygons**
- Light/dark styles, north reset, zoom, user GPS location (permission required)
- Ten sample Malaysian city shortcuts
- iPhone safe-area-aware map UI

## Notes
- This is a **map prototype**, not a navigation or traffic app. It does not calculate routes, search arbitrary addresses or provide turn-by-turn directions.
- 3D mode always tilts the map; 3D buildings depend on map data and may not appear at all locations.
- Map and MapLibre scripts require an internet connection. OpenFreeMap hosting is operated by a third party; check the provider's terms and capacity before a production launch.
- Geolocation requires HTTPS and user permission; GitHub Pages supplies HTTPS.
- Preserve map attribution and comply with OpenStreetMap / map-provider requirements.

## Source
- MapLibre: https://maplibre.org/maplibre-gl-js/docs/
- OpenFreeMap: https://openfreemap.org/
