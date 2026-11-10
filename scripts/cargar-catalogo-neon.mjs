/** Importador único del catálogo de La Favorita V35 a una base nueva de Neon.
 * Uso: node scripts/cargar-catalogo-neon.mjs --dry-run
 *      node --env-file=.env scripts/cargar-catalogo-neon.mjs --import
 * No escribe ningún archivo local, no copia precios entre sucursales y
 * aborta si la base ya tiene productos.
 */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=resolve(root,'data','catalog-bootstrap.json');
const flags=new Set(process.argv.slice(2));
function need(cond,message){if(!cond)throw Error(message);}
function text(v,defaultValue=''){return v==null?defaultValue:String(v);}
function number(v,name,min=0){const n=Number(v);need(Number.isFinite(n)&&n>=min,`${name}: valor numérico inválido`);return n;}
function integer(v,name,min=0){const n=number(v,name,min);need(Number.isInteger(n),`${name}: debe ser entero`);return n;}
function unique(rows,key,label){const keys=new Set();for(const item of rows){const val=key(item);need(val,`${label}: hay un identificador vacío`);need(!keys.has(val),`${label}: valor duplicado ${val}`);keys.add(val);}return keys;}
const catalog=JSON.parse(await readFile(file,'utf8'));
for(const part of ['branches','categories','products','offers','campaigns','sections','lexicon'])need(Array.isArray(catalog[part]),`Falta ${part} en el catálogo`);
need(catalog.settings&&typeof catalog.settings==='object'&&!Array.isArray(catalog.settings),'Falta la configuración general');
const branches=unique(catalog.branches,b=>b.id,'Sucursal');
const categories=unique(catalog.categories,c=>c.id,'Categoría');
const ids=unique(catalog.products,p=>p.id,'Producto');
unique(catalog.products,p=>String(p.sku||'').toLowerCase(),'SKU');
unique(catalog.offers,o=>`${o.branchId}|${o.productId}`,'Precio por sucursal');
for(const p of catalog.products){need(categories.has(p.categoryId),`Producto ${p.sku}: categoría inexistente`);need(p.name&&p.sku,`Producto ${p.id}: falta nombre o SKU`);integer(p.unitsPerPack??1,`Presentación de ${p.sku}`,1);}
for(const o of catalog.offers){need(branches.has(o.branchId),`Oferta: sucursal desconocida ${o.branchId}`);need(ids.has(o.productId),`Oferta: producto desconocido ${o.productId}`);number(o.price,`Precio ${o.productId}`);integer(o.stock??0,`Stock ${o.productId}`);integer(o.minStock??0,`Stock mínimo ${o.productId}`);}
const stats=Object.fromEntries(catalog.branches.map(b=>[b.id,{ofertas:catalog.offers.filter(o=>o.branchId===b.id).length,publicados:catalog.offers.filter(o=>o.branchId===b.id&&o.active&&o.price>0&&catalog.products.find(p=>p.id===o.productId)?.active).length}]));
console.log('Catálogo validado:',catalog.products.length,'productos,',catalog.offers.length,'ofertas,',catalog.branches.length,'sucursales.');
console.table(stats);
if(flags.has('--dry-run')){console.log('VALIDACIÓN TERMINADA: no se conectó a Neon ni se modificó nada.');process.exit(0);}
need(flags.has('--import'),'Usa --dry-run para validar o --import para instalar en una base NUEVA.');
need(process.env.DATABASE_URL?.startsWith('postgres'),'Falta DATABASE_URL. No se conectó a ningún servidor.');
need(!process.env.DATA_FILE,'La importación no utiliza DATA_FILE; deja esta variable sin configurar.');
process.env.SEED_DEMO_PRODUCTS='false';
const {createStore}=await import('../server/store.mjs');
const store=await createStore();
need(store.pool,'La conexión debe ser PostgreSQL/Neon; no se permite importar a archivo local.');
const client=await store.pool.connect();
async function insertBatch(table,columns,records,conflict,chunk=120){
 for(let start=0;start<records.length;start+=chunk){
  const slice=records.slice(start,start+chunk),values=[];
  const placeholders=slice.map((rec,i)=>{
   const row=columns.map(col=>{
    values.push(rec[col]===undefined?null:rec[col]);return '$'+values.length;
   });return '('+row.join(',')+')';
  });
  const cols=columns.map(c=>'"'+c+'"').join(',');
  const update=columns.filter(c=>!conflict.includes(c)).map(c=>`"${c}"=EXCLUDED."${c}"`).join(',');
  const sql=`INSERT INTO ${table} (${cols}) VALUES ${placeholders.join(',')} ON CONFLICT (${conflict.map(c=>'"'+c+'"').join(',')}) DO UPDATE SET ${update}`;
  await client.query(sql,values);
 }
}
const n=v=>v==null||v===''?null:Number(v);
try{
 const info=await client.query('SELECT current_database() AS db, current_user AS role');
 console.log(`Conexión establecida con la base «${info.rows[0].db}».`);
 const existing=await client.query('SELECT count(*)::integer AS n FROM products');
 need(existing.rows[0].n===0,`Esta base YA tiene ${existing.rows[0].n} productos. No se sobrescribió nada. Usa una base nueva o revisa los registros antes de migrar.`);
 const nonEmpty=await client.query('SELECT count(*)::integer AS n FROM offers');
 need(nonEmpty.rows[0].n===0,'La base ya tiene ofertas: operación cancelada sin cambios.');
 await client.query('BEGIN');
 const branchRows=catalog.branches.map(b=>({id:b.id,name:b.name,subtitle:text(b.subtitle),address:text(b.address),hours:text(b.hours),phone:text(b.phone),photo_url:text(b.photoUrl),photo_url2:text(b.photoUrl2),accent:text(b.accent,'#f026ad'),active:b.active!==false,sort_order:b.order??0,tag:text(b.tag)}));
 await insertBatch('branches',['id','name','subtitle','address','hours','phone','photo_url','photo_url2','accent','active','sort_order','tag'],branchRows,['id'],30);
 await insertBatch('categories',['id','name','icon','sort_order'],catalog.categories.map(c=>({id:c.id,name:c.name,icon:text(c.icon),sort_order:c.order??0})),['id'],30);
 const prods=catalog.products.map(p=>({id:p.id,sku:p.sku,name:p.name,brand:text(p.brand),category_id:p.categoryId,sub_category:text(p.subCategory),description:text(p.description),model:text(p.model),color:text(p.color),material:text(p.material),finish:text(p.finish),paper_gsm:n(p.paperGsm),usage:text(p.usage),features:text(p.features),search_aliases:text(p.searchAliases),comparison_group:text(p.comparisonGroup),comparison_label:text(p.comparisonLabel),quality_tier:p.qualityTier??2,unit_label:text(p.unitLabel,'unidad'),units_per_pack:p.unitsPerPack??1,net_content:n(p.netContent),net_unit:p.netUnit??null,image_url:text(p.imageUrl),is_service:p.isService===true||p.categoryId==='servicios',origin_type:text(p.originType,'SIN DETERMINAR'),is_new:p.isNew===true,featured:p.featured===true,active:p.active!==false,sort_order:p.order??0}));
 await insertBatch('products',['id','sku','name','brand','category_id','sub_category','description','model','color','material','finish','paper_gsm','usage','features','search_aliases','comparison_group','comparison_label','quality_tier','unit_label','units_per_pack','net_content','net_unit','image_url','is_service','origin_type','is_new','featured','active','sort_order'],prods,['id'],90);
 const offers=catalog.offers.map(o=>({branch_id:o.branchId,product_id:o.productId,price:o.price??0,compare_at:n(o.compareAt),stock:o.stock??0,min_stock:o.minStock??0,active:o.active===true}));
 await insertBatch('offers',['branch_id','product_id','price','compare_at','stock','min_stock','active'],offers,['branch_id','product_id'],150);
 const campaigns=catalog.campaigns.map(c=>({id:c.id,title:c.title,eyebrow:text(c.eyebrow),description:text(c.description),cta_label:text(c.ctaLabel,'Explorar'),category_id:c.categoryId??null,accent:text(c.accent,'#f026ad'),background:text(c.background),image_url:text(c.imageUrl),badge:text(c.badge),start_day:text(c.startDay,'01-01'),end_day:text(c.endDay,'12-31'),enabled:c.enabled===true,branches:JSON.stringify(c.branches||['all']),priority:c.priority??10}));
 await insertBatch('campaigns',['id','title','eyebrow','description','cta_label','category_id','accent','background','image_url','badge','start_day','end_day','enabled','branches','priority'],campaigns,['id'],30);
 await insertBatch('sections',['id','title','enabled','sort_order'],catalog.sections.map(s=>({id:s.id,title:s.title,enabled:s.enabled===true,sort_order:s.order??0})),['id'],30);
 await insertBatch('settings',['key','value'],Object.entries(catalog.settings).map(([key,v])=>({key,value:JSON.stringify(v)})),['key'],30);
 const aliases=catalog.lexicon.map(a=>({alias_key:a.aliasKey,alias_text:a.aliasText,canonical_term:a.canonicalTerm,status:a.status||'review',requires_review:a.requiresReview===true,note:text(a.note)}));
 if(aliases.length)await insertBatch('catalog_aliases',['alias_key','alias_text','canonical_term','status','requires_review','note'],aliases,['alias_key'],30);
 const sql=(await readFile(resolve(root,'db','04_enlazar_catalogo_v6.sql'),'utf8'))
   .replace(/^\s*BEGIN;\s*$/gmi,'').replace(/^\s*COMMIT;\s*$/gmi,'');
 await client.query(sql);
 await client.query('INSERT INTO app_meta(id,version) VALUES(1,1) ON CONFLICT(id) DO UPDATE SET version=app_meta.version+1,updated_at=now()');
 const [pCount,oCount,linked]=await Promise.all([
  client.query('SELECT count(*)::integer AS n FROM products'),
  client.query('SELECT count(*)::integer AS n FROM offers'),
  client.query('SELECT count(*)::integer AS n FROM sale_presentations')
 ]);
 need(pCount.rows[0].n===catalog.products.length,'La cantidad final de productos no coincide. Se cancelará la transacción.');
 need(oCount.rows[0].n===catalog.offers.length,'La cantidad final de ofertas no coincide. Se cancelará la transacción.');
 need(linked.rows[0].n===catalog.products.length,'Faltan asociaciones de presentaciones. Se cancelará la transacción.');
 const published=await client.query("SELECT count(*)::integer AS n FROM offers o JOIN products p ON p.id=o.product_id WHERE o.branch_id='sucursal-1' AND o.active AND o.price>0 AND p.active");
 need(published.rows[0].n===stats['sucursal-1'].publicados,'No coincide la cantidad de productos publicados en Sucursal 01.');
 await client.query('COMMIT');
 console.log(`IMPORTACIÓN COMPLETADA: ${pCount.rows[0].n} productos, ${oCount.rows[0].n} registros por sucursal y ${published.rows[0].n} publicados en Sucursal 01.`);
 console.log('Conserva tu DATABASE_URL en privado. Ahora puedes configurar esta base en Render.');
}catch(e){try{await client.query('ROLLBACK');}catch{}console.error('IMPORTACIÓN CANCELADA:',e.message);process.exitCode=1;}
finally{client.release();await store.close();}
