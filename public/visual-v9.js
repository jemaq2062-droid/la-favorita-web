/* La Favorita V9. No depende de frameworks ni de la base de datos.
   Ajustes principales:
   - TRANSITION_MS: rapidez de la distorsión entre dos vistas
   - PRODUCT_ZOOM: tamaño inicial del producto al entrar por scroll
   - PRODUCT_SMOOTHING: suavidad con la que sigue el desplazamiento */
const TRANSITION_MS=960;
const PRODUCT_ZOOM=1.40;
const PRODUCT_SMOOTHING=.19;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const ease=t=>t*t*(3-2*t);
const lowPower=()=>matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.deviceMemory&&navigator.deviceMemory<3);

function shader(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;
}
function webglPair(canvas,front,back){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
 if(!gl)return null;
 const vertex=`attribute vec2 aPosition;varying vec2 vUv;
 void main(){vUv=(aPosition+1.0)*.5;gl_Position=vec4(aPosition,0.,1.);}`;
 const fragment=`precision mediump float;
 varying vec2 vUv;uniform sampler2D uA;uniform sampler2D uB;
 uniform vec2 uResolution;uniform vec2 uSizeA;uniform vec2 uSizeB;
 uniform vec2 uPointer;uniform float uProgress;uniform float uTime;
 vec2 cover(vec2 uv,vec2 size){float r=uResolution.x/uResolution.y;float ir=size.x/size.y;
 if(r>ir) uv.y=(uv.y-.5)*ir/r+.5;else uv.x=(uv.x-.5)*r/ir+.5;return uv;}
 void main(){
 vec2 uv=vUv;float p=clamp(uProgress,0.,1.);float active=sin(p*3.14159265);
 float ripple=sin(uv.y*24.+uTime*7.5+uPointer.x*5.)*.042+sin(uv.y*49.-uTime*4.2)*.012;
 vec2 displacement=vec2(ripple,cos(uv.x*24.-uTime*5.+uPointer.y*3.)*.021)*active;
 vec2 uvA=cover(uv+displacement,uSizeA),uvB=cover(uv-displacement,uSizeB);
 vec4 a=texture2D(uA,uvA),b=texture2D(uB,uvB);
 float w=smoothstep(-.19,.19,p-(1.-uv.x)+sin(uv.y*17.+uTime*3.)*.10*active);
 if(p<.001)w=0.;if(p>.999)w=1.;
 vec3 color=mix(a.rgb,b.rgb,w);
 color+=vec3(.055,.08,.08)*active*abs(displacement.x)*9.;
 gl_FragColor=vec4(color,1.);
 }`;
 const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const attr=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 function makeTexture(image,unit){
  const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
  return tex;
 }
 const textures=[makeTexture(front,0),makeTexture(back,1)];
 const uniform=name=>gl.getUniformLocation(program,name);
 gl.uniform1i(uniform('uA'),0);gl.uniform1i(uniform('uB'),1);
 gl.uniform2f(uniform('uSizeA'),front.width,front.height);gl.uniform2f(uniform('uSizeB'),back.width,back.height);
 const progressLoc=uniform('uProgress'),pointerLoc=uniform('uPointer'),timeLoc=uniform('uTime'),resolutionLoc=uniform('uResolution');
 let width=0,height=0;
 function draw(progress,pointer,time){
  const r=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
  if(w!==width||h!==height){width=w;height=h;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
  gl.useProgram(program);gl.uniform2f(resolutionLoc,width,height);gl.uniform1f(progressLoc,progress);
  gl.uniform2f(pointerLoc,pointer.x,pointer.y);gl.uniform1f(timeLoc,time*.001);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 return {draw,dispose(){textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);}};
}
function loadTexture(src){
 return new Promise((resolve,reject)=>{
  const img=new Image();img.crossOrigin='anonymous';img.decoding='async';
  img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se pudo cargar la fotografía para WebGL'));img.src=src;
 });
}
function mountBranchDistortion(allowMotion,finePointer){
 const off=[];
 const holders=[...document.querySelectorAll('[data-lf9-distortion]:not(.gateway-photo-water)')];
 if(!allowMotion||!finePointer||lowPower()||innerWidth<800)return ()=>{};
 for(const holder of holders){
  const canvas=holder.querySelector('.lf9-distortion-canvas');
  const before=holder.querySelector('.lf9-photo-front'),after=holder.querySelector('.lf9-photo-back');
  let glEffect=null,hovering=false,disposed=false,loading=false,p=0,target=0,from=0,raf=0,start=0,duration=TRANSITION_MS,pointer={x:.5,y:.5};
  const render=t=>{
   raf=0;if(!glEffect||disposed)return;
   const tProgress=clamp((t-start)/duration);
   p=from+(target-from)*ease(tProgress);
   if(tProgress>=1)p=target;
   glEffect.draw(p,pointer,t);
   if(tProgress<1)raf=requestAnimationFrame(render);
  };
  const frame=()=>{if(!raf&&glEffect&&!disposed)raf=requestAnimationFrame(render);};
  async function prepare(){
   if(glEffect||loading||disposed)return;loading=true;
   try{
    const [a,b]=await Promise.all([loadTexture(before.currentSrc||before.src),loadTexture(after.currentSrc||after.src)]);
    if(disposed)return;
    glEffect=webglPair(canvas,a,b);
    if(!glEffect)return;
    glEffect.draw(p,pointer,performance.now());holder.classList.add('lf9-webgl-ready');frame();
   }catch(_){holder.classList.remove('lf9-webgl-ready');}finally{loading=false;}
  }
  const transitionTo=value=>{from=p;target=value;start=performance.now();duration=Math.max(200,TRANSITION_MS*Math.abs(target-from));frame()};
  const enter=()=>{hovering=true;transitionTo(1);prepare().then(frame)};
  const leave=()=>{hovering=false;transitionTo(0)};
  const move=e=>{const r=holder.getBoundingClientRect();pointer={x:clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/r.height)};if(glEffect&&hovering)frame()};
  const lost=e=>{e.preventDefault();glEffect=null;holder.classList.remove('lf9-webgl-ready')};
  holder.addEventListener('pointerenter',enter);holder.addEventListener('pointerleave',leave);holder.addEventListener('pointermove',move,{passive:true});canvas.addEventListener('webglcontextlost',lost);
  off.push(()=>{disposed=true;cancelAnimationFrame(raf);holder.removeEventListener('pointerenter',enter);holder.removeEventListener('pointerleave',leave);holder.removeEventListener('pointermove',move);canvas.removeEventListener('webglcontextlost',lost);glEffect?.dispose();holder.classList.remove('lf9-webgl-ready')});
 }
 return ()=>off.forEach(f=>f());
}

let refreshProductScroll=()=>{};
export function refreshV9(root){
 if(root)for(const card of root.querySelectorAll('.product-card:not(.lfpr-card)')){card.classList.add('lf9-scroll-card');card.dataset.lf9Filter='1';card.style.setProperty('--lf9-scale','1');card.style.setProperty('--lf9-opacity','1')}
 refreshProductScroll();
}
function mountProductScroll(allowMotion){
 if(!allowMotion||!('requestAnimationFrame' in window))return ()=>{};
 let cards=[],raf=0;
 const setLook=(card,progress)=>{
   const eased=1-Math.pow(1-progress,3);
   card.style.setProperty('--lf9-scale',(PRODUCT_ZOOM-(PRODUCT_ZOOM-1)*eased).toFixed(3));
   card.style.setProperty('--lf9-opacity',(.48+.52*eased).toFixed(3));
   card.style.setProperty('--lf9-shift',`${((1-eased)*16).toFixed(1)}px`);
 };
 const initialProgress=card=>{
   const r=card.getBoundingClientRect();
   return clamp((innerHeight*.96-r.top)/(innerHeight*(.96-.27)));
 };
 const collect=()=>{
   cards=[...document.querySelectorAll('.product-card')];
   for(const card of cards){
     card.classList.add('lf9-scroll-card');
     const progress=card.dataset.lf9Filter==='1'?1:initialProgress(card);
     card.dataset.lf9Progress=String(progress);setLook(card,progress);
   }
 };
 const frame=t=>{
  raf=0;let animate=false;
  for(const card of cards){
   if(!card.isConnected)continue;
   const r=card.getBoundingClientRect();
   if(r.top>innerHeight+140||r.bottom<-140)continue;
   const start=innerHeight*.96,end=innerHeight*.27;
   let progress=clamp((start-r.top)/(start-end));
   if(card.dataset.lf9Filter==='1')progress=1;
   const prev=Number(card.dataset.lf9Progress||1);
   const next=Math.abs(prev-progress)<.002?progress:prev+(progress-prev)*PRODUCT_SMOOTHING;
   card.dataset.lf9Progress=String(next);
   setLook(card,next);
   if(Math.abs(next-progress)>.003)animate=true;
  }
  if(animate)raf=requestAnimationFrame(frame);
 };
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(frame)};
 const refresh=()=>{collect();schedule()};
 collect();schedule();refreshProductScroll=refresh;
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',refresh,{passive:true});window.addEventListener('lf9:refresh',refresh);
 return ()=>{window.removeEventListener('scroll',schedule);window.removeEventListener('resize',refresh);window.removeEventListener('lf9:refresh',refresh);cancelAnimationFrame(raf);refreshProductScroll=()=>{};};
}

export function mountV9({allowMotion,finePointer}){
 const off=[];
 off.push(mountBranchDistortion(allowMotion,finePointer));
 if(!document.documentElement.classList.contains('lf10-active'))off.push(mountProductScroll(allowMotion));
 const showroom=document.querySelector('[data-lf8-branch-showcase]');
 if(showroom && !document.documentElement.classList.contains('lf10-active')){
  showroom.classList.add('lf9-branch-showcase');
  const track=showroom.querySelector('[data-lf8-branch-track]');
  const branches=[...showroom.querySelectorAll('.branch-card')];
  const update=()=>{
   const index=branches.findIndex(b=>b.classList.contains('lf8-selected'));
   if(innerWidth>800 && branches.length>=2){
    track.style.gridTemplateColumns=branches.map((_,i)=>i===index?'1.33fr':'.89fr').join(' ');
    branches.forEach((b,i)=>b.style.setProperty('--lf9-relative',String(clamp(i-index,-1,1))));
   }else track.style.removeProperty('grid-template-columns');
  };
  update();
  const mo=new MutationObserver(update);
  for(const b of branches)mo.observe(b,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',update,{passive:true});
  off.push(()=>{mo.disconnect();window.removeEventListener('resize',update);track.style.removeProperty('grid-template-columns')});
 }
 return ()=>off.reverse().forEach(fn=>{try{fn()}catch{}});
}
