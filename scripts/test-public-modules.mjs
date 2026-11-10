import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PUBLIC=join(ROOT,'public');
const server=readFileSync(join(ROOT,'server/index.mjs'),'utf8');
const html=readFileSync(join(PUBLIC,'index.html'),'utf8');
const allowMatch=server.match(/if\(\[([^\n]+)\]\.includes\(pathname\)\)/);
assert.ok(allowMatch,'No se encontró la lista de archivos públicos del servidor');
const allowed=new Set([...allowMatch[1].matchAll(/['"](\/[^'"\s]+)['"]/g)].map(m=>m[1]));
const entry=[...html.matchAll(/<script\s+type="module"\s+src="([^"?]+)(?:\?[^\"]*)?"/g)].map(m=>m[1]);
assert.ok(entry.length,'La portada no define un módulo principal');
const checked=new Set();
function checkModule(url){
  const clean=url.split('?')[0];
  if(checked.has(clean))return;
  checked.add(clean);
  assert.ok(allowed.has(clean),`El servidor bloquea el módulo ${clean}; la web se quedará en la pantalla de carga`);
  const file=join(PUBLIC,clean.slice(1));
  assert.ok(existsSync(file),`El archivo ${clean} no existe`);
  const source=readFileSync(file,'utf8');
  for(const m of source.matchAll(/^import\s+.*?from\s+['"](\.[^'"]+)['"]/gm)){
    const resolved=new URL(m[1],`https://web.local${clean}`).pathname;
    checkModule(resolved);
  }
}
entry.forEach(checkModule);
console.log(`OK: ${checked.size} módulos de la tienda expuestos correctamente por el servidor.`);
