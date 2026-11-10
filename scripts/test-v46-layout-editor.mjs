import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(join(tmpdir(),'laf-v46-'));
const port=34946;
const origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATABASE_URL:'',DATA_FILE:join(temp,'state.json'),COMMERCE_DATA_FILE:join(temp,'commerce.json'),INITIAL_CATALOG_FILE:'data/seed.json',ADMIN_PASSWORD:'v46-test-secret'},stdio:['ignore','pipe','pipe']});
let error='';child.stderr.on('data',data=>error+=data);
const request=async(path,options={})=>{const res=await fetch(origin+path,options);return {status:res.status,data:await res.json()};};
try{
 let ready=false;
 for(let n=0;n<80;n++){
  try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert(ready,`No inició el servidor: ${error}`);
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'v46-test-secret'})});
 assert.equal(login.status,200);
 const headers={'content-type':'application/json',cookie:login.headers.get('set-cookie').split(';')[0]};
 const original=await request('/api/store/sucursal-1');
 const product=original.data.products.find(x=>Number(x.price)>0);
 assert(product,'No hay productos de prueba');
 const body={mode:'manual',productId:product.id,headline:'Novedades',description:'Hasta agotar stock',badge:'Promoción',gradientStart:'#57234a',gradientEnd:'#137d87',imageUrl:'',backgroundImageUrl:'/assets/editorial/ambiente-color-v44.webp',backgroundOpacity:.32,backgroundPosition:'right',ambientText:'OFERTAS',ambientColor:'#fce0a4'};
 const put=(payload)=>request('/api/admin/promo-spotlight/sucursal-1',{method:'PUT',headers,body:JSON.stringify(payload)});
 let result=await put(body);
 assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal(result.data.settings.backgroundOpacity,.32);
 assert.equal(result.data.settings.ambientColor,'#fce0a4');
 const shop=await request('/api/store/sucursal-1');
 assert.equal(shop.status,200);
 assert.equal(shop.data.promoSpotlight.backgroundImageUrl,body.backgroundImageUrl);
 assert.equal(shop.data.promoSpotlight.ambientText,'OFERTAS');
 assert.equal(shop.data.products.length,original.data.products.length);
 const other=await request('/api/store/sucursal-2');
 assert.notEqual(other.data.promoSpotlight.backgroundOpacity,.32);
 result=await put({...body,ambientColor:'orange'});assert.equal(result.status,400);
 result=await put({...body,backgroundImageUrl:'javascript:alert(1)'});assert.equal(result.status,400);
 result=await put({...body,backgroundOpacity:3});assert.equal(result.status,400);
 for(const asset of ['/styles.css','/site.js','/assets/editorial/ambiente-color-v44.webp']){
  const response=await fetch(origin+asset);assert.equal(response.status,200,asset);
 }
 const css=await readFile(join(root,'public/styles.css'),'utf8');
 const js=await readFile(join(root,'public/site.js'),'utf8');
 const admin=await readFile(join(root,'admin/admin.js'),'utf8');
 assert(css.includes('.lf46-promo-hero')&&css.includes('.lf42-featured-section .lf8-product-track>.lfpr-slot'));
 assert(js.includes('lf46-promo-backdrop')&&js.includes('lf46-offers-page'));
 assert(admin.includes('backgroundPosition')&&admin.includes('ambientColor'));
 console.log('OK V46: banner ancho, imagen y letras editables, validación de datos, 5 columnas y sucursales independientes.');
}finally{
 child.kill('SIGTERM');await new Promise(r=>setTimeout(r,160));await rm(temp,{recursive:true,force:true});
}
