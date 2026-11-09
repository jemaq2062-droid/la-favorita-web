import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const seedPath = process.env.INITIAL_CATALOG_FILE ? join(root, process.env.INITIAL_CATALOG_FILE) : join(root, 'data', 'seed.json');
const currentPath = process.env.DATA_FILE || join(root, 'data', 'current.json');
const clone = value => structuredClone(value);
const lexiconPath=join(root,'data','lexicon.json');
const aliasKey=v=>String(v||'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();

const mappings = {
  branches: { table:'branches', fields:['id','name','subtitle','address','hours','phone','photoUrl','photoUrl2','accent','active','order','tag'] },
  categories:{table:'categories',fields:['id','name','icon','order']},
  products:{table:'products',fields:['id','sku','name','brand','categoryId','subCategory','description','model','color','material','finish','paperGsm','usage','features','searchAliases','comparisonGroup','comparisonLabel','qualityTier','unitLabel','unitsPerPack','netContent','netUnit','imageUrl','isService','originType','isNew','featured','active','order']},
  offers:{table:'offers',fields:['branchId','productId','price','compareAt','stock','minStock','active']},
  campaigns:{table:'campaigns',fields:['id','title','eyebrow','description','ctaLabel','categoryId','accent','background','imageUrl','badge','startDay','endDay','enabled','branches','priority']},
  sections:{table:'sections',fields:['id','title','enabled','order']}
};
const customCols={order:'sort_order'};
const col = k => customCols[k] || k.replace(/[A-Z]/g, x=>'_'+x.toLowerCase());
const camel = k => k === 'sort_order' ? 'order' : k.replace(/_([a-z])/g, (_,c)=>c.toUpperCase());

export class JsonStore {
  #state;
  #writeQueue=Promise.resolve();
  async init(){
    await mkdir(dirname(currentPath),{recursive:true});
    try { this.#state=JSON.parse(await readFile(currentPath,'utf8')); }
    catch(e){ if(e.code !== 'ENOENT') throw e; this.#state=JSON.parse(await readFile(seedPath,'utf8')); }
    if(!this.#state.categories.some(x=>x.id==='servicios')){this.#state.categories.push({id:'servicios',name:'Servicios',icon:'printer',order:8});}
    for(const p of this.#state.products){if(!Object.hasOwn(p,'isService'))p.isService=p.categoryId==='servicios';}
    if (!Array.isArray(this.#state.lexicon)){this.#state.lexicon=JSON.parse(await readFile(lexiconPath,'utf8'));await this.#persist();}
    if(!this.#state.version) this.#state.version=1;
  }
  async #persist(){const temp=`${currentPath}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(this.#state,null,2),'utf8');await rename(temp,currentPath);}
  async read(){await this.#writeQueue;return clone(this.#state);}
  async put(kind, entity){
    if(!mappings[kind] && kind!=='settings')throw new Error('Entidad desconocida');
    return this.#transaction(()=>{
      if(kind==='settings')this.#state.settings=clone(entity);
      else {
        const arr=this.#state[kind];
        const index=arr.findIndex(e=>kind==='offers' ? e.branchId===entity.branchId && e.productId===entity.productId : e.id===entity.id);
        if(index>=0)arr[index]=clone(entity);else arr.push(clone(entity));
      }
    });
  }

  async bulkPublish(branchId,productIds,active){
    const unique=new Set(productIds);
    let changed=0,skipped=0;
    await this.#transaction(()=>{
      for(const offer of this.#state.offers){
        if(offer.branchId!==branchId||!unique.has(offer.productId))continue;
        if(active&&(Number(offer.price)<=0||!this.#state.products.find(p=>p.id===offer.productId)?.active)){skipped++;continue;}
        if(offer.active!==active){offer.active=active;changed++;}
      }
    });
    return {changed,skipped};
  }
  async initializeBranchOffers(branchId){
    return this.#transaction(()=>{for(const product of this.#state.products){
      if(!this.#state.offers.some(o=>o.branchId===branchId&&o.productId===product.id))this.#state.offers.push({branchId,productId:product.id,price:0,compareAt:null,stock:0,minStock:5,active:false});
    }});
  }
  async remove(kind,id){return this.#transaction(()=>{if(!['products','campaigns'].includes(kind))throw new Error('No permitido');this.#state[kind]=this.#state[kind].filter(x=>x.id!==id);if(kind==='products')this.#state.offers=this.#state.offers.filter(x=>x.productId!==id);});}
  async #transaction(fn){
    const run=async()=>{fn();this.#state.version+=1;await this.#persist();return this.#state.version;};
    const task=this.#writeQueue.then(run,run);this.#writeQueue=task.catch(()=>{});return task;
  }
  async putAlias(alias){const key=aliasKey(alias.aliasText);if(!key)throw new Error('Alias vacío');return this.#transaction(()=>{const item={aliasKey:key,aliasText:String(alias.aliasText),canonicalTerm:String(alias.canonicalTerm),status:alias.status||'review',requiresReview:alias.status!=='approved',note:alias.note||''};const i=this.#state.lexicon.findIndex(x=>x.aliasKey===key);if(i>=0)this.#state.lexicon[i]=item;else this.#state.lexicon.push(item);});}
  async removeAlias(key){return this.#transaction(()=>{this.#state.lexicon=this.#state.lexicon.filter(x=>x.aliasKey!==aliasKey(key));});}
  async recordQuote(){}
  async close(){}
}

export class PostgresStore {
  pool;
  async init(){
    let pkg;
    try { pkg=await import('pg'); } catch { throw new Error('Para PostgreSQL instala pg: npm install pg'); }
    this.pool=new pkg.default.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='false'?false:{rejectUnauthorized: true},max:8,connectionTimeoutMillis:10000});
    const schema=await readFile(join(root,'db','schema.sql'),'utf8');
    await this.pool.query(schema);
    await this.pool.query("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT ''");
    const migration=await this.pool.query("SELECT to_regclass('public.catalog_schema_versions') AS relation");
    if(!migration.rows[0]?.relation)await this.pool.query(await readFile(join(root,'db','02_ampliacion_comercial.sql'),'utf8'));
    const {rows}=await this.pool.query('SELECT count(*)::integer AS count FROM branches');
    if(rows[0].count===0){
      const seed=JSON.parse(await readFile(seedPath,'utf8'));
      for (const kind of Object.keys(mappings)) {
        if(process.env.SEED_DEMO_PRODUCTS==='false' && ['products','offers'].includes(kind))continue;
        for(const item of seed[kind])await this.put(kind,item,false);
      }
      await this.put('settings',seed.settings,false);
      await this.pool.query('INSERT INTO app_meta(id,version) VALUES(1,1) ON CONFLICT(id) DO NOTHING');
    }
    await this.pool.query(await readFile(join(root,'db','03_datos_semilla_vocabulario.sql'),'utf8'));
    const needsLink=await this.pool.query(`SELECT EXISTS(SELECT 1 FROM products p
      LEFT JOIN sale_presentations sp ON sp.product_id=p.id WHERE sp.product_id IS NULL) AS missing`);
    if(needsLink.rows[0].missing)await this.pool.query(await readFile(join(root,'db','04_enlazar_catalogo_v6.sql'),'utf8'));
    await this.pool.query(await readFile(join(root,'db','07_v23_servicios.sql'),'utf8'));
  }
  async read(){
    const state={};
    for(const [kind,map] of Object.entries(mappings)){
      const {rows}=await this.pool.query(`SELECT * FROM ${map.table}`);
      state[kind]=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[camel(k),v]))).map(r=>{
        for(const f of ['price','compareAt','netContent','paperGsm'])if(r[f]!=null)r[f]=Number(r[f]);
        return r;
      });
    }
    const aliasRows=await this.pool.query('SELECT alias_key AS "aliasKey", alias_text AS "aliasText", canonical_term AS "canonicalTerm", status, requires_review AS "requiresReview", note FROM catalog_aliases ORDER BY alias_text');
    state.lexicon=aliasRows.rows;
    const {rows}=await this.pool.query('SELECT key,value FROM settings');
    state.settings=Object.fromEntries(rows.map(r=>[r.key,r.value]));
    const v=await this.pool.query('SELECT version FROM app_meta WHERE id=1');
    state.version=Number(v.rows[0]?.version||1);
    return state;
  }
  async put(kind,entity,bump=true){
    if(kind==='settings'){
      for(const [key,value] of Object.entries(entity))await this.pool.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[key,JSON.stringify(value)]);
    } else {
      const map=mappings[kind];if(!map)throw new Error('Entidad no reconocida');
      const fields=map.fields.filter(x=>Object.hasOwn(entity,x));
      const cols=fields.map(col);
      const values=fields.map(f=>f==='branches' && kind==='campaigns' ? JSON.stringify(entity[f]) : entity[f]);
      const conflict=kind==='offers' ? '(branch_id,product_id)' : '(id)';
      const updated=cols.filter(c=>kind==='offers'?!['branch_id','product_id'].includes(c):c!=='id');
      const sql=`INSERT INTO ${map.table} (${cols.join(',')}) VALUES (${cols.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT ${conflict} DO UPDATE SET ${updated.map(c=>`${c}=EXCLUDED.${c}`).join(',')}`;
      await this.pool.query(sql,values);
      if(kind==='products'&&bump)await this.syncProduct(entity.id);
    }
    if(bump)await this.pool.query('INSERT INTO app_meta(id,version) VALUES (1,2) ON CONFLICT(id) DO UPDATE SET version=app_meta.version+1, updated_at=NOW()');
  }

  async bulkPublish(branchId,productIds,active){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const valid=active?'AND o.price>0 AND p.active=TRUE':'';
      const sql=`UPDATE offers o SET active=$3 FROM products p
        WHERE o.branch_id=$1 AND o.product_id=ANY($2::text[]) AND p.id=o.product_id ${valid} AND o.active IS DISTINCT FROM $3`;
      const result=await client.query(sql,[branchId,productIds,active]);
      const skipped=active?(await client.query(`SELECT count(*)::integer AS n FROM offers o JOIN products p ON p.id=o.product_id WHERE o.branch_id=$1 AND o.product_id=ANY($2::text[]) AND (o.price<=0 OR p.active=FALSE)`,[branchId,productIds])).rows[0].n:0;
      if(result.rowCount)await client.query('UPDATE app_meta SET version=version+1,updated_at=now() WHERE id=1');
      await client.query('COMMIT');return {changed:result.rowCount,skipped};
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async initializeBranchOffers(branchId){
    // A single bulk SQL operation: does not issue thousands of Neon requests.
    await this.pool.query(`INSERT INTO offers(branch_id,product_id,price,compare_at,stock,min_stock,active)
      SELECT $1,id,0,NULL,0,5,FALSE FROM products ON CONFLICT(branch_id,product_id) DO NOTHING`,[branchId]);
  }
  async remove(kind,id){
    if(!['products','campaigns'].includes(kind))throw new Error('No permitido');
    await this.pool.query(`DELETE FROM ${mappings[kind].table} WHERE id=$1`,[id]);
    await this.pool.query('UPDATE app_meta SET version=version+1,updated_at=NOW() WHERE id=1');
  }
  async syncProduct(productId){
    await this.pool.query(`INSERT INTO brands(name) SELECT brand FROM products WHERE id=$1 AND btrim(brand)<>'' ON CONFLICT(name) DO NOTHING`,[productId]);
    await this.pool.query(`INSERT INTO product_families(family_key,canonical_name,brand_name,category_id,comparison_group)
      SELECT 'v6:'||id,name,brand,category_id,comparison_group FROM products WHERE id=$1
      ON CONFLICT(family_key) DO UPDATE SET canonical_name=EXCLUDED.canonical_name,
      brand_name=EXCLUDED.brand_name,category_id=EXCLUDED.category_id,comparison_group=EXCLUDED.comparison_group`,[productId]);
    await this.pool.query(`INSERT INTO product_variants(family_id,variant_key,linked_product_id,model,color,material,finish,measure_value,measure_unit,paper_gsm)
      SELECT f.id,'v6:'||p.id,p.id,p.model,p.color,p.material,p.finish,
      CASE WHEN p.net_unit IN ('g','kg','ml','l','unidad','cm','m','mm','hoja','rollo','pieza','set') THEN p.net_content END,
      CASE WHEN p.net_unit IN ('g','kg','ml','l','unidad','cm','m','mm','hoja','rollo','pieza','set') THEN p.net_unit END,
      COALESCE(p.paper_gsm, CASE WHEN p.net_unit IN ('g/m²','g/m2','gsm') THEN p.net_content END)
      FROM products p JOIN product_families f ON f.family_key='v6:'||p.id WHERE p.id=$1
      ON CONFLICT(variant_key) DO UPDATE SET model=EXCLUDED.model,color=EXCLUDED.color,material=EXCLUDED.material,finish=EXCLUDED.finish,measure_value=EXCLUDED.measure_value,
      measure_unit=EXCLUDED.measure_unit,paper_gsm=EXCLUDED.paper_gsm`,[productId]);
    await this.pool.query(`INSERT INTO sale_presentations(product_id,variant_id,presentation_kind,base_quantity,base_unit,requires_sealed_pack)
      SELECT p.id,v.id,p.unit_label,p.units_per_pack,'unidad',p.units_per_pack>1
      FROM products p JOIN product_variants v ON v.variant_key='v6:'||p.id WHERE p.id=$1
      ON CONFLICT(product_id) DO UPDATE SET presentation_kind=EXCLUDED.presentation_kind,
      base_quantity=EXCLUDED.base_quantity,requires_sealed_pack=EXCLUDED.requires_sealed_pack`,[productId]);
    await this.pool.query(`UPDATE product_images i SET image_url=p.image_url,alt_text=p.name
      FROM products p WHERE i.product_id=p.id AND i.is_primary AND p.id=$1 AND p.image_url~*'^https?://'`,[productId]);
    await this.pool.query(`INSERT INTO product_images(product_id,image_url,alt_text,is_primary)
      SELECT p.id,p.image_url,p.name,TRUE FROM products p WHERE p.id=$1 AND p.image_url~*'^https?://'
        AND NOT EXISTS(SELECT 1 FROM product_images i WHERE i.product_id=p.id AND i.is_primary)
      ON CONFLICT(product_id,image_url) DO NOTHING`,[productId]);
  }
  async openPackage(branchId,packageProductId,unitProductId,count){
    const r=await this.pool.query('SELECT open_sealed_packages($1,$2,$3,$4) AS id',[branchId,packageProductId,unitProductId,count]);
    await this.pool.query('UPDATE app_meta SET version=version+1,updated_at=now() WHERE id=1');
    return r.rows[0]?.id;
  }
  async putAlias(alias){
    const key=aliasKey(alias.aliasText);if(!key)throw new Error('Alias vacío');
    await this.pool.query(`INSERT INTO catalog_aliases(alias_key,alias_text,canonical_term,status,requires_review,note)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(alias_key) DO UPDATE SET alias_text=EXCLUDED.alias_text,
      canonical_term=EXCLUDED.canonical_term,status=EXCLUDED.status,requires_review=EXCLUDED.requires_review,
      note=EXCLUDED.note,updated_at=now()`,[key,alias.aliasText,alias.canonicalTerm,alias.status||'review',alias.status!=='approved',alias.note||'']);
    await this.pool.query('UPDATE app_meta SET version=version+1,updated_at=NOW() WHERE id=1');
  }
  async removeAlias(key){await this.pool.query('DELETE FROM catalog_aliases WHERE alias_key=$1',[aliasKey(key)]);await this.pool.query('UPDATE app_meta SET version=version+1,updated_at=NOW() WHERE id=1');}
  async recordQuote({branchId,tier,inputType,result}){
    if(process.env.SAVE_QUOTE_HISTORY!=='true')return;
    const {randomUUID}=await import('node:crypto');const id=randomUUID();
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      await client.query('INSERT INTO quote_requests(id,branch_id,tier,input_type,total,included_count,missing_count,complete) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,branchId,tier,inputType,result.total,result.includedCount,result.missing.length+result.unrecognized.length,result.complete]);
      for(const u of result._used||[])await client.query('INSERT INTO quote_lines(quote_id,product_id,quantity,line_status,line_total) VALUES($1,$2,$3,$4,$5)',[id,u.productId,u.quantity,'matched',Math.round(u.price*u.quantity*100)/100]);
      for(const n of result.missing)await client.query('INSERT INTO quote_lines(quote_id,requested_text,line_status) VALUES($1,$2,$3)',[id,n,'not_found']);
      for(const n of result.unrecognized)await client.query('INSERT INTO quote_lines(quote_id,requested_text,line_status) VALUES($1,$2,$3)',[id,n,'unclear']);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async close(){await this.pool.end();}
}

export async function createStore(){const store=process.env.DATABASE_URL?new PostgresStore():new JsonStore();await store.init();return store;}
