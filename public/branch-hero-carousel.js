// Carrusel exclusivo del banner de Mi tienda. No interviene en la portada de cuatro sucursales.
let dispose=()=>{};
export function mountBranchHeroCarousel(){
 dispose();dispose=()=>{};
 const root=document.querySelector('[data-branch-hero]');
 if(!root)return;
 const slides=[...root.querySelectorAll('[data-bh-slide]')];
 if(!slides.length)return;
 const dots=[...root.querySelectorAll('[data-bh-index]')];
 const callbacks=[];
 const listen=(el,type,handler,opts)=>{el.addEventListener(type,handler,opts);callbacks.push(()=>el.removeEventListener(type,handler,opts));};
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let current=0,timer=null,hovered=false,focused=false,onscreen=true;
 const interval=Math.min(30000,Math.max(3000,Math.round(Number(root.dataset.bhInterval||6)*1000))); 
 function show(index){
  current=(index+slides.length)%slides.length;
  slides.forEach((el,i)=>{
   const active=i===current;
   el.classList.toggle('is-active',active);
   el.setAttribute('aria-hidden',String(!active));
   el.inert=!active;
  });
  dots.forEach((el,i)=>{el.classList.toggle('is-current',i===current);el.setAttribute('aria-pressed',String(i===current));});
  root.classList.toggle('is-product',slides[current].dataset.bhType!=='campaign');
 }
 function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
 function shouldPause(){return hovered||focused||document.hidden||!onscreen||reduce.matches||slides.length<2;}
 function start(){stop();if(shouldPause())return;timer=setInterval(()=>{if(!shouldPause())show(current+1);},interval);}
 for(const button of root.querySelectorAll('[data-bh-dir]'))listen(button,'click',event=>{event.preventDefault();show(current+Number(button.dataset.bhDir));start();});
 for(const dot of dots)listen(dot,'click',event=>{event.preventDefault();show(Number(dot.dataset.bhIndex));start();});
 const canHover=matchMedia('(hover: hover) and (pointer: fine)').matches;
 listen(root,'pointerenter',()=>{if(canHover){hovered=true;stop();}});
 listen(root,'pointerleave',()=>{if(canHover){hovered=false;start();}});
 listen(root,'focusin',()=>{focused=true;stop();});
 listen(root,'focusout',event=>{if(!root.contains(event.relatedTarget)){focused=false;start();}});
 listen(document,'visibilitychange',start);
 listen(reduce,'change',start);
 let downX=null;
 listen(root,'pointerdown',event=>{downX=event.target.closest('a,button')?null:event.clientX;},{passive:true});
 listen(root,'pointerup',event=>{if(downX===null)return;const dist=event.clientX-downX;downX=null;if(Math.abs(dist)>65){show(current+(dist<0?1:-1));start();}},{passive:true});
 listen(root,'pointercancel',()=>{downX=null;},{passive:true});
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{onscreen=entries[0]?.isIntersecting??false;start();},{threshold:0.08}):null;
 observer?.observe(root);
 show(0);start();
 dispose=()=>{stop();observer?.disconnect();callbacks.reverse().forEach(fn=>fn());};
}
