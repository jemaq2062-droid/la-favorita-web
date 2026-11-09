/** Restaurar un respaldo exportado desde el panel. Solo lo aplica con --apply. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createStore} from '../server/store.mjs';
const path=process.argv[2];
if(!path){console.error('Uso: node scripts/restaurar-respaldo.mjs respaldo.json --dry-run | --apply');process.exit(1);}
const apply=process.argv.includes('--apply');
if(apply&&!process.env.DATABASE_URL){console.error('Para aplicar el respaldo necesitas DATABASE_URL de Neon.');process.exit(1);}
const data=JSON.parse(await readFile(resolve(path),'utf8'));
for(const k of ['categories','branches','products','offers','campaigns','sections'])if(!Array.isArray(data[k]))throw new Error('El respaldo no contiene '+k);
if(!data.settings||typeof data.settings!=='object')throw new Error('El respaldo no contiene settings');
const skus=new Set();for(const p of data.products){if(!p.id||!p.sku||!p.categoryId)throw new Error('Producto incompleto');const key=p.sku.toLowerCase();if(skus.has(key))throw new Error('SKU duplicado '+p.sku);skus.add(key);}
console.log('Respaldo verificado:',Object.fromEntries(['branches','categories','products','offers','campaigns','sections'].map(k=>[k,data[k].length])));
if(!apply){console.log('No se cambió la base. Para importar de verdad, utiliza --apply después de revisar el respaldo.');process.exit(0);}
const store=await createStore();
try{
 const now=await store.read();
 for(const p of data.products){const conflict=now.products.find(x=>x.sku.toLowerCase()===p.sku.toLowerCase()&&x.id!==p.id);if(conflict)throw new Error('Conflicto de SKU con producto ya existente: '+p.sku);}
 // Mantener identificadores y precios exactos. No borrar registros ausentes en el respaldo.
 for(const kind of ['categories','branches','products','offers','campaigns','sections'])for(const item of data[kind])await store.put(kind,item);
 await store.put('settings',data.settings);
 for(const a of data.lexicon||[])await store.putAlias(a);
 console.log('Respaldo importado. Se conservaron los IDs de sucursales y productos.');
}finally{await store.close();}
