# MyArah — Map UI Prototype v0.1

An iPhone-friendly Malaysia map UI prototype with dark styling, city shortcuts, map tilt, and optional device geolocation.

## Files
- `index.html` — page layout and elements
- `styles.css` — responsive styling, neon palette and interface effects
- `app.js` — MapLibre map and UI interactions

## Run on GitHub Pages
1. Create a public GitHub repository (for example, `myarah-map`).
2. Upload **all three** files to the repository root, preserving these names. (README is optional.)
3. Open **Settings → Pages** and choose **Deploy from a branch**, branch `main`, folder `/(root)`, then Save.
4. Open the GitHub Pages URL shown in Settings once deployment is complete.
5. On iPhone, open that HTTPS address in Safari; you can use Share → Add to Home Screen.

## Important limitations
- Internet connection required to load MapLibre and map tiles.
- The `3D` toggle tilts the camera; this demo **does not render actual 3D buildings**.
- Search is limited to five sample cities. No real directions, routing, live traffic or voice guidance.
- Geolocation requires HTTPS (GitHub Pages provides it) and user permission.
- Uses public OpenStreetMap raster tiles **for demonstration only**. Review OSM tile usage policy and switch to a suitable service before substantial production use. Keep attribution visible.
- Some mobile browsers' local `file://` previews may block map modules; publish via HTTPS to test reliably.

## Technology
Vanilla HTML/CSS/JavaScript and MapLibre GL JS loaded via CDN. No build step.
