// Catálogo: comparaciones seguras y cálculo de cotizaciones.
// Toda decisión de precio se toma en el servidor a partir de la sucursal elegida.
const fold = value => String(value ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();
const stop = new Set(['de','del','para','con','el','la','los','las','un','una','und','uds','unidad','unidades','caja','paquete','estuche','x','por']);
const tokens = s => fold(s).split(' ').filter(w=>w && !stop.has(w));
const overlaps = (a,b) => {const x=new Set(tokens(a)),y=new Set(tokens(b));return [...x].filter(t=>y.has(t)).length;};
const asMoney=n=>Math.round(n*100)/100;
export function groupFor(p){return String(p.comparisonGroup||'').trim().toLowerCase();}
export function optionsFor(state,branchId,group){
 const offers=new Map(state.offers.filter(o=>o.branchId===branchId&&o.active&&o.stock>0&&o.price>0).map(o=>[o.productId,o]));
 return state.products.filter(p=>p.active && groupFor(p)===String(group||'').trim().toLowerCase() && offers.has(p.id)).map(p=>({...p,...offers.get(p.id)}));
}
export function compareCatalog(state,branchId){
 const prices=state.offers.filter(o=>o.branchId===branchId&&o.active&&o.stock>0&&o.price>0);
 const set=new Set(prices.map(x=>x.productId));const groups=new Map();
 for(const p of state.products){const k=groupFor(p);if(!p.active||!k||!set.has(p.id))continue;const g=groups.get(k)||{id:k,title:p.comparisonLabel || k,products:[]};g.products.push(p);groups.set(k,g);}
 return [...groups.values()].filter(g=>g.products.length>1).map(g=>({id:g.id,title:g.title,count:g.products.length})).sort((a,b)=>a.title.localeCompare(b.title,'es'));
}
export function branchPrices(state,productId){
 return state.branches.filter(b=>b.active).map(b=>({branchId:b.id,branchName:b.name,...(state.offers.find(o=>o.branchId===b.id&&o.productId===productId)||{price:null,stock:0,active:false})}));
}
// Los sinonimos aprobados vienen de PostgreSQL (o de data/lexicon.json en modo local).
// Los terminos en revision nunca se sustituyen automaticamente.
const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function normalizeSchoolText(value,lexicon=[]){
 let s=fold(value);
 const approved=lexicon.filter(x=>x.status==='approved'&&!x.requiresReview)
   .sort((a,b)=>fold(b.aliasText).length-fold(a.aliasText).length);
 for(const item of approved){
   const key=fold(item.aliasText),canonical=fold(item.canonicalTerm);
   if(!key||key===canonical)continue;
   const regex=new RegExp('(^|\\s)'+escapeRegExp(key)+'(?=\\s|$)','g');
   s=s.replace(regex,(_,space)=>space+canonical);
 }
 // Unificar formas flexionadas seguras; no confundir atributos ni presentaciones.
 return s.replace(/\blapiceros\b/g,'lapicero')
   .replace(/\bazules\b/g,'azul').replace(/\brojos\b/g,'rojo')
   .replace(/\bnegros\b/g,'negro').replace(/\bverdes\b/g,'verde');
}
export function parseTypedList(text){
 return String(text||'').split(/[\n\r;]+/).map(row=>row.trim()).filter(Boolean).slice(0,100).map(row=>{
   // "4lapiceros", "4 lapiceros" y "4xlapiceros" significan cuatro articulos.
   const spaced=row.replace(/^(\d{1,3})\s*[x×]\s*(?=[a-záéíóúñ])/i,'$1 ')
     .replace(/^(\d{1,3})(?=[a-záéíóúñ])/i,'$1 ');
   const m=spaced.match(/^\s*(\d{1,3})\s*(?:x|×|und|unidades?|pzas?|pcs?)\s+(.+)$/i)
     || spaced.match(/^\s*(\d{1,3})\s+(.+)$/);
   // "250 ml silicona" describe una medida, no 250 frascos.
   const count=m && !/^(?:ml|l|g|kg|mm|cm|m)\b/i.test(m[2]) ? m:null;
   return {original:row,name:(count?count[2]:row).trim(),quantity:count?Math.max(1,Math.min(Number(count[1]),1000)):1,unclear:false};
 });
}
function needsReview(state,raw){
 const input=fold(raw);
 return (state.lexicon||[]).some(x=>x.status==='review' &&
   (input===fold(x.aliasText)||input.includes(' '+fold(x.aliasText)+' ')||input.startsWith(fold(x.aliasText)+' ')||input.endsWith(' '+fold(x.aliasText))));
}
function hasExplicitPack(s){return /\b(?:x\s*\d+|docena|decena|media\s*docena|\d+\s*(?:unidades|colores|piezas|hojas|ml|g|kg))\b/.test(s);}
function explicitCount(s){
 const x=s.match(/\bx\s*(\d+)\b/);if(x)return +x[1];
 if(/\bmedias?\s+docenas?\b|\b1\s*\/\s*2\s*docena\b/.test(s))return 6;
 if(/\bdocenas?\b/.test(s))return 12;
 if(/\bdecenas?\b/.test(s))return 10;
 return null;
}
function requestedSize(s){
 const m=s.match(/\b(\d+(?:[.,]\d+)?)\s*(g\s*\/\s*m(?:2|²)|ml|l|kg|g|cm|mm|m)\b/i);
 if(!m)return null;
 let n=Number(m[1].replace(',','.')),unit=m[2].replace(/\s+/g,'').toLowerCase().replace('²','2');
 if(unit==='l'){n*=1000;unit='ml';}else if(unit==='kg'){n*=1000;unit='g';}
 return {n,unit};
}
function mainKind(s,lexicon=[]){
 const n=normalizeSchoolText(s,lexicon);
 const types=[['plastilina',/\bplastilina\b/],['acuarela',/\bacuarelas?\b/],['tempera',/\btemperas?\b/],['plumon',/\bplumones?\b|\bmarcadores?\b/],['colores',/\bcolores\b|\blapices de color\b/],['cuaderno',/\bcuadernos?\b/],['silicona',/\bsilicona\b/],['papel',/\bpapel bond\b|\bhojas bond\b|\bresma\b/],['lapicero',/\blapiceros?\b|\bboligrafos?\b/],['lapiz',/\blapices?\b|\blapiz\b/],['borrador',/\bborradores?\b/],['resaltador',/\bresaltadores?\b/],['plástico',/\bmicroporoso\b/],['tijera',/\btijeras?\b/],['calculadora',/\bcalculadoras?\b/],['pegamento',/\bpegamentos?\b|\bgoma\b/]];
 return types.find(([,regex])=>regex.test(n))?.[0]||'';
}
function matchingCandidates(state,branchId,item){
 const lexicon=state.lexicon||[];
 const requested=normalizeSchoolText(item.name,lexicon); const offerMap=new Map(state.offers.filter(o=>o.branchId===branchId && o.active && o.stock>0 && o.price>0).map(o=>[o.productId,o]));
 const qty=explicitCount(requested);const wantsLooseSheets=/\bhoj(?:as?|itas?)\b/.test(requested)&&!/\b(?:paquete|caja|resma|block)\b/.test(requested);
 const words=tokens(requested);const kind=mainKind(item.name,lexicon);const results=[];
 const size=requestedSize(item.name);
 const brand=state.products.map(p=>fold(p.brand)).filter(Boolean).find(b=>requested.includes(b) && new RegExp('(?:^|\\s)'+escapeRegExp(b)+'(?=\\s|$)').test(requested));
 const colorWords=['azul','rojo','negro','verde','amarillo','blanco','rosado','morado','celeste'];
 const requestedColors=colorWords.filter(c=>new RegExp('(?:^|\\s)'+c+'(?=\\s|$)').test(requested));
 for(const p of state.products){const o=offerMap.get(p.id);if(!p.active||!o)continue;if(wantsLooseSheets && (Number(p.unitsPerPack||1)>1||/resma|paquete|caja|block/i.test(p.unitLabel||'')))continue;
   const hay=normalizeSchoolText([p.name,p.brand,p.model,p.searchAliases,p.comparisonLabel,p.description].join(' '),lexicon);
   if(kind && mainKind(p.name,lexicon)!==kind)continue;
   if(brand && fold(p.brand)!==brand)continue;
   if(requestedColors.length && !requestedColors.every(c=>new RegExp('(?:^|\\s)'+c+'(?=\\s|$)').test(normalizeSchoolText(p.name+' '+p.model,lexicon))))continue;
   if(size){
     const pSize=requestedSize(p.name+' '+p.model);
     const net=p.netContent!=null?requestedSize(String(p.netContent)+' '+String(p.netUnit||'')):null;
     if(!(pSize&&pSize.n===size.n&&pSize.unit===size.unit)&&!(net&&net.n===size.n&&net.unit===size.unit))continue;
   }
   const shared=overlaps(requested,hay);if(!shared)continue;
   // Respetar cantidades y formatos solicitados, sin intercambiar x12 con x6.
   if(qty!=null && Number(p.unitsPerPack||1)!==qty && !new RegExp(`\\bx\\s*${qty}\\b`).test(hay))continue;
   const mentionBrand=fold(p.brand);const hasBrand=requested.includes(mentionBrand);
   const exact=hay.includes(requested)||fold(p.name)===requested;
   const score= shared/Math.max(1,words.length) + (exact?0.65:0) + (hasBrand?0.35:0);
   if(score>=0.54 && (shared>=2 || words.length===1 && exact))results.push({p,o,score});
 }
 return results.sort((a,b)=>b.score-a.score||a.o.price-b.o.price);
}
function selection(candidates,tier,requested){
 const best=candidates[0].score;
 // Sólo comparar artículos de la misma clase; no sustituir un color o tamaño inequívoco.
 let similar=candidates.filter(c=>c.score>=best-0.28);
 const group=candidates[0].p.comparisonGroup;
 if(group){similar=similar.filter(c=>c.p.comparisonGroup===group);}
 const colorMatches=['rojo','azul','negro','verde','amarillo','rosado','blanco','morado','celeste'].filter(c=>requested.includes(c));
 if(colorMatches.length)similar=similar.filter(c=>colorMatches.some(color=>normalizeSchoolText(c.p.name).includes(color)));
 if(!similar.length)return null;
 similar.sort((a,b)=>a.o.price-b.o.price);
 if(tier==='economica')return similar[0];
 if(tier==='equilibrada')return similar[Math.floor((similar.length-1)/2)];
 const marked=similar.filter(c=>Number(c.p.qualityTier)===3);
 if(marked.length)return marked.sort((a,b)=>b.o.price-a.o.price)[0];
 return similar.at(-1); // estimación por precio; no garantiza calidad real
}
export function quoteFromItems(state,branchId,items,tier){
 if(!['economica','equilibrada','calidad'].includes(tier))throw new Error('Modalidad incorrecta');
 if(!state.branches.some(b=>b.id===branchId&&b.active))throw new Error('Sucursal desconocida');
 if(!Array.isArray(items)||items.length===0||items.length>100)throw new Error('La lista debe tener entre 1 y 100 artículos');
 const missing=[],unknown=[];let quoted=0;let total=0;const used=[];
 for(const raw of items){
  const item={name:String(raw.name||'').slice(0,170),original:String(raw.original||raw.name||'').slice(0,170),quantity:Math.min(1000,Math.max(1,Math.floor(Number(raw.quantity)||1))),unclear:!!raw.unclear};
  if(!item.name || item.unclear || needsReview(state,item.name)
    || (/\bcajas?\b/i.test(item.name)&&explicitCount(normalizeSchoolText(item.name,state.lexicon||[]))===null)){unknown.push(item.original||'Artículo ilegible');continue;}
  const list=matchingCandidates(state,branchId,item);if(!list.length){missing.push(item.original);continue;}
  const chosen=selection(list,tier,normalizeSchoolText(item.name,state.lexicon||[]));if(!chosen){missing.push(item.original);continue;}
  if(chosen.o.stock<item.quantity){missing.push(item.original);continue;}
  total+=chosen.o.price*item.quantity;quoted++;used.push({productId:chosen.p.id,quantity:item.quantity,price:chosen.o.price});
 }
 return {branchId,tier,total:asMoney(total),includedCount:quoted,totalCount:items.length,missing,unrecognized:unknown,complete:missing.length===0&&unknown.length===0,provisional:true,qualityNote:tier==='calidad'?'La categoría calidad depende de la clasificación del catálogo; un precio mayor no garantiza calidad.':'',_used:used};
}
export async function readSchoolListWithAI({mimeType,filename,base64}){
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw Object.assign(new Error('La lectura de imágenes/PDF necesita configurar OPENAI_API_KEY en el servidor. Puedes pegar la lista como texto mientras tanto.'),{status:503});
 const types=['image/jpeg','image/png','image/webp','application/pdf'];if(!types.includes(mimeType))throw new Error('Archivo no permitido. Usa PDF, JPG, PNG o WebP.');
 if(!/^[A-Za-z0-9+/=]+$/.test(base64||'') || base64.length>11_000_000)throw new Error('Archivo demasiado grande o inválido (máximo 8 MB).');
 const bytes=Buffer.from(base64,'base64');if(bytes.length>8*1024*1024)throw new Error('Máximo 8 MB por archivo');
 const isPdf=mimeType==='application/pdf';
 if(isPdf&&bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('El PDF no tiene una estructura válida');
 if(mimeType==='image/png'&&bytes.subarray(0,4).toString('hex')!=='89504e47')throw new Error('PNG inválido');
 if(mimeType==='image/jpeg'&&bytes.subarray(0,2).toString('hex')!=='ffd8')throw new Error('JPG inválido');
 if(mimeType==='image/webp'&&bytes.subarray(8,12).toString()!=='WEBP')throw new Error('WebP inválido');
 const fileData=`data:${mimeType};base64,${base64}`;
 const content=[{type:'input_text',text:'Transcribe esta lista de útiles escolares conservando los renglones originales, incluso palabras con faltas ortográficas. Extrae la cantidad por renglón. Si no se entiende un nombre o está ilegible, pon unclear=true. Nunca inventes productos ausentes. Si una línea contiene múltiples artículos, separa cada uno. Máximo 100 artículos.'},isPdf?{type:'input_file',filename:String(filename||'lista.pdf').slice(0,100),file_data:fileData,detail:'high'}:{type:'input_image',image_url:fileData,detail:'high'}];
 const schema={type:'object',additionalProperties:false,properties:{items:{type:'array',items:{type:'object',additionalProperties:false,properties:{original:{type:'string'},name:{type:'string'},quantity:{type:'integer'},unclear:{type:'boolean'}},required:['original','name','quantity','unclear']}}},required:['items']};
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),45000);
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:abort.signal,headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',store:false,input:[{role:'user',content}],text:{format:{type:'json_schema',name:'school_supply_list',strict:true,schema}}})});
  const output=await response.json();if(!response.ok)throw new Error('No se pudo analizar el archivo con IA. Revisa la clave, el crédito y el formato.');
  const raw=output.output_text||output.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  const parsed=JSON.parse(raw||'{}');if(!Array.isArray(parsed.items))throw new Error('La IA no devolvió una lista válida');
  return parsed.items.slice(0,100).map(i=>({original:String(i.original||''),name:String(i.name||'').trim(),quantity:Math.min(1000,Math.max(1,Number(i.quantity)||1)),unclear:!!i.unclear}));
 }finally{clearTimeout(timer);}
}
