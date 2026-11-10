import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(join(tmpdir(),'lafavorita-ui-'));
const port=34367;
const host=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATABASE_URL:'',DATA_FILE:join(temp,'local.json'),COMMERCE_DATA_FILE:join(temp,'commerce.json'),INITIAL_CATALOG_FILE:'data/seed.json',ADMIN_PASSWORD:'testing-ui-security'},stdio:['ignore','pipe','pipe']});
let errors='';child.stderr.on('data',data=>errors+=data);
const call=async(path,opts={})=>{const response=await fetch(host+path,opts);return {response,body:await response.json()};};
try{
 let ready=false;
 for(let i=0;i<55;i++){
  try{const response=await fetch(host+'/api/health');if(response.ok){ready=true;break;}}catch{}
  await new Promise(ok=>setTimeout(ok,100));
 }
 assert(ready,'El servidor no inició: '+errors);
 const login=await call('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'testing-ui-security'})});
 assert.equal(login.response.status,200);
 const headers={cookie:login.response.headers.get('set-cookie').split(';')[0],'content-type':'application/json'};
 const catalog=await call('/api/store/sucursal-1');assert.equal(catalog.body.products.length,50);
 const original=await call('/api/store/sucursal-2');assert.equal(original.body.heroSlides.length,4);
 const hero={branchId:'sucursal-1',title:'Una temporada especial',eyebrow:'CAMPAÑA',description:'Materiales seleccionados',cta:'Ver productos',destination:'catalogo',accent:'#b35ab1',background:'navidad',imageUrl:'/assets/editorial/arbol-navidad-sin-fondo.png',marqueeText:'NAVIDAD',featureList:'Decoración, Manualidades\nDetalles',productId:'',enabled:true};
 let response=await call('/api/admin/hero-slides',{method:'POST',headers,body:JSON.stringify(hero)});
 assert.equal(response.response.status,201);
 const id=response.body.item.id;
 assert.equal(response.body.item.marqueeText,'NAVIDAD');
 assert.deepEqual(response.body.item.featureList,['Decoración','Manualidades','Detalles']);
 let stored=await call('/api/store/sucursal-1');assert.equal(stored.body.heroSlides.length,5);
 assert.equal(stored.body.heroSlides.find(x=>x.id===id)?.marqueeText,'NAVIDAD');
 response=await call('/api/admin/hero-slides/'+id,{method:'PATCH',headers,body:JSON.stringify({...hero,marqueeText:'ESCOLAR',featureList:'Una, Dos',title:'Otro título'})});
 assert.equal(response.response.status,200);
 stored=await call('/api/store/sucursal-1');assert.equal(stored.body.heroSlides.find(x=>x.id===id)?.marqueeText,'ESCOLAR');
 assert.equal(stored.body.heroSlides.find(x=>x.id===id)?.featureList.length,2);
 const isolated=await call('/api/store/sucursal-2');assert.equal(isolated.body.heroSlides.length,4);
 response=await call('/api/admin/hero-slides/'+id,{method:'DELETE',headers,body:JSON.stringify({branchId:'sucursal-1'})});assert.equal(response.response.status,200);
 const publicJs=await readFile(join(root,'public/site.js'),'utf8');
 const css=await readFile(join(root,'public/styles.css'),'utf8');
 assert(publicJs.includes('data-action="compare-remove"'));
 assert(publicJs.includes('lf45-promo-hero'));
 assert(publicJs.includes('lf37-table-scroller'));
 assert(css.includes('.lf37-compare-tray'));
 assert(css.includes('@media(max-width:630px)'));
 console.log('OK V37: banners editables, sucursales aisladas, promoción y comparador móvil.');
}finally{
 child.kill('SIGTERM');
 await new Promise(ok=>setTimeout(ok,150));
 await rm(temp,{recursive:true,force:true});
}
