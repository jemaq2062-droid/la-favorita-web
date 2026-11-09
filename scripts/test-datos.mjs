import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseTypedList,quoteFromItems,normalizeSchoolText} from '../server/catalog.mjs';
const seed=JSON.parse(await readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
seed.lexicon=JSON.parse(await readFile(new URL('../data/lexicon.json',import.meta.url),'utf8'));
for(const [text,quantity,name] of [
 ['4lapiceros azules',4,'lapiceros azules'],
 ['4 lapiceros azules',4,'lapiceros azules'],
 ['2xlapicero azul',2,'lapicero azul'],
 ['2 cajas de plumones x12',2,'cajas de plumones x12'],
 ['250 ml silicona',1,'250 ml silicona']
]){const parsed=parseTypedList(text);assert.equal(parsed[0].quantity,quantity,text);assert.equal(parsed[0].name,name,text);}
assert.equal(normalizeSchoolText('bolígrafos azules',seed.lexicon),'lapicero azul');
assert.equal(normalizeSchoolText('lapiseros',seed.lexicon),'lapicero');
const quote=quoteFromItems(seed,'sucursal-1',parseTypedList('4lapiceros azules\n2 bolígrafos Pilot\n1 corros pun escarchado'),'economica');
assert.equal(quote.includedCount,2);assert.equal(quote.unrecognized.length,1);assert.equal(quote.complete,false);assert(quote.total>0);
assert(!('_madeUp' in quote));
for(const file of ['db/schema.sql','db/02_ampliacion_comercial.sql','db/03_datos_semilla_vocabulario.sql','db/04_enlazar_catalogo_v6.sql']){
 const sql=await readFile(new URL('../'+file,import.meta.url),'utf8');assert(sql.includes('BEGIN;')&&sql.includes('COMMIT;'),file);
}
const full=await readFile(new URL('../db/02_ampliacion_comercial.sql',import.meta.url),'utf8');
for(const table of ['product_families','product_variants','sale_presentations','catalog_aliases','product_images','inventory_movements','package_openings','quote_requests','quote_lines','external_catalog_links'])
 assert(full.includes(`TABLE IF NOT EXISTS ${table}`),table);
console.log('OK: cantidades pegadas, sinonimos, terminos dudosos, cotizaciones y estructura extendida.');
