import http from 'node:http';
import { randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, normalize, resolve, sep, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { branchPrices, compareCatalog, parseTypedList, quoteFromItems, readSchoolListWithAI } from './catalog.mjs';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..');
const PUBLIC=join(ROOT,'public');
const ADMIN=join(ROOT,'admin');
const PORT=Number(process.env.PORT||3000);
const HOST=process.env.HOST||'127.0.0.1';
const PROD=process.env.NODE_ENV==='production';
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||(PROD?'':'cambia-esta-clave');
const COOKIE_SECURE=PROD||process.env.COOKIE_SECURE==='true';
const SAME_SITE=process.env.CROSS_SITE_ADMIN==='true'?'None':'Strict';
const TOKEN_SECRET=process.env.SESSION_SECRET||randomBytes(32).toString('hex');
const sessions=new Map();
const attempts=new Map();
const aiAttempts=new Map();
const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
let store=await createStore();

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
function safeImage(v){let s=cleanStr(v,1800);if(!s)return '';try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function money(x){return Math.round(Number(x)*100)/100;}
function int(x,min=0,max=999999){let n=Number(x);if(!Number.isFinite(n))throw new Error('Número inválido');return Math.min(max,Math.max(min,Math.floor(n)));}
function isCurrent(c){
  if(!c.enabled)return false;
  const today=new Date();const md=`${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const start=c.startDay||'01-01',end=c.endDay||'12-31';
  return start<=end?md>=start&&md<=end:md>=start||md<=end;
}
function branchesForCampaign(c,b){return c.branches.includes('all')||c.branches.includes(b);}
function viewForBranch(state,id){
  const branch=state.branches.find(b=>b.id===id&&b.active);
  if(!branch)return null;
  const offers=new Map(state.offers.filter(o=>o.branchId===id&&o.active).map(o=>[o.productId,o]));
  return {version:state.version,settings:state.settings,branch,branches:state.branches.filter(b=>b.active).sort((a,b)=>a.order-b.order),categories:state.categories.slice().sort((a,b)=>a.order-b.order),sections:state.sections.filter(s=>s.enabled).sort((a,b)=>a.order-b.order),campaigns:state.campaigns.filter(c=>isCurrent(c)&&branchesForCampaign(c,id)).sort((a,b)=>a.priority-b.priority),products:state.products.filter(p=>p.active&&offers.has(p.id)).map(p=>({...p, ...offers.get(p.id)})).sort((a,b)=>a.order-b.order)};
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
  if(method==='GET'&&pathname==='/api/health')return send(res,200,{ok:true,mode:process.env.DATABASE_URL?'postgresql':'archivo-local'});
  if(method==='GET'&&pathname==='/api/ai/status')return send(res,200,{configured:!!process.env.OPENAI_API_KEY,maxFileMB:8,formats:['application/pdf','image/jpeg','image/png','image/webp']});
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
    const s=await store.read();const result=quoteFromItems(s,branchId,items,tier);
    const {_used,...visible}=result;return send(res,200,visible);
  }
  if(method==='GET'&&pathname==='/api/version'){const s=await store.read();return send(res,200,{version:s.version});}
  if(method==='GET'&&pathname==='/api/bootstrap'){const s=await store.read();return send(res,200,{version:s.version,settings:s.settings,branches:s.branches.filter(b=>b.active).sort((a,b)=>a.order-b.order),categories:s.categories});}
  if(method==='GET'&&pathname.startsWith('/api/store/')){const s=await store.read();const id=decodeURIComponent(pathname.slice('/api/store/'.length));const payload=viewForBranch(s,id);return payload?send(res,200,payload):bad(res,404,'Sucursal no disponible');}
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
  if(method==='GET'&&pathname==='/api/admin/state')return send(res,200,await store.read());

  const state=await store.read();
  if(method==='PATCH'&&pathname.startsWith('/api/admin/branches/')){
    const id=pathname.split('/').at(-1), current=state.branches.find(x=>x.id===id);if(!current)return bad(res,404,'Sucursal no encontrada');
    const raw=fields(await jsonBody(req),['name','subtitle','address','hours','phone','photoUrl','accent','tag','active']);
    for(const f of ['name','subtitle','address','hours','phone','tag'])if(raw[f]!=null)raw[f]=cleanStr(raw[f],220);
    if(raw.photoUrl!==undefined)raw.photoUrl=safeImage(raw.photoUrl);
    if(raw.accent)raw.accent=checkedColor(raw.accent);
    if(Object.hasOwn(raw,'active'))raw.active=!!raw.active;
    if(raw.name==='')throw new Error('La sucursal necesita un nombre');
    const item={...current,...raw};await store.put('branches',item);return send(res,200,{ok:true,item});
  }
  if(method==='POST'&&pathname==='/api/admin/products'){
    const raw=await jsonBody(req);if(!state.categories.some(x=>x.id===raw.categoryId))throw new Error('Categoría no válida');
    const id='prod-'+randomBytes(5).toString('hex');const sku=cleanStr(raw.sku,60)||id.toUpperCase();
    if(state.products.some(x=>x.sku.toLowerCase()===sku.toLowerCase()))throw new Error('El SKU ya existe');
    const item={id,sku,name:cleanStr(raw.name,170),brand:cleanStr(raw.brand,80),categoryId:raw.categoryId,subCategory:cleanStr(raw.subCategory,100),description:cleanStr(raw.description,600),model:cleanStr(raw.model,120),usage:cleanStr(raw.usage,240),features:cleanStr(raw.features,600),searchAliases:cleanStr(raw.searchAliases,300),comparisonGroup:cleanStr(raw.comparisonGroup,100),comparisonLabel:cleanStr(raw.comparisonLabel,130),qualityTier:int(raw.qualityTier??2,1,3),unitLabel:cleanStr(raw.unitLabel||'unidad',60),unitsPerPack:int(raw.unitsPerPack||1,1),netContent:raw.netContent===''||raw.netContent==null?null:Number(raw.netContent),netUnit:cleanStr(raw.netUnit,20)||null,imageUrl:safeImage(raw.imageUrl),isNew:!!raw.isNew,featured:!!raw.featured,active:true,order:state.products.length+1};
    if(!item.name)throw new Error('Escribe el nombre del producto');
    await store.put('products',item);
    for(const b of state.branches)await store.put('offers',{branchId:b.id,productId:id,price:0,compareAt:null,stock:0,minStock:5,active:true});
    return send(res,201,{ok:true,item});
  }
  if(method==='PATCH'&&pathname.startsWith('/api/admin/products/')){
    const id=pathname.split('/').at(-1),current=state.products.find(x=>x.id===id);if(!current)return bad(res,404,'Producto no encontrado');
    const raw=fields(await jsonBody(req),['sku','name','brand','categoryId','subCategory','description','model','usage','features','searchAliases','comparisonGroup','comparisonLabel','qualityTier','unitLabel','unitsPerPack','netContent','netUnit','imageUrl','isNew','featured','active']);
    for(const f of ['sku','name','brand','categoryId','subCategory','description','model','usage','features','searchAliases','comparisonGroup','comparisonLabel','qualityTier','unitLabel','netUnit'])if(raw[f]!=null)raw[f]=cleanStr(raw[f],f==='description'?600:170);
    if(raw.imageUrl!==undefined)raw.imageUrl=safeImage(raw.imageUrl);
    if(raw.categoryId&&!state.categories.some(x=>x.id===raw.categoryId))throw new Error('Categoría no válida');
    if(raw.sku&&state.products.some(x=>x.id!==id&&x.sku.toLowerCase()===raw.sku.toLowerCase()))throw new Error('El SKU ya existe');
    if(raw.unitsPerPack!==undefined)raw.unitsPerPack=int(raw.unitsPerPack,1);
    if(raw.qualityTier!==undefined)raw.qualityTier=int(raw.qualityTier,1,3);
    if(raw.netContent!==undefined)raw.netContent=raw.netContent===''||raw.netContent==null?null:Number(raw.netContent);
    for(const f of ['isNew','featured','active'])if(raw[f]!==undefined)raw[f]=!!raw[f];
    const item={...current,...raw};if(!item.name)throw new Error('El nombre es obligatorio');
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
    const item={...current,...raw};await store.put('offers',item);return send(res,200,{ok:true,item});
  }
  if((method==='POST'&&pathname==='/api/admin/campaigns')||(method==='PATCH'&&pathname.startsWith('/api/admin/campaigns/'))){
    const body=await jsonBody(req);const id=method==='POST'?'camp-'+randomBytes(5).toString('hex'):pathname.split('/').at(-1);
    const current=state.campaigns.find(c=>c.id===id);
    if(method==='PATCH'&&!current)return bad(res,404,'Campaña no encontrada');
    const item={id,title:cleanStr(body.title??current?.title,180),eyebrow:cleanStr(body.eyebrow??current?.eyebrow,100),description:cleanStr(body.description??current?.description,600),ctaLabel:cleanStr(body.ctaLabel??current?.ctaLabel??'Explorar',90),categoryId:body.categoryId??current?.categoryId??null,accent:checkedColor(body.accent??current?.accent),background:cleanStr(body.background??current?.background??'navidad',60),badge:cleanStr(body.badge??current?.badge??'',80),startDay:cleanStr(body.startDay??current?.startDay??'01-01',5),endDay:cleanStr(body.endDay??current?.endDay??'12-31',5),enabled:body.enabled??current?.enabled??true,branches:Array.isArray(body.branches)?body.branches:current?.branches||['all'],priority:int(body.priority??current?.priority??10,1,1000)};
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
    if(['/site.css','/site.js','/experience.css','/v4.css','/v5.css'].includes(pathname))return await serveFile(res,PUBLIC,pathname);
    if(pathname==='/'||pathname.startsWith('/tienda/'))return await serveFile(res,PUBLIC,'/index.html');
    return bad(res,404,'Página no encontrada');
  }catch(error){console.error('[La Favorita]',error);return bad(res, error.status||(/obligatori|inválid|incorrect|demasiad|esperab|no puede|necesita|no existe|debe|sucursal|modalidad|máximo|archivo/i.test(error.message)?400:500),error.message||'Error interno');}
});
server.listen(PORT,HOST,()=>{
  console.log(`\n LA FAVORITA WEB: http://${HOST}:${PORT}/`);
  console.log(` PANEL ADMIN:    http://${HOST}:${PORT}/admin/`);
  console.log(` ALMACENAMIENTO: ${process.env.DATABASE_URL?'PostgreSQL / Neon':'Archivo local persistente'}`);
  if(!PROD&&!process.env.ADMIN_PASSWORD)console.log(' Clave de panel en desarrollo: cambia-esta-clave (configura ADMIN_PASSWORD)');
  if(PROD&&!ADMIN_PASSWORD)console.warn(' AVISO: Panel inhabilitado hasta definir ADMIN_PASSWORD');
});
process.on('SIGINT',async()=>{server.close();await store.close();process.exit(0);});
