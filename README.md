# MyArah — Real Malaysia Place Search (built on your latest project)

A minimal, premium, iPhone-first map prototype with an interactive map. Inspired by the clarity of modern navigation apps, without using Apple branding or proprietary assets.

## Included
- Responsive map-first UI and iPhone safe-area support
- Compact-by-default bottom sheet with swipe-up/down positions, tappable grab handle, and vertically scrollable expanded content
- **NEW:** smoother bottom-sheet settling with frame-batched touch dragging, quick-flick behavior, and softer transitions
- **NEW:** distinctive circular compass rose icon (separate from the GPS location arrow)
- Gentler 2D/3D and north-reset camera movements, respecting Reduce Motion
- Pan/zoom and real Malaysia address/place lookup with animated map camera and destination pins
- Location button (needs browser permission and HTTPS)
- Light and dark OpenFreeMap basemaps, north reset, plus 2D and 3D map modes with *real building extrusions where OpenStreetMap geometry exists*
- Accessible search dialog, reduced-motion preferences, and proper map attribution

## Publish on GitHub Pages from an iPhone
1. Create or open a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the **root** of the repository.
3. Go to Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
4. Open the GitHub Pages URL in Safari. To install the shortcut, choose Share → Add to Home Screen.

No build step, package manager, server, or API key is required for basic place search. TomTom traffic still requires your own key on your device. Internet access is needed for MapLibre, OpenFreeMap map tiles and 3D building vector data. Switching light/dark rebuilds the 3D overlay automatically.

## Using the bottom panel
- At launch, the sheet takes up only enough space for **Where to?** and **Find a destination**.
- Drag the handle or the heading upward to reveal recent places (after you have searched for some); drag again to expand. Drag downward to collapse.
- Tap the small handle to cycle through **compact → medium → expanded → compact**.
- Once expanded, scroll **inside** the panel vertically; the map behind it remains pannable outside the panel.
- Selecting a search result or recent place collapses the sheet to show the map again.
- This polish preserves the existing OpenFreeMap map, 2D/3D toggle, GPS, dark mode, search, bottom panel design, and original project structure.

## Limitations
- Search uses Nominatim/OpenStreetMap place data and may miss businesses, addresses, or postcodes that have not been mapped. The public endpoint is for low-volume testing, not a scaled production app.
- Live traffic overlay is optional with a TomTom key. Driving routes, turn-by-turn navigation, spoken directions, flood/toll data and traffic-aware routing are not yet implemented.
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
- The earlier bottom-gap fix updated `styles.css` and `app.js`; for **this real-search release**, replace all four files from the included ZIP.
- **Important iOS limitation:** Some iOS 26/27 versions have a WebKit bug that
  reserves an OS-owned strip below the actual webpage viewport in Home Screen
  apps. That strip cannot be filled with interactive map tiles by CSS or JS;
  the issue is reported at https://bugs.webkit.org/show_bug.cgi?id=301994
  The changes above address page-layout gaps, not OS-owned letterboxing.
- After publishing, reopen the Home Screen app fully. If the gap persists,
  try opening the same GitHub Pages URL directly in Safari to compare.

## Facing-direction cone (new)

- Tap **My location** (the blue location-arrow button). MyArah requests compass/motion permission on iPhone, followed by GPS permission if needed.
- The normal blue location dot stays in the center. A **soft blue cone** appears only after a real heading is received, and rotates smoothly as the phone turns. Its angle is corrected when the map rotates (including 3D mode).
- On iPhone Safari, heading uses `DeviceOrientationEvent.webkitCompassHeading`. Where available on other devices, it may use an absolute device-orientation reading. Relative `alpha` without an absolute reference is **not** used.
- If sensor permission is declined, unavailable, or no reliable compass data arrives, MyArah shows the location dot **without a cone**. This prevents a fake or misleading direction. Some browsers and Home Screen configurations limit sensor access.
- Requires **HTTPS** and location permission. GitHub Pages provides HTTPS. Hold your iPhone in portrait and away from strong magnetic interference for the most predictable results. The direction represents the phone's facing (top edge), not necessarily the vehicle's travel direction.
- This update changes only GPS marker presentation and compass-permission handling; maps, 2D/3D, bottom panel, search, colors, and existing iPhone layout are preserved. GPS is still a one-time position fix when tapped.


## NEW — Real traffic flow overlay (optional)

This version adds **a real traffic map overlay, not fake color-coded roads**. It preserves the original MyArah map (OpenFreeMap), 2D/3D, GPS direction cone, draggable bottom panel and light/dark switching.

1. Open MyArah and press the **three-color Traffic button** above the GPS control. Traffic is off by default.
2. Obtain a TomTom API key: https://docs.tomtom.com/platform/documentation/my-tomtom/how-to-get-a-tomtom-api-key
3. Paste the key in MyArah's live traffic dialog and tap **Connect traffic**. The app first checks one live raster tile. Invalid/expired/over-limit keys will show an error rather than pretending the roads are clear.
4. The road network will be overlaid with color-coded traffic-flow lines. **Green** = free-flowing, **yellow** = slower, **red** = heavily congested. Some closures may be shown separately. Roads without flow data are not necessarily congestion-free.
5. Press the Traffic button again to hide the overlay. Tap the small settings button in the traffic legend (or expand the bottom sheet and choose Traffic settings) to change or forget the key.
6. Traffic layer is re-added after light/dark style changes and periodically reloaded while the app is open. It is **not** a traffic-aware routing feature: driving directions and automatic congestion-avoidance are not implemented.

Data: TomTom Orbis raster flow v2 (https://docs.tomtom.com/traffic-api/documentation/tomtom-orbis-maps/v2/traffic-flow/raster-flow-tiles). TomTom lists traffic flow coverage for Malaysia. Traffic tile requests may incur charges beyond the provider's current allowance.

**API key safety:** The key is entered and stored in this device's browser local storage only; it is not embedded in `app.js` or uploaded to GitHub. However, browser JavaScript / network requests can expose keys. For a production public app, use a secure backend proxy or appropriately restricted public key, plus rate limiting. Do not use a high-value unrestricted key.

## TomTom key setup on your iPhone (no public key in GitHub)

This version intentionally **does not include your TomTom API key** in any HTML, JavaScript, CSS or ZIP file. GitHub Pages serves these files publicly, so embedding the key would make it accessible to anyone visiting the site.

1. Publish these four files to your current MyArah GitHub Pages repository.
2. On your iPhone, open MyArah, press the **Traffic** button, and paste your key into **TomTom Traffic API key**.
3. Press **Connect traffic**. MyArah checks a live TomTom raster tile and turns traffic on only if the request succeeds.
4. The app remembers the key **only in local browser storage on this device** and, after a successful connection, automatically reconnects on future launches.
5. Turning Traffic off also disables automatic reconnection until you turn it on again. **Forget key** clears both the saved key and reconnection preference.

A webpage cannot securely hide a key from browser network requests, even when the key is stored only locally. Restrict the TomTom key to your GitHub Pages domain and to the traffic service in TomTom's key management settings. For a large public launch, proxy requests through a backend that protects the key. Never publish the key in a repository or share screenshots of the Traffic settings with the key visible.

This update does **not** test, validate, or use up quota from your specific supplied API key. Only your browser can make the live request after you paste it.

## NEW — Real Malaysia search (sample cities removed)

- Tap the top **Search Malaysia** bar or bottom **Find a destination** button.
- Enter a Malaysian business, landmark, street address, town, or postcode and press **Search** on the keyboard or the blue **Search** button.
- The app queries OpenStreetMap Nominatim, restricted to Malaysia (`countrycodes=my`), and displays matching names and full addresses. Select one to drop a map pin and fly to it; the bottom panel returns to compact mode.
- The old hard-coded five city samples have been **removed**. The bottom panel now shows up to seven **recently selected places** after your first search.
- Repeat searches are cached locally for seven days; your recent places are stored only in your browser's local storage on that device.
- Search is **submit-only** (no automatic requests while typing). This follows the public Nominatim service policy (no autocomplete, at most 1 request/second). An inter-request delay is enforced. Results and request availability can vary by coverage and service load.
- Nominatim attribution appears in the search panel. Search queries go to a third-party server, so avoid entering sensitive information. This shared public API is intended for limited **development and testing**. **For a public or high-traffic app**, replace it with a contracted geocoding service (or your own hosted instance). Do not rely on the donated public service for production.
- No new API key is needed for the prototype. Your existing TomTom traffic connection remains separate and unchanged.
- **Place search is not routing.** Selecting a result displays a pin on the map; driving directions, travel time, and live navigation have not been built yet.

Official policy: https://operations.osmfoundation.org/policies/nominatim/
API documentation: https://nominatim.org/release-docs/latest/api/Search/
