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
 let current=0,timer=null,expiryTimer=null,hovered=false,focused=false,onscreen=true;
 const interval=Math.min(30000,Math.max(3000,Math.round(Number(root.dataset.bhInterval||6)*1000))); 
 const available=i=>!slides[i].dataset.bhExpiresAt||Date.parse(slides[i].dataset.bhExpiresAt)>Date.now();
 const nextAvailable=(index)=>{for(let step=0;step<slides.length;step++){const n=((index+step)%slides.length+slides.length)%slides.length;if(available(n))return n;}return -1;};
 function show(index){
  const next=nextAvailable(index);if(next===-1)return;
  current=next;
  slides.forEach((el,i)=>{
   const active=i===current&&available(i);
   el.classList.toggle('is-active',active);
   el.setAttribute('aria-hidden',String(!active));
   el.inert=!active;
  });
  dots.forEach((el,i)=>{el.hidden=!available(i);el.classList.toggle('is-current',i===current);el.setAttribute('aria-pressed',String(i===current));});
  root.classList.toggle('is-product',slides[current].dataset.bhType!=='campaign');
 }
 function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
 function shouldPause(){return hovered||focused||document.hidden||!onscreen||reduce.matches||slides.filter((_,i)=>available(i)).length<2;}
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
 function refreshExpiration(){
  let expiredCurrent=false,remaining=0;
  slides.forEach((slide,i)=>{
   const date=Date.parse(slide.dataset.bhExpiresAt||'');
   if(!Number.isFinite(date))return;
   const left=date-Date.now();
   if(left<=0){slide.hidden=true;if(i===current)expiredCurrent=true;}
   else{
    remaining++;
    const d=Math.floor(left/86400000),h=Math.floor(left%86400000/3600000),m=Math.floor(left%3600000/60000),sec=Math.floor(left%60000/1000);
    slide.querySelectorAll('[data-bh-countdown]').forEach(el=>{el.textContent=`${d?d+'d ':''}${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;});
   }
  });
  if(!slides.some((_,i)=>available(i))){stop();location.reload();return;}
  if(expiredCurrent){show(current+1);start();}
  dots.forEach((dot,i)=>{dot.hidden=!available(i);});
  root.querySelectorAll('.bh-controls,.bh-side-control').forEach(el=>{el.hidden=slides.filter((_,i)=>available(i)).length<2;});
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{onscreen=entries[0]?.isIntersecting??false;start();},{threshold:0.08}):null;
 observer?.observe(root);
 show(0);refreshExpiration();expiryTimer=setInterval(refreshExpiration,1000);start();
 dispose=()=>{stop();if(expiryTimer!==null)clearInterval(expiryTimer);observer?.disconnect();callbacks.reverse().forEach(fn=>fn());};
}
