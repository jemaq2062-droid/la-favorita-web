/* Portada La Favorita · V14
   Transición líquida real sobre canvas 2D. Un solo controlador para las cuatro tarjetas.
   Funciona al pasar el cursor y automáticamente sobre la tarjeta seleccionada.
   No modifica navegación, fotos, datos ni la posición del carrusel. */
import {GATEWAY_DATA,gatewayBranchStatus} from './gateway-data.js';

export const GATEWAY_WATER_OPTIONS = Object.freeze({
  duration: 1420,
  firstPreviewDelay: 1650,
  repeatPreviewDelay: 7600,
  interiorHold: 1900,
  waveIntensity: 42,
  disabled: false
});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const prefersReduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountGatewayWater(section){
  if(!section)return ()=>{};
  const cards=[...section.querySelectorAll('.branch-card')];
  const controllers=[];
  const cleanups=[];
  let destroyed=false;
  let previewTimer=0,returnTimer=0;
  const cancelTimers=()=>{clearTimeout(previewTimer);clearTimeout(returnTimer);previewTimer=0;returnTimer=0;};
  const canPlay=()=>!destroyed&&!GATEWAY_WATER_OPTIONS.disabled&&!prefersReduced()&&!document.hidden;

  for(const host of section.querySelectorAll('.gateway-photo-water[data-has-interior="1"]')){
    const front=host.querySelector('.lf9-photo-front');
    const back=host.querySelector('.lf9-photo-back');
    const card=host.closest('.branch-card');
    const label=host.querySelector('.gateway-view-label');
    const toggle=host.querySelector('.gateway-water-toggle');
    if(!front||!back||!card)continue;

    const canvas=document.createElement('canvas');
    canvas.className='gateway-water-canvas';
    canvas.setAttribute('aria-hidden','true');
    host.append(canvas);
    const ctx=canvas.getContext('2d',{alpha:true});
    const frames=[document.createElement('canvas'),document.createElement('canvas')];
    let progress=0,request=0,stamp=0,from=0,to=0,hovered=false,manual=false,ready=false,alive=true;
    let width=0,height=0,playing=false;
    const focus=()=>card.classList.contains('lf10-focus');
    const paintLabel=()=>{
      if(label)label.textContent=progress>.55?'Interior':'Exterior';
      if(toggle){toggle.innerHTML=progress>.55?'Ver exterior <span aria-hidden="true">↔</span>':'Ver interior <span aria-hidden="true">↔</span>';toggle.setAttribute('aria-pressed',String(progress>.55));toggle.setAttribute('aria-label',progress>.55?'Ver exterior de la sucursal':'Ver interior de la sucursal');}
    };
    const cover=(target,img)=>{
      const c=target.getContext('2d',{alpha:false});
      c.clearRect(0,0,width,height);
      const iw=img.naturalWidth,ih=img.naturalHeight;
      const scale=Math.max(width/iw,height/ih);
      const dw=iw*scale,dh=ih*scale;
      c.drawImage(img,(width-dw)/2,(height-dh)/2,dw,dh);
    };
    function measure(){
      if(!alive)return;
      const rect=host.getBoundingClientRect();
      const w=Math.max(1,Math.round(rect.width));
      const h=Math.max(1,Math.round(rect.height));
      if(!w||!h||w===width&&h===height&&ready)return;
      width=w;height=h;
      // La resolución se limita para que la distorsión no ralentice la portada.
      const ratio=Math.min(1,1080/Math.max(w,h));
      width=Math.max(1,Math.round(w*ratio));height=Math.max(1,Math.round(h*ratio));
      canvas.width=width;canvas.height=height;
      frames.forEach(f=>{f.width=width;f.height=height;});
      ready=front.complete&&front.naturalWidth>0&&back.complete&&back.naturalWidth>0;
      if(ready){try{cover(frames[0],front);cover(frames[1],back);}catch{ready=false;}}
    }
    function draw(p,time){
      if(!ctx||!ready)return false;
      const sw=Math.max(5,Math.round(height/(innerWidth<750?46:70)));
      const agitation=Math.sin(Math.PI*clamp(p));
      const amplitude=GATEWAY_WATER_OPTIONS.waveIntensity*agitation*(width/850);
      const a=frames[0],b=frames[1];
      ctx.clearRect(0,0,width,height);
      for(let y=0;y<height;y+=sw){
        const h=Math.min(sw+1,height-y);
        const motion=(Math.sin(y*.026+time*.014)+Math.sin(y*.077-time*.022)*.42)*amplitude;
        const edge=clamp(width*p+motion,0,width);
        // Desplazamiento de ondas horizontales en ambas fotografías.
        const shift=Math.sin(y*.048+time*.011)*amplitude*.43;
        ctx.drawImage(a,0,y,width,h,-10+shift,y,width+20,h);
        if(edge>0){
          ctx.save();ctx.beginPath();ctx.rect(0,y,edge,h);ctx.clip();
          ctx.drawImage(b,0,y,width,h,-10-shift*.55,y,width+20,h);
          ctx.restore();
        }
      }
      // Rastro luminoso de la onda que separa la vista exterior e interior.
      if(amplitude>1.4&&p>.025&&p<.975){
        ctx.save();ctx.beginPath();
        for(let y=0;y<=height;y+=5){
          const x=width*p+(Math.sin(y*.026+time*.014)+Math.sin(y*.077-time*.022)*.42)*amplitude;
          y===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.shadowColor='rgba(55,226,240,.85)';ctx.shadowBlur=22;
        ctx.strokeStyle='rgba(190,251,255,.62)';ctx.lineWidth=Math.max(2,width/350);
        ctx.stroke();ctx.restore();
      }
      return true;
    }
    const clearAnimation=()=>{cancelAnimationFrame(request);request=0;playing=false;host.classList.remove('is-water-active');};
    const applyStatic=()=>{host.style.setProperty('--gw-interior-opacity',String(progress));paintLabel();};
    function moveTo(value){
      value=clamp(value);
      measure();
      if(Math.abs(value-to)<.001&&(playing||Math.abs(progress-value)<.005))return;
      cancelAnimationFrame(request);request=0;
      to=value;
      if(!canPlay()||!ready||!ctx){
        progress=to;applyStatic();clearAnimation();return;
      }
      from=progress;stamp=performance.now();playing=true;
      host.classList.add('is-water-active');
      draw(progress,stamp);
      const step=time=>{
        request=0;if(!alive||destroyed)return;
        const t=clamp((time-stamp)/GATEWAY_WATER_OPTIONS.duration);
        progress=from+(to-from)*ease(t);
        applyStatic();draw(progress,time);
        if(t<1)request=requestAnimationFrame(step);
        else{progress=to;applyStatic();clearAnimation();}
      };
      request=requestAnimationFrame(step);
    }
    const enter=()=>{hovered=true;cancelTimers();if(focus())moveTo(1);};
    const leave=()=>{hovered=false;if(!manual)moveTo(0);schedulePreview(GATEWAY_WATER_OPTIONS.repeatPreviewDelay);};
    const onToggle=e=>{e.preventDefault();e.stopPropagation();if(!focus())return;manual=!(to>.5||progress>.55);cancelTimers();moveTo(manual?1:0);if(!manual)schedulePreview(GATEWAY_WATER_OPTIONS.repeatPreviewDelay);};
    toggle?.addEventListener('click',onToggle);
    const touch=event=>{
      if(!matchMedia('(hover:none)').matches||!focus())return;
      event.preventDefault();event.stopPropagation();
      cancelTimers();manual=!(to>.5||progress>.55);moveTo(manual?1:0);
    };
    host.addEventListener('pointerenter',enter);
    host.addEventListener('pointerleave',leave);
    host.addEventListener('click',touch);
    const onLoad=()=>{width=0;measure();};
    front.addEventListener('load',onLoad);back.addEventListener('load',onLoad);
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
    observer?.observe(host);
    measure();applyStatic();
    cleanups.push(()=>{
      alive=false;clearAnimation();observer?.disconnect();
      host.removeEventListener('pointerenter',enter);host.removeEventListener('pointerleave',leave);
      host.removeEventListener('click',touch);toggle?.removeEventListener('click',onToggle);front.removeEventListener('load',onLoad);back.removeEventListener('load',onLoad);
      host.style.removeProperty('--gw-interior-opacity');canvas.remove();
    });
    controllers.push({focus,get hovered(){return hovered||manual;},moveTo,reset:()=>{if(!focus()){hovered=false;manual=false;moveTo(0);}}});
  }
  const active=()=>controllers.find(x=>x.focus());
  function schedulePreview(delay){
    cancelTimers();
    if(!canPlay()||matchMedia('(hover:none)').matches)return;
    previewTimer=setTimeout(()=>{
      previewTimer=0;if(!canPlay())return;
      const current=active();
      if(current&&!current.hovered){
        current.moveTo(1);
        returnTimer=setTimeout(()=>{
          returnTimer=0;
          if(current.focus()&&!current.hovered)current.moveTo(0);
          schedulePreview(GATEWAY_WATER_OPTIONS.repeatPreviewDelay);
        },GATEWAY_WATER_OPTIONS.duration+GATEWAY_WATER_OPTIONS.interiorHold);
      }else schedulePreview(GATEWAY_WATER_OPTIONS.repeatPreviewDelay);
    },delay);
  }
  const onFocusChange=()=>{
    controllers.forEach(x=>x.reset());
    const chosen=active();
    if(chosen)schedulePreview(GATEWAY_WATER_OPTIONS.firstPreviewDelay);
  };
  const mo=new MutationObserver(onFocusChange);
  for(const card of cards)mo.observe(card,{attributes:true,attributeFilter:['class']});
  cleanups.push(()=>mo.disconnect());
  const visibility=()=>{if(document.hidden)cancelTimers();else schedulePreview(GATEWAY_WATER_OPTIONS.firstPreviewDelay);};
  document.addEventListener('visibilitychange',visibility);
  cleanups.push(()=>document.removeEventListener('visibilitychange',visibility));
  schedulePreview(GATEWAY_WATER_OPTIONS.firstPreviewDelay);

  // Mantener actualización del estado de apertura de la sucursal sin crear otro controlador.
  const refreshStatus=()=>{
    for(const el of section.querySelectorAll('[data-gateway-status]')){
      const branch=GATEWAY_DATA.branches[el.dataset.gatewayStatus];
      const info=gatewayBranchStatus({id:el.dataset.gatewayStatus,hoursByDay:branch?.hoursByDay});
      if(!info)continue;
      el.textContent=info.label;el.classList.toggle('is-open',info.open);el.classList.toggle('is-closed',!info.open);
    }
  };
  const statusTimer=setInterval(refreshStatus,60000);
  return ()=>{
    destroyed=true;cancelTimers();clearInterval(statusTimer);
    cleanups.reverse().forEach(f=>{try{f();}catch{}});
  };
}
