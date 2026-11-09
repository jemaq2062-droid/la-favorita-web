/* La Favorita · Etapa 2 · decoración compartida por todas las páginas.
   No modifica tarjetas, colores, navegación ni eventos de la aplicación. */
export const FLOATING_BACKGROUND_OPTIONS = Object.freeze({
  enabled: true,             // false = ocultar todo el fondo flotante
  gatewayDesktop: 160,        // portada: conserva la cantidad aprobada en V11
  desktop: 115,               // páginas interiores
  denseDesktop: 95,          // catálogo, comparador y cotizador
  mobile: 34,
  maximumInterior: 130,       // límite para páginas interiores extensas
  opacityFar: .25,
  opacityMiddle: .46,
  opacityNear: .72,
  repulsionRadius: 100,      // px; se suma la mitad del tamaño del objeto
  repulsionStrength: 52,    // px de empuje máximo
  spring: .04,
  damping: .90,
  speed: .00115,
  parallax: .14,             // factor de desplazamiento, acotado para páginas extensas
  maxParallax: 140,
  scrollTilt: 22,            // inclinación máxima en grados
  scrollSmooth: .12
});

const HALTON = (num,base)=>{let result=0,fraction=1;while(num>0){fraction/=base;result+=fraction*(num%base);num=Math.floor(num/base);}return result;};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const prefersLess=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors=['var(--pink-soft)','var(--teal)','var(--yellow)','var(--violet)','var(--amber)'];
// Los seis ilustraciones SVG originales siguen disponibles, más otros iconos rellenos.
const assetNames=['pencil','notebook','ruler','highlighter','eraser','paperclip'];
const shapes={
 scissors:'<circle cx="6.5" cy="17" r="3.6"/><circle cx="17.5" cy="17" r="3.6"/><path d="M9 15.5 18 2l2 1-8 14ZM15 15.5 6 2 4 3l8 14Z"/>',
 book:'<path d="M2.5 4.5c4-1.8 7.7-1.5 9.5.7v16c-2.5-2.1-5.7-2.2-9.5-.6Zm19 0c-4-1.8-7.7-1.5-9.5.7v16c2.5-2.1 5.7-2.2 9.5-.6Z"/>',
 pushpin:'<path d="M8 2h8l-1.2 6.7 3.7 4.2v1.5h-13v-1.5l3.7-4.2ZM11 14h2l-1 9Z"/>',
 palette:'<path d="M12 2a10 10 0 1 0 0 20h1c3 0 4.4-3.6 2.5-5.4-1.8-1.6-1-3.6 1.2-3.6H19A5 5 0 0 0 24 8C24 4.7 18.5 2 12 2Zm-5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4-4a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM5 15a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"/>',
 backpack:'<path d="M8 6V5a4 4 0 0 1 8 0v1h1a4 4 0 0 1 4 4v12H3V10a4 4 0 0 1 4-4Zm2 0h4V5a2 2 0 0 0-4 0ZM7 13h10v6H7ZM1 11h2v9H1Zm20 0h2v9h-2Z"/>',
 calculator:'<rect x="4" y="1" width="16" height="22" rx="2"/><rect x="7" y="4" width="10" height="5" rx="1" fill="var(--bg)"/><g fill="var(--bg)"><circle cx="9" cy="13" r="1.3"/><circle cx="15" cy="13" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></g>',
 brush:'<path d="M17 2 5 16l4 4L22 5l-5-3ZM5 16c-4 0-5 4-3 6 3 2 7-1 7-2Z"/>',
 star:'<path d="m12 1 2.9 7.9L23 12l-8.1 3.1L12 23l-2.9-7.9L1 12l8.1-3.1Z"/>',
 cross:'<path d="M10 1h4v9h9v4h-9v9h-4v-9H1v-4h9Z"/>',
 paper:'<path d="M4 2h11l5 5v15H4V2Zm11 0v6h5"/>',
 clip:'<path d="M18.4 3a5 5 0 0 0-7.1 0L3.1 11.3a7 7 0 0 0 9.9 9.9l7.2-7.2a3.5 3.5 0 0 0-5-5l-7.3 7.3 2.2 2.2 7.3-7.3.6.6-7.2 7.2a3.8 3.8 0 1 1-5.4-5.4l8.2-8.2a2 2 0 0 1 2.9 0Z"/>',
 highlighter:'<path d="M6 2h12v4l-2 2v10l-4 4-4-4V8L6 6Zm4 12h4v4h-4Z"/>',
 eraser:'<path d="m13 2 9 9-10 11H6l-5-5 12-15Zm-5 15 5 5h-7l-5-5Z"/>',
 ruler:'<path d="m5 1 18 18-4 4L1 5l4-4Zm-.2 5.2 2-2m.5 5.3 2-2m.8 5.5 2-2m.6 5.5 2-2"/>',
 pencil:'<path d="m15 1 8 8-14 14-8-8L15 1Zm-2 3 7 7-2 2-7-7Zm-12 11 8 8-9 1Z"/>',
 sparkle:'<path d="m12 0 2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6Z"/>'
};
const varieties=[...assetNames,...assetNames,...['scissors','book','pushpin','palette','calculator','brush','star','clip','highlighter','eraser','ruler','pencil','sparkle']];
let cleanupCurrent=()=>{};

export function mountFloatingBackground(){
  cleanupCurrent();cleanupCurrent=()=>{};
  if(!FLOATING_BACKGROUND_OPTIONS.enabled)return;
  const main=document.querySelector('#app main');if(!main)return;
  const gateway=!!main.classList.contains('gateway-focus');
  const stage=gateway?(main.querySelector('.gateway-focus-stage')||main):main;
  const opts=FLOATING_BACKGROUND_OPTIONS;
  const layer=document.createElement('div');layer.className='lf-floating-layer';layer.setAttribute('aria-hidden','true');
  stage.classList.add('lf-floating-host');stage.prepend(layer);
  const mobile=matchMedia('(max-width:767px)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let size={width:0,height:0,left:0,top:0};
  const getCount=()=>document.location.pathname.endsWith('/catalogo')?(mobile.matches?10:18):(mobile.matches?opts.mobile:(gateway?opts.gatewayDesktop:(['comparar','cotizar'].some(k=>document.location.pathname.endsWith('/'+k))?opts.denseDesktop:opts.desktop)));
  const measured=()=>{const r=stage.getBoundingClientRect();size={left:r.left+scrollX,top:r.top+scrollY,width:r.width,height:r.height};};
  let objects=[],raf=0,alive=true,visible=!document.hidden,pointer=null,lastScroll=scrollY,velocity=0;
  const clearObjects=()=>{layer.replaceChildren();objects=[];};
  function populate(){
    clearObjects();measured();
    const count=Math.min(gateway?opts.gatewayDesktop:opts.maximumInterior,getCount());
    const cols=mobile.matches?5:gateway?16:10;
    const rows=Math.ceil(count/cols);
    const fragment=document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const depthIndex=(i*7+2)%3;
      const depth=[.72,.96,1.22][depthIndex];
      const icon=varieties[(i*13+2)%varieties.length];
      const height=depthIndex===0?12+i%7:depthIndex===1?18+i%10:28+i%13;
      const column=(i*7)%cols,row=Math.floor(i/cols);
      let x=((column+.5+(HALTON(i+3,3)-.5)*.65)/cols)*100;
      let y=((row+.55+(HALTON(i+5,2)-.5)*.53)/rows)*100;
      if(gateway&&!mobile.matches){
        // Más útiles en los márgenes para que la tarjeta principal siga siendo legible.
        const section=i%10, jitter=HALTON(i+2,7);
        if(section<4)x=2+jitter*20;
        else if(section<8)x=78+jitter*20;
        else{ x=23+jitter*54; y=section===8?3+HALTON(i+3,5)*14:84+HALTON(i+5,3)*12; }
      }
      x=clamp(x,1,99);y=clamp(y,2,98);
      const color=colors[i%colors.length];
      const el=document.createElement('span');el.className=`lf-floating-item lf-floating-depth-${depthIndex}`;
      const overContent=gateway&&x>12&&x<88&&y>16&&y<93;
      const opacity=[opts.opacityFar,opts.opacityMiddle,opts.opacityNear][depthIndex]*(overContent?.19:.95);
      el.style.cssText=`left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${height}px;height:${height}px;--lf-float-color:${color};--lf-float-opacity:${opacity.toFixed(3)};`;
      if(assetNames.includes(icon)){
        const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.src=`/assets/floating/${icon}.svg`;el.append(img);
      }else{
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=shapes[icon];el.append(svg);
      }
      fragment.append(el);
      objects.push({el,x,y,depth,size:height,index:i,phase:i*1.61,speed:opts.speed*(.64+(i%7)*.12),amplitude:6+(i%7)*2,vx:0,vy:0,px:0,py:0});
    }
    layer.append(fragment);
  }
  populate();
  function start(){if(!alive||raf||!visible||reduced.matches)return;raf=requestAnimationFrame(frame);}
  function frame(time){
    raf=0;if(!alive||!visible||reduced.matches)return;
    velocity+=(0-velocity)*opts.scrollSmooth;
    const winTop=scrollY,winBottom=winTop+innerHeight;
    for(const o of objects){
      const originX=size.left+size.width*o.x/100,originY=size.top+size.height*o.y/100;
      const para=clamp(winTop*(1-o.depth)*opts.parallax,-opts.maxParallax,opts.maxParallax);
      if(originY+para<winTop-260||originY+para>winBottom+260)continue;
      let dx=0,dy=0;
      if(pointer&&fine.matches){
        const near=opts.repulsionRadius+o.size/2;
        const rx=originX-pointer.x,ry=originY+para-pointer.y;
        const dist=Math.hypot(rx,ry)||1;
        if(dist<near){const force=((near-dist)/near)**2*opts.repulsionStrength*o.depth;dx=rx/dist*force;dy=ry/dist*force;}
      }
      o.vx=(o.vx+(dx-o.px)*opts.spring)*opts.damping;
      o.vy=(o.vy+(dy-o.py)*opts.spring)*opts.damping;
      o.px+=o.vx;o.py+=o.vy;
      const phase=time*o.speed+o.phase;
      const fx=Math.sin(phase)*o.amplitude*.69;
      const fy=Math.cos(phase*.83)*o.amplitude;
      const rotate=clamp(Math.sin(phase*.71)*14+o.px*.12+velocity*.7,-32,32);
      o.el.style.transform=`translate3d(${(o.px+fx).toFixed(2)}px,${(o.py+fy+para).toFixed(2)}px,0) rotate(${rotate.toFixed(2)}deg)`;
    }
    start();
  }
  const move=e=>{if(!fine.matches)return;pointer={x:e.clientX+scrollX,y:e.clientY+scrollY};};
  const leave=()=>{pointer=null;};
  const pointerOut=e=>{if(!e.relatedTarget)leave();};
  const scroll=()=>{const next=scrollY;velocity=clamp(velocity+(next-lastScroll)*.32,-opts.scrollTilt,opts.scrollTilt);lastScroll=next;};
  const visibility=()=>{visible=!document.hidden;if(visible)start();else cancelAnimationFrame(raf),raf=0;};
  const resize=()=>{measured();};
  const breakpoint=()=>{populate();start();};
  const motion=()=>{if(reduced.matches){cancelAnimationFrame(raf);raf=0;objects.forEach(o=>o.el.style.transform='none');}else start();};
  const ro=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  ro?.observe(stage);
  const on=(target,name,fn,options)=>target.addEventListener(name,fn,options);
  on(window,'pointermove',move,{passive:true});on(window,'pointerout',pointerOut,{passive:true});
  on(window,'scroll',scroll,{passive:true});on(window,'resize',resize,{passive:true});
  on(document,'visibilitychange',visibility);mobile.addEventListener('change',breakpoint);reduced.addEventListener('change',motion);
  start();
  cleanupCurrent=()=>{
    alive=false;cancelAnimationFrame(raf);ro?.disconnect();window.removeEventListener('pointermove',move);window.removeEventListener('scroll',scroll);
    window.removeEventListener('resize',resize);window.removeEventListener('pointerout',pointerOut);document.removeEventListener('visibilitychange',visibility);
    mobile.removeEventListener('change',breakpoint);reduced.removeEventListener('change',motion);
    layer.remove();stage.classList.remove('lf-floating-host');
  };
}
