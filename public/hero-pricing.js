const parsePrice=value=>{
 const s=String(value??'').trim().replace(/^s\/?\s*/i,'').replace(/\s+/g,'').replace(',','.');
 if(!s)return null;
 const n=Number(s);
 return Number.isFinite(n)&&n>0&&n<=999999?n:null;
};
const money=n=>'S/ '+Number(n).toFixed(2);
const clean=value=>String(value??'').trim();
export function resolveHeroPrice(slide,products=[]){
 const linked=slide.productId?products.find(p=>p.id===slide.productId&&Number(p.price)>0):null;
 const manual=parsePrice(slide.priceOverride);
 const embedded=parsePrice(slide.price);
 const primary=manual??embedded??parsePrice(linked?.price);
 const previousManual=parsePrice(slide.compareAtOverride);
 const previousCandidate=previousManual??parsePrice(slide.compareAt)??parsePrice(linked?.compareAt);
 const previous=primary!==null&&previousCandidate!==null&&previousCandidate>primary?previousCandidate:null;
 const discount=previous?Math.round(100*(previous-primary)/previous):0;
 const caption=clean(slide.priceCaption)||(linked?`${linked.name} · precio de esta sucursal`:'Configura el precio de esta promoción en el administrador');
 const kicker=clean(slide.priceKicker)||(primary!==null?'PRECIO ESPECIAL':'PROMOCIÓN ESPECIAL');
 const tag=clean(slide.priceTag)||(discount?`AHORRA ${discount}%`:'NOVEDADES');
 return {primary:primary!==null?money(primary):'Consultar',previous:previous!==null?money(previous):'',discount,caption,kicker,tag,related:linked,hasNumericPrice:primary!==null,source:manual!==null?'manual':embedded!==null?'product':linked?'linked':'none'};
}
