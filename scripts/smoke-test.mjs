/** Pruebas HTTP reales sin bibliotecas externas. No modifican la base del proyecto. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const tmp=await mkdtemp(join(tmpdir(),'favorita-test-'));
const port=33997,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server/index.mjs'],{cwd:resolve(dirname(fileURLToPath(import.meta.url)),'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_FILE:join(tmp,'state.json'),COMMERCE_DATA_FILE:join(tmp,'commerce.json'),ADMIN_PASSWORD:'test-password-very-secret',DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
let log='';child.stderr.on('data',x=>log+=x);
async function get(url,opts={}){const r=await fetch(base+url,opts);const content=r.headers.get('content-type')||'';const data=content.includes('json')?await r.json():await r.text();return {r,data};}
try{
 let connected=false;for(let i=0;i<45;i++){await new Promise(r=>setTimeout(r,100));try{const x=await get('/api/health');if(x.r.ok){connected=true;break;}}catch{}}
 assert(connected,'El servidor no pudo iniciar: '+log);
 let x=await get('/api/bootstrap');assert.equal(x.data.branches.length,4);assert.equal(x.data.categories.length,8);
 x=await get('/api/store/sucursal-1');assert.equal(x.data.products.length,50);assert(x.data.products.some(p=>p.name.includes('Silicona')));
 x=await get('/api/compare/sucursal-1');assert.equal(x.r.status,200);assert(x.data.groups.some(g=>g.id==='plumones-escolares-x12'&&g.count>=3));
 x=await get('/api/price-check/prod-0049');assert.equal(x.r.status,404,'No se publican precios cruzados entre sucursales');
 x=await get('/api/ai/status');assert.equal(x.r.status,200);assert.equal(x.data.configured,false);
 for(const tier of ['economica','equilibrada','calidad']){
  x=await get('/api/school-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({branchId:'sucursal-1',tier,text:'1 plumones escolares x12\n1 silicona líquida 250 ml\n1 corros pun escarchado'})});
  assert.equal(x.r.status,200);assert.equal(x.data.includedCount,2);assert.equal(x.data.missing.length+x.data.unrecognized.length,1);assert(x.data.unrecognized[0].includes('corros pun'));assert(x.data.total>0);assert.equal(x.data.complete,false);assert(!('_used' in x.data),'API pública no debe revelar líneas de precio');
 }
 x=await get('/api/school-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({branchId:'sucursal-1',tier:'economica',file:{filename:'x.pdf',mimeType:'application/pdf',base64:'JVBERi0x'}})});assert.equal(x.r.status,503);
 x=await get('/tienda/sucursal-1/comparar');assert.equal(x.r.status,200);assert(x.data.includes('site.js'));
 x=await get('/tienda/sucursal-1/cotizar');assert.equal(x.r.status,200);
 x=await get('/tienda/sucursal-1/producto/prod-0017');assert.equal(x.r.status,200);
 x=await get('/styles.css');assert.equal(x.r.status,200);assert(x.data.includes('.lf-scroll-story'));
 x=await get('/experience-v7.js');assert.equal(x.r.status,200);assert(x.data.includes('getContext(\'webgl\','));
 x=await get('/');assert.equal(x.r.status,200);assert(x.data.includes('styles.css'));
 // V8: los recursos nuevos se sirven sin alterar la ruta ni la configuración del servidor.
 x=await get('/styles.css');assert(x.data.includes('lf8-branch-track')&&x.data.includes('lf8-product-track'));
 x=await get('/experience-v7.js');assert(x.data.includes('mountV8Extras')&&x.data.includes('data-lf8-product-carousel'));
 x=await get('/site.js');assert(x.data.includes('data-lf8-branch-showcase')&&x.data.includes('data-lf8-product-carousel'));
 x=await get('/assets/floating/pencil.svg');assert.equal(x.r.status,200);assert(x.data.includes('<svg'));
 x=await get('/assets/floating/notebook.svg');assert.equal(x.r.status,200);assert(x.data.includes('<svg'));
 // V9: archivos visuales servidos y fotos alternas por sucursal.
 x=await get('/styles.css');assert.equal(x.r.status,200);assert(x.data.includes('lf9-photo-swap'));
 x=await get('/visual-v9.js');assert.equal(x.r.status,200);assert(x.data.includes('webglPair'));
 x=await get('/assets/branches/sucursal-1-interior.webp');assert.equal(x.r.status,200);

 x=await get('/api/admin/state');assert.equal(x.r.status,401);
 x=await get('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'test-password-very-secret'})});assert.equal(x.r.status,200);
 const cookie=x.r.headers.get('set-cookie').split(';')[0];const auth={'cookie':cookie,'content-type':'application/json'};
 x=await get('/api/admin/state',{headers:auth});assert.equal(x.data.products.length,50);
 x=await get('/api/admin/aliases',{method:'POST',headers:auth,body:JSON.stringify({aliasText:'lapiséro',canonicalTerm:'lapicero',status:'approved'})});assert.equal(x.r.status,200);
 x=await get('/api/admin/state',{headers:auth});assert(x.data.lexicon.some(a=>a.aliasKey==='lapisero'&&a.status==='approved'));
 x=await get('/api/admin/aliases/lapisero',{method:'DELETE',headers:auth});assert.equal(x.r.status,200);
 x=await get('/api/admin/state',{headers:auth});
 let original=x.data.offers.find(o=>o.branchId==='sucursal-2'&&o.productId==='prod-0001');
 x=await get('/api/admin/offers/sucursal-2/prod-0001',{method:'PUT',headers:auth,body:JSON.stringify({...original,price:37.8,stock:29})});assert.equal(x.r.status,200);
 x=await get('/api/store/sucursal-2');const p=x.data.products.find(p=>p.id==='prod-0001');assert.equal(p.price,37.8);assert.equal(p.stock,29);
 x=await get('/api/store/sucursal-1');assert.notEqual(x.data.products.find(p=>p.id==='prod-0001').price,37.8);
 x=await get('/api/admin/branches/sucursal-1',{method:'PATCH',headers:auth,body:JSON.stringify({name:'Sucursal Renombrada',photoUrl:'https://example.com/tienda.jpg',photoUrl2:'https://example.com/tienda-interior.jpg',address:'Av. de prueba 123',hours:'08:00 a 20:00'})});assert.equal(x.r.status,200);
 x=await get('/api/bootstrap');assert.equal(x.data.branches[0].name,'Sucursal Renombrada');assert.equal(x.data.branches[0].photoUrl,'https://example.com/tienda.jpg');assert.equal(x.data.branches[0].photoUrl2,'https://example.com/tienda-interior.jpg');assert.equal(x.data.branches[0].hours,'08:00 a 20:00');
 x=await get('/api/admin/settings',{method:'PATCH',headers:auth,body:JSON.stringify({announcement:'Novedad de prueba'})});assert.equal(x.r.status,200);
 x=await get('/api/bootstrap');assert.equal(x.data.settings.announcement,'Novedad de prueba');
 x=await get('/api/admin/products',{method:'POST',headers:auth,body:JSON.stringify({name:'Producto agregado por test',sku:'TEST-NUEVO',brand:'Artesco',categoryId:'escritura'})});assert.equal(x.r.status,201);const pid=x.data.item.id;
 x=await get('/api/store/sucursal-4');assert(!x.data.products.some(p=>p.id===pid),'Nuevo artículo se crea sin publicar');
 x=await get(`/api/admin/offers/sucursal-4/${pid}`,{method:'PUT',headers:auth,body:JSON.stringify({price:15,stock:40,minStock:10,active:true})});assert.equal(x.r.status,200);
 x=await get('/api/store/sucursal-4');assert(x.data.products.some(p=>p.id===pid),'Artículo publicado en una sola sucursal');
 x=await get('/api/store/sucursal-1');assert(!x.data.products.some(p=>p.id===pid),'No se publica en sucursales distintas');
 x=await get(`/api/admin/products/${pid}/visibility`,{method:'POST',headers:auth,body:JSON.stringify({active:false})});assert.equal(x.r.status,200);
 x=await get('/api/store/sucursal-4');assert(!x.data.products.some(p=>p.id===pid),'Ocultar conserva datos');
 x=await get(`/api/admin/products/${pid}/visibility`,{method:'POST',headers:auth,body:JSON.stringify({active:true})});assert.equal(x.r.status,200);
 x=await get('/api/store/sucursal-4');assert(x.data.products.some(p=>p.id===pid),'Reactivar muestra el artículo');
 x=await get('/api/admin/products',{method:'POST',headers:auth,body:JSON.stringify({name:'Enmicado A3',categoryId:'servicios',brand:''})});assert.equal(x.r.status,201);const serviceId=x.data.item.id;assert(x.data.item.isService);assert(x.data.item.sku.startsWith('SRV-ENM-'));
 x=await get(`/api/admin/offers/sucursal-1/${serviceId}`,{method:'PUT',headers:auth,body:JSON.stringify({price:4.5,stock:90,active:true})});assert.equal(x.r.status,200);
 x=await get('/api/store/sucursal-1');const svc=x.data.products.find(p=>p.id===serviceId);assert(svc?.isService);assert.equal(svc.stock,0);assert.equal(svc.price,4.5);
 x=await get('/api/store/sucursal-2');assert(!x.data.products.some(p=>p.id===serviceId));
 x=await get('/api/admin/campaigns',{method:'POST',headers:auth,body:JSON.stringify({title:'Novedad',eyebrow:'TEMPORADA',startDay:'01-01',endDay:'12-31',branches:['all']})});assert.equal(x.r.status,200);
 x=await get('/api/store/sucursal-1');assert(x.data.campaigns.some(c=>c.title==='Novedad'));
 x=await get('/api/admin/sections',{method:'PUT',headers:auth,body:JSON.stringify({sections:(await get('/api/admin/state',{headers:auth})).data.sections.reverse()})});assert.equal(x.r.status,200);
 x=await get('/api/store/sucursal-1');assert.equal(x.data.sections[0].id,'catalogo');
 // V10: alta y retiro no destructivo, con recálculo por número de sucursales.
 x=await get('/styles.css');assert.equal(x.r.status,200);assert(x.data.includes('lf10-cylinder'));
 x=await get('/motion-v10.js');assert.equal(x.r.status,200);assert(x.data.includes('mountCylinder'));
 x=await get('/api/admin/branches',{method:'POST',headers:auth,body:JSON.stringify({name:'Sucursal nueva',address:'Av. Nueva 123',hours:'8:00 a 18:00'})});assert.equal(x.r.status,201);const newBranchId=x.data.item.id;
 x=await get('/api/bootstrap');assert.equal(x.data.branches.length,5);
 x=await get('/api/admin/state',{headers:auth});assert.equal(x.data.offers.filter(o=>o.branchId===newBranchId).length,x.data.products.length);
 x=await get(`/api/admin/branches/${newBranchId}`,{method:'PATCH',headers:auth,body:JSON.stringify({active:false})});assert.equal(x.r.status,200);
 x=await get('/api/bootstrap');assert.equal(x.data.branches.length,4);
 x=await get('/api/admin/state',{headers:auth});assert(x.data.branches.find(b=>b.id===newBranchId)); // Datos conservados
 x=await get(`/api/admin/branches/${newBranchId}`,{method:'PATCH',headers:auth,body:JSON.stringify({active:true})});assert.equal(x.r.status,200);
 x=await get('/api/bootstrap');assert.equal(x.data.branches.length,5);
 x=await get(`/api/admin/branches/${newBranchId}`,{method:'PATCH',headers:auth,body:JSON.stringify({active:false})});assert.equal(x.r.status,200);
 for(const bid of ['sucursal-4','sucursal-3','sucursal-2']){x=await get(`/api/admin/branches/${bid}`,{method:'PATCH',headers:auth,body:JSON.stringify({active:false})});assert.equal(x.r.status,200);}
 x=await get('/api/bootstrap');assert.equal(x.data.branches.length,1);
 x=await get('/api/admin/branches/sucursal-1',{method:'PATCH',headers:auth,body:JSON.stringify({active:false})});assert.equal(x.r.status,400);
 x=await get('/api/auth/logout',{method:'POST',headers:auth});assert.equal(x.r.status,200);
 x=await get('/api/admin/state',{headers:auth});assert.equal(x.r.status,401);
 console.log('OK: navegación, campañas, precios independientes, publicar/ocultar productos, servicios sin stock, administrador, cotizador y comparador.');
}finally{child.kill('SIGTERM');await rm(tmp,{recursive:true,force:true});}
