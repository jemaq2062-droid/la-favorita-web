import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tmp=await mkdtemp(join(tmpdir(),'laf-v44-'));
const port=34844,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATABASE_URL:'',DATA_FILE:join(tmp,'data.json'),COMMERCE_DATA_FILE:join(tmp,'commerce.json'),INITIAL_CATALOG_FILE:'data/seed.json',ADMIN_PASSWORD:'v44-local-test'},stdio:['ignore','pipe','pipe']});
let errors='';child.stderr.on('data',v=>errors+=v);
const fetchJSON=async(path,opts={})=>{const res=await fetch(base+path,opts);return {res,body:await res.json()};};
try{
 let ready=false;
 for(let n=0;n<80;n++){try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,100));}
 assert(ready,`El servidor no inició: ${errors}`);
 const image=await fetch(base+'/assets/editorial/ambiente-navidad-v44.webp');
 assert.equal(image.status,200,'La imagen ambiental debe estar disponible');
 assert.match(image.headers.get('content-type'),/image\/webp/);
 for(const key of ['navidad','escolar','color','regalos','halloween']){
  const f=join(root,`public/assets/editorial/ambiente-${key}-v44.webp`);
  assert((await stat(f)).size>5000,`No se creó el ambiente ${key}`);
 }
 const login=await fetchJSON('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'v44-local-test'})});
 assert.equal(login.res.status,200);
 const headers={cookie:login.res.headers.get('set-cookie').split(';')[0],'content-type':'application/json'};
 const payload={branchId:'sucursal-1',title:'Banner de prueba',eyebrow:'TEMPORADA',description:'Imagen ambiental independiente',cta:'Explorar',destination:'catalogo',imageUrl:'/assets/editorial/arbol-navidad-sin-fondo.png',accent:'#c95d9c',background:'navidad',enabled:true,backgroundImageEnabled:true,backgroundImageUrl:'/assets/editorial/ambiente-navidad-v44.webp',backgroundImageOpacity:0.65,backgroundImagePosition:'right'};
 let response=await fetchJSON('/api/admin/hero-slides',{method:'POST',headers,body:JSON.stringify(payload)});
 assert.equal(response.res.status,201,JSON.stringify(response.body));
 const id=response.body.item.id;
 assert.equal(response.body.item.backgroundImageOpacity,.65);
 let store=await fetchJSON('/api/store/sucursal-1');
 let actual=store.body.heroSlides.find(x=>x.id===id);
 assert(actual&&actual.backgroundImageUrl.includes('ambiente-navidad'),'La imagen no llegó a la web');
 response=await fetchJSON('/api/admin/hero-slides/'+id,{method:'PATCH',headers,body:JSON.stringify({...payload,backgroundImageEnabled:false,backgroundImagePosition:'left',backgroundImageOpacity:.2})});
 assert.equal(response.res.status,200);
 store=await fetchJSON('/api/store/sucursal-1');
 actual=store.body.heroSlides.find(x=>x.id===id);
 assert.equal(actual.backgroundImageEnabled,false);
 assert.equal(actual.backgroundImagePosition,'left');
 assert.equal(actual.backgroundImageOpacity,.2);
 const unaffected=await fetchJSON('/api/store/sucursal-2');
 assert(!unaffected.body.heroSlides.some(x=>x.id===id),'La edición no debe afectar otra sucursal');
 const bad=await fetchJSON('/api/admin/hero-slides/'+id,{method:'PATCH',headers,body:JSON.stringify({...payload,backgroundImageUrl:'javascript:alert(1)'})});
 assert.equal(bad.res.status,400,'El servidor debe rechazar URLs inseguras');
 response=await fetchJSON('/api/admin/hero-slides/'+id,{method:'DELETE',headers,body:JSON.stringify({branchId:'sucursal-1'})});
 assert.equal(response.res.status,200);
 const css=await readFile(join(root,'public/styles.css'),'utf8');
 const js=await readFile(join(root,'public/site.js'),'utf8');
 const admin=await readFile(join(root,'admin/admin.js'),'utf8');
 assert(css.includes('bh-scene-backdrop')&&js.includes('heroSceneBackdrop'),'La imagen debe existir dentro del carrusel');
 assert(admin.includes('backgroundImageOpacity')&&admin.includes('choose-hero-backdrop'),'Faltan controles en el administrador');
 assert(css.includes('repeat(5,minmax(0,1fr))!important'),'El catálogo debe disponer de 5 columnas en escritorio');
 assert(css.includes('#catalog-products-grid')&&css.includes('max-width:none!important'),'El catálogo no debe quedar limitado a 1200px');
 console.log('OK V44: fondo temático servido, edición protegida, sucursales aisladas, validación de URL y catálogo ancho de cinco columnas.');
}finally{
 child.kill('SIGTERM');
 await new Promise(ok=>setTimeout(ok,200));
 await rm(tmp,{recursive:true,force:true});
}
