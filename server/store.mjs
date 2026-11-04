import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const seedPath = join(root, 'data', 'seed.json');
const currentPath = process.env.DATA_FILE || join(root, 'data', 'current.json');
const clone = value => structuredClone(value);

const mappings = {
  branches: { table:'branches', fields:['id','name','subtitle','address','hours','phone','photoUrl','accent','active','order','tag'] },
  categories:{table:'categories',fields:['id','name','icon','order']},
  products:{table:'products',fields:['id','sku','name','brand','categoryId','subCategory','description','model','usage','features','searchAliases','comparisonGroup','comparisonLabel','qualityTier','unitLabel','unitsPerPack','netContent','netUnit','imageUrl','isNew','featured','active','order']},
  offers:{table:'offers',fields:['branchId','productId','price','compareAt','stock','minStock','active']},
  campaigns:{table:'campaigns',fields:['id','title','eyebrow','description','ctaLabel','categoryId','accent','background','badge','startDay','endDay','enabled','branches','priority']},
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
    catch(e){ if(e.code !== 'ENOENT') throw e; this.#state=JSON.parse(await readFile(seedPath,'utf8')); await this.#persist(); }
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
  async remove(kind,id){return this.#transaction(()=>{if(!['products','campaigns'].includes(kind))throw new Error('No permitido');this.#state[kind]=this.#state[kind].filter(x=>x.id!==id);if(kind==='products')this.#state.offers=this.#state.offers.filter(x=>x.productId!==id);});}
  async #transaction(fn){
    const run=async()=>{fn();this.#state.version+=1;await this.#persist();return this.#state.version;};
    const task=this.#writeQueue.then(run,run);this.#writeQueue=task.catch(()=>{});return task;
  }
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
    const {rows}=await this.pool.query('SELECT count(*)::integer AS count FROM branches');
    if(rows[0].count===0){
      const seed=JSON.parse(await readFile(seedPath,'utf8'));
      for (const kind of Object.keys(mappings)) for(const item of seed[kind]) await this.put(kind,item,false);
      await this.put('settings',seed.settings,false);
      await this.pool.query('INSERT INTO app_meta(id,version) VALUES(1,1) ON CONFLICT(id) DO NOTHING');
    }
  }
  async read(){
    const state={};
    for(const [kind,map] of Object.entries(mappings)){
      const {rows}=await this.pool.query(`SELECT * FROM ${map.table}`);
      state[kind]=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[camel(k),v]))).map(r=>{
        for(const f of ['price','compareAt','netContent'])if(r[f]!=null)r[f]=Number(r[f]);
        return r;
      });
    }
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
    }
    if(bump)await this.pool.query('INSERT INTO app_meta(id,version) VALUES (1,2) ON CONFLICT(id) DO UPDATE SET version=app_meta.version+1, updated_at=NOW()');
  }
  async remove(kind,id){
    if(!['products','campaigns'].includes(kind))throw new Error('No permitido');
    await this.pool.query(`DELETE FROM ${mappings[kind].table} WHERE id=$1`,[id]);
    await this.pool.query('UPDATE app_meta SET version=version+1,updated_at=NOW() WHERE id=1');
  }
  async close(){await this.pool.end();}
}

export async function createStore(){const store=process.env.DATABASE_URL?new PostgresStore():new JsonStore();await store.init();return store;}
