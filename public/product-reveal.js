/* La Favorita · ProductReveal. El slot se mide, el wrapper se anima.
   Desactivar: PRODUCT_REVEAL_OPTIONS.enabled = false. Sin librerías externas. */
export const PRODUCT_REVEAL_OPTIONS = {
  enabled: true,
  duration: 900,
  columnStagger: 90,
  maxColumnDelay: 450,
  dynamicStagger: 85,
  maxDynamicDelay: 450,
  carouselStagger: 80,
  y: 70,
  x: 54,
  rotateX: 24,
  rotateY: 15,
  blur: 5,
  scale: 0.94,
  imageZoom: 1.14,
  parallax: 18,
  rootMargin: '0px 0px -9% 0px',
  carouselMargin: '0px -3% -8% -3%',
  carouselMotionWindow: 850,
  safetyTimeout: 1800,
  resetBelow: 1.18,
  resetAbove: 0.18,
  mobileBreakpoint: 768,
  enterBoundary: .45,
  reverseFromTop: true,      // false = desde abajo en ambos sentidos
  reverseRowDelay: 60,
  maxReverseRowDelay: 240
};

const rootEl = document.documentElement;
const clamp = (x,lo,hi) => Math.max(lo,Math.min(hi,x));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const all = (root, selector) => Array.from(root.querySelectorAll(selector));
let stopPrevious = () => {};
let refreshCurrent = () => {};

function prepareSlot(card) {
  let slot = card.closest('.lfpr-slot');
  if (!slot) {
    slot = document.createElement('div');
    slot.className = 'lfpr-slot';
    card.before(slot);
    slot.append(card);
  }
  if (!slot.querySelector(':scope > .lfpr-motion')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'lfpr-motion';
    while (slot.firstChild) wrapper.append(slot.firstChild);
    slot.append(wrapper);
  }
  return slot;
}
function prepareCompare(root) {
  for (const th of all(root,'.compare-table thead th:not(:first-child)')) {
    let slot = th.querySelector(':scope > .lfpr-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'lfpr-slot lfpr-compare-slot';
      while(th.firstChild) slot.append(th.firstChild);
      th.append(slot);
    }
    if (!slot.querySelector(':scope > .lfpr-motion')) {
      const motion = document.createElement('div');
      motion.className = 'lfpr-motion';
      while(slot.firstChild) motion.append(slot.firstChild);
      slot.append(motion);
    }
  }
}

export function initProductReveal(overrides={}) {
  stopPrevious();
  const cfg = { ...PRODUCT_REVEAL_OPTIONS,...overrides };
  if (!cfg.enabled || reduced() || !('IntersectionObserver' in window) || !('animate' in Element.prototype)) {
    rootEl.classList.remove('lfpr-enabled');
    refreshCurrent = () => {};
    stopPrevious = () => {};
    return {refresh(){},destroy(){}};
  }
  const records = new Map();
  const carousels = new Map();
  const activeParallax = new Set();
  const resetsToCheck = new Set();
  let scrollDirection=1;
  let previousScrollY=scrollY;
  const abort = new AbortController();
  let stopped=false, frame=0, scanFrame=0;
  let mutation, watchdog;

  const isNearViewport = slot => {
    const r=slot.getBoundingClientRect();
    return r.top <= innerHeight*1.15 && r.bottom >= -cfg.resetAbove;
  };
  const isVisible = slot => {
    const r=slot.getBoundingClientRect();
    return r.bottom>0 && r.top<innerHeight;
  };
  const outsideResetArea = slot => {
    const r=slot.getBoundingClientRect();
    return r.top > innerHeight*cfg.resetBelow || r.bottom < -innerHeight*cfg.resetAbove;
  };
  function cleanupStyles(rec) {
    rec.wrapper.style.removeProperty('will-change');
    rec.img?.style.removeProperty('will-change');
  }
  function cancel(rec) {
    rec.token++;
    rec.animation?.cancel();rec.photoAnimation?.cancel();
    rec.animation=null;rec.photoAnimation=null;
    cleanupStyles(rec);
  }
  function finish(rec) {
    cancel(rec);
    rec.state='shown';rec.slot.dataset.lfprState='shown';
    rec.wrapper.style.removeProperty('transform');
    rec.wrapper.style.removeProperty('opacity');
    rec.wrapper.style.removeProperty('filter');
    if (!rec.carousel && cfg.parallax>0 && rec.img) activeParallax.add(rec);
    resetsToCheck.add(rec);
    scheduleParallax();
  }
  function reset(rec) {
    if (!rec || rec.state==='pending') return;
    cancel(rec);
    rec.state='pending';rec.slot.dataset.lfprState='pending';rec.visibleSince=0;
    const rect=rec.slot.getBoundingClientRect();
    rec.entryDirection=rect.bottom<0?-1:1;
    rec.img?.style.removeProperty('translate');
    activeParallax.delete(rec);
    resetsToCheck.delete(rec);
    // El wrapper vuelve al estado CSS inicial sin animar ni modificar el slot.
    void rec.wrapper.offsetWidth;
  }
  const columnCount=parent=>{
    const css=getComputedStyle(parent);
    if(css.display==='flex') {
      const s=parent.querySelector(':scope > .lfpr-slot');
      const gap=parseFloat(css.columnGap)||parseFloat(css.gap)||0;
      return s ? clamp(Math.floor((parent.clientWidth+gap+2)/Math.max(1,s.offsetWidth+gap)),1,8):1;
    }
    return clamp(css.gridTemplateColumns.split(' ').filter(Boolean).length||1,1,8);
  };
  function setColumns() {
    const counts=new Map();
    for(const rec of records.values()) {
      if(!rec.slot.isConnected) continue;
      const parent=rec.slot.parentElement;
      if(rec.slot.classList.contains('lfpr-compare-slot')) {
        const headers=Array.from(parent.parentElement.children).filter(x=>x.matches('th:not(:first-child)'));
        rec.cols=Math.max(1,headers.length);
        rec.column=Math.max(0,headers.indexOf(parent));
        continue;
      }
      if(!counts.has(parent)) counts.set(parent,columnCount(parent));
      rec.cols=counts.get(parent);
      rec.column=Array.prototype.indexOf.call(parent.children,rec.slot)%rec.cols;
    }
  }
  function show(rec) {
    if(stopped||rec.state!=='pending') return;
    if(rec.carousel && !(rec.carousel.vertical && rec.horizontal)) return;
    if(document.activeElement && rec.slot.contains(document.activeElement)){finish(rec);return;}
    const mobile=innerWidth<cfg.mobileBreakpoint;
    const mult=mobile?0.5:1;
    const ratio=rec.cols<=1?.5:rec.column/(rec.cols-1);
    const movingHoriz=rec.carousel && performance.now()-rec.carousel.lastMoved<cfg.carouselMotionWindow;
    const side=movingHoriz?rec.carousel.direction:0;
    const dx=movingHoriz?side*cfg.x*mult:(ratio*2-1)*cfg.x*mult;
    const ry=movingHoriz?-side*cfg.rotateY*mult:(1-ratio*2)*cfg.rotateY*mult;
    // Deducir la dirección del borde que entra, no del último wheel global.
    // Al subir desde fuera por arriba, el primer fotograma llega desde arriba.
    const rect=rec.slot.getBoundingClientRect();
    const direction=cfg.reverseFromTop && rect.top<=innerHeight*cfg.enterBoundary ? -1 : 1;
    const dy=(movingHoriz?32:cfg.y)*mult*direction;
    const rx=(movingHoriz?8:cfg.rotateX)*mult*direction;
    const turn=(2+(rec.index%3)*.5)*(rec.index%2?-1:1)*mult*direction;
    const scale=movingHoriz?.94:(mobile?.96:cfg.scale);
    const blur=mobile?0:cfg.blur;
    const peers=rec.carousel ? Array.from(rec.carousel.members).filter(r=>r.horizontal && r.state==='pending').sort((a,b)=>a.slot.offsetLeft-b.slot.offsetLeft):[];
    const carouselIndex=movingHoriz?Math.max(0,peers.indexOf(rec)):rec.column;
    const limit=mobile?180:cfg.maxColumnDelay;
    // Retraso por columna; al subir las filas inferiores llevan menos retraso.
    let reverseRowDelay=0;
    if(direction<0&&!rec.carousel){
      const rowSize=Math.max(1,rect.height+parseFloat(getComputedStyle(rec.slot.parentElement).rowGap||'0'));
      // Cada fila más arriba espera 60 ms; no recorrer 1,334 tarjetas.
      reverseRowDelay=Math.min(cfg.maxReverseRowDelay,Math.max(0,Math.floor((innerHeight-rect.top)/rowSize))*cfg.reverseRowDelay);
    }
    const delay=movingHoriz ? Math.min(limit,carouselIndex*cfg.carouselStagger)
      : Math.min(mobile?180:cfg.maxColumnDelay,rec.column*cfg.columnStagger+reverseRowDelay);
    const begin=`translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${turn.toFixed(1)}deg) scale(${scale})`;
    rec.state='playing';rec.slot.dataset.lfprState='playing';
    rec.startedAt=performance.now();
    rec.wrapper.style.willChange='transform,opacity,filter';
    const timing={duration:cfg.duration,delay,easing:'cubic-bezier(.25,1,.5,1)',fill:'both'};
    const token=++rec.token;
    try {
      rec.animation=rec.wrapper.animate([
        {offset:0,transform:begin,opacity:0,filter:`blur(${blur}px)`},
        {offset:.72,transform:`translate3d(0,${(-3*direction).toFixed(1)}px,0) rotateZ(${(-turn*.12).toFixed(2)}deg) scale(1.01)`,opacity:1,filter:'blur(0px)'},
        {offset:1,transform:'none',opacity:1,filter:'none'}
      ],timing);
      if(rec.img){
        rec.img.style.willChange='transform';
        rec.photoAnimation=rec.img.animate([{transform:`scale(${cfg.imageZoom})`},{transform:'scale(1)'}],timing);
      }
      rec.animation.finished.then(()=>{if(!stopped && rec.token===token && rec.state==='playing')finish(rec);}).catch(()=>{});
    }catch(e){console.warn('ProductReveal omitido para tarjeta:',e);finish(rec);}
  }
  const vertical=new IntersectionObserver(entries=>{
    try {
      for(const entry of entries) {
        if(carousels.has(entry.target)) {
          const track=carousels.get(entry.target);
          track.vertical=entry.isIntersecting;
          if(track.vertical){for(const rec of track.members) if(rec.horizontal)show(rec);}
          else if(outsideResetArea(entry.target))for(const rec of track.members)reset(rec);
          continue;
        }
        const rec=records.get(entry.target);
        if(!rec)continue;
        if(entry.isIntersecting){rec.visibleSince=performance.now();show(rec);}
        else if(outsideResetArea(rec.slot))reset(rec);
        else resetsToCheck.add(rec);
      }
    }catch(e){console.error('ProductReveal observador:',e);for(const rec of records.values())if(isVisible(rec.slot))finish(rec);}
  },{rootMargin:cfg.rootMargin,threshold:0.16});

  function makeCarousel(el) {
    if(carousels.has(el))return carousels.get(el);
    const data={el,members:new Set(),vertical:false,direction:1,lastMoved:-Infinity,lastX:el.scrollLeft};
    data.onScroll=()=>{
      const diff=el.scrollLeft-data.lastX;
      if(Math.abs(diff)>.6){data.direction=Math.sign(diff);data.lastMoved=performance.now();data.lastX=el.scrollLeft;}
    };
    el.addEventListener('scroll',data.onScroll,{passive:true});
    data.observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        const rec=records.get(entry.target);if(!rec)continue;
        rec.horizontal=entry.isIntersecting;
        if(rec.horizontal && data.vertical)show(rec);
        else if(!entry.isIntersecting)reset(rec);
      }
    },{root:el,rootMargin:cfg.carouselMargin,threshold:0});
    carousels.set(el,data);vertical.observe(el);
    return data;
  }
  function register(slot,dynamicDelay=-1){
    if(records.has(slot))return;
    let wrapper=slot.querySelector(':scope > .lfpr-motion');
    if(!wrapper){wrapper=document.createElement('div');wrapper.className='lfpr-motion';while(slot.firstChild)wrapper.append(slot.firstChild);slot.append(wrapper);}
    const card=wrapper.querySelector('.product-card');
    if(card)card.classList.remove('lf-filter-arrive','lf8-zoom-in','lf9-scroll-card','lf10-scroll-card');
    const parent=slot.parentElement;
    const track=parent?.matches('[data-lf8-product-track]')?makeCarousel(parent):null;
    const img=wrapper.querySelector('.product-image img, .mini-picture img');
    const rec={slot,wrapper,card,img,carousel:track,horizontal:false,cols:1,column:0,index:records.size,entryDirection:scrollDirection,dynamicDelay,state:'pending',token:0,animation:null,photoAnimation:null,visibleSince:isVisible(slot)?performance.now():0,startedAt:0};
    slot.dataset.lfprState='pending';records.set(slot,rec);
    slot.addEventListener('focusin',()=>finish(rec),{signal:abort.signal});
    if(track){track.members.add(rec);track.observer.observe(slot);}else vertical.observe(slot);
  }
  function scan(target=document,dynamic=false){
    if(stopped)return;
    prepareCompare(target);
    const fresh=[];
    for(const card of all(target,'.product-card')){
      const slot=prepareSlot(card);
      if(!records.has(slot)) fresh.push(slot);
    }
    for(const slot of all(target,'.lfpr-slot')) if(!records.has(slot) && !fresh.includes(slot))fresh.push(slot);
    fresh.forEach((slot,index)=>register(slot,dynamic?Math.min(cfg.maxDynamicDelay,index*cfg.dynamicStagger):-1));
    for(const [slot,rec] of records){
      if(slot.isConnected)continue;
      cancel(rec);activeParallax.delete(rec);resetsToCheck.delete(rec);
      if(rec.carousel){rec.carousel.members.delete(rec);rec.carousel.observer.unobserve(slot);}else vertical.unobserve(slot);
      records.delete(slot);
    }
    for(const [el,data] of carousels){
      if(el.isConnected && data.members.size)continue;
      vertical.unobserve(el);data.observer.disconnect();el.removeEventListener('scroll',data.onScroll);carousels.delete(el);
    }
    setColumns();
  }
  function requestScan(){if(scanFrame||stopped)return;scanFrame=requestAnimationFrame(()=>{scanFrame=0;scan(document,true);});}
  scan(document,false);
  mutation=new MutationObserver(list=>{
    if(list.some(m=>Array.from(m.addedNodes).some(n=>n.nodeType===1 &&
      (n.matches?.('.product-card,.products-grid,.compare-table,.lfpr-slot') || n.querySelector?.('.product-card,.products-grid,.compare-table')))))requestScan();
  });
  mutation.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  // Activa el CSS oculto sólo después de preparar slots, evitando huecos con JS desactivado.
  rootEl.classList.add('lfpr-enabled');

  function frameUpdate(){
    frame=0;
    if(stopped||document.hidden)return;
    const mid=innerHeight/2;
    for(const rec of resetsToCheck){
      if(!rec.slot.isConnected){resetsToCheck.delete(rec);continue;}
      if(outsideResetArea(rec.slot))reset(rec);
    }
    for(const rec of records.values()){
      if(rec.state==='playing'&&outsideResetArea(rec.slot)){
        finish(rec); // Cancelar keyframes y dejar el wrapper limpio.
        reset(rec);  // Sólo queda armado para el siguiente ingreso.
      }
    }
    // Recuperación inmediata: si el usuario invierte el scroll muy rápido,
    // el observador puede no llegar a emitir una nueva entrada.
    for(const rec of records.values()){
      if(rec.state!=='pending'||!rec.slot.isConnected)continue;
      if(!isVisible(rec.slot))continue;
      if(rec.carousel){if(rec.horizontal&&rec.carousel.vertical)show(rec);}
      else show(rec);
    }
    if(innerWidth>=cfg.mobileBreakpoint && !reduced()){
      for(const rec of activeParallax){
        if(rec.state!=='shown'||!rec.img||rec.carousel||!rec.slot.isConnected){activeParallax.delete(rec);continue;}
        const rect=rec.slot.getBoundingClientRect();
        if(rect.top>innerHeight+60 || rect.bottom<-60)continue;
        const value=clamp((mid-(rect.top+rect.height/2))/(innerHeight*.6),-1,1);
        rec.img.style.translate=`0 ${(-value*cfg.parallax).toFixed(2)}px`;
      }
    }
  }
  function scheduleParallax(){if(!frame)frame=requestAnimationFrame(frameUpdate);}
  const onScroll=()=>{
    const current=scrollY;
    if(Math.abs(current-previousScrollY)>1)scrollDirection=current>previousScrollY?1:-1;
    previousScrollY=current;
    scheduleParallax();
  };
  window.addEventListener('scroll',onScroll,{passive:true,signal:abort.signal});
  window.addEventListener('resize',()=>{setColumns();scheduleParallax();},{passive:true,signal:abort.signal});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){for(const rec of records.values())if(isVisible(rec.slot) && rec.state==='pending')finish(rec);scheduleParallax();}
  },{signal:abort.signal});
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change',()=>{
    if(preference.matches){rootEl.classList.remove('lfpr-enabled');for(const rec of records.values())finish(rec);}
    else {rootEl.classList.add('lfpr-enabled');for(const rec of records.values())if(outsideResetArea(rec.slot))reset(rec);}
  },{signal:abort.signal});
  // Antihuecos: si IntersectionObserver no avisó, ningún elemento visible permanece oculto.
  watchdog=setInterval(()=>{
    if(stopped||document.hidden)return;
    const now=performance.now();
    for(const rec of records.values()){
      if(!rec.slot.isConnected || rec.state==='shown' || (rec.carousel && !rec.horizontal) || !isNearViewport(rec.slot))continue;
      if(rec.state==='pending' && isVisible(rec.slot)){
        if(!rec.visibleSince)rec.visibleSince=now;
        if(now-rec.visibleSince>=cfg.safetyTimeout)finish(rec);
      }
      if(rec.state==='playing' && now-rec.startedAt>cfg.safetyTimeout+cfg.maxColumnDelay)finish(rec);
    }
  },250);
  scheduleParallax();
  refreshCurrent=(root=document,dynamic=true)=>scan(root,dynamic);
  stopPrevious=()=>{
    stopped=true;rootEl.classList.remove('lfpr-enabled');
    clearInterval(watchdog);cancelAnimationFrame(frame);cancelAnimationFrame(scanFrame);
    mutation?.disconnect();vertical.disconnect();abort.abort();
    for(const data of carousels.values()){data.observer.disconnect();data.el.removeEventListener('scroll',data.onScroll);}
    for(const rec of records.values()){
      cancel(rec);rec.img?.style.removeProperty('translate');
    }
    records.clear();carousels.clear();resetsToCheck.clear();activeParallax.clear();
  };
  return {refresh:refreshCurrent,destroy:stopPrevious};
}
export function refreshProductReveal(root=document){refreshCurrent(root,true);}
