/* MyArah v4 — 2D / 3D map prototype. No route or live traffic service. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CITIES = [
    {name:'Kuala Lumpur',region:'Wilayah Persekutuan',center:[101.6869,3.139],zoom:14.8},
    {name:'George Town',region:'Pulau Pinang',center:[100.3327,5.4141],zoom:14.5},
    {name:'Johor Bahru',region:'Johor',center:[103.7414,1.4927],zoom:14.5},
    {name:'Kota Kinabalu',region:'Sabah',center:[116.0735,5.9804],zoom:14.5},
    {name:'Kuching',region:'Sarawak',center:[110.3592,1.5535],zoom:14.5},
    {name:'Putrajaya',region:'Wilayah Persekutuan',center:[101.6964,2.9264],zoom:14.5},
    {name:'Shah Alam',region:'Selangor',center:[101.5183,3.0738],zoom:14.5},
    {name:'Ipoh',region:'Perak',center:[101.0901,4.5975],zoom:14.5},
    {name:'Melaka',region:'Melaka',center:[102.2501,2.1896],zoom:14.5},
    {name:'Alor Setar',region:'Kedah',center:[100.3712,6.1248],zoom:14.5}
  ];
  const STYLES = {light:'https://tiles.openfreemap.org/styles/positron',dark:'https://tiles.openfreemap.org/styles/dark'};
  let mode='2d', theme='light', userMarker=null, toastTimeout=null;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const say = message => { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),3000); };
  if (!window.maplibregl || !maplibregl.supported()) { say('This browser cannot load the interactive map.'); return; }
  const map = new maplibregl.Map({container:'map',style:STYLES.light,center:[101.6869,3.139],zoom:12.8,pitch:0,bearing:0,attributionControl:true,maxPitch:75});
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  map.on('error', err => {console.warn('Map issue:',err.error || err);});

  function addBuildings() {
    if (mode!=='3d' || !map.isStyleLoaded() || map.getLayer('myarah-buildings')) return;
    const style=map.getStyle();
    // Reuse an existing vector-tile building layer if the selected map style exposes one.
    const building=style.layers.find(layer => layer['source-layer']==='building' && layer.source && style.sources[layer.source]?.type==='vector');
    if (!building) { $('modeHelp').textContent='3D perspective • building data unavailable here'; return; }
    try {
      const firstLabel=style.layers.find(layer=>layer.type==='symbol');
      map.addLayer({id:'myarah-buildings',type:'fill-extrusion',source:building.source,'source-layer':'building',minzoom:13,filter:['all',['==',['geometry-type'],'Polygon']],paint:{'fill-extrusion-color':theme==='dark'?'#758394':'#c8d0d6','fill-extrusion-height':['coalesce',['to-number',['get','render_height']],['to-number',['get','height']],12],'fill-extrusion-base':['coalesce',['to-number',['get','render_min_height']],['to-number',['get','min_height']],0],'fill-extrusion-opacity':0.73}},firstLabel?.id);
      $('modeHelp').textContent='Perspective view • 3D buildings where mapped';
    } catch(e) {console.warn('3D building layer unavailable',e);$('modeHelp').textContent='3D perspective view';}
  }
  map.on('style.load',addBuildings);
  function setMode(next) {
    mode=next;
    $('mode2d').classList.toggle('active',mode==='2d'); $('mode3d').classList.toggle('active',mode==='3d');
    $('mode2d').setAttribute('aria-pressed',String(mode==='2d')); $('mode3d').setAttribute('aria-pressed',String(mode==='3d'));
    $('modeHelp').textContent=mode==='2d'?'Classic top-down view':'3D perspective view';
    map.easeTo({pitch:mode==='3d'?62:0,bearing:mode==='3d'?-22:0,zoom:Math.max(map.getZoom(),mode==='3d'?15:12),duration:reducedMotion?0:900,essential:true});
    if(mode==='3d') addBuildings(); else if(map.getLayer('myarah-buildings')) map.removeLayer('myarah-buildings');
  }
  $('mode2d').addEventListener('click',()=>setMode('2d'));
  $('mode3d').addEventListener('click',()=>setMode('3d'));
  $('north').addEventListener('click',()=>map.easeTo({bearing:0,duration:reducedMotion?0:450}));
  $('zoomIn').addEventListener('click',()=>map.zoomIn({duration:250}));
  $('zoomOut').addEventListener('click',()=>map.zoomOut({duration:250}));
  $('themeToggle').addEventListener('click',()=>{
    theme=theme==='light'?'dark':'light'; document.body.classList.toggle('night',theme==='dark');
    $('themeToggle').querySelector('span').textContent=theme==='dark'?'Light map':'Dark map';
    const {lng,lat}=map.getCenter(), zoom=map.getZoom(), bearing=map.getBearing(),pitch=map.getPitch();
    map.setStyle(STYLES[theme]);map.jumpTo({center:[lng,lat],zoom,bearing,pitch});
  });
  $('locate').addEventListener('click',()=>{
    if(!navigator.geolocation){say('Location is not supported here.');return;}
    say('Finding your location…');
    navigator.geolocation.getCurrentPosition(pos=>{
      const lngLat=[pos.coords.longitude,pos.coords.latitude];
      if(!userMarker){const dot=document.createElement('div');dot.className='location-dot';dot.style.cssText='width:17px;height:17px;background:#3087df;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px #3087df2b,0 2px 8px #0004';userMarker=new maplibregl.Marker({element:dot}).setLngLat(lngLat).addTo(map);}else userMarker.setLngLat(lngLat);
      map.flyTo({center:lngLat,zoom:16,pitch:mode==='3d'?62:0,bearing:mode==='3d'?-22:0,duration:reducedMotion?0:1100});say('Location found');
    },err=>say(err.code===1?'Allow location access in Safari settings.':'Unable to get your location.'),{enableHighAccuracy:true,timeout:12000,maximumAge:10000});
  });
  const overlay=$('searchOverlay');
  function renderResults(value='') {
    const q=value.toLocaleLowerCase().trim();const cities=CITIES.filter(c=>(c.name+' '+c.region).toLocaleLowerCase().includes(q));
    $('results').replaceChildren();
    if(!cities.length){const p=document.createElement('p');p.className='search-note';p.textContent='No matching sample cities.';$('results').append(p);return;}
    cities.forEach(c=>{const button=document.createElement('button');button.type='button';button.className='result';const name=document.createElement('strong');name.textContent=c.name;const region=document.createElement('span');region.textContent=c.region;button.append(name,region);button.addEventListener('click',()=>{overlay.hidden=true;map.flyTo({center:c.center,zoom:c.zoom,pitch:mode==='3d'?62:0,bearing:mode==='3d'?-22:0,duration:reducedMotion?0:1300});say('Showing '+c.name);});$('results').append(button);});
  }
  $('searchOpen').addEventListener('click',()=>{overlay.hidden=false;$('placeSearch').value='';renderResults();$('placeSearch').focus();});
  $('searchClose').addEventListener('click',()=>overlay.hidden=true);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true;});
  $('placeSearch').addEventListener('input',e=>renderResults(e.target.value));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.hidden=true;});
  renderResults();
})();
