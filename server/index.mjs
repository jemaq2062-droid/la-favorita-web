import http from 'node:http';
import { randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, normalize, resolve, sep, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import {CommerceStore,activeTimedOffer,displayOffer,calculatePrintQuote} from './commerce.mjs';
import { branchPrices, compareCatalog, parseTypedList, quoteFromItems, readSchoolListWithAI } from './catalog.mjs';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..');
const PUBLIC=join(ROOT,'public');
const ADMIN=join(ROOT,'admin');
const PORT=Number(process.env.PORT||3000);
const HOST=process.env.HOST||'127.0.0.1';
const PROD=process.env.NODE_ENV==='production';
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||(PROD?'':'libreria');
const COOKIE_SECURE=PROD||process.env.COOKIE_SECURE==='true';
const SAME_SITE=process.env.CROSS_SITE_ADMIN==='true'?'None':'Strict';
const TOKEN_SECRET=process.env.SESSION_SECRET||randomBytes(32).toString('hex');
const sessions=new Map();
const attempts=new Map();
const aiAttempts=new Map();
const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
let store=await createStore();
const commerce=new CommerceStore(store.pool||null);await commerce.init();
const branchSubscribers=new Set();
function broadcastBranches(){
  for(const subscriber of branchSubscribers){
    try{subscriber.write('event: branches\ndata: updated\n\n');}catch{branchSubscribers.delete(subscriber);}
  }
}


function send(res,status,data,headers={}){const body=typeof data==='string'?data:JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body);}
function bad(res,status,message){send(res,status,{error:message});}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).filter(x=>x.length>=2));}
function digest(v){return createHash('sha256').update(String(v)).digest();}
function sign(v){return createHmac('sha256',TOKEN_SECRET).update(v).digest('hex');}
function validSession(req){
  const raw=parseCookies(req).lf_session;if(!raw)return false;
  const [id,signature]=raw.split('.');if(!id||!signature)return false;
  const expected=sign(id);if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;
  const expires=sessions.get(id);if(!expires)return false;
  if(expires<Date.now()){sessions.delete(id);return false;}
  return true;
}
async function jsonBody(req,maxSize=400_000){
  if(!(req.headers['content-type']||'').startsWith('application/json'))throw new Error('Enviar JSON con Content-Type: application/json');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>maxSize)throw new Error('Solicitud demasiado grande');}
  try{return JSON.parse(body||'{}');}catch{throw new Error('JSON no válido');}
}
function originOkay(req){
  const origin=req.headers.origin;if(!origin)return true;
  const allowed=new Set([`http://${req.headers.host}`,`https://${req.headers.host}`]);
  if(process.env.APP_ORIGIN)allowed.add(process.env.APP_ORIGIN.replace(/\/$/,''));
  if(process.env.ADMIN_ORIGIN)allowed.add(process.env.ADMIN_ORIGIN.replace(/\/$/,''));
  return allowed.has(origin);
}
function fields(obj,keys){return Object.fromEntries(keys.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));}
function cleanStr(value,max=280){return String(value??'').trim().slice(0,max);}
function checkedColor(v){return /^#[a-f0-9]{6}$/i.test(v||'')?v:'#f026ad';}
function nextSku(state,categoryId,name){
  const c={escritura:'ESC',cuadernos:'CUA',papel:'PAP',oficina:'OFI',pegamentos:'PEG',arte:'ART',tecnologia:'TEC',servicios:'SRV'}[categoryId]||'PRO';
  const n=String(name||'').toUpperCase();
  const serviceRules=[[/COPIA/,'COP'],[/IMPRESI/,'IMP'],[/ANILL/,'ANI'],[/ENMIC/,'ENM'],[/ESCAN/,'ESC']];
  const productRules=[
    [/PLUMON|MARCADOR|RESALTADOR/,'PLU'],[/BOLIGRAF|LAPICER|LAPIZ|LÁPIZ|PORTAMINA/,'LAP'],
    [/BORRADOR|TAJADOR/,'BOR'],[/^CUAD(?:ERNO|\b|\.)|LIBRETA/,'CUA'],
    [/PAPEL.*(?:BOND|FOTOCOPIA|FOTOC)|BOND.*A-?4/,'BON'],[/CARTULINA|CARTON/,'CAR'],
    [/GOMA EVA|MICROPOROS/,'EVA'],[/PIONER|PIONNER|ARCHIVADOR|FOLDER|MICA|PORTADOCUM/,'ARC'],
    [/PEGAMENTO|SILICONA|GOMA.*LIQ|\bCOLA\b|GOMA EN BARRA/,'PEG'],[/CINTA/,'CIN'],
    [/TIJERA|CUTER|CORTADOR/,'COR'],[/PERFORADOR/,'PER'],[/ENGRAPAD|SACAGRAPA|GRAPA/,'ENG'],
    [/PLASTILINA/,'PLA'],[/PIZARRA/,'PIZ'],[/LIBRO|COQUITO/,'LIB'],[/PINCEL/,'PIN'],
    [/CALCULADORA/,'CAL'],[/PINTURA|TEMPERA|ACUARELA/,'PIN'],[/REGLA|ESCUADRA|TRANSPORTADOR/,'REG'],
    [/MEMORIA|USB|MOUSE|TECLADO/,'ACC'],[/PAPEL/,'PAP'],[/ESPIRAL|ANILL/,'ANI'],
    [/CORRECTOR/,'COR'],[/MOTA/,'MOT'],[/SEPARADOR/,'SEP']
  ];
  const rule=(categoryId==='servicios'?serviceRules:productRules).find(([re])=>re.test(n));
  const prefix=`${c}-${rule?rule[1]:'GEN'}-`;
  const used=new Set(state.products.map(x=>String(x.sku||'').toUpperCase()));
  let number=1,sku;do{sku=prefix+String(number++).padStart(5,'0');}while(used.has(sku));
  return sku;
}

function safeImage(v){let s=cleanStr(v,1800);if(!s)return '';if(/^\/assets\/(?:editorial|products)\/[a-z0-9_.-]+\.(?:png|webp|jpg|jpeg|svg)$/i.test(s))return s;try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function money(x){return Math.round(Number(x)*100)/100;}
function int(x,min=0,max=999999){let n=Number(x);if(!Number.isFinite(n))throw new Error('Número inválido');return Math.min(max,Math.max(min,Math.floor(n)));}
function isCurrent(c){
  if(!c.enabled)return false;
  const today=new Date();const md=`${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const start=c.startDay||'01-01',end=c.endDay||'12-31';
  return start<=end?md>=start&&md<=end:md>=start||md<=end;
}
function branchesForCampaign(c,b){return c.branches.includes('all')||c.branches.includes(b);}
function viewForBranch(state,id,timed=[]){
  const branch=state.branches.find(b=>b.id===id&&b.active);
  if(!branch)return null;
  const offers=new Map(state.offers.filter(o=>o.branchId===id&&o.active).map(o=>[o.productId,o]));
  return {version:state.version,settings:state.settings,lexicon:(state.lexicon||[]).filter(x=>x.status==='approved'&&!x.requiresReview).map(x=>({aliasText:x.aliasText,canonicalTerm:x.canonicalTerm})),branch,branches:state.branches.filter(b=>b.active).sort((a,b)=>a.order-b.order),categories:state.categories.slice().sort((a,b)=>a.order-b.order),sections:state.sections.filter(s=>s.enabled).sort((a,b)=>a.order-b.order),campaigns:state.campaigns.filter(c=>isCurrent(c)&&branchesForCampaign(c,id)).sort((a,b)=>a.priority-b.priority),campaignArchive:state.campaigns.filter(c=>branchesForCampaign(c,id)).map(c=>({...c,current:isCurrent(c)})),products:state.products.filter(p=>p.active&&offers.has(p.id)).map(p=>displayOffer(p,offers.get(p.id),timed)).sort((a,b)=>a.order-b.order)};
}
async function serveFile(res,base,path){
  let p=resolve(base,'.'+normalize('/'+path));
  if(!p.startsWith(base+sep)&&p!==base)return bad(res,403,'Acceso denegado');
  try{
    const f=await stat(p);if(!f.isFile())return bad(res,404,'No existe');
    const body=await readFile(p);
    res.writeHead(200,{'Content-Type':contentTypes[extname(p)]||'application/octet-stream','Cache-Control':['.html','.css','.js'].includes(extname(p))?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
    return res.end(body);
  }catch{return bad(res,404,'Archivo no encontrado');}
}
async function api(req,res,pathname){
  const method=req.method;
  if(method==='GET'&&pathname==='/api/branches/stream'){
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
    res.write('retry: 2500\n\n');branchSubscribers.add(res);
    const heartbeat=setInterval(()=>{try{res.write(': ping\n\n');}catch{branchSubscribers.delete(res);clearInterval(heartbeat);}},20000);
    req.on('close',()=>{clearInterval(heartbeat);branchSubscribers.delete(res);});return;
  }
  if(method==='GET'&&pathname==='/api/health')return send(res,200,{ok:true,mode:process.env.DATABASE_URL?'postgresql':'archivo-local'});
  if(method==='GET'&&pathname==='/api/ai/status')return send(res,200,{configured:!!process.env.OPENAI_API_KEY,maxFileMB:8,formats:['application/pdf','image/jpeg','image/png','image/webp']});
  if(method==='GET'&&pathname.startsWith('/api/commerce/active/')){const id=decodeURIComponent(pathname.slice('/api/commerce/active/'.length));const offers=(await commerce.listOffers()).filter(t=>t.branchId===id&&activeTimedOffer(t));return send(res,200,{branchId:id,items:offers.map(t=>({productId:t.productId,salePrice:t.salePrice,endAt:t.endAt}))});}
  if(method==='GET'&&pathname.startsWith('/api/public/rates/')){
    const branchId=decodeURIComponent(pathname.slice('/api/public/rates/'.length));const state=await store.read();if(!state.branches.some(b=>b.active&&b.id===branchId))return bad(res,404,'Sucursal no disponible');
    return send(res,200,{branchId,rates:await commerce.rates(branchId)});
  }
  if(method==='POST'&&pathname==='/api/print-quote'){
    if(!originOkay(req))return bad(res,403,'Origen no autorizado');
    const body=await jsonBody(req),state=await store.read();if(!state.branches.some(b=>b.active&&b.id===body.branchId))return bad(res,404,'Sucursal no disponible');
    const rates=await commerce.rates(body.branchId);const result=calculatePrintQuote(body,rates);
    return send(res,200,{...result,branchId:body.branchId,note:'Presupuesto calculado con las tarifas de la sucursal. Confirma el costo final en tienda.'});
  }
  if(method==='GET'&&pathname.startsWith('/api/compare/')){
    const branchId=decodeURIComponent(pathname.slice('/api/compare/'.length));const s=await store.read();
    if(!s.branches.some(b=>b.id===branchId&&b.active))return bad(res,404,'Sucursal no disponible');
    return send(res,200,{groups:compareCatalog(s,branchId)});
  }
  if(method==='POST'&&pathname==='/api/school-quote'){
    if(!originOkay(req))return bad(res,403,'Origen no autorizado');
    const max=11_500_000;const body=await jsonBody(req,max);
    const branchId=cleanStr(body.branchId,100);const tier=cleanStr(body.tier,30);
    const hasFile=!!body.file;
    if(hasFile){
      const ip=req.socket.remoteAddress||'local', a=aiAttempts.get(ip)||[];
      const current=a.filter(t=>t>Date.now()-10*60*1000);
      if(current.length>=6)return bad(res,429,'Límite de análisis de archivos: 6 cada 10 minutos.');
      current.push(Date.now());aiAttempts.set(ip,current);
    }
    const items=hasFile?await readSchoolListWithAI(body.file):Array.isArray(body.items)?body.items:parseTypedList(body.text||'');
    const s=await store.read();const timed=(await commerce.listOffers()).filter(t=>t.branchId===branchId&&activeTimedOffer(t));const effective=timed.length?{...s,offers:s.offers.map(o=>{const t=timed.find(t=>t.productId===o.productId&&o.branchId===branchId);return t&&o.active&&t.salePrice<o.price?{...o,price:t.salePrice}:o;})}:s;const result=quoteFromItems(effective,branchId,items,tier);
    const record={branchId,tier,inputType:hasFile?(body.file.mimeType==='application/pdf'?'pdf':'image'):'text',inputText:cleanStr(body.text||'',15000),requests:items.map(i=>({name:String(i.name||''),quantity:Number(i.quantity||1),original:String(i.original||'')})),result:{total:result.total,includedCount:result.includedCount,totalCount:result.totalCount,missing:result.missing,unrecognized:result.unrecognized,complete:result.complete},lines:result._used.map(u=>{const p=s.products.find(x=>x.id===u.productId);return {productId:u.productId,name:p?.name||'Producto',brand:p?.brand||'',sku:p?.sku||'',unitLabel:p?.unitLabel||'',quantity:u.quantity,unitPrice:u.price,lineTotal:Math.round(u.price*u.quantity*100)/100};})};
    const saved=await commerce.recordQuote(record);
    const {_used,qualityNote,provisional,...visible}=result;return send(res,200,{...visible,code:saved.code});
  }
  if(method==='GET'&&pathname==='/api/version'){const s=await store.read(),c=await commerce.config();return send(res,200,{version:`${s.version}-${c.revision||0}`});}
  if(method==='GET'&&pathname==='/api/bootstrap'){const s=await store.read(),c=await commerce.config();const branches=await Promise.all(s.branches.filter(b=>b.active).sort((a,b)=>a.order-b.order).map(async b=>({...b,cardStyle:await commerce.cardStyle(b.id)})));return send(res,200,{version:`${s.version}-${c.revision||0}`,settings:s.settings,branches,categories:s.categories});}
  if(method==='GET'&&pathname.startsWith('/api/store/')){const s=await store.read();const id=decodeURIComponent(pathname.slice('/api/store/'.length));const timed=(await commerce.listOffers()).filter(t=>t.branchId===id);const payload=viewForBranch(s,id,timed);return payload?send(res,200,{...payload,branchTheme:await commerce.theme(id),heroSlides:await commerce.slides(id),heroIntervalSeconds:await commerce.interval(id),quoteFeatures:{code:true}}):bad(res,404,'Sucursal no disponible');}
  if(method==='POST'&&pathname==='/api/auth/login'){
    const ip=req.socket.remoteAddress||'local';const old=attempts.get(ip)||{count:0,until:0};if(old.until>Date.now())return bad(res,429,'Demasiados intentos. Intenta más tarde.');
    if(!ADMIN_PASSWORD)return bad(res,503,'Configura ADMIN_PASSWORD en el servidor');
    const body=await jsonBody(req);
    const ok=timingSafeEqual(digest(body.password||''),digest(ADMIN_PASSWORD));
    if(!ok){const next=old.count+1;attempts.set(ip,{count:next,until:next>=7?Date.now()+15*60*1000:0});return bad(res,401,'Contraseña incorrecta');}
    attempts.delete(ip);
    const id=randomBytes(24).toString('hex');sessions.set(id,Date.now()+12*60*60*1000);
    return send(res,200,{ok:true},{'Set-Cookie':`lf_session=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=${SAME_SITE}; Max-Age=43200${COOKIE_SECURE?'; Secure':''}`});
  }
  if(method==='GET'&&pathname==='/api/auth/me')return send(res,200,{authenticated:validSession(req),configured:!!ADMIN_PASSWORD});
  if(method==='POST'&&pathname==='/api/auth/logout'){
    const raw=parseCookies(req).lf_session;const id=raw?.split('.')[0];if(id)sessions.delete(id);
    return send(res,200,{ok:true},{'Set-Cookie':`lf_session=; Path=/; HttpOnly; SameSite=${SAME_SITE}; Max-Age=0${COOKIE_SECURE?'; Secure':''}`});
  }
  if(!pathname.startsWith('/api/admin/'))return bad(res,404,'Ruta desconocida');
  if(!validSession(req))return bad(res,401,'Inicia sesión en el panel');
  if(method!=='GET'&&!originOkay(req))return bad(res,403,'Origen no autorizado');
  if(method==='GET'&&pathname==='/api/admin/commerce'){
    const s=await store.read(),c=await commerce.config();return send(res,200,{rates:Object.fromEntries(await Promise.all(s.branches.map(async b=>[b.id,await commerce.rates(b.id)]))),timeOffers:c.timeOffers||[],quotes:await commerce.quotes(),branchThemes:Object.fromEntries(await Promise.all(s.branches.map(async b=>[b.id,await commerce.theme(b.id)]))),heroSlides:Object.fromEntries(await Promise.all(s.branches.map(async b=>[b.id,await commerce.slides(b.id)]))),heroIntervals:Object.fromEntries(await Promise.all(s.branches.map(async b=>[b.id,await commerce.interval(b.id)]))),branchCardStyles:Object.fromEntries(await Promise.all(s.branches.map(async b=>[b.id,await commerce.cardStyle(b.id)])))});
  }
  if(method==='PUT'&&pathname.startsWith('/api/admin/branch-card-style/')){
    const id=decodeURIComponent(pathname.slice('/api/admin/branch-card-style/'.length)),state=await store.read();
    if(!state.branches.some(b=>b.id===id))return bad(res,404,'Sucursal inválida');
    const input=await jsonBody(req);
    const borderColor=String(input.borderColor||'').trim();
    if(!/^#[0-9a-f]{6}$/i.test(borderColor))return bad(res,400,'El color del borde debe ser #RRGGBB');
    const logoText=cleanStr(input.logoUrl,1800);
    const logoUrl=/^\/assets\/[a-z0-9_./-]+\.(?:png|webp|jpg|jpeg|svg)$/i.test(logoText)&&!logoText.includes('..')
      ?logoText:((/^https:\/\//i.test(logoText)&&safeImage(logoText))||'');
    if(!logoUrl)return bad(res,400,'Usa una ruta de imagen de la web o un enlace HTTPS');
    return send(res,200,{ok:true,style:await commerce.saveCardStyle(id,{logoUrl,borderColor})});
  }
  if(method==='PUT'&&pathname.startsWith('/api/admin/branch-theme/')){
    const id=decodeURIComponent(pathname.slice('/api/admin/branch-theme/'.length)),s=await store.read();
    if(!s.branches.some(b=>b.id===id))return bad(res,404,'Sucursal inválida');
    const body=await jsonBody(req);const allowed=['bg','surface','surface2','surface3','pink','teal','lav','accentPink','accentTeal'];
    if(allowed.some(k=>typeof body[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(body[k])))return bad(res,400,'Los colores deben tener formato hexadecimal #RRGGBB');
    return send(res,200,{ok:true,theme:await commerce.saveTheme(id,Object.fromEntries(allowed.map(k=>[k,body[k]])))});
  }
  if(method==='PUT'&&pathname.startsWith('/api/admin/hero-interval/')){
    const id=decodeURIComponent(pathname.slice('/api/admin/hero-interval/'.length)),s=await store.read();
    if(!s.branches.some(b=>b.id===id))return bad(res,404,'Sucursal inválida');
    const body=await jsonBody(req),seconds=Number(body.seconds);
    if(!Number.isInteger(seconds)||seconds<3||seconds>30)return bad(res,400,'Elige entre 3 y 30 segundos');
    return send(res,200,{ok:true,seconds:await commerce.saveInterval(id,seconds)});
  }
  if(method==='POST'&&pathname==='/api/admin/hero-slides'){
    const body=await jsonBody(req),s=await store.read(),branchId=cleanStr(body.branchId,100);
    if(!s.branches.some(b=>b.id===branchId))return bad(res,404,'Sucursal inválida');
    const existing=await commerce.slides(branchId);if(existing.length>=16)return bad(res,400,'Máximo 16 banners por sucursal');
    const item={id:'hero-'+randomBytes(5).toString('hex'),eyebrow:cleanStr(body.eyebrow,100),title:cleanStr(body.title,140),description:cleanStr(body.description,380),cta:cleanStr(body.cta,60)||'Ver productos',destination:body.destination||'catalogo',imageUrl:safeImage(body.imageUrl),accent:checkedColor(body.accent),background:cleanStr(body.background,50)||'escolar',enabled:body.enabled!==false};
    if(!item.title||!item.imageUrl||!['catalogo','ofertas','especiales','campanas','novedades'].includes(item.destination))return bad(res,400,'Completa título, imagen válida y destino');
    await commerce.putSlide(branchId,item);return send(res,201,{ok:true,item});
  }
  if((method==='PATCH'||method==='DELETE')&&pathname.startsWith('/api/admin/hero-slides/')){
    const id=decodeURIComponent(pathname.slice('/api/admin/hero-slides/'.length)),body=await jsonBody(req),branchId=cleanStr(body.branchId,100),s=await store.read();
    if(!s.branches.some(b=>b.id===branchId))return bad(res,404,'Sucursal inválida');
    const prev=(await commerce.slides(branchId)).find(x=>x.id===id);if(!prev)return bad(res,404,'Banner no encontrado');
    if(method==='DELETE'){await commerce.deleteSlide(branchId,id);return send(res,200,{ok:true});}
    const item={...prev,eyebrow:cleanStr(body.eyebrow,100),title:cleanStr(body.title,140),description:cleanStr(body.description,380),cta:cleanStr(body.cta,60)||'Ver productos',destination:body.destination||'catalogo',imageUrl:safeImage(body.imageUrl),accent:checkedColor(body.accent),background:cleanStr(body.background,50)||'escolar',enabled:body.enabled!==false};
    if(!item.title||!item.imageUrl||!['catalogo','ofertas','especiales','campanas','novedades'].includes(item.destination))return bad(res,400,'Completa título, imagen válida y destino');
    await commerce.putSlide(branchId,item);return send(res,200,{ok:true,item});
  }
  if(method==='PUT'&&pathname.startsWith('/api/admin/hero-order/')){
    const branchId=decodeURIComponent(pathname.slice('/api/admin/hero-order/'.length)),s=await store.read();
    if(!s.branches.some(b=>b.id===branchId))return bad(res,404,'Sucursal inválida');
    const body=await jsonBody(req),original=await commerce.slides(branchId);
    if(!Array.isArray(body.ids)||body.ids.length!==original.length||new Set(body.ids).size!==original.length||body.ids.some(id=>!original.some(x=>x.id===id)))return bad(res,400,'Orden inválido');
    await commerce.reorderSlides(branchId,body.ids);return send(res,200,{ok:true});
  }
  if(method==='PUT'&&pathname.startsWith('/api/admin/print-rates/')){
    const id=decodeURIComponent(pathname.slice('/api/admin/print-rates/'.length)),s=await store.read();if(!s.branches.some(b=>b.id===id))return bad(res,404,'Sucursal inválida');
    const body=await jsonBody(req);const allowed=['copyBW','printBW','scanPage','copyColor','printColor','bulkAfter','bulkDiscount','duplexDiscount','coverageLow','coverageHigh','minColor','maxColor'];const rates={};for(const k of allowed){if(body[k]===undefined)continue;const n=Number(body[k]);if(!Number.isFinite(n)||n<0||n>10000)throw Error('Tarifa inválida: '+k);rates[k]=n;}if(rates.bulkDiscount>90||rates.duplexDiscount>90)throw Error('El descuento no puede superar 90%');
    return send(res,200,{ok:true,rates:await commerce.saveRates(id,rates)});
  }
  if(method==='PUT'&&pathname==='/api/admin/time-offers'){
    const b=await jsonBody(req),s=await store.read(),branchId=cleanStr(b.branchId,100),productId=cleanStr(b.productId,100);const base=s.offers.find(o=>o.branchId===branchId&&o.productId===productId);if(!base||!s.products.some(p=>p.id===productId))return bad(res,404,'Producto no registrado en sucursal');
    if(b.enabled===false){await commerce.deleteOffer(branchId,productId);return send(res,200,{ok:true});}
    const price=Number(b.salePrice),start=Date.parse(b.startAt||''),end=Date.parse(b.endAt||'');if(!base.active||!Number.isFinite(price)||price<=0||price>=base.price||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Comprueba fecha de inicio, fin y precio menor al precio normal');
    const item={branchId,productId,salePrice:Math.round(price*100)/100,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),enabled:true};await commerce.putOffer(item);return send(res,200,{ok:true,item});
  }
  if(method==='POST'&&pathname==='/api/admin/bulk-visibility'){
    const body=await jsonBody(req,250_000);
    const state=await store.read();
    const branchId=cleanStr(body.branchId,100);
    if(!state.branches.some(b=>b.id===branchId))return bad(res,404,'Sucursal no encontrada');
    if(typeof body.active!=='boolean')return bad(res,400,'Elige publicar u ocultar');
    if(!Array.isArray(body.productIds)||body.productIds.length===0||body.productIds.length>6000)return bad(res,400,'Selecciona entre 1 y 6000 productos');
    const ids=[...new Set(body.productIds)];
    if(ids.some(id=>typeof id!=='string'||id.length>100||!state.products.some(p=>p.id===id)))return bad(res,400,'Lista de productos inválida');
    const result=await store.bulkPublish(branchId,ids,body.active);
    return send(res,200,{ok:true,...result,requested:ids.length});
  }
  if(method==='GET'&&pathname==='/api/admin/state')return send(res,200,await store.read());

  const state=await store.read();
  // Vocabulario editable por el administrador, separado de los productos físicos.
  if(method==='POST'&&pathname==='/api/admin/aliases'){
    const raw=await jsonBody(req);
    const aliasText=cleanStr(raw.aliasText,120),canonicalTerm=cleanStr(raw.canonicalTerm,120);
    if(!aliasText||!canonicalTerm)throw new Error('Escribe el nombre alternativo y su equivalente');
    const status=raw.status==='approved'?'approved':'review';
    await store.putAlias({aliasText,canonicalTerm,status,note:cleanStr(raw.note,250)});
    return send(res,200,{ok:true});
  }
  if(method==='DELETE'&&pathname.startsWith('/api/admin/aliases/')){
    const key=decodeURIComponent(pathname.slice('/api/admin/aliases/'.length));
    await store.removeAlias(key);return send(res,200,{ok:true});
  }
  if(method==='POST'&&pathname==='/api/admin/open-package'){
    if(!process.env.DATABASE_URL)return bad(res,503,'Para abrir cajas es necesario conectar PostgreSQL');
    const b=await jsonBody(req);
    const branchId=cleanStr(b.branchId,100),packageProductId=cleanStr(b.packageProductId,100),unitProductId=cleanStr(b.unitProductId,100);
    const count=int(b.count,1,10000);
    const id=await store.openPackage(branchId,packageProductId,unitProductId,count);
    return send(res,200,{ok:true,openingId:id});
  }
  if(method==='POST'&&pathname==='/api/admin/branches'){
    const body=await jsonBody(req);
    if(state.branches.length>=24)throw new Error('Máximo 24 sucursales registradas');
    const name=cleanStr(body.name,180);
    if(!name)throw new Error('Escribe el nombre de la sucursal');
    const id='sucursal-'+randomBytes(5).toString('hex');
    const order=Math.max(0,...state.branches.map(b=>Number(b.order)||0))+1;
    const item={id,name,subtitle:cleanStr(body.subtitle,220),address:cleanStr(body.address,220),hours:cleanStr(body.hours,220),phone:cleanStr(body.phone,90),photoUrl:safeImage(body.photoUrl),photoUrl2:safeImage(body.photoUrl2),accent:checkedColor(body.accent||'#f026ad'),active:true,order,tag:cleanStr(body.tag,100)};
    await store.put('branches',item);
    await store.initializeBranchOffers(id);
    broadcastBranches();return send(res,201,{ok:true,item});
  }
  if(method==='PATCH'&&pathname.startsWith('/api/admin/branches/')){
    const id=pathname.split('/').at(-1), current=state.branches.find(x=>x.id===id);if(!current)return bad(res,404,'Sucursal no encontrada');
    const raw=fields(await jsonBody(req),['name','subtitle','address','hours','phone','photoUrl','photoUrl2','accent','tag','active']);
    for(const f of ['name','subtitle','address','hours','phone','tag'])if(raw[f]!=null)raw[f]=cleanStr(raw[f],220);
    if(raw.photoUrl!==undefined)raw.photoUrl=safeImage(raw.photoUrl);
    if(raw.photoUrl2!==undefined)raw.photoUrl2=safeImage(raw.photoUrl2);
    if(raw.accent)raw.accent=checkedColor(raw.accent);
    if(Object.hasOwn(raw,'active'))raw.active=!!raw.active;
    if(raw.name==='')throw new Error('La sucursal necesita un nombre');
    if(raw.active===false && current.active && state.branches.filter(b=>b.active).length<=1)throw new Error('Debe quedar al menos una sucursal visible');
    const item={...current,...raw};await store.put('branches',item);broadcastBranches();return send(res,200,{ok:true,item});
  }
  if(method==='POST'&&pathname==='/api/admin/products'){
    const raw=await jsonBody(req);if(!state.categories.some(x=>x.id===raw.categoryId))throw new Error('Categoría no válida');
    const id='prod-'+randomBytes(5).toString('hex');const sku=cleanStr(raw.sku,60)||nextSku(state,raw.categoryId,raw.name);
    if(state.products.some(x=>x.sku.toLowerCase()===sku.toLowerCase()))throw new Error('El SKU ya existe');
    const item={id,sku,name:cleanStr(raw.name,170),brand:cleanStr(raw.brand,80),categoryId:raw.categoryId,subCategory:cleanStr(raw.subCategory,100),description:cleanStr(raw.description,600),model:cleanStr(raw.model,120),color:cleanStr(raw.color,70),material:cleanStr(raw.material,100),finish:cleanStr(raw.finish,100),paperGsm:raw.paperGsm===''||raw.paperGsm==null?null:Number(raw.paperGsm),usage:cleanStr(raw.usage,240),features:cleanStr(raw.features,600),searchAliases:cleanStr(raw.searchAliases,300),comparisonGroup:cleanStr(raw.comparisonGroup,100),comparisonLabel:cleanStr(raw.comparisonLabel,130),qualityTier:int(raw.qualityTier??2,1,3),unitLabel:cleanStr(raw.unitLabel||'unidad',60),unitsPerPack:int(raw.unitsPerPack||1,1),netContent:raw.netContent===''||raw.netContent==null?null:Number(raw.netContent),netUnit:cleanStr(raw.netUnit,20)||null,imageUrl:safeImage(raw.imageUrl),originType:cleanStr(raw.originType||'SIN DETERMINAR',60),isService:raw.categoryId==='servicios',isNew:!!raw.isNew,featured:!!raw.featured,active:raw.active!==false,order:state.products.length+1};
    if(!item.name)throw new Error('Escribe el nombre del producto');
    await store.put('products',item);
    for(const b of state.branches)await store.put('offers',{branchId:b.id,productId:id,price:0,compareAt:null,stock:0,minStock:raw.categoryId==='servicios'?0:5,active:false});
    return send(res,201,{ok:true,item});
  }
  if(method==='PATCH'&&pathname.startsWith('/api/admin/products/')){
    const id=pathname.split('/').at(-1),current=state.products.find(x=>x.id===id);if(!current)return bad(res,404,'Producto no encontrado');
    const raw=fields(await jsonBody(req),['sku','name','brand','categoryId','subCategory','description','model','color','material','finish','paperGsm','usage','features','searchAliases','comparisonGroup','comparisonLabel','qualityTier','unitLabel','unitsPerPack','netContent','netUnit','imageUrl','isService','originType','isNew','featured','active']);
    for(const f of ['sku','name','brand','categoryId','subCategory','description','model','color','material','finish','paperGsm','usage','features','searchAliases','comparisonGroup','comparisonLabel','qualityTier','unitLabel','netUnit','originType'])if(raw[f]!=null)raw[f]=cleanStr(raw[f],f==='description'?600:170);
    if(raw.imageUrl!==undefined)raw.imageUrl=safeImage(raw.imageUrl);
    if(raw.categoryId&&!state.categories.some(x=>x.id===raw.categoryId))throw new Error('Categoría no válida');
    if(raw.sku&&state.products.some(x=>x.id!==id&&x.sku.toLowerCase()===raw.sku.toLowerCase()))throw new Error('El SKU ya existe');
    if(raw.unitsPerPack!==undefined)raw.unitsPerPack=int(raw.unitsPerPack,1);
    if(raw.qualityTier!==undefined)raw.qualityTier=int(raw.qualityTier,1,3);
    if(raw.netContent!==undefined)raw.netContent=raw.netContent===''||raw.netContent==null?null:Number(raw.netContent);
    if(raw.paperGsm!==undefined)raw.paperGsm=raw.paperGsm===''||raw.paperGsm==null?null:Number(raw.paperGsm);
    for(const f of ['isNew','featured','active'])if(raw[f]!==undefined)raw[f]=!!raw[f];
    raw.isService=(raw.categoryId||current.categoryId)==='servicios';
    const item={...current,...raw};if(!item.name)throw new Error('El nombre es obligatorio');
    await store.put('products',item);return send(res,200,{ok:true,item});
  }
  if(method==='POST'&&pathname.startsWith('/api/admin/products/')&&pathname.endsWith('/visibility')){
    const id=pathname.split('/')[4];
    const product=state.products.find(p=>p.id===id);if(!product)return bad(res,404,'Artículo no encontrado');
    const body=await jsonBody(req);
    const item={...product,active:body.active===true};
    await store.put('products',item);return send(res,200,{ok:true,item});
  }
  if(method==='PUT'&&pathname.startsWith('/api/admin/offers/')){
    const [, , , , branchId, productId]=pathname.split('/');
    if(!state.branches.some(x=>x.id===branchId)||!state.products.some(x=>x.id===productId))return bad(res,404,'Sucursal o producto no encontrado');
    const current=state.offers.find(x=>x.branchId===branchId&&x.productId===productId)||{branchId,productId,price:0,compareAt:null,stock:0,minStock:5,active:true};
    const raw=fields(await jsonBody(req),['price','compareAt','stock','minStock','active']);
    if(raw.price!==undefined)raw.price=money(raw.price);
    if(raw.compareAt!==undefined)raw.compareAt=raw.compareAt==null||raw.compareAt===''?null:money(raw.compareAt);
    for(const f of ['stock','minStock'])if(raw[f]!==undefined)raw[f]=int(raw[f]);
    if(raw.active!==undefined)raw.active=!!raw.active;
    if(raw.price<0||(raw.compareAt!==null&&raw.compareAt<0))throw new Error('El precio no puede ser negativo');
    const product=state.products.find(p=>p.id===productId);
    if(product?.isService){raw.stock=0;raw.minStock=0;}
    const item={...current,...raw};
    if(item.active&&item.price<=0)throw new Error('Para publicar en una sucursal asigna primero un precio mayor que cero');
    await store.put('offers',item);return send(res,200,{ok:true,item});
  }
  if((method==='POST'&&pathname==='/api/admin/campaigns')||(method==='PATCH'&&pathname.startsWith('/api/admin/campaigns/'))){
    const body=await jsonBody(req);const id=method==='POST'?'camp-'+randomBytes(5).toString('hex'):pathname.split('/').at(-1);
    const current=state.campaigns.find(c=>c.id===id);
    if(method==='PATCH'&&!current)return bad(res,404,'Campaña no encontrada');
    const item={id,title:cleanStr(body.title??current?.title,180),eyebrow:cleanStr(body.eyebrow??current?.eyebrow,100),description:cleanStr(body.description??current?.description,600),ctaLabel:cleanStr(body.ctaLabel??current?.ctaLabel??'Explorar',90),categoryId:body.categoryId??current?.categoryId??null,accent:checkedColor(body.accent??current?.accent),background:cleanStr(body.background??current?.background??'navidad',60),imageUrl:safeImage(body.imageUrl??current?.imageUrl),badge:cleanStr(body.badge??current?.badge??'',80),startDay:cleanStr(body.startDay??current?.startDay??'01-01',5),endDay:cleanStr(body.endDay??current?.endDay??'12-31',5),enabled:body.enabled??current?.enabled??true,branches:Array.isArray(body.branches)?body.branches:current?.branches||['all'],priority:int(body.priority??current?.priority??10,1,1000)};
    if(!item.title)throw new Error('La campaña necesita título');
    if(!/^\d\d-\d\d$/.test(item.startDay)||!/^\d\d-\d\d$/.test(item.endDay))throw new Error('Usa fechas MM-DD');
    if(item.categoryId&&!state.categories.some(c=>c.id===item.categoryId))throw new Error('Categoría inexistente');
    if(!item.branches.every(b=>b==='all'||state.branches.some(x=>x.id===b)))throw new Error('Sucursal incorrecta');
    await store.put('campaigns',item);return send(res,200,{ok:true,item});
  }
  if(method==='DELETE'&&pathname.startsWith('/api/admin/campaigns/')){
    const id=pathname.split('/').at(-1);if(!state.campaigns.some(x=>x.id===id))return bad(res,404,'No existe');
    await store.remove('campaigns',id);return send(res,200,{ok:true});
  }
  if(method==='PUT'&&pathname==='/api/admin/sections'){
    const {sections}=await jsonBody(req);if(!Array.isArray(sections))throw new Error('Se esperaba una lista de secciones');
    if(sections.length!==state.sections.length||new Set(sections.map(x=>x.id)).size!==state.sections.length)throw new Error('Lista incompleta');
    for(let i=0;i<sections.length;i++){
      const origin=state.sections.find(s=>s.id===sections[i].id);if(!origin)throw new Error('Sección desconocida');
      await store.put('sections',{...origin,order:i+1,enabled:!!sections[i].enabled});
    }
    return send(res,200,{ok:true});
  }
  if(method==='PATCH'&&pathname==='/api/admin/settings'){
    const raw=fields(await jsonBody(req),['businessName','tagline','announcement','showProvisionalNotice','primaryColor','secondaryColor','heroHeadline','heroDescription']);
    for(const f of ['businessName','tagline','announcement','heroHeadline','heroDescription'])if(raw[f]!=null)raw[f]=cleanStr(raw[f],300);
    for(const f of ['primaryColor','secondaryColor'])if(raw[f])raw[f]=checkedColor(raw[f]);
    if(raw.showProvisionalNotice!==undefined)raw.showProvisionalNotice=!!raw.showProvisionalNotice;
    const item={...state.settings,...raw};await store.put('settings',item);return send(res,200,{ok:true,item});
  }
  return bad(res,404,'Operación no encontrada');
}
const server=http.createServer(async(req,res)=>{
  try{
    const {pathname}=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(pathname.startsWith('/api/')){
      if(process.env.ADMIN_ORIGIN && req.headers.origin===process.env.ADMIN_ORIGIN){res.setHeader('Access-Control-Allow-Origin',process.env.ADMIN_ORIGIN);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');}
      if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
      return await api(req,res,pathname);
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return bad(res,405,'Método no permitido');
    if(pathname==='/admin'||pathname==='/admin/'||pathname==='/admin/index.html')return await serveFile(res,ADMIN,'/index.html');
    if(pathname.startsWith('/admin/'))return await serveFile(res,ADMIN,pathname.slice('/admin'.length));
    if(pathname.startsWith('/assets/'))return await serveFile(res,PUBLIC,pathname);
    if(['/styles.css','/site.js','/experience-v7.js','/visual-v9.js','/motion-v10.js','/gateway-focus.js','/gateway-data.js','/home-reveal.js','/product-reveal.js','/gateway-water.js','/restore-extras.js','/floating-background.js','/branch-hero-carousel.js','/banner-motion.js'].includes(pathname))return await serveFile(res,PUBLIC,pathname);
    if(pathname==='/'||pathname.startsWith('/tienda/'))return await serveFile(res,PUBLIC,'/index.html');
    return bad(res,404,'Página no encontrada');
  }catch(error){console.error('[La Favorita]',error);return bad(res, error.status||(/obligatori|inválid|incorrect|demasiad|esperab|no puede|necesita|no existe|debe|sucursal|modalidad|máximo|archivo/i.test(error.message)?400:500),error.message||'Error interno');}
});
server.listen(PORT,HOST,()=>{
  console.log(`\n LA FAVORITA WEB: http://${HOST}:${PORT}/`);
  console.log(` PANEL ADMIN:    http://${HOST}:${PORT}/admin/`);
  console.log(` ALMACENAMIENTO: ${process.env.DATABASE_URL?'PostgreSQL / Neon':'Archivo local persistente'}`);
  if(PROD&&!ADMIN_PASSWORD)console.warn(' AVISO: Panel inhabilitado hasta definir ADMIN_PASSWORD');
});
process.on('SIGINT',async()=>{server.close();await store.close();process.exit(0);});
