import { mountV9, refreshV9 } from "./visual-v9.js";
import { mountV10, refreshV10 } from "./motion-v10.js";

/* LA FAVORITA · Movimiento V7
   WebGL original, sin dependencias externas; no interviene en la API ni en los formularios. */
let release=()=>{};
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=()=>window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const lineOfSight=(el)=>{const r=el.getBoundingClientRect();return r.bottom>-100&&r.top<window.innerHeight+100;};

export function mountMotion(){
  release();
  document.documentElement.classList.add("lf10-active");
  const cleanups=[];
  const add=(fn)=>cleanups.push(fn);
  const allowMotion=!reduced();
  document.body.classList.toggle('lf-reduced',!allowMotion);
  document.body.classList.add('lf-motion-active');

  // Cada elemento sólo espera por su propia aparición. Nunca escondemos contenido
  // si el navegador no soporta IntersectionObserver.
  const candidates=[...document.querySelectorAll('.branch-card,.category-tile,.service-card,.section-heading,.quick-tool,.info-panel,.compare-table-wrap,.quote-form,.quote-output')]
    .filter(el=>!el.closest('[data-lf-home-reveal],.service-overview,.quick-tools,.lfpr-slot'));
  if(allowMotion&&'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        entry.target.classList.toggle('lf-inview',entry.isIntersecting);
      }
    },{rootMargin:'50px 0px 50px 0px',threshold:0});
    candidates.forEach((el,i)=>{
      el.classList.add('lf-reveal');
      el.style.setProperty('--lf-delay',`${Math.min(i%4,3)*65}ms`);
      observer.observe(el);
    });
    add(()=>observer.disconnect());
  }

  if(allowMotion&&fine()){
    document.querySelectorAll('.branch-card,.quick-tool').forEach(el=>{
      let raf=0;
      const move=e=>{
        const r=el.getBoundingClientRect();
        const x=clamp((e.clientX-r.left)/r.width),y=clamp((e.clientY-r.top)/r.height);
        cancelAnimationFrame(raf);
        raf=requestAnimationFrame(()=>{
          const force=el.classList.contains('branch-card')?5.6:3.2;
          el.style.setProperty('--lf-rotate-y',`${((x-.5)*force*2).toFixed(2)}deg`);
          el.style.setProperty('--lf-rotate-x',`${((.5-y)*force*2).toFixed(2)}deg`);
          el.style.setProperty('--lf-spot-x',`${(x*100).toFixed(0)}%`);
          el.style.setProperty('--lf-spot-y',`${(y*100).toFixed(0)}%`);
        });
      };
      const leave=()=>{cancelAnimationFrame(raf);el.style.removeProperty('--lf-rotate-x');el.style.removeProperty('--lf-rotate-y');};
      el.addEventListener('pointermove',move,{passive:true});el.addEventListener('pointerleave',leave);
      add(()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);cancelAnimationFrame(raf)});
    });
  }

  const story=document.querySelector('.lf-scroll-story');
  const banner=document.querySelector('.lf-cinematic-stage');
  if(allowMotion&&(story||banner)){
    let raf=0;
    const update=()=>{
      raf=0;
      if(story){
        const r=story.getBoundingClientRect();
        const travel=Math.max(1,r.height-window.innerHeight*.9);
        const progress=clamp((-r.top)/travel);
        story.style.setProperty('--lf-story-progress',progress.toFixed(4));
        const active=Math.min(2,Math.floor(progress*3));
        story.querySelectorAll('[data-lf-step]').forEach(el=>el.classList.toggle('lf-current',Number(el.dataset.lfStep)===active));
      }
      if(banner&&lineOfSight(banner)){
        const r=banner.getBoundingClientRect();
        const progress=clamp((window.innerHeight-r.top)/(window.innerHeight+r.height));
        banner.style.setProperty('--lf-stage-progress',progress.toFixed(4));
      }
    };
    const onScroll=()=>{if(!raf)raf=requestAnimationFrame(update)};
    window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll,{passive:true});update();
    add(()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);cancelAnimationFrame(raf)});
  } else if(story){story.querySelector('[data-lf-step="0"]')?.classList.add('lf-current');}

  if(allowMotion){
    const canvases=[...document.querySelectorAll('canvas[data-lf-scene]')];
    for(const canvas of canvases){
      try{const scene=create3DScene(canvas);if(scene)add(()=>scene.dispose());}
      catch(e){console.info('Modo visual simplificado:',e.message);}
    }
  }
  const moreEffects=mountV8Extras({allowMotion,finePointer:fine()});
  add(moreEffects);
  add(mountV9({allowMotion,finePointer:fine()}));
  add(mountV10({allowMotion,finePointer:fine()}));
  // ProductReveal controla ahora todas las entradas de productos.
  release=()=>{for(const fn of cleanups.reverse())try{fn()}catch{};};
}

export function refreshMotion(root){
  // Al aplicar filtros se crean tarjetas nuevas: deben verse inmediatamente,
  // aunque se cambien repetidamente los filtros.
  if(!root)return;
  root.querySelectorAll('.product-card:not(.lfpr-card)').forEach((el,i)=>{
    el.classList.remove('lf-reveal');el.classList.add('lf-filter-arrive');
    el.style.setProperty('--lf-delay',`${Math.min(i,7)*35}ms`);
  });
  // Los productos usan ProductReveal; el efecto antiguo de ellos no se vuelve a inicializar.
  if(!root.querySelector('.lfpr-slot')){refreshV9(root);refreshV10(root);}
  scrollCards?.refresh();
}

function create3DScene(canvas){
  const host=canvas.parentElement;
  const isGateway=canvas.dataset.lfScene==='gateway';
  const interactionSurface=isGateway?(document.querySelector('.gateway-v5-intro')||host):(host.closest('.campaign-stage')||host);
  // No sobrecargamos teléfonos modestos: un recurso SVG queda visible si se omite WebGL.
  if(window.innerWidth<560||navigator.deviceMemory&&navigator.deviceMemory<3)return null;
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:true,powerPreference:'low-power'});
  if(!gl)return null;
  const vertex=`attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
    uniform mat4 uProjection; uniform vec3 uRotation; uniform vec3 uOffset; uniform float uScale;
    varying vec3 vNormal; varying vec3 vColor; varying vec3 vWorld;
    vec3 turn(vec3 p,vec3 r){float cx=cos(r.x),sx=sin(r.x),cy=cos(r.y),sy=sin(r.y),cz=cos(r.z),sz=sin(r.z);
    p=vec3(p.x,cx*p.y-sx*p.z,sx*p.y+cx*p.z);
    p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);
    return vec3(cz*p.x-sz*p.y,sz*p.x+cz*p.y,p.z);}
    void main(){vec3 transformed=turn(aPosition*uScale,uRotation)+uOffset;vWorld=transformed;
    vNormal=normalize(turn(aNormal,uRotation));vColor=aColor;gl_Position=uProjection*vec4(transformed,1.0);}`;
  const fragment=`precision mediump float;varying vec3 vNormal; varying vec3 vColor; varying vec3 vWorld;
    void main(){vec3 n=normalize(vNormal);float light=max(dot(n,normalize(vec3(-.4,.8,.85))),0.0);
    float rim=pow(1.0-max(dot(n,normalize(vec3(-vWorld.x*.12,-vWorld.y*.12,1.0))),0.0),2.5);
    vec3 color=vColor*(.54+.55*light)+vec3(.24,.28,.34)*rim;
    gl_FragColor=vec4(color,1.0);}`;
  const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
  const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
  const locations={p:gl.getAttribLocation(program,'aPosition'),n:gl.getAttribLocation(program,'aNormal'),c:gl.getAttribLocation(program,'aColor'),projection:gl.getUniformLocation(program,'uProjection'),rotation:gl.getUniformLocation(program,'uRotation'),offset:gl.getUniformLocation(program,'uOffset'),scale:gl.getUniformLocation(program,'uScale')};
  const color=(hex)=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)].map(n=>n/255);
  const mesh=(build)=>{
    const out=[];
    const tri=(a,b,c,tint)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const mag=Math.hypot(nx,ny,nz)||1;nx/=mag;ny/=mag;nz/=mag;for(const p of [a,b,c])out.push(...p,nx,ny,nz,...tint);};
    const prism=(y1,y2,r1,r2,faces,tints)=>{
      for(let i=0;i<faces;i++){const a=2*Math.PI*i/faces,b=2*Math.PI*(i+1)/faces;
        const p1=[Math.cos(a)*r1,y1,Math.sin(a)*r1],p2=[Math.cos(b)*r1,y1,Math.sin(b)*r1],p3=[Math.cos(b)*r2,y2,Math.sin(b)*r2],p4=[Math.cos(a)*r2,y2,Math.sin(a)*r2];const tint=tints[i%tints.length];tri(p1,p2,p3,tint);tri(p1,p3,p4,tint);}
    };
    const quad=(a,b,c,d,tint)=>{tri(a,b,c,tint);tri(a,c,d,tint)};
    build({tri,prism,quad});
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.STATIC_DRAW);
    return {buffer,count:out.length/9};
  };
  const pencil=(hex)=>mesh(({prism})=>{
    const base=color(hex),lighter=base.map(c=>Math.min(1,c*1.16+.08)),darker=base.map(c=>c*.67);
    prism(-.98,.88,.12,.12,6,[base,lighter,base,darker,lighter,base]);
    prism(-1.2,-.98,0,.12,6,[[.69,.47,.28],[.83,.63,.39]]);
    prism(-1.26,-1.19,0,.045,6,[[.19,.24,.32]]);
    prism(.88,.98,.125,.125,10,[[.76,.8,.81],[.55,.67,.75]]);
    prism(.98,1.14,.11,.11,10,[[.98,.72,.77],[.91,.55,.65]]);
  });
  const book=mesh(({quad})=>{
    const a=color('#1fb5ba'),b=color('#84e5df'),sp=color('#174f65');
    const box=(x1,x2,y1,y2,z1,z2,fc,bc)=>{
      const A=[x1,y1,z1],B=[x2,y1,z1],C=[x2,y2,z1],D=[x1,y2,z1],E=[x1,y1,z2],F=[x2,y1,z2],G=[x2,y2,z2],H=[x1,y2,z2];
      quad(A,B,C,D,fc);quad(F,E,H,G,bc);quad(E,A,D,H,sp);quad(B,F,G,C,b);quad(D,C,G,H,sp);quad(E,F,B,A,sp);
    };
    box(-.65,.65,-.88,.88,-.075,.075,a,b);
    box(-.48,.48,-.7,.61,.079,.089,color('#f3e7d5'),color('#f3e7d5'));
    box(-.45,.45,.35,.42,.09,.1,color('#ed599b'),color('#ed599b'));
    box(-.45,.2,.12,.17,.091,.102,color('#247c91'),color('#247c91'));
  });
  const meshes=[pencil('#f04690'),pencil('#30bbbc'),pencil('#f5b95b'),pencil('#7d7dd9'),book];
  const projection=(w,h)=>{const f=1/Math.tan(Math.PI/6.5),a=w/h,near=.1,far=70;return new Float32Array([f/a,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,(2*far*near)/(near-far),0]);};
  let active=false,disposed=false,raf=0,clock=0,last=0,mx=0,my=0,cx=0,cy=0,pMatrix=projection(1,1);
  let visibility=true;
  const onPointer=e=>{const r=host.getBoundingClientRect();mx=clamp((e.clientX-r.left)/r.width,-1,2)*2-1;my=clamp((e.clientY-r.top)/r.height,-1,2)*2-1;};
  interactionSurface.addEventListener('pointermove',onPointer,{passive:true});
  const resize=()=>{const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const d=Math.min(window.devicePixelRatio||1,1.5);const w=Math.round(r.width*d),h=Math.round(r.height*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);pMatrix=projection(w,h);}};
  const draw=(t)=>{
    raf=0;if(disposed||!active||!visibility)return;
    const dt=Math.min(.04,(t-last)/1000||0);last=t;clock+=dt;
    cx+=(mx-cx)*.035;cy+=(my-cy)*.035;
    resize();gl.useProgram(program);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    gl.uniformMatrix4fv(locations.projection,false,pMatrix);
    const spin=clock*.26;
    const rect=interactionSurface.getBoundingClientRect();
    const scrollPhase=clamp((window.innerHeight-rect.top)/(window.innerHeight+Math.max(rect.height,1))); 
    const specs=isGateway?[
      [-1.25,.05,-5.2,.83,-.35,spin*.65,.28],[-.52,-.22,-4.8,.88,.18,-spin*.5,-.42],[.30,.1,-4.55,.78,-.08,spin*.6,.3],[1.15,-.18,-5.1,.85,.22,-spin*.65,-.36],[-.03,.08,-5.8,.72,-.2,spin*.23,.16]
    ]:[
      [-1.7,.1,-6.3,1.05,-.28,spin*.6,.38],[-.67,-.15,-5.7,1.12,.19,-spin*.52,-.37],[.43,.2,-5.2,1.0,-.15,spin*.5,.27],[1.6,-.06,-6.35,1.06,.29,-spin*.6,-.31],[.30,-.10,-7.4,1.7,-.08,spin*.23,.12]
    ];
    for(let i=0;i<meshes.length;i++){
      const m=meshes[i],s=specs[i],wave=Math.sin(clock*.7+i*1.3)*.09;
      gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);
      gl.enableVertexAttribArray(locations.p);gl.enableVertexAttribArray(locations.n);gl.enableVertexAttribArray(locations.c);
      gl.vertexAttribPointer(locations.p,3,gl.FLOAT,false,36,0);
      gl.vertexAttribPointer(locations.n,3,gl.FLOAT,false,36,12);
      gl.vertexAttribPointer(locations.c,3,gl.FLOAT,false,36,24);
      gl.uniform3f(locations.rotation,s[4]+cy*.12+Math.sin(clock*.4+i)*.07,s[5]+cx*.18+(scrollPhase-.5)*.38,s[6]+Math.sin(clock*.23+i)*.06);
      gl.uniform3f(locations.offset,s[0]+cx*.12+(scrollPhase-.5)*.11,s[1]+wave-cy*.1+(scrollPhase-.5)*.14,s[2]);
      gl.uniform1f(locations.scale,s[3]);
      gl.drawArrays(gl.TRIANGLES,0,m.count);
    }
    raf=requestAnimationFrame(draw);
  };
  const setActive=(yes)=>{active=yes;if(yes&&!raf){last=performance.now();raf=requestAnimationFrame(draw);}else if(!yes){cancelAnimationFrame(raf);raf=0;}};
  const observer=new IntersectionObserver(es=>{setActive(es.some(e=>e.isIntersecting));},{threshold:.02});observer.observe(host);
  const onVisibility=()=>{visibility=!document.hidden;if(visibility){if(active&&!raf)raf=requestAnimationFrame(draw);}else{cancelAnimationFrame(raf);raf=0;}};
  document.addEventListener('visibilitychange',onVisibility);
  const ro='ResizeObserver' in window?new ResizeObserver(resize):null;ro?.observe(canvas);
  const onLost=e=>{e.preventDefault();setActive(false);};canvas.addEventListener('webglcontextlost',onLost);
  host.classList.add('lf-webgl-ready');
  return {dispose(){disposed=true;setActive(false);observer.disconnect();ro?.disconnect();interactionSurface.removeEventListener('pointermove',onPointer);document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('webglcontextlost',onLost);meshes.forEach(m=>gl.deleteBuffer(m.buffer));gl.deleteProgram(program);}};
}


// Sólo manipula el DOM público. No modifica rutas, API, autenticación ni datos.
function mountV8Extras({allowMotion,finePointer}){
  const off=[];
  const on=(target,name,fn,options)=>{target.addEventListener(name,fn,options);off.push(()=>target.removeEventListener(name,fn,options));};
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const images=['pencil','notebook','ruler','highlighter','eraser','paperclip'];
  const targets=[
    ['.lf-cinematic-stage', ['notebook','pencil','highlighter']],
    ['.page-banner', ['pencil','eraser']],
    ['.quote-main', ['notebook','paperclip']],
    ['.lf-scroll-story', ['highlighter','ruler']],
    ['.preview-catalog', ['paperclip','eraser']]
  ];
  let fields=[];
  for(const [selector,assets] of targets){
    const host=$(selector);if(!host)continue;
    const layer=document.createElement('div');layer.className='lf8-float-field';layer.setAttribute('aria-hidden','true');
    for(const [i,id] of assets.entries()){
      if(!images.includes(id))continue;
      const holder=document.createElement('span');holder.className=`lf8-float lf8-float-${i+1}`;
      holder.dataset.lf8Depth=String(.55+i*.32);
      const img=document.createElement('img');img.src=`/assets/floating/${id}.svg`;img.alt='';img.loading='lazy';img.decoding='async';
      holder.appendChild(img);layer.appendChild(holder);
    }
    host.appendChild(layer);fields.push({host,layer});off.push(()=>layer.remove());
  }
  // La lente es un adorno de fondo; los botones y textos conservan los eventos normales.
  if(allowMotion){
    for(const selector of ['.lf-cinematic-stage','.quick-quote']){
      const host=$(selector);if(!host)continue;
      const fluid=document.createElement('div');fluid.className='lf8-liquid-layer';fluid.setAttribute('aria-hidden','true');
      fluid.innerHTML='<span class="lf8-liquid-glow"></span><span class="lf8-liquid-lens"></span>';
      host.appendChild(fluid);off.push(()=>fluid.remove());
      if(finePointer){const move=e=>{const r=host.getBoundingClientRect();host.style.setProperty('--lf8-liquid-x',`${((e.clientX-r.left)/r.width*100).toFixed(1)}%`);host.style.setProperty('--lf8-liquid-y',`${((e.clientY-r.top)/r.height*100).toFixed(1)}%`);};on(host,'pointermove',move,{passive:true});}
    }
  }
  const branchRoot=$('[data-lf8-branch-showcase]');
  if(branchRoot && !document.documentElement.classList.contains('lf10-active')){
    const track=$('[data-lf8-branch-track]',branchRoot),cards=$$('.branch-card',track),dots=$$('[data-lf8-branch-dot]',branchRoot),label=$('.lf8-position',branchRoot);
    let selected=0;
    function setSelected(index,scroll=false){
      if(!cards.length)return;
      selected=(index+cards.length)%cards.length;
      cards.forEach((card,i)=>card.classList.toggle('lf8-selected',i===selected));
      dots.forEach((dot,i)=>{dot.classList.toggle('is-selected',i===selected);dot.setAttribute('aria-pressed',String(i===selected));});
      if(label)label.textContent=`${String(selected+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
      if(scroll&&matchMedia('(max-width:800px)').matches)cards[selected].scrollIntoView({behavior:allowMotion?'smooth':'instant',inline:'center',block:'nearest'});
    }
    setSelected(0);
    on(branchRoot,'click',e=>{
      const control=e.target.closest('[data-lf8-move], [data-lf8-branch-dot]');if(!control)return;
      if(control.hasAttribute('data-lf8-move'))setSelected(selected+(control.dataset.lf8Move==='next'?1:-1),true);
      else setSelected(Number(control.dataset.lf8BranchDot)||0,true);
    });
    on(track,'scroll',()=>{
      if(!matchMedia('(max-width:800px)').matches)return;
      const candidates=cards.map((c,i)=>({i,dist:Math.abs(c.getBoundingClientRect().left-track.getBoundingClientRect().left)}));
      const nearest=candidates.sort((a,b)=>a.dist-b.dist)[0];if(nearest)setSelected(nearest.i);
    },{passive:true});
  }
  const productSliders=$$('[data-lf8-product-carousel]');
  for(const root of productSliders){
    const track=$('[data-lf8-product-track]',root),cards=$$('.product-card',track),label=$('.lf8-position',root);
    const update=()=>{
      if(!cards.length)return;
      const left=track.getBoundingClientRect().left;
      let nearest=0,min=Infinity;
      cards.forEach((card,i)=>{const d=Math.abs(card.getBoundingClientRect().left-left);if(d<min){nearest=i;min=d;}});
      label.textContent=`${String(nearest+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
    };
    on(root,'click',e=>{
      const button=e.target.closest('[data-lf8-slide]');if(!button)return;
      const step=(cards[0]?.getBoundingClientRect().width||250)+16;
      track.scrollBy({left:(button.dataset.lf8Slide==='next'?1:-1)*step,behavior:allowMotion?'smooth':'instant'});
    });
    on(track,'scroll',update,{passive:true});
    update();
  }
  // Zoom de entrada: el contenido nunca se esconde, incluso sin IntersectionObserver.
  const zoomTargets=$$('.product-card:not(.lfpr-card)');
  if(allowMotion && !document.documentElement.classList.contains('lf10-active') && 'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('lf8-zoom-in');observer.unobserve(entry.target);}}
    },{rootMargin:'0px 0px -20px 0px',threshold:.1});
    zoomTargets.forEach(el=>observer.observe(el));off.push(()=>observer.disconnect());
  }
  if(allowMotion){
    let raf=0,px=0,py=0,mouseX=0,mouseY=0;
    const update=()=>{
      raf=0;
      const mid=window.innerHeight/2;
      const pageHeight=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      document.documentElement.style.setProperty('--lf8-progress',`${Math.min(100,window.scrollY/pageHeight*100).toFixed(2)}%`);
      for(const {host,layer} of fields){
        const r=host.getBoundingClientRect();if(r.bottom<0||r.top>window.innerHeight)continue;
        const progress=Math.max(-1,Math.min(1,(mid-(r.top+r.height/2))/Math.max(window.innerHeight,r.height)));
        layer.style.setProperty('--lf8-scroll',`${(progress*28).toFixed(1)}px`);
        layer.style.setProperty('--lf8-mouse-x',`${(px*14).toFixed(1)}px`);
        layer.style.setProperty('--lf8-mouse-y',`${(py*10).toFixed(1)}px`);
      }
    };
    const frame=()=>{if(!raf)raf=requestAnimationFrame(update);};
    on(window,'scroll',frame,{passive:true});on(window,'resize',frame,{passive:true});
    if(finePointer){on(window,'pointermove',e=>{mouseX=(e.clientX/window.innerWidth-.5)*2;mouseY=(e.clientY/window.innerHeight-.5)*2;px=px*.68+mouseX*.32;py=py*.68+mouseY*.32;frame();},{passive:true});}
    frame();off.push(()=>cancelAnimationFrame(raf));
  }
  return ()=>{for(const stop of off.reverse())try{stop();}catch{}};
}
