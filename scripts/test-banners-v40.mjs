import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveHeroPrice} from '../public/hero-pricing.js';

const independent={id:'arbol',title:'Árbol nevado 1.80 m',priceOverride:'180',compareAtOverride:'219.90',priceCaption:'Plástico nevado, sin adornos'};
const result=resolveHeroPrice(independent,[{id:'papel',price:0.30,name:'Papel seda verde navidad'}]);
assert.equal(result.primary,'S/ 180.00');
assert.equal(result.previous,'S/ 219.90');
assert.equal(result.source,'manual');
assert.equal(result.caption,'Plástico nevado, sin adornos');
assert.equal(result.discount,18);
const unrelated=resolveHeroPrice({title:'Árbol de Navidad',background:'navidad'},[{id:'papel',price:.30,name:'Papel seda verde navidad'}]);
assert.equal(unrelated.hasNumericPrice,false,'Nunca presentar automáticamente el precio de otro producto');
assert.equal(unrelated.source,'none');
const linked=resolveHeroPrice({productId:'p1'},[{id:'p1',price:34,compareAt:39,name:'Resaltadores'}]);
assert.equal(linked.primary,'S/ 34.00');
assert.equal(linked.source,'linked');
const embedded=resolveHeroPrice({price:22,compareAt:27},[]);
assert.equal(embedded.primary,'S/ 22.00');
assert.equal(embedded.previous,'S/ 27.00');

const dir=await mkdtemp(join(tmpdir(),'lf-banner-v40-'));
try{
 process.env.COMMERCE_DATA_FILE=join(dir,'commerce.json');
 const {CommerceStore}=await import('../server/commerce.mjs');
 const store=new CommerceStore();await store.init();
 const now=Date.parse('2026-11-09T20:00:00.000Z');
 await store.putSlide('sucursal-1',{...independent,enabled:true,expiresAt:new Date(now+3600000).toISOString(),gradientStart:'#164535',gradientMid:'#7d2936',gradientEnd:'#184b3c',priceCardColor:'#cf344a',secondaryCardColor:'#f5c867',showPriceCard:true,showSecondaryCard:false,showFeatures:false,showCountdown:true,extraCards:[{title:'Altura',detail:'1.80 m',enabled:true},{title:'Material',detail:'Plástico nevado',enabled:false}]});
 let publicSlides=await store.slides('sucursal-1',{publicOnly:true,now});
 assert.ok(publicSlides.some(x=>x.id==='arbol'));
 publicSlides=await store.slides('sucursal-1',{publicOnly:true,now:now+3600000});
 assert.ok(!publicSlides.some(x=>x.id==='arbol'),'Ocultar banner expirado en el público');
 const adminSlides=await store.slides('sucursal-1');
 assert.equal(adminSlides.find(x=>x.id==='arbol').priceOverride,'180');
 assert.equal(adminSlides.find(x=>x.id==='arbol').extraCards.length,2);
 assert.ok(adminSlides.find(x=>x.id==='arbol'),'Mantener expirado en admin para editar');
 assert.ok(!(await store.slides('sucursal-2')).some(x=>x.id==='arbol'));
}finally{await rm(dir,{recursive:true,force:true});}
const site=await readFile(new URL('../public/site.js',import.meta.url),'utf8');
const admin=await readFile(new URL('../admin/admin.js',import.meta.url),'utf8');
const server=await readFile(new URL('../server/index.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
for(const field of ['priceOverride','compareAtOverride','expiresAt','extraCards','showPriceCard','showSecondaryCard','showFeatures','gradientStart','gradientMid','gradientEnd','priceCardColor','secondaryCardColor']){
 assert.ok(admin.includes(field),`Campo editable ${field}`);
 assert.ok(server.includes(field),`Campo guardado ${field}`);
}
assert.match(site,/data-bh-expires-at/);
assert.match(site,/bh-custom-card/);
assert.match(css,/--bh-grad-start/);
assert.match(css,/--bh-ticket-side/);
assert.match(css,/bh-expiration/);
console.log('OK V40: precios comerciales independientes, paletas, tarjetas editables, caducidad sin eliminar historial y sucursales aisladas.');
