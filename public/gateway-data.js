/* Configuración editable solo de la portada. La información del administrador
   tiene prioridad; no modifica PostgreSQL ni las rutas de cada sucursal.
   Sustituye direcciones y horarios vacíos únicamente cuando los conozcas. */
export const GATEWAY_DATA={
 contact:{phone:'903470891',whatsappUrl:'https://wa.me/51903470891'},
 social:{instagram:'',facebook:'',tiktok:''},
 legal:{termsUrl:'',privacyUrl:''},
 branches:{
  'sucursal-1':{name:'',address:'',district:'',hours:'',phone:'',whatsappUrl:'',mapUrl:'',photoUrl:'',photoUrl2:'',hoursByDay:{}},
  'sucursal-2':{name:'',address:'',district:'',hours:'',phone:'',whatsappUrl:'',mapUrl:'',photoUrl:'',photoUrl2:'',hoursByDay:{}},
  'sucursal-3':{name:'',address:'',district:'',hours:'',phone:'',whatsappUrl:'',mapUrl:'',photoUrl:'',photoUrl2:'',hoursByDay:{}},
  'sucursal-4':{name:'',address:'',district:'',hours:'',phone:'',whatsappUrl:'',mapUrl:'',photoUrl:'',photoUrl2:'',hoursByDay:{}}
 }
};
/* Para el estado abierto/cerrado, añade en hoursByDay los días 0 (domingo)
   a 6 (sábado), por ejemplo: {"1":[["08:00","20:00"]],"2":...}.
   No se supone ningún horario si no está configurado. */
export function extendBranch(branch){
 const defaults=GATEWAY_DATA.branches[branch.id]||{};
 const merged={...branch};
 for(const [field,value] of Object.entries(defaults)){
  if(field==='hoursByDay'){merged.hoursByDay=value;continue;}
  if(typeof value!=='string'||!value.trim())continue;
  const actual=String(merged[field]||'').trim();
  const provisional=/por confirmar/i.test(actual)||(field==='name'&&/^Sucursal\s*0?\d+$/i.test(actual));
  if(!actual||provisional)merged[field]=value;
 }
 return merged;
}
export function gatewayWhatsApp(branch){
 const value=branch?.whatsappUrl||GATEWAY_DATA.branches[branch?.id]?.whatsappUrl||GATEWAY_DATA.contact.whatsappUrl;
 return /^https:\/\/(wa\.me\/|api\.whatsapp\.com\/)/.test(value)?value:'https://wa.me/51903470891';
}
const minutes=value=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));return m?Number(m[1])*60+Number(m[2]):null;};
export function gatewayBranchStatus(branch,now=new Date()){
 const hours=branch?.hoursByDay||GATEWAY_DATA.branches[branch?.id]?.hoursByDay||{};
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=type=>parts.find(p=>p.type===type)?.value||'';
 const day={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[get('weekday')];
 const ranges=hours[day];
 if(!Array.isArray(ranges)||!ranges.length)return null;
 const minute=Number(get('hour'))*60+Number(get('minute'));
 const formatted=t=>`${Number(t.split(':')[0])%12||12}:${t.split(':')[1]} ${Number(t.split(':')[0])>=12?'p. m.':'a. m.'}`;
 for(const range of ranges){
  const start=minutes(range?.[0]),end=minutes(range?.[1]);
  if(start===null||end===null)continue;
  if(minute>=start&&minute<end)return {open:true,label:`Abierto ahora · hasta ${formatted(range[1])}`};
 }
 const future=ranges.find(r=>minutes(r?.[0])!==null&&minutes(r[0])>minute);
 return {open:false,label:future?`Cerrado · abre a las ${formatted(future[0])}`:'Cerrado por hoy'};
}
