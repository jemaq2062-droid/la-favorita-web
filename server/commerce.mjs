import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=process.env.COMMERCE_DATA_FILE||join(root,'data','commerce-v27.json');
const defaultRate={copyBW:0.15,printBW:0.20,scanPage:0,copyColor:0,printColor:0,bulkAfter:100,bulkDiscount:0,duplexDiscount:0,coverageLow:0.20,coverageHigh:0.70,minColor:0,maxColor:0};
const seed=()=>({rates:{},timeOffers:[],quotes:[],sequence:0,revision:0,branchThemes:{},heroSlides:{},heroIntervals:{},branchCardStyles:{}});
export const DEFAULT_CARD_STYLES={
 'sucursal-1':{logoUrl:'/assets/logo-favorita-transparente.png',borderColor:'#fa58b8'},
 'sucursal-2':{logoUrl:'/assets/logo-favorita-transparente.png',borderColor:'#46d7d9'},
 'sucursal-3':{logoUrl:'/assets/logo-aly-transparente-borde.png',borderColor:'#92dc58'},
 'sucursal-4':{logoUrl:'/assets/logo-favorita-transparente.png',borderColor:'#ab95f5'}
};
export const DEFAULT_THEMES={
 'sucursal-1':{bg:'#0a1d30',surface:'#152e45',surface2:'#1b3a55',surface3:'#234863',pink:'#ff51af',teal:'#4cdeed',lav:'#bc92ff',accentPink:'#ff2d95',accentTeal:'#24d1d9'},
 'sucursal-2':{bg:'#211331',surface:'#34204b',surface2:'#493061',surface3:'#63417b',pink:'#ffc069',teal:'#9aebdd',lav:'#db9bfa',accentPink:'#ed9f5d',accentTeal:'#77d7c3'},
 'sucursal-3':{bg:'#0c2549',surface:'#113d6c',surface2:'#1c5386',surface3:'#2e67a2',pink:'#fdd76e',teal:'#9be45b',lav:'#aa9eff',accentPink:'#f2c44b',accentTeal:'#75da47'},
 'sucursal-4':{bg:'#27152a',surface:'#44213c',surface2:'#5d2b4a',surface3:'#7a3d61',pink:'#ff9a7c',teal:'#77e2b5',lav:'#e7a4f5',accentPink:'#f57c66',accentTeal:'#55d6a0'}
};
export const DEFAULT_HERO_SLIDES=[
 {id:'v31-arbol',eyebrow:'TEMPORADA NAVIDEÑA',title:'Una Navidad llena de ideas',description:'Decoración y detalles para compartir esta temporada.',cta:'Ver especiales',destination:'especiales',imageUrl:'/assets/editorial/arbol-navidad-sin-fondo.png',accent:'#fb6db3',background:'navidad',enabled:true},
 {id:'v31-resaltadores',eyebrow:'ESCRITURA Y COLOR',title:'Dale color a cada idea',description:'Resaltadores y artículos para estudiar con estilo.',cta:'Ver productos',destination:'catalogo',imageUrl:'/assets/editorial/resaltadores-v30.png',accent:'#31d4e4',background:'destacados',enabled:true},
 {id:'v31-mochila',eyebrow:'TODO PARA CLASES',title:'Prepárate para el nuevo ciclo',description:'Cuadernos, materiales y útiles para cada día.',cta:'Explorar catálogo',destination:'catalogo',imageUrl:'/assets/editorial/mochila-escolar-v30.png',accent:'#9bc8ff',background:'escolar',enabled:true},
 {id:'v31-navidad',eyebrow:'DETALLES ESPECIALES',title:'Momentos que se recuerdan',description:'Encuentra regalos y accesorios para celebrar.',cta:'Ver temporada',destination:'especiales',imageUrl:'/assets/editorial/navidad-decoracion-v30.png',accent:'#f3b16e',background:'navidad',enabled:true}
];

const copy=v=>structuredClone(v);
export class CommerceStore{
 constructor(pool=null){this.pool=pool;this.data=seed();this.queue=Promise.resolve();}
 async init(){
  if(this.pool){await this.pool.query(`CREATE TABLE IF NOT EXISTS lf_commerce_state(id integer PRIMARY KEY CHECK(id=1),payload jsonb NOT NULL DEFAULT '{}'::jsonb);
   INSERT INTO lf_commerce_state(id,payload) VALUES (1,'{}'::jsonb) ON CONFLICT(id) DO NOTHING;
   CREATE TABLE IF NOT EXISTS lf_quote_records(seq bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), branch_id text NOT NULL, tier text NOT NULL, input_type text NOT NULL, payload jsonb NOT NULL);`);
  }else{try{this.data={...seed(),...JSON.parse(await readFile(file,'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}}
 }
 async config(){if(this.pool){const r=await this.pool.query('SELECT payload FROM lf_commerce_state WHERE id=1');return {...seed(),...r.rows[0].payload};}return copy(this.data);}
 async change(mutator){
  const operation=async()=>{
   if(this.pool){const c=await this.pool.connect();try{await c.query('BEGIN');const r=await c.query('SELECT payload FROM lf_commerce_state WHERE id=1 FOR UPDATE');const d={...seed(),...r.rows[0].payload};mutator(d);d.revision=(Number(d.revision)||0)+1;await c.query('UPDATE lf_commerce_state SET payload=$1 WHERE id=1',[JSON.stringify({...d,quotes:[],sequence:0})]);await c.query('COMMIT');return copy(d);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
   mutator(this.data);this.data.revision=(Number(this.data.revision)||0)+1;await mkdir(dirname(file),{recursive:true});const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(this.data,null,2),'utf8');await rename(tmp,file);return copy(this.data);
  };
  const task=this.queue.then(operation,operation);this.queue=task.catch(()=>{});return task;
 }
 async cardStyle(branchId){const state=await this.config();return {...(DEFAULT_CARD_STYLES[branchId]||DEFAULT_CARD_STYLES['sucursal-1']),...(state.branchCardStyles?.[branchId]||{})};}
 async saveCardStyle(branchId,style){await this.change(state=>{state.branchCardStyles||={};state.branchCardStyles[branchId]={...style};});return this.cardStyle(branchId);}
 async theme(branchId){const state=await this.config();return {...(DEFAULT_THEMES[branchId]||DEFAULT_THEMES['sucursal-1']),...(state.branchThemes?.[branchId]||{})};}
 async saveTheme(branchId,theme){await this.change(state=>{state.branchThemes||={};state.branchThemes[branchId]={...theme};});return this.theme(branchId);}
 async slides(branchId){const state=await this.config();return copy(Array.isArray(state.heroSlides?.[branchId])?state.heroSlides[branchId]:DEFAULT_HERO_SLIDES);}
 async interval(branchId){const state=await this.config();return Number(state.heroIntervals?.[branchId])||6;}
 async saveInterval(branchId,seconds){await this.change(state=>{state.heroIntervals||={};state.heroIntervals[branchId]=seconds;});return seconds;}
 async putSlide(branchId,slide){await this.change(state=>{state.heroSlides||={};let list=Array.isArray(state.heroSlides[branchId])?state.heroSlides[branchId]:copy(DEFAULT_HERO_SLIDES);const index=list.findIndex(x=>x.id===slide.id);if(index>=0)list[index]=slide;else list.push(slide);state.heroSlides[branchId]=list;});return slide;}
 async deleteSlide(branchId,id){await this.change(state=>{state.heroSlides||={};let list=Array.isArray(state.heroSlides[branchId])?state.heroSlides[branchId]:copy(DEFAULT_HERO_SLIDES);state.heroSlides[branchId]=list.filter(x=>x.id!==id);});}
 async reorderSlides(branchId,ids){await this.change(state=>{state.heroSlides||={};let list=Array.isArray(state.heroSlides[branchId])?state.heroSlides[branchId]:copy(DEFAULT_HERO_SLIDES);state.heroSlides[branchId]=ids.map(id=>list.find(x=>x.id===id)).filter(Boolean);});}
 async rates(branchId){const s=await this.config();return {...defaultRate,...s.rates?.[branchId]};}
 async saveRates(branchId,rates){await this.change(s=>{s.rates||={};s.rates[branchId]={...defaultRate,...rates};});return this.rates(branchId);}
 async listOffers(){if(!this.pool)return copy(this.data.timeOffers||[]);const s=await this.config();return s.timeOffers||[];}
 async putOffer(offer){await this.change(s=>{s.timeOffers||=[];const i=s.timeOffers.findIndex(o=>o.branchId===offer.branchId&&o.productId===offer.productId);if(i>=0)s.timeOffers[i]=offer;else s.timeOffers.push(offer);});return offer;}
 async deleteOffer(branchId,productId){await this.change(s=>{s.timeOffers=(s.timeOffers||[]).filter(o=>!(o.branchId===branchId&&o.productId===productId));});}
 async recordQuote(record){
  if(this.pool){const r=await this.pool.query('INSERT INTO lf_quote_records(branch_id,tier,input_type,payload) VALUES($1,$2,$3,$4) RETURNING seq,created_at',[record.branchId,record.tier,record.inputType,JSON.stringify(record)]);return {code:'LF-'+String(r.rows[0].seq).padStart(6,'0'),createdAt:r.rows[0].created_at};}
  let output;await this.change(s=>{s.sequence=(s.sequence||0)+1;output={...record,code:'LF-'+String(s.sequence).padStart(6,'0'),createdAt:new Date().toISOString()};s.quotes||=[];s.quotes.unshift(output);if(s.quotes.length>10000)s.quotes.length=10000;});return {code:output.code,createdAt:output.createdAt};
 }
 async quotes(){if(this.pool){const rows=await this.pool.query('SELECT seq,created_at,branch_id,payload FROM lf_quote_records ORDER BY seq DESC LIMIT 500');return rows.rows.map(r=>({...r.payload,code:'LF-'+String(r.seq).padStart(6,'0'),createdAt:r.created_at}));}return copy(this.data.quotes||[]);}
}
export function activeTimedOffer(t,now=Date.now()) {if(!t||!t.enabled)return false;const start=Date.parse(t.startAt||''),end=Date.parse(t.endAt||'');return Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&now<end;}
export function displayOffer(product,offer,timed,now=Date.now()){
 const record=timed?.find(t=>t.productId===product.id);
 if(activeTimedOffer(record,now) && Number(record.salePrice)>0 && Number(record.salePrice)<Number(offer.price))return {...product,...offer,price:Number(record.salePrice),compareAt:Number(offer.price),timeLimitedUntil:record.endAt,timeLimited:true};
 return {...product,...offer};
}
export function calculatePrintQuote({pages=0,copies=1,kind='copy',color='bw',coverage='low',colorPercent=30,duplex=false,scanFormat='pdf'},rates){
 pages=Math.floor(Number(pages));copies=Math.floor(Number(copies));
 if(!Number.isFinite(pages)||pages<1||pages>5000||!Number.isFinite(copies)||copies<1||copies>1000)throw Error('Indica de 1 a 5000 páginas y de 1 a 1000 copias');
 if(!['copy','print','scan'].includes(kind))throw Error('Tipo de servicio inválido');
 if(kind==='scan'){
  const unit=Number(rates.scanPage||0);
  if(!Number.isFinite(unit)||unit<=0)throw Error('La sucursal todavía no configuró la tarifa de escaneo por página.');
  const format=scanFormat==='jpg'?'jpg':'pdf';
  const total=pages*unit;
  const discount=pages>=rates.bulkAfter?Math.max(0,1-rates.bulkDiscount/100):1;
  return {total:Math.round(total*discount*100)/100,pages,faces:pages,sheets:0,unit:Math.round(unit*10000)/10000,kind:'scan',scanFormat:format};
 }
 if(!['bw','color','mixed'].includes(color)||!['low','medium','high'].includes(coverage))throw Error('Tipo de impresión inválido');
 const percent=Number(colorPercent);
 if(color==='mixed'&&(!Number.isFinite(percent)||percent<0||percent>100))throw Error('El porcentaje de color debe estar entre 0 y 100');
 const faces=pages*copies;
 const bwUnit=Number(kind==='copy'?rates.copyBW:rates.printBW);
 const baseColor=Number(kind==='copy'?rates.copyColor:rates.printColor);
 if((color==='color'||(color==='mixed'&&percent>0))&&baseColor<=0)throw Error('La sucursal todavía no configuró su tarifa para trabajos a color.');
 const factor=coverage==='low'?Math.max(.1,rates.coverageLow):coverage==='medium'?Math.max(.1,(rates.coverageLow+rates.coverageHigh)/2):Math.max(.1,rates.coverageHigh);
 const colorUnit=Math.min(rates.maxColor>0?rates.maxColor:Infinity,Math.max(rates.minColor,baseColor*factor));
 const colorPages=color==='mixed'?Math.round(pages*percent/100):color==='color'?pages:0;
 const bwPages=pages-colorPages;
 const colorFaces=colorPages*copies,bwFaces=bwPages*copies;
 const subtotal=bwFaces*bwUnit+colorFaces*colorUnit;
 let total=subtotal;
 if(faces>=rates.bulkAfter)total*=1-rates.bulkDiscount/100;
 if(duplex)total*=1-rates.duplexDiscount/100;
 const unit=faces?subtotal/faces:0;
 return {total:Math.round(total*100)/100,faces,sheets:duplex?Math.ceil(pages/2)*copies:faces,unit:Math.round(unit*10000)/10000,kind,color,coverage,duplex,colorPages,bwPages,colorFaces,bwFaces,bwUnit,colorUnit};
}
