import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const markup=read('public/site.js');
const styles=read('public/styles.css');
const page=read('public/index.html');
const names=['resaltadores','mochila','papel','silicona','arte','folders','calculadora','impresiones','navidad','plumones'];
for(const name of names){
 const file=resolve(root,'public/assets/categories',`${name}.webp`);
 assert.ok(statSync(file).size>2000,`Falta ilustración de categoría: ${name}`);
}
for(const name of ['bola-dorada.png','bola-roja.png','bola-verde.png']){
 assert.ok(statSync(resolve(root,'public/assets/categories',name)).size>500,`Falta imagen decorativa ${name}`);
}
assert.ok(markup.includes('function brandMarquee()'),'Falta franja de marcas dinámica');
assert.ok(markup.includes('available.has(fold(name))'),'Las marcas deben filtrarse contra el catálogo publicado');
assert.ok(markup.includes('lf42-category-tile'),'Falta nueva presentación de categorías');
assert.ok(markup.includes('lf42-season-ornaments'),'Faltan decoraciones de temporada');
assert.ok(markup.includes('lf42-image-seal'),'Falta distintivo comercial del banner');
assert.ok(markup.includes('featureSet')&&markup.includes('resolveHeroPrice'),'Deben conservarse características y precios editables');
assert.ok(styles.includes('grid-template-columns:repeat(5,minmax(0,1fr))!important'),'Se espera diseño visual de categorías en escritorio');
assert.ok(styles.includes('@keyframes lf42Brands'),'Falta movimiento continuo de marcas');
assert.ok(styles.includes('prefers-reduced-motion:reduce'),'La animación debe respetar movimiento reducido');
assert.ok((/site\.js\?v=(?:4[2-9]|[5-9]\d)-[\w-]+/.test(page)&&/styles\.css\?v=(?:4[2-9]|[5-9]\d)-[\w-]+/.test(page)),'Actualizar versiones de caché');
console.log('OK V42: ilustraciones locales, categorías, marcas del catálogo y decoración de banners; recursos y versión coherentes.');
