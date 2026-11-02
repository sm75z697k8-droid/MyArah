import maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

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
const tiles = theme => ({
  version:8,
  sources:{basemap:{type:'raster',tiles:[`https://basemaps.cartocdn.com/${theme}/{z}/{x}/{y}@2x.png`],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'}},
  layers:[{id:'map-tiles',source:'basemap',type:'raster'}]
});
const map = new maplibregl.Map({container:'map',style:tiles('voyager'),center:locations[0].coords,zoom:12,pitch:0,bearing:0,attributionControl:true});
let dark=false,tilted=false,chosen=locations[0],selectedMarker=null,userMarker=null,toastTimer;
function toast(message){const el=$('notice');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3500)}
function motion(){return reducedMotion?0:850}
function setPlace(place){
  chosen=place;
  map.flyTo({center:place.coords,zoom:place.zoom,pitch:tilted?40:0,bearing:0,duration:motion(),essential:true});
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
$('recenter').addEventListener('click',()=>map.flyTo({center:chosen.coords,zoom:chosen.zoom,pitch:tilted?40:0,duration:motion()}));
$('theme').addEventListener('click',()=>{
  dark=!dark;document.body.classList.toggle('dark',dark);
  map.setStyle(tiles(dark?'dark_all':'voyager'));
  $('theme').setAttribute('aria-label',dark?'Switch to light map':'Switch to dark map');
  toast(dark?'Dark appearance':'Light appearance');
});
$('tilt').addEventListener('click',()=>{
  tilted=!tilted;map.easeTo({pitch:tilted?40:0,duration:reducedMotion?0:450});
  $('tilt').textContent=tilted?'2D':'3D';
  $('tilt').setAttribute('aria-label',tilted?'Switch to flat map':'Switch to tilted map');
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
    map.flyTo({center:coords,zoom:15,pitch:tilted?40:0,duration:motion()});
    toast('Your location is on the map');
  },error=>toast(error.code===1?'Location permission denied':'Location unavailable. Check your GPS.'),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
});
map.on('error',event=>{console.warn('Map rendering error',event.error);toast('Map tiles unavailable. Check your internet connection.')});
renderResults();
setPlace(locations[0]);
