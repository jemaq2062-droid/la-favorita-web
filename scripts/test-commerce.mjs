import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temp=await mkdtemp(join(tmpdir(),'favorita-v27-'));
process.env.COMMERCE_DATA_FILE=join(temp,'commerce.json');
const {CommerceStore,calculatePrintQuote,activeTimedOffer,displayOffer}=await import('../server/commerce.mjs');
try{
 const c=new CommerceStore();await c.init();
 const rates=await c.rates('sucursal-1');assert.equal(rates.copyBW,.15);assert.equal(rates.printBW,.20);
 const a=calculatePrintQuote({pages:20,copies:2,kind:'copy',color:'bw'},rates);assert.equal(a.total,6);assert.equal(a.faces,40);
 const b=calculatePrintQuote({pages:50,copies:2,kind:'copy',color:'bw'},rates);assert.equal(b.total,15);
 const bDiscount=calculatePrintQuote({pages:50,copies:2,kind:'copy',color:'bw'},{...rates,bulkDiscount:10});assert.equal(bDiscount.total,13.5);
 assert.throws(()=>calculatePrintQuote({pages:1,kind:'print',color:'color'},rates),/configuró/);
 await c.saveRates('sucursal-2',{copyBW:.18,printBW:.21});assert.equal((await c.rates('sucursal-2')).copyBW,.18);assert.equal((await c.rates('sucursal-1')).copyBW,.15);
 const start=new Date(Date.now()-60000).toISOString(),end=new Date(Date.now()+60000).toISOString();
 await c.putOffer({branchId:'sucursal-1',productId:'p1',salePrice:80,startAt:start,endAt:end,enabled:true});
 const offers=await c.listOffers();assert.equal(offers.length,1);assert(activeTimedOffer(offers[0]));
 const displayed=displayOffer({id:'p1',name:'Colores 72'},{price:100,stock:10,active:true},offers);assert.equal(displayed.price,80);assert.equal(displayed.compareAt,100);
 assert.equal(displayOffer({id:'p1'},{price:100},[{...offers[0],endAt:new Date(Date.now()-1).toISOString()}]).price,100);
 const q=await c.recordQuote({branchId:'sucursal-1',tier:'economica',inputType:'text',result:{total:80},lines:[{productId:'p1',name:'Colores 72',quantity:1,unitPrice:80,lineTotal:80}]});assert.equal(q.code,'LF-000001');
 assert.equal((await c.quotes())[0].lines[0].unitPrice,80);
 const again=new CommerceStore();await again.init();assert.equal((await again.quotes())[0].code,q.code);
 await again.deleteOffer('sucursal-1','p1');assert.equal((await again.listOffers()).length,0);
 console.log('OK comercio: tasas independientes, descuento por 100 caras, ofertas vigentes/vencidas, historial numerado y persistencia.');
}finally{await rm(temp,{recursive:true,force:true});}
