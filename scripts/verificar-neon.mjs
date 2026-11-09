/** Comprobacion de la base PostgreSQL real. Requiere DATABASE_URL. */
import {createStore} from '../server/store.mjs';
if(!process.env.DATABASE_URL){console.error('Falta DATABASE_URL. No se uso el archivo local.');process.exit(1);}
const store=await createStore();
try{
 const s=await store.read();
 console.log('Conexión y esquema PostgreSQL preparados.');
 console.log('Sucursales:',s.branches.length,'Productos:',s.products.length,'Ofertas:',s.offers.length,'Sinónimos:',s.lexicon.length);
 console.log('Versión de cambios:',s.version);
 console.log('Prueba de lectura completada. No modificó precios ni stock.');
}finally{await store.close();}
