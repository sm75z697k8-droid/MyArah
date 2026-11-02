import maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

const locations = [
  {id:'kl',name:'Kuala Lumpur',state:'Wilayah Persekutuan',coords:[101.6869,3.1390],zoom:12.6},
  {id:'penang',name:'George Town',state:'Pulau Pinang',coords:[100.3294,5.4141],zoom:12.7},
  {id:'jb',name:'Johor Bahru',state:'Johor',coords:[103.7618,1.4927],zoom:12.6},
  {id:'kk',name:'Kota Kinabalu',state:'Sabah',coords:[116.0735,5.9804],zoom:12.5},
  {id:'kuching',name:'Kuching',state:'Sarawak',coords:[110.3592,1.5533],zoom:12.5}
];
const $ = id => document.getElementById(id);
const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const base = mode => ({
  version:8,
  sources:{carto:{type:'raster',tiles:[`https://basemaps.cartocdn.com/${mode}/{z}/{x}/{y}@2x.png`],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · © <a href="https://carto.com/attributions">CARTO</a>'}},
  layers:[{id:'basemap',type:'raster',source:'carto'}]
});
const map = new maplibregl.Map({container:'map',style:base('dark_all'),center:locations[0].coords,zoom:11.8,pitch:0,bearing:0,attributionControl:true});
let mode='dark', tilt=false, selectedMarker=null, userMarker=null, notifyTimeout;

function notify(message){const n=$('notice');n.textContent=message;n.hidden=false;clearTimeout(notifyTimeout);notifyTimeout=setTimeout(()=>n.hidden=true,4200)}
function openSearch(){ $('overlay').classList.add('open');$('overlay').setAttribute('aria-hidden','false');renderResults('');$('searchInput').value='';setTimeout(()=>$('searchInput').focus(),250) }
function closeSearch(){ $('overlay').classList.remove('open');$('overlay').setAttribute('aria-hidden','true');$('openSearch').focus() }
function choose(p){
  map.flyTo({center:p.coords,zoom:p.zoom,pitch:tilt?40:0,bearing:0,duration:isReducedMotion?0:1050,essential:true});
  $('placeTitle').textContent=p.name;
  $('placeSubtitle').textContent=p.state+' · Map preview';
  document.querySelectorAll('[data-place]').forEach(b=>b.classList.toggle('active',b.dataset.place===p.id));
  if(selectedMarker)selectedMarker.remove();
  const marker=document.createElement('div');marker.className='city-marker';marker.setAttribute('aria-label',p.name);
  selectedMarker=new maplibregl.Marker({element:marker,anchor:'bottom'}).setLngLat(p.coords).addTo(map);
  closeSearch();
}
function renderResults(filter){
  const container=$('results');container.replaceChildren();
  const matches=locations.filter(p=>`${p.name} ${p.state}`.toLowerCase().includes(filter.trim().toLowerCase()));
  if(!matches.length){const empty=document.createElement('p');empty.className='search-disclaimer';empty.textContent='No sample cities matched. Full address search is planned for a future version.';container.append(empty);return}
  matches.forEach(p=>{
    const b=document.createElement('button');b.className='result';
    const pin=document.createElement('span');pin.className='pin';pin.textContent='⌖';
    const info=document.createElement('span');
    const name=document.createElement('div');name.className='result-name';name.textContent=p.name;
    const state=document.createElement('div');state.className='result-state';state.textContent=p.state;
    info.append(name,state);
    const arrow=document.createElement('span');arrow.className='result-chevron';arrow.textContent='›';
    b.append(pin,info,arrow);b.addEventListener('click',()=>choose(p));container.append(b);
  });
}
$('openSearch').addEventListener('click',openSearch);
$('browse').addEventListener('click',openSearch);
$('closeSearch').addEventListener('click',closeSearch);
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closeSearch()});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && $('overlay').classList.contains('open'))closeSearch()});
$('searchInput').addEventListener('input',e=>renderResults(e.target.value));
document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>choose(locations.find(p=>p.id===b.dataset.place))));
$('theme').addEventListener('click',()=>{mode=mode==='dark'?'light':'dark';document.body.classList.toggle('light',mode==='light');map.setStyle(base(mode==='dark'?'dark_all':'light_all'));notify(mode==='dark'?'Dark map enabled':'Light map enabled')});
$('tilt').addEventListener('click',()=>{tilt=!tilt;map.easeTo({pitch:tilt?40:0,duration:isReducedMotion?0:500});$('tiltText').textContent=tilt?'3D':'2D';$('tilt').setAttribute('aria-label',tilt?'Switch to flat map':'Switch to tilted map')});
$('north').addEventListener('click',()=>map.easeTo({bearing:0,duration:isReducedMotion?0:400}));
$('locate').addEventListener('click',()=>{
  if(!navigator.geolocation){notify('Location is not supported in this browser');return}
  notify('Finding your location…');
  navigator.geolocation.getCurrentPosition(pos=>{
    const coords=[pos.coords.longitude,pos.coords.latitude];
    if(userMarker)userMarker.remove();
    const el=document.createElement('div');el.className='location-marker';
    userMarker=new maplibregl.Marker({element:el}).setLngLat(coords).addTo(map);
    map.flyTo({center:coords,zoom:15,pitch:tilt?40:0,duration:isReducedMotion?0:900});
    notify('Showing your current location');
  },err=>notify(err.code===1?'Location permission denied':'Unable to find your location'),{enableHighAccuracy:true,timeout:14000,maximumAge:10000});
});
map.on('error',e=>{console.warn('Map error:',e.error);notify('Some map tiles could not load. Check your connection.')});
renderResults('');
