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

// v4 map-only enhancement: the original CARTO map remains the basemap.
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
function motion(){return reducedMotion?0:850}
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
    duration: reducedMotion ? 0 : 650
  });
  $('tilt').textContent=tilted?'2D':'3D';
  $('tilt').classList.toggle('is-active',tilted);
  $('tilt').setAttribute('aria-pressed',String(tilted));
  $('tilt').setAttribute('aria-label',tilted?'Switch to 2D map':'Switch to 3D map');
  toast(tilted?'3D mode · buildings where available':'2D map');
});
$('north').addEventListener('click',()=>map.easeTo({bearing:0,duration:reducedMotion?0:350}));
$('locate').addEventListener('click',()=>{
  if(!navigator.geolocation){toast('Location is not available');return}
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition(position=>{
    const coords=[position.coords.longitude,position.coords.latitude];
    if(userMarker)userMarker.remove();
    const dot=document.createElement('div');dot.className='location-marker';
    userMarker=new maplibregl.Marker({element:dot}).setLngLat(coords).addTo(map);
    map.flyTo({center:coords,...cameraFor(15),duration:motion()});
    toast('Your location is on the map');
  },error=>toast(error.code===1?'Location permission denied':'Location unavailable. Check your GPS.'),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
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
  sheetGesture = {
    id: event.pointerId,
    y: event.clientY,
    startingHeight: sheetHeights()[sheetPosition],
    originalPosition: sheetPosition,
    delta: 0,
    moved: false
  };
});

window.addEventListener('pointermove', event => {
  if (!sheetGesture || sheetGesture.id !== event.pointerId) return;
  sheetGesture.delta = sheetGesture.y - event.clientY;
  if (!sheetGesture.moved && Math.abs(sheetGesture.delta) < 7) return;
  sheetGesture.moved = true;
  sheet.style.transition = 'none';
  const {peek, full} = sheetHeights();
  setSheetHeight(Math.max(peek, Math.min(full, sheetGesture.startingHeight + sheetGesture.delta)));
});

function endSheetGesture(event, cancelled = false) {
  if (!sheetGesture || sheetGesture.id !== event.pointerId) return;
  const gesture = sheetGesture;
  sheetGesture = null;
  if (!gesture.moved || cancelled) {
    if (cancelled) setSheetPosition(gesture.originalPosition);
    return;
  }
  suppressSheetClick = true;
  window.setTimeout(() => { suppressSheetClick = false; }, 160);
  const index = sheetPositions.indexOf(gesture.originalPosition);
  let next;
  if (gesture.delta > 48) {
    next = sheetPositions[Math.min(sheetPositions.length - 1, index + (gesture.delta > 190 ? 2 : 1))];
  } else if (gesture.delta < -48) {
    next = sheetPositions[Math.max(0, index - (gesture.delta < -190 ? 2 : 1))];
  } else {
    next = closestSheetPosition(gesture.startingHeight + gesture.delta);
  }
  sheet.style.transition = '';
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
