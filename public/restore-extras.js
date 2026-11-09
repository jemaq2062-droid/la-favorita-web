/* Restauración de entradas visibles en los paneles de Mi tienda.
   No sustituye los reveals existentes en títulos, categorías ni productos. */
export const EXTRA_REVEAL_OPTIONS={enabled:true,duration:940,stagger:140,threshold:.16};
let dispose=()=>{};
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function splitText(title){
 if(title.dataset.extraWords)return;
 const nodes=[];const walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())nodes.push(walker.currentNode);
 let i=0;
 for(const node of nodes){const frag=document.createDocumentFragment();
  for(const text of (node.textContent.match(/\s+|[^\s]+/g)||[])){
   if(/^\s+$/.test(text)){frag.append(document.createTextNode(text));continue;}
   const wrap=document.createElement('span');wrap.className='lf-extra-word-mask';
   const inner=document.createElement('span');inner.className='lf-extra-word';inner.style.setProperty('--lf-extra-index',i++);inner.textContent=text;wrap.append(inner);frag.append(wrap);
  }node.replaceWith(frag);
 }
 title.dataset.extraWords='1';
}
export function mountExtraReveals(){
 dispose();dispose=()=>{};
 if(!EXTRA_REVEAL_OPTIONS.enabled||reduce()||!('IntersectionObserver'in window))return;
 const sections=[...document.querySelectorAll('.service-overview,.quick-tools')];
 if(!sections.length)return;
 const nodes=[];
 const overview=document.querySelector('.service-overview');
 if(overview){
  const title=overview.querySelector('.section-heading h2');if(title){splitText(title);const heading=title.closest('.section-heading');if(heading){heading.classList.add('lf-extra-reveal','lf-extra-heading');nodes.push(heading);}}
  overview.querySelectorAll('.service-overview-grid>div').forEach((tile,i)=>{tile.classList.add('lf-extra-reveal','lf-extra-card');tile.style.setProperty('--lf-extra-delay',`${Math.min(i,5)*EXTRA_REVEAL_OPTIONS.stagger}ms`);nodes.push(tile);});
 }
 document.querySelectorAll('.quick-tools>.quick-tool').forEach((tile,i)=>{tile.classList.add('lf-extra-reveal','lf-extra-card');tile.style.setProperty('--lf-extra-delay',`${i*170}ms`);nodes.push(tile);});
 const observe=new IntersectionObserver(entries=>{
  entries.forEach(({target,isIntersecting,boundingClientRect})=>{
   if(isIntersecting)target.classList.add('lf-extra-visible');
   else if(boundingClientRect.top>innerHeight||boundingClientRect.bottom<0)target.classList.remove('lf-extra-visible');
  });
 },{rootMargin:'0px 0px -14% 0px',threshold:EXTRA_REVEAL_OPTIONS.threshold});
 nodes.forEach(x=>observe.observe(x));
 dispose=()=>{observe.disconnect();nodes.forEach(x=>x.classList.remove('lf-extra-reveal','lf-extra-visible','lf-extra-card','lf-extra-heading'));};
}
