import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const temp=await mkdtemp(join(tmpdir(),'lafavorita-v29-'));
process.env.COMMERCE_DATA_FILE=join(temp,'commerce.json');
const {CommerceStore,calculatePrintQuote}=await import('../server/commerce.mjs');
const store=new CommerceStore();
let child=null;
try{
 await store.init();
 const a=await store.rates('sucursal-1');
 assert.equal(a.scanPage,0);
 assert.throws(()=>calculatePrintQuote({kind:'scan',pages:12,scanFormat:'pdf'},a),/no configuró/);
 await store.saveRates('sucursal-1',{...a,scanPage:0.50});
 await store.saveRates('sucursal-2',{...a,scanPage:0.75});
 assert.equal((await store.rates('sucursal-1')).scanPage,.5);
 assert.equal((await store.rates('sucursal-2')).scanPage,.75);
 let q=calculatePrintQuote({kind:'scan',pages:12,scanFormat:'pdf'},await store.rates('sucursal-1'));
 assert.equal(q.total,6);assert.equal(q.sheets,0);assert.equal(q.faces,12);assert.equal(q.scanFormat,'pdf');
 q=calculatePrintQuote({kind:'scan',pages:120,scanFormat:'jpg'}, {...(await store.rates('sucursal-2')),bulkDiscount:10});
 assert.equal(q.total,81);assert.equal(q.scanFormat,'jpg');
 assert.equal(calculatePrintQuote({kind:'copy',pages:20,copies:2,color:'bw'},await store.rates('sucursal-1')).total,6);
 const file=await readFile(new URL('../public/site.js',import.meta.url),'utf8');
 assert(file.includes('function mountCatalogObserver(){disconnectCatalogObserver();}'));
 assert(file.includes("const CATALOG_BATCH_SIZE=24"));
 assert(!file.includes('if(entries.some(x=>x.isIntersecting))loadMoreCatalog()'));
 assert(file.includes("'catalogo','ofertas','novedades','especiales'"));
 const cwd=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const port=34029;
 child=spawn(process.execPath,['server/index.mjs'],{cwd,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_FILE:join(temp,'state.json'),ADMIN_PASSWORD:'test-v29-secret',DATABASE_URL:'',INITIAL_CATALOG_FILE:'data/seed.json'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',b=>errors+=b.toString());
 const url=`http://127.0.0.1:${port}`;
 let ready=false;
 for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));try{const h=await fetch(url+'/api/health');if(h.ok){ready=true;break;}}catch{}}
 assert(ready,'No inicia servidor: '+errors);
 let r=await fetch(url+'/api/print-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({branchId:'sucursal-1',kind:'scan',pages:12,scanFormat:'jpg'})});
 assert(r.ok,`Escaneo HTTP: ${r.status}`);let out=await r.json();assert.equal(out.total,6);assert.equal(out.scanFormat,'jpg');
 r=await fetch(url+'/api/print-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({branchId:'sucursal-2',kind:'scan',pages:12,scanFormat:'pdf'})});assert(r.ok);out=await r.json();assert.equal(out.total,9);
 console.log('OK catálogo y servicios: catálogo manual 24 por bloque, escaneos, costos por sucursal, descuentos y API.');
}finally{if(child){child.kill('SIGTERM');await new Promise(r=>setTimeout(r,200));}await rm(temp,{recursive:true,force:true});}
