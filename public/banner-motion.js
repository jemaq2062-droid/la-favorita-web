/* La Favorita · Animación aislada para banners internos (no toca portada ni Mi tienda).
   Ajustes y apagado: BANNER_MOTION_CONFIG. Sin dependencias. */
export const BANNER_MOTION_CONFIG = {
  enabled: true,
  parallax: true,       // false = entrada por palabras sin desplazamiento al hacer scroll
  compactBar: true,     // false = sin barra de búsqueda compacta
  mobileCompact: false,
  duration: 950,
  wordStartY: 120,    // porcentaje de altura de la palabra
  wordStartAngle: 5,  // grados
  breadcrumbsStartY: -16, // px
  subtitleStartY: 18, // px
  lineWidth: 120,     // px
  lineHeight: 4,     // px
  starDuration: 920,
  smallStarDuration: 850,
  floatDuration: 1000,
  starStartScale: .3,
  starStartAngle: -90,
  ease: 'cubic-bezier(.22,1,.36,1)',
  bounceEase: 'cubic-bezier(.34,1.56,.64,1)',
  breadcrumbDuration: 900,
  subtitleDuration: 900,
  labelDuration: 900,
  wordStagger: 110,
  wordBaseDelay: 260,
  labelDelay: 150,
  subtitleDelay: 700,
  lineDelay: 800,
  decorationDelays: [500,700,900,1050],
  parallaxContent: .35,
  parallaxScale: .05,
  parallaxFadeStart: .12,
  parallaxFadeDistance: .7,
  parallaxBlur: 5,
  compactThreshold: .92,
  resetAt: 1,
  replayBelow: .55,
  progressFactor: .9,
  mobileBreakpoint: 768
};

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let cleanPrevious=()=>{};

function splitWords(title,cfg){
  if(!title||title.dataset.lfbmSplit)return;
  const walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  let index=0;
  for(const node of nodes){
    const tokens=node.nodeValue.match(/\s+|[^\s]+/g)||[];
    const fragment=document.createDocumentFragment();
    for(const token of tokens){
      if(/^\s+$/.test(token)){fragment.append(document.createTextNode(token));continue;}
      const mask=document.createElement('span');mask.className='lfbm-word-mask';
      const word=document.createElement('span');word.className='lfbm-word';
      word.textContent=token;
      word.style.setProperty('--lfbm-word-delay',`${cfg.wordBaseDelay+cfg.wordStagger*index++}ms`);
      mask.append(word);fragment.append(mask);
    }
    node.replaceWith(fragment);
  }
  title.dataset.lfbmSplit='true';
}

export function mountBannerMotion(overrides={}){
  cleanPrevious();
  const cfg={...BANNER_MOTION_CONFIG,...overrides};
  const banner=document.querySelector('.page-banner[data-banner-motion]');
  if(!cfg.enabled||!banner||reduceMotion()||!('requestAnimationFrame' in window)){
    cleanPrevious=()=>{};
    return {destroy:cleanPrevious};
  }
  const content=banner.querySelector(':scope > .wrap');
  const heading=banner.querySelector('.page-banner-body h1');
  if(!content||!heading)return {destroy(){}};
  splitWords(heading,cfg);
  const cssValues={
    '--lfbm-word-ms':`${cfg.duration}ms`,
    '--lfbm-crumbs-ms':`${cfg.breadcrumbDuration}ms`,
    '--lfbm-subtitle-ms':`${cfg.subtitleDuration}ms`,
    '--lfbm-label-ms':`${cfg.labelDuration}ms`,
    '--lfbm-star-ms':`${cfg.starDuration}ms`,
    '--lfbm-small-star-ms':`${cfg.smallStarDuration}ms`,
    '--lfbm-float-ms':`${cfg.floatDuration}ms`,
    '--lfbm-label-delay':`${cfg.labelDelay}ms`,
    '--lfbm-subtitle-delay':`${cfg.subtitleDelay}ms`,
    '--lfbm-line-delay':`${cfg.lineDelay}ms`,
    '--lfbm-word-y':`${cfg.wordStartY}%`,
    '--lfbm-word-angle':`${cfg.wordStartAngle}deg`,
    '--lfbm-crumbs-y':`${cfg.breadcrumbsStartY}px`,
    '--lfbm-subtitle-y':`${cfg.subtitleStartY}px`,
    '--lfbm-line-width':`${cfg.lineWidth}px`,
    '--lfbm-line-height':`${cfg.lineHeight}px`,
    '--lfbm-star-scale':String(cfg.starStartScale),
    '--lfbm-star-angle':`${cfg.starStartAngle}deg`,
    '--lfbm-ease':cfg.ease,
    '--lfbm-bounce-ease':cfg.bounceEase
  };
  for(const [key,value] of Object.entries(cssValues))banner.style.setProperty(key,value);
  const line=document.createElement('span');line.className='lfbm-accent-line';line.setAttribute('aria-hidden','true');
  banner.querySelector('.page-banner-body p')?.after(line);
  const lights=[document.createElement('span'),document.createElement('span')];
  for(let i=0;i<lights.length;i++){
    lights[i].className=`lfbm-light lfbm-light-${i+1}`;
    lights[i].setAttribute('aria-hidden','true');
    banner.prepend(lights[i]);
  }
  const decorations=[...banner.querySelectorAll('.page-sparkle, .page-sparkle i, .lf8-float')];
  decorations.forEach((el,i)=>el.style.setProperty('--lfbm-decoration-delay',`${cfg.decorationDelays[Math.min(i,cfg.decorationDelays.length-1)]}ms`));
  const simple=banner.dataset.bannerMotion!=='full';
  let bar=null;
  if(!simple&&cfg.compactBar){
    bar=document.createElement('nav');
    bar.className='lfbm-compact-bar'+(cfg.mobileCompact?' lfbm-mobile-compact':'');
    bar.setAttribute('aria-label','Acceso rápido al catálogo');
    bar.innerHTML='<div class="lfbm-compact-inner"><strong>Catálogo</strong><button type="button" class="lfbm-compact-search" aria-label="Ir al buscador del catálogo"><span aria-hidden="true">⌕</span> Buscar productos</button></div><div class="lfbm-progress" aria-hidden="true"></div>';
    bar.inert=true;bar.setAttribute('aria-hidden','true');document.body.append(bar);
    bar.querySelector('button').addEventListener('click',()=>{
      const search=document.querySelector('#catalog-search');
      if(!search)return;
      search.scrollIntoView({behavior:'smooth',block:'center'});
      search.focus({preventScroll:true});
    });
  }
  const header=document.querySelector('.site-header');
  let top=0,height=1,ticking=false,raf=0,stopped=false,replayArmed=false;
  const abort=new AbortController();
  const desktop=()=>innerWidth>=cfg.mobileBreakpoint;
  const resize=()=>{
    const rect=banner.getBoundingClientRect();
    top=window.scrollY+rect.top;height=Math.max(1,rect.height);
    if(header&&bar)bar.style.setProperty('--lfbm-header-height',`${Math.max(0,header.getBoundingClientRect().height)}px`);
    schedule();
  };
  const play=()=>{
    banner.classList.remove('lfbm-play');
    void heading.offsetWidth;
    banner.classList.add('lfbm-play');
    replayArmed=false;
  };
  const update=()=>{
    ticking=false;raf=0;
    if(stopped||!banner.isConnected)return;
    const scroll=Math.max(0,window.scrollY-top);
    const p=clamp(scroll/(height*cfg.progressFactor),0,1);
    if(p>=cfg.resetAt && !replayArmed){banner.classList.remove('lfbm-play');replayArmed=true;}
    else if(p<cfg.replayBelow&&(replayArmed||!banner.classList.contains('lfbm-play')))play();
    if(cfg.parallax){
      const fade=1-clamp((p-cfg.parallaxFadeStart)/cfg.parallaxFadeDistance,0,1);
      content.style.transform=`translate3d(0,${(scroll*cfg.parallaxContent).toFixed(2)}px,0) scale(${(1-p*cfg.parallaxScale).toFixed(4)})`;
      content.style.opacity=fade.toFixed(3);
      const blur=desktop()&&p>.1?p*cfg.parallaxBlur:0;
      content.style.filter=blur>.03?`blur(${blur.toFixed(2)}px)`:'none';
      if(desktop()){
        const large=decorations[0],small=decorations[1];
        if(large){large.style.translate=`0 ${(-scroll*.22).toFixed(2)}px`;large.style.rotate=`${(scroll*.18).toFixed(2)}deg`;}
        if(small){small.style.translate=`0 ${(-scroll*.40).toFixed(2)}px`;small.style.rotate=`${(-scroll*.35).toFixed(2)}deg`;small.style.scale=String(1+p*.3);}
        decorations.slice(2).forEach((el,i)=>{el.style.translate=`0 ${(-scroll*(.3+i*.12)).toFixed(2)}px`;el.style.rotate=`${(scroll*(i%2?.3:-.25)).toFixed(2)}deg`;});
        lights[0].style.translate=`${(-scroll*.25).toFixed(2)}px ${(scroll*.15).toFixed(2)}px`;lights[0].style.scale=String(1+p*.4);
        lights[1].style.translate=`${(scroll*.30).toFixed(2)}px ${(-scroll*.20).toFixed(2)}px`;
      }
    }
    if(bar){
      const visible=p>=cfg.compactThreshold&&(cfg.mobileCompact||desktop());
      bar.classList.toggle('lfbm-compact-visible',visible);
      bar.inert=!visible;bar.setAttribute('aria-hidden',String(!visible));
      const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
      bar.style.setProperty('--lfbm-progress',`${(100*clamp(window.scrollY/max,0,1)).toFixed(2)}%`);
    }
  };
  function schedule(){if(ticking||stopped)return;ticking=true;raf=requestAnimationFrame(update);}
  banner.classList.add('lfbm-active');
  const ro='ResizeObserver' in window?new ResizeObserver(resize):null;
  ro?.observe(banner);if(header)ro?.observe(header);
  window.addEventListener('scroll',schedule,{passive:true,signal:abort.signal});
  window.addEventListener('resize',resize,{passive:true,signal:abort.signal});
  resize();
  cleanPrevious=()=>{
    stopped=true;abort.abort();ro?.disconnect();cancelAnimationFrame(raf);
    banner.classList.remove('lfbm-active','lfbm-play');
    content.style.removeProperty('transform');content.style.removeProperty('opacity');content.style.removeProperty('filter');
    for(const el of decorations){for(const key of ['translate','rotate','scale','--lfbm-decoration-delay'])el.style.removeProperty(key);}
    for(const key of Object.keys(cssValues))banner.style.removeProperty(key);
    bar?.remove();lights.forEach(x=>x.remove());line.remove();
  };
  return {destroy:cleanPrevious};
}
