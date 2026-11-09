import {mountGatewayWater} from './gateway-water.js?v=15';
/* La Favorita · portada. Decoración y reveal, sin tocar API ni otras rutas. */
export const GATEWAY_FOCUS_OPTIONS = Object.freeze({
  // Los útiles flotantes ahora usan FLOATING_BACKGROUND_OPTIONS en floating-background.js.
  revealDuration: 470,
  wordDelay: 60,
  footerDelay: 70,
  disableReveals: false
});
const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let cleanup=()=>{};
function mountReveals(stage,footer){
 if(reduce()||GATEWAY_FOCUS_OPTIONS.disableReveals||!('IntersectionObserver' in window))return ()=>{};
 const parts=[stage.querySelector('.gateway-focus-intro'),stage.querySelector('.gateway-focus-showcase'),...footer.querySelectorAll('.gateway-footer-grid > div'),footer.querySelector('.gateway-footer-bottom')].filter(Boolean);
 stage.style.setProperty('--gateway-reveal-time',`${GATEWAY_FOCUS_OPTIONS.revealDuration}ms`);
 stage.style.setProperty('--gateway-word-delay',`${GATEWAY_FOCUS_OPTIONS.wordDelay}ms`);
 footer.style.setProperty('--gateway-footer-delay',`${GATEWAY_FOCUS_OPTIONS.footerDelay}ms`);
 stage.classList.add('gateway-focus-reveal-ready');footer.classList.add('gateway-focus-reveal-ready');
 // Solo animar al entrar por primera vez. Evita repintados y reflows al hacer scroll.
 const io=new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries){
   if(isIntersecting){target.classList.add('gateway-is-in');io.unobserve(target);}
  }
 },{rootMargin:'0px 0px -8% 0px',threshold:0.01});
 parts.forEach(p=>io.observe(p));
 return ()=>{io.disconnect();stage.classList.remove('gateway-focus-reveal-ready');footer.classList.remove('gateway-focus-reveal-ready');for(const key of ['--gateway-reveal-time','--gateway-word-delay'])stage.style.removeProperty(key);footer.style.removeProperty('--gateway-footer-delay');parts.forEach(p=>p.classList.remove('gateway-is-in'));};
}
export function mountGatewayFocus(){
 cleanup();cleanup=()=>{};
 const stage=document.querySelector('.gateway-focus-stage'),footer=document.querySelector('.gateway-focus-footer');
 if(!stage||!footer)return;
 // Cada controlador se inicia por separado para que una falla no rompa la portada.
 const tidy=[];
 for(const [name, start] of [['entrada',()=>mountReveals(stage,footer)],['agua',()=>mountGatewayWater(stage)]]){
   try{const dispose=start();if(typeof dispose==='function')tidy.push(dispose);}
   catch(error){console.error('[La Favorita: portada '+name+']',error);}
 }
 cleanup=()=>tidy.reverse().forEach(f=>{try{f();}catch(error){console.warn('Limpieza de portada:',error);}});
}
