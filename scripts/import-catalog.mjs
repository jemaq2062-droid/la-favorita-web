/**
 * Importación futura de productos desde CSV (UTF-8) hacia el almacén actual.
 * Mantiene exactamente la misma API, tanto si el almacén es JSON como Neon.
 * Uso: node scripts/import-catalog.mjs ruta/al/catalogo.csv --dry-run
 *      node scripts/import-catalog.mjs ruta/al/catalogo.csv --hide-seed
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { createStore } from '../server/store.mjs';

const input=process.argv[2];
if(!input){console.error('Uso: node scripts/import-catalog.mjs archivo.csv [--dry-run] [--hide-seed]');process.exit(1);}
function parseCSV(txt){
  const data=[];let row=[],cell='',quoted=false;
  for(let i=0;i<txt.length;i++){
    const c=txt[i];
    if(c==='"') {if(quoted&&txt[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&c===','){row.push(cell);cell='';}
    else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()))data.push(row);row=[];}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV malformado: comillas sin cerrar');
  if(cell||row.length){row.push(cell);data.push(row);}
  const headers=(data.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,''));
  if(new Set(headers).size!==headers.length)throw new Error('Encabezados duplicados');
  return data.map((cells,i)=>{if(cells.length!==headers.length)throw new Error(`Fila ${i+2}: se esperaban ${headers.length} columnas, hay ${cells.length}`);return Object.fromEntries(headers.map((h,j)=>[h,cells[j].trim()]));});
}
const raw=await readFile(resolve(input),'utf8');
const rows=extname(input).toLowerCase()==='.json'?JSON.parse(raw):parseCSV(raw);
if(!Array.isArray(rows))throw new Error('Se necesita una lista de productos');
const required=['sku','nombre','marca','categoria'];
if(rows.length&&!required.every(k=>Object.hasOwn(rows[0],k)))throw new Error('Columnas obligatorias: sku,nombre,marca,categoria');
const store=await createStore();
const initial=await store.read();
const categories=new Set(initial.categories.map(x=>x.id));
const skus=new Set();const prepared=[];
function num(v,label,def=0){const n=v==null||v===''?def:Number(v);if(!Number.isFinite(n)||n<0)throw new Error(`Valor inválido en ${label}: ${v}`);return n;}
for(let i=0;i<rows.length;i++){
 const r=rows[i],index=i+2,sku=String(r.sku||'').trim();
 if(!sku||!r.nombre||!r.marca)throw new Error(`Fila ${index}: SKU, nombre y marca son obligatorios`);
 if(!categories.has(r.categoria))throw new Error(`Fila ${index}: categoría ${r.categoria} no existe`);
 if(skus.has(sku.toLowerCase()))throw new Error(`Fila ${index}: SKU duplicado ${sku}`);
 skus.add(sku.toLowerCase());
 const old=initial.products.find(p=>p.sku.toLowerCase()===sku.toLowerCase());
 const id=old?.id||'imp-'+createHash('sha256').update(sku).digest('hex').slice(0,18);
 let imageUrl='';if(r.imagen_url){const url=new URL(r.imagen_url);if(!['http:','https:'].includes(url.protocol))throw new Error(`Fila ${index}: URL de imagen incorrecta`);imageUrl=url.href;}
 const product={id,sku,name:String(r.nombre).trim(),brand:String(r.marca).trim(),categoryId:r.categoria,subCategory:String(r.subcategoria||'').trim(),description:String(r.descripcion||'').trim(),model:String(r.modelo||'').trim(),usage:String(r.uso||'').trim(),features:String(r.caracteristicas||'').trim(),searchAliases:String(r.aliases_busqueda||'').trim(),comparisonGroup:String(r.grupo_comparacion||'').trim(),comparisonLabel:String(r.nombre_comparacion||'').trim(),qualityTier:Math.max(1,Math.min(3,Number(r.nivel_calidad||2))),unitLabel:String(r.presentacion||'unidad').trim(),unitsPerPack:Math.max(1,Math.trunc(num(r.unidades_empaque,'unidades_empaque',1))),netContent:r.contenido_neto?num(r.contenido_neto,'contenido_neto'):null,netUnit:r.unidad_medida||null,imageUrl,isNew:r.nuevo==='1',featured:r.destacado==='1',active:true,order:old?.order||initial.products.length+i+1};
 const offers=initial.branches.map((b,j)=>({branchId:b.id,productId:id,price:num(r[`precio_${j+1}`],`precio_${j+1}`),compareAt:null,stock:Math.floor(num(r[`stock_${j+1}`],`stock_${j+1}`)),minStock:5,active:true}));
 prepared.push({product,offers});
}
console.log(`Productos validados: ${prepared.length}. Sucursales: ${initial.branches.length}.`);
if(process.argv.includes('--dry-run')){console.log('Modo validación: NO se cambió ningún dato.');await store.close();process.exit(0);}
for(const {product,offers} of prepared){await store.put('products',product);for(const offer of offers)await store.put('offers',offer);}
if(process.argv.includes('--hide-seed')){for(const p of initial.products.filter(p=>/^LF-\d{5}$/.test(p.sku)))await store.put('products',{...p,active:false});}
console.log('Importación finalizada. La tienda pública obtendrá los nuevos datos desde la API.');
await store.close();
