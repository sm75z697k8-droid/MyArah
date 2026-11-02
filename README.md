# MyArah v4 — Compact Scrollable Bottom Sheet

A minimal, premium, iPhone-first map prototype with an interactive map. Inspired by the clarity of modern navigation apps, without using Apple branding or proprietary assets.

## Included
- Responsive map-first UI and iPhone safe-area support
- Compact-by-default bottom sheet with swipe-up/down positions, tappable grab handle, and vertically scrollable expanded content
- **NEW:** smoother bottom-sheet settling with frame-batched touch dragging, quick-flick behavior, and softer transitions
- **NEW:** distinctive circular compass rose icon (separate from the GPS location arrow)
- Gentler 2D/3D and north-reset camera movements, respecting Reduce Motion
- Pan/zoom, five sample Malaysian city destinations, and animated map camera
- Location button (needs browser permission and HTTPS)
- Light and dark OpenFreeMap basemaps, north reset, plus 2D and 3D map modes with *real building extrusions where OpenStreetMap geometry exists*
- Accessible search dialog, reduced-motion preferences, and proper map attribution

## Publish on GitHub Pages from an iPhone
1. Create or open a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the **root** of the repository.
3. Go to Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
4. Open the GitHub Pages URL in Safari. To install the shortcut, choose Share → Add to Home Screen.

No build step, package manager, server, or API key is required for this demo. Internet access is needed for MapLibre, OpenFreeMap map tiles and 3D building vector data. Switching light/dark rebuilds the 3D overlay automatically.

## Using the bottom panel
- At launch, the sheet takes up only enough space for **Where to?** and **Find a destination**.
- Drag the handle or the heading upward to reveal the Malaysian city shortcuts; drag again to expand. Drag downward to collapse.
- Tap the small handle to cycle through **compact → medium → expanded → compact**.
- Once expanded, scroll **inside** the panel vertically; the map behind it remains pannable outside the panel.
- City selection collapses the sheet to show the map again.
- This polish preserves the existing OpenFreeMap map, 2D/3D toggle, GPS, dark mode, search, bottom panel design, and original project structure.

## Limitations
- Search uses only the five sample cities; not a live Malaysian addresses database.
- No driving route, turn-by-turn navigation, traffic, spoken directions, or flood/toll data.
- The 3D toggle tilts and rotates the map, zooms closer when needed, and overlays real extruded building geometry from OpenFreeMap where mapped. Some locations have no 3D building geometry; this is **not** 3D terrain.
- GPS is a one-time location fix, not continuous navigation tracking.
- Public tile/demo hosting has usage terms and limits. For a production navigation service, select a properly licensed map tile provider and routing/geocoding APIs.

## Credits
Map engine: [MapLibre GL JS](https://maplibre.org/). Basemaps and 3D building geometry: [OpenFreeMap](https://openfreemap.org/), based on [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Attribution appears on the map.

## Edge-to-edge iPhone map and top controls

- This update is **based on your uploaded files**. No map, bottom-sheet, search, or navigation features were removed.
- The map is laid out edge-to-edge. The app has a translucent gradient treatment for the top safe area, with the actual search and theme buttons positioned **below** the Dynamic Island/status indicators.
- The search field has a calmer compact look and a small MY indicator. The dark/light toggle swaps between a moon and sun graphic; it also updates the page theme-color.
- For a Home Screen web app, `apple-mobile-web-app-status-bar-style=black-translucent` requests that iOS draw the map under its status bar. The iPhone's actual status-bar indicators remain controlled by iOS; behavior can vary across iOS versions.
- In regular **Safari**, webpages cannot hide the browser's own address bar or draw behind iOS-controlled browser chrome. Open Safari → Share → Add to Home Screen → enable **Open as Web App** for the closest full-screen experience.
- If you installed MyArah before this change, **remove the old Home Screen icon and add it again** if the status-bar presentation has not updated; Safari may cache standalone-mode metadata.
- **Known iOS limitation:** WebKit bug 301994 describes an iOS 27 Home Screen web-app status-bar strip that can remain opaque even with `viewport-fit=cover` and `black-translucent`. If iOS keeps this region outside the webpage viewport, HTML/CSS cannot paint map tiles into it. See https://bugs.webkit.org/show_bug.cgi?id=301994.
- GitHub Pages still works with these four files only. No build step is needed.


## Bottom blank-space update

- This update uses the original uploaded MyArah files; all screen elements, map
  controls, styles, 2D/3D buildings, and bottom-sheet gestures remain in place.
- Root elements and the map container now share the same viewport dimensions.
  A Home Screen web app uses the large viewport (`100lvh` where supported),
  while Safari still uses the responsive `100dvh` height.
- A viewport resize hook resizes the WebGL map when iOS changes visible bounds.
- When updating, replace `styles.css` and `app.js`. You can leave `index.html`
  exactly as it was, but the ZIP includes the unchanged file for convenience.
- **Important iOS limitation:** Some iOS 26/27 versions have a WebKit bug that
  reserves an OS-owned strip below the actual webpage viewport in Home Screen
  apps. That strip cannot be filled with interactive map tiles by CSS or JS;
  the issue is reported at https://bugs.webkit.org/show_bug.cgi?id=301994
  The changes above address page-layout gaps, not OS-owned letterboxing.
- After publishing, reopen the Home Screen app fully. If the gap persists,
  try opening the same GitHub Pages URL directly in Safari to compare.
