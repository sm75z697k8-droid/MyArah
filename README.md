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
- At launch, the sheet stays compact with the **Search Malaysia** control.
- Drag the handle or the heading upward to reveal recent places (after you have searched for some); drag again to expand. Drag downward to collapse.
- Tap the small handle to cycle through **compact → medium → expanded → compact**.
- Once expanded, scroll **inside** the panel vertically; the map behind it remains pannable outside the panel.
- Selecting a search result or recent place collapses the sheet to show the map again.
- This polish preserves the existing OpenFreeMap map, 2D/3D toggle, GPS, dark mode, search, bottom panel design, and original project structure.

## Limitations
- Search uses Nominatim/OpenStreetMap place data and may miss businesses, addresses, or postcodes that have not been mapped. The public endpoint is for low-volume testing, not a scaled production app.
- Traffic overlay, traffic-aware route comparison, and foreground turn-by-turn guidance require a TomTom key with the relevant products enabled. Independently verified flood conditions and complete local hazard information are not included.
- The 3D toggle tilts and rotates the map, zooms closer when needed, and overlays real extruded building geometry from OpenFreeMap where mapped. Some locations have no 3D building geometry; this is **not** 3D terrain.
- The Location button takes a one-time GPS fix; **Start navigation** uses continuous GPS while this web app remains open in the foreground.
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


## Update — sharper TomTom traffic and no accidental page zoom

This is a targeted update to the uploaded **MyArah Real Search** project.
The real Malaysia search, recent places, heading cone, 2D/3D mode, draggable sheet,
light/dark theme and TomTom login/storage behavior are unchanged.

### 512 × 512 traffic tiles
- TomTom Orbis v2 flow raster tile requests now use **`tileSize=512`** (instead of `256`).
- The MapLibre raster source keeps **`tileSize: 256` intentionally**: that property is
  the *logical map-grid tile size*, not the downloaded image's pixel dimensions.
  A 512-pixel image of the same tile is rendered at the original 256 CSS-pixel
  grid size for sharper output on high-density iPhone screens, without changing
  road alignment or the map's zoom-level selection.
- No new API key or traffic provider is needed. Traffic remains an optional live overlay.
- 512-pixel images use more bandwidth, and visible sharpness depends on source data.
- This update doesn't replace raster traffic with vector lines.

### Stop Safari webpage double-tap zoom on UI controls
- Use **`touch-action: manipulation`** for the app and interactive controls.
  Rapidly tapping a GPS, compass, traffic, 2D/3D, or theme button should not
  zoom the **webpage** in iOS Safari.
- Normal **map panning and pinch zoom** remain enabled. The map engine can
  still zoom the **map** if you double-tap on the map canvas: that is separate.
- Page pinch zoom for accessibility is not disabled (`user-scalable=no` is not used).
- On older/unsupported iOS versions, some browser-specific zoom gestures may
  still be outside the webpage's control.

### Publish from iPhone / GitHub Pages
1. In your existing repository, replace `index.html`, `styles.css`,
   `app.js`, and `README.md` with the files in this ZIP.
2. Commit; reload MyArah after GitHub Pages finishes deploying.
3. Turn traffic off and on if its old tiles remain cached.

The version suffixes on the CSS/JS links in `index.html` help Safari fetch
the updated assets instead of previously cached copies. No build or installation is needed.

References: TomTom Raster Flow Tiles (Orbis v2), MapLibre raster source tileSize
specification, WebKit `touch-action: manipulation`.

## Search pin accuracy update

- The selected search location uses a **GeoJSON source and MapLibre symbol layer** instead of a floating HTML marker. The tip of the blue destination pin points to the result's longitude/latitude and stays geographically anchored while panning, zooming and using 2D/3D.
- The high-resolution destination icon is generated locally: no external icon requests or new API key.
- The destination pin is restored after light/dark style changes and kept above traffic colors. The blue GPS location dot and heading cone are unchanged.
- No city sample data is added; your real Malaysia search and recent places remain as they were.
- **Search accuracy:** Nominatim may return the centre of a building, street, park or district, not a specific entrance. This update fixes the *display anchoring*, not the geocoder's source coordinates or missing map data.
- On GitHub Pages, replace `app.js` and `index.html`. The CSS is unchanged; the HTML cache-busting query helps Safari load the latest script.


## NEW — Traffic-aware route suggestions (MyArah Routing Preview)

After searching for and selecting a destination, press **Compare driving routes** in the compact bottom panel. MyArah now requests **up to three actual driving routes** from the TomTom Orbis Routing API v3 (one primary route + up to two different alternatives), sorts them by **provider-reported traffic-aware travel duration**, and draws them on your map.

- Your starting point is your **current GPS location** (requires permission and HTTPS). If you cannot or prefer not to share GPS, open route comparison and use **Choose start on map**, then tap the exact starting point on the map.
- The route cards show ETA, distance, traffic delay if reported, and whether toll sections were reported. Blue = selected route, grey = other routes. Tap a card to highlight its exact geometry.
- TomTom calculates routes using live traffic and closures where data is available (`traffic: live`, `routeType: fast`, `maxPathAlternativeRoutes: 2`). It may return **one or two**, not necessarily three. We never invent alternatives or road delays.
- The existing traffic-overlay **TomTom API key** is reused only from this browser's local storage; it is **not embedded in the project**. Routing may require the Routing API product to be enabled on your key and is subject to a **separate usage quota/billing** from traffic raster tiles. Configure your TomTom key using the existing Traffic settings.
- The route preview now offers **Start navigation**, using TomTom guidance instructions and foreground GPS tracking; off-route recalculation is a manual action. Times are estimates; traffic, closures, flooding and local incidents may be incomplete or unverified.
- TomTom uses its **Orbis routing v3 POST API**: https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/calculate-route . The API must permit browser requests from your GitHub Pages origin. If CORS or key restrictions block a request, MyArah shows an error instead of fake route data.
- **Safety/privacy:** your trip start and destination coordinates are sent to TomTom only when you request a route. Don't expose the API key in GitHub; use approved key restrictions or a backend for public deployment. Your key remains visible to your own browser's network requests.
- Keep all four files together in your repository root. `index.html` contains a versioned `app.js` and `styles.css` reference to avoid stale iPhone caching.

This update only modifies the route comparison UI, the map route layers, and related code. Existing search, traffic visualization, GPS direction cone, 2D/3D buildings, and bottom-sheet gestures are retained.


## Live compass dial (new in this update)

- The former arrow-shaped north reset button is now a circular, smoothly rotating compass with a red north indicator and **N / NE / E / SE / S / SW / W / NW** in the centre.
- **MAP** below the dial means it is showing which compass direction is at the TOP of the map, based on map rotation. This is **not** the direction you are facing.
- Tap the compass to enable iPhone motion & orientation permission. When the iPhone supplies a reliable heading, the label changes to **FACING**. The dial then shows the direction in which the *top edge of your phone points*, useful while walking and holding the phone upright. Tapping also resets the map to north-up.
- Motion/compass access requires a supported device, HTTPS (such as GitHub Pages), and permission. When denied/unavailable, the display remains in **MAP** mode and never fabricates facing direction.
- In the feature-complete version, the existing GPS location cone and its compass permission logic are reused; no duplicate sensors are registered.
- Magnetic compass readings can be inaccurate near cars, magnets, and metal. This is not lane-level positioning or a dedicated walking navigation system.
- Styling is original and inspired by familiar circular navigation dials rather than copying Apple artwork.


## Compass update
- The compass now follows **map rotation only**. It no longer switches into a phone-facing mode.
- The control is redesigned as a circular liquid-glass compass, inspired by Apple-style map UI without copying Apple assets.
- It uses a **16-point dial** (N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW).
- The red north indicator rotates around the dial as the map rotates, and tapping the compass resets the map to north-up.


## Control icon refinement
- The **location** and **3D** controls are now aligned with the compass in a consistent circular layout.
- Those controls use a **liquid-glass** treatment to better match the compass and the premium map UI.
- The **location arrow** is slightly rotated and given a soft teal-blue glow, inspired by Apple-style walking/location controls.
- The **traffic control** is intentionally left in its previous style for now, as requested.


## Keyboard and full-screen viewport fix (iPhone)

This small patch is based on the uploaded `MyArah-Icon-Align-GitHub.zip`.
It does **not** change the map style, controls, traffic, routing, search logic,
compass, or bottom-sheet design.

- MyArah keeps the map's existing full-screen layout when the iOS keyboard appears.
- While typing in Search or Traffic API key, their panels track the **visible**
  space above the keyboard. The page itself does not shrink to the keyboard.
- On keyboard dismissal, the page's scroll offset is reset and MapLibre is
  resized once the screen settles; the bottom sheet retains its original state.
- iOS WebKit sometimes retains a stale viewport offset after dismissing its
  keyboard. This mitigates the problem, but system-owned Home Screen safe areas
  and OS bugs cannot always be fixed by website code.
- The original map and all features are preserved. Replace the four root files
  on GitHub Pages; asset URL versions were changed to avoid stale cached files.

### Test on iPhone
1. Launch MyArah from Home Screen. Check that the map fills the screen.
2. Search for a place; type with the keyboard open. The Search dialog should
   fit into the visible area above the keyboard.
3. Tap Done and dismiss the keyboard. The map and bottom sheet should return
   to their full-screen positions.
4. Repeat in Traffic settings, and try portrait/landscape if supported.


## Keyboard recovery v2 (replaces the earlier fix)

- In Home Screen mode, MyArah now locks the map to the full *available webpage height* measured before keyboard focus, rather than relying on potentially changing `100dvh` or `visualViewport.height`.
- The search and traffic dialogs move into the keyboard-visible area while typing. The map itself retains its original height and is resized after keyboard dismissal.
- Removed delayed keyboard autofocus that could cause iOS to scroll the page while the dialog opens. Tap the search field or traffic key field to bring up the keyboard.
- The map and other features are unchanged.
- **Diagnostics:** If a gap is still visible, open the website with `?viewportDebug=1` appended to its GitHub Pages URL (or `&viewportDebug=1` if it already has query parameters). The small panel displays iOS viewport measurements—take one screenshot before opening the keyboard and another after closing it, and share them. Tap the panel to minimize it. It does not display your location or API key.
- **iOS limitation:** In some Home Screen PWA versions, WebKit reserves a strip *outside* the webpage's viewport. CSS/JS cannot draw into that strip. Refer to https://bugs.webkit.org/show_bug.cgi?id=301994 (reopened in 2026). A fixed frame cannot override OS-owned letterboxing.

## Map control visibility update
- Improved contrast for **Location**, **2D/3D** and the 16-point **Compass** in both appearance modes.
- Retained the circular liquid-glass aesthetic, map rotation behavior and existing alignment.
- Stronger compass tick marks, central direction label and red north marker.
- Traffic button remains intentionally unchanged.
- Supports iOS **Increase Contrast** (`prefers-contrast: more`), where supported.
- Only `styles.css`, `index.html` (stylesheet cache version), and this README were changed. `app.js` is identical to the uploaded version.


## Search experience update (map-first)
- Removed the **top search** button; the bottom sheet's **Search Malaysia** control is the single map-screen entry. The existing theme button stays at top-right.
- The search panel slides up with a smooth transform animation, shows **Recents** immediately, and contains **no Find Nearby categories**. Search results appear in the same panel after submitting an explicit query.
- The bottom sheet still supports swipes, traffic settings and route comparisons. Route search, TomTom flow data, maps, GPS, and compass internals are unchanged.
- The search field is not automatically focused: on iPhone, tap it to open the keyboard after the panel settles. This preserves keyboard viewport recovery.
- Light/dark search panels use contrasting text and accessible buttons. `prefers-reduced-motion` is respected.
- The free public Nominatim service is not used for autocomplete; press Search to send a query. Use a production geocoding provider before large-scale release.

- The search sheet grip supports **swipe down to dismiss**; scrolling search results remains independent.


## Search keyboard and swipe-to-remove update
- The search bar is pinned inside the iOS **visible viewport** when the keyboard is shown. Its header remains above a separately scrollable results area; the map keeps its stable full-screen dimensions.
- While typing, the search modal disables transformed entry animations, which can cause text field painting issues in iOS Safari.
- Recent places: **swipe left** to reveal a **Delete** button. Tap Delete to remove that item from local recent-search history. This does **not** delete any map data or the currently selected destination.
- Recent-history removal is local to this iPhone and needs no external service. Full search remains manually submitted to Nominatim (no per-keystroke autocomplete).
- Contrast and readability have been preserved for both light and dark appearance. Test keyboard movement on a real iPhone as viewport behavior varies by iOS version.
- Only the search interface, its viewport styling, and recent history controls were changed; existing traffic, GPS, 2D/3D, routing and compass features stay intact.


## Turn-by-turn navigation preview (foreground only)

This update adds **real provider maneuver instructions**, a continuous GPS watch, smoother live camera follow, optional voice prompts, a compact maneuver banner, a trip footer with remaining distance/approximate ETA, and a controlled manual reroute button when the GPS stays off-route. It is built on the last uploaded MyArah project; search, recent swipe-to-delete, traffic, 2D/3D, pins, the compass, and the iOS keyboard fix remain intact.

### Getting started
1. Open Traffic settings, save a TomTom key **with Orbis Routing v3 access** (subject to routing quota and pricing). No key is embedded in this GitHub package.
2. Search a destination and tap **Compare driving routes**. Allow precise location when prompted.
3. Select a route and tap **Start navigation**. The app checks GPS accuracy and proximity to the route. A manually chosen start point is only a preview: MyArah will request a route from current GPS before navigation.
4. Keep MyArah **open in the foreground**. The map eases toward your current position and upcoming maneuver, with voice directions opt-in. Tap **Recenter** after manually moving the map; tap **End** to stop GPS tracking.
5. When you are repeatedly off-route, the **Recalculate** button becomes available. It uses a new TomTom route request and may count against your quota. It does **not** automatically reroute in the background.

### Technical details and limitations
- TomTom Orbis Routing v3: requests `guidance: instructions`, `instructionPhonetics: ipa`, `Accept-Language: en-GB` and `Attributes: routes`. These are required to obtain guidance messages and offsets. [Official documentation](https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/guidance-instructions).
- GPS: `navigator.geolocation.watchPosition` on HTTPS; updates and permissions depend on browser and device. Marker and map camera animation ease between GPS fixes. Poor GPS readings pause turn progress to avoid giving misleading directions.
- Maneuvers come from the **TomTom response**, not from guessed route geometry. The client approximates position along the returned route using GPS geometry; that is *not* precision map matching or lane guidance. An off-route condition requires several consecutive GPS fixes, and rerouting is manual.
- Time remaining is **an estimate from the original traffic-aware route duration scaled by remaining distance**, not a constantly recomputed live ETA.
- Text-to-speech uses the Web Speech API (if available) only when activated; it may be interrupted by iOS, silent mode, or browser policies.
- **Not a safety-certified navigation system.** Do not rely on this web prototype as the sole navigation aid while driving; obey signs and rules. Test it as a passenger or while stationary before any real-world use. The PWA does **not** promise background tracking, lock-screen directions, CarPlay or accurate lane-level positioning. No autonomous driving or automated traffic hazard detection is included.
- The key stored in browser storage is visible in the browser's own requests. A public app should use an appropriate proxy and provider-approved access restrictions.


## GPS smoothing & local route matching (new)

- During **Start navigation**, MyArah indexes the selected TomTom route and projects sufficiently accurate GPS fixes onto its road geometry. The blue marker glides along that matched route rather than jittering with each raw latitude/longitude reading.
- Nearby route segments are scored with **GPS accuracy, driving heading (only at speed), and recent route progress**. Matching is cautious around U-turns, overpasses, parallel roads and junctions.
- Camera orientation uses a short **look-ahead along the route**, filtered to reduce sudden spinning at low speed. Small stationary position changes do not continuously recenter the camera.
- Noisy, stale, duplicate, or physically implausible GPS fixes are ignored. The existing off-route alert uses the **raw GPS distance** from the route, with repeated-fix confirmation and recovery hysteresis. A point too far or too uncertain to match is **never silently forced onto the route**.
- After rerouting, the geometry index and smoothing state reset to the new TomTom route. Recalculation still starts from raw GPS, not the snapped display marker.
- Arrival now requires two reasonably accurate readings near the destination.

**Scope:** This is *on-device matching to the already selected route*, not a full traffic-aware road-network map-matching service. Nearby parallel streets may still be indistinguishable from consumer GPS alone. Traffic ETA updates, automatic rerouting and lock-screen navigation are still out of scope. Test while parked or as a passenger; don't rely on this prototype for safety-critical driving.

## Automatic screen wake during navigation

When you tap **Start navigation**, MyArah automatically requests a `screen` Wake Lock. No additional wake button, status label, or in-app warning appears. The navigation footer only shows its normal ETA and trip controls.

- The request begins during the existing **Start navigation** tap, even while the app checks the first GPS fix.
- The wake lock is released automatically when navigation ends, the initial GPS check fails, or the app leaves the foreground. It tries to reacquire a lock when an active navigation session returns to the foreground.
- **Limitations:** iOS/WebKit may reject or revoke the request, so screen-awake behavior is best-effort, not guaranteed. A web app cannot override physical locking, Low Power Mode policies or unsupported browser versions. Wake Lock requests normally do not display a permission prompt, but MyArah cannot suppress any iOS system-owned prompt if one appears.
- If the screen still locks, consider temporarily increasing iPhone **Settings → Display & Brightness → Auto-Lock** (if available), then restore your preferred setting afterward.

No changes were made to routing, GPS smoothing, search, traffic, or other map features.


## Refined map pins (this update)
- GPS-origin route planning no longer adds a duplicate green dot. The existing blue live-location indicator remains the visible starting location.
- Manually selected starting points still display a green origin dot so users can distinguish them from live GPS.
- Search destinations now use an original softer, rounded blue pin rendered as a high-resolution vector shape on a canvas. The pin remains a map-native MapLibre symbol anchored to its destination coordinate, including through rotation and 2D/3D changes.
- The pin has a white centre and outline for light/dark map legibility. There are no new runtime dependencies.
- No changes to TomTom traffic, search, navigation, direction cone, wake lock or route ranking logic.
