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


## Softer, clearer navigation voice (this update)

- When **Voice on** is enabled, MyArah chooses a natural-sounding English voice from the voices the device/browser exposes. It prefers higher-quality English voices if available, with the default English voice as a fallback. Availability and accent vary by iOS version and installed system voices.
- Slower (0.88), natural-pitch speech at a slightly gentler volume helps make junction instructions and Malaysian road names easier to hear. Your iPhone volume remains under your control.
- Spoken instructions now use conversational distances such as **“In 200 metres, turn left”**, not “200 m. Turn left”. Provider messages that already include a distance aren't prefixed twice. The on-screen TomTom instruction is unchanged.
- If GPS jumps over both announcement thresholds, the more urgent instruction is spoken once rather than immediately being interrupted by another prompt. The arrival announcement is now allowed to finish after the trip closes automatically.
- The existing **Voice on/off** button stays. No new controls, UI sections, services, keys or audio downloads are needed. Spoken guidance still uses device Web Speech API and still requires MyArah in the foreground.
- A web app **cannot force Apple Siri's voice** or guarantee that a particular high-quality voice exists. Speech output may still be interrupted by iOS policies.
- Scope: `app.js` voice selection and announcement wording, `index.html` version refresh, and README. `styles.css` and all routing, GPS, markers, traffic and screen-awake behavior are unchanged.


## Turn-by-turn instruction timing refinement

- Upcoming turn switches only **after** passing its route offset (plus a small speed-scaled GPS buffer), rather than prematurely.
- Preparation cue is approximately **27 seconds before** a maneuver, bounded to 160–850 metres; action cue is approximately **8 seconds before**, bounded to 42–235 metres. Both adapt to the car's accepted GPS speed (actual values depend on road speed and GPS fixes).
- Uses accepted route-matched progress only. Stale, off-route and rejected GPS fixes do not trigger instructions.
- A leap across both thresholds selects the more urgent action cue. Speech is not marked as spoken while muted, hidden or unavailable.
- Preserves calm iPhone TTS voice/rate. Early warnings wait for existing speech to finish; near-turn prompts can supersede outdated warnings when necessary.
- Arrival is phrased as approaching until GPS verifies arrival.
- Timing history resets after route recalculation, starting and ending navigation.
- No new UI/buttons, permissions, third-party services or exposed API keys.
- Test while stationary or as a passenger first; live turn timing depends on GPS accuracy and iOS speech availability.


## Improved navigation ETA and remaining distance

- Initial ETA still uses TomTom's traffic-aware travel duration; it is **not** a new live traffic request.
- During navigation, remaining distance is based on confidently matched route progress, not every noisy GPS sample. Implausible large progress jumps require a second agreeing fix before the distance display advances.
- Once there is enough reliable movement data, recent pace makes a **bounded, local** ETA adjustment. A few slow streets cannot predict traffic along the entire route; the adjustment covers at most three minutes of the planned remaining driving time.
- ETA refreshes every 12 seconds while MyArah is open, even while stationary; it moves later if the car is not progressing instead of freezing on an old clock time.
- After roughly 28 seconds without a reliable matched GPS fix, the footer says **GPS delayed** and holds the last trusted distance. Confirmed off-route travel displays **ETA — · off route** until you rejoin or recalculate.
- Starting a new route and recalculating reset pace history and start again from the new TomTom estimate. The interval stops when navigation ends.
- No additional buttons, requests, API keys, or visual panels. Existing light/dark design, voice, GPS smoothing, traffic layers, search and route timing are unchanged.
- This is an **approximate** ETA, not continuously rerouted live traffic. Road conditions ahead can change, and GPS gaps may reduce accuracy. Real-device driving tests are still needed.


## Landscape navigation refinement
- Compact left-column navigation layout for landscape orientation, so the map stays visible.
- Added a “Then” upcoming-turn preview under the main turn card, similar to Apple Maps / Google Maps.
- Navigation footer buttons reflow into a 2-column grid in landscape for better readability.
- Added an ETA safety fallback to avoid displaying “Invalid Date”.


## Landscape icon dock refinement
- Landscape navigation now shows **56px circular icon-only buttons** centered along the bottom, rather than wide word buttons. On narrow landscape screens, controls stay at least 52px across.
- Left-side journey information is a separate small glass pill; the full-screen footer backdrop is transparent and does not block map gestures.
- Buttons keep their existing functions: voice on/off, recenter/follow, recalculation (when off-route), and End. Toggling them no longer removes the icons because JS updates text-only child spans and ARIA labels instead of entire buttons.
- The screen reader names and active/disabled states remain available; the word labels remain visible in portrait. Colors and contrast are tuned for light and dark appearances.
- The icons are embedded inline, so **they work without loading any new icon CDN at run time**. They use SVG paths based on the [Lucide Icons](https://lucide.dev/icons) designs: [volume-x](https://lucide.dev/icons/volume-x), [volume-2](https://lucide.dev/icons/volume-2), [locate-fixed](https://lucide.dev/icons/locate-fixed), [refresh-cw](https://lucide.dev/icons/refresh-cw), and [circle-stop](https://lucide.dev/icons/circle-stop).

### Lucide licensing notice
The embedded vector icon artwork is derived from Lucide Icons (https://lucide.dev), copyright (c) Lucide Icons and Contributors, under the ISC License.

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies. THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING FROM, OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.


## Automatic rerouting and "Proceed to the route" (November 2026)

- MyArah **automatically recalculates** when repeated, accurate GPS fixes confirm you have driven away from the chosen route. It waits for actual movement rather than acting on one noisy fix.
- A vehicle starting near a mapped road (e.g. inside a shopping mall parking lot) sees **Proceed to the route** instead of premature turns. Two solid on-road GPS readings resume normal guidance.
- Auto reroute uses the latest **raw** GPS coordinates and the existing TomTom Routing API (traffic-aware, driving directions). It does not snap the request origin to the old route.
- Requests are limited to one at a time with a **45-second automatic cooldown** to protect API usage and prevent repeated route changes. Manual Recalculate remains available as an error fallback.
- Recalculating resets route progress, next-turn, road matching, and ETA state. A trip-end cancels pending requests so an old result cannot overwrite a later trip.
- This remains a **foreground-only** web-app navigation prototype. GPS and provider routing can be inaccurate around multi-storey car parks, tunnels and parallel roads; only rely on safe, legal road maneuvers and normal driving judgment.
- No new buttons or panels added. The existing circular navigation dock and portrait controls are preserved, as are light/dark styles, voice, screen-awake, search and traffic layers.

### Test suggestions

1. While parked a little away from the road, begin navigation: it should say **Proceed to the route** and should not repeatedly recalculate while stationary.
2. Join the blue route: after a couple of accurate GPS fixes the normal turn instructions return.
3. As a passenger on a familiar route, deliberately take a different *legal* turn: after several accurate moving fixes, MyArah should quietly recalculate.
4. Switch away/return and end navigation while routing is in progress; no stale route should replace the trip.

Your TomTom key is still entered on your device and is not bundled in the ZIP.


## Navigation camera refinement (MyArah Camera v1)
- The camera now tracks the **displayed blue GPS marker** rather than easing ahead of it toward each newest GPS fix.
- Heading settles around bends using the shortest rotation; it won't turn in circles while parked.
- Speed adjusts viewing distance gently: slower movement shows more detail, faster driving shows more road ahead. This is a camera-only change, not speed-limit guidance.
- Landscape framing shifts the location indicator into visible map space to the right of the turn banner and above the floating round controls; portrait positioning leaves room above the marker for the road ahead.
- Updates are limited to approximately 20 camera updates per second and stop when the marker and camera are settled, reducing unnecessary work on iPhones.
- Starting navigation, Recenter and rotation use a short camera transition; manual dragging pauses follow until Recenter is tapped. Reduced Motion is honored.
- No changes to TomTom API usage, GPS matching, ETA, traffic, arrival detection, UI layout, or routing instructions.
- Update the repository's `app.js` and `index.html` only. `styles.css` is byte-for-byte unchanged.
- Test while stationary or as a passenger first; this is an iterative browser navigation prototype and is not validated for driving safety.


## Portrait glass navigation & correct arrival guidance

- In portrait, the navigation actions now use the existing embedded Lucide SVG icons in round liquid-glass buttons; no external icon network is required. Voice, Recenter, optional Recalculate and End retain their original behavior. The remaining-distance/ETA pill floats independently above the dock.
- The landscape layout and existing route, traffic, GPS, camera, keyboard, and wake-lock logic are preserved.
- Arrival-looking instructions supplied near the beginning or middle of a TomTom route are excluded from live maneuver selection. A valid final arrival instruction is displayed as **Continue towards your destination** or **Destination ahead**, not **You have reached** before actual arrival.
- The app's original actual-arrival handler still requires multiple accurate GPS readings near the destination and near-complete route progress before finishing navigation.
- Added CSS contrast adjustments for light and dark map appearances; user-facing navigation actions retain accessible labels even though button text is visually hidden.
- `index.html` references fresh CSS/JS asset versions to avoid Safari / Home Screen stale cache.


## Filled navigation direction arrow — latest version
- During turn-by-turn navigation, the moving map marker uses a **solid blue filled direction arrow** instead of a round GPS dot.
- The arrow uses the selected route's travel direction, adjusted for map rotation; off-route it uses valid GPS course where possible. It is not meant to indicate the direction in which the phone is pointed.
- Outside active navigation, your familiar blue GPS location dot and phone-facing cone are unchanged.
- The filled arrow has a contrasting edge and a low-glare shadow for both light and dark appearances. Navigation buttons, route instructions, traffic and screen-awake behavior are unchanged.
- The SVG is embedded in app.js and does not need to download during navigation.

### Icon credit and license
The filled direction arrow is based on **Tabler Icons: navigation-filled** by Paweł Kuna and contributors (https://github.com/tabler/tabler-icons). MIT License, copyright © 2020–2025 Paweł Kuna.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


## Maneuver icon refinement (2026-11-03)
- The large guidance arrow and the smaller **Then** arrow now use real inline SVGs, rather than platform-dependent Unicode symbols.
- SVGs adapt to route instructions: straight, left/right, slight turns, U-turns, roundabouts, merging and destination.
- **Proceed to the route** displays a dedicated winding-route icon rather than an ordinary turn arrow.
- Slightly improved next-turn contrast with a soft blue icon tile in both light and dark mode; layout and controls otherwise unchanged.
- Fixed a pre-existing CSS issue: **Then** now really hides when there is no next instruction or while showing **Proceed to the route**.
- The turn/route calculation, arrival filtering, voice, route matching and landscape/portrait controls are not modified by this update.
- To update GitHub Pages replace `index.html`, `styles.css` and `app.js` (the versioned links in HTML refresh cached assets).

### Navigation icon attribution
Based on icons from [Lucide](https://lucide.dev/icons/), under the [ISC license](https://lucide.dev/license).
Copyright (c) 2026 Lucide Icons and Contributors.
Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted,
provided that the copyright and permission notice appear in all copies.
THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE.
The SVGs are embedded in `index.html`/`app.js` and require no external download during navigation.


## Navigation instruction clarity refinement
- The turn banner now presents the **maneuver/action** in a strong primary line, with the provider's **road or exit detail** below it where available.
- The original TomTom wording is still used by voice guidance; this update changes the on-screen presentation only.
- The **Then** row now shows only meaningful nearby maneuvers (turns, exits, merges, lane-keeping decisions, roundabouts). It skips ordinary “Continue straight”, centre-keeping, and tollgate notices, and hides next steps that are too far away.
- Roundabout ordinal exit numbers are preserved where supplied by the provider. Unrecognized provider wording is retained as secondary text rather than invented or silently discarded.
- The car-park “Proceed to the route” and recalculation states clear old road details so stale directions cannot linger.
- All navigation and search functionality, SVG icons, GPS smoothing, automatic rerouting, traffic, wake-lock, and light/dark layouts remain in place.
- No extra buttons or API requests. Actual driving/on-device validation is still required.


## GPS speed and refined glass (November 2026)

- During an active navigation trip only, a small read-only **km/h** circle displays an approximate vehicle speed from the phone GPS. This is **not** the vehicle's speedometer or a road speed limit.
- Uses geolocation `coords.speed` (metres/second), falling back to cautiously estimated movement between accurate GPS points only when the reported speed is unavailable. Speed is smoothed to reduce jitter; the dial shows **—** if readings are missing or stale rather than guessing.
- It reuses the existing navigation GPS watcher, without more GPS polling, new API requests, buttons, or permissions. Starts and stops with navigation.
- Refines glass on map GPS, 2D/3D, compass, navigation action buttons, trip summary and maneuver panel using asymmetric reflections, stronger rims, color-tinted saturation and lighter blur; the traffic button is intentionally unchanged.
- Both light and dark modes retain high-contrast icons and labels, including visible pressed/active state. Reduced Motion and Increase Contrast are respected where supported.
- **Limit:** native Apple Liquid Glass uses live optical refraction not available as a generic CSS effect over an animated MapLibre canvas on iOS Safari. This uses a lightweight visual approximation rather than a WebGL effect that could harm navigation performance.
- Files to replace in GitHub: `index.html`, `styles.css`, `app.js` and (optionally) `README.md`. The versioned URLs in `index.html` help clear iPhone caches.


## Experimental optical Liquid Glass (iPhone performance test)

This version deliberately tries **live refractive glass** for MyArah's small circular
map/navigation controls and speedometer. A WebGL MapLibre frame is sampled and
warped in small 2D canvases, producing **actual pixel displacement** (minor color
separation near the edges) rather than only blur. It is an experimental web
simulation — **not Apple's native SwiftUI/UIKit Liquid Glass**. That native
material is not exposed to GitHub Pages / ordinary web apps.

- **Test on:** open the normal MyArah URL; the experimental effect is on by default.
- **Compare / disable:** append `?glass=off` to your GitHub Pages URL and reload.
  This turns OFF the lens rendering **and** MapLibre's extra drawing-buffer
  preservation; you get the previous efficient CSS layered-glass appearance.
- No new visible buttons or settings. Existing GPS, traffic, speed detection,
  navigation and routing logic remains unchanged.
- Lens sampling is limited to 10 updates/second and small circles. The route
  text panels keep strong backgrounds for readability; the red End button is
  intentionally not transparent. Traffic styling remains unchanged.
- **Possible costs:** more GPU memory, heat, battery use, or lower frame rate on
  iPhone. Safari or device policies may disallow map-pixel capture; then the
  lens automatically falls back to the previous glass and logs a warning.
- Test while parked or as a passenger, particularly camera movement and
  scrolling, and compare `?glass=off`. The extra GPU work may not be worth
  the effect; the faster version is always available.


## Speedometer visibility and map-arrow alignment fix
- Corrected an experimental Liquid Glass CSS specificity conflict that moved the navigation speedometer from its absolute map position into normal page flow. It now remains visible as a circular `km/h` dial whenever navigation is active, including with optical refraction enabled. If speed is unavailable, the dial displays a dash.
- Accepts the browser's valid native GPS speed with the existing 85 m positioning-accuracy threshold instead of 45 m; when iOS omits speed, uses conservative two-fix displacement estimates (up to 20 seconds apart) to avoid false readings from stationary GPS drift. It remains an approximation, not a calibrated speedometer.
- Navigation arrow orientation now follows the projected tangent of the **selected route** at the marker's animated progress, accounting for MapLibre's map pitch, bearing and perspective. When not safely matched, it retains the existing heading behavior rather than falsely snapping to the old route.
- Large GPS corrections no longer animate the matched arrow in a straight line across corners; they snap to the actual polyline, then resume normal along-route smoothing.
- Removed extra CSS rotation lag during bends. Off-route detection, traffic, map styles, search, screen wake, glass effect and navigation controls remain unchanged.
- For performance comparison, `?glass=off` still disables experimental refraction.


## Landscape speedometer alignment
Aligned the left edge of the speedometer with the existing trip-summary glass pill on notched iPhones, including when experimental optical glass is enabled. Portrait layout, speed reading, and navigation logic are unchanged.


## Voice modes — automatic guidance and glass popup (November 2026)

- **Normal (default):** voice guidance automatically enabled when navigation starts. All turn instructions and important route-change / arrival alerts are spoken when the browser allows speech playback.
- **Only Alerts:** no routine maneuver speech; announces important situations such as leaving the route, route recalculation success/failure, joining a new route, and confirmed arrival.
- **Off:** all guidance speech is muted. Changing modes cancels any in-progress utterance.
- Tap the existing circular speaker button in **portrait or landscape** to open a glass popup with three different SVG icons, clear descriptions, selection indicators, backdrop dismissal, and keyboard accessibility. The popup animates from the speaker button toward the middle and supports Reduced Motion.
- Your last choice is stored as `myarahVoiceModeV1` on this device. A fresh installation defaults to Normal.
- Speech timing and GPS/route logic remain unchanged, except necessary alert calls.
- Voice selection prefers better-quality voices when they are returned by the browser; the speech rate is now 0.98 rather than an unnaturally slow 0.88.
- **WebKit limitation:** Safari's Web Speech API may not expose downloaded Enhanced/Premium/Siri voices. The result cannot be guaranteed to sound like a natural AI voice. A cloud neural TTS service would require a secure server-side proxy for credentials, network access, usage costs and driving latency safeguards; no API key is embedded in this static project.
- iPhone may refuse speech that starts outside a user interaction or when the app is backgrounded. Selecting voice guidance does not override iOS audio policy.


## Landscape map-control alignment
- The Appearance (light/dark) button now sits immediately to the left of Traffic at the top-right, rather than drifting toward the middle of the map on wide iPhone landscape viewports.
- The Traffic, GPS, 3D, and Compass buttons share a common centre line, with their existing visuals and functions preserved.
- Uses the actual landscape right safe-area inset, including notched iPhones.
- Portrait layout, driving navigation HUD, voice popup, routing, the experimental optical glass, and GPS are unchanged.
- This release modifies only `styles.css` and the stylesheet cache URL in `index.html`.


## Smoother Liquid Glass refraction (performance update)
- Keeps the same convex refractive shape, color fringing, glass shading, and existing map/nav layout.
- Captures **one scaled map frame** per optical update rather than transferring the WebGL map separately for every glass circle.
- Caches the lens warping geometry and reusable ImageData until button dimensions change, reducing per-frame CPU work and allocations.
- Targets approximately 20 updates/second (previously capped at 10); adapts down if sampling is expensive on an iPhone.
- Queues a final refraction refresh after movement to avoid a stale-looking last glass frame.
- Pauses when the page is hidden; skips hidden controls.
- `?glass=off` still disables the experimental refraction and WebGL preserved drawing buffer for a lightweight comparison.
- Optical refraction still uses canvas readback; WebKit/iPhone GPU performance and battery consumption can vary. This is not native Apple's Liquid Glass.
- Changed `app.js` (rendering optimization), `styles.css` (lens compositing only), `index.html` (cache refresh), README. Navigation, GPS, ETA, voice and routing functions are untouched.


## Malaysia toll indicators (November 2026)

- Shows a blue ticket pin for TomTom `passTollgate` maneuvers, and an amber road pin for the beginning of TomTom `sections.toll` when no matching tollgate was reported. Amber pins **are not claimed to be payment booths**.
- Selecting a route shows each toll indicator and its distance from the start. Only upcoming toll indicators remain visible as navigation progresses. Alternative routes refresh the list and pins.
- TomTom Orbis Routing v3 gives toll sections but **does not provide Malaysian toll prices**. MyArah displays `RM —` (unavailable) for each entry, not fabricated fares. Rates depend on vehicle class, operator, and often the exact entry/exit plazas.
- The existing route preview links to the official LLM and PLUS toll calculators to check fees. Neither site is scraped or called from the browser.
- This update preserves routing, automatic recalculation, ETA, GPS, voice, speed and experimental Liquid Glass code.


## Verified Malaysia Class 1 toll rates (November 2026)

The app now uses verified *fixed-rate toll-plaza* fees where the selected TomTom route can be confidently matched to a named plaza. Fares are not guessed from section length. Only Class 1 (car) fees are displayed. A partial, identified-charge total is shown when some tolls are still unmatched.

Built-in auto-match locations and published Class 1 rates (RM):
- KESAS: Awan Besar East/West, Sunway, Kemuning — RM2.00 each. Operator: https://kesas.com.my/toll-lane/
- LDP: Penchala, Petaling Jaya, Puchong Barat, Puchong Selatan — RM2.10 each. Operator: https://litrakgroup.com.my/our-highways/litrak/toll-fares/
- SPRINT: Bukit Kiara — RM3.00. Operator: https://litrakgroup.com.my/our-highways/sprint/toll-fares/
- GCE: Bukit Jelutong, Elmina, Lagong — RM1.75 each. Operator: https://www.prolintas.com.my/gce/
- AKLEH: Dato' Keramat — RM2.13. Operator: https://www.prolintas.com.my/akleh/
- SUKE: Alam Damai toll facilities — RM2.30. Operator: https://www.prolintas.com.my/suke/

Plaza coordinates were cross-checked with operator map data (KESAS) or OSM-based Mapcarta locations. These fixed-rate matches apply only to routes near the specified plaza; unknown plazas continue showing RM —. Toll-road section markers alone do not imply a price. These are examples of supported tolls, not nationwide coverage.

Closed-system roads such as PLUS and LPT require the exact entry and exit plazas. The **optional, collapsed fare lookup** loads Class 1 rates from https://github.com/mohdsyahid/kadar-tol-malaysia (MIT-licensed community mirror of the LLM calculator) only when a user opens it. Choose highway and exact plazas, then check. This is independent from route calculation: **it does not automatically identify the entry/exit, and must never be added to the identified plaza total**. It needs internet access and may be unavailable if the external service changes. Always verify the displayed rate at https://www.llm.gov.my/ or https://www.plus.com.my/ before driving.

No private API keys are embedded. Navigation, glass controls and GPS remain unchanged.


## Animated recenter dock — November 2026

- The **Recenter** control is hidden while MyArah's navigation camera is actively following your location. The dock rests as two circular Liquid Glass controls: **Voice** and **End**.
- Manually dragging, rotating, pinching, pitching or zooming the map reveals a **filled blue Tabler navigation arrow**, tilted 13° clockwise. The Voice and End buttons smoothly spread apart as the arrow rises into the centre.
- Tapping the arrow resumes following, slides it down out of view, and brings Voice and End together again.
- The existing **Recalculate** control remains available if automatic rerouting fails or manual recalculation is needed. Its visibility and behavior are unchanged.
- Light/dark contrast, 52–60 px touch targets, and Reduced Motion settings are respected. The hidden control is removed from keyboard/screen-reader navigation.
- All experimental refractive Liquid Glass rendering, toll rates, route guidance, speedometer, GPS, and voice modes are unchanged.
- Icon: reused **Tabler Icons `navigation-filled`** from MyArah's existing map arrow, MIT License (see existing Tabler credit above). No external icon requests are made.

**Update:** replace `index.html`, `styles.css`, and `app.js`; `README.md` is provided for completeness.


## Voice playback reliability fix (iPhone Safari)
- When the user taps **Start navigation**, MyArah immediately speaks a short **“Starting navigation”** confirmation within that user gesture, before the asynchronous GPS check. This initializes WebKit speech playback for later hands-free instructions.
- Selecting **Normal** or **Only Alerts** also plays a short audible confirmation directly from the mode-selection tap. **Off** cancels speech immediately.
- The active SpeechSynthesisUtterance is retained until playback ends; onstart/onerror are monitored. A speech request is only marked as delivered when its start event fires.
- If a device advertises a preferred voice that fails to start, MyArah tries the system default English voice once. It does not silently switch voice modes, invent a voice service, or use a cloud TTS API.
- Speech queues and pending flags are cleared on End, off-screen/app hiding and changing modes. Existing turn timing remains unchanged.
- iOS can still block or mute playback; real hardware verification is necessary. Check iPhone media volume (not just ringer volume), and ensure Normal is selected if you expect spoken turns.


## Frosted Refractive Liquid Glass — responsiveness refinement
- The experimental live-map refraction stays active; it is **not replaced** by ordinary backdrop blur.
- Existing lenses are blended at 54% opacity with a subtle 1.4px frosted diffusion and a translucent light/dark tint, which visually softens the lag of slower optical snapshots.
- Kept lens sampling rate, MapLibre setup, optical warping, navigation, voice, routes, speedometer and controls **identical** to the uploaded build; only `styles.css` and the CSS cache version in `index.html` changed.
- In accessibility high-contrast mode, the map-lens contribution is reduced further.
- `?glass=off` still turns off map refraction and falls back to lightweight CSS glass.
- Please test on an actual iPhone, watching clarity, battery use and whether the map behind controls appears smoother during rotation and zoom.


## Glossy red End Navigation button (UI refinement)
- Replaced the ambiguous stop-square SVG with a bold, rounded white **X** that represents ending the trip. This is **not** a phone hang-up symbol.
- Kept the circular button size, click target, existing `navEnd` ID and its End Navigation event handler.
- Added a glossy red gradient, restrained highlight, fine red rim, and depth to match the supplied picture in both light and dark modes.
- All other controls, refractive/frosted glass, voice playback, routing, toll rates and map behavior are unchanged.
- For GitHub Pages, replace `index.html` and `styles.css` only. `app.js` remains byte-for-byte unchanged.


## Road speed limits and speed warnings (November 2026)

- **Source:** TomTom Orbis v3 Routing API `routes[].sections.speedLimit[]`; legal maximum in `speedRestrictions[].inKilometersPerHour` with `type: maximum`. The app requests this with its existing device-entered TomTom key (`Attributes: routes,routes.sections.speedLimit`).
- While **navigation is active**, a small road-sign badge next to the glass GPS dial displays the speed limit for the confidently matched section of the selected route. A dash means *no usable limit / uncertain position*. No generic speed limit is invented from the road category.
- The circular GPS speedometer turns red when filtered speed exceeds the known limit by **3 km/h or more in two successive trustworthy GPS readings**. It turns neutral when speed drops to within 1 km/h of the limit, avoiding constant flickering.
- The alert is visual only (no extra spoken message). The red warning and limit disappear/clear for off-route, parking-lot joining, reroute, stale GPS, or unsupported road data. Rerouting resets the warning.
- This is **informational, not a certified enforcement system**. Speed limits may be missing, time-dependent, temporarily changed, or incorrect. Obey actual road signs and local law; GPS speed is approximate.
- Existing liquid-glass refraction, toll prices, navigation, automatic rerouting, landscape/portrait positions and voice modes are preserved. No new API key or external speed-limit service is required beyond the existing TomTom Routing API.


## Speed-limit confidence refinement (November 2026)

- Speed limits are now matched to the latest **raw GPS projection on the selected TomTom route**, rather than the deliberately trailing animated blue marker. This improves junction timing without changing navigation camera, marker animation, or route geometry.
- The app leaves speed limits **unknown near section boundaries** using a speed/accuracy-dependent buffer. It waits for repeated consistent GPS matches before displaying a changed limit and won't warn against the previous road's limit during the transition.
- Suppresses misleading readings when a different part of the selected route is plausibly near the GPS position (close parallel roads, U-turns, flyovers) or GPS course conflicts with the route direction. This is a conservative approximation, not lane-level map matching.
- Red overspeed warning requires **two separate trusted over-limit readings spanning at least 850 ms**. A single spike cannot turn the dial red; two below-threshold readings clear it without flickering. GPS loss/off-route/rerouting makes the warning neutral.
- There is no new panel, service, API key, or sound. Existing glass dial and limit badge stay in place. TomTom Orbis v3 `sections.speedLimit` support unchanged.
- Speed limits may be missing, outdated, conditional, or incorrect. Follow posted signs and local laws. Test on a stationary simulator or as a passenger before relying on warnings.
- Replace `app.js` and `index.html` in GitHub Pages; other files are unchanged except this README.


## Voice guidance popover animation refinement

- The voice menu now opens as a small, anchored macOS-style popover above the actual speaker button instead of animating a centered dialog by a separately measured offset.
- Position is calculated before the opening transition, eliminating first-open and reopen origin jumps.
- Reversible, subtle scale/fade motion with a small pointer; repositions on viewport/orientation changes while open.
- All three voice modes, navigation audio, keyboard behavior, and light/dark glass styling remain unchanged.
- Reduced Motion bypasses the movement animation.


## Verified lane guidance (experimental, coverage-dependent)

MyArah can optionally show **recommended lanes** in the current maneuver banner.
It does not claim to know your vehicle's current lane. For each trip it requests
TomTom Maps Routing API v1 with `sectionType=lanes`, which returns per-lane
`directions` and `follow` fields **if the TomTom key is entitled to that API and
lanes have been mapped for the junction**. TomTom Orbis Routing v3, used for
the actual navigation route, does not return these fields.

The classic API supplies a second route; MyArah does **not** replace the Orbis
route. It displays lane guidance only if the legacy route geometry closely
matches the chosen Orbis route (sampled overlap, local offset, nearby section
location, direction and maneuver agreement), the GPS fix is reliably on-route,
and the upcoming maneuver is within a speed-adaptive preparation window that
never exceeds the provider-mapped lane section (maximum 1.25 km). Both the lane
graphics and lane voice phrase are omitted if verification fails.

Normal voice mode may give an earlier lane-preparation cue at driving speeds,
then the usual turn reminder without repeating the lane direction. Only Alerts
and Off keep their established behavior.
No new buttons, keys or unsafe guessed lane directions have been added.
One extra TomTom legacy routing call per started/recalculated navigation session
may count towards your API quota. Classic Routing API entitlement is not
guaranteed by Orbis access; actual coverage in Malaysia remains to be tested.
Always obey road markings, signs and temporary lane closures.
References: https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/guidance-instructions
https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/product-information/migration-guide


## Lane guidance accuracy & timing refinement

- **Speed-aware lane preparation:** the lane banner can appear farther ahead at high speed (up to 1.25 km), instead of a fixed 440 m. It never appears before the matched legacy lane section supports the recommendation.
- **Independent GPS confidence:** lane guidance no longer depends on legal speed-limit detection state. It needs two consecutive reliable fixes, with a minimum confirmation period, and rejects heading disagreement, doubtful route matches and ambiguous nearby branches.
- **Short GPS grace period:** a previously visible recommendation can remain during a brief accuracy dip, for up to about 3.6 seconds. A newly uncertain fix cannot reveal a lane recommendation; confirmed route deviations hide it immediately.
- **Earlier Normal-mode voice cue:** when the verified lane layout and speed warrant it, a preparation message may speak about 38 seconds before the maneuver. The normal turn preparation and action reminders remain; lane wording is not repeated if already announced. Only Alerts and Off remain unchanged.
- **Same interface, no extra controls:** existing lane arrows and Liquid Glass styling are unchanged. Lane guidance is still strictly dependent on TomTom legacy API coverage and agreement with the current Orbis route; no guessed lane positions.

Real-world junction coverage and iOS audio timing require on-device testing. Follow actual signs and lane markings.


## Refinement — Map & 3D clarity
- Uses the same OpenFreeMap vector buildings and TomTom routes. No extra key, request, map controls, or dependencies.
- 3D extrusion is now rendered below basemap place/road labels, so labels remain readable in both appearances.
- Building tint is softer, and opacity decreases while a trip is active; the change animates over 420 ms when navigation starts/stops. Original 2D/3D toggle, building geometry, and real height values are unchanged.
- The selected route's white/dark casing and blue core use zoom-adaptive thickness; alternatives are thinner and lighter. The brighter blue core in dark mode and the deeper blue in light mode improve contrast.
- Light/dark style switches restore the correct map layers, including navigation building emphasis. Route selection, geometry, guidance, traffic, tolls, speed limits, lane advice, search, voice and optical glass are unchanged.
- Real iPhone rendering must still be checked, especially 3D junctions and areas with dense building polygons.
