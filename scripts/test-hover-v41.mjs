import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const motion=readFileSync(new URL('../public/experience-v7.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

assert(!motion.includes("document.querySelectorAll('.branch-card,.product-card,.quick-tool')"),'La inclinación del mouse no debe actuar sobre los productos');
assert(motion.includes("document.querySelectorAll('.branch-card,.quick-tool')"),'Se conservan los efectos de los otros elementos');
assert(styles.includes('.lfpr-slot:is(:hover,:focus-within) > .lfpr-motion > .product-card.product-v4'),'La elevación debe depender del slot estable');
assert(styles.includes('translate:none!important'),'No acumular translate y transform en la tarjeta');
assert(styles.includes('.lfpr-slot:is(:hover,:focus-within) .product-image img'),'Conservar el zoom suave de fotografías');
assert(/\/styles\.css\?v=(?:4[1-9]|[5-9]\d)-[\w-]+/.test(html),'El CSS debe usar una versión de caché actualizada');
console.log('OK V41: hover estable de productos, zoom de imágenes y sin inclinación por mouse.');
