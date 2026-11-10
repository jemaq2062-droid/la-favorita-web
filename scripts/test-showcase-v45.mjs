import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(join(tmpdir(),'laf-v45-'));
const port=34945,origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATABASE_URL:'',DATA_FILE:join(temp,'state.json'),COMMERCE_DATA_FILE:join(temp,'commerce.json'),INITIAL_CATALOG_FILE:'data/seed.json',ADMIN_PASSWORD:'showcase-test'},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',x=>stderr+=x);
async function api(path,options={}){const response=await fetch(origin+path,options);return {status:response.status,body:await response.json()};}
try{
 let ready=false;for(let n=0;n<70;n++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,120));}
 assert(ready,stderr);
 const initial=await api('/api/store/sucursal-1');const count=initial.body.products.length;
 assert.equal(initial.body.homeTiles,null);
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'showcase-test'})});assert.equal(login.status,200);
 const headers={'content-type':'application/json',cookie:login.headers.get('set-cookie').split(';')[0]};
 const put=(route,body)=>api(route,{method:'PUT',headers,body:JSON.stringify(body)});
 let r=await put('/api/admin/home-tiles/sucursal-1',{tiles:[{route:'categoria:escritura',label:'Escritura',caption:'317 productos',imageUrl:'/assets/categories/resaltadores.webp',enabled:true},{route:'especiales',label:'Temporadas',caption:'Navidad',imageUrl:'/assets/categories/navidad.webp',enabled:true}]});
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.tiles.length,2);
 r=await put('/api/admin/home-tiles/sucursal-1',{tiles:[{route:'javascript:alert(1)',label:'Malicia',imageUrl:'',enabled:true}]});assert.equal(r.status,400);
 const demoLogo='data:image/webp;base64,'+'a'.repeat(120);
 r=await put('/api/admin/brand-marquee/sucursal-1',{items:[{name:'Pilot',imageUrl:'/assets/categories/resaltadores.webp',enabled:true},{name:'Stabilo',imageUrl:demoLogo,enabled:true},{name:'Artesco',imageUrl:'',enabled:false}]});
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.items[1].imageUrl,demoLogo);
 r=await put('/api/admin/brand-marquee/sucursal-1',{items:[{name:'X',imageUrl:'javascript:alert(1)',enabled:true}]});assert.equal(r.status,400);
 const discountProducts=initial.body.products.filter(p=>p.compareAt>p.price);
 const selected=(discountProducts[0]||initial.body.products[0]);
 r=await put('/api/admin/promo-spotlight/sucursal-1',{mode:'manual',headline:'OFERTAS',description:'Solo hoy',badge:'Elegido',productId:selected.id,gradientStart:'#49114a',gradientEnd:'#148b8e',imageUrl:''});
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.settings.productId,selected.id);
 const store=await api('/api/store/sucursal-1');assert.equal(store.body.products.length,count);
 assert.equal(store.body.homeTiles.length,2);
 assert.equal(store.body.brandMarquee.length,3);
 assert.equal(store.body.promoSpotlight.mode,'manual');
 const other=await api('/api/store/sucursal-2');assert.equal(other.body.homeTiles,null);assert.equal(other.body.brandMarquee,null);assert.equal(other.body.promoSpotlight.mode,'max-discount');
 const admin=await api('/api/admin/commerce',{headers});assert.equal(admin.body.homeTiles['sucursal-1'].length,2);
 const js=await readFile(join(root,'public/site.js'),'utf8');const css=await readFile(join(root,'public/styles.css'),'utf8');const adminJs=await readFile(join(root,'admin/admin.js'),'utf8');
 assert(js.includes('lf45-promo-hero'));assert(js.includes('lf45-suggest-menu'));
 assert(css.includes('animation-play-state:running!important'));assert(css.includes('z-index:100'));assert(css.includes('repeat(var(--lf45-cat-count'));
 assert(adminJs.includes('showcase-brands-form')&&adminJs.includes('compressBrandLogo'));
 console.log('OK V45: buscador, categorías editables, marcas con logos, promoción elegible y aislamiento por sucursal.');
}finally{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,170));await rm(temp,{recursive:true,force:true});}
