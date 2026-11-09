/* La Favorita | Reveals exclusivos de "Mi tienda".
   Desactivar todo: HOME_REVEAL_OPTIONS.enabled = false.
   No toca el catálogo general, el administrador ni las rutas. */
export const HOME_REVEAL_OPTIONS = {
  enabled: true,
  triggerBottom: 0.23,       // 23 % del alto del viewport: zona de disparo inferior
  intersectionThreshold: 0.12,
  titleDuration: 950,        // ms
  wordStagger: 130,          // ms
  categoryDuration: 1200,    // ms
  categoryStagger: 130,      // ms
  categoryDistance: 90,     // px
  categoryAngle: -70,       // grados X
  categoryBlur: 7,          // px
  productDuration: 1300,     // ms
  productStagger: 160,      // ms por columna visible
  productDistance: 130,     // px
  productAngle: 32,         // grados X
  productSideDistance: 70,  // px
  productSideAngle: 22,     // grados Y
  productBlur: 9,           // px
  parallax: true,
  parallaxAmount: 14        // px
};

const html = document.documentElement;
const motionOkay = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const query = (sel, root=document) => [...root.querySelectorAll(sel)];
const getMode = () => HOME_REVEAL_OPTIONS.enabled && motionOkay() && 'IntersectionObserver' in window;
let cleanup = () => {};

// Se añade antes de que site.js cree la página; nada parpadea antes de prepararse.
if (getMode()) html.classList.add('lfhr-enabled');

function splitTitle(h2) {
  if (h2.dataset.lfhrSplit === '1') return 0;
  const walker = document.createTreeWalker(h2, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  let index = 0;
  for (const node of textNodes) {
    const source = node.nodeValue || '';
    const tokens = source.match(/\s+|[^\s]+/g) || [];
    const fragment = document.createDocumentFragment();
    for (const token of tokens) {
      if (/^\s+$/.test(token)) {fragment.append(document.createTextNode(token));continue;}
      const mask = document.createElement('span');
      mask.className = 'lfhr-word-mask';
      const word = document.createElement('span');
      word.className = 'lfhr-word';
      word.textContent = token;
      word.style.setProperty('--lfhr-delay', `${index++ * HOME_REVEAL_OPTIONS.wordStagger}ms`);
      mask.append(word);
      fragment.append(mask);
    }
    node.replaceWith(fragment);
  }
  h2.dataset.lfhrSplit = '1';
  return index;
}

function columnsInView(track, shells) {
  if (!shells.length) return 1;
  const style = getComputedStyle(track);
  if (style.display === 'flex') {
    const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 0;
    const width = shells[0].offsetWidth;
    return clamp(Math.floor((track.clientWidth + gap + 2) / Math.max(1,width+gap)),1,8);
  }
  const template = style.gridTemplateColumns;
  return clamp(template.split(' ').filter(Boolean).length || 3,1,8);
}

function makeShell(card, kind) {
  if (card.parentElement?.classList.contains('lfhr-shell')) return card.parentElement;
  const shell = document.createElement('div');
  shell.className = `lfhr-shell lfhr-${kind}-shell`;
  shell.dataset.lfhrState = 'pending';
  card.classList.remove('lf-reveal','lf10-scroll-card','lf10-visible','lf9-scroll-card','lf8-zoom-in','lf-filter-arrive');
  card.classList.add('lfhr-card-attached','lf-inview','visible');
  card.before(shell);
  shell.append(card);
  return shell;
}

/** Activación reutilizable de un elemento revelable. */
function controller(el, kind, options, onFinished) {
  let timer = 0;
  let animationEnds = null;
  const setState = state => {el.dataset.lfhrState=state;};
  const show = () => {
    if (el.dataset.lfhrState !== 'pending') return;
    setState('playing');
    // AnimationEvent para quitar will-change y conservar el hover normal.
    animationEnds = ev => {
      if (ev.target!==el || el.dataset.lfhrState!=='playing') return;
      clearTimeout(timer);
      el.removeEventListener('animationend',animationEnds);
      animationEnds=null;
      setState('shown');
      onFinished?.();
    };
    el.addEventListener('animationend',animationEnds);
    const extra = kind==='heading'?options.wordCount*HOME_REVEAL_OPTIONS.wordStagger:options.delay;
    const duration = kind==='heading'?HOME_REVEAL_OPTIONS.titleDuration:kind==='category'?HOME_REVEAL_OPTIONS.categoryDuration:HOME_REVEAL_OPTIONS.productDuration;
    timer=setTimeout(()=>{
      if(el.dataset.lfhrState==='playing'){
        if(animationEnds)el.removeEventListener('animationend',animationEnds);
        animationEnds=null;setState('shown');onFinished?.();
      }
    }, duration+extra+160);
  };
  const reset = () => {
    clearTimeout(timer);
    if(animationEnds)el.removeEventListener('animationend',animationEnds);
    animationEnds=null;
    if(el.dataset.lfhrState==='pending')return;
    setState('pending');
    // Reiniciar animación CSS incluso si regresa inmediatamente.
    void el.offsetWidth;
  };
  return {el,show,reset,destroy(){clearTimeout(timer);if(animationEnds)el.removeEventListener('animationend',animationEnds);}};
}

export function initReveal({ selector, settings = {} } = {}) {
  const root = document.querySelector(selector);
  if(!root || !getMode()) return {destroy(){},refresh(){}};
  const off=[];
  const active=new Map();
  const pictures=new Map();
  let observer=null, mutation=null, raf=0, resizeTimer=0;
  let destroyed=false;

  observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const ctrl=active.get(entry.target);
      if(!ctrl)continue;
      if(entry.isIntersecting)ctrl.show();
      else {
        const r=entry.boundingClientRect;
        if(r.top>innerHeight+60||r.bottom<-60)ctrl.reset();
      }
    }
  }, {rootMargin:`0px 0px -${HOME_REVEAL_OPTIONS.triggerBottom * 100}% 0px`, threshold:HOME_REVEAL_OPTIONS.intersectionThreshold});
  // El observador se dispara al salir de su zona, antes de que el elemento
  // desaparezca completamente. Este control prepara la repetición en ambos sentidos.
  let exitFrame=0;
  const inspectExits=()=>{
    exitFrame=0;
    if(destroyed)return;
    for(const [el,ctrl] of active){
      if(el.dataset.lfhrState==='pending')continue;
      const r=el.getBoundingClientRect();
      if(r.top>innerHeight+70||r.bottom<-70)ctrl.reset();
    }
  };
  const requestExitCheck=()=>{if(!exitFrame)exitFrame=requestAnimationFrame(inspectExits);};
  window.addEventListener('scroll',requestExitCheck,{passive:true});
  off.push(()=>{window.removeEventListener('scroll',requestExitCheck);cancelAnimationFrame(exitFrame);});

  function register(el,kind,opts={}) {
    if(active.has(el))return;
    const item=controller(el,kind,opts);
    active.set(el,item);
    observer.observe(el);
  }

  root.style.setProperty('--lfhr-category-duration',`${HOME_REVEAL_OPTIONS.categoryDuration}ms`);
  root.style.setProperty('--lfhr-category-distance',`${HOME_REVEAL_OPTIONS.categoryDistance}px`);
  root.style.setProperty('--lfhr-category-angle',`${HOME_REVEAL_OPTIONS.categoryAngle}deg`);
  root.style.setProperty('--lfhr-category-blur',`${HOME_REVEAL_OPTIONS.categoryBlur}px`);
  root.style.setProperty('--lfhr-product-duration',`${HOME_REVEAL_OPTIONS.productDuration}ms`);
  root.style.setProperty('--lfhr-product-distance',`${HOME_REVEAL_OPTIONS.productDistance}px`);
  root.style.setProperty('--lfhr-product-angle',`${HOME_REVEAL_OPTIONS.productAngle}deg`);
  root.style.setProperty('--lfhr-product-blur',`${HOME_REVEAL_OPTIONS.productBlur}px`);
  const heading=root.querySelector('.section-heading');
  if(heading){
    heading.classList.add('lfhr-heading');
    heading.dataset.lfhrState='pending';
    const h2=heading.querySelector('h2');
    const count=h2?splitTitle(h2):0;
    if(h2 && !heading.querySelector('.lfhr-title-rule')){
      const line=document.createElement('span');
      line.className='lfhr-title-rule';line.setAttribute('aria-hidden','true');
      h2.after(line);
    }
    heading.style.setProperty('--lfhr-title-duration',`${HOME_REVEAL_OPTIONS.titleDuration}ms`);
    register(heading,'heading',{wordCount:count});
  }

  function setProductColumns(track,shells){
    const count=columnsInView(track,shells);
    shells.forEach((shell,i)=>{
      const col=i%count;
      const ratio=count===1?.5:col/(count-1);
      shell.style.setProperty('--lfhr-enter-x',`${((ratio*2-1)*HOME_REVEAL_OPTIONS.productSideDistance).toFixed(1)}px`);
      shell.style.setProperty('--lfhr-enter-y-rot',`${((1-2*ratio)*HOME_REVEAL_OPTIONS.productSideAngle).toFixed(1)}deg`);
      shell.style.setProperty('--lfhr-delay',`${col*HOME_REVEAL_OPTIONS.productStagger}ms`);
    });
  }

  function scan() {
    if(destroyed)return;
    for(const [el,item] of active){
      if(!el.isConnected){observer.unobserve(el);item.destroy();active.delete(el);}
    }
    for(const shell of pictures.keys())if(!shell.isConnected)pictures.delete(shell);
    if(root.dataset.lfHomeReveal==='categories'){
      const grid=root.querySelector('.category-grid');
      if(!grid)return;
      query(':scope > .category-tile',grid).forEach((tile)=>makeShell(tile,'category'));
      const shells=query(':scope > .lfhr-category-shell',grid);
      shells.forEach((shell,i)=>{
        shell.style.setProperty('--lfhr-delay',`${i*HOME_REVEAL_OPTIONS.categoryStagger}ms`);
        register(shell,'category',{delay:i*HOME_REVEAL_OPTIONS.categoryStagger});
      });
    } else if(root.dataset.lfHomeReveal==='featured') {
      // El título conserva su reveal; las tarjetas pasan a ProductReveal global.
      return;
    } else {
      const track=root.querySelector('.products-grid');
      if(!track)return;
      query(':scope > .product-card',track).forEach(card=>makeShell(card,'product'));
      const shells=query(':scope > .lfhr-product-shell',track);
      setProductColumns(track,shells);
      shells.forEach(shell=>{
        register(shell,'product',{delay:Number.parseInt(shell.style.getPropertyValue('--lfhr-delay')) || 0});
        const image=shell.querySelector('.product-image img');
        if(image && !pictures.has(shell)) pictures.set(shell,image);
      });
    }
  }

  scan();
  const track=root.querySelector('.category-grid, .products-grid');
  if(track){
    mutation=new MutationObserver(()=>{
      if(destroyed)return;
      const unwrapped=track.querySelector(':scope > .category-tile, :scope > .product-card');
      if(unwrapped)scan();
    });
    mutation.observe(track,{childList:true});
  }

  function updateParallax(){
    raf=0;
    if(!HOME_REVEAL_OPTIONS.parallax || innerWidth<768 || document.hidden)return;
    const center=innerHeight/2;
    // Sólo unas pocas fotografías próximas al viewport; ninguna lectura fuera de pantalla.
    for(const [shell,image] of pictures){
      if(!shell.isConnected)continue;
      const r=shell.getBoundingClientRect();
      if(r.bottom<-150 || r.top>innerHeight+150)continue;
      const amount=clamp((center-(r.top+r.height/2))/(innerHeight*.5),-1,1)*HOME_REVEAL_OPTIONS.parallaxAmount;
      image.style.setProperty('--lfhr-parallax',`${amount.toFixed(2)}px`);
    }
  }
  function scheduleParallax(){if(!raf)raf=requestAnimationFrame(updateParallax);}
  if(root.dataset.lfHomeReveal==='featured' && HOME_REVEAL_OPTIONS.parallax){
    window.addEventListener('scroll',scheduleParallax,{passive:true});
    window.addEventListener('resize',scheduleParallax,{passive:true});
    off.push(()=>window.removeEventListener('scroll',scheduleParallax),()=>window.removeEventListener('resize',scheduleParallax));
    if(track){track.addEventListener('scroll',scheduleParallax,{passive:true});off.push(()=>track.removeEventListener('scroll',scheduleParallax));}
    scheduleParallax();
  }
  const resize=()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      if(destroyed)return;
      scan();
      // Actualiza retrasos por columna cuando cambia la distribución.
    },100);
  };
  window.addEventListener('resize',resize,{passive:true});off.push(()=>window.removeEventListener('resize',resize));

  return {
    refresh:scan,
    destroy(){
      destroyed=true;clearTimeout(resizeTimer);cancelAnimationFrame(raf);
      observer?.disconnect();mutation?.disconnect();
      for(const stop of off)stop();
      for(const item of active.values())item.destroy();
      active.clear();pictures.clear();
    }
  };
}

export function initHomeReveal(){
  cleanup();
  cleanup=()=>{};
  if(!getMode()){
    html.classList.remove('lfhr-enabled');
    return;
  }
  html.classList.add('lfhr-enabled');
  try{
    const controllers=['categories','featured'].map(name=>initReveal({selector:`[data-lf-home-reveal="${name}"]`}));
    cleanup=()=>controllers.forEach(ctrl=>ctrl.destroy());
  }catch(error){
    html.classList.remove('lfhr-enabled');
    console.error('Animaciones de inicio desactivadas:',error);
  }
}
