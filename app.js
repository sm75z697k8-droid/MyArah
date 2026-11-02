import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

// The five destinations are deliberately sample data, not live address search.
const locations = [
  {id:'kl',name:'Kuala Lumpur',state:'Wilayah Persekutuan',coords:[101.6869,3.1390],zoom:12.7},
  {id:'penang',name:'George Town',state:'Pulau Pinang',coords:[100.3294,5.4141],zoom:12.6},
  {id:'jb',name:'Johor Bahru',state:'Johor',coords:[103.7618,1.4927],zoom:12.7},
  {id:'kk',name:'Kota Kinabalu',state:'Sabah',coords:[116.0735,5.9804],zoom:12.5},
  {id:'kuching',name:'Kuching',state:'Sarawak',coords:[110.3592,1.5533],zoom:12.5}
];
const $ = id => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// CARTO now requires a key; use OpenFreeMap styles without an API key.
// Light and dark use the same map engine and preserve the existing UI.
const mapStyle = isDark => `https://tiles.openfreemap.org/styles/${isDark ? 'dark' : 'positron'}`;
const map = new maplibregl.Map({container:'map',style:mapStyle(false),center:locations[0].coords,zoom:12,pitch:0,bearing:0,attributionControl:true,canvasContextAttributes:{antialias:true}});
let dark=false,tilted=false,chosen=locations[0],selectedMarker=null,userMarker=null,toastTimer;

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
function setPlace(place){
  chosen=place;
  map.flyTo({center:place.coords,...cameraFor(place.zoom),duration:motion(),essential:true});
  if(selectedMarker)selectedMarker.remove();
  const pin=document.createElement('div');pin.className='city-marker';pin.setAttribute('aria-label',place.name);
  selectedMarker=new maplibregl.Marker({element:pin}).setLngLat(place.coords).addTo(map);
  $('placeSubtitle').textContent=`${place.name} · ${place.state}`;
  document.querySelectorAll('[data-place]').forEach(button=>button.classList.toggle('active',button.dataset.place===place.id));
  closeSearch();
}
function renderResults(term=''){
  const node=$('results');node.replaceChildren();
  const matches=locations.filter(place=>`${place.name} ${place.state}`.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()));
  if(!matches.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No sample cities found. Try Kuala Lumpur or Penang.';node.append(empty);return}
  matches.forEach(place=>{
    const button=document.createElement('button');button.type='button';button.className='result';
    const icon=document.createElement('span');icon.className='result-icon';icon.textContent='⌖';
    const info=document.createElement('span');info.className='result-text';
    const name=document.createElement('div');name.className='result-title';name.textContent=place.name;
    const state=document.createElement('div');state.className='result-detail';state.textContent=place.state;
    const arrow=document.createElement('span');arrow.className='result-arrow';arrow.textContent='›';
    info.append(name,state);button.append(icon,info,arrow);button.addEventListener('click',()=>setPlace(place));node.append(button);
  });
}
function openSearch(){const overlay=$('overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');$('searchInput').value='';renderResults();setTimeout(()=>$('searchInput').focus(),140)}
function closeSearch(){const overlay=$('overlay');overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true')}
$('openSearch').addEventListener('click',openSearch);
$('browse').addEventListener('click',openSearch);
$('closeSearch').addEventListener('click',closeSearch);
$('overlay').addEventListener('click',event=>{if(event.target===$('overlay'))closeSearch()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSearch()});
$('searchInput').addEventListener('input',event=>renderResults(event.target.value));
document.querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>setPlace(locations.find(place=>place.id===button.dataset.place))));
$('recenter').addEventListener('click',()=>map.flyTo({center:chosen.coords,...cameraFor(chosen.zoom),duration:motion()}));
$('theme').addEventListener('click',()=>{
  dark=!dark;document.body.classList.toggle('dark',dark);
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
map.on('error',event=>{console.warn('Map rendering error',event.error);toast('Map tiles unavailable. Check your internet connection.')});
renderResults();
setPlace(locations[0]);


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
  const peek = Math.ceil(sheetDragArea.offsetHeight + $('browse').offsetHeight + 18);
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

// Show more map again once the user chooses a suggested city.
document.querySelectorAll('.chips [data-place]').forEach(button => {
  button.addEventListener('click', () => setSheetPosition('peek'));
});
$('results').addEventListener('click', event => {
  if (event.target.closest('.result')) setSheetPosition('peek');
});

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
