/* La Favorita V10 — solo movimiento y geometría. Colores y componentes originales intactos. */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastScrollRefresh=()=>{};

/* Ajustes del carrusel y objetos de sucursales. Solo afecta la portada.
   Cambia estos valores sin tocar la paleta ni la estructura del proyecto. */
export const BRANCH_MOTION_OPTIONS = Object.freeze({
 centerWidth: .78,        // fracción del espacio en escritorio
 sideAngle: 36,           // grados hacia el centro
 sideScale: .86,
 sideOpacity: .55,
 sideBlur: 1,             // px; desactivado en móvil
 dragStart: 8,            // px para distinguir arrastre y clic
 dragThreshold: 60,       // px para cambiar de sucursal
 repulsionRadius: 130,    // px alrededor de cada útil
 repulsionStrength: 52,   // desplazamiento máximo aproximado
 spring: .04,
 damping: .90,
 floatAmplitudeMin: 8,    // px
 floatAmplitudeMax: 18,   // px
 floatSpeed: .00092       // ciclos visuales relativos por milisegundo
});

function mountCylinder({allowMotion}){
 const root=$('[data-lf10-carousel]');if(!root)return ()=>{};
 const track=$('[data-lf8-branch-track]',root);if(!track)return ()=>{};
 const cards=$$('.branch-card',track),dots=$$('[data-lf8-branch-dot]',root);
 const counter=$('.lf8-position',root),buttons=$$('[data-lf8-move]',root);
 if(!cards.length)return ()=>{};
 const count=cards.length,off=[],cfg=BRANCH_MOTION_OPTIONS;
 const on=(target,event,fn,opts)=>{target.addEventListener(event,fn,opts);off.push(()=>target.removeEventListener(event,fn,opts));};
 const norm=n=>((n%count)+count)%count;
 const signedDelta=(i,focus)=>{
  let d=(i-focus)%count;
  if(d>count/2)d-=count;
  if(d< -count/2)d+=count;
  return d;
 };
 let selected=0,raf=0,drag=null,dragOffset=0,suppressClickUntil=0;
 const originalTabIndex=track.getAttribute('tabindex');
 root.classList.add('lf10-mounted','lf10-wide-carousel');
 root.dataset.lf10Count=String(count);
 root.dataset.lf10Mode=count===1?'single':count===2?'split':'cylinder';
 track.setAttribute('tabindex','0');track.setAttribute('role','region');
 track.setAttribute('aria-roledescription','carrusel');
 track.setAttribute('aria-label','Sucursales de La Favorita');
 buttons.forEach(b=>{b.disabled=count<2;});
 if('EventSource' in window){
  const events=new EventSource('/api/branches/stream');
  const changed=()=>window.dispatchEvent(new Event('lf10:branchesChanged'));
  events.addEventListener('branches',changed);
  off.push(()=>{events.removeEventListener('branches',changed);events.close();});
 }
 const interpolate=(a,b,t)=>a+(b-a)*clamp(t);
 const sideState=(d,space,mobile)=>{
  const sideX=space*(mobile?.77:.60);
  const absolute=Math.abs(d),sign=Math.sign(d);
  const t=clamp(absolute);
  const fade=absolute>1?clamp(1-(absolute-1)/.46):1;
  return {
   x:sign*interpolate(0,sideX,t)*(absolute>1?1+Math.min(.12,(absolute-1)*.15):1),
   z:-interpolate(0,mobile?72:150,t),
   yaw:-sign*interpolate(0,mobile?(root.classList.contains('gateway-focus-showcase')?30:24):cfg.sideAngle,t),
   scale:interpolate(1,cfg.sideScale,t),
   opacity:interpolate(1,cfg.sideOpacity,t)*fade,
   blur:0,
  };
 };
 function place(){
  raf=0;
  const width=track.clientWidth||window.innerWidth;
  const mobile=width<768;
  const split=count===2&&!mobile;
  const focusMode=!!root.classList.contains('gateway-focus-showcase');
  const cardWidth=focusMode?(mobile?width*.82:split?width*.44:Math.min(width*cfg.centerWidth,1300)):(mobile?Math.min(width*.9,540):split?width*.44:Math.min(width*cfg.centerWidth,1080));
  track.style.setProperty('--lf10-card-width',`${Math.round(cardWidth)}px`);
  const travel=Math.max(190,cardWidth*.78);
  const rawFocus=selected-(allowMotion?dragOffset/travel:0);
  cards.forEach((card,i)=>{
   let x=0,z=0,yaw=0,scale=1,opacity=1,blur=0;
   const d=signedDelta(i,rawFocus);
   if(split){
    x=(i===0?-1:1)*width*.238 + dragOffset*.24;
    yaw=i===0?11:-11;
    scale=i===selected?1:.95;
    opacity=i===selected?1:.86;
   }else if(count>1){
    ({x,z,yaw,scale,opacity,blur}=sideState(d,width,mobile));
   }
   // The selected card is a horizontal split: photo left, information right.
   // No DOM or content changes are needed for the existing link to work.
   card.style.setProperty('--lf10-transform',`translate3d(calc(-50% + ${x.toFixed(2)}px),0,${z.toFixed(2)}px) rotateY(${yaw.toFixed(2)}deg) scale(${scale.toFixed(3)})`);
   card.style.setProperty('--lf10-opacity',opacity.toFixed(3));
   card.style.setProperty('--lf10-filter',Math.abs(d)<.1?'none':`brightness(${mobile?.65:.5})`);
   card.style.setProperty('--lf10-depth',String(i===selected?100:Math.round(70-Math.abs(d)*10)));
   const focus=i===selected;
   card.classList.toggle('lf10-focus',focus);
   card.classList.toggle('lf8-selected',focus);
   card.classList.toggle('lf10-far',allowMotion&&count>=3&&Math.abs(d)>1.46);
   card.setAttribute('aria-label',`${card.querySelector('h3')?.textContent||'Sucursal'}${focus?' · Seleccionada':''}`);
   card.tabIndex=focus||split?0:-1;
   // Hidden far-away links must not capture keyboard or pointer interactions.
   card.setAttribute('aria-hidden',allowMotion&&count>=3&&Math.abs(d)>1.46?'true':'false');
  });
  dots.forEach((dot,i)=>{dot.classList.toggle('is-selected',i===selected);dot.setAttribute('aria-pressed',String(i===selected));});
  if(counter)counter.textContent=`${String(selected+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;
 }
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(place);};
 const choose=i=>{selected=norm(i);schedule();};
 // Bind controls directly: clicks on carousel dots and arrows must work even if
 // another part of the page uses delegated click handlers.
 buttons.forEach(button=>on(button,'click',e=>{
  e.preventDefault();if(count<2)return;
  choose(selected+(button.dataset.lf8Move==='next'?1:-1));
 }));
 dots.forEach((dot,i)=>on(dot,'click',e=>{
  e.preventDefault();if(count<2)return;choose(i);
 }));
 // Cancel a synthetic click after a drag before the link receives it.
 on(track,'click',e=>{
  if(e.target.closest('.branch-card')&&performance.now()<suppressClickUntil){
   e.preventDefault();e.stopImmediatePropagation();
  }
 },true);
 cards.forEach((card,i)=>on(card,'click',e=>{
  if(performance.now()<suppressClickUntil){e.preventDefault();return;}
  if(i!==selected&&count>1){e.preventDefault();choose(i);}
  else if(i===selected&&!e.target.closest('a,button,.gateway-photo-water')){card.querySelector('a.branch-enter')?.click();}
 }));
 on(track,'keydown',e=>{
  if(count<2||!['ArrowRight','ArrowLeft'].includes(e.key))return;
  e.preventDefault();choose(selected+(e.key==='ArrowRight'?1:-1));
  cards[selected]?.focus({preventScroll:true});
 });
 on(track,'dragstart',e=>e.preventDefault());
 function abortDrag(shouldSnap=false){
  if(!drag)return;
  const wasDragging=drag.active;
  const dx=drag.dx;
  if(wasDragging){
   suppressClickUntil=performance.now()+500;
   // Release without CSS transition removal until after the new target is set.
   if(shouldSnap&&Math.abs(dx)>cfg.dragThreshold&&count>1)selected=norm(selected+(dx<0?1:-1));
  }
  drag=null;dragOffset=0;
  track.classList.remove('lf10-dragging');
  schedule();
 }
 on(track,'pointerdown',e=>{
  if(!allowMotion||count<2||drag||e.pointerType==='touch'||e.pointerType==='mouse'&&e.button!==0)return;
  drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,dx:0,active:false,vertical:false};
 });
 on(track,'pointermove',e=>{
  if(!drag||drag.id!==e.pointerId||drag.vertical)return;
  const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
  if(!drag.active){
   if(Math.abs(dy)>cfg.dragStart&&Math.abs(dy)>Math.abs(dx)){drag.vertical=true;return;}
   if(Math.abs(dx)<cfg.dragStart||Math.abs(dx)<Math.abs(dy)*1.12)return;
   drag.active=true;
   track.classList.add('lf10-dragging');
   try{track.setPointerCapture(e.pointerId)}catch{}
  }
  e.preventDefault();
  drag.dx=dx;
  dragOffset=clamp(dx,-Math.max(280,track.clientWidth*.8),Math.max(280,track.clientWidth*.8));
  schedule();
 });
 on(track,'pointerup',e=>{if(drag&&drag.id===e.pointerId)abortDrag(true);});
 on(track,'pointercancel',e=>{if(drag&&drag.id===e.pointerId)abortDrag(false);});
 on(track,'lostpointercapture',e=>{if(drag&&drag.id===e.pointerId)abortDrag(false);});
 on(track,'pointerleave',e=>{if(drag&&!drag.active&&e.pointerType==='mouse')abortDrag(false);});
 // Native touch gestures are handled independently because mobile browsers can
 // cancel pointer sequences while deciding whether to scroll the document.
 let touchStart=null;
 const swipeLimit=()=>Math.min(72,Math.max(36,track.clientWidth*.095));
 on(track,'touchstart',e=>{
  if(!allowMotion||count<2||e.touches.length!==1)return;
  const t=e.touches[0];touchStart={x:t.clientX,y:t.clientY,dx:0,horizontal:false,vertical:false};
 },{passive:true});
 on(track,'touchmove',e=>{
  if(!touchStart||e.touches.length!==1)return;
  const t=e.touches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
  if(!touchStart.horizontal&&!touchStart.vertical){
   if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.1){touchStart.vertical=true;return;}
   if(Math.abs(dx)>9&&Math.abs(dx)>Math.abs(dy)*1.1)touchStart.horizontal=true;
  }
  if(!touchStart.horizontal)return;
  e.preventDefault();touchStart.dx=dx;
  dragOffset=clamp(dx,-track.clientWidth*.75,track.clientWidth*.75);
  track.classList.add('lf10-dragging');schedule();
 },{passive:false});
 const finishTouch=()=>{
  if(!touchStart)return;
  const {dx,horizontal}=touchStart;touchStart=null;
  if(horizontal&&Math.abs(dx)>=swipeLimit()){
   selected=norm(selected+(dx<0?1:-1));
   suppressClickUntil=performance.now()+650;
  }else if(horizontal){suppressClickUntil=performance.now()+350;}
  dragOffset=0;track.classList.remove('lf10-dragging');schedule();
 };
 on(track,'touchend',finishTouch,{passive:true});
 on(track,'touchcancel',()=>{touchStart=null;dragOffset=0;track.classList.remove('lf10-dragging');schedule();},{passive:true});

 on(window,'resize',schedule,{passive:true});
 place();
 return ()=>{
  cancelAnimationFrame(raf);off.reverse().forEach(f=>f());
  root.classList.remove('lf10-mounted','lf10-wide-carousel');
  track.classList.remove('lf10-dragging');
  if(originalTabIndex===null)track.removeAttribute('tabindex');else track.setAttribute('tabindex',originalTabIndex);
  track.removeAttribute('role');track.removeAttribute('aria-roledescription');track.removeAttribute('aria-label');
  track.style.removeProperty('--lf10-card-width');
  cards.forEach(card=>{
   for(const name of ['--lf10-transform','--lf10-opacity','--lf10-filter','--lf10-depth'])card.style.removeProperty(name);
   card.removeAttribute('tabindex');card.removeAttribute('aria-hidden');
  });
 };
}

function mountGatewayFloats({allowMotion,finePointer}){
 if(document.querySelector('.gateway-focus-stage'))return ()=>{};
 if(!allowMotion||!('IntersectionObserver' in window))return ()=>{};
 const stage=$('.gateway-v5-stage'),layer=$('.gateway-v5-stage .lf8-float-field');
 if(!stage||!layer)return ()=>{};
 const cfg=BRANCH_MOTION_OPTIONS,off=[];
 const extra=['eraser','highlighter'];
 const created=extra.map((name,i)=>{
  const item=document.createElement('span');item.className=`lf8-float lf10-float-extra lf10-float-extra-${i+1}`;
  const img=document.createElement('img');img.src=`/assets/floating/${name}.svg`;img.alt='';img.loading='lazy';
  item.appendChild(img);layer.appendChild(item);return item;
 });
 const items=$$('.lf8-float',layer);
 const physical=items.map((el,i)=>({
  el,i,x:0,y:0,vx:0,vy:0,
  amp:cfg.floatAmplitudeMin+(i%4)*(cfg.floatAmplitudeMax-cfg.floatAmplitudeMin)/3,
  phase:i*1.82,
  freq:cfg.floatSpeed*(.78+(i%3)*.23),baseX:0,baseY:0
 }));
 let mouse=null,raf=0,visible=false,alive=true;
 const measure=()=>{for(const item of physical){item.baseX=item.el.offsetLeft+item.el.offsetWidth/2;item.baseY=item.el.offsetTop+item.el.offsetHeight/2;}};
 measure();
 const nearStage=e=>{
  const rect=stage.getBoundingClientRect();
  mouse=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom?{x:e.clientX,y:e.clientY}:null;
 };
 function frame(now){
  if(!alive||!visible||document.hidden){raf=0;return;}
  const stageRect=stage.getBoundingClientRect();
  for(const item of physical){
   if(item.el.offsetParent===null)continue;
   const cx=stageRect.left+item.baseX,cy=stageRect.top+item.baseY;
   let targetX=0,targetY=0;
   if(mouse){
    const dx=cx-mouse.x,dy=cy-mouse.y;
    const distance=Math.hypot(dx,dy);
    if(distance<cfg.repulsionRadius){
     const strength=(1-distance/cfg.repulsionRadius)**1.4*cfg.repulsionStrength;
     const angle=Math.atan2(dy,dx);
     targetX=Math.cos(angle)*strength;
     targetY=Math.sin(angle)*strength;
    }
   }
   item.vx=(item.vx+(targetX-item.x)*cfg.spring)*cfg.damping;
   item.vy=(item.vy+(targetY-item.y)*cfg.spring)*cfg.damping;
   item.x+=item.vx;item.y+=item.vy;
   const wave=now*item.freq+item.phase;
   const fX=Math.sin(wave)*item.amp*.7;
   const fY=Math.cos(wave*.84)*item.amp;
   const rotation=Math.sin(wave*.78)*12+item.x*.12;
   item.el.style.transform=`translate3d(${(item.x+fX).toFixed(2)}px,${(item.y+fY).toFixed(2)}px,0) rotateZ(${rotation.toFixed(2)}deg)`;
  }
  raf=requestAnimationFrame(frame);
 }
 const request=()=>{if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(frame);};
 const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting||false;if(visible)request();else{cancelAnimationFrame(raf);raf=0;}},{threshold:0});
 observer.observe(stage);
 if(finePointer){window.addEventListener('pointermove',nearStage,{passive:true});off.push(()=>window.removeEventListener('pointermove',nearStage));}
 const leave=()=>{mouse=null;};
 stage.addEventListener('pointerleave',leave);off.push(()=>stage.removeEventListener('pointerleave',leave));
 const resize=()=>{measure();request();};
 window.addEventListener('resize',resize,{passive:true});off.push(()=>window.removeEventListener('resize',resize));
 const visibility=()=>{if(!document.hidden)request();};
 document.addEventListener('visibilitychange',visibility);off.push(()=>document.removeEventListener('visibilitychange',visibility));
 request();
 return ()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();off.forEach(fn=>fn());created.forEach(el=>el.remove());items.forEach(el=>el.style.removeProperty('transform'));};
}

function mountReversibleScroll({allowMotion}){
 if(!allowMotion||!('IntersectionObserver' in window))return ()=>{};
 let watcher=null;
 const observed=new Set();
 function add(root=document){
  for(const old of observed)if(!old.isConnected){watcher.unobserve(old);observed.delete(old);}
  for(const card of $$('.product-card',root)){
   // La cuadrícula del catálogo usa el controlador bidireccional especializado.
   if(card.closest('#catalog-results') || card.closest('.lfpr-slot'))continue;
   if(observed.has(card))continue;
   observed.add(card);
   card.classList.remove('lf8-zoom-in','lf9-scroll-card','lf-filter-arrive');
   card.classList.add('lf10-scroll-card');
   // When a filter is changed, visible products must not vanish.
   const r=card.getBoundingClientRect();
   if(r.top<innerHeight*.93&&r.bottom>innerHeight*.07)card.classList.add('lf10-visible');
   watcher.observe(card);
  }
 }
 watcher=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(entry.isIntersecting)entry.target.classList.add('lf10-visible');
   else entry.target.classList.remove('lf10-visible'); // bidirectional reset on leave
  }
 },{rootMargin:'-7% 0px -7% 0px',threshold:0.12});
 add();lastScrollRefresh=add;
 return ()=>{watcher.disconnect();observed.clear();lastScrollRefresh=()=>{};};
}

export function mountV10(options){
 const cleanups=[mountCylinder(options),mountGatewayFloats(options),mountReversibleScroll(options)];
 return ()=>cleanups.reverse().forEach(f=>{try{f()}catch{}});
}
export function refreshV10(root){lastScrollRefresh(root||document);}
