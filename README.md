# MyArah v2 — Map UI

A calmer, map-first Malaysia navigation **UI prototype**. Built with plain HTML, CSS, JavaScript and MapLibre GL JS. Designed for mobile Safari and GitHub Pages.

## Files
- `index.html`: app layout
- `styles.css`: responsive design and animations
- `app.js`: map, sample city selection, GPS, display controls

## Upload from iPhone to GitHub
1. Create or open your GitHub repository.
2. Upload the four files to the **root** of the repository, replacing the old files if upgrading from v1.
3. In **Settings → Pages**, deploy from branch `main`, folder `/(root)`.
4. Open your GitHub Pages URL via HTTPS in Safari.

## Features
- Interactive map with a restrained dark style and optional light map
- Five sample Malaysian cities, including Sabah and Sarawak
- City markers and animated map movement
- 2D/tilted camera, north reset and current-location permission
- Accessible search sheet with sample-city filtering

## Not included (yet)
Real address search, route drawing, directions, traffic, toll fees and continuous/background navigation. The 3D toggle changes the camera pitch; it does not create 3D buildings. This is not a turn-by-turn navigation app yet.

## External services
- MapLibre GL JS is loaded via a CDN.
- Map tiles are served by CARTO, with OpenStreetMap data and attribution shown on the map. Review tile provider terms and usage limits before production. Internet access is needed.
- Geolocation generally requires a secure HTTPS origin and user permission.

No API key is required for this demo. No custom backend.
