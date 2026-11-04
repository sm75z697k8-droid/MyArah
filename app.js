import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

// Default map viewpoint only; search results now come from a real geocoder.
const INITIAL_VIEW = {center:[101.6869, 3.1390], zoom:12};
const $ = id => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// CARTO now requires a key; use OpenFreeMap styles without an API key.
// Light and dark use the same map engine and preserve the existing UI.
const mapStyle = isDark => `https://tiles.openfreemap.org/styles/${isDark ? 'dark' : 'positron'}`;
const myarahOpticalGlassEnabled = new URLSearchParams(window.location.search).get('glass') !== 'off';
const map = new maplibregl.Map({container:'map',style:mapStyle(false),center:INITIAL_VIEW.center,zoom:INITIAL_VIEW.zoom,pitch:0,bearing:0,attributionControl:true,canvasContextAttributes:{antialias:true,preserveDrawingBuffer:myarahOpticalGlassEnabled}});

/* OPTIMIZED OPTICAL GLASS (PWA / iOS)
   Same convex refraction, color separation, transparency and CSS highlights.
   The previous version read each control directly from the WebGL map and
   recomputed the distortion for every frame. This version takes ONE scaled
   map snapshot per update, then samples small areas from that 2D snapshot.
   Each lens caches its warp lookup and output ImageData until its size changes.
   Refreshes target ~20 fps when the map moves, with an adaptive cap and
   resolution fallback when pixel capture is slow. Hidden controls are skipped
   and static maps stop optical redraws after a final settled frame. No extra location polling, WebGL contexts or dependencies.
   ?glass=off still disables sampling and preserveDrawingBuffer for comparison.
   This is an approximation of iOS Liquid Glass, not Apple's native material. */
function installMyArahOpticalGlass(mapInstance) {
  if (!myarahOpticalGlassEnabled || typeof document === 'undefined') return;
  const selector = '.map-controls .primary-control, .map-controls .text-control, #north.compass-control, #navFooter .nav-footer-buttons button:not(.nav-end), #navSpeed.nav-speed-gauge';
  const mapCanvas = mapInstance.getCanvas();
  const roots = [...document.querySelectorAll(selector)];
  const lenses = roots.map(root => {
    const canvas = document.createElement('canvas');
    canvas.className = 'myarah-optical-lens';
    canvas.setAttribute('aria-hidden', 'true');
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d', {alpha:true});
    const sample = document.createElement('canvas');
    const sourceCtx = sample.getContext('2d', {alpha:true, willReadFrequently:true});
    return {root,canvas,ctx,sample,sourceCtx,lookup:null,output:null};
  });
  if(!lenses.length || lenses.some(l => !l.ctx || !l.sourceCtx)) {
    for (const lens of lenses) lens.canvas.remove();
    return;
  }
  // One low-resolution WebGL -> 2D transfer instead of multiple GPU readbacks.
  // At most 1.35 device pixels per CSS pixel: the optics look unchanged, but
  // we avoid paying to copy the full Retina map at native 3x resolution.
  const frame = document.createElement('canvas');
  const frameCtx = frame.getContext('2d', {alpha:true});
  if(!frameCtx) { for(const lens of lenses)lens.canvas.remove(); return; }
  const maxDpr = 1.35, pad = 12;
  let disabled = false, lastPaint = -Infinity, pendingFrame = 0, pendingTimer = 0;
  let frameInterval = 50; // Aim for 20 optical updates per second when affordable.
  // Retain full-quality optics when affordable; reduce pixel work gradually if
  // this device takes too long to capture/warp a frame. Never remove refraction.
  let samplingScale = 1, slowFrames = 0, fastFrames = 0;
  // UI transitions can move controls without a MapLibre render event.
  // A short, bounded refresh during those transitions is enough; no idle loop.
  let uiRefreshUntil = 0, uiRefreshTimer = 0;
  function clearLens(err) {
    disabled = true;
    if(pendingFrame) cancelAnimationFrame(pendingFrame);
    if(pendingTimer) clearTimeout(pendingTimer);
    if(uiRefreshTimer) clearTimeout(uiRefreshTimer);
    pendingFrame=0; pendingTimer=0; uiRefreshTimer=0;
    document.body.removeAttribute('data-myarah-optical');
    for(const lens of lenses) lens.canvas.remove();
    if(err) console.warn('MyArah refractive glass unavailable; using CSS glass:',err?.message||err);
  }
  // Build the exact same convex warp and three-channel chromatic separation
  // once per size. Per frame we only interpolate sampled pixels, not calculate
  // radius, sqrt(), bends and color offsets for every output pixel.
  function rebuildWarp(lens,w,h) {
    const width=w+pad*2,height=h+pad*2;
    lens.canvas.width=w;lens.canvas.height=h;
    lens.sample.width=width;lens.sample.height=height;
    const output=lens.ctx.createImageData(w,h);
    const count=w*h, indices=new Uint32Array(count*3);
    const fx=new Float32Array(count*3),fy=new Float32Array(count*3);
    const cx=(w-1)/2,cy=(h-1)/2,rx=Math.max(1,cx),ry=Math.max(1,cy);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const dx=(x-cx)/rx,dy=(y-cy)/ry;
      const rim=Math.min(1,Math.max(0,(Math.hypot(dx,dy)-.34)/.63));
      const rimSquared=rim*rim,bend=9*rimSquared,chroma=.9*rimSquared;
      const baseX=x+pad-dx*bend,baseY=y+pad-dy*bend;
      const p=(y*w+x),offset=p*3;
      for(let c=0;c<3;c++){
        const shift=(c-1)*chroma;
        const px=Math.max(0,Math.min(width-1.001,baseX+dx*shift));
        const py=Math.max(0,Math.min(height-1.001,baseY+dy*shift));
        const x0=Math.floor(px),y0=Math.floor(py);
        indices[offset+c]=(y0*width+x0)*4+c;
        fx[offset+c]=px-x0;
        fy[offset+c]=py-y0;
      }
      output.data[p*4+3]=Math.round(205+36*rim);
    }
    lens.lookup={w,h,width,height,indices,fx,fy,rowBytes:width*4};
    lens.output=output;
  }
  function visibleRect(lens) {
    const {root}=lens;
    if(!root.isConnected || root.hidden || root.closest('[hidden], [inert]'))return null;
    // In MyArah some buttons stay mounted while their parent fades out. A
    // viewport-only test would waste CPU repainting these invisible canvases.
    for(let el=root;el && el.nodeType===1;el=el.parentElement){
      const style=getComputedStyle(el);
      if(style.display==='none' || style.visibility==='hidden' ||
         style.visibility==='collapse' || Number(style.opacity)<0.035)return null;
    }
    const rect=root.getBoundingClientRect();
    if(rect.width<28 || rect.height<28)return null;
    const vw=document.documentElement.clientWidth||innerWidth;
    const vh=document.documentElement.clientHeight||innerHeight;
    if(rect.right<=0 || rect.bottom<=0 || rect.left>=vw || rect.top>=vh)return null;
    return rect;
  }
  function paintLens(lens,rect,mapRect){
    const dpr=Math.min(maxDpr,Math.max(1,window.devicePixelRatio||1))*samplingScale;
    const w=Math.max(1,Math.min(160,Math.round(rect.width*dpr)));
    const h=Math.max(1,Math.min(160,Math.round(rect.height*dpr)));
    if(!lens.lookup || lens.lookup.w!==w || lens.lookup.h!==h)rebuildWarp(lens,w,h);
    const {width,height,indices,fx,fy,rowBytes}=lens.lookup;
    const cssToLensX=rect.width/w,cssToLensY=rect.height/h;
    const sxScale=frame.width/mapRect.width,syScale=frame.height/mapRect.height;
    const sourceX=(rect.left-mapRect.left-pad*cssToLensX)*sxScale;
    const sourceY=(rect.top-mapRect.top-pad*cssToLensY)*syScale;
    const sourceW=width*cssToLensX*sxScale,sourceH=height*cssToLensY*syScale;
    lens.sourceCtx.clearRect(0,0,width,height);
    lens.sourceCtx.drawImage(frame,sourceX,sourceY,sourceW,sourceH,0,0,width,height);
    const original=lens.sourceCtx.getImageData(0,0,width,height).data;
    if(original[(Math.floor(height/2)*width+Math.floor(width/2))*4+3]===0)return;
    const dest=lens.output.data;
    // Three bilinear samples per pixel, with a precomputed coordinate table.
    for(let p=0,idx=0;p<w*h;p++,idx+=3){
      const o=p*4;
      for(let c=0;c<3;c++){
        const k=idx+c,i=indices[k],x=fx[k],y=fy[k];
        const upper=original[i]+(original[i+4]-original[i])*x;
        const lower=original[i+rowBytes]+(original[i+rowBytes+4]-original[i+rowBytes])*x;
        dest[o+c]=upper+(lower-upper)*y;
      }
    }
    lens.ctx.putImageData(lens.output,0,0);
  }
  function draw() {
    pendingFrame=0;
    if(disabled||document.hidden||!mapCanvas.width||!mapCanvas.height)return;
    const started=performance.now();
    try {
      const mapRect=mapCanvas.getBoundingClientRect();
      if(!mapRect.width||!mapRect.height)return;
      const visible=lenses.map(l=>({lens:l,rect:visibleRect(l)})).filter(item=>item.rect);
      if(!visible.length)return;
      const scale=Math.min(maxDpr*samplingScale,
        Math.max(1,window.devicePixelRatio||1)*samplingScale,
        1800/Math.max(mapRect.width,mapRect.height));
      const fw=Math.max(1,Math.round(mapRect.width*scale));
      const fh=Math.max(1,Math.round(mapRect.height*scale));
      if(frame.width!==fw||frame.height!==fh){frame.width=fw;frame.height=fh;}
      frameCtx.clearRect(0,0,fw,fh);
      frameCtx.drawImage(mapCanvas,0,0,fw,fh);
      for(const item of visible)paintLens(item.lens,item.rect,mapRect);
      lastPaint=performance.now();
      const cost=lastPaint-started;
      // An older iPhone may need fewer optical updates to keep the map fluid.
      // Use real execution cost rather than a fixed device-model guess.
      const desired=cost>26?Math.min(110,cost*3):cost>15?65:50;
      frameInterval=Math.max(50,Math.min(110,frameInterval*.75+desired*.25));
      if(cost>26){slowFrames++;fastFrames=0;}
      else if(cost<12){fastFrames++;slowFrames=0;}
      else {slowFrames=0;fastFrames=0;}
      // Hysteresis prevents visible texture-resolution oscillation. Keep a
      // minimum of 0.78x, with the same warp/tint/edge treatment at every tier.
      if(slowFrames>=5){samplingScale=Math.max(.78,Math.round((samplingScale-.08)*100)/100);slowFrames=0;}
      if(fastFrames>=28){samplingScale=Math.min(1,Math.round((samplingScale+.04)*100)/100);fastFrames=0;}
    } catch(err) { clearLens(err); }
  }
  function schedule() {
    if(disabled||document.hidden||pendingFrame||pendingTimer)return;
    const wait=Math.max(0,lastPaint+frameInterval-performance.now());
    if(wait<1){pendingFrame=requestAnimationFrame(draw);return;}
    // A trailing draw is essential: otherwise the final map frame can be
    // dropped by throttling and the glass looks one step behind after pan/zoom.
    pendingTimer=setTimeout(()=>{
      pendingTimer=0;
      if(!disabled && !document.hidden && !pendingFrame)pendingFrame=requestAnimationFrame(draw);
    },Math.ceil(wait));
  }
  // Only refresh changed UI positions briefly: no permanent interval while
  // the map is static (a key battery saver during parked/idle navigation).
  function refreshUiFor(ms=450){
    if(disabled || document.hidden)return;
    uiRefreshUntil=Math.max(uiRefreshUntil,performance.now()+ms);
    schedule();
    if(uiRefreshTimer)return;
    const tick=()=>{
      uiRefreshTimer=0;
      if(disabled||document.hidden)return;
      if(performance.now()<uiRefreshUntil){
        schedule();
        uiRefreshTimer=setTimeout(tick,Math.max(55,Math.ceil(frameInterval)));
      }else{schedule();} // last frame captures final control position
    };
    uiRefreshTimer=setTimeout(tick,Math.max(55,Math.ceil(frameInterval)));
  }
  document.body.setAttribute('data-myarah-optical','on');
  mapInstance.on('render',schedule);
  mapInstance.on('resize',schedule);
  mapInstance.on('idle',schedule);
  mapInstance.on('moveend',schedule);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      if(pendingFrame)cancelAnimationFrame(pendingFrame);
      if(pendingTimer)clearTimeout(pendingTimer);
      if(uiRefreshTimer)clearTimeout(uiRefreshTimer);
      pendingFrame=0;pendingTimer=0;uiRefreshTimer=0;uiRefreshUntil=0;
    } else {lastPaint=-Infinity;schedule();}
  });
  window.addEventListener('resize',()=>{lastPaint=-Infinity;refreshUiFor(280);},{passive:true});
  window.addEventListener('orientationchange',()=>refreshUiFor(650),{passive:true});
  const appRoot=document.querySelector('.app');
  if(appRoot){
    // Sheet, navigation dock and recenter controls animate independently of
    // the map, so detect their class/state changes without polling forever.
    const observer=new MutationObserver(records=>{
      if(records.some(r=>r.attributeName==='class' || r.attributeName==='hidden' ||
                         r.attributeName==='style' || r.attributeName==='inert'))refreshUiFor(420);
    });
    observer.observe(appRoot,{attributes:true,attributeFilter:['class']});
    for(const lens of lenses){
      observer.observe(lens.root,{attributes:true,attributeFilter:['class','style','hidden','inert']});
    }
    appRoot.addEventListener('transitionrun',event=>{
      if(event.target===appRoot || lenses.some(l=>l.root===event.target || l.root.contains(event.target)))refreshUiFor(600);
    },{passive:true});
  }
  if(typeof ResizeObserver!=='undefined'){
    const ro=new ResizeObserver(()=>refreshUiFor(320));
    for(const lens of lenses)ro.observe(lens.root);
  }
  schedule();
}
installMyArahOpticalGlass(map);

let dark=false,tilted=false,chosen=null,userMarker=null,toastTimer;
// Visual-only navigation state: keep extruded buildings less prominent while
// driving without linking the basemap styling to GPS, routes, or lane logic.
let myarahNavigationMapMode=false;
function myarahBuildingAppearance(){
  return {
    color: dark ? (myarahNavigationMapMode ? '#617486' : '#536a7d') :
      (myarahNavigationMapMode ? '#cad6e0' : '#bdcad6'),
    opacity: myarahNavigationMapMode ? (dark ? 0.58 : 0.53) : (dark ? 0.72 : 0.72)
  };
}
function refreshMyArahBuildingAppearance(){
  const layer='myarah-3d-buildings';
  if(!map.getLayer(layer))return;
  const appearance=myarahBuildingAppearance();
  map.setPaintProperty(layer,'fill-extrusion-color',appearance.color);
  map.setPaintProperty(layer,'fill-extrusion-opacity',appearance.opacity);
}

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
  // Buildings should never cover the basemap's road/place labels. Put the
  // extrusion *below* its symbol layers; the blue driving route is drawn above
  // the buildings separately by syncRouteLayers().
  const firstLabel=map.getStyle()?.layers?.find(layer=>layer.type==='symbol')?.id;
  const appearance=myarahBuildingAppearance();
  map.addLayer({
    id: 'myarah-3d-buildings',
    type: 'fill-extrusion',
    source: 'myarah-building-data',
    'source-layer': 'building',
    minzoom: 15,
    filter: ['!=', ['get', 'hide_3d'], true],
    layout: { visibility: tilted ? 'visible' : 'none' },
    paint: {
      'fill-extrusion-color': appearance.color,
      'fill-extrusion-opacity': appearance.opacity,
      'fill-extrusion-color-transition': {duration:420,delay:0},
      'fill-extrusion-opacity-transition': {duration:420,delay:0},
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-height': [
        'interpolate', ['linear'], ['zoom'], 15, 0, 16,
        ['coalesce', ['get', 'render_height'], 8]
      ],
      'fill-extrusion-base': [
        'interpolate', ['linear'], ['zoom'], 15, 0, 16,
        ['coalesce', ['get', 'render_min_height'], 0]
      ]
    }
  },firstLabel);
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
  // Original rounded vector pin, rendered at 2x resolution for sharp iPhone screens.
  // Keep MapLibre's geographic anchor at the very bottom of this image.
  const canvas = document.createElement('canvas');
  canvas.width = 96;  // 48 CSS pixels at 2x
  canvas.height = 124; // 62 CSS pixels at 2x
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);

  // Gently tapered teardrop with a rounded tip (no narrow, sharp spike).
  ctx.beginPath();
  ctx.moveTo(24, 60);
  ctx.bezierCurveTo(22.3, 60, 20.9, 58.5, 19, 56);
  ctx.bezierCurveTo(12.8, 47.9, 5.5, 36.7, 5.5, 24.4);
  ctx.bezierCurveTo(5.5, 13.8, 13.7, 6.6, 24, 6.6);
  ctx.bezierCurveTo(34.3, 6.6, 42.5, 13.8, 42.5, 24.4);
  ctx.bezierCurveTo(42.5, 36.7, 35.2, 47.9, 29, 56);
  ctx.bezierCurveTo(27.1, 58.5, 25.7, 60, 24, 60);
  ctx.closePath();

  ctx.shadowColor = 'rgba(15, 37, 70, .30)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  const fill = ctx.createLinearGradient(13, 6, 34, 56);
  fill.addColorStop(0, '#55AEF7');
  fill.addColorStop(.46, '#2B83D8');
  fill.addColorStop(1, '#1B64B2');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2.7;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  // Bright central hole stays readable against both light and dark maps.
  ctx.beginPath();
  ctx.arc(24, 24.6, 8.1, 0, 2 * Math.PI);
  ctx.fillStyle = '#FFFFFF';
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
  if (navigation.active) endNavigation('Navigation ended');
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
function removeRecentPlace(place, row) {
  // Never delete the current destination or its map pin: remove only history.
  row.classList.add('is-removing');
  recentPlaces=recentPlaces.filter(item=>item.id!==place.id);
  storeJson(RECENT_KEY,recentPlaces);
  renderRecentPlaces();
  const finish=()=>{
    if (!$('searchInput').value.trim()) renderRecentSearch();
  };
  if(reducedMotion) finish();
  else setTimeout(finish,240);
}
function enableRecentSwipe(row, result, deleteButton, place) {
  // Horizontal swipe opens a Delete action; vertical scrolling stays native.
  let gesture=null;
  let ignoreClickUntil=0;
  const width=88;
  const closeOtherRows=()=>{
    document.querySelectorAll('.recent-swipe-item.is-revealed').forEach(other=>{
      if(other!==row) { other.classList.remove('is-revealed'); other.querySelector('.recent-delete')?.setAttribute('tabindex','-1'); }
    });
  };
  function setRevealed(revealed) {
    row.classList.toggle('is-revealed',revealed);
    deleteButton.tabIndex=revealed?0:-1;
    result.style.removeProperty('transform');
  }
  result.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse' && event.button!==0) return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,
      initial:row.classList.contains('is-revealed')?-width:0, dx:0, horizontal:false};
    closeOtherRows();
  });
  result.addEventListener('pointermove',event=>{
    if(!gesture || event.pointerId!==gesture.id) return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.horizontal) {
      if(Math.abs(dy)>Math.abs(dx)+7) {gesture=null;return;}
      if(Math.abs(dx)<11 || Math.abs(dx)<Math.abs(dy)) return;
      gesture.horizontal=true;
      row.classList.add('is-swiping');
    }
    gesture.dx=dx;
    const shift=Math.max(-width,Math.min(0,gesture.initial+dx));
    result.style.transform=`translate3d(${shift}px,0,0)`;
  });
  function finishSwipe(event,cancelled=false){
    if(!gesture || event.pointerId!==gesture.id) return;
    const g=gesture;gesture=null;
    row.classList.remove('is-swiping');
    if(!g.horizontal) return;
    ignoreClickUntil=performance.now()+420;
    const next=cancelled ? g.initial<=-width/2 : (g.initial+g.dx<=-width/2);
    setRevealed(next);
  }
  result.addEventListener('pointerup',event=>finishSwipe(event));
  result.addEventListener('pointercancel',event=>finishSwipe(event,true));
  result.addEventListener('click',event=>{
    if(performance.now()<ignoreClickUntil){event.preventDefault();event.stopImmediatePropagation();return;}
    if(row.classList.contains('is-revealed')) {
      event.preventDefault();event.stopImmediatePropagation();setRevealed(false);
    }
  },true);
  // A keyboard-accessible alternative to a swipe is always available to
  // screen-reader users through the action's accessible name.
  deleteButton.addEventListener('click',()=>removeRecentPlace(place,row));
  result.setAttribute('aria-keyshortcuts','Delete Backspace');
  result.addEventListener('keydown',event=>{
    if(event.key==='Delete' || event.key==='Backspace') {
      event.preventDefault();removeRecentPlace(place,row);
    }
  });
}
function appendResult(place,node,kind='search') {
  const button=document.createElement('button');button.type='button';button.className='result';
  const icon=document.createElement('span');icon.className='result-icon';icon.textContent=kind==='recent'?'↺':'⌖';
  const info=document.createElement('span');info.className='result-text';
  const name=document.createElement('div');name.className='result-title';name.textContent=place.name;
  const detail=document.createElement('div');detail.className='result-detail';detail.textContent=place.detail;
  const arrow=document.createElement('span');arrow.className='result-arrow';arrow.textContent='›';
  info.append(name,detail);button.append(icon,info,arrow);
  button.addEventListener('click',()=>setPlace(place));
  if(kind==='recent') {
    const row=document.createElement('div');row.className='recent-swipe-item';
    const del=document.createElement('button');del.type='button';del.className='recent-delete';
    del.textContent='Delete';del.setAttribute('aria-label',`Remove ${place.name} from recent searches`);
    del.tabIndex=-1;
    row.append(del,button);node.append(row);
    enableRecentSwipe(row,button,del,place);
  } else node.append(button);
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
  $('resultsTitle').textContent='RECENTS';
  $('recentSwipeHint').hidden=recentPlaces.length===0;
  if(!recentPlaces.length) {
    const empty=document.createElement('p');empty.className='empty';
    empty.textContent='No recent places. Try searching for a Malaysian address, shop, or postcode.';
    node.append(empty);
  } else recentPlaces.forEach(place=>appendResult(place,node,'recent'));
  setSearchStatus('');
}
function openSearch() {
  const overlay=$('overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  $('searchInput').value='';renderRecentSearch();
  // Focus the dialog, not its input: iOS must not open the keyboard mid-animation.
  // Tapping the field later uses the existing keyboard/fullscreen recovery code.
  overlay.querySelector('.search-modal')?.focus({preventScroll:true});
}
function closeSearch() {
  $('overlay').classList.remove('open');$('overlay').setAttribute('aria-hidden','true');
  searchJob++;
  searchAbort?.abort();searchAbort=null;
  $('searchSubmit').disabled=false;
  $('searchSubmit').textContent='Search';
  $('searchInput').blur();
  // Mobile browsers sometimes scroll overflow-hidden .app when focusing input.
  document.querySelector('.app').scrollTop=0;
}
function displaySearchResults(items) {
  $('recentSwipeHint').hidden=true;
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
  $('recentSwipeHint').hidden=true;
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
$('browse').addEventListener('click',openSearch);
$('closeSearch').addEventListener('click',closeSearch);
$('overlay').addEventListener('click',event=>{if(event.target===$('overlay'))closeSearch()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('overlay').classList.contains('open'))closeSearch()});
$('searchForm').addEventListener('submit',submitSearch);
$('searchInput').addEventListener('input',()=>{
  // No network requests on input: public Nominatim forbids autocomplete.
  if($('searchInput').value.trim()) {
    $('recentSwipeHint').hidden=true;
    $('resultsTitle').textContent='SEARCH MALAYSIA';
    $('results').replaceChildren();
    setSearchStatus('Tap Search or press the keyboard Search key.');
  } else renderRecentSearch();
});
// Swipe down from the small search sheet grip to close smoothly.
// Results keep their native scrolling; this gesture is grip-only.
const searchGrabber = document.querySelector('.search-grabber');
const searchPanel = document.querySelector('.search-modal');
let searchSwipe = null;
searchGrabber.addEventListener('pointerdown', event => {
  if (!$('#overlay').classList.contains('open') || (event.pointerType==='mouse' && event.button!==0)) return;
  searchSwipe={id:event.pointerId,startY:event.clientY,delta:0};
  try {searchGrabber.setPointerCapture?.(event.pointerId);} catch (_) { /* mobile fallback */ }
});
searchGrabber.addEventListener('pointermove', event => {
  if (!searchSwipe || searchSwipe.id!==event.pointerId) return;
  searchSwipe.delta=Math.max(0,event.clientY-searchSwipe.startY);
  if (searchSwipe.delta<7) return;
  searchPanel.classList.add('is-search-dragging');
  searchPanel.style.setProperty('--search-pull',`${searchSwipe.delta}px`);
});
function finishSearchSwipe(event, cancelled=false) {
  if (!searchSwipe || searchSwipe.id!==event.pointerId) return;
  const delta=searchSwipe.delta;
  searchSwipe=null;
  searchPanel.classList.remove('is-search-dragging');
  searchPanel.style.removeProperty('--search-pull');
  if (!cancelled && delta>105) closeSearch();
}
searchGrabber.addEventListener('pointerup',event=>finishSearchSwipe(event));
searchGrabber.addEventListener('pointercancel',event=>finishSearchSwipe(event,true));
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
  $('tilt').querySelector('.myarah-glass-label').textContent=tilted?'2D':'3D';
  $('tilt').classList.toggle('is-active',tilted);
  $('tilt').setAttribute('aria-pressed',String(tilted));
  $('tilt').setAttribute('aria-label',tilted?'Switch to 2D map':'Switch to 3D map');
  toast(tilted?'3D mode · buildings where available':'2D map');
});
// Compass button behavior is managed by the cardinal dial module below.
// iPhone-style facing-direction cone. This uses a real compass reading when
// allowed, not a randomly rotating graphic or an assumed travel direction.
// The direction is screen-relative, so map rotation is deducted from heading.
let compassHeading = null;
let compassListening = false;
let locationCone = null;
// SVG navigation pointer follows world bearing but rotates relative to the map.
// The standard location dot and phone-facing cone are still used outside trips.
let navigationArrowElement = null;
let navigationArrowWorldBearing = null;
let navigationArrowDisplayedAngle = null;
// A compass bearing alone is not the direction of a road on a *pitched*
// screen. Perspective distorts the projected road at the edges of the view.
// Compute the tangent of the exact route geometry at the marker's *rendered*
// position. Both the arrow and the blue line then use MapLibre's projection.
function screenRouteArrowAngle(index, along) {
  if (!index?.segments?.length || !Number.isFinite(along)) return null;
  const start = routePointAt(index, Math.max(0, along - 7));
  const end = routePointAt(index, Math.min(index.total, along + 14));
  if (!start || !end) return null;
  const a = map.project(start), b = map.project(end);
  if (![a.x,a.y,b.x,b.y].every(Number.isFinite)) return null;
  if (Math.hypot(b.x-a.x,b.y-a.y) < 1) return null;
  // Arrow SVG points toward the top at zero rotation. atan2(x,-y) is the
  // clockwise screen angle of the projected forward route tangent.
  return normalizedHeading(Math.atan2(b.x-a.x, a.y-b.y) * 180 / Math.PI);
}
function syncNavigationArrowRotation() {
  if (!navigationArrowElement) return;
  const snapped = navigation.active && !navigation.offRoute && !navigation.joiningRoute &&
    Number.isFinite(navigation.drawnAlong) && navigation.routeIndex;
  const screenAngle = snapped ? screenRouteArrowAngle(navigation.routeIndex,navigation.drawnAlong) : null;
  const target = Number.isFinite(screenAngle) ? screenAngle :
    (Number.isFinite(navigationArrowWorldBearing) ?
      normalizedHeading(navigationArrowWorldBearing - map.getBearing()) : null);
  if (!Number.isFinite(target)) return;
  // Preserve shortest rotation across 0°/360°. No CSS animation lag: the
  // heading follows the same rendered-frame movement as the road beneath it.
  navigationArrowDisplayedAngle = navigationArrowDisplayedAngle === null ? target :
    navigationArrowDisplayedAngle + smallestAngle(target - navigationArrowDisplayedAngle);
  navigationArrowElement.style.setProperty('--myarah-nav-arrow-angle', `${navigationArrowDisplayedAngle}deg`);
}
function updateNavigationArrowCourse(bearing) {
  if (!Number.isFinite(bearing)) return;
  navigationArrowWorldBearing = normalizedHeading(bearing);
  syncNavigationArrowRotation();
}
function clearNavigationArrowCourse() {
  navigationArrowWorldBearing = null;
  navigationArrowDisplayedAngle = null;
  if (navigationArrowElement) navigationArrowElement.style.removeProperty('--myarah-nav-arrow-angle');
}
let displayedConeRotation = null;
let lastHeadingUpdate = 0;

const normalizedHeading = angle => (angle % 360 + 360) % 360;
const smallestAngle = angle => ((angle + 540) % 360) - 180;

function drawFacingDirection() {
  syncNavigationArrowRotation();
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
  updateCompassDial();
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
      <span class="location-marker" aria-hidden="true"></span>
      <!-- Tabler Icons navigation-filled; MIT license, see README credits. -->
      <svg class="myarah-navigation-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M11.092 2.581a1 1 0 0 1 1.754-.116l.062.116l8.005 17.365c.198.566.05 1.196-.378 1.615a1.53 1.53 0 0 1-1.459.393l-7.077-2.398L5.1 21.894a1.535 1.535 0 0 1-1.52-.231l-.112-.1c-.398-.386-.556-.954-.393-1.556l.047-.15l7.97-17.276z"/>
      </svg>`;
    locationCone = indicator.querySelector('.myarah-heading-cone');
    navigationArrowElement = indicator.querySelector('.myarah-navigation-arrow');
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
// Reproject the arrow after camera translation, rotation or pitch changes.
map.on('move', syncNavigationArrowRotation);

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
// Only active while showing real route choices, not during normal browsing.
let routeFramingActive = false;
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
  // The requested height is used by the framing calculation, so the map can
  // move in step with the sheet instead of waiting for its CSS transition.
  if (routeFramingActive) scheduleRoutePreviewRefit(65);
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

// Keep the sheet dimensions stable when the keyboard is appearing.
// The search/traffic dialogs adjust independently to the visual viewport.
function myarahTextFieldActive() {
  const el = document.activeElement;
  return !!el && (el.matches?.('input, textarea, [contenteditable="true"]') || el.isContentEditable);
}
window.addEventListener('resize', () => {
  if (!sheetGesture && !myarahTextFieldActive()) setSheetPosition(sheetPosition);
});
// Start compact, preserving more visible map on iPhone.
setSheetPosition('peek');

// MyArah keyboard recovery v2 (standalone iPhone + Safari).
// Lock the map to the largest *real webpage viewport* seen outside text input.
// Never shrink the map to the temporary keyboard visual viewport. We cannot
// extend into strips owned by iOS outside the webpage's actual viewport.
const myarahStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if (myarahStandalone) document.documentElement.classList.add('myarah-is-standalone');
let myarahFrameHeight = 0;
let myarahViewportFrame = 0;
let myarahRecoveryTimers = [];
const myarahDebugEnabled = new URLSearchParams(location.search).has('viewportDebug');
let myarahDebugPanel = null;

function myarahLayoutHeight() {
  return Math.max(
    1,
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    window.visualViewport ? Math.round(window.visualViewport.height + Math.max(0, window.visualViewport.offsetTop)) : 0
  );
}

function myarahLockFrame(reset = false) {
  // CSS 100lvh can be greater than 100dvh in normal Safari; use a locked
  // height only in the installed Home Screen web app.
  if (!myarahStandalone) return;
  const observed = myarahLayoutHeight();
  if (reset) myarahFrameHeight = 0;
  if (!myarahFrameHeight || (!myarahTextFieldActive() && observed > myarahFrameHeight)) {
    myarahFrameHeight = Math.round(observed);
  }
  if (myarahFrameHeight) {
    document.documentElement.style.setProperty('--myarah-locked-height', myarahFrameHeight + 'px');
  }
}

function myarahDebugText() {
  const vv = window.visualViewport;
  const h = Math.round(appRoot.getBoundingClientRect().height);
  const top = Math.round(appRoot.getBoundingClientRect().top);
  const screenH = window.screen?.height ?? 0;
  return `MyArah viewport (diagnostics only)\n` +
    `Standalone: ${myarahStandalone} · Input: ${myarahTextFieldActive()}\n` +
    `Screen: ${screenH} · inner: ${window.innerHeight} · root: ${document.documentElement.clientHeight}\n` +
    `Visual: ${Math.round(vv?.height || 0)} · offset: ${Math.round(vv?.offsetTop || 0)}\n` +
    `App: ${h} · top: ${top} · locked: ${myarahFrameHeight}\n` +
    `Keyboard: ${appRoot.classList.contains('keyboard-open')}`;
}

if (myarahDebugEnabled) {
  myarahDebugPanel = document.createElement('pre');
  myarahDebugPanel.id = 'myarahViewportDebug';
  myarahDebugPanel.setAttribute('role', 'status');
  myarahDebugPanel.setAttribute('aria-label', 'Viewport diagnostic');
  myarahDebugPanel.textContent = 'Viewport diagnostic loading…';
  appRoot.appendChild(myarahDebugPanel);
  myarahDebugPanel.addEventListener('click', () => {
    myarahDebugPanel.classList.toggle('is-minimized');
  });
}

function myarahUpdateViewport() {
  const vv = window.visualViewport;
  const appHeight = appRoot.getBoundingClientRect().height;
  const visualTop = Math.max(0, vv?.offsetTop || 0);
  const visualHeight = Math.max(1, vv?.height || appHeight);
  const obstruction = Math.max(0, appHeight - visualTop - visualHeight);
  const keyboard = myarahTextFieldActive() && obstruction > 115;

  appRoot.classList.toggle('keyboard-open', keyboard);
  appRoot.style.setProperty('--myarah-visual-top', keyboard ? `${Math.round(visualTop)}px` : '0px');
  appRoot.style.setProperty('--myarah-keyboard-bottom', keyboard ? `${Math.round(obstruction)}px` : '0px');
  appRoot.style.setProperty('--myarah-visible-height', `${Math.round(keyboard ? visualHeight : appHeight)}px`);

  if (!keyboard) {
    myarahLockFrame();
    // A visualViewport change can alter canvas bounds even when the CSS
    // height remains locked. Resize MapLibre using its real container size.
    map.resize();
    if (!sheetGesture && !myarahTextFieldActive()) setSheetPosition(sheetPosition);
  }
  if (myarahDebugPanel) myarahDebugPanel.textContent = myarahDebugText();
}

function myarahScheduleViewportUpdate() {
  if (myarahViewportFrame) cancelAnimationFrame(myarahViewportFrame);
  myarahViewportFrame = requestAnimationFrame(() => {
    myarahViewportFrame = 0;
    myarahUpdateViewport();
  });
}

function myarahRecoverViewport() {
  for (const timer of myarahRecoveryTimers) clearTimeout(timer);
  myarahRecoveryTimers = [];
  for (const ms of [0, 100, 250, 450, 850, 1400]) {
    myarahRecoveryTimers.push(setTimeout(() => {
      if (myarahTextFieldActive()) return;
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      appRoot.scrollTop = 0;
      myarahScheduleViewportUpdate();
    }, ms));
  }
}

myarahLockFrame();
window.visualViewport?.addEventListener('resize', myarahScheduleViewportUpdate);
window.visualViewport?.addEventListener('scroll', myarahScheduleViewportUpdate);
window.addEventListener('resize', myarahScheduleViewportUpdate);
window.addEventListener('resize',()=>{
  if(routeFramingActive && !myarahTextFieldActive())scheduleRoutePreviewRefit(210);
},{passive:true});
window.addEventListener('orientationchange', () => {
  if(routeFramingActive)scheduleRoutePreviewRefit(520);
  // A rotation changes the available height legitimately.
  myarahFrameHeight = 0;
  myarahLockFrame(true);
  myarahRecoverViewport();
});
window.addEventListener('pageshow', myarahRecoverViewport);
document.addEventListener('focusin', event => {
  if (event.target.matches?.('input,textarea,[contenteditable="true"]')) {
    myarahScheduleViewportUpdate();
    // Keyboard metrics may arrive later than the focus event on iOS.
    setTimeout(myarahScheduleViewportUpdate, 250);
  }
});
document.addEventListener('focusout', event => {
  if (event.target.matches?.('input,textarea,[contenteditable="true"]')) myarahRecoverViewport();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) myarahRecoverViewport();
});
myarahScheduleViewportUpdate();


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
  // No asynchronous keyboard autofocus; tap the field to open the keyboard.
}
function closeTrafficDialog() {
  trafficDialog.hidden = true;
  trafficPreviousFocus?.focus?.({preventScroll:true});
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
// Toll positions are grounded in TomTom's passTollgate maneuvers or toll-section bounds.
// Orbis v3 does NOT provide a monetary toll price, so never fabricate one.
const TOLL_MAX_MAP_MARKERS = 22;
const TOLL_RATE_CHECK_URL = 'https://www.llm.gov.my/';
// Verified Class 1 fixed/plaza fares (Ringgit). Fares from the highway
// operators; plaza geocoordinates independently mapped in OSM/Mapcarta.
// The distance test is NOT sufficient by itself: only match actual TomTom
// passTollgate maneuvers, or routes also marked as tolled at that location.
// NOTE: this is not a full Malaysian toll dataset. Closed-system charges
// require exact entry+exit plazas; never apply a flat fee to PLUS/LPT.
const CLASS1_PLAZA_FARES = Object.freeze([
  // KESAS official toll-lane page: toll plazas and their coordinates + RM2.00.
  {id:'kesas-awan-east',name:'KESAS Awan Besar East',coords:[101.664889,3.058708],rm:2.00,source:'https://kesas.com.my/toll-lane/'},
  {id:'kesas-awan-west',name:'KESAS Awan Besar West',coords:[101.679266,3.063580],rm:2.00,source:'https://kesas.com.my/toll-lane/'},
  {id:'kesas-sunway',name:'KESAS Sunway',coords:[101.608303,3.058708],rm:2.00,source:'https://kesas.com.my/toll-lane/'},
  {id:'kesas-kemuning',name:'KESAS Kemuning',coords:[101.522089,2.997334],rm:2.00,source:'https://kesas.com.my/toll-lane/'},
  // LITRAK's LDP page confirms all four tolls are RM2.10 for Class 1.
  {id:'ldp-penchala',name:'LDP Penchala',coords:[101.61925,3.17764],rm:2.10,source:'https://litrakgroup.com.my/our-highways/litrak/toll-fares/'},
  {id:'ldp-pj',name:'LDP Petaling Jaya',coords:[101.61363,3.06054],rm:2.10,source:'https://litrakgroup.com.my/our-highways/litrak/toll-fares/'},
  {id:'ldp-puchong-barat',name:'LDP Puchong Barat',coords:[101.60225,3.02089],rm:2.10,source:'https://litrakgroup.com.my/our-highways/litrak/toll-fares/'},
  {id:'ldp-puchong-selatan',name:'LDP Puchong Selatan',coords:[101.63629,2.98126],rm:2.10,source:'https://litrakgroup.com.my/our-highways/litrak/toll-fares/'},
  // SPRINT's three plazas have different prices. Only Bukit Kiara is
  // geolocated with sufficient confidence in this release.
  {id:'sprint-kiara',name:'SPRINT Bukit Kiara',coords:[101.64297,3.16424],rm:3.00,source:'https://litrakgroup.com.my/our-highways/sprint/toll-fares/'},
  // PROLINTAS flat toll rates (Class 1), backed by operator publications.
  {id:'gce-jelutong',name:'GCE Bukit Jelutong',coords:[101.52834,3.12373],rm:1.75,source:'https://www.prolintas.com.my/gce/'},
  {id:'gce-elmina',name:'GCE Elmina',coords:[101.50726,3.20365],rm:1.75,source:'https://www.prolintas.com.my/gce/'},
  {id:'gce-lagong',name:'GCE Lagong',coords:[101.53915,3.26219],rm:1.75,source:'https://www.prolintas.com.my/gce/'},
  {id:'akleh-keramat',name:'AKLEH Dato’ Keramat',coords:[101.72136,3.16524],rm:2.13,source:'https://www.prolintas.com.my/akleh/'},
  {id:'suke-alam-a',name:'SUKE Alam Damai (A)',coords:[101.73821,3.07511],rm:2.30,source:'https://www.prolintas.com.my/suke/'},
  {id:'suke-alam-b',name:'SUKE Alam Damai (B)',coords:[101.74141,3.07328],rm:2.30,source:'https://www.prolintas.com.my/suke/'}
]);
const CLASS1_FARE_MATCH_RADIUS_M = 175;
function nearestClass1Plaza(coords, excludedIds = new Set()) {
  if(!Array.isArray(coords) || coords.length!==2 || !coords.every(Number.isFinite))return null;
  const candidates=CLASS1_PLAZA_FARES
    .filter(item=>!excludedIds.has(item.id))
    .map(item=>({item,meters:haversineMeters(coords,item.coords)}))
    .filter(match=>match.meters<=CLASS1_FARE_MATCH_RADIUS_M)
    .sort((a,b)=>a.meters-b.meters);
  if(!candidates.length)return null;
  // A very close alternate plaza should not win just because of rounding.
  // The two SUKE Alam Damai direction facilities are different locations.
  return candidates[0].item;
}
function applyVerifiedClass1Tolls(tollPoints,raw,coords,meters) {
  const output=tollPoints.map(p=>({...p}));
  const used=new Set();
  // Use provider-reported physical tollgate events as primary evidence.
  for(const gate of output.filter(p=>p.kind==='gate')){
    const plaza=nearestClass1Plaza(gate.coordinates,used);
    if(!plaza)continue;
    Object.assign(gate,{label:plaza.name,price:plaza.rm,rateSource:plaza.source,
      ratePlazaId:plaza.id,rateClass:1});
    used.add(plaza.id);
  }
  // Some TomTom routes identify toll *sections*, not passTollgate events.
  // If the selected polyline passes directly through an independently mapped
  // fixed-rate plaza AND a toll section covers that exact path index, show it.
  const sections=Array.isArray(raw.sections?.toll)?raw.sections.toll:[];
  for(const plaza of CLASS1_PLAZA_FARES){
    if(used.has(plaza.id))continue;
    const snap=computePolylineProgress(coords,plaza.coords);
    if(!snap || snap.distance>58 || !Number.isFinite(snap.fraction))continue;
    const covered=sections.some(section=>{
      const from=Number(section?.startPathIndex),to=Number(section?.endPathIndex);
      return Number.isInteger(from) && Number.isInteger(to) &&
        snap.index+1>=from && snap.index<=to;
    });
    if(!covered)continue;
    const offset=snap.fraction*meters;
    const existing=output.find(p=>p.kind==='gate' && Math.abs(p.offset-offset)<180);
    if(existing){
      if(existing.price===null){
        Object.assign(existing,{label:plaza.name,price:plaza.rm,rateSource:plaza.source,
          ratePlazaId:plaza.id,rateClass:1});
        used.add(plaza.id);
      }
      continue;
    }
    output.push({kind:'gate',offset,coordinates:routePointAtOffset(coords,offset,meters),
      label:plaza.name,price:plaza.rm,rateSource:plaza.source,
      ratePlazaId:plaza.id,rateClass:1});
    used.add(plaza.id);
  }
  // A section beginning at a known gate is only a roadway indicator: do not
  // show two pins or imply the section is a separate payment.
  const gates=output.filter(p=>p.kind==='gate' && Number.isFinite(p.price));
  return output.filter(p=>p.kind!=='section' ||
    !gates.some(g=>haversineMeters(p.coordinates,g.coordinates)<250))
    .sort((a,b)=>a.offset-b.offset).slice(0,40);
}
function verifiedClass1TollSummary(route){
  const points=route?.tollPoints||[];
  const priced=points.filter(p=>p.kind==='gate' && Number.isFinite(p.price));
  const others=points.length-priced.length;
  const total=priced.reduce((sum,p)=>sum+p.price,0);
  return {priced:priced.length,others,total};
}
function tollFareLabel(price){return Number.isFinite(price)?`RM ${price.toFixed(2)}`:'RM —';}
const tollMapMarkers = [];
let tollMarkerRoute = null;

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
  // The blue GPS indicator already marks the current location. Show the green
  // origin dot only for a manually chosen starting point on the map.
  const manualStart = routeOrigin?.kind === 'map' &&
    Array.isArray(routeOrigin.coords) && routeOrigin.coords.length === 2 &&
    routeOrigin.coords.every(Number.isFinite);
  return { type: 'FeatureCollection', features: manualStart ? [{
    type: 'Feature', geometry: { type: 'Point', coordinates: routeOrigin.coords }, properties: {}
  }] : [] };
}


// Coordinates for a maneuver offset: use the entire mapped polyline length,
// not the raw point index, to avoid positioning a toll on the wrong bend.
function routePointAtOffset(coordinates,offset,routeMeters){
  if(!Array.isArray(coordinates)||!coordinates.length)return null;
  if(coordinates.length===1)return [...coordinates[0]];
  if(!Number.isFinite(routeMeters)||routeMeters<=0)return [...coordinates[0]];
  const lengths=[];let total=0;
  for(let i=1;i<coordinates.length;i++){
    const length=haversineMeters(coordinates[i-1],coordinates[i]);
    lengths.push(Number.isFinite(length)?Math.max(0,length):0);
    total+=lengths[lengths.length-1];
  }
  if(total<=0)return [...coordinates[0]];
  let target=Math.max(0,Math.min(1,(Number(offset)||0)/routeMeters))*total;
  for(let i=1;i<coordinates.length;i++){
    const length=lengths[i-1];
    if(target<=length || i===coordinates.length-1){
      const t=length>0?Math.min(1,Math.max(0,target/length)):0;
      return [coordinates[i-1][0]+(coordinates[i][0]-coordinates[i-1][0])*t,
        coordinates[i-1][1]+(coordinates[i][1]-coordinates[i-1][1])*t];
    }
    target-=length;
  }
  return [...coordinates[coordinates.length-1]];
}
function normalizeRouteTollPoints(raw,coordinates,routeMeters,instructions){
  const points=[];
  const gates=instructions.filter(i=>/^passTollgate$/i.test(i.maneuver));
  // Guidance gates are actual mapped tollgate maneuvers and have precedence.
  gates.forEach((gate,i)=>{
    const point=routePointAtOffset(coordinates,gate.offset,routeMeters);
    if(point && point.every(Number.isFinite))points.push({
      kind:'gate',offset:gate.offset,coordinates:point,
      label:`Toll plaza ${i+1}`,price:null
    });
  });
  // Section start is NOT guaranteed to be a physical plaza.
  // Show this only if no reported gate is near its location.
  const sections=Array.isArray(raw.sections?.toll)?raw.sections.toll:[];
  for(const section of sections){
    const start=Number(section?.startPathIndex);
    if(!Number.isInteger(start)||start<0||start>=coordinates.length)continue;
    const point=coordinates[start];
    if(!point?.every(Number.isFinite))continue;
    if(points.some(g=>g.kind==='gate' && haversineMeters(point,g.coordinates)<450))continue;
    // Match the geometry offset to the TomTom route distance.
    let measured=0,total=0;
    for(let i=1;i<coordinates.length;i++){
      const d=haversineMeters(coordinates[i-1],coordinates[i]);
      total+=d;if(i<=start)measured+=d;
    }
    const offset=total>0?measured/total*routeMeters:0;
    // One toll section can be adjacent to another: avoid duplicate pins.
    if(points.some(p=>p.kind==='section' && haversineMeters(point,p.coordinates)<120))continue;
    points.push({kind:'section',offset,coordinates:[...point],
      label:'Tolled road begins',price:null});
  }
  // Retain an honest ordering and bound the amount of UI over an extended trip.
  return points.sort((a,b)=>a.offset-b.offset).slice(0,40);
}
function clearTollMapMarkers(){
  tollMapMarkers.splice(0).forEach(({marker})=>marker.remove());
  tollMarkerRoute=null;
}
function setTollMarkerVisibility(){
  // When navigating, show only upcoming toll indicators; not those already passed.
  const progress=navigation.active && navigation.route===tollMarkerRoute ? navigation.lastProgress : -Infinity;
  for(const item of tollMapMarkers){
    item.marker.getElement().style.display=progress>item.point.offset+110?'none':'';
  }
}
function syncTollMapMarkers(){
  const route=routeOptions[routeSelected]||null;
  if(tollMarkerRoute===route){setTollMarkerVisibility();return;}
  clearTollMapMarkers();
  if(!route)return;
  tollMarkerRoute=route;
  for(const point of (route.tollPoints||[]).slice(0,TOLL_MAX_MAP_MARKERS)){
    const el=document.createElement('button');
    el.type='button';el.className='myarah-toll-map-marker';
    el.classList.toggle('is-section',point.kind==='section');
    el.setAttribute('aria-label',point.kind==='gate'?'View toll plaza':'View start of tolled road');
    el.title=point.label;
    // Static, self-contained SVG (no icon CDN required while driving).
    el.innerHTML=point.kind==='gate'
      ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5a2.5 2.5 0 0 0 0-5Z"/><path d="M13 4v3m0 3v4m0 3v3" stroke-dasharray="2 2"/></svg>'
      : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4m16 16V4M7 10h10m-10 4h10"/><path d="m9 7 3-3 3 3"/></svg>';
    const marker=new maplibregl.Marker({element:el,anchor:'bottom',offset:[0,-6]})
      .setLngLat(point.coordinates).addTo(map);
    el.addEventListener('click',event=>{
      event.stopPropagation();
      const content=document.createElement('div');content.className='myarah-toll-popup';
      const title=document.createElement('strong');title.textContent=point.label;
      const fee=document.createElement('p');
      fee.textContent=Number.isFinite(point.price)
        ? `Class 1 car · ${tollFareLabel(point.price)}`
        : 'Class 1 car · RM — (plaza not verified)';
      const note=document.createElement('small');note.textContent=Number.isFinite(point.price)
        ? 'Published fixed-plaza rate for Class 1 cars. Check for toll changes and route accuracy.'
        : point.kind==='gate'
          ? 'Tollgate from routing guidance. Its fee may require matching entry and exit plazas.'
          : 'Tolled-road section only, not necessarily a payment booth.';
      const link=document.createElement('a');link.href=point.rateSource||TOLL_RATE_CHECK_URL;
      link.target='_blank';link.rel='noopener noreferrer';
      link.textContent=point.rateSource?'View rate source ↗':'Check toll rates ↗';
      content.append(title,fee,note,link);
      new maplibregl.Popup({offset:22,maxWidth:'290px'}).setLngLat(point.coordinates)
        .setDOMContent(content).addTo(map);
    });
    tollMapMarkers.push({marker,point});
  }
  setTollMarkerVisibility();
}
function renderSelectedTolls(){
  const box=$('routeTolls'),list=$('routeTollItems'),route=routeOptions[routeSelected];
  list.replaceChildren();
  if(!route || !(route.tollPoints?.length)){
    box.hidden=true;return;
  }
  box.hidden=false;
  const summary=verifiedClass1TollSummary(route);
  const summaryEl=$('routeTollKnownTotal');
  if(summaryEl){
    summaryEl.hidden=!summary.priced;
    summaryEl.textContent=summary.priced
      ? `Identified Class 1 plaza charges: ${tollFareLabel(summary.total)}${summary.others?' · partial total':''}`
      : '';
  }
  for(const point of route.tollPoints){
    const row=document.createElement('div');row.className='route-toll-item';
    const glyph=document.createElement('span');glyph.className='route-toll-glyph';
    glyph.textContent=point.kind==='gate'?'▣':'≋';glyph.setAttribute('aria-hidden','true');
    const copy=document.createElement('span');copy.className='route-toll-copy';
    const name=document.createElement('strong');name.textContent=point.label;
    const distance=document.createElement('small');
    distance.textContent=`${routeDistance(point.offset)} from start · ${point.kind==='gate'?'Mapped tollgate':'Toll-road section'}`;
    copy.append(name,distance);
    const fare=document.createElement('span');fare.className='route-toll-fare';
    fare.textContent=tollFareLabel(point.price);
    fare.title=Number.isFinite(point.price)
      ? 'Published Class 1 fixed-plaza fare (check source for changes)'
      : 'Unmatched toll: entry and exit may be needed for an exact fare';
    fare.classList.toggle('is-verified',Number.isFinite(point.price));
    row.append(glyph,copy,fare);list.append(row);
  }
}

// Optional manual fare lookup for CLOSED toll systems (PLUS/LPT/etc).
// This is a read-only community mirror of LLM's public calculator. It is not
// used for automatic route matching or the verified plaza total, because
// TomTom's toll sections cannot identify exact entry and exit plazas.
const TOLL_FARE_MIRROR = 'https://mohdsyahid.github.io/kadar-tol-malaysia/data';
const tollFareHighway = $('tollFareHighway');
const tollFareEntry = $('tollFareEntry');
const tollFareExit = $('tollFareExit');
const tollFareResult = $('tollFareResult');
const tollFareCalculate = $('tollFareCalculate');
const tollFareCache = new Map();
let tollFareHighwaysLoaded = false;
let tollFareCurrentHighway = null;
let tollFareLoadCounter = 0;
function setTollFareStatus(text){tollFareResult.textContent=text;}
function tollFareSelectOptions(select,values,placeholder){
  select.replaceChildren(new Option(placeholder,''));
  for(const item of values)select.add(new Option(String(item),String(item)));
}
async function getTollFareJson(url){
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);
  try{
    const response=await fetch(url,{cache:'no-cache',signal:abort.signal});
    if(!response.ok)throw new Error(`Rate service returned HTTP ${response.status}`);
    return await response.json();
  }finally{clearTimeout(timer);}
}
function parseTollHighwayIndex(raw){
  const records=Array.isArray(raw)?raw:
    Array.isArray(raw?.highways)?raw.highways:
    Array.isArray(raw?.data)?raw.data:
    Array.isArray(raw?.items)?raw.items:[];
  return records.map(h=>({
    id:Number(h?.id??h?.highwayId),
    name:String(h?.name??h?.highway??'').trim(),
    routeCount:Number(h?.routeCount??h?.routesCount??1)
  })).filter(h=>Number.isInteger(h.id) && h.id>0 && h.id<1000 &&
    h.name && h.routeCount>0);
}
async function initializeTollFareLookup(){
  if(tollFareHighwaysLoaded)return;
  tollFareHighwaysLoaded=true;
  setTollFareStatus('Loading highway rates…');
  try{
    const raw=await getTollFareJson(`${TOLL_FARE_MIRROR}/highways.json`);
    const highways=parseTollHighwayIndex(raw);
    if(!highways.length)throw new Error('The rate index was empty');
    tollFareSelectOptions(tollFareHighway,highways.map(h=>h.name),'Choose a highway');
    for(let i=0;i<highways.length;i++)tollFareHighway.options[i+1].value=String(highways[i].id);
    tollFareHighway.disabled=false;
    setTollFareStatus('Choose your highway, then the exact entry and exit plazas.');
  }catch(error){
    tollFareHighwaysLoaded=false;
    setTollFareStatus('Rates are temporarily unavailable. Please use the official LLM or PLUS calculator.');
  }
}
$('tollFareLookup').addEventListener('toggle',event=>{
  if(event.currentTarget.open)void initializeTollFareLookup();
});
tollFareHighway.addEventListener('change',async()=>{
  const serial=++tollFareLoadCounter;
  tollFareCurrentHighway=null;
  tollFareSelectOptions(tollFareEntry,[],'Loading plazas…');
  tollFareSelectOptions(tollFareExit,[],'Choose a highway first');
  tollFareEntry.disabled=true;tollFareExit.disabled=true;tollFareCalculate.disabled=true;
  const highwayId=Number(tollFareHighway.value);
  if(!Number.isInteger(highwayId)||highwayId<=0||highwayId>=1000){
    setTollFareStatus('Choose a highway.');return;
  }
  setTollFareStatus('Loading exact entry–exit fares…');
  try{
    let raw=tollFareCache.get(highwayId);
    if(!raw){
      raw=await getTollFareJson(`${TOLL_FARE_MIRROR}/${highwayId}.json`);
      tollFareCache.set(highwayId,raw);
    }
    if(serial!==tollFareLoadCounter)return;
    const routes=Array.isArray(raw?.routes)?raw.routes:[];
    if(!routes.length)throw new Error('No rates for this highway');
    const entries=[...new Set(routes.map(r=>r.entryPlaza).filter(Boolean))].sort();
    if(!entries.length)throw new Error('Entry plazas unavailable');
    tollFareCurrentHighway={raw,routes};
    tollFareSelectOptions(tollFareEntry,entries,'Select entry');
    tollFareSelectOptions(tollFareExit,[],'Select entry first');
    tollFareEntry.disabled=false;
    setTollFareStatus('Select the entry plaza and exit plaza.');
  }catch(error){
    if(serial===tollFareLoadCounter){
      setTollFareStatus('Unable to load this highway. Try another or check the official calculator.');
    }
  }
});
tollFareEntry.addEventListener('change',()=>{
  const exits=[...new Set((tollFareCurrentHighway?.routes||[])
    .filter(r=>r.entryPlaza===tollFareEntry.value)
    .map(r=>r.exitPlaza).filter(Boolean))].sort();
  tollFareSelectOptions(tollFareExit,exits,'Select exit');
  tollFareExit.disabled=!exits.length;
  tollFareCalculate.disabled=true;
  setTollFareStatus('Choose your exit plaza.');
});
tollFareExit.addEventListener('change',()=>{
  tollFareCalculate.disabled=!(tollFareEntry.value&&tollFareExit.value);
});
tollFareCalculate.addEventListener('click',()=>{
  const match=tollFareCurrentHighway?.routes.find(r=>
    r.entryPlaza===tollFareEntry.value && r.exitPlaza===tollFareExit.value);
  const rate=match?.rates?.find(r=>Number(r.vehicleClass)===1);
  const amount=Number(rate?.rateRM);
  if(!match || rate==null || !Number.isFinite(amount) || amount<0){
    setTollFareStatus('No verified Class 1 amount for that pair. Check the official calculator.');return;
  }
  const sourceDate=String(tollFareCurrentHighway.raw?.generatedAt||'').slice(0,10);
  setTollFareStatus(`${tollFareLabel(amount)} · Class 1 car · selected entry–exit plazas`+
    `${/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)?` · dataset ${sourceDate}`:''}. `+
    'Not linked automatically to the selected MyArah route. Confirm with LLM before travel.');
});

function syncRouteLayers() {
  const style = map.getStyle();
  if (!style?.layers?.length) return;
  const layers = style.layers;
  const before = layers.find(layer => layer.type === 'symbol' && layer.id !== SELECTED_PIN_LAYER)?.id;
  if (!map.getSource(ROUTE_SOURCE)) map.addSource(ROUTE_SOURCE, {type:'geojson', data: routeGeojson()});
  else map.getSource(ROUTE_SOURCE).setData(routeGeojson());
  if (!map.getSource(ROUTE_START_SOURCE)) map.addSource(ROUTE_START_SOURCE, {type:'geojson', data:routeStartGeojson()});
  else map.getSource(ROUTE_START_SOURCE).setData(routeStartGeojson());
  const add = (name, filter, color, width, opacity=1) => {
    if (map.getLayer(name)) return;
    map.addLayer({id:name,type:'line',source:ROUTE_SOURCE,filter,
      layout:{'line-join':'round','line-cap':'round'},
      paint:{'line-color':color,'line-width':width,'line-opacity':opacity}
    }, before);
  };
  // Keep alternatives subtle. The selected road uses a crisp, contrasting
  // casing and a saturated blue core with zoom-adaptive widths. Do not infer
  // traffic or add roads: all line geometry still comes from TomTom routes.
  add(ROUTE_LAYERS[0], ['==',['get','selected'],0], dark ? '#93a9bd' : '#8498ab',
      ['interpolate',['linear'],['zoom'],9,2.5,13,3.5,16,5.1,18,6.5,20,8], dark ? 0.57 : 0.51);
  add(ROUTE_LAYERS[1], ['==',['get','selected'],1], dark ? '#102638' : '#fffefd',
      ['interpolate',['linear'],['zoom'],9,7,13,9,16,13.2,18,16,20,20],1);
  add(ROUTE_LAYERS[2], ['==',['get','selected'],1], dark ? '#49a6fa' : '#167bd6',
      ['interpolate',['linear'],['zoom'],9,4,13,5.7,16,8.6,18,10.8,20,13.4],1);
  if (!map.getLayer('myarah-route-start-dot')) {
    map.addLayer({id:'myarah-route-start-dot',type:'circle',source:ROUTE_START_SOURCE,
      paint:{'circle-radius':7,'circle-color':'#159c7c','circle-stroke-width':3,'circle-stroke-color':'#ffffff'}
    });
  }
  // Keep the accurate destination pin on top of route geometry.
  if (map.getLayer(SELECTED_PIN_LAYER)) map.moveLayer(SELECTED_PIN_LAYER);
  syncTollMapMarkers();
}
map.on('style.load', () => {
  // A style reload discards old paint sources. Stop any pending fade first.
  clearRouteSelectionTransition();
  requestAnimationFrame(syncRouteLayers);
});

function clearRouteGeometry() {
  cancelRoutePreviewRefit();
  clearRouteSelectionTransition();
  routeFramingActive=false;
  appRoot.classList.remove('route-preview-active');
  routeOptions = [];
  routeSelected = 0;
  routeCards.replaceChildren();
  $('routeTolls').hidden=true;
  clearTollMapMarkers();
  refreshNavigationStart();
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

// TomTom Orbis v3 uses path indices for *posted* speed-limit sections.
// No road-type defaults: unknown limits must remain unknown, especially near
// parallel Malaysian roads, roadworks and time-dependent restrictions.
function normalizeRouteSpeedLimits(raw,coordinates){
  const sections=raw?.sections?.speedLimit;
  if(!Array.isArray(sections) || !Array.isArray(coordinates) || coordinates.length<2)return [];
  const cumulative=[0];
  for(let i=1;i<coordinates.length;i++){
    const distance=haversineMeters(coordinates[i-1],coordinates[i]);
    if(!Number.isFinite(distance))return [];
    cumulative.push(cumulative[i-1]+distance);
  }
  const result=[];
  for(const section of sections){
    const first=section?.startPathIndex,last=section?.endPathIndex;
    if(!Number.isInteger(first) || !Number.isInteger(last) || first<0 ||
       last>=coordinates.length || first>=last)continue;
    const values=(Array.isArray(section.speedRestrictions)?section.speedRestrictions:[])
      .filter(restriction=>String(restriction?.type||'').toLowerCase()==='maximum')
      .map(restriction=>restriction.inKilometersPerHour)
      .filter(value=>Number.isInteger(value) && value>=10 && value<=150);
    // Ambiguous maximum limits should not trigger a driver warning.
    const unique=[...new Set(values)];
    if(unique.length!==1)continue;
    const start=cumulative[first],end=cumulative[last];
    if(end-start<1)continue;
    result.push({start,end,kmh:unique[0]});
  }
  return result.sort((a,b)=>a.start-b.start);
}
// Suppress both sides of a speed-limit transition to avoid false warnings
// from GPS jitter at junctions. Overlapping, disagreeing records are unknown.
function speedLimitAtAlong(sections,along,transitionMargin=7){
  if(!Array.isArray(sections) || !Number.isFinite(along))return null;
  // Keep both sides of a change unknown until the GPS position is well inside
  // one section. Unlike visual marker easing, this uses the RAW route match.
  const margin=Math.max(7,Math.min(55,Number.isFinite(transitionMargin)?transitionMargin:7));
  const matches=sections.filter(section=>{
    if(!Number.isFinite(section.start) || !Number.isFinite(section.end) ||
       !Number.isFinite(section.kmh))return false;
    return along>=section.start+margin && along<section.end-margin;
  });
  if(!matches.length)return null;
  const values=[...new Set(matches.map(section=>section.kmh))];
  return values.length===1?values[0]:null;
}
// The road-limit sign uses current GPS progress, not the separately smoothed
// blue marker. At high speed or poor accuracy we wait farther beyond junctions.
function speedLimitTransitionMargin(accuracy,speed){
  const uncertainty=Number.isFinite(accuracy)?Math.max(0,accuracy):35;
  const movement=Number.isFinite(speed)?Math.max(0,speed):0;
  return Math.max(9,Math.min(55,uncertainty*1.05+movement*1.15+5));
}
// A nearby, materially different part of the selected route can look like the
// same road to GPS (parallel carriageway, stacked flyover, tight U-turn).
// If both are plausible but their speed limits differ, show unknown instead.
function ambiguousNearbySpeedLimit(index,sections,point,match,accuracy,heading,speed){
  if(!index?.segments?.length || !point?.every?.(Number.isFinite) ||
     !Number.isFinite(match?.along) || !Number.isFinite(accuracy))return true;
  const radius=Math.max(12,Math.min(35,accuracy*1.15+8));
  const cos=Math.max(.15,Math.cos(point[1]*Math.PI/180));
  const mainLimit=speedLimitAtAlong(sections,match.along,7);
  for(const segment of index.segments){
    const mid=segment.start+segment.length*.5;
    // Adjacent pieces of the same intersection are handled by the transition
    // guard; this check targets *separate* close sections of the route.
    if(Math.abs(mid-match.along)<Math.max(55,accuracy*2+22))continue;
    const ax=(segment.a[0]-point[0])*111320*cos;
    const ay=(segment.a[1]-point[1])*110540;
    const bx=(segment.b[0]-point[0])*111320*cos;
    const by=(segment.b[1]-point[1])*110540;
    const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
    if(len2<.001)continue;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len2));
    if(Math.hypot(ax+t*dx,ay+t*dy)>radius)continue;
    // GPS heading can sometimes rule out the other carriageway, but don't
    // trust it while stopped or when horizontal accuracy is poor.
    if(Number.isFinite(heading) && Number.isFinite(speed) &&
       speed>=4.5 && accuracy<=22 &&
       Math.abs(smallestAngle(heading-segment.bearing))>65)continue;
    const candidateLimit=speedLimitAtAlong(sections,segment.start+segment.length*t,7);
    if(candidateLimit!==mainLimit)return true;
  }
  return false;
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
    const coords=path.map(point=>[point[0],point[1]]);
    const instructions=Array.isArray(raw.instructions)?raw.instructions
      .filter(item=>Number.isFinite(item?.routeOffsetInMeters) && item.routeOffsetInMeters>=0 &&
        typeof item.maneuver==='string')
      .map(item=>({maneuver:item.maneuver,offset:item.routeOffsetInMeters,
        message:typeof item.message==='string'?item.message.trim().slice(0,260):''}))
      .sort((a,b)=>a.offset-b.offset):[];
    const tollPoints=applyVerifiedClass1Tolls(
      normalizeRouteTollPoints(raw,coords,meters,instructions),raw,coords,meters);
    return {
      coordinates: coords,
      seconds, meters,
      delay: Number.isFinite(delay) && delay >= 0 ? delay : null,
      toll:tollPoints.length>0,
      tollPoints,
      speedLimits:normalizeRouteSpeedLimits(raw,coords),
      arrival: summary.arrivalDateTime || null,
      instructions
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
    if (route.toll){
      const tolls=verifiedClass1TollSummary(route);
      detailParts.push(tolls.priced
        ? `${tollFareLabel(tolls.total)} identified tolls${tolls.others?' (partial)':''}`
        : `${route.tollPoints.length} toll indicator${route.tollPoints.length===1?'':'s'} · fare to verify`);
    }
    detail.textContent=detailParts.join(' · ');
    const lower=document.createElement('div'); lower.className='route-card-bottom';
    lower.textContent = index===routeSelected ? 'Selected · highlighted blue' : 'Tap to preview this route';
    card.append(heading,detail,lower);
    card.addEventListener('click',() => selectRoute(index));
    routeCards.append(card);
  });
  renderSelectedTolls();
  refreshNavigationStart();
}

// Route preview framing is based on the REAL map, panel and controls rather
// than a guessed percentage of window.innerHeight. In landscape, the route
// panel can occupy the left side; in portrait it occupies the bottom.
const routeFrameControls = document.querySelector('.map-controls');
const routeFrameTopbar = document.querySelector('.topbar');
let routeRefitTimer = null;
let routeFrameToken = 0;
function cancelRoutePreviewRefit() {
  routeFrameToken++;
  if (routeRefitTimer !== null) clearTimeout(routeRefitTimer);
  routeRefitTimer = null;
}
function routeFramingPadding() {
  const mapRect = map.getContainer().getBoundingClientRect();
  const panelRect = sheet.getBoundingClientRect();
  const w = mapRect.width, h = mapRect.height;
  if (!(w > 260 && h > 210) || !panelRect.width) return null;
  const sidePanel = panelRect.width < w * .72 &&
    panelRect.right < mapRect.left + w * .74;
  const edge = Math.max(16, Math.min(28, Math.min(w,h) * .045));
  let top = edge, bottom = edge, left = edge, right = edge;
  // The panel's final height is known before its 430 ms snap animation ends.
  // This avoids fitting the route underneath an expanding sheet.
  const targetHeight = sheetHeights()[sheetPosition];
  const projectedTop = panelRect.bottom - targetHeight;
  if (sidePanel) {
    left = Math.max(left, Math.ceil(panelRect.right-mapRect.left + 18));
  } else {
    bottom = Math.max(bottom, Math.ceil(mapRect.bottom-projectedTop + 18));
  }
  const controlsRect = routeFrameControls?.getBoundingClientRect();
  if (controlsRect?.width && !navigation.active && sheetPosition !== 'full') {
    const overlapsSide = controlsRect.right > mapRect.left + w * .65;
    if (overlapsSide) right = Math.max(right, Math.ceil(mapRect.right-controlsRect.left+10));
  }
  const topbarRect = routeFrameTopbar?.getBoundingClientRect();
  if (topbarRect?.height && !navigation.active) {
    if (sidePanel && topbarRect.left > mapRect.left + w * .52) {
      right = Math.max(right, Math.ceil(mapRect.right-topbarRect.left+10));
    } else if (!sidePanel) {
      top = Math.max(top, Math.ceil(topbarRect.bottom-mapRect.top+14));
    }
  }
  // Do not submit impossible or tiny camera areas to MapLibre. When the
  // user fully expands a tall portrait sheet, preserve the last useful view
  // until the panel is lowered instead of abruptly zooming out behind it.
  if (w - left - right < 145 || h - top - bottom < 150) return null;
  return {top:Math.ceil(top),bottom:Math.ceil(bottom),
    left:Math.ceil(left),right:Math.ceil(right)};
}
function fitRouteOnMap({duration=670}={}) {
  if (!routeOptions[routeSelected] || navigation.active || routePickMode ||
      sheetGesture || myarahTextFieldActive() || document.hidden) return false;
  const padding = routeFramingPadding();
  if (!padding) return false;
  const bounds = new maplibregl.LngLatBounds();
  routeOptions[routeSelected].coordinates.forEach(point=>bounds.extend(point));
  // linear:true selects easeTo instead of an abrupt flight/zoom-out arc.
  // Use MapLibre's per-fit padding (not persistent camera padding): route
  // previews must never offset the live navigation follow-camera.
  map.fitBounds(bounds,{
    padding, linear:true,
    pitch:tilted?35:0,bearing:0,maxZoom:15,
    duration:reducedMotion?0:duration,
    easing:t=>1-Math.pow(1-t,3)
  });
  return true;
}
function scheduleRoutePreviewRefit(delay=90) {
  cancelRoutePreviewRefit();
  if (!routeFramingActive) return;
  const token=routeFrameToken;
  routeRefitTimer=setTimeout(()=>{
    routeRefitTimer=null;
    if(token!==routeFrameToken || !routeFramingActive) return;
    fitRouteOnMap({duration:reducedMotion?0:570});
  },delay);
}
function updateSelectedRouteCard() {
  [...routeCards.children].forEach((card,i)=>{
    const selected=i===routeSelected;
    card.classList.toggle('is-selected',selected);
    card.setAttribute('aria-pressed',String(selected));
    const detail=card.querySelector('.route-card-bottom');
    if(detail) detail.textContent=selected?'Selected · highlighted blue':'Tap to preview this route';
  });
  renderSelectedTolls();
  refreshNavigationStart();
}
// A short, data-backed fade of the previous blue route makes selection feel
// continuous without inventing any intermediate road geometry.
const ROUTE_FADE_SOURCE='myarah-route-switch-fade-source';
const ROUTE_FADE_LAYER='myarah-route-switch-fade';
let routeFadeTimer=null;
let routeFadeFrame=0;
let routeFadeGeneration=0;
function clearRouteSelectionTransition() {
  routeFadeGeneration++;
  if(routeFadeTimer!==null)clearTimeout(routeFadeTimer);
  if(routeFadeFrame)cancelAnimationFrame(routeFadeFrame);
  routeFadeTimer=null;routeFadeFrame=0;
  if(map.getLayer(ROUTE_FADE_LAYER))map.removeLayer(ROUTE_FADE_LAYER);
  if(map.getSource(ROUTE_FADE_SOURCE))map.removeSource(ROUTE_FADE_SOURCE);
}
function fadePreviousRoute(route) {
  clearRouteSelectionTransition();
  if(reducedMotion || !route?.coordinates?.length || !map.isStyleLoaded())return;
  const generation=routeFadeGeneration;
  const darkTheme=dark;
  map.addSource(ROUTE_FADE_SOURCE,{type:'geojson',data:{type:'Feature',
    geometry:{type:'LineString',coordinates:route.coordinates},properties:{}}});
  map.addLayer({id:ROUTE_FADE_LAYER,type:'line',source:ROUTE_FADE_SOURCE,
    layout:{'line-cap':'round','line-join':'round'},
    paint:{'line-color':darkTheme?'#49a6fa':'#167bd6',
      'line-width':['interpolate',['linear'],['zoom'],9,4,13,5.7,16,8.6,18,10.8,20,13.4],
      'line-opacity':1,'line-opacity-transition':{duration:320,delay:0}}},
    map.getLayer(SELECTED_PIN_LAYER)?SELECTED_PIN_LAYER:undefined);
  routeFadeFrame=requestAnimationFrame(()=>{
    routeFadeFrame=0;
    if(generation===routeFadeGeneration && map.getLayer(ROUTE_FADE_LAYER))
      map.setPaintProperty(ROUTE_FADE_LAYER,'line-opacity',0);
  });
  routeFadeTimer=setTimeout(()=>{
    routeFadeTimer=null;
    if(generation===routeFadeGeneration)clearRouteSelectionTransition();
  },440);
}
function selectRoute(index) {
  if (!routeOptions[index] || navigation.active || routeBusy) return;
  if(index===routeSelected){
    setSheetPosition('half');
    scheduleRoutePreviewRefit(50);
    return;
  }
  const previous=routeOptions[routeSelected];
  routeSelected=index;
  syncRouteLayers();
  fadePreviousRoute(previous);
  // Preserve card DOM, focus and internal scroll offset between selections.
  updateSelectedRouteCard();
  setSheetPosition('half');
  scheduleRoutePreviewRefit(55);
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
      departureDateTime:'now',maxPathAlternativeRoutes:2,
      guidance:'instructions',instructionPhonetics:'ipa'
    };
    const response=await fetch(ROUTE_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','TomTom-Api-Key':trafficKey,'Accept-Language':'en-GB','Attributes':'routes,routes.sections.speedLimit'},
      body:JSON.stringify(requestBody),signal:controller.signal,cache:'no-store'
    });
    if (!response.ok) throw new Error(describeRouteError(response));
    const json=await response.json();
    if (job!==routeJob || routeRequestDestinationId!==chosen?.id) return;
    const options=normalizeProviderRoutes(json);
    if (!options.length) throw new Error('No usable driving route was returned. Try a different starting point.');
    routeOptions=options;
    routeSelected=0;
    routeFramingActive=true;
    appRoot.classList.add('route-preview-active');
    syncRouteLayers();
    renderRouteCards();
    const n=options.length;
    setRouteStatus(`${n} real route${n===1?'':'s'} found · sorted by traffic-aware ETA, fastest first.`);
    routePlanButton.firstChild.textContent='Refresh routes ';
    // A half-height sheet leaves useful map area; users can still expand it
    // to inspect all cards and toll details without losing the selected route.
    setSheetPosition('half');
    scheduleRoutePreviewRefit(75);
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
      refreshNavigationStart();
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
  if (navigation.active) endNavigation('Navigation ended');
  cancelRouteRequest();endRoutePick();clearRouteGeometry();
  routeOrigin=null;routePreview.hidden=true;
  if (map.getSource(ROUTE_START_SOURCE)) map.getSource(ROUTE_START_SOURCE).setData(routeStartGeojson());
  setSheetPosition('peek');
});
// The traffic key is already stored only in this device. Do not embed it in code.
// New style (light/dark) is already handled by syncRouteLayers above.
// Reset the initial comparison after all navigation state initializes.

// Compass redesign: follow the map rotation only, like a classic north-up dial.
let shownCompassRotation = null;
const compassButton = $('north');
const compassRoseElement = $('compassRose');
const compassCardinalElement = $('compassCardinal');
const compassNorm = angle => (angle % 360 + 360) % 360;
const compassDelta = angle => ((angle + 540) % 360) - 180;
const compassWords16 = ['North','North-northeast','Northeast','East-northeast','East','East-southeast','Southeast','South-southeast','South','South-southwest','Southwest','West-southwest','West','West-northwest','Northwest','North-northwest'];
const compassShort16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function compassPoint16(angle) {
  const index = Math.round(compassNorm(angle) / 22.5) % 16;
  return { index, short: compassShort16[index], long: compassWords16[index] };
}
function updateCompassDial() {
  const bearing = compassNorm(map.getBearing());
  const point = compassPoint16(bearing);
  const target = -bearing;
  shownCompassRotation = shownCompassRotation === null ? target :
    shownCompassRotation + compassDelta(target - shownCompassRotation);
  compassRoseElement.style.transform = `rotate(${shownCompassRotation}deg)`;
  compassCardinalElement.textContent = point.short;
  compassButton.setAttribute('aria-label', `Map points ${point.long}. Tap to reset the map north.`);
}
map.on('rotate', updateCompassDial);
map.on('style.load', updateCompassDial);
compassButton.addEventListener('click', () => {
  map.easeTo({bearing:0, duration:reducedMotion?0:520, easing:cameraEase});
  toast('Map reset to north');
});
updateCompassDial();



// === MyArah navigation preview — real TomTom guidance, foreground GPS only. ===
// Navigation is intentionally not advertised as background/lock-screen guidance.
// Route instructions are returned by TomTom; do not derive turns from the drawn line.
const navigation = {
  active:false, watchId:null, destinationId:null, route:null,
  lastCoords:null, lastUpdate:0, lastCamera:0, lastProgress:0,
  lastBearing:null, markerAnimation:0, markerPoint:null,
  // The camera follows the marker's *displayed* position, not raw GPS jumps.
  cameraState:null, cameraFrame:0,
  follow:true, voiced:false, voiceMode:'normal', spoken:new Set(), turnIndex:-1,
  alertSpoken:new Set(),pendingAlertKey:null,pendingGuidanceKey:null,
  // Guidance announcements are relative to movement, not fixed road distances.
  // Keep timing state separate from GPS/map smoothing and reset it on reroute.
  guidanceSpeed:null, guidanceSpokenAt:0,
  offCount:0, offRoute:false, rerouting:false, lastReroute:0,
  // Automatic rerouting only follows confirmed movement off the selected road.
  offStartPoint:null, autoFailure:false, rerouteController:null, sessionToken:0,
  // A car park / mall entrance may start slightly away from the routed road.
  joiningRoute:false, joinSince:0, joinStartPoint:null,
  joinStartDistance:0, joinOnCount:0,
  lastPosition:null, announcedArrival:false,
  // Indexed route geometry and filtered position are held only during guidance.
  routeIndex:null, matchedAlong:null, drawnAlong:null,
  lastRawFix:null, lastAcceptedTime:0, lastCameraPoint:null,
  lastCameraBearing:null, offSince:0, onCount:0, arrivalCount:0,
  // Independent ETA state: only reliable on-route fixes update trip progress.
  eta:null, etaTimer:null,
  speedometer:null, speedTimer:null,
  // Speed-limit warnings only use accurate matches onto this exact route.
  speedLimitEligible:false, speedLimitWarningCount:0, speedLimitWarning:false,
  speedLimitState:null, speedLimitWarningSince:0, speedLimitClearCount:0,
  laneSections:[], laneController:null,
  // Independent confidence for lane advice. Legal speed-limit confirmation is
  // intentionally NOT a prerequisite for recommending provider-verified lanes.
  laneFix:null,
  lastAlert:''
};
const navStartButton=$('navStart');
const navHud=$('navHud');
const navFooter=$('navFooter');
const navAlert=$('navAlert');

// GPS-based speedometer. The browser reports metres/second (sometimes null).
// Inference is deliberately stricter than the speed used by navigation guidance:
// a parked car must not appear to accelerate due to ordinary GPS drift.
const NAV_SPEED_FRESH_MS = 18000;
const NAV_LIMIT_FIX_FRESH_MS = 12000;
const NAV_LIMIT_WARN_BUFFER_KMH = 3;
function currentRoadSpeedLimit(now=Date.now()) {
  if(!navigation.active || navigation.rerouting || navigation.offRoute ||
     navigation.joiningRoute || !navigation.speedLimitEligible ||
     !navigation.route || now-navigation.lastAcceptedTime>NAV_LIMIT_FIX_FRESH_MS)return null;
  const state=navigation.speedLimitState;
  return state && Number.isFinite(state.confirmed) &&
    now-state.confirmedAt<=NAV_LIMIT_FIX_FRESH_MS ? state.confirmed : null;
}
function resetSpeedLimitWarning(){
  navigation.speedLimitWarningCount=0;
  navigation.speedLimitWarningSince=0;
  navigation.speedLimitClearCount=0;
  navigation.speedLimitWarning=false;
}
function resetSpeedLimitTracking(){
  navigation.speedLimitState={confirmed:null,confirmedAt:0,pending:null,
    firstSeen:0,count:0,lastObservation:0,lastRawAlong:null};
  navigation.speedLimitEligible=false;
  resetSpeedLimitWarning();
}
function observeRoadSpeedLimit(rawAlong,point,match,accuracy,speed,heading,now=Date.now()){
  let state=navigation.speedLimitState;
  if(!state || (state.lastObservation>0 && now-state.lastObservation>NAV_LIMIT_FIX_FRESH_MS)){
    resetSpeedLimitTracking();
    state=navigation.speedLimitState;
  }
  if(!navigation.route || !navigation.routeIndex ||
     !Number.isFinite(rawAlong) ||
     ambiguousNearbySpeedLimit(navigation.routeIndex,navigation.route.speedLimits,
       point,match,accuracy,heading,speed)){
    resetSpeedLimitTracking();return null;
  }
  const margin=speedLimitTransitionMargin(accuracy,speed);
  const observed=speedLimitAtAlong(navigation.route.speedLimits,rawAlong,margin);
  if(observed===null){resetSpeedLimitTracking();return null;}
  // If route matching jumps far ahead within one GPS interval, do not let a
  // new road limit flash up. Recover on subsequent consistent GPS fixes.
  if(Number.isFinite(state.lastRawAlong) && state.lastObservation>0){
    const elapsed=(now-state.lastObservation)/1000;
    if(elapsed>0 && elapsed<14){
      const plausible=Math.max(65,(Number.isFinite(speed)?speed:20)*elapsed*1.7+accuracy*2+25);
      if(Math.abs(rawAlong-state.lastRawAlong)>plausible){
        resetSpeedLimitTracking();return null;
      }
    }
  }
  state.lastRawAlong=rawAlong;
  state.lastObservation=now;
  if(state.confirmed===observed){state.confirmedAt=now;return observed;}
  // Remove the previous limit immediately after a suspected change. Never
  // warn against an old road's limit while the new one is unconfirmed.
  state.confirmed=null;
  resetSpeedLimitWarning();
  if(state.pending!==observed){
    state.pending=observed;state.firstSeen=now;state.count=1;
  }else{
    state.count++;
  }
  if(state.count>=2 && now-state.firstSeen>=850){
    state.confirmed=observed;state.confirmedAt=now;
    state.pending=null;state.count=0;
    return observed;
  }
  return null;
}
function updateSpeedLimitWarning(sampleAvailable,now=Date.now()){
  const limit=currentRoadSpeedLimit(now);
  const speed=navigation.speedometer?.filtered;
  const trusted=sampleAvailable && Number.isFinite(speed) &&
    now-navigation.speedometer.trustedAt<=NAV_LIMIT_FIX_FRESH_MS;
  if(limit===null || !trusted){resetSpeedLimitWarning();return;}
  const kmh=speed*3.6;
  if(kmh>=limit+NAV_LIMIT_WARN_BUFFER_KMH){
    navigation.speedLimitClearCount=0;
    if(!navigation.speedLimitWarningCount)navigation.speedLimitWarningSince=now;
    navigation.speedLimitWarningCount=Math.min(4,navigation.speedLimitWarningCount+1);
    // A single noisy GPS sample cannot turn the glass red.
    if(navigation.speedLimitWarningCount>=2 &&
       now-navigation.speedLimitWarningSince>=850)navigation.speedLimitWarning=true;
  }else if(kmh<=limit+1){
    navigation.speedLimitWarningCount=0;
    navigation.speedLimitWarningSince=0;
    navigation.speedLimitClearCount++;
    // Clear quickly after a genuine slowdown but don't flicker for one sample.
    if(navigation.speedLimitClearCount>=2)navigation.speedLimitWarning=false;
  }else{
    // Between thresholds: retain the current color instead of flashing.
    navigation.speedLimitWarningCount=0;
    navigation.speedLimitWarningSince=0;
    navigation.speedLimitClearCount=0;
  }
}

function reliableNavSpeed(reported, inferred, accuracy, previousAccuracy, displacement, elapsed) {
  // iOS can report GPS speed even when horizontal position accuracy is more
  // than 45 metres. Don't discard that valid native measurement outright.
  if (!Number.isFinite(accuracy) || accuracy > NAV_FIX_MAX_ACCURACY_M) return null;
  if (Number.isFinite(reported) && reported >= 0 && reported <= 75) return reported;
  // Some iPhones do not populate GeolocationCoordinates.speed. Infer it from
  // *two* fixes only when displacement clearly exceeds their combined error.
  // Never present GPS jitter from a stationary car as an actual speed.
  if (Number.isFinite(inferred) && inferred >= 0 && inferred <= 55 &&
      Number.isFinite(previousAccuracy) && accuracy <= 65 && previousAccuracy <= 65 &&
      elapsed >= 1.5 && elapsed <= 20 &&
      displacement >= Math.max(22, (accuracy + previousAccuracy) * 1.15)) return inferred;
  return null;
}
function renderNavSpeed(now=Date.now()) {
  const gauge=$('navSpeed');
  if (!gauge) return;
  const state=navigation.speedometer;
  if (!navigation.active || !state) { gauge.hidden=true; return; }
  gauge.hidden=false;
  const fresh=state.filtered!==null && now-state.trustedAt <= NAV_SPEED_FRESH_MS;
  const kmh=fresh ? Math.max(0, Math.round(state.filtered*3.6)) : null;
  const value=kmh!==null && kmh<3 ? 0 : kmh;
  if (state.displayed!==value) {
    $('navSpeedValue').textContent=value===null ? '—' : String(value);
    state.displayed=value;
  }
  const sign=$('navSpeedLimit');
  const limit=currentRoadSpeedLimit(now);
  if(sign){
    sign.hidden=false;
    sign.dataset.known=limit!==null?'true':'false';
    const text=limit!==null?String(limit):'—';
    if($('navSpeedLimitValue').textContent!==text)$('navSpeedLimitValue').textContent=text;
    sign.setAttribute('aria-label',limit!==null?
      `Mapped road speed limit ${limit} kilometres per hour`:'Road speed limit unavailable');
    sign.title=limit!==null?`Mapped road limit: ${limit} km/h · obey road signs`:'Road speed limit unavailable';
  }
  // A stale GPS speed cannot trigger a red warning, even if the limit is known.
  const warn=limit!==null && fresh && now-state.trustedAt<=NAV_LIMIT_FIX_FRESH_MS &&
    navigation.speedLimitWarning;
  gauge.dataset.overspeed=warn?'true':'false';
  gauge.dataset.available=fresh?'true':'false';
  gauge.setAttribute('aria-label',fresh ?
    `Approximate GPS speed ${value} kilometres per hour`+
    (limit!==null?`, mapped speed limit ${limit}${warn?', above limit':''}`:'; road limit unknown') :
    'GPS speed unavailable');
}
function resetNavSpeed(initialSpeed=null, accuracy=Infinity, now=Date.now()) {
  navigation.speedometer={filtered:null,trustedAt:0,lastSampleAt:0,displayed:undefined};
  resetSpeedLimitTracking();
  if (Number.isFinite(initialSpeed) && initialSpeed>=0 && initialSpeed<=75 && accuracy<=NAV_FIX_MAX_ACCURACY_M) {
    navigation.speedometer.filtered=initialSpeed;
    navigation.speedometer.trustedAt=now;
    navigation.speedometer.lastSampleAt=now;
  }
  renderNavSpeed(now);
}
function updateNavSpeed(reported, inferred, accuracy, previousAccuracy, displacement, elapsed, now=Date.now()) {
  const state=navigation.speedometer;
  if (!navigation.active || !state) return;
  const sample=reliableNavSpeed(reported,inferred,accuracy,previousAccuracy,displacement,elapsed);
  if (sample!==null) {
    const sampleDt=state.lastSampleAt ? Math.max(.1,Math.min(12,(now-state.lastSampleAt)/1000)) : 2;
    if(state.filtered===null || now-state.trustedAt>NAV_SPEED_FRESH_MS) {
      state.filtered=sample;
    }else {
      // Ease readings, but do not delay genuine slowing or stopping too much.
      const response=sample<state.filtered ? 1.45 : 2.3;
      const weight=1-Math.exp(-sampleDt/response);
      const bounded=state.filtered + Math.max(-7*sampleDt,Math.min(5*sampleDt,sample-state.filtered));
      state.filtered=state.filtered+(bounded-state.filtered)*weight;
      if (sample<.5 && state.filtered<.95) state.filtered=0;
    }
    state.lastSampleAt=now;
    state.trustedAt=now;
    // Eligibility is set after map matching. The current GPS fix can only
    // update the warning once its route match has been confirmed below.
  }
  renderNavSpeed(now);
}

// Keep the screen awake automatically during foreground navigation.
// This is a best-effort browser request: iOS can revoke or reject it.
// No extra UI or alerts are shown, so the navigation screen remains uncluttered.
let navigationWakeLock = null;
let navigationWakeDesired = false;
let navigationWakeGeneration = 0;
let navigationWakePending = null;

function navigationWakeHeld() {
  return !!navigationWakeLock && !navigationWakeLock.released;
}
function requestNavigationWakeLock() {
  if (!navigationWakeDesired || document.hidden) return Promise.resolve(false);
  if (navigationWakeHeld()) return Promise.resolve(true);
  if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return Promise.resolve(false);
  const generation = navigationWakeGeneration;
  if (navigationWakePending?.generation === generation) return navigationWakePending.promise;
  let request;
  try {
    // Call synchronously from the existing Start navigation gesture when possible.
    request = navigator.wakeLock.request('screen');
  } catch (_) {
    return Promise.resolve(false);
  }
  const pending = Promise.resolve(request).then(async lock => {
    // Do not hold a lock if GPS setup failed, the trip ended or the app was hidden.
    if (!navigationWakeDesired || document.hidden || generation !== navigationWakeGeneration) {
      try { await lock.release(); } catch (_) {}
      return false;
    }
    navigationWakeLock = lock;
    lock.addEventListener('release', () => {
      if (navigationWakeLock === lock) navigationWakeLock = null;
      // A new request is made when MyArah returns to the foreground.
    });
    return true;
  }).catch(err => {
    // Avoid interrupting navigation with a notification or a second button.
    console.debug('Screen wake lock unavailable:', err?.name || err);
    return false;
  }).finally(() => {
    if (navigationWakePending?.promise === pending) navigationWakePending = null;
  });
  navigationWakePending = {generation, promise: pending};
  return pending;
}
function startNavigationWakeLock() {
  navigationWakeDesired = true;
  navigationWakeGeneration += 1;
  return requestNavigationWakeLock();
}
function stopNavigationWakeLock() {
  navigationWakeDesired = false;
  navigationWakeGeneration += 1;
  navigationWakePending = null;
  const previous = navigationWakeLock;
  navigationWakeLock = null;
  if (previous && !previous.released) {
    try { void previous.release().catch(() => {}); } catch (_) {}
  }
}

function refreshNavigationStart(){
  if (!navStartButton) return;
  const selected=routeOptions[routeSelected];
  navStartButton.hidden=!selected;
  const ready=!!selected?.instructions?.some(i => i.maneuver!=='depart');
  navStartButton.disabled=!ready || navigation.active || routeBusy;
  navStartButton.firstChild.textContent= ready ? 'Start navigation ' : 'Turn instructions unavailable ';
}

function guidanceLabel(maneuver){
  const names={depart:'Continue on the route',continueStraight:'Continue straight',
    turnLeft:'Turn left',turnRight:'Turn right',turnSlightLeft:'Slight left',
    turnSlightRight:'Slight right',turnSharpLeft:'Sharp left',turnSharpRight:'Sharp right',
    keepLeft:'Keep left',keepRight:'Keep right',keepCenter:'Keep center',
    makeUTurn:'Make a U-turn',mergeLeftLane:'Merge left',mergeRightLane:'Merge right',
    arrive:'You have arrived',arriveLeft:'Destination on the left',
    arriveRight:'Destination on the right',arriveAhead:'Destination ahead',
    exitMotorwayLeft:'Take the left exit',exitMotorwayRight:'Take the right exit',
    exitMotorwayMiddle:'Take the exit',exitRoundabout:'Exit the roundabout',
    roundaboutStraight:'Go through the roundabout',roundaboutLeft:'At roundabout, turn left',
    roundaboutRight:'At roundabout, turn right',roundaboutBack:'Go around the roundabout',
    passTollgate:'Approaching tollgate'};
  return names[maneuver] || 'Follow the route';
}
// Navigation maneuver SVGs: Lucide Icons (ISC license, license in README).
// These shapes are embedded so icons never require a network request.
// Only static, locally defined SVG data is ever inserted into these elements.
const NAV_MANEUVER_SVG = Object.freeze({
  straight:'<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  route:'<circle cx="6" cy="19" r="2"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="17" cy="5" r="2"/>',
  left:'<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  right:'<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',
  slightLeft:'<path d="m17 17-10-10"/><path d="M7 15V7h8"/>',
  slightRight:'<path d="m7 17 10-10"/><path d="M9 7h8v8"/>',
  uturn:'<path d="M12 21V9a5 5 0 0 0-10 0v3"/><path d="m2 8 0 4 4 0"/>',
  roundabout:'<path d="M20.8 10A9 9 0 1 0 21 12"/><path d="m16 10 5 0 0-5"/>',
  destination:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  mergeLeft:'<path d="M7 4v3a8 8 0 0 0 8 8h2"/><path d="m13 11 4 4-4 4"/><path d="M17 4v7"/>',
  mergeRight:'<path d="M17 4v3a8 8 0 0 1-8 8H7"/><path d="m11 11-4 4 4 4"/><path d="M7 4v7"/>'
});
function navManeuverIconName(code){
  const value=String(code||'').toLowerCase();
  if(value==='proceed')return 'route';
  if(/arrive|waypoint|destination/.test(value))return 'destination';
  if(/roundabout/.test(value))return 'roundabout';
  if(/uturn|u-turn|back/.test(value))return 'uturn';
  if(/merge/.test(value) && /left/.test(value))return 'mergeLeft';
  if(/merge/.test(value) && /right/.test(value))return 'mergeRight';
  if(/slight/.test(value) && /left/.test(value))return 'slightLeft';
  if(/slight/.test(value) && /right/.test(value))return 'slightRight';
  if(/left/.test(value))return 'left';
  if(/right/.test(value))return 'right';
  return 'straight';
}
function showNavManeuverIcon(elementId,maneuver){
  const element=$(elementId);
  if(!element)return;
  const name=navManeuverIconName(maneuver);
  if(element.dataset.navManeuver===name && element.firstElementChild?.tagName?.toLowerCase()==='svg')return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');
  svg.setAttribute('stroke-width','2.5');
  svg.setAttribute('stroke-linecap','round');
  svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('focusable','false');
  svg.setAttribute('aria-hidden','true');
  svg.innerHTML=NAV_MANEUVER_SVG[name];
  element.replaceChildren(svg);
  element.dataset.navManeuver=name;
}
function navDistance(m){
  if (!Number.isFinite(m)) return '—';
  if (m<100) return `${Math.max(0,Math.round(m/10)*10)} m`;
  if (m<1000) return `${Math.round(m/50)*50} m`;
  return `${(m/1000).toFixed(m<10000?1:0)} km`;
}
function haversineMeters(a,b){
  const r=6371000,d=Math.PI/180;
  const x=(b[0]-a[0])*d,y=(b[1]-a[1])*d;
  const h=Math.sin(y/2)**2+Math.cos(a[1]*d)*Math.cos(b[1]*d)*Math.sin(x/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(h)));
}
function bearingBetween(a,b){
  const d=Math.PI/180;
  const lat1=a[1]*d,lat2=b[1]*d,delta=(b[0]-a[0])*d;
  const y=Math.sin(delta)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(delta);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function computePolylineProgress(coords,position){
  // Project in meters around the sample latitude; this avoids screen-space pins.
  if(!Array.isArray(coords)||coords.length<2) return null;
  const cos=Math.max(.15,Math.cos(position[1]*Math.PI/180));
  let traveled=0,best=null;
  for(let i=0;i<coords.length-1;i++){
    const a=coords[i],b=coords[i+1];
    const ax=(a[0]-position[0])*111320*cos,ay=(a[1]-position[1])*110540;
    const bx=(b[0]-position[0])*111320*cos,by=(b[1]-position[1])*110540;
    const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
    if(len2<.0001) continue;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len2));
    const distance=Math.hypot(ax+t*dx,ay+t*dy),len=Math.sqrt(len2);
    if (!best || distance<best.distance){
      best={distance,along:traveled+t*len,index:i,ratio:t};
    }
    traveled+=len;
  }
  if(!best || traveled<=0) return null;
  const next=coords[Math.min(best.index+1,coords.length-1)];
  return {...best, fraction:Math.max(0,Math.min(1,best.along/traveled)),
    bearing:bearingBetween(coords[best.index],next)};
}

// Local route matching: project usable GPS fixes onto *the selected TomTom route*.
// This is route-corridor matching, NOT a network-wide map-matching service.
// Restrict candidate segments by recent route progress to avoid hopping between
// nearby flyovers, parallel roads and U-turns. Off-route detection uses RAW GPS.
const NAV_FIX_MAX_AGE_MS = 15000;
const NAV_FIX_MAX_ACCURACY_M = 85;
const NAV_OFF_ROUTE_FIXES = 3;
const NAV_OFF_ROUTE_CONFIRM_MS = 2500;
const NAV_AUTO_REROUTE_CONFIRM_MS = 6000;
const NAV_AUTO_REROUTE_COOLDOWN_MS = 45000;
const NAV_AUTO_REROUTE_MIN_TRAVEL_M = 24;
const NAV_JOIN_ALLOW_START_M = 450;
// The decision is deliberately conservative: no reroute for a single bad fix,
// a stationary vehicle, poor GPS, or a route that is still being joined.
function shouldAutomaticallyReroute(state,point,accuracy,speed,now){
  if(!state.active || state.rerouting || state.joiningRoute || !state.offRoute ||
     !state.offStartPoint || state.offCount<NAV_OFF_ROUTE_FIXES ||
     now-state.offSince<NAV_AUTO_REROUTE_CONFIRM_MS ||
     (state.lastReroute>0 && now-state.lastReroute<NAV_AUTO_REROUTE_COOLDOWN_MS) ||
     !Number.isFinite(accuracy) || accuracy>55 ||
     !Number.isFinite(speed) || speed<2.5 ||
     !point?.every?.(Number.isFinite))return false;
  return haversineMeters(state.offStartPoint,point)>=NAV_AUTO_REROUTE_MIN_TRAVEL_M;
}
function needsToJoinRoute(match){
  return !match?.valid || match.nearestDistance>32;
}
function resetJoinState(match,point,now=Date.now()){
  navigation.joiningRoute=needsToJoinRoute(match);
  navigation.joinSince=now;
  navigation.joinStartPoint=[...point];
  navigation.joinStartDistance=Number.isFinite(match?.nearestDistance) ? match.nearestDistance : Infinity;
  navigation.joinOnCount=0;
  navigation.offStartPoint=null;
  navigation.autoFailure=false;
}
function routeGeometryIndex(coordinates){
  if(!Array.isArray(coordinates) || coordinates.length<2) return null;
  let total=0;
  const segments=[];
  for(let i=0;i<coordinates.length-1;i++){
    const a=coordinates[i], b=coordinates[i+1];
    if(!a?.every?.(Number.isFinite) || !b?.every?.(Number.isFinite)) continue;
    const meters=haversineMeters(a,b);
    if(!Number.isFinite(meters) || meters<0.1) continue;
    segments.push({a,b,start:total,length:meters,bearing:bearingBetween(a,b)});
    total+=meters;
  }
  return total>0 ? {segments,total} : null;
}
function routePointAt(index,along){
  if(!index?.segments.length) return null;
  const bounded=Math.max(0,Math.min(index.total,along));
  let left=0,right=index.segments.length-1;
  while(left<right){
    const mid=(left+right)>>1;
    if(index.segments[mid].start+index.segments[mid].length < bounded) left=mid+1;
    else right=mid;
  }
  const s=index.segments[left];
  const t=Math.max(0,Math.min(1,(bounded-s.start)/s.length));
  return [s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t];
}
function routeHeadingAt(index,along,speed){
  const lookAhead=Math.max(14,Math.min(35,(Number.isFinite(speed)?speed:0)*1.6+16));
  const from=routePointAt(index,Math.max(0,along-7));
  const to=routePointAt(index,Math.min(index.total,along+lookAhead));
  return from && to && haversineMeters(from,to)>1 ? bearingBetween(from,to) : null;
}
function matchGpsToRoute(index,position,opts={}){
  if(!index?.segments?.length || !position?.every?.(Number.isFinite)) return null;
  const latitudeCos=Math.max(.15,Math.cos(position[1]*Math.PI/180));
  const prior=Number.isFinite(opts.priorAlong)?opts.priorAlong:null;
  const dt=Number.isFinite(opts.elapsedSeconds)?opts.elapsedSeconds:Infinity;
  const accuracy=Number.isFinite(opts.accuracy)?opts.accuracy:30;
  const speed=Number.isFinite(opts.speed)?Math.max(0,opts.speed):null;
  const heading=Number.isFinite(opts.heading)?opts.heading:null;
  // Allow a larger search window after GPS gaps; never force an ambiguous match.
  const contiguous=prior!==null && dt<18;
  const maxAhead=Math.max(90,(speed??28)*Math.max(.5,dt)*2.25+accuracy*2+42);
  const maxBack=Math.max(38,accuracy*2+18);
  let nearest=null,best=null;
  for(const s of index.segments){
    const ax=(s.a[0]-position[0])*111320*latitudeCos;
    const ay=(s.a[1]-position[1])*110540;
    const bx=(s.b[0]-position[0])*111320*latitudeCos;
    const by=(s.b[1]-position[1])*110540;
    const dx=bx-ax,dy=by-ay;
    const lengthSquared=dx*dx+dy*dy;
    if(lengthSquared<.001) continue;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/lengthSquared));
    const distance=Math.hypot(ax+t*dx,ay+t*dy);
    const along=s.start+s.length*t;
    const match={distance,along,bearing:s.bearing,
      coords:[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t]};
    if(!nearest || distance<nearest.distance) nearest=match;
    if(contiguous && (along<prior-maxBack || along>prior+maxAhead)) continue;
    // GPS course has value only at driving speeds and when accuracy is decent.
    const headingError=heading!==null && speed!==null && speed>=3 && accuracy<=40 ?
      Math.abs(smallestAngle(heading-s.bearing)) : 0;
    const headingPenalty=Math.min(34,headingError*0.16);
    const continuityPenalty=contiguous ? Math.min(26,Math.abs(along-prior)*.035) : 0;
    const score=distance+headingPenalty+continuityPenalty;
    if(!best || score<best.score) best={...match,score};
  }
  if(!nearest)return null;
  // A map match must also be supported by the GPS accuracy, not merely by an
  // adjacent road being close to the reported point.
  const snapRadius=Math.max(15,Math.min(36,accuracy*1.25+13));
  const valid=!!best && best.distance<=snapRadius &&
    best.distance<=nearest.distance+Math.max(8,accuracy*.65);
  const match=best||nearest;
  return {...match,valid,nearestDistance:nearest.distance,
    fraction:match.along/index.total,snapRadius};
}
function stableRouteBearing(target,speed){
  if(!Number.isFinite(target)) return navigation.lastBearing;
  const last=navigation.lastBearing;
  if(!Number.isFinite(last)) return target;
  // At walking/standing speeds, do not spin the camera based on GPS noise.
  if(!Number.isFinite(speed) || speed<1.25) return last;
  const delta=smallestAngle(target-last);
  const weight=speed>7 ? .58 : .38;
  return normalizedHeading(last+delta*weight);
}

function animateNavigationMarker(coords,along=null,elapsedMs=1000){
  cancelAnimationFrame(navigation.markerAnimation);
  const previous=navigation.markerPoint || coords;
  const from=[...previous],to=[...coords];
  const fromAlong=navigation.drawnAlong;
  const hasMatchedTarget=Number.isFinite(along) && !!navigation.routeIndex;
  const pathAnimation=hasMatchedTarget && Number.isFinite(fromAlong) &&
    Math.abs(along-fromAlong)<180;
  if(hasMatchedTarget && !pathAnimation){
    // A recovered/large GPS jump must not draw a straight shortcut through
    // buildings or alongside a different road. Place it on the selected
    // route immediately, then smoothly resume normal route-path animation.
    navigation.markerPoint=routePointAt(navigation.routeIndex,along)||to;
    navigation.drawnAlong=along;
    showUserLocation(navigation.markerPoint);
    return;
  }
  const start=performance.now();
  // Keep animation slightly shorter than an ordinary GPS interval, preventing
  // overlapping easing that makes motion lag behind the car.
  const duration=reducedMotion?0:Math.min(820,Math.max(290,elapsedMs*.76));
  const render=(t)=>{
    const e=t*t*(3-2*t);
    const drawn=pathAnimation ? fromAlong+(along-fromAlong)*e : null;
    navigation.markerPoint=pathAnimation ?
      routePointAt(navigation.routeIndex,drawn) :
      [from[0]+(to[0]-from[0])*e,from[1]+(to[1]-from[1])*e];
    navigation.drawnAlong=drawn;
    showUserLocation(navigation.markerPoint);
  };
  if(duration===0){
    navigation.markerPoint=to;
    navigation.drawnAlong=Number.isFinite(along)?along:null;
    showUserLocation(to);return;
  }
  const animate=now=>{
    if(!navigation.active) return;
    const t=Math.min(1,(now-start)/duration);
    render(t);
    if(t<1)navigation.markerAnimation=requestAnimationFrame(animate);
    else {
      navigation.markerAnimation=0;navigation.markerPoint=to;
      navigation.drawnAlong=Number.isFinite(along)?along:null;
      showUserLocation(to);
    }
  };
  navigation.markerAnimation=requestAnimationFrame(animate);
}

// Navigation camera refinement. All map movement still uses MapLibre's
// existing camera API; no extra map layers, UI, services or route requests.
const NAV_CAMERA_FRAME_MS=48; // cap navigation camera updates around 20fps on phones
const NAV_CAMERA_EASE_MS=640;
const navCameraClamp=(value,low,high)=>Math.max(low,Math.min(high,value));

function navigationCameraFraming(){
  const appRect=appRoot.getBoundingClientRect();
  const width=Math.max(1,appRect.width), height=Math.max(1,appRect.height);
  const landscape=width>height && height<=560;
  let x=width/2, y=height*.65;
  if(landscape){
    // The maneuver panel occupies the upper-left in landscape, while the
    // circular driving controls occupy the lower center. Keep the GPS dot in
    // the clear space on the right instead of underneath either panel.
    const hudRight=!navHud.hidden ? navHud.getBoundingClientRect().right-appRect.left : width*.4;
    x=navCameraClamp(Math.max(width*.62,(hudRight+width)*.5),width*.54,width-64);
    y=navCameraClamp(height*.59,height*.44,Math.max(height*.44,height-124));
  }else{
    // In portrait, put the blue dot below center, leaving useful road ahead
    // between the instruction card and the location indicator.
    const hudBottom=!navHud.hidden ? navHud.getBoundingClientRect().bottom-appRect.top : height*.18;
    const footerTop=!navFooter.hidden ? navFooter.getBoundingClientRect().top-appRect.top : height*.82;
    const freeTop=navCameraClamp(hudBottom+12,0,height*.72);
    const freeBottom=navCameraClamp(footerTop-16,freeTop+1,height);
    y=navCameraClamp(freeTop+(freeBottom-freeTop)*.72,height*.49,height*.78);
  }
  return {landscape, offset:[Math.round(x-width/2),Math.round(y-height/2)]};
}
function navigationCameraPerspective(landscape){
  // Widen the driving view progressively with speed. Unknown/parked speed
  // stays closer and flatter; don't oscillate zoom from single noisy fixes.
  const speed=Number.isFinite(navigation.guidanceSpeed) ? navigation.guidanceSpeed :
    (Number.isFinite(navigation.lastRawFix?.speed) ? navigation.lastRawFix.speed : 4);
  const moving=navCameraClamp((speed-2)/25,0,1);
  return {
    zoom:(landscape?16.65:16.85)-(landscape?.75:.72)*moving,
    pitch:(landscape?45:49)+(landscape?3:5)*moving
  };
}
function stopNavigationCamera(){
  if(navigation.cameraFrame)cancelAnimationFrame(navigation.cameraFrame);
  navigation.cameraFrame=0;
  navigation.cameraState=null;
}
function navigationCameraTick(time){
  navigation.cameraFrame=0;
  const state=navigation.cameraState;
  if(!state || !navigation.active || !navigation.follow || document.hidden)return;
  if(time<state.holdUntil){
    navigation.cameraFrame=requestAnimationFrame(navigationCameraTick);
    return;
  }
  if(state.syncAfterEase){
    // The initial recenter animation finishes before live tracking starts.
    state.bearing=normalizedHeading(map.getBearing());
    state.zoom=map.getZoom();
    state.pitch=map.getPitch();
    state.offset=[...state.targetOffset];
    state.syncAfterEase=false;
    state.lastTime=0;
  }
  if(state.lastTime && time-state.lastTime<NAV_CAMERA_FRAME_MS){
    navigation.cameraFrame=requestAnimationFrame(navigationCameraTick);
    return;
  }
  const elapsed=state.lastTime ? navCameraClamp(time-state.lastTime,16,170) : NAV_CAMERA_FRAME_MS;
  state.lastTime=time;
  const ms=reducedMotion?1:elapsed;
  const rotateBlend=reducedMotion?1:1-Math.exp(-ms/660);
  const lensBlend=reducedMotion?1:1-Math.exp(-ms/1800);
  const offsetBlend=reducedMotion?1:1-Math.exp(-ms/380);
  state.bearing=normalizedHeading(state.bearing+
    smallestAngle(state.targetBearing-state.bearing)*rotateBlend);
  state.zoom+=(state.targetZoom-state.zoom)*lensBlend;
  state.pitch+=(state.targetPitch-state.pitch)*lensBlend;
  state.offset=state.offset.map((value,i)=>value+(state.targetOffset[i]-value)*offsetBlend);
  // Marker animation and camera now share the *same rendered location*.
  const marker=navigation.markerPoint;
  const moved=marker && state.lastPoint ? haversineMeters(marker,state.lastPoint) : Infinity;
  const rotating=Math.abs(smallestAngle(state.targetBearing-state.bearing));
  const settling=rotating>.7 || Math.abs(state.zoom-state.targetZoom)>.018 ||
    Math.abs(state.pitch-state.targetPitch)>.20 ||
    state.offset.some((value,i)=>Math.abs(value-state.targetOffset[i])>.8);
  const travelling=!!navigation.markerAnimation;
  // Avoid repeatedly redrawing the map while parked or on noisy 1m fixes.
  if(marker && (moved>1 || !state.lastPoint || settling || travelling)){
    map.easeTo({
      center:marker,
      zoom:state.zoom,pitch:state.pitch,bearing:state.bearing,
      offset:state.offset, duration:0,animate:false
    });
    state.lastPoint=[...marker];
  }
  if(travelling || settling || moved>1){
    navigation.cameraFrame=requestAnimationFrame(navigationCameraTick);
  }
}
function scheduleNavigationCamera(){
  if(!navigation.cameraFrame){
    navigation.cameraFrame=requestAnimationFrame(navigationCameraTick);
  }
}
function followNavigationCamera(coords,bearing,force=false){
  if(!navigation.follow || !navigation.active || document.hidden || !coords)return;
  const {landscape,offset}=navigationCameraFraming();
  const {zoom,pitch}=navigationCameraPerspective(landscape);
  const angle=Number.isFinite(bearing) ? normalizedHeading(bearing) :
    (navigation.cameraState?.targetBearing ?? navigation.lastBearing ?? map.getBearing());
  const now=performance.now();
  let state=navigation.cameraState;
  if(!state){
    state=navigation.cameraState={
      bearing:normalizedHeading(map.getBearing()),zoom:map.getZoom(),pitch:map.getPitch(),
      offset:[...offset],targetOffset:[...offset],targetBearing:angle,
      targetZoom:zoom,targetPitch:pitch,holdUntil:0,syncAfterEase:false,
      lastTime:0,lastPoint:null
    };
    force=true;
  }
  const rect=appRoot.getBoundingClientRect();
  state.size=[rect.width,rect.height];
  state.targetBearing=angle;
  state.targetZoom=zoom;
  state.targetPitch=pitch;
  state.targetOffset=offset;
  navigation.lastCamera=now;
  navigation.lastCameraPoint=[...coords];
  navigation.lastCameraBearing=angle;
  if(force){
    // On Start, Recenter or rotation, offer one calm transition into driving
    // perspective. Subsequent GPS fixes never restart this animation.
    state.holdUntil=now+(reducedMotion?0:NAV_CAMERA_EASE_MS);
    state.syncAfterEase=true;
    map.easeTo({center:navigation.markerPoint||coords,zoom,pitch,bearing:angle,
      offset,duration:reducedMotion?0:NAV_CAMERA_EASE_MS,
      easing:cameraEase,essential:!reducedMotion});
  }
  scheduleNavigationCamera();
}

// Prefer natural voices *actually exposed* by iOS/Web Speech. Safari may
// omit premium Siri and downloaded accessibility voices. No remote TTS key.
function preferredNavigationVoice(){
  let voices=[];
  try{voices=window.speechSynthesis?.getVoices?.()||[];}catch(_){return null;}
  const english=voices.filter(v=>/^en(?:[-_]|$)/i.test(v.lang||''));
  if(!english.length)return null;
  const favourites=['karen','serena','samantha','moira','ava','allison','zoe',
    'kate','aria','jenny','susan','victoria','tessa'];
  const quality=/(?:premium|enhanced|natural|neural|siri)/i;
  const novelty=/(?:bad news|good news|trinoids|whisper|bubbles|organ|cellos|zarvox|boing|bells|jester|junior|princess|fred|ralph|albert|hysterical|robot)/i;
  const score=v=>{
    const name=v.name||'';
    const rank=favourites.findIndex(candidate=>name.toLowerCase().includes(candidate));
    const locale=(v.lang||'').replace('_','-').toLowerCase();
    return (quality.test(name)?42:0)+(rank<0?0:26-rank)+
      (locale==='en-my'?8:locale==='en-au'?7:locale==='en-gb'?6:3)+
      (v.localService?32:0)+(v.default?12:0)-(novelty.test(name)?120:0);
  };
  return english.slice().sort((a,b)=>score(b)-score(a))[0];
}
function speechDistance(metres){
  if(metres>=1000){
    const km=Number((metres/1000).toFixed(metres<10000?1:0));
    return `${km} ${km===1?'kilometre':'kilometres'}`;
  }
  const rounded=metres<100?Math.max(10,Math.round(metres/10)*10):Math.round(metres/50)*50;
  return `${rounded} metres`;
}
function expandSpeechDistances(text){
  return text.replace(/\b(\d+(?:[.,]\d+)?)\s*km\b/gi,(_,v)=>{
    const n=Number(v.replace(',','.'));
    return `${v} ${n===1?'kilometre':'kilometres'}`;
  }).replace(/\b(\d+(?:[.,]\d+)?)\s*m\b/gi,(_,v)=>{
    const n=Number(v.replace(',','.'));
    return `${v} ${n===1?'metre':'metres'}`;
  });
}
function spokenTurnInstruction(instruction,distance){
  const action=expandSpeechDistances((instruction.message||guidanceLabel(instruction.maneuver))
    .replace(/\s+/g,' ').trim()).replace(/[.!]$/,'');
  if(!action)return '';
  // Some TomTom messages already say “In 200 metres”; avoid saying it twice.
  if(/^(?:in|after|within)\s+(?:about\s+)?\d+(?:[.,]\d+)?\s*(?:metres?|meters?|kilometres?|kilometers?)\b/i.test(action))
    return `${action}.`;
  const lead=distance<35?'Coming up,':`In ${speechDistance(distance)},`;
  return `${lead} ${action[0].toLowerCase()}${action.slice(1)}.`;
}
// Voice settings: Normal speaks turns and safety alerts, Only Alerts speaks
// meaningful route/arrival changes, and Off is completely silent.
const NAV_VOICE_MODE_KEY='myarahVoiceModeV1';
function loadNavVoiceMode(){
  try{
    const saved=localStorage.getItem(NAV_VOICE_MODE_KEY);
    return ['normal','alerts','off'].includes(saved)?saved:'normal';
  }catch(_){return 'normal';}
}
// iOS WebKit can silently ignore speech started only after an asynchronous GPS
// callback. Keep an utterance alive until its events fire and confirm that it
// ACTUALLY started before marking a turn/alert as spoken. The Start button
// calls the same engine synchronously during the user's touch event.
let navigationSpeechActive=null;
let navigationSpeechUnreliableVoice=null;
function cancelNavigationSpeech(){
  const current=navigationSpeechActive;
  navigationSpeechActive=null;
  if(current?.watchdog!==null && current?.watchdog!==undefined)clearTimeout(current.watchdog);
  if(current && !current.started && typeof current.onFailure==='function'){
    try{current.onFailure('interrupted');}catch(_){}
  }
  // Avoid cancel() immediately before a new first utterance on iOS: even an
  // idle cancellation can interfere with starting playback on some builds.
  try{
    const synth=window.speechSynthesis;
    if(synth && (current || synth.speaking || synth.pending))synth.cancel();
  }catch(_){}
}
function speakDirection(text,{
  interrupt=true,kind='guidance',allowInactive=false,onStart=null,onFailure=null
}={}){
  if(!text || (!allowInactive && !navigation.active) || document.hidden ||
      navigation.voiceMode==='off' ||
      (kind==='guidance' && navigation.voiceMode!=='normal') ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance!=='function')return false;
  const synth=window.speechSynthesis;
  if(!synth || (navigationSpeechActive && !interrupt))return false;
  try{
    if((synth.speaking || synth.pending) && !interrupt)return false;
  }catch(_){return false;}
  if(interrupt && (navigationSpeechActive || synth.speaking || synth.pending))cancelNavigationSpeech();
  const initialToken=navigation.sessionToken;
  const speakAttempt=(useDefaultVoice=false)=>{
    if(document.hidden || navigation.voiceMode==='off' ||
        (!allowInactive && (!navigation.active || navigation.sessionToken!==initialToken)))return;
    let utterance;
    try{
      utterance=new SpeechSynthesisUtterance(text);
      const chosen=useDefaultVoice?null:preferredNavigationVoice();
      const voice=chosen?.name===navigationSpeechUnreliableVoice?null:chosen;
      if(voice)utterance.voice=voice;
      utterance.lang=voice?.lang||'en-GB';
      utterance.rate=.98;
      utterance.pitch=1.01;
      utterance.volume=1;
    }catch(_){if(onFailure)onFailure('setup');return;}
    // Holding this reference avoids older Safari versions collecting the speech
    // object while the system synthesizer is still working.
    const request={utterance,started:false,watchdog:null,onFailure};
    navigationSpeechActive=request;
    const finish=()=>{
      if(navigationSpeechActive!==request)return false;
      if(request.watchdog!==null)clearTimeout(request.watchdog);
      navigationSpeechActive=null;
      return true;
    };
    const fail=reason=>{
      if(!finish())return;
      const mayRetry=!useDefaultVoice && !!utterance.voice &&
        reason!=='canceled' && reason!=='interrupted' &&
        !document.hidden && navigation.voiceMode!=='off' &&
        (allowInactive || (navigation.active && navigation.sessionToken===initialToken));
      if(mayRetry){
        navigationSpeechUnreliableVoice=utterance.voice.name;
        // Retry once using the iPhone's system default voice. Some exposed
        // voices can be listed but not actually synthesize on that device.
        try{synth.cancel();}catch(_){}
        setTimeout(()=>speakAttempt(true),120);
      }else if(typeof onFailure==='function')onFailure(reason);
    };
    utterance.onstart=()=>{
      if(navigationSpeechActive!==request)return;
      request.started=true;
      if(request.watchdog!==null){clearTimeout(request.watchdog);request.watchdog=null;}
      if(typeof onStart==='function')onStart();
    };
    utterance.onend=()=>{
      const started=request.started;
      if(finish() && !started && typeof onFailure==='function')onFailure('ended-without-start');
    };
    utterance.onerror=event=>{fail(event?.error||'error');};
    try{
      if(synth.paused)synth.resume();
      // DO NOT cancel here unless an older utterance is still playing:
      // cancelling and speaking back-to-back on iOS can drop the new speech.
      synth.speak(utterance);
    }catch(_){fail('exception');return;}
    // Safari may silently drop speak(): a synchronous return is not evidence
    // that audio started. Re-attempt a failed named voice only once.
    if(!request.started && navigationSpeechActive===request){
      request.watchdog=setTimeout(()=>{
        if(navigationSpeechActive!==request || request.started)return;
        if(synth.speaking)return; // engine may still be starting
        fail('no-start');
      },3200);
    }
  };
  speakAttempt();
  return true;
}
function announceNavVoiceAlert(key,text,{interrupt=true}={}){
  if(!navigation.active || !text || navigation.alertSpoken.has(key) ||
      navigation.pendingAlertKey===key)return false;
  const token=navigation.sessionToken;
  navigation.pendingAlertKey=key;
  const accepted=speakDirection(text,{kind:'alert',interrupt,
    onStart:()=>{
      if(navigation.sessionToken===token && navigation.active)navigation.alertSpoken.add(key);
      if(navigation.pendingAlertKey===key)navigation.pendingAlertKey=null;
    },
    onFailure:()=>{if(navigation.pendingAlertKey===key)navigation.pendingAlertKey=null;}
  });
  if(!accepted && navigation.pendingAlertKey===key)navigation.pendingAlertKey=null;
  return accepted;
}
// Called DIRECTLY by the Start-navigation click, before GPS's async callback.
// It produces a brief audible confirmation and unlocks Safari's speech session
// for subsequent hands-free turn announcements. No extra button is needed.
function startNavigationVoiceFromGesture(){
  if(loadNavVoiceMode()==='off')return;
  setNavSoundState(loadNavVoiceMode());
  speakDirection('Starting navigation.',{kind:'alert',allowInactive:true,interrupt:true});
}
function updateNavAlert(text){
  navAlert.hidden=!text;
  navAlert.textContent=text||'';
}
// The existing maneuver card is reused for a car park or uncertain road entry.
// Do not announce a turn while the GPS has not confidently joined the route.
function showProceedToRoute(distance){
  showNavManeuverIcon('navTurnSymbol','proceed');
  $('navTurnDistance').textContent=Number.isFinite(distance) ?
    `${navDistance(Math.max(0,distance))} from route` : 'Join the route';
  setNavInstructionCopy('Proceed to the route');
  const next=$('navNextTurn');if(next)next.hidden=true;
  hideNavLaneGuide();
}
// TomTom Orbis routeOffsetInMeters is the position of the *actual maneuver*,
// not an early-warning marker. Only move to the next card after that position.
// A small speed-related buffer prevents a GPS fix hovering around a junction
// from switching the card back and forth (route progress is also monotonic).
// An arrival is a *destination-state* instruction, not a regular turn.
// TomTom occasionally returns one near the origin or before more maneuvers.
// Never let it become the active turn while kilometres still remain.
function isArrivalInstruction(instruction){
  if(!instruction)return false;
  const maneuver=String(instruction.maneuver||'');
  const message=String(instruction.message||'');
  return /^arrive/i.test(maneuver) ||
    /\b(?:reached|arrived)\b.{0,55}\bdestination\b/i.test(message) ||
    /\bdestination\b.{0,55}\b(?:reached|arrived)\b/i.test(message);
}
function navGuidanceInstructions(route){
  if(!Array.isArray(route?.instructions))return [];
  const total=Number(route.meters);
  // Preserve genuine destination instructions near the route's final metres.
  // Filter arrival text at the origin, intermediate waypoints, or elsewhere.
  const finalWindow=Number.isFinite(total)&&total>0 ? Math.min(250,Math.max(80,total*.035)) : 0;
  return route.instructions.filter(i=>{
    if(i.maneuver==='depart' || !Number.isFinite(i.offset))return false;
    if(!isArrivalInstruction(i))return true;
    return Number.isFinite(total)&&total>0&&i.offset>=total-finalWindow;
  });
}
// Navigation text is visually compact, but the original provider message stays
// untouched for voice guidance. Only split when the maneuver is already known;
// do not invent a road name or change TomTom's maneuver.
function conciseNavInstruction(instruction){
  const code=String(instruction?.maneuver||'');
  const raw=String(instruction?.message||'').replace(/\s+/g,' ').trim();
  let action=guidanceLabel(code);
  if(action==='Follow the route')return {action:raw||action, detail:''};
  if(!raw)return {action,detail:''};

  // Roundabout exit numbers are important. Preserve the provider's ordinal
  // rather than replacing it with a vague left/right turn.
  if(/roundabout/i.test(code)){
    const exit=raw.match(/\b(?:take|use)\s+(?:the\s+)?(\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth)\s+exit\b/i);
    if(exit)action=`Take the ${exit[1].toLowerCase()} exit`;
  }

  // Remove a redundant action phrase only if it matches the provider text.
  // Leading distances are already in the large distance line of the banner.
  const message=raw.replace(/^(?:in|after)\s+[\d.,]+\s*(?:kilometres?|kilometers?|metres?|meters?|km|m)\b\s*[,.:;-]?\s*/i,'').trim();
  let remainder=message;
  const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const actionRe=new RegExp('^'+escapeRe(action)+'(?:\\b|$)\\s*[,.:;-]?\\s*','i');
  if(actionRe.test(remainder))remainder=remainder.replace(actionRe,'');
  else if(/^turn\s+(?:slightly|sharply|sharp|slight)?\s*(?:left|right)\b/i.test(remainder) && /turn/i.test(code))
    remainder=remainder.replace(/^turn\s+(?:slightly|sharply|sharp|slight)?\s*(?:left|right)\b\s*[,.:;-]?\s*/i,'');
  else if(/^keep\s+(?:to\s+the\s+)?(?:left|right|centre|center)\b/i.test(remainder) && /keep/i.test(code))
    remainder=remainder.replace(/^keep\s+(?:to\s+the\s+)?(?:left|right|centre|center)\b\s*[,.:;-]?\s*/i,'');
  else if(/roundabout/i.test(code) && action.startsWith('Take the '))
    remainder=remainder.replace(/^.*?\b(?:take|use)\s+(?:the\s+)?(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth)\s+exit\b\s*/i,'');
  else if(/^continue(?:\s+straight)?\b/i.test(remainder) && /continue/i.test(code))
    remainder=remainder.replace(/^continue(?:\s+straight)?\b\s*/i,'');

  // Examples: "Turn right onto Jalan Merdeka" -> "Jalan Merdeka";
  // "Keep left to stay on E14" -> "Stay on E14".
  const onto=remainder.match(/^(?:onto|on to|into)\s+(.+)$/i);
  if(onto)remainder=onto[1];
  else if(/^to\s+stay\s+on\b/i.test(remainder))remainder=remainder.replace(/^to\s+stay\s+on\b\s*/i,'Stay on ');
  else if(/^towards?\b/i.test(remainder))remainder='Towards'+remainder.replace(/^towards?\b/i,'');
  else if(/^on\s+\S/i.test(remainder) && /continue/i.test(code))remainder=remainder.replace(/^on\s+/i,'');
  remainder=remainder.replace(/^[,.;:\s-]+|[,.;:\s-]+$/g,'').trim();

  // Don't print the same action twice; if parsing isn't confident, the provider
  // message remains as secondary text rather than being silently discarded.
  if(remainder.toLowerCase()===action.toLowerCase() || remainder.toLowerCase()===raw.toLowerCase() && raw.toLowerCase()===action.toLowerCase())
    remainder='';
  return {action,detail:remainder};
}
function setNavInstructionCopy(action,detail=''){
  $('navTurnText').textContent=action;
  const road=$('navTurnRoad');
  if(!road)return;
  const value=String(detail||'').trim();
  road.hidden=!value;
  road.textContent=value;
}
function isUsefulNextTurn(instruction){
  if(!instruction || isArrivalInstruction(instruction))return false;
  const code=String(instruction.maneuver||'');
  // "Then Continue" and other no-action instructions add visual clutter.
  return !/^(?:depart|continueStraight|keepCenter|passTollgate)$/i.test(code) &&
    /(?:turn|keep(?:Left|Right)|merge|exit|roundabout|uTurn|makeUTurn|fork)/i.test(code);
}
function nextNavInstruction(route,progress,speed=null){
  const behind=Math.max(9,Math.min(23,(Number.isFinite(speed)?speed:9)*.9));
  const eligible=navGuidanceInstructions(route);
  return eligible.find(i=>i.offset+behind>=progress) || eligible[eligible.length-1] || null;
}

// Two useful cues rather than fixed 500m / 150m warnings:
// preparation ~27s before a turn; action ~8s before it. Short minimums help
// in city traffic, while caps stop a fast road from announcing too early.
// Speed is measured in metres/second. Unknown speed uses a gentle default.
function navigationCueDistances(speed){
  const v=Number.isFinite(speed) && speed>=0 ? Math.min(speed,42) : 9;
  return {
    prepare:Math.max(160,Math.min(850,v*27+25)),
    turn:Math.max(42,Math.min(235,v*8+12))
  };
}
function followingNavInstruction(route,current){
  if(!route || !current)return null;
  const eligible=navGuidanceInstructions(route);
  const currentIndex=eligible.indexOf(current);
  if(currentIndex<0)return null;
  const next=eligible.slice(currentIndex+1).find(isUsefulNextTurn);
  if(!next)return null;
  // Show the secondary row for an actual follow-up maneuver, not something
  // kilometres away. Give motorway exits a little more preparation distance.
  const separation=next.offset-current.offset;
  const window=/^exitMotorway/i.test(next.maneuver)?750:450;
  return separation>=0 && separation<=window ? next : null;
}
function refreshSecondaryNavigationTurn(route,current,distanceToCurrent){
  const row=$('navNextTurn');
  if(!row)return;
  const following=followingNavInstruction(route,current);
  // Hide the secondary instruction until the *current* maneuver is reasonably
  // close too; adjacent turns several kilometres ahead are not urgent yet.
  if(!following || isArrivalInstruction(current) ||
      !Number.isFinite(distanceToCurrent) || distanceToCurrent>850){
    row.hidden=true;
    return;
  }
  const spanAfter=Math.max(0,following.offset-current.offset);
  const relativeText=spanAfter<35 ? 'right after' : `in ${navDistance(spanAfter)}`;
  showNavManeuverIcon('navNextTurnSymbol',following.maneuver);
  $('navNextTurnText').textContent=conciseNavInstruction(following).action;
  $('navNextTurnDistance').textContent=relativeText;
  row.hidden=false;
}

// === Optional verified TomTom lane guidance (legacy Maps Routing API v1). ===
// Orbis v3 intentionally DOES NOT return lane sections. This separate legacy
// request never replaces the selected Orbis route. It is only permitted to
// advise lanes after independent geometry, heading and maneuver checks.
// In Malaysia, coverage and key entitlements vary. Missing data => no UI.
const MYARAH_LEGACY_LANES_ENDPOINT='https://api.tomtom.com/routing/1/calculateRoute/';
// At highway speed, 440 metres is not enough time to prepare safely. These
// windows scale with speed, but are also capped to the provider's mapped lane
// section: a lane recommendation must never be projected onto an earlier road.
const NAV_LANE_MAX_DISPLAY_M=1250;
const NAV_LANE_ACCURACY_M=35;
const NAV_LANE_FIX_GRACE_MS=3600;
const NAV_LANE_FIX_STALE_MS=8500;
function laneApproachDistance(speed){
  const v=Number.isFinite(speed) && speed>=0 ? Math.min(42,speed):9;
  return Math.max(260,Math.min(NAV_LANE_MAX_DISPLAY_M,v*43+80));
}
function laneSpeechApproachDistance(speed){
  const v=Number.isFinite(speed) && speed>=0 ? Math.min(42,speed):9;
  return Math.max(220,Math.min(1100,v*38+65));
}
function resetLaneFix(){
  navigation.laneFix={firstGoodAt:0,lastReliableAt:0,lastObservedAt:0,
    lastRouteOffset:null,goodCount:0,quality:'unknown',displayedOffset:null};
}
function laneBranchAmbiguous(index,point,match,accuracy,course,speed){
  if(!index?.segments?.length || !point?.every?.(Number.isFinite) ||
     !Number.isFinite(match?.along))return true;
  const radius=Math.min(29,Math.max(12,accuracy*.9+8));
  const cos=Math.max(.15,Math.cos(point[1]*Math.PI/180));
  for(const s of index.segments){
    // Adjacent geometry around one junction is not a second carriageway.
    if(match.along>=s.start-25 && match.along<=s.start+s.length+25)continue;
    if(Math.abs((s.start+s.length*.5)-match.along)<Math.max(62,accuracy*2+30))continue;
    const ax=(s.a[0]-point[0])*111320*cos, ay=(s.a[1]-point[1])*110540;
    const bx=(s.b[0]-point[0])*111320*cos, by=(s.b[1]-point[1])*110540;
    const dx=bx-ax,dy=by-ay, len=dx*dx+dy*dy;
    if(len<.001)continue;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len));
    if(Math.hypot(ax+t*dx,ay+t*dy)>radius)continue;
    // A strong, moving GPS course can disambiguate opposite-direction roads.
    if(Number.isFinite(course) && Number.isFinite(speed) && speed>=4.5 &&
       accuracy<=22 && Math.abs(smallestAngle(course-s.bearing))>65)continue;
    return true;
  }
  return false;
}
function observeLaneGpsFix(match,point,accuracy,speed,course,now=Date.now()){
  if(!navigation.laneFix)resetLaneFix();
  const state=navigation.laneFix;
  const wrongDirection=Number.isFinite(course) && Number.isFinite(speed) &&
    speed>=4.5 && accuracy<=35 && Number.isFinite(match?.bearing) &&
    Math.abs(smallestAngle(course-match.bearing))>58;
  const hardFailure=!navigation.active || navigation.offRoute ||
    navigation.joiningRoute || navigation.rerouting || !match?.valid ||
    !Number.isFinite(match?.along) || wrongDirection ||
    (Number.isFinite(accuracy) && match?.nearestDistance>Math.max(45,accuracy*1.5+15));
  if(hardFailure){resetLaneFix();hideNavLaneGuide();return false;}
  const ambiguous=Number.isFinite(accuracy) && accuracy<=NAV_LANE_ACCURACY_M &&
    laneBranchAmbiguous(navigation.routeIndex,point,match,accuracy,course,speed);
  if(ambiguous){resetLaneFix();hideNavLaneGuide();return false;}
  const reliable=Number.isFinite(accuracy) && accuracy<=NAV_LANE_ACCURACY_M &&
    match.nearestDistance<=Math.min(24,Math.max(12,accuracy*.8+8));
  if(!reliable){
    // Brief accuracy loss can preserve ALREADY VISIBLE guidance, but cannot
    // introduce a new recommendation or trigger spoken advice.
    state.quality='soft';
    return false;
  }
  const wasRecent=state.lastReliableAt && now-state.lastReliableAt<=NAV_LANE_FIX_STALE_MS;
  const rawOffset=match.along/navigation.routeIndex.total*navigation.route.meters;
  // A large GPS snap is not evidence of a different lane section.
  const plausible=!(wasRecent && Number.isFinite(state.lastRouteOffset) &&
    Math.abs(rawOffset-state.lastRouteOffset)>Math.max(90,(Number.isFinite(speed)?speed:18)*
      ((now-state.lastReliableAt)/1000)*2+accuracy*2+35));
  if(!plausible){resetLaneFix();hideNavLaneGuide();return false;}
  if(!wasRecent){state.firstGoodAt=now;state.goodCount=1;}
  else if(!state.lastObservedAt || now-state.lastObservedAt>=250)state.goodCount=Math.min(3,state.goodCount+1);
  state.lastObservedAt=now;state.lastReliableAt=now;
  state.lastRouteOffset=rawOffset;state.quality='reliable';
  return state.goodCount>=2 && now-state.firstGoodAt>=650;
}
function refreshLaneStaleness(now=Date.now()){
  const state=navigation.laneFix;
  if(!state)return;
  if(now-state.lastReliableAt>NAV_LANE_FIX_GRACE_MS &&
     $('navLaneGuide') && !$('navLaneGuide').hidden)hideNavLaneGuide();
}
const NAV_LANE_TYPES=new Set([
  'STRAIGHT','SLIGHT_LEFT','LEFT','SHARP_LEFT','SLIGHT_RIGHT',
  'RIGHT','SHARP_RIGHT','LEFT_U_TURN','RIGHT_U_TURN'
]);
function hideNavLaneGuide(){
  const row=$('navLaneGuide');if(row)row.hidden=true;
  if(navigation.laneFix)navigation.laneFix.displayedOffset=null;
}
function laneActionGroup(code){
  const s=String(code||'').toUpperCase();
  if(s==='STRAIGHT')return 'straight';
  if(s.includes('U_TURN'))return 'uturn';
  if(s.includes('LEFT'))return 'left';
  if(s.includes('RIGHT'))return 'right';
  return null;
}
function expectedLaneAction(maneuver){
  const m=String(maneuver||'');
  if(/^(turn|keep|exitMotorway|switchMotorway|merge|enterCarpoolLane|exitCarpoolLane)/i.test(m)){
    if(/Left/i.test(m))return 'left';
    if(/Right/i.test(m))return 'right';
  }
  if(/^makeUTurn$/i.test(m))return 'uturn';
  return null; // Not enough information for other maneuvers
}
function legacyLanePoint(p){
  const lon=Number(p?.longitude),lat=Number(p?.latitude);
  return Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lat)<=90&&Math.abs(lon)<=180
    ? [lon,lat] : null;
}
function legacyLaneAligned(legacy,index){
  const a=routeGeometryIndex(legacy);
  if(!a || !index || Math.abs(a.total/index.total-1)>.16)return false;
  let close=0,last=-Infinity;
  for(const fraction of [.1,.3,.5,.7,.9]){
    const point=routePointAt(a,a.total*fraction);
    const m=point&&matchGpsToRoute(index,point,{accuracy:12});
    if(!m || m.nearestDistance>42)continue;
    if(m.along<last-35)return false;
    last=m.along;
    close++;
  }
  return close>=4; // Most of the road, not just the same origin/destination
}
function normalizeTrustedLaneSections(payload,route){
  const raw=payload?.routes?.[0];
  if(!route?.coordinates?.length || raw?.legs?.length!==1)return [];
  const points=raw.legs[0]?.points?.map(legacyLanePoint);
  if(!Array.isArray(points) || points.length<2 || points.some(p=>!p))return [];
  const index=routeGeometryIndex(route.coordinates);
  if(!legacyLaneAligned(points,index))return [];
  const result=[];
  const sections=Array.isArray(raw.sections)?raw.sections:[];
  for(const section of sections){
    if(String(section?.sectionType||'').toUpperCase()!=='LANES')continue;
    const i=section.startPointIndex,j=section.endPointIndex;
    if(!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<=i||j>=points.length)continue;
    const original=section.lanes;
    if(!Array.isArray(original)||original.length<2||original.length>6)continue;
    const lanes=original.map(lane=>{
      const dirs=Array.isArray(lane?.directions)?lane.directions:[];
      const follow=typeof lane?.follow==='string'?lane.follow.toUpperCase():null;
      return {directions:dirs.filter(d=>NAV_LANE_TYPES.has(d)).slice(0,3),
        follow:follow&&NAV_LANE_TYPES.has(follow)?follow:null};
    });
    if(lanes.some(l=>!l.directions.length || (l.follow&&!l.directions.includes(l.follow))))continue;
    const selected=lanes.filter(l=>l.follow).length;
    if(!selected||selected===lanes.length)continue;
    const at=matchGpsToRoute(index,points[j],{accuracy:8});
    const from=matchGpsToRoute(index,points[i],{accuracy:8});
    if(!at||!from||at.nearestDistance>26||from.nearestDistance>35||
      at.along<from.along-18)continue;
    // A legacy lane section cannot be grafted onto an unrelated parallel road.
    const legacyHeading=bearingBetween(points[Math.max(i,j-1)],points[j]);
    if(Number.isFinite(legacyHeading) && Number.isFinite(at.bearing) &&
       Math.abs(smallestAngle(legacyHeading-at.bearing))>34)continue;
    const routeOffset=at.along/index.total*route.meters;
    const candidates=navGuidanceInstructions(route)
      .filter(n=>expectedLaneAction(n.maneuver))
      .map(n=>({instruction:n,distance:n.offset-routeOffset}))
      .filter(n=>n.distance>=-28 && n.distance<=260)
      .sort((a,b)=>Math.abs(a.distance)-Math.abs(b.distance));
    const candidate=candidates[0];
    // Two similar maneuvers very close together are ambiguous: never guess.
    if(!candidate || (candidates[1] &&
       Math.abs(Math.abs(candidates[1].distance)-Math.abs(candidate.distance))<65))continue;
    const expected=expectedLaneAction(candidate.instruction.maneuver);
    if(lanes.some(l=>l.follow&&laneActionGroup(l.follow)!==expected))continue;
    const existing=result.findIndex(r=>r.offset===candidate.instruction.offset);
    const item={offset:candidate.instruction.offset,startOffset:from.along/index.total*route.meters,
      lanes,sectionDistance:Math.abs(candidate.distance)};
    if(existing<0)result.push(item);
    else if(item.sectionDistance<result[existing].sectionDistance)result[existing]=item;
  }
  return result.sort((a,b)=>a.offset-b.offset);
}
function laneDirectionSvg(code){
  switch(laneActionGroup(code)){
    case 'left':return '<path d="M19 19V11a4 4 0 0 0-4-4H5"/><path d="m11 2-6 5 6 5"/>';
    case 'right':return '<path d="M5 19V11a4 4 0 0 1 4-4h10"/><path d="m13 2 6 5-6 5"/>';
    case 'uturn':return '<path d="M19 20V9a6 6 0 0 0-12 0v8"/><path d="m3 13 4 4 4-4"/>';
    default:return '<path d="M12 20V4"/><path d="m5 11 7-7 7 7"/>';
  }
}
function trustedLaneForManeuver(instruction,progress,{forSpeech=false,now=Date.now()}={}){
  const state=navigation.laneFix;
  if(!instruction || !navigation.active || navigation.offRoute || navigation.joiningRoute ||
     navigation.rerouting || !state || state.goodCount<2 ||
     now-state.lastReliableAt>NAV_LANE_FIX_GRACE_MS ||
     now-state.firstGoodAt<650 || !navigation.route)return null;
  const section=navigation.laneSections.find(s=>Math.abs(s.offset-instruction.offset)<1);
  if(!section)return null;
  const remaining=instruction.offset-progress;
  const fixRemaining=instruction.offset-state.lastRouteOffset;
  const earliestVerified=Math.max(0,instruction.offset-section.startOffset)+35;
  const window=Math.min(laneApproachDistance(navigation.guidanceSpeed),earliestVerified);
  if(remaining<15 || fixRemaining<15 || remaining>window || fixRemaining>window+45)return null;
  const fresh=state.quality==='reliable' && now-state.lastReliableAt<=2300;
  if(forSpeech && !fresh)return null;
  // Only hold a previously displayed recommendation during a short soft GPS
  // gap. Never reveal a new lane layout using stale or uncertain position.
  if(!fresh && (state.quality!=='soft' || state.displayedOffset!==instruction.offset))return null;
  return section;
}
function laneRecommendationText(lanes){
  const indices=lanes.map((l,i)=>l.follow?i:-1).filter(i=>i>=0);
  if(!indices.length)return '';
  const n=lanes.length;
  if(indices.length===1){
    const i=indices[0];
    return i===0?'Use left lane':i===n-1?'Use right lane':
      n%2===1&&i===Math.floor(n/2)?'Use middle lane':'Use highlighted lane';
  }
  if(indices.every((x,i)=>x===i))return `Use ${indices.length} left lanes`;
  if(indices.every((x,i)=>x===n-indices.length+i))return `Use ${indices.length} right lanes`;
  return 'Use highlighted lanes';
}
function renderNavLaneGuide(instruction,progress){
  const section=trustedLaneForManeuver(instruction,progress);
  if(!section){hideNavLaneGuide();return null;}
  const container=$('navLaneChoices'),label=$('navLaneHint');
  if(!container||!label)return null;
  const fragment=document.createDocumentFragment();
  for(const lane of section.lanes){
    const pill=document.createElement('span');
    pill.className='nav-lane-pill'+(lane.follow?' is-recommended':'');
    const symbol=document.createElementNS('http://www.w3.org/2000/svg','svg');
    symbol.setAttribute('viewBox','0 0 24 24');
    symbol.setAttribute('aria-hidden','true');
    symbol.innerHTML=laneDirectionSvg(lane.follow||lane.directions[0]);
    pill.appendChild(symbol);fragment.appendChild(pill);
  }
  container.replaceChildren(fragment);
  label.textContent=laneRecommendationText(section.lanes);
  $('navLaneGuide').hidden=false;
  if(navigation.laneFix)navigation.laneFix.displayedOffset=instruction.offset;
  return section;
}
async function requestVerifiedLaneSections(route){
  if(!navigation.active || !route || !trafficKey || !chosen?.coords)return;
  navigation.laneController?.abort();
  navigation.laneController=new AbortController();
  const controller=navigation.laneController;
  const token=navigation.sessionToken;
  const destinationId=navigation.destinationId;
  const start=route.coordinates[0],end=route.coordinates[route.coordinates.length-1];
  // Legacy v1 is a separate opt-in product on some TomTom keys. Failure is
  // expected and must never delay GPS navigation, routing, or the normal HUD.
  const loc=p=>`${p[1].toFixed(6)},${p[0].toFixed(6)}`;
  const url=MYARAH_LEGACY_LANES_ENDPOINT+`${loc(start)}:${loc(end)}/json?`+
    new URLSearchParams({key:trafficKey,travelMode:'car',routeType:'fastest',
      traffic:'true',sectionType:'lanes',instructionsType:'text',
      routeRepresentation:'polyline',language:'en-GB'}).toString();
  const timeout=setTimeout(()=>controller.abort(),14000);
  try{
    const response=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!response.ok)return;
    const data=await response.json();
    if(!navigation.active || navigation.sessionToken!==token ||
       navigation.destinationId!==destinationId || navigation.route!==route)return;
    navigation.laneSections=normalizeTrustedLaneSections(data,route);
    if(navigation.laneSections.length>0 && Number.isFinite(navigation.lastProgress)){
      refreshNavigationGuidance(navigation.lastProgress,navigation.guidanceSpeed);
    }
  }catch(_){/* no verified lanes: preserve regular instructions */}
  finally{
    clearTimeout(timeout);
    if(navigation.laneController===controller)navigation.laneController=null;
  }
}

function refreshNavigationGuidance(progress,speed=navigation.guidanceSpeed){
  const route=navigation.route;
  if(!route)return;
  const next=nextNavInstruction(route,progress,speed);
  if(!next){
    // A provider can return an invalid origin/waypoint arrival without any
    // usable maneuver. Keep safe generic guidance instead of stale text.
    navigation.turnIndex=-1;
    showNavManeuverIcon('navTurnSymbol','continueStraight');
    $('navTurnDistance').textContent=navDistance(Math.max(0,(Number(route.meters)||0)-progress));
    setNavInstructionCopy('Continue along the route');
    const following=$('navNextTurn');if(following)following.hidden=true;
    hideNavLaneGuide();
    return;
  }
  const index=route.instructions.indexOf(next);
  const distance=Math.max(0,next.offset-progress);
  if(index!==navigation.turnIndex){
    navigation.turnIndex=index;
    const text=$('navTurnText');
    if(!reducedMotion){
      text.classList.remove('nav-text-change');
      void text.offsetWidth;
      text.classList.add('nav-text-change');
    }
  }
  const arrival=isArrivalInstruction(next);
  const remaining=Math.max(0,(Number(route.meters)||0)-progress);
  // Arrival announcements are reserved for the separate, GPS-confirmed
  // arrival handler. Even a valid final arrival instruction must not say
  // 'you have reached' just because it is the next maneuver in the list.
  if(arrival){
    const side=/right/i.test(next.maneuver+' '+next.message)?'right':
      /left/i.test(next.maneuver+' '+next.message)?'left':null;
    showNavManeuverIcon('navTurnSymbol','arrive');
    $('navTurnDistance').textContent=navDistance(remaining>0?remaining:distance);
    setNavInstructionCopy(remaining>180 ? 'Continue towards your destination' :
      side ? `Destination ahead on the ${side}` : 'Approaching your destination');
    const later=$('navNextTurn');if(later)later.hidden=true;
    hideNavLaneGuide();
  }else{
    showNavManeuverIcon('navTurnSymbol',next.maneuver);
    $('navTurnDistance').textContent=navDistance(distance);
    const display=conciseNavInstruction(next);
    setNavInstructionCopy(display.action,display.detail);
    refreshSecondaryNavigationTurn(route,next,distance);
    renderNavLaneGuide(next,progress);
  }

  // Only accepted, on-route GPS progress drives this function. An early cue
  // is never treated as spoken while voice is off or Web Speech is unavailable.
  if(navigation.voiceMode!=='normal' || navigation.offRoute || document.hidden)return;
  const windows=navigationCueDistances(speed);
  const verifiedLane=trustedLaneForManeuver(next,progress,{forSpeech:true});
  const laneAdvice=verifiedLane?laneRecommendationText(verifiedLane.lanes):'';
  const meaningfulLaneAdvice=/^Use (?:left|right|middle|\d+ (?:left|right)) lane/i.test(laneAdvice);
  const advanceLane=meaningfulLaneAdvice && distance<=laneSpeechApproachDistance(speed) &&
    distance>windows.prepare+55 && !navigation.spoken.has(`${index}-lane`);
  const phase=distance<=windows.turn?'turn':distance<=windows.prepare?'prepare':
    advanceLane?'lane':null;
  if(!phase)return;
  const key=`${index}-${phase}`;
  if(navigation.spoken.has(key))return;
  // Do not read a turn that the GPS already shows as essentially completed.
  const v=Number.isFinite(speed) && speed>=0 ? speed:9;
  if(distance<=Math.max(7,v*.45) && !isArrivalInstruction(next))return;

  const now=Date.now();
  const since=navigation.guidanceSpokenAt ? now-navigation.guidanceSpokenAt:Infinity;
  const urgent=phase==='turn' && distance<=Math.max(32,v*3.5);
  // The action cue takes priority when a GPS update crosses both windows.
  // Otherwise leave room for the preceding speech to finish naturally.
  if(since<(urgent?1300:phase==='turn'?3200:4400))return;
  const interrupt=phase==='turn' && (urgent || since>=4800);
  let message=isArrivalInstruction(next)
    ? `Your destination is ${speechDistance(Math.max(10,distance))} ahead.`
    : spokenTurnInstruction(next,distance);
  // Lane preparation can lead the usual turn reminder at highway speeds.
  // No extra repetition if the advance lane cue already began speaking.
  if(phase==='lane'){
    const laneWords=laneAdvice.replace(/^Use /,'use the ').toLowerCase();
    const action=/^exitMotorway/i.test(next.maneuver)?'upcoming exit':'upcoming turn';
    message=`In ${speechDistance(distance)}, prepare to ${laneWords} for the ${action}.`;
  }else if(phase==='prepare' && meaningfulLaneAdvice &&
           !navigation.spoken.has(`${index}-lane`)){
    message=laneAdvice+'. '+message;
  }
  if(navigation.pendingGuidanceKey===key)return;
  const token=navigation.sessionToken;
  navigation.pendingGuidanceKey=key;
  const accepted=speakDirection(message,{interrupt,
    onStart:()=>{
      if(navigation.active && navigation.sessionToken===token){
        navigation.guidanceSpokenAt=Date.now();
        navigation.spoken.add(key);
        if(phase==='turn')navigation.spoken.add(`${index}-prepare`);
      }
      if(navigation.pendingGuidanceKey===key)navigation.pendingGuidanceKey=null;
    },
    onFailure:()=>{if(navigation.pendingGuidanceKey===key)navigation.pendingGuidanceKey=null;}
  });
  if(!accepted && navigation.pendingGuidanceKey===key)navigation.pendingGuidanceKey=null;
}
// === MyArah ETA estimator: traffic-aware route baseline + cautious local pace ===
// No background fetches and no extra UI. Live traffic is reflected in the
// original TomTom route duration (or refreshed if the driver recalculates).
// Short-term pace cannot predict traffic on distant roads; apply it only to
// a small section of the remaining journey, never the entire route.
const NAV_ETA_SAMPLE_WINDOW_MS = 100000;
const NAV_ETA_FRESH_MS = 28000;
const NAV_ETA_REFRESH_MS = 12000;
function initializeNavEta(route,progress,now=Date.now()){
  const initial=Math.max(0,Math.min(route.meters,Number(progress)||0));
  navigation.eta={
    progress:initial,lastGoodFixAt:now,
    samples:[{time:now,progress:initial}],
    pendingJump:null,estimatedArrival:null,lastRenderAt:0,
    lastPaceCorrection:0
  };
}
function recordNavEtaFix(progress,speed,now=Date.now()){
  const eta=navigation.eta;
  if(!eta || !Number.isFinite(progress))return false;
  const advanced=Math.max(0,Math.min(navigation.route.meters,progress));
  const dt=Math.max(.1,(now-eta.lastGoodFixAt)/1000);
  const jump=advanced-eta.progress;
  const speedBound=Number.isFinite(speed) && speed>=0 ? Math.max(10,speed):30;
  // Require a second agreeing reading before trusting an implausibly large
  // progress jump. A GPS snap to the wrong parallel road should not instantly
  // erase kilometres from the trip counter.
  if(jump>Math.max(90,speedBound*dt*2.1+55) && dt<18){
    const pending=eta.pendingJump;
    if(!pending || now-pending.at>15000 || Math.abs(advanced-pending.progress)>100){
      eta.pendingJump={progress:advanced,at:now};
      return false;
    }
    // Confirmed new location: accept it, but don't treat the jump as speed.
    eta.samples=[];
    eta.estimatedArrival=null;
    eta.lastPaceCorrection=0;
  }
  eta.pendingJump=null;
  eta.progress=Math.max(eta.progress,advanced);
  eta.lastGoodFixAt=now;
  const last=eta.samples[eta.samples.length-1];
  if(!last || now-last.time>=3500)eta.samples.push({time:now,progress:eta.progress});
  eta.samples=eta.samples.filter(s=>now-s.time<=NAV_ETA_SAMPLE_WINDOW_MS);
  return true;
}
function navEtaPaceAdjustment(route,eta,baselineSeconds,now){
  const samples=eta.samples;
  if(samples.length<2 || now-eta.lastGoodFixAt>NAV_ETA_FRESH_MS ||
      !Number.isFinite(route.seconds) || route.seconds<=0 || route.meters<=0)return null;
  const oldest=samples[0],latest=samples[samples.length-1];
  const seconds=(latest.time-oldest.time)/1000;
  const progress=Math.max(0,latest.progress-oldest.progress);
  // Ignore very short observations and stationary GPS drift. A red light is
  // not evidence that the whole remaining journey will stay at zero speed.
  if(seconds<28 || progress<45)return 0;
  const observedSpeed=progress/seconds;
  if(observedSpeed<.7)return 0;
  const plannedSpeed=route.meters/route.seconds;
  const factor=Math.max(.75,Math.min(2.25,plannedSpeed/observedSpeed));
  const confidence=Math.min(.70,Math.max(.12,(seconds-20)/75))*Math.min(1,progress/150);
  const nearTermSeconds=Math.min(180,baselineSeconds);
  const correction=nearTermSeconds*(factor-1)*confidence;
  // Do not let a short sample overwhelm the provider's traffic-aware ETA.
  return Math.max(-Math.min(45,baselineSeconds*.15),
    Math.min(Math.min(150,baselineSeconds*.7),correction));
}
function refreshNavTrip(now=Date.now()){
  const route=navigation.route,eta=navigation.eta;
  if(!navigation.active || !route || !eta)return;
  setTollMarkerVisibility();
  if(navigation.offRoute){
    $('navRemaining').textContent='Route needs update';
    $('navEta').textContent='ETA — · off route';
    eta.estimatedArrival=null;
    return;
  }
  if(navigation.joiningRoute){
    $('navRemaining').textContent=navDistance(Math.max(0,route.meters-eta.progress))+' left';
    $('navEta').textContent='ETA — · join route';
    return;
  }
  const remaining=Math.max(0,route.meters-eta.progress);
  $('navRemaining').textContent=navDistance(remaining)+' left';
  const baseSeconds=route.meters>0 ? Math.max(0,route.seconds)*remaining/route.meters : 0;
  const fresh=now-eta.lastGoodFixAt<=NAV_ETA_FRESH_MS;
  const paceCorrection=navEtaPaceAdjustment(route,eta,baseSeconds,now);
  // If GPS is delayed, preserve the last credible pace adjustment but never
  // pretend the vehicle has advanced. The ETA clock still moves forward.
  if(fresh && paceCorrection!==null)eta.lastPaceCorrection=paceCorrection;
  const rawArrival=now+(baseSeconds+eta.lastPaceCorrection)*1000;
  if(!Number.isFinite(eta.estimatedArrival))eta.estimatedArrival=rawArrival;
  else{
    // Smooth *arrival time*, not distance. Progress and GPS accuracy remain
    // untouched. A ~16s response avoids jitter from irregular GPS updates.
    const dt=Math.max(0,Math.min(60,(now-eta.lastRenderAt)/1000));
    const weight=1-Math.exp(-dt/16);
    const delta=Math.max(-90000,Math.min(90000,rawArrival-eta.estimatedArrival));
    eta.estimatedArrival+=delta*weight;
  }
  eta.lastRenderAt=now;
  const arrivalStamp=Number.isFinite(eta.estimatedArrival) ? Math.max(now,eta.estimatedArrival) : now+(Number.isFinite(baseSeconds)?baseSeconds:0)*1000;
  const arrivingAt=new Date(arrivalStamp);
  const validTime=Number.isFinite(arrivingAt.getTime());
  const clock=validTime ? arrivingAt.toLocaleTimeString('en-MY',{hour:'numeric',minute:'2-digit'}) : '—';
  $('navEta').textContent=`ETA ${clock} · ${fresh?'approx.':'GPS delayed'}`;
}

function onNavigationLocation(position){
  if(!navigation.active || !navigation.routeIndex)return;
  const point=[position.coords.longitude,position.coords.latitude];
  const accuracy=Number(position.coords.accuracy);
  if(!point.every(Number.isFinite))return;
  const now=Date.now();
  const stamp=Number(position.timestamp)||now;
  if(now-stamp>NAV_FIX_MAX_AGE_MS || stamp>now+3000){
    resetSpeedLimitTracking();renderNavSpeed(now);
    updateNavAlert('Waiting for a fresh GPS position…');return;
  }
  if(!Number.isFinite(accuracy) || accuracy>NAV_FIX_MAX_ACCURACY_M){
    resetSpeedLimitTracking();renderNavSpeed(now);
    updateNavAlert('GPS signal weak — holding your last reliable position');return;
  }
  const previous=navigation.lastRawFix;
  if(previous && stamp<=previous.stamp)return; // Ignore cached/duplicate readings.
  const elapsedMs=previous?Math.max(100,stamp-previous.stamp):1000;
  const dt=elapsedMs/1000;
  const reportedSpeed=Number.isFinite(position.coords.speed) && position.coords.speed>=0 ? position.coords.speed:null;
  // Some iPhone browsers omit the GPS speed field even while driving. Infer
  // speed only from two reasonably accurate fixes sufficiently far apart.
  const displacement=previous?haversineMeters(previous.point,point):0;
  const inferredSpeed=previous && dt>=.7 && dt<=10 && accuracy<=30 &&
    previous.accuracy<=30 && displacement>Math.max(7,(accuracy+previous.accuracy)*.7) ?
    Math.min(42,displacement/dt):null;
  const speed=reportedSpeed!==null || inferredSpeed!==null ?
    Math.max(reportedSpeed??0,inferredSpeed??0) : null;
  if(previous && dt<16){
    const moved=displacement;
    const possible=Math.max(80,Math.max(speed??0,previous.speed??0,40)*dt*1.6 +
      accuracy+previous.accuracy);
    if(moved>possible){
      updateNavAlert('GPS jumped unexpectedly — waiting for another fix');
      return;
    }
  }
  const course=Number.isFinite(position.coords.heading) && position.coords.heading>=0 ?
    position.coords.heading:null;
  const match=matchGpsToRoute(navigation.routeIndex,point,{
    priorAlong:navigation.matchedAlong,elapsedSeconds:dt,accuracy,speed,heading:course
  });
  if(!match){resetSpeedLimitTracking();renderNavSpeed(now);return;}
  navigation.lastRawFix={point:[...point],accuracy,speed,stamp};
  navigation.lastPosition=position;
  navigation.lastAcceptedTime=now;
  // Keep the existing conservative navigation speed for guidance/rerouting.
  // The speedometer may use a longer, independent GPS sample interval when
  // the browser does not supply native speed (e.g. iOS sparse callbacks).
  const dialInferredSpeed = previous && dt>=1.5 && dt<=20 ? displacement/dt : null;
  updateNavSpeed(reportedSpeed,dialInferredSpeed,accuracy,previous?.accuracy,
    displacement,dt,now);
  // Keep RAW location as the origin for recalculation. Do not reroute from a
  // point artificially snapped onto the old road.
  navigation.lastCoords=point;
  const offThreshold=Math.max(38,Math.min(106,accuracy*1.8+22));
  const recoveredThreshold=Math.max(22,Math.min(63,accuracy*1.3+14));
  const definitelyOff=match.nearestDistance>offThreshold;
  const clearlyOn=match.valid && match.nearestDistance<recoveredThreshold;
  const wasConfirmedOffRoute=navigation.offRoute;
  if(navigation.joiningRoute){
    // Do not reroute just because the GPS begins in a mall car park. Wait for
    // two good on-road fixes; GPS may briefly drift across the mapped road.
    navigation.joinOnCount=clearlyOn && accuracy<=55 ? navigation.joinOnCount+1 : 0;
    if(navigation.joinOnCount>=2){
      navigation.joiningRoute=false;
      navigation.offRoute=false;
      navigation.offCount=0;
      navigation.offSince=0;
      navigation.onCount=2;
      navigation.offStartPoint=null;
      navigation.autoFailure=false;
    }else{
      // If the driver actually travels away from the planned route, leave the
      // parking-lot grace period and let the confirmed off-route logic apply.
      const driven=haversineMeters(navigation.joinStartPoint||point,point);
      if(now-navigation.joinSince>=20000 && driven>=120 &&
         match.nearestDistance>Math.max(160,navigation.joinStartDistance+40) &&
         Number.isFinite(speed) && speed>=3.2 && accuracy<=40){
        navigation.joiningRoute=false;
        navigation.offRoute=true;
        navigation.offCount=NAV_OFF_ROUTE_FIXES;
        navigation.offSince=now-NAV_AUTO_REROUTE_CONFIRM_MS;
        navigation.offStartPoint=[...(navigation.joinStartPoint||point)];
      }
    }
  }
  if(!navigation.joiningRoute){
    if(definitelyOff){
      if(!navigation.offCount || !navigation.offStartPoint){
        navigation.offSince=now;
        navigation.offStartPoint=[...point];
      }
      navigation.offCount++;
      navigation.onCount=0;
      if(navigation.offCount>=NAV_OFF_ROUTE_FIXES &&
          now-navigation.offSince>=NAV_OFF_ROUTE_CONFIRM_MS) navigation.offRoute=true;
    }else if(clearlyOn){
      navigation.onCount++;
      navigation.offCount=0;
      navigation.offSince=0;
      navigation.offStartPoint=null;
      if(navigation.onCount>=2){navigation.offRoute=false;navigation.autoFailure=false;}
    }else{
      navigation.onCount=0;
      // A marginal GPS fix must not clear a confirmed deviation.
    }
  }
  if(!wasConfirmedOffRoute && navigation.offRoute){
    announceNavVoiceAlert('off-route','You are off the route. Finding another way.');
  }
  $('navReroute').hidden=!navigation.offRoute;
  observeLaneGpsFix(match,point,accuracy,speed,course,now);
  let display=point;
  let matchedDisplayAlong=null;
  let bearing=navigation.lastBearing;
  if(navigation.rerouting){
    showProceedToRoute(match.nearestDistance);
    $('navTurnDistance').textContent='Updating route…';
    setNavInstructionCopy('Finding a new route');
    updateNavAlert('Recalculating automatically from your location…');
  }else if(navigation.joiningRoute){
    // Keep the raw GPS dot honest: no artificial snapping in a car park.
    showProceedToRoute(match.nearestDistance);
    updateNavAlert('');
  }else if(navigation.offRoute){
    // Genuine deviation: remove the old along-route anchor so the GPS dot
    // will not jump back to a road that the driver has already left.
    navigation.matchedAlong=null;
    showProceedToRoute(match.nearestDistance);
    updateNavAlert(navigation.autoFailure ?
      'Could not update the route. Tap Recalculate to try again.' :
      'Checking your location for a safe route update…');
  }else if(match.valid && !definitelyOff){
    // Filter *distance along the route*, not raw lat/lon. This prevents a
    // smoothed marker from cutting across corners or drifting off the road.
    const oldAlong=navigation.matchedAlong;
    if(oldAlong===null){
      navigation.matchedAlong=match.along;
    }else{
      const step=match.along-oldAlong;
      // Tiny movements while stopped are usually GPS jitter.
      const weight=speed!==null && speed<1.25 ? .18 :
        accuracy>35 ? .48 : .82;
      if(Math.abs(step)>=3 || speed>=2.0){
        navigation.matchedAlong=Math.max(0,Math.min(navigation.routeIndex.total,
          oldAlong+step*weight));
      }
    }
    matchedDisplayAlong=navigation.matchedAlong;
    display=routePointAt(navigation.routeIndex,matchedDisplayAlong)||point;
    navigation.lastProgress=Math.max(navigation.lastProgress,
      Math.min(navigation.route.meters,
        matchedDisplayAlong/navigation.routeIndex.total*navigation.route.meters));
    // Smooth noisy GPS-speed reports so the warning distance does not
    // oscillate while the car slows for a junction.
    if(speed!==null){
      navigation.guidanceSpeed=navigation.guidanceSpeed===null ? speed :
        navigation.guidanceSpeed*.6 + speed*.4;
    }
    refreshNavigationGuidance(navigation.lastProgress,navigation.guidanceSpeed);
    if(clearlyOn && accuracy<=55)recordNavEtaFix(navigation.lastProgress,speed,now);
    const heading=routeHeadingAt(navigation.routeIndex,matchedDisplayAlong,speed);
    bearing=stableRouteBearing(heading,speed);
    updateNavAlert('');
  }else{
    // Uncertain readings stay at the measured point (e.g. a parking area).
    showProceedToRoute(match.nearestDistance);
    updateNavAlert('');
  }
  // Only warn about speeding on accurately matched road sections. The raw
  // off-route fix is never assigned the old route's legal limit.
  // Use the latest RAW route match for legal speed-limit lookup. The marker's
  // eased progress is intentionally delayed and can show a prior road at turns.
  // Distinct nearby path branches and disagreeing travel course are treated as
  // unknown, not as permission to warn using a possibly wrong road limit.
  const courseConsistent=!(Number.isFinite(course) && Number.isFinite(speed) &&
    speed>=4.5 && accuracy<=30 &&
    Math.abs(smallestAngle(course-match.bearing))>60);
  navigation.speedLimitEligible=!!(matchedDisplayAlong!==null && clearlyOn &&
    match.valid && accuracy<=35 && match.nearestDistance<=25 &&
    courseConsistent && !navigation.rerouting && !navigation.offRoute &&
    !navigation.joiningRoute);
  if(!navigation.speedLimitEligible){
    resetSpeedLimitTracking();
  }else{
    observeRoadSpeedLimit(match.along,point,match,accuracy,speed,course,now);
    const state=navigation.speedometer;
    const sampleFresh=state && state.trustedAt===now;
    updateSpeedLimitWarning(!!sampleFresh,now);
  }
  renderNavSpeed(now);
  // Confirm a missed turn with multiple accurate GPS fixes and actual motion.
  // Never start two routing requests from successive watchPosition callbacks.
  if(!document.hidden && shouldAutomaticallyReroute(navigation,point,accuracy,speed,now)){
    void recalculateNavigation({automatic:true});
  }
  // Also refresh for uncertain and off-route readings; an old route's ETA
  // should never be presented as reliable after a confirmed deviation.
  refreshNavTrip(now);
  animateNavigationMarker(display,matchedDisplayAlong,elapsedMs);
  if(Number.isFinite(bearing))navigation.lastBearing=bearing;
  const gpsMovingCourse=Number.isFinite(course) && Number.isFinite(speed) &&
    speed>=1.5 && accuracy<=45 ? course : null;
  // When leaving the mapped road, don't point along a road we're no longer on.
  // Retain the previous arrow direction if the car is stopped or course is unknown.
  if(navigation.offRoute || navigation.joiningRoute || !Number.isFinite(bearing)) {
    updateNavigationArrowCourse(gpsMovingCourse);
  } else updateNavigationArrowCourse(bearing);
  followNavigationCamera(display,bearing);
  // Require two close, precise readings before announcing arrival.
  const toDestination=haversineMeters(point,chosen.coords);
  if(!navigation.offRoute && !navigation.joiningRoute && clearlyOn && accuracy<=35 && toDestination<25 &&
      navigation.lastProgress>=navigation.route.meters-85){
    navigation.arrivalCount++;
  }else navigation.arrivalCount=0;
  if(navigation.arrivalCount>=2 && !navigation.announcedArrival){
    navigation.announcedArrival=true;
    const finishingWithVoice=navigation.voiceMode!=='off' && !document.hidden &&
      'speechSynthesis' in window;
    speakDirection('You have arrived at your destination.',{kind:'alert',interrupt:true});
    endNavigation('Arrived at destination',{finishAnnouncement:finishingWithVoice});
    return;
  }
  navigation.lastUpdate=now;
}

function endNavigation(message='Navigation ended',{finishAnnouncement=false}={}){
  stopNavigationWakeLock();
  if(!navigation.active)return;
  navigation.active=false;
  myarahNavigationMapMode=false;
  refreshMyArahBuildingAppearance();
  navigation.laneController?.abort();navigation.laneController=null;
  navigation.laneSections=[];resetLaneFix();hideNavLaneGuide();
  clearNavigationArrowCourse();
  navigation.sessionToken+=1; // invalidate any in-flight route response
  if(navigation.rerouteController){
    navigation.rerouteController.abort();
    navigation.rerouteController=null;
  }
  navigation.rerouting=false;
  if(navigation.watchId!==null) navigator.geolocation.clearWatch(navigation.watchId);
  navigation.watchId=null;
  if(navigation.etaTimer!==null)clearInterval(navigation.etaTimer);
  navigation.etaTimer=null;
  navigation.eta=null;
  if(navigation.speedTimer!==null)clearInterval(navigation.speedTimer);
  navigation.speedTimer=null;
  navigation.speedometer=null;
  navigation.speedLimitEligible=false;
  resetSpeedLimitWarning();
  $('navSpeed').hidden=true;
  const limitBadge=$('navSpeedLimit');if(limitBadge)limitBadge.hidden=true;
  cancelAnimationFrame(navigation.markerAnimation);
  navigation.markerAnimation=0;
  stopNavigationCamera();
  if(!finishAnnouncement)cancelNavigationSpeech();
  closeVoiceMenu({immediate:true,restoreFocus:false});
  navHud.hidden=true;navFooter.hidden=true;
  appRoot.classList.remove('navigation-active');
  setTollMarkerVisibility();
  navigation.follow=true;navigation.voiced=false;navigation.turnIndex=-1;
  navigation.alertSpoken.clear();
  navigation.pendingAlertKey=null;navigation.pendingGuidanceKey=null;
  navigation.spoken.clear();navigation.guidanceSpeed=null;
  navigation.guidanceSpokenAt=0;
  navigation.offCount=0;navigation.offRoute=false;
  navigation.offStartPoint=null;navigation.autoFailure=false;
  navigation.joiningRoute=false;navigation.joinOnCount=0;
  navigation.joinStartPoint=null;navigation.joinSince=0;
  navigation.routeIndex=null;navigation.matchedAlong=null;navigation.drawnAlong=null;
  navigation.lastRawFix=null;navigation.lastCameraPoint=null;
  navigation.lastCameraBearing=null;navigation.offSince=0;navigation.onCount=0;
  navigation.arrivalCount=0;
  const rerouteButton=$('navReroute');
  rerouteButton.hidden=true;
  rerouteButton.disabled=false;
  rerouteButton.classList.remove('nav-action-working');
  setNavActionLabel('navReroute','Recalculate','Recalculate driving route');
  updateNavAlert('');
  const nextTurnRow=$('navNextTurn'); if(nextTurnRow) nextTurnRow.hidden=true;
  setNavSoundState(loadNavVoiceMode());
  setNavFollowState(true);
  refreshNavigationStart();
  setSheetPosition('peek');
  toast(message);
  if(routeOptions.length)scheduleRoutePreviewRefit(100);
}
function startNavigation(){
  const route=routeOptions[routeSelected];
  if(navigation.active || !route?.instructions?.some(i=>i.maneuver!=='depart'))return;
  if(!navigator.geolocation?.watchPosition){
    setRouteStatus('Continuous GPS is not available on this device.',true);return;
  }
  if(routeOrigin?.kind!=='gps'){
    setRouteStatus('Navigation must start from your current GPS position. Refresh routes using live GPS, then tap Start again.',true);
    routeOrigin=null;
    prepareComparison();
    return;
  }
  // iOS Safari requires speech to be started during a real user gesture.
  // The GPS confirmation callback runs later, outside that gesture.
  startNavigationVoiceFromGesture();
  // Start the screen wake request synchronously with the user's tap.
  void startNavigationWakeLock();
  // Confirm we are still near the route before enabling live turn directions.
  navStartButton.disabled=true;
  navStartButton.firstChild.textContent='Checking GPS ';
  const destinationId=chosen?.id;
  navigator.geolocation.getCurrentPosition(position=>{
    if(chosen?.id!==destinationId){stopNavigationWakeLock();refreshNavigationStart();return;}
    const point=[position.coords.longitude,position.coords.latitude];
    const snap=computePolylineProgress(route.coordinates,point);
    if(!snap || snap.distance>NAV_JOIN_ALLOW_START_M || position.coords.accuracy>100){
      stopNavigationWakeLock();
      setRouteStatus('Your location is too far from this route or GPS is inaccurate. Refresh routes from live GPS, then tap Start.',true);
      refreshNavigationStart();return;
    }
    const index=routeGeometryIndex(route.coordinates);
    if(!index){
      stopNavigationWakeLock();
      setRouteStatus('Route geometry unavailable. Compare routes again.',true);
      refreshNavigationStart();return;
    }
    const initial=matchGpsToRoute(index,point,{
      accuracy:Number(position.coords.accuracy),speed:position.coords.speed,
      heading:position.coords.heading
    });
    const matched=initial?.valid?initial:null;
    const displayed=matched?.coords||point;
    stopNavigationCamera();
    Object.assign(navigation,{
      active:true,destinationId,route,lastCoords:point,routeIndex:index,
      lastProgress:Math.max(0,(matched?.along/index.total??snap.fraction)*route.meters),
      lastUpdate:Date.now(),lastCamera:0,lastBearing:null,follow:true,
      turnIndex:-1,offCount:0,offRoute:false,voiced:loadNavVoiceMode()!=='off',
      voiceMode:loadNavVoiceMode(),alertSpoken:new Set(),
      pendingAlertKey:null,pendingGuidanceKey:null,announcedArrival:false,
      guidanceSpeed:Number.isFinite(position.coords.speed) && position.coords.speed>=0 ?
        position.coords.speed:null,guidanceSpokenAt:0,
      markerPoint:displayed,drawnAlong:matched?.along??null,
      matchedAlong:matched?.along??null,spoken:new Set(),lastPosition:position,
      lastRawFix:{point:[...point],accuracy:position.coords.accuracy,
        speed:position.coords.speed,stamp:Number(position.timestamp)||Date.now()},
      lastAcceptedTime:Date.now(),lastCameraPoint:null,lastCameraBearing:null,
      offSince:0,onCount:0,arrivalCount:0
    });
    navigation.sessionToken+=1;
    navigation.laneSections=[];
    navigation.laneController?.abort();navigation.laneController=null;
    resetLaneFix();hideNavLaneGuide();
    navigation.lastReroute=0;
    navigation.rerouting=false;
    resetJoinState(initial,point);
    // Search-keyboard scroll recovery can leave iOS visually shifted.
    // Restore the map viewport before showing the fixed-position navigation HUD.
    window.scrollTo(0,0);
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    appRoot.scrollTop=0;
    myarahRecoverViewport();
    appRoot.classList.add('navigation-active');
    myarahNavigationMapMode=true;
    refreshMyArahBuildingAppearance();
    updateNavigationArrowCourse(matched?.bearing ?? (Number.isFinite(position.coords.heading) && position.coords.speed>1.5 ? position.coords.heading : snap.bearing));
    navHud.hidden=false;navFooter.hidden=false;
    resetNavSpeed(position.coords.speed,Number(position.coords.accuracy));
    if (navigation.speedTimer!==null) clearInterval(navigation.speedTimer);
    navigation.speedTimer=setInterval(()=>{
      if(navigation.active && !document.hidden){
        if(Date.now()-navigation.lastAcceptedTime>NAV_LIMIT_FIX_FRESH_MS)resetSpeedLimitTracking();
        refreshLaneStaleness();
        renderNavSpeed();
      }
    },2000);
    setNavFollowState(true);
    setNavSoundState(navigation.voiceMode);
    showUserLocation(displayed);
    initializeNavEta(route,navigation.lastProgress);
    if(navigation.joiningRoute){
      showProceedToRoute(initial?.nearestDistance??snap.distance);
      announceNavVoiceAlert('initial-join','Proceed to the route.',{interrupt:false});
    }else{
      refreshNavigationGuidance(navigation.lastProgress);
    }
    refreshNavTrip();
    // Even if the car is stationary and GPS reports no new coordinates,
    // update the displayed ETA as time passes. No additional map animation.
    if(navigation.etaTimer!==null)clearInterval(navigation.etaTimer);
    navigation.etaTimer=setInterval(()=>{
      if(navigation.active && !document.hidden)refreshNavTrip();
    },NAV_ETA_REFRESH_MS);
    followNavigationCamera(displayed,matched?.bearing??snap.bearing,true);
    try{
      navigation.watchId=navigator.geolocation.watchPosition(onNavigationLocation,err=>{
        if(!navigation.active)return;
        if(err.code===1){endNavigation('Location permission lost — navigation ended');return;}
        updateNavAlert('GPS temporarily unavailable. Keep the app open and check your location.');
      },{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
    }catch(_){endNavigation('Could not start live GPS tracking');}
    void requestVerifiedLaneSections(route);
    refreshNavigationStart();
  },err=>{
    stopNavigationWakeLock();
    setRouteStatus(err.code===1?'Allow Location access to start navigation.':'Could not get an accurate GPS fix. Try again.',true);
    refreshNavigationStart();
  },{enableHighAccuracy:true,maximumAge:2000,timeout:14000});
}

async function recalculateNavigation({automatic=false}={}){
  if(!navigation.active || navigation.rerouting || !trafficKey || !chosen ||
     !navigation.lastCoords || document.hidden)return false;
  const now=Date.now();
  const cooldown=automatic ? NAV_AUTO_REROUTE_COOLDOWN_MS : 5000;
  if(navigation.lastReroute>0 && now-navigation.lastReroute<cooldown){
    if(!automatic)updateNavAlert('Please wait a moment before recalculating again.');
    return false;
  }
  // A stale location is not a safe origin for an automatic route. The GPS
  // listener will retry when it has a new accurate fix (subject to cooldown).
  if(automatic && (!navigation.lastRawFix || now-navigation.lastAcceptedTime>12000 ||
      navigation.lastRawFix.accuracy>55))return false;
  navigation.rerouting=true;
  navigation.laneController?.abort();navigation.laneController=null;
  navigation.laneSections=[];hideNavLaneGuide();
  navigation.lastReroute=now;
  navigation.autoFailure=false;
  const token=navigation.sessionToken;
  const button=$('navReroute');
  button.disabled=true;button.classList.add('nav-action-working');
  setNavActionLabel('navReroute','Updating…','Updating route');
  const destinationId=navigation.destinationId;
  const origin=[...navigation.lastCoords]; // raw GPS, never snapped to old road
  const destination=[...chosen.coords];
  updateNavAlert(automatic?'Recalculating automatically…':'Finding a new route from your GPS…');
  $('navTurnDistance').textContent='Updating route…';
  setNavInstructionCopy('Finding a new route');
  const nextTurn=$('navNextTurn');if(nextTurn)nextTurn.hidden=true;
  const controller=new AbortController();
  navigation.rerouteController=controller;
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
    const body={
      routePlanningLocations:{origin:{type:'Point',coordinates:origin},destination:{type:'Point',coordinates:destination}},
      routeType:'fast',travelMode:'car',traffic:'live',departureDateTime:'now',maxPathAlternativeRoutes:0,
      guidance:'instructions',instructionPhonetics:'ipa'
    };
    const response=await fetch(ROUTE_ENDPOINT,{
      method:'POST',cache:'no-store',signal:controller.signal,
      headers:{'Content-Type':'application/json','TomTom-Api-Key':trafficKey,'Accept-Language':'en-GB','Attributes':'routes,routes.sections.speedLimit'},
      body:JSON.stringify(body)
    });
    if(!response.ok)throw new Error(describeRouteError(response));
    const routes=normalizeProviderRoutes(await response.json());
    // Never let an old route request replace the route for a later trip.
    if(!navigation.active || navigation.sessionToken!==token ||
       navigation.destinationId!==destinationId || chosen?.id!==destinationId)return false;
    const route=routes[0];
    if(!route?.instructions?.some(i=>i.maneuver!=='depart'))throw new Error('New route has no usable turn instructions.');
    const index=routeGeometryIndex(route.coordinates);
    if(!index)throw new Error('Updated route geometry unavailable.');
    const newMatch=matchGpsToRoute(index,origin,{
      accuracy:navigation.lastRawFix?.accuracy??30,
      speed:navigation.lastRawFix?.speed,
      heading:navigation.lastPosition?.coords?.heading
    });
    routeOptions=[route];routeSelected=0;
    routeOrigin={coords:origin,kind:'gps',label:'Current location'};
    navigation.route=route;navigation.routeIndex=index;
    navigation.laneSections=[];resetLaneFix();hideNavLaneGuide();
    navigation.lastProgress=0;navigation.turnIndex=-1;
    navigation.spoken.clear();navigation.alertSpoken.clear();
    navigation.pendingAlertKey=null;navigation.pendingGuidanceKey=null;
    navigation.guidanceSpeed=null;
    navigation.guidanceSpokenAt=0;
    navigation.offCount=0;navigation.offRoute=false;
    navigation.matchedAlong=null;navigation.drawnAlong=null;
    navigation.offSince=0;navigation.onCount=0;navigation.arrivalCount=0;
    navigation.lastRawFix=null;
    resetSpeedLimitTracking();
    renderNavSpeed();
    resetJoinState(newMatch,origin);
    initializeNavEta(route,0);
    refreshNavTrip();
    syncRouteLayers();renderRouteCards();
    const pos=navigation.lastPosition;
    if(pos)onNavigationLocation(pos);
    void requestVerifiedLaneSections(route);
    if(navigation.joiningRoute){
      showProceedToRoute(newMatch?.nearestDistance);
      announceNavVoiceAlert('reroute-join','Route updated. Proceed to the route.');
      updateNavAlert('');
    }else{
      refreshNavigationGuidance(navigation.lastProgress);
      announceNavVoiceAlert('reroute-success','Route updated.');
      updateNavAlert('Route updated');
      setTimeout(()=>{
        if(navigation.active && navigation.sessionToken===token && !navigation.offRoute && !navigation.joiningRoute)updateNavAlert('');
      },2800);
    }
    return true;
  }catch(err){
    if(navigation.active && navigation.sessionToken===token){
      navigation.autoFailure=true;
      announceNavVoiceAlert('reroute-failed','Could not update the route. Try again when safe.');
      updateNavAlert(err.name==='AbortError'?
        'Route update timed out. Tap Recalculate to retry.' :
        automatic?'Automatic route update failed. Tap Recalculate to retry.' :
        err.message||'Recalculation failed.');
    }
    return false;
  }finally{
    clearTimeout(timeout);
    if(navigation.rerouteController===controller){
      navigation.rerouteController=null;
      navigation.rerouting=false;
      button.disabled=false;button.classList.remove('nav-action-working');
      setNavActionLabel('navReroute','Recalculate','Recalculate driving route');
    }
  }
}

// Keep the Lucide SVG inside icon buttons intact while updating the visible
// portrait label and accessible description. Landscape hides only the label.
function setNavActionLabel(id,label,ariaLabel=label){
  const button=$(id);
  const text=button?.querySelector('.nav-btn-label');
  if(text)text.textContent=label;
  if(button)button.setAttribute('aria-label',ariaLabel);
}
function setNavFollowState(following){
  const button=$('navFollow');
  const dock=button?.closest('.nav-footer-buttons');
  if(!button || !dock)return;
  // One state drives both the dock layout and accessibility. The button is
  // intentionally not display:none, allowing the optical glass to contract.
  button.dataset.following=following?'true':'false';
  dock.classList.toggle('recenter-visible',!following);
  button.setAttribute('aria-hidden',following?'true':'false');
  button.tabIndex=following?-1:0;
  button.disabled=following;
  if(following && document.activeElement===button)button.blur();
  setNavActionLabel('navFollow','Recenter','Recenter map and follow my location');
}
function setNavSoundState(mode=navigation.voiceMode){
  const selected=['normal','alerts','off'].includes(mode)?mode:'normal';
  const button=$('navSound');
  navigation.voiceMode=selected;
  navigation.voiced=selected!=='off'; // compatibility with existing arrival path
  if(button){
    button.dataset.voiceMode=selected;
    button.setAttribute('aria-pressed',String(selected!=='off'));
  }
  const names={normal:'Normal',alerts:'Only Alerts',off:'Off'};
  setNavActionLabel('navSound',names[selected],`Voice guidance: ${names[selected]}. Open voice settings`);
  document.querySelectorAll('[data-voice-option]').forEach(option=>{
    option.setAttribute('aria-pressed',String(option.dataset.voiceOption===selected));
  });
}
function chooseNavVoiceMode(mode,{persist=true}={}){
  if(!['normal','alerts','off'].includes(mode))return;
  const previous=navigation.voiceMode;
  setNavSoundState(mode);
  if(persist){try{localStorage.setItem(NAV_VOICE_MODE_KEY,mode);}catch(_){}}
  if(previous!==mode){
    navigation.spoken.clear();
    navigation.pendingGuidanceKey=null;navigation.pendingAlertKey=null;
    navigation.guidanceSpokenAt=0;
    cancelNavigationSpeech();
  }
  // This tap is also a speech-unlock gesture on iOS. A short confirmation
  // verifies playback and avoids resuming an outdated maneuver announcement.
  if(navigation.active && mode!=='off'){
    speakDirection(mode==='alerts'?'Important alerts only.':'Voice guidance is on.',
      {kind:'alert',interrupt:true});
  }
}
const voiceMenu=$('voiceMenu');
const voiceMenuDialog=$('voiceMenuDialog');
const voiceMenuPointer=$('voiceMenuPointer');
let voiceMenuCloseTimer=null;
let voiceMenuLayoutFrame=0;
// Position the popover using final layout sizes, *before* starting any
// transition. Old CSS measured a centered, animating dialog, so reopening
// could start at different screen coordinates when the dock moved.
function positionVoiceMenu(){
  if(voiceMenu.hidden)return;
  const trigger=$('navSound').getBoundingClientRect();
  const overlay=voiceMenu.getBoundingClientRect();
  const width=voiceMenuDialog.offsetWidth;
  const height=voiceMenuDialog.offsetHeight;
  if(!width || !height || !overlay.width || !overlay.height)return;
  const insetX=12,insetY=12,gap=13;
  const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max));
  const cx=trigger.left+trigger.width/2-overlay.left;
  const buttonTop=trigger.top-overlay.top;
  const buttonBottom=trigger.bottom-overlay.top;
  const left=clamp(cx-width/2,insetX,overlay.width-width-insetX);
  const above=buttonTop-gap-height;
  const below=buttonBottom+gap;
  const fitsAbove=above>=insetY;
  const fitsBelow=below+height<=overlay.height-insetY;
  const placement=!fitsAbove && fitsBelow?'below':'above';
  let top=placement==='below'?below:above;
  top=clamp(top,insetY,overlay.height-height-insetY);
  voiceMenu.dataset.placement=placement;
  voiceMenuDialog.style.left=`${left}px`;
  voiceMenuDialog.style.top=`${top}px`;
  voiceMenuDialog.style.setProperty('--voice-origin-x',`${clamp(cx-left,16,width-16)}px`);
  if(voiceMenuPointer){
    voiceMenuPointer.style.left=`${clamp(cx-6.5,16,overlay.width-29)}px`;
    voiceMenuPointer.style.top=`${placement==='below'?top-6.5:top+height-6.5}px`;
  }
}
function queueVoiceMenuPosition(){
  if(voiceMenu.hidden || voiceMenuLayoutFrame)return;
  voiceMenuLayoutFrame=requestAnimationFrame(()=>{
    voiceMenuLayoutFrame=0;
    positionVoiceMenu();
  });
}
function openVoiceMenu(){
  if(!navigation.active)return;
  if(voiceMenuCloseTimer!==null){clearTimeout(voiceMenuCloseTimer);voiceMenuCloseTimer=null;}
  if(voiceMenuLayoutFrame){cancelAnimationFrame(voiceMenuLayoutFrame);voiceMenuLayoutFrame=0;}
  // Do not animate from an unmeasured centered position. The same origin is
  // used every time, even after a map gesture expands the recenter dock.
  const wasHidden=voiceMenu.hidden;
  voiceMenu.classList.remove('is-open');
  voiceMenu.hidden=false;
  $('navSound').setAttribute('aria-expanded','true');
  positionVoiceMenu();
  if(wasHidden){
    void voiceMenuDialog.offsetWidth; // commit the initial anchored state
  }
  voiceMenu.classList.add('is-open');
  const current=voiceMenu.querySelector('[data-voice-option][aria-pressed="true"]');
  (current||voiceMenuDialog).focus({preventScroll:true});
}
function closeVoiceMenu({immediate=false,restoreFocus=true}={}){
  if(voiceMenuCloseTimer!==null){clearTimeout(voiceMenuCloseTimer);voiceMenuCloseTimer=null;}
  if(voiceMenuLayoutFrame){cancelAnimationFrame(voiceMenuLayoutFrame);voiceMenuLayoutFrame=0;}
  if(voiceMenu.hidden)return;
  $('navSound').setAttribute('aria-expanded','false');
  const finish=()=>{
    voiceMenu.classList.remove('is-open');
    voiceMenu.hidden=true;
    if(restoreFocus && navigation.active)$('navSound').focus({preventScroll:true});
  };
  if(immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  voiceMenu.classList.remove('is-open');
  voiceMenuCloseTimer=setTimeout(()=>{voiceMenuCloseTimer=null;finish();},270);
}
window.addEventListener('resize',queueVoiceMenuPosition,{passive:true});
window.addEventListener('orientationchange',queueVoiceMenuPosition,{passive:true});
window.visualViewport?.addEventListener('resize',queueVoiceMenuPosition,{passive:true});
window.visualViewport?.addEventListener('scroll',queueVoiceMenuPosition,{passive:true});
$('voiceMenuClose').addEventListener('click',()=>closeVoiceMenu());
voiceMenu.querySelector('[data-voice-dismiss]').addEventListener('click',()=>closeVoiceMenu());
voiceMenu.querySelectorAll('[data-voice-option]').forEach(option=>{
  option.addEventListener('click',()=>{
    chooseNavVoiceMode(option.dataset.voiceOption);
    closeVoiceMenu();
  });
});
voiceMenu.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    event.preventDefault();closeVoiceMenu();return;
  }
  if(event.key==='Tab'){
    const controls=[...voiceMenu.querySelectorAll('button:not([disabled])')];
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
});
// Persist only the chosen mode. The default is Normal, even before any setting
// has ever been saved. Navigation alone activates spoken directions.
setNavSoundState(loadNavVoiceMode());
navStartButton.addEventListener('click',startNavigation);
$('navEnd').addEventListener('click',()=>endNavigation());
$('navFollow').addEventListener('click',()=>{
  navigation.follow=true;
  setNavFollowState(true);
  if(navigation.markerPoint)followNavigationCamera(navigation.markerPoint,navigation.lastBearing,true);
});
// A real touch / pointer / wheel movement pauses follow and reveals the
// filled-arrow Recenter button. Programmatic GPS camera movement does not.
function onManualNavigationMapGesture(event){
  if(!navigation.active || !navigation.follow || !event.originalEvent)return;
  navigation.follow=false;
  stopNavigationCamera();
  setNavFollowState(false);
}
map.on('dragstart',onManualNavigationMapGesture);
map.on('movestart',onManualNavigationMapGesture);
map.on('rotatestart',onManualNavigationMapGesture);
map.on('zoomstart',onManualNavigationMapGesture);
map.on('pitchstart',onManualNavigationMapGesture);
$('navReroute').addEventListener('click',()=>void recalculateNavigation());
$('navSound').addEventListener('click',openVoiceMenu);
document.addEventListener('visibilitychange',()=>{
  if(!navigation.active)return;
  if(document.hidden){
    resetSpeedLimitTracking();
    // Invalidate in-flight requests too, so returning can request a fresh lock.
    navigationWakeGeneration += 1;
    navigationWakePending = null;
    // The browser revokes screen wake locks when the app is not visible.
    const previous = navigationWakeLock;
    navigationWakeLock = null;
    if (previous && !previous.released) { try { void previous.release().catch(() => {}); } catch (_) {} }
    cancelNavigationSpeech();
    navigation.pendingAlertKey=null;navigation.pendingGuidanceKey=null;
  }else{
    if (navigationWakeDesired) void requestNavigationWakeLock();
    updateNavAlert('Check your position and route after returning to MyArah.');
    refreshNavTrip();
    renderNavSpeed();
    map.resize();
    if(navigation.markerPoint)followNavigationCamera(navigation.markerPoint,navigation.lastBearing,true);
  }
});
// iOS may deliver a late orientation resize after the initial rotate event.
// Refresh only the framing, not the route or destination, and only when Follow is on.
let navigationCameraResizeTimer=null;
function resyncNavigationCameraLayout(){
  if(navigationCameraResizeTimer!==null)clearTimeout(navigationCameraResizeTimer);
  navigationCameraResizeTimer=setTimeout(()=>{
    navigationCameraResizeTimer=null;
    if(navigation.active && navigation.follow && !document.hidden && navigation.markerPoint){
      map.resize();
      followNavigationCamera(navigation.markerPoint,navigation.lastBearing,true);
    }
  },300);
}
window.addEventListener('orientationchange',resyncNavigationCameraLayout);
window.addEventListener('resize',()=>{
  if(navigation.active && navigation.follow && !document.hidden){
    const size=navigation.cameraState?.size;
    const rect=appRoot.getBoundingClientRect();
    if(!size || Math.abs(size[0]-rect.width)>24 || Math.abs(size[1]-rect.height)>24)
      resyncNavigationCameraLayout();
  }
});
window.addEventListener('pagehide',()=>{
  if(navigation.active)endNavigation('Navigation ended');
});
refreshNavigationStart();
resetRouteComparison();
