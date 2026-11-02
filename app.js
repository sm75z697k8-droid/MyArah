import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

// Default map viewpoint only; search results now come from a real geocoder.
const INITIAL_VIEW = {center:[101.6869, 3.1390], zoom:12};
const $ = id => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// CARTO now requires a key; use OpenFreeMap styles without an API key.
// Light and dark use the same map engine and preserve the existing UI.
const mapStyle = isDark => `https://tiles.openfreemap.org/styles/${isDark ? 'dark' : 'positron'}`;
const map = new maplibregl.Map({container:'map',style:mapStyle(false),center:INITIAL_VIEW.center,zoom:INITIAL_VIEW.zoom,pitch:0,bearing:0,attributionControl:true,canvasContextAttributes:{antialias:true}});
let dark=false,tilted=false,chosen=null,userMarker=null,toastTimer;

// v4 map-only enhancement: keep the existing OpenFreeMap basemap.
// An optional OpenFreeMap vector layer supplies real building geometry in 3D.
const BUILDING_ZOOM = 15.7;
const THREE_D_PITCH = 56;
const THREE_D_BEARING = -18;
const cameraFor = zoom => ({
  zoom: tilted ? Math.max(zoom, BUILDING_ZOOM) : zoom,
  pitch: tilted ? THREE_D_PITCH : 0,
  bearing: tilted ? THREE_D_BEARING : 0
});

function add3DBuildings() {
  // Style changes (light/dark) remove custom layers; this restores them.
  if (map.getLayer('myarah-3d-buildings')) return;
  map.addSource('myarah-building-data', {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/planet',
    attribution: '© <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>'
  });
  map.addLayer({
    id: 'myarah-3d-buildings',
    type: 'fill-extrusion',
    source: 'myarah-building-data',
    'source-layer': 'building',
    minzoom: 15,
    filter: ['!=', ['get', 'hide_3d'], true],
    layout: { visibility: tilted ? 'visible' : 'none' },
    paint: {
      'fill-extrusion-color': dark ? '#6d8193' : '#c0cbd7',
      'fill-extrusion-opacity': 0.85,
      'fill-extrusion-height': [
        'interpolate', ['linear'], ['zoom'], 15, 0, 16,
        ['coalesce', ['get', 'render_height'], 8]
      ],
      'fill-extrusion-base': [
        'interpolate', ['linear'], ['zoom'], 15, 0, 16,
        ['coalesce', ['get', 'render_min_height'], 0]
      ]
    }
  });
}
map.on('style.load', add3DBuildings);
function toast(message){const el=$('notice');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3500)}
// Gentle ease-out for small camera changes; honor iOS Reduce Motion.
const cameraEase = t => 1 - Math.pow(1 - t, 3);
function motion(){return reducedMotion?0:1000}
// === Real Malaysian place search. ===
// Nominatim's public endpoint allows manually submitted, low-volume searches.
// It explicitly forbids autocomplete. Cache repeat queries and limit calls.
const SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const RECENT_KEY = 'myarahRecentPlacesV1';
const SEARCH_CACHE_KEY = 'myarahGeocodeCacheV1';
const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_RECENT = 7;
let recentPlaces = readStoredArray(RECENT_KEY);
let searchCache = readStoredObject(SEARCH_CACHE_KEY);
let lastSearchRequest = 0;
let searchJob = 0;
let searchAbort = null;

function readStoredArray(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
  catch (_) { return []; }
}
function readStoredObject(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch (_) { return {}; }
}
function storeJson(key,value) {
  try { localStorage.setItem(key,JSON.stringify(value)); } catch (_) {}
}
function zoomForResult(item) {
  const type = item.addresstype || item.type || '';
  if (type === 'country') return 5;
  if (type === 'state' || type === 'region') return 8;
  if (['city','municipality','county','district'].includes(type)) return 12;
  if (['town','suburb','village','neighbourhood'].includes(type)) return 14;
  return 16.5;
}
function normalizeResult(item) {
  const lng=Number(item.lon), lat=Number(item.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const full=String(item.display_name||'').trim();
  if(!full) return null;
  const name=String(item.name||full.split(',')[0]||'Place').trim().slice(0,130);
  const detail=full.slice(0,260);
  return {id:String(item.place_id||`${lat}:${lng}`),name,detail,coords:[lng,lat],zoom:zoomForResult(item)};
}
// Selected search destination is a native MapLibre GeoJSON + symbol layer.
// Unlike a separate HTML marker, this draws in the same map coordinate system
// as streets and remains geo-anchored through pan, zoom, pitch and rotation.
const SELECTED_PIN_SOURCE = 'myarah-selected-place-source';
const SELECTED_PIN_LAYER = 'myarah-selected-place-pin';
const SELECTED_PIN_ICON = 'myarah-selected-place-icon';
let pinStyleReady = false;

function selectedPlaceData() {
  return {
    type: 'FeatureCollection',
    features: chosen && Array.isArray(chosen.coords) ? [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [...chosen.coords] },
      properties: { name: chosen.name || 'Destination' }
    }] : []
  };
}

function drawSelectedPinIcon() {
  // Hi-DPI icon: 44 x 58 CSS px backed by 88 x 116 physical pixels.
  // Its pointed tip sits at the map coordinate via icon-anchor: bottom.
  const canvas = document.createElement('canvas');
  canvas.width = 88;
  canvas.height = 116;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.beginPath();
  ctx.moveTo(22, 57);
  ctx.bezierCurveTo(18, 49, 6, 33, 6, 21);
  ctx.bezierCurveTo(6, 11, 13, 5, 22, 5);
  ctx.bezierCurveTo(31, 5, 38, 11, 38, 21);
  ctx.bezierCurveTo(38, 33, 26, 49, 22, 57);
  ctx.closePath();
  ctx.shadowColor = 'rgba(20, 48, 80, .33)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#287dd1';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(22, 21, 6.3, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function syncSelectedPlacePin() {
  // A style switch removes images, layers and sources. Recreate if needed.
  if (!pinStyleReady) return;
  if (!map.hasImage(SELECTED_PIN_ICON)) {
    const image = drawSelectedPinIcon();
    if (!image) return;
    map.addImage(SELECTED_PIN_ICON, image, { pixelRatio: 2 });
  }
  let source = map.getSource(SELECTED_PIN_SOURCE);
  if (!source) {
    map.addSource(SELECTED_PIN_SOURCE, {
      type: 'geojson', data: selectedPlaceData()
    });
    source = map.getSource(SELECTED_PIN_SOURCE);
  } else {
    source.setData(selectedPlaceData());
  }
  if (!map.getLayer(SELECTED_PIN_LAYER)) {
    map.addLayer({
      id: SELECTED_PIN_LAYER,
      type: 'symbol',
      source: SELECTED_PIN_SOURCE,
      layout: {
        'icon-image': SELECTED_PIN_ICON,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport'
      }
    });
  }
  // Always keep the pin above roads and the optional traffic overlay.
  map.moveLayer(SELECTED_PIN_LAYER);
}
map.on('style.load', () => {
  pinStyleReady = true;
  syncSelectedPlacePin();
});

function setPlace(place) {
  chosen=place;
  map.flyTo({center:place.coords,...cameraFor(place.zoom),duration:motion(),essential:true});
  // Marker uses map-native coordinates, not an independent DOM position.
  syncSelectedPlacePin();
  $('placeSubtitle').textContent=place.name;
  recentPlaces=[place,...recentPlaces.filter(item=>item.id!==place.id)].slice(0,MAX_RECENT);
  storeJson(RECENT_KEY,recentPlaces);
  renderRecentPlaces();
  closeSearch();
  // New destination: discard stale routes and enable the comparison action.
  resetRouteComparison();
  // The panel stays compact after a destination is chosen.
  setSheetPosition('peek');
}
function appendResult(place,node,kind='search') {
  const button=document.createElement('button');button.type='button';button.className='result';
  const icon=document.createElement('span');icon.className='result-icon';icon.textContent=kind==='recent'?'↺':'⌖';
  const info=document.createElement('span');info.className='result-text';
  const name=document.createElement('div');name.className='result-title';name.textContent=place.name;
  const detail=document.createElement('div');detail.className='result-detail';detail.textContent=place.detail;
  const arrow=document.createElement('span');arrow.className='result-arrow';arrow.textContent='›';
  info.append(name,detail);button.append(icon,info,arrow);
  button.addEventListener('click',()=>setPlace(place));node.append(button);
}
function setSearchStatus(message,error=false) {
  $('searchStatus').textContent=message;
  $('searchStatus').classList.toggle('is-error',error);
}
function renderRecentPlaces() {
  const section=$('recentSection'), chips=$('recentPlaces');
  section.hidden=recentPlaces.length===0;
  chips.replaceChildren();
  recentPlaces.forEach(place=>{
    const button=document.createElement('button');button.type='button';button.textContent=place.name;
    button.addEventListener('click',()=>setPlace(place));chips.append(button);
  });
}
function renderRecentSearch() {
  const node=$('results');node.replaceChildren();
  $('resultsTitle').textContent='RECENT PLACES';
  if(!recentPlaces.length) {
    const empty=document.createElement('p');empty.className='empty';
    empty.textContent='No recent places. Try searching for a Malaysian address, shop, or postcode.';
    node.append(empty);
  } else recentPlaces.forEach(place=>appendResult(place,node,'recent'));
  setSearchStatus('Type a place and tap Search.');
}
function openSearch() {
  const overlay=$('overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  $('searchInput').value='';renderRecentSearch();
  setTimeout(()=>$('searchInput').focus(),140);
}
function closeSearch() {
  $('overlay').classList.remove('open');$('overlay').setAttribute('aria-hidden','true');
  searchJob++;
  searchAbort?.abort();searchAbort=null;
  $('searchSubmit').disabled=false;
  $('searchSubmit').textContent='Search';
  $('searchInput').blur();
}
function displaySearchResults(items) {
  const results=items.map(normalizeResult).filter(Boolean);
  const node=$('results');node.replaceChildren();
  $('resultsTitle').textContent=results.length?'SEARCH RESULTS':'NO RESULTS';
  if(results.length) {
    results.forEach(place=>appendResult(place,node));
    setSearchStatus(`${results.length} result${results.length===1?'':'s'} in Malaysia. Select a place to view it on the map.`);
  } else {
    const empty=document.createElement('p');empty.className='empty';
    empty.textContent='No matching places found. Try a more specific name or add a city/state.';
    node.append(empty);
    setSearchStatus('No results found.');
  }
}
async function submitSearch(event) {
  event.preventDefault();
  const query=$('searchInput').value.trim().replace(/\s+/g,' ');
  if(query.length<2) {setSearchStatus('Enter at least two characters.',true);return;}
  const normalizedQuery=query.toLocaleLowerCase('en-MY');
  const cached=searchCache[normalizedQuery];
  if(cached && Date.now()-cached.time<SEARCH_CACHE_TTL && Array.isArray(cached.items)) {
    displaySearchResults(cached.items);
    return;
  }
  const job=++searchJob;
  searchAbort?.abort();
  searchAbort=new AbortController();
  $('searchSubmit').disabled=true;
  $('searchSubmit').textContent='Finding…';
  $('resultsTitle').textContent='SEARCHING MALAYSIA';
  $('results').replaceChildren();
  setSearchStatus('Looking for places…');
  try {
    // Absolute public-server limit: at most one new request each 1.2 seconds
    // from this browser tab. Never request on each keystroke.
    const delay=Math.max(0,lastSearchRequest+1250-Date.now());
    if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
    if(job!==searchJob) return;
    const url=new URL(SEARCH_ENDPOINT);
    url.search=new URLSearchParams({q:query,format:'jsonv2',countrycodes:'my',limit:'8',addressdetails:'1','accept-language':'ms,en'}).toString();
    lastSearchRequest=Date.now();
    const response=await fetch(url.toString(),{
      signal:searchAbort.signal,
      headers:{Accept:'application/json'}
    });
    if(!response.ok) throw new Error(response.status===429?'Search limit reached. Try again shortly.':`Search service unavailable (${response.status}).`);
    const items=await response.json();
    if(!Array.isArray(items)) throw new Error('Search returned an unexpected response.');
    if(job!==searchJob) return;
    searchCache[normalizedQuery]={time:Date.now(),items};
    // Small, bounded local cache. Do not write private API keys into source.
    const keys=Object.keys(searchCache).sort((a,b)=>searchCache[b].time-searchCache[a].time);
    keys.slice(25).forEach(key=>delete searchCache[key]);
    storeJson(SEARCH_CACHE_KEY,searchCache);
    displaySearchResults(items);
  } catch(error) {
    if(error.name==='AbortError'||job!==searchJob) return;
    $('resultsTitle').textContent='SEARCH UNAVAILABLE';
    setSearchStatus(error instanceof TypeError?'Could not reach the search service. Check your connection.':error.message,true);
  } finally {
    if(job===searchJob){$('searchSubmit').disabled=false;$('searchSubmit').textContent='Search';searchAbort=null;}
  }
}
$('openSearch').addEventListener('click',openSearch);
$('browse').addEventListener('click',openSearch);
$('closeSearch').addEventListener('click',closeSearch);
$('overlay').addEventListener('click',event=>{if(event.target===$('overlay'))closeSearch()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('overlay').classList.contains('open'))closeSearch()});
$('searchForm').addEventListener('submit',submitSearch);
$('searchInput').addEventListener('input',()=>{
  // No network requests on input: public Nominatim forbids autocomplete.
  if($('searchInput').value.trim()) {
    $('resultsTitle').textContent='SEARCH MALAYSIA';
    $('results').replaceChildren();
    setSearchStatus('Tap Search or press the keyboard Search key.');
  } else renderRecentSearch();
});
$('recenter').addEventListener('click',()=>map.flyTo({
  center:chosen?chosen.coords:INITIAL_VIEW.center,
  ...cameraFor(chosen?chosen.zoom:INITIAL_VIEW.zoom),duration:motion()
}));
renderRecentPlaces();
$('theme').addEventListener('click',()=>{
  dark=!dark;document.body.classList.toggle('dark',dark);
  pinStyleReady = false; // Restore the selected pin on the new style.load event.
  map.setStyle(mapStyle(dark));
  $('theme').setAttribute('aria-label',dark?'Switch to light map':'Switch to dark map');
  $('theme').setAttribute('aria-pressed',String(dark));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#14202d':'#e9eff3');
  toast(dark?'Dark appearance':'Light appearance');
});
$('tilt').addEventListener('click',()=>{
  tilted=!tilted;
  // At closer zooms, 3D buildings become visible where mapped by OSM.
  if (map.getLayer('myarah-3d-buildings')) {
    map.setLayoutProperty('myarah-3d-buildings','visibility',tilted?'visible':'none');
  }
  map.easeTo({
    pitch: tilted ? THREE_D_PITCH : 0,
    bearing: tilted ? THREE_D_BEARING : 0,
    zoom: tilted ? Math.max(map.getZoom(), BUILDING_ZOOM) : map.getZoom(),
    duration: reducedMotion ? 0 : 760,
    easing: cameraEase
  });
  $('tilt').textContent=tilted?'2D':'3D';
  $('tilt').classList.toggle('is-active',tilted);
  $('tilt').setAttribute('aria-pressed',String(tilted));
  $('tilt').setAttribute('aria-label',tilted?'Switch to 2D map':'Switch to 3D map');
  toast(tilted?'3D mode · buildings where available':'2D map');
});
$('north').addEventListener('click',()=>map.easeTo({bearing:0,duration:reducedMotion?0:520,easing:cameraEase}));
// iPhone-style facing-direction cone. This uses a real compass reading when
// allowed, not a randomly rotating graphic or an assumed travel direction.
// The direction is screen-relative, so map rotation is deducted from heading.
let compassHeading = null;
let compassListening = false;
let locationCone = null;
let displayedConeRotation = null;
let lastHeadingUpdate = 0;

const normalizedHeading = angle => (angle % 360 + 360) % 360;
const smallestAngle = angle => ((angle + 540) % 360) - 180;

function drawFacingDirection() {
  if (!locationCone) return;
  const available = Number.isFinite(compassHeading);
  locationCone.parentElement.classList.toggle('has-heading', available);
  if (!available) return;

  const target = normalizedHeading(compassHeading - map.getBearing());
  // Unwrap degrees so going from 359 to 0 does NOT spin backwards 359°.
  displayedConeRotation = displayedConeRotation === null ? target :
    displayedConeRotation + smallestAngle(target - displayedConeRotation);
  locationCone.style.transform = `rotate(${displayedConeRotation}deg)`;
}

function handleCompassOrientation(event) {
  let value = null;
  // iOS Safari: a real-world north reference, unlike relative alpha angles.
  if (typeof event.webkitCompassHeading === 'number' &&
      Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0) {
    const accuracy = event.webkitCompassAccuracy;
    if (typeof accuracy === 'number' && (accuracy < 0 || accuracy > 75)) return;
    value = event.webkitCompassHeading;
  } else if (event.absolute === true && typeof event.alpha === 'number' &&
             Number.isFinite(event.alpha)) {
    // On devices exposing absolute alpha, account for rotated screens.
    const screenAngle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
    value = 360 - event.alpha + screenAngle;
  }
  if (value === null) return;
  const now = performance.now();
  if (now - lastHeadingUpdate < 45) return; // avoid redundant sensor redraws
  lastHeadingUpdate = now;

  const incoming = normalizedHeading(value);
  // A small low-pass filter removes compass jitter, including near 0/360°.
  compassHeading = compassHeading === null ? incoming :
    normalizedHeading(compassHeading + smallestAngle(incoming - compassHeading) * 0.28);
  drawFacingDirection();
}

function enableFacingDirection() {
  if (compassListening) return Promise.resolve(true);
  if (!window.DeviceOrientationEvent) return Promise.resolve(false);

  function listen() {
    if (compassListening) return true;
    window.addEventListener('deviceorientation', handleCompassOrientation);
    window.addEventListener('deviceorientationabsolute', handleCompassOrientation);
    compassListening = true;
    return true;
  }

  // iPhone permission must be requested DIRECTLY from the location button tap.
  if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
    try {
      return Promise.resolve(window.DeviceOrientationEvent.requestPermission(true))
        .then(result => result === 'granted' ? listen() : false)
        .catch(() => false);
    } catch (_) {
      return Promise.resolve(false);
    }
  }
  return Promise.resolve(listen());
}

function showUserLocation(coords) {
  if (!userMarker) {
    const indicator = document.createElement('div');
    indicator.className = 'myarah-location-indicator';
    indicator.setAttribute('aria-label', 'Your location');
    indicator.innerHTML = `
      <svg class="myarah-heading-cone" viewBox="0 0 168 168" aria-hidden="true">
        <defs>
          <linearGradient id="myarah-heading-fill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#368BFA" stop-opacity=".64"/>
            <stop offset="55%" stop-color="#368BFA" stop-opacity=".31"/>
            <stop offset="100%" stop-color="#368BFA" stop-opacity=".035"/>
          </linearGradient>
        </defs>
        <path d="M84 84 L39 15 A82 82 0 0 1 129 15 Z" fill="url(#myarah-heading-fill)"/>
      </svg>
      <span class="location-marker" aria-hidden="true"></span>`;
    locationCone = indicator.querySelector('.myarah-heading-cone');
    userMarker = new maplibregl.Marker({
      element: indicator,
      anchor: 'center',
      rotationAlignment: 'viewport',
      pitchAlignment: 'viewport',
      subpixelPositioning: true
    }).setLngLat(coords).addTo(map);
  } else {
    userMarker.setLngLat(coords);
  }
  drawFacingDirection();
}

map.on('rotate', drawFacingDirection);

$('locate').addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Location is not available'); return; }
  toast('Finding your location…');
  // Ask for compass permission before GPS, avoiding two iOS permission
  // dialogs appearing over each other. GPS still works if compass is denied.
  enableFacingDirection().then(() => {
    navigator.geolocation.getCurrentPosition(position => {
      const coords = [position.coords.longitude, position.coords.latitude];
      showUserLocation(coords);
      map.flyTo({center: coords, ...cameraFor(15), duration: motion()});
      toast(Number.isFinite(compassHeading)
        ? 'Your location and facing direction are on the map'
        : 'Location found · Direction appears if compass is available');
    }, error => toast(error.code === 1 ? 'Location permission denied'
      : 'Location unavailable. Check your GPS.'),
    {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000});
  });
});
map.on('error',event=>{console.warn('Map rendering error',event.error);if(event.sourceId==='myarah-traffic-source'){if(trafficOn){turnTrafficOff();toast('Traffic layer unavailable. Check Traffic settings.')}return;}toast('Map tiles unavailable. Check your internet connection.')});
// Start with the clean map. Markers only appear for real search results.


// Bottom sheet interaction (only UI changes; map engine and existing controls stay intact).
const sheet = $('bottomSheet');
const sheetDragArea = $('sheetDragArea');
const sheetGrabber = $('sheetGrabber');
const sheetScroll = $('sheetScroll');
const sheetExtras = $('sheetExtras');
const appRoot = document.querySelector('.app');
const sheetPositions = ['peek', 'half', 'full'];
let sheetPosition = 'peek';
let sheetGesture = null;
let suppressSheetClick = false;
let dragFrame = 0;
let queuedDragHeight = null;

function queueDragHeight(height) {
  queuedDragHeight = height;
  if (dragFrame) return;
  dragFrame = requestAnimationFrame(() => {
    dragFrame = 0;
    setSheetHeight(queuedDragHeight);
  });
}

function flushDragHeight(height) {
  if (dragFrame) cancelAnimationFrame(dragFrame);
  dragFrame = 0;
  queuedDragHeight = null;
  setSheetHeight(height);
}

function sheetHeights() {
  const viewport = appRoot.getBoundingClientRect().height;
  const routeAction = $('routePlan');
  const routeActionHeight = routeAction && !routeAction.hidden ? routeAction.offsetHeight + 12 : 0;
  const peek = Math.ceil(sheetDragArea.offsetHeight + $('browse').offsetHeight + routeActionHeight + 18);
  const half = Math.max(peek + 92, Math.min(viewport * 0.44, 390));
  const full = Math.max(half + 66, Math.min(viewport * 0.78, 700));
  return {peek, half, full};
}

function setSheetHeight(height) {
  appRoot.style.setProperty('--sheet-height', `${Math.round(height)}px`);
}

function setSheetPosition(position) {
  if (!sheetPositions.includes(position)) return;
  sheetPosition = position;
  sheet.dataset.sheetState = position;
  appRoot.classList.toggle('sheet-full', position === 'full');
  appRoot.classList.toggle('sheet-half', position === 'half');
  sheetGrabber.setAttribute('aria-expanded', String(position !== 'peek'));
  sheetGrabber.setAttribute('aria-label', position === 'peek' ? 'Expand destinations panel' : 'Change destinations panel size');
  sheetExtras.inert = position === 'peek';
  sheetExtras.setAttribute('aria-hidden', String(position === 'peek'));
  if (position === 'peek') sheetScroll.scrollTop = 0;
  setSheetHeight(sheetHeights()[position]);
}

function closestSheetPosition(height) {
  const heights = sheetHeights();
  return sheetPositions.reduce((best, candidate) =>
    Math.abs(heights[candidate] - height) < Math.abs(heights[best] - height) ? candidate : best
  );
}

sheetDragArea.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (sheetGesture) return;
  const heights = sheetHeights(); // Read layout once, not on every move.
  sheetGesture = {
    id: event.pointerId,
    y: event.clientY,
    lastY: event.clientY,
    lastTime: event.timeStamp,
    velocity: 0,
    startingHeight: heights[sheetPosition],
    minHeight: heights.peek,
    maxHeight: heights.full,
    originalPosition: sheetPosition,
    delta: 0,
    moved: false
  };
  if (sheetDragArea.setPointerCapture) {
    try { sheetDragArea.setPointerCapture(event.pointerId); } catch (_) { /* iOS fallback */ }
  }
});

window.addEventListener('pointermove', event => {
  const gesture = sheetGesture;
  if (!gesture || gesture.id !== event.pointerId) return;
  gesture.delta = gesture.y - event.clientY;
  if (!gesture.moved && Math.abs(gesture.delta) < 7) return;
  const dt = Math.max(1, event.timeStamp - gesture.lastTime);
  const speed = (gesture.lastY - event.clientY) / dt; // positive = swipe up
  gesture.velocity = gesture.moved ? gesture.velocity * .45 + speed * .55 : speed;
  gesture.lastY = event.clientY;
  gesture.lastTime = event.timeStamp;
  if (!gesture.moved) {
    gesture.moved = true;
    sheet.classList.add('is-dragging');
    appRoot.classList.add('sheet-dragging');
  }
  const nextHeight = Math.max(gesture.minHeight, Math.min(gesture.maxHeight, gesture.startingHeight + gesture.delta));
  queueDragHeight(nextHeight);
});

function endSheetGesture(event, cancelled = false) {
  if (!sheetGesture || sheetGesture.id !== event.pointerId) return;
  const gesture = sheetGesture;
  sheetGesture = null;
  if (!gesture.moved) return;
  // Flush the last drag frame before starting the snap transition.
  const endingHeight = Math.max(gesture.minHeight, Math.min(gesture.maxHeight, gesture.startingHeight + gesture.delta));
  flushDragHeight(endingHeight);
  // Apply the drag position while transitions are disabled, then re-enable for snapping.
  void sheet.offsetHeight;
  sheet.classList.remove('is-dragging');
  appRoot.classList.remove('sheet-dragging');
  if (!cancelled) {
    suppressSheetClick = true;
    window.setTimeout(() => { suppressSheetClick = false; }, 220);
  }
  const index = sheetPositions.indexOf(gesture.originalPosition);
  let next = gesture.originalPosition;
  if (!cancelled) {
    if ((event.timeStamp - gesture.lastTime) < 130 && Math.abs(gesture.velocity) > .6) {
      // Short, quick flicks feel responsive without skipping several positions.
      next = sheetPositions[Math.max(0, Math.min(2, index + Math.sign(gesture.velocity)))];
    } else if (gesture.delta > 48) {
      next = sheetPositions[Math.min(2, index + (gesture.delta > 190 ? 2 : 1))];
    } else if (gesture.delta < -48) {
      next = sheetPositions[Math.max(0, index - (gesture.delta < -190 ? 2 : 1))];
    } else {
      next = closestSheetPosition(endingHeight);
    }
  }
  requestAnimationFrame(() => setSheetPosition(next));
}
window.addEventListener('pointerup', event => endSheetGesture(event));
window.addEventListener('pointercancel', event => endSheetGesture(event, true));

// Tapping the grab handle/header is an alternative to dragging (also works with keyboard).
sheetDragArea.addEventListener('click', event => {
  if (suppressSheetClick) {
    event.preventDefault();
    suppressSheetClick = false;
    return;
  }
  const nextIndex = (sheetPositions.indexOf(sheetPosition) + 1) % sheetPositions.length;
  setSheetPosition(sheetPositions[nextIndex]);
});

// Selecting a real search result or recent place collapses the sheet in setPlace().

window.addEventListener('resize', () => {
  if (!sheetGesture) setSheetPosition(sheetPosition);
});
// Start compact, preserving more visible map on iPhone.
setSheetPosition('peek');


// Keep the MapLibre canvas aligned when iOS changes the visible viewport
// after launching from the Home Screen, rotating, or opening/closing Safari UI.
let viewportResizeFrame = 0;
function refreshMyArahViewport() {
  if (viewportResizeFrame) cancelAnimationFrame(viewportResizeFrame);
  viewportResizeFrame = requestAnimationFrame(() => {
    viewportResizeFrame = 0;
    map.resize();
    if (!sheetGesture) setSheetPosition(sheetPosition);
  });
}
window.visualViewport?.addEventListener('resize', refreshMyArahViewport);
window.addEventListener('orientationchange', refreshMyArahViewport);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshMyArahViewport();
});


// === Optional live traffic overlay (TomTom Orbis v2 raster flow tiles). ===
// The map's OpenFreeMap base, GPS indicator, 3D mode and bottom sheet are unchanged.
// No synthetic traffic is shown. The user supplies a TomTom key on this device.
const TRAFFIC_SOURCE = 'myarah-traffic-source';
const TRAFFIC_LAYER = 'myarah-traffic-overlay';
const TRAFFIC_REFRESH_MS = 120000;
let trafficKey = '';
let trafficOn = false;
let trafficAutoResume = false;
let trafficRefreshTimer = null;
let trafficAbortController = null;
let trafficBusy = false;
let trafficPreviousFocus = null;
try {
  trafficKey = localStorage.getItem('myarahTomTomTrafficKey') || '';
  trafficAutoResume = localStorage.getItem('myarahTrafficAutoResume') === '1';
} catch (_) {}

const trafficToggle = $('trafficToggle');
const trafficLegend = $('trafficLegend');
const trafficDialog = $('trafficDialog');
const trafficKeyInput = $('trafficApiKey');
const trafficMessage = $('trafficMessage');
const trafficConnect = $('trafficConnect');

function trafficTileUrl(key = trafficKey, night = dark) {
  // TomTom Orbis Maps Traffic API v2: request 512-pixel (2x) images for sharp iPhone rendering.
  const style = night ? 'dark' : 'light';
  return `https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}?apiVersion=2&key=${encodeURIComponent(key)}&style=${style}&tileSize=512`;
}

function trafficCheckUrl(key) {
  // Check a single tile near the *currently selected map center* before
  // announcing that the overlay is live. The test also checks key validity.
  const [lng, lat] = map.getCenter().toArray();
  const z = 12;
  const latRad = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  const x = Math.floor((lng + 180) / 360 * (2 ** z));
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * (2 ** z));
  return trafficTileUrl(key).replace('{z}', z).replace('{x}', Math.max(0, Math.min(2 ** z - 1, x))).replace('{y}', Math.max(0, Math.min(2 ** z - 1, y)));
}

function setTrafficMessage(message, isError = false) {
  trafficMessage.textContent = message;
  trafficMessage.classList.toggle('is-error', isError);
}

function setTrafficVisuals() {
  trafficToggle.classList.toggle('is-active', trafficOn);
  trafficToggle.setAttribute('aria-pressed', String(trafficOn));
  trafficToggle.setAttribute('aria-label', trafficOn ? 'Turn off live traffic' : 'Turn on live traffic');
  trafficLegend.hidden = !trafficOn;
  $('trafficLiveLabel').textContent = 'Live traffic';
}

function installTrafficLayer() {
  // MapLibre removes custom sources on light/dark style changes.
  if (!trafficOn || !trafficKey) return;
  if (!map.getSource(TRAFFIC_SOURCE)) {
    map.addSource(TRAFFIC_SOURCE, {
      type: 'raster',
      tiles: [trafficTileUrl()],
      // The 256 here is the LOGICAL map tile width, not image resolution.
      // TomTom returns a 512px image for this same z/x/y grid tile (2x retina).
      // Keeping 256 preserves road alignment and the previous tile zoom behavior.
      tileSize: 256,
      minzoom: 0,
      maxzoom: 22,
      attribution: 'Traffic © <a href="https://www.tomtom.com" target="_blank" rel="noopener noreferrer">TomTom</a>'
    });
  }
  if (!map.getLayer(TRAFFIC_LAYER)) {
    // Insert below labels so road names remain readable in both themes.
    const labelLayer = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
    map.addLayer({
      id: TRAFFIC_LAYER,
      type: 'raster',
      source: TRAFFIC_SOURCE,
      paint: { 'raster-opacity': 0.91, 'raster-fade-duration': 230 }
    }, labelLayer);
  }
  // Routes and destination pins must stay visible above the traffic raster.
  for (const id of (typeof ROUTE_LAYERS !== 'undefined' ? ROUTE_LAYERS : [])) {
    if (map.getLayer(id)) map.moveLayer(id, labelLayer);
  }
  if (map.getLayer('myarah-route-start-dot')) map.moveLayer('myarah-route-start-dot', labelLayer);
  if (map.getLayer(SELECTED_PIN_LAYER)) map.moveLayer(SELECTED_PIN_LAYER);
}

function refreshTraffic() {
  if (!trafficOn || !trafficKey || document.hidden) return;
  const source = map.getSource(TRAFFIC_SOURCE);
  if (source?.setTiles) source.setTiles([trafficTileUrl()]);
  else if (map.isStyleLoaded()) installTrafficLayer();
  else map.once('idle', installTrafficLayer);
}

function turnTrafficOff() {
  // Turning traffic off is respected on the next app launch.
  trafficAutoResume = false;
  try { localStorage.setItem('myarahTrafficAutoResume', '0'); } catch (_) {}
  if (trafficAbortController) trafficAbortController.abort();
  trafficAbortController = null;
  if (trafficRefreshTimer) clearInterval(trafficRefreshTimer);
  trafficRefreshTimer = null;
  trafficOn = false;
  trafficBusy = false;
  trafficConnect.disabled = false;
  trafficConnect.textContent = 'Connect traffic';
  if (map.getLayer(TRAFFIC_LAYER)) map.removeLayer(TRAFFIC_LAYER);
  if (map.getSource(TRAFFIC_SOURCE)) map.removeSource(TRAFFIC_SOURCE);
  setTrafficVisuals();
}

async function turnTrafficOn(key, { quiet = false } = {}) {
  const clean = key.trim();
  if (!clean) {
    setTrafficMessage('Enter your TomTom API key first.', true);
    return;
  }
  if (trafficBusy) return;
  trafficBusy = true;
  trafficConnect.disabled = true;
  trafficConnect.textContent = 'Connecting…';
  setTrafficMessage('Checking live traffic access…');
  const controller = new AbortController();
  trafficAbortController = controller;
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(trafficCheckUrl(clean), { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Key rejected or Traffic API not enabled (HTTP ' + response.status + ').');
      if (response.status === 429) throw new Error('Traffic API usage limit reached. Try again later.');
      throw new Error('Traffic provider unavailable (HTTP ' + response.status + ').');
    }
    if (!(response.headers.get('content-type') || '').includes('image/')) throw new Error('The traffic provider did not return a map tile.');
    if (controller.signal.aborted) return;
    trafficKey = clean;
    try {
      localStorage.setItem('myarahTomTomTrafficKey', clean);
      localStorage.setItem('myarahTrafficAutoResume', '1');
    } catch (_) {}
    trafficAutoResume = true;
    trafficOn = true;
    setTrafficVisuals();
    if (map.isStyleLoaded()) installTrafficLayer();
    else map.once('idle', installTrafficLayer);
    if (trafficRefreshTimer) clearInterval(trafficRefreshTimer);
    trafficRefreshTimer = setInterval(refreshTraffic, TRAFFIC_REFRESH_MS);
    if (!quiet) closeTrafficDialog();
    toast(quiet ? 'Live traffic reconnected' : 'Live traffic is on · green / yellow / red roads');
  } catch (error) {
    if (!controller.signal.aborted || error.name === 'AbortError') {
      const message = error.name === 'AbortError' ? 'Traffic request timed out. Check your connection.' : error.message;
      if (quiet) {
        trafficAutoResume = false;
        try { localStorage.setItem('myarahTrafficAutoResume', '0'); } catch (_) {}
        toast('Traffic could not reconnect · check Traffic settings');
      } else {
        if (trafficDialog.hidden) openTrafficDialog();
        setTrafficMessage(message || 'Could not connect to TomTom traffic.', true);
      }
    }
  } finally {
    clearTimeout(timeout);
    if (trafficAbortController === controller) trafficAbortController = null;
    trafficBusy = false;
    trafficConnect.disabled = false;
    trafficConnect.textContent = 'Connect traffic';
  }
}

function openTrafficDialog() {
  trafficPreviousFocus = document.activeElement;
  trafficKeyInput.value = trafficKey;
  trafficKeyInput.type = 'password';
  $('trafficKeyVisibility').textContent = 'Show';
  setTrafficMessage(trafficOn ? 'Traffic is active. Add a different key to reconnect.' : 'Paste a TomTom Traffic API key to enable live road conditions.');
  trafficDialog.hidden = false;
  requestAnimationFrame(() => trafficKeyInput.focus());
}
function closeTrafficDialog() {
  trafficDialog.hidden = true;
  trafficPreviousFocus?.focus?.();
}

trafficToggle.addEventListener('click', () => {
  if (trafficOn) { turnTrafficOff(); toast('Traffic layer off'); return; }
  if (!trafficKey) { openTrafficDialog(); return; }
  void turnTrafficOn(trafficKey);
});
$('trafficSettings').addEventListener('click', openTrafficDialog);
$('trafficConfigure').addEventListener('click', openTrafficDialog);
$('trafficClose').addEventListener('click', closeTrafficDialog);
trafficDialog.addEventListener('click', event => { if (event.target === trafficDialog) closeTrafficDialog(); });
$('trafficForm').addEventListener('submit', event => {
  event.preventDefault();
  if (trafficOn) turnTrafficOff();
  void turnTrafficOn(trafficKeyInput.value);
});
$('trafficForget').addEventListener('click', () => {
  turnTrafficOff();
  trafficKey = '';
  trafficKeyInput.value = '';
  try {
    localStorage.removeItem('myarahTomTomTrafficKey');
    localStorage.removeItem('myarahTrafficAutoResume');
  } catch (_) {}
  setTrafficMessage('Saved API key cleared.');
});
$('trafficKeyVisibility').addEventListener('click', () => {
  const show = trafficKeyInput.type === 'password';
  trafficKeyInput.type = show ? 'text' : 'password';
  $('trafficKeyVisibility').textContent = show ? 'Hide' : 'Show';
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !trafficDialog.hidden) closeTrafficDialog(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTraffic(); });
map.on('style.load', () => { if (trafficOn) installTrafficLayer(); });
setTrafficVisuals();

// Only reconnect automatically after a successful user-initiated connection.
// The key stays in this device's browser storage; it is never committed to GitHub.
if (trafficKey && trafficAutoResume) void turnTrafficOn(trafficKey, { quiet: true });


// === MyArah: traffic-aware driving route comparison (TomTom Orbis Routing v3). ===
// One provider request returns a best route and up to two *genuinely distinct*
// alternatives. We show fewer when TomTom has fewer. Never synthesize routes.
// The API key is read only from the existing traffic settings on this device.
const ROUTE_ENDPOINT = 'https://api.tomtom.com/maps/orbis/routing/routes/calculate?apiVersion=3';
const ROUTE_SOURCE = 'myarah-route-geometry';
const ROUTE_START_SOURCE = 'myarah-route-start';
const ROUTE_LAYERS = ['myarah-route-alternative', 'myarah-route-selected-border', 'myarah-route-selected'];
const routePlanButton = $('routePlan');
const routePreview = $('routePreview');
const routeCards = $('routeCards');
let routeOrigin = null;
let routeOptions = [];
let routeSelected = 0;
let routeJob = 0;
let routeAbort = null;
let routePickMode = false;
let routeBusy = false;
let routeRequestDestinationId = null;

function setRouteStatus(message, error = false) {
  const node = $('routeStatus');
  node.textContent = message;
  node.classList.toggle('is-error', error);
}

function routeGeojson() {
  return { type: 'FeatureCollection', features: routeOptions.map((route, index) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: route.coordinates },
    properties: { index, selected: index === routeSelected ? 1 : 0 }
  })) };
}

function routeStartGeojson() {
  return { type: 'FeatureCollection', features: routeOrigin ? [{
    type: 'Feature', geometry: { type: 'Point', coordinates: routeOrigin.coords }, properties: {}
  }] : [] };
}

function syncRouteLayers() {
  const style = map.getStyle();
  if (!style?.layers?.length) return;
  const layers = style.layers;
  const before = layers.find(layer => layer.type === 'symbol' && layer.id !== SELECTED_PIN_LAYER)?.id;
  if (!map.getSource(ROUTE_SOURCE)) map.addSource(ROUTE_SOURCE, {type:'geojson', data: routeGeojson()});
  else map.getSource(ROUTE_SOURCE).setData(routeGeojson());
  if (!map.getSource(ROUTE_START_SOURCE)) map.addSource(ROUTE_START_SOURCE, {type:'geojson', data:routeStartGeojson()});
  else map.getSource(ROUTE_START_SOURCE).setData(routeStartGeojson());
  const add = (name, filter, color, width, blur=0) => {
    if (map.getLayer(name)) return;
    map.addLayer({id:name,type:'line',source:ROUTE_SOURCE,filter,
      layout:{'line-join':'round','line-cap':'round'},
      paint:{'line-color':color,'line-width':width,'line-opacity':0.97,'line-blur':blur}
    }, before);
  };
  // Draw alternatives first, then a white casing and blue primary route.
  add(ROUTE_LAYERS[0], ['==',['get','selected'],0], dark ? '#9cabb8' : '#8096aa',
      ['interpolate',['linear'],['zoom'],9,3,14,5,18,8]);
  add(ROUTE_LAYERS[1], ['==',['get','selected'],1], dark ? '#172938' : '#ffffff',
      ['interpolate',['linear'],['zoom'],9,7,14,10,18,14]);
  add(ROUTE_LAYERS[2], ['==',['get','selected'],1], '#2383dc',
      ['interpolate',['linear'],['zoom'],9,4,14,6,18,9]);
  if (!map.getLayer('myarah-route-start-dot')) {
    map.addLayer({id:'myarah-route-start-dot',type:'circle',source:ROUTE_START_SOURCE,
      paint:{'circle-radius':7,'circle-color':'#159c7c','circle-stroke-width':3,'circle-stroke-color':'#ffffff'}
    });
  }
  // Keep the accurate destination pin on top of route geometry.
  if (map.getLayer(SELECTED_PIN_LAYER)) map.moveLayer(SELECTED_PIN_LAYER);
}
map.on('style.load', () => { requestAnimationFrame(syncRouteLayers); });

function clearRouteGeometry() {
  routeOptions = [];
  routeSelected = 0;
  routeCards.replaceChildren();
  if (map.getSource(ROUTE_SOURCE)) map.getSource(ROUTE_SOURCE).setData(routeGeojson());
}

function endRoutePick() {
  routePickMode = false;
  $('routePickBanner').hidden = true;
  map.getCanvas().style.cursor = '';
}

function cancelRouteRequest() {
  routeJob++;
  routeAbort?.abort(); routeAbort = null;
  routeBusy = false;
  routePlanButton.disabled = false;
  routePlanButton.firstChild.textContent = 'Compare driving routes ';
}

function resetRouteComparison() {
  cancelRouteRequest();
  endRoutePick();
  routeOrigin = null;
  routeRequestDestinationId = null;
  clearRouteGeometry();
  if (map.getSource(ROUTE_START_SOURCE)) map.getSource(ROUTE_START_SOURCE).setData(routeStartGeojson());
  routePlanButton.hidden = !chosen;
  routePreview.hidden = true;
  $('routeDestination').textContent = chosen?.name || '';
}

function routeDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds/60));
  return minutes >= 60 ? `${Math.floor(minutes/60)} hr ${minutes%60 ? `${minutes%60} min` : ''}`.trim() : `${minutes} min`;
}
function routeDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function normalizeProviderRoutes(payload) {
  if (!Array.isArray(payload?.routes)) return [];
  const options = payload.routes.map(raw => {
    const summary = raw.summary || {};
    const seconds = Number(summary.travelDurationInSeconds);
    const meters = Number(summary.lengthInMeters);
    // Orbis v3 returns route-level GeoJSON path (or individual leg paths).
    const path = raw.path?.coordinates || raw.legs?.flatMap(leg => leg.path?.coordinates || []);
    if (!Array.isArray(path) || path.length < 2 ||
        path.some(point => !Array.isArray(point) || point.length < 2 ||
          !Number.isFinite(point[0]) || !Number.isFinite(point[1])) ||
        !Number.isFinite(seconds) || seconds < 0 ||
        !Number.isFinite(meters) || meters < 0) return null;
    const delay = Number(summary.trafficDelayDurationInSeconds);
    return {
      coordinates: path.map(point => [point[0], point[1]]),
      seconds, meters,
      delay: Number.isFinite(delay) && delay >= 0 ? delay : null,
      toll: Array.isArray(raw.sections?.toll) && raw.sections.toll.length > 0,
      arrival: summary.arrivalDateTime || null
    };
  }).filter(Boolean);
  // Do not invent three choices if the backend can only find one or two.
  return options.sort((a,b) => a.seconds - b.seconds).slice(0,3);
}

function renderRouteCards() {
  routeCards.replaceChildren();
  routeOptions.forEach((route, index) => {
    const card = document.createElement('button');
    card.type='button';
    card.className='route-card';
    card.classList.toggle('is-selected', index===routeSelected);
    card.setAttribute('aria-pressed',String(index===routeSelected));
    const heading = document.createElement('div'); heading.className='route-card-heading';
    const title = document.createElement('strong');
    title.textContent = index===0 ? 'Fastest route' : `Alternative ${index+1}`;
    const eta = document.createElement('b'); eta.textContent=routeDuration(route.seconds);
    heading.append(title,eta);
    const detail=document.createElement('div'); detail.className='route-card-details';
    const detailParts=[routeDistance(route.meters)];
    if (route.delay !== null) detailParts.push(route.delay >= 30 ? `+${Math.ceil(route.delay/60)} min traffic` : 'No significant traffic delay');
    else detailParts.push('Traffic estimate included');
    if (route.toll) detailParts.push('Toll sections');
    detail.textContent=detailParts.join(' · ');
    const lower=document.createElement('div'); lower.className='route-card-bottom';
    lower.textContent = index===routeSelected ? 'Selected · highlighted blue' : 'Tap to preview this route';
    card.append(heading,detail,lower);
    card.addEventListener('click',() => selectRoute(index));
    routeCards.append(card);
  });
}

function fitRouteOnMap() {
  if (!routeOptions.length) return;
  const bounds = new maplibregl.LngLatBounds();
  routeOptions[routeSelected].coordinates.forEach(point=>bounds.extend(point));
  map.fitBounds(bounds,{
    padding:{top:130,bottom:Math.min(window.innerHeight*.48,420),left:35,right:55},
    pitch:tilted?35:0,bearing:0,
    duration:reducedMotion?0:850,maxZoom:15
  });
}
function selectRoute(index) {
  if (!routeOptions[index]) return;
  routeSelected=index;
  syncRouteLayers();
  renderRouteCards();
  // Leave room to inspect the selected road while keeping cards scrollable.
  setSheetPosition('half');
  fitRouteOnMap();
}

function describeRouteError(response) {
  if (response.status===401 || response.status===403)
    return 'TomTom rejected the key or Routing API access. Check your TomTom products/key permissions.';
  if (response.status===429) return 'TomTom routing quota reached. Try again later.';
  if (response.status===400 || response.status===404)
    return 'No drivable route was found for those points. Try a road nearby or choose a different start.';
  return `Routing service unavailable (HTTP ${response.status}).`;
}

async function requestRouteComparison(origin) {
  if (!chosen?.coords) return;
  if (!trafficKey) {
    routePreview.hidden=false;
    setRouteStatus('Connect your TomTom key in Traffic settings to compare real routes.',true);
    setSheetPosition('half');
    return;
  }
  const job = ++routeJob;
  routeAbort?.abort();
  const controller = new AbortController();
  routeAbort = controller;
  routeBusy=true;
  routePlanButton.disabled=true;
  routePlanButton.firstChild.textContent='Calculating routes ';
  routePreview.hidden=false;
  clearRouteGeometry();
  routeOrigin={...origin, coords:[...origin.coords]};
  routeRequestDestinationId=chosen.id;
  $('routeDestination').textContent=chosen.name;
  setRouteStatus('Comparing roads using available live traffic and closures…');
  setSheetPosition('half');
  if (map.isStyleLoaded()) syncRouteLayers();
  const timeout=setTimeout(()=>controller.abort(),22000);
  try {
    const requestBody={
      routePlanningLocations:{
        origin:{type:'Point',coordinates:origin.coords},
        destination:{type:'Point',coordinates:chosen.coords}
      },
      routeType:'fast',travelMode:'car',traffic:'live',
      departureDateTime:'now',maxPathAlternativeRoutes:2
    };
    const response=await fetch(ROUTE_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','TomTom-Api-Key':trafficKey,'Attributes':'routes'},
      body:JSON.stringify(requestBody),signal:controller.signal,cache:'no-store'
    });
    if (!response.ok) throw new Error(describeRouteError(response));
    const json=await response.json();
    if (job!==routeJob || routeRequestDestinationId!==chosen?.id) return;
    const options=normalizeProviderRoutes(json);
    if (!options.length) throw new Error('No usable driving route was returned. Try a different starting point.');
    routeOptions=options;
    routeSelected=0;
    syncRouteLayers();
    renderRouteCards();
    const n=options.length;
    setRouteStatus(`${n} real route${n===1?'':'s'} found · sorted by traffic-aware ETA, fastest first.`);
    routePlanButton.firstChild.textContent='Refresh routes ';
    setSheetPosition('full');
    requestAnimationFrame(fitRouteOnMap);
  } catch(error) {
    if (job!==routeJob) return;
    const msg = error.name==='AbortError' ? 'Route request timed out. Please retry.' :
      error instanceof TypeError ? 'Cannot contact routing service. Check connection or browser access.' : error.message;
    setRouteStatus(msg || 'Route comparison failed.',true);
    setSheetPosition('half');
  } finally {
    clearTimeout(timeout);
    if (job===routeJob) {
      routeBusy=false; routeAbort=null; routePlanButton.disabled=false;
      if (!routeOptions.length) routePlanButton.firstChild.textContent='Compare driving routes ';
    }
  }
}

function prepareComparison() {
  if (!chosen || routeBusy) return;
  routePreview.hidden=false;
  $('routeDestination').textContent=chosen.name;
  if (!trafficKey) {
    setRouteStatus('Open Traffic settings and connect a TomTom key with Routing API access.',true);
    setSheetPosition('half'); return;
  }
  if (routeOrigin?.kind === 'map') {
    void requestRouteComparison(routeOrigin);
    return;
  }
  if (!navigator.geolocation) {
    setRouteStatus('GPS is unavailable. Tap “Choose start on map” below.',true);
    setSheetPosition('half'); return;
  }
  setRouteStatus('Finding your current location…');
  setSheetPosition('half');
  const requestedDestinationId = chosen.id;
  const currentJob = routeJob;
  navigator.geolocation.getCurrentPosition(position=>{
    if (routeJob !== currentJob || chosen?.id !== requestedDestinationId) return;
    const origin={coords:[position.coords.longitude,position.coords.latitude],label:'Current location',kind:'gps'};
    showUserLocation(origin.coords);
    void requestRouteComparison(origin);
  },()=>{
    if (routeJob !== currentJob || chosen?.id !== requestedDestinationId) return;
    setRouteStatus('GPS location unavailable. Tap “Choose start on map” below.',true);
    setSheetPosition('half');
  },{enableHighAccuracy:true,timeout:14000,maximumAge:10000});
}

routePlanButton.addEventListener('click',prepareComparison);
$('routePickOrigin').addEventListener('click',()=>{
  if (!chosen || routeBusy) return;
  routePickMode=true;
  $('routePickBanner').hidden=false;
  map.getCanvas().style.cursor='crosshair';
  setSheetPosition('peek');
  toast('Tap a road on the map to choose the start');
});
$('routePickCancel').addEventListener('click',()=>{
  endRoutePick();setSheetPosition('half');
});
map.on('click',event=>{
  if (!routePickMode) return;
  const coords=[event.lngLat.lng,event.lngLat.lat];
  endRoutePick();
  if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return;
  const origin={coords,label:'Picked on map',kind:'map'};
  routeOrigin=origin;
  void requestRouteComparison(origin);
});
$('routeClose').addEventListener('click',()=>{
  cancelRouteRequest();endRoutePick();clearRouteGeometry();
  routeOrigin=null;routePreview.hidden=true;
  if (map.getSource(ROUTE_START_SOURCE)) map.getSource(ROUTE_START_SOURCE).setData(routeStartGeojson());
  setSheetPosition('peek');
});
// The traffic key is already stored only in this device. Do not embed it in code.
// New style (light/dark) is already handled by syncRouteLayers above.
resetRouteComparison();
