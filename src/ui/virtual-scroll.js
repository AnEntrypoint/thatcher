export function virtualScrollScript(containerId, rowHeight = 50, buffer = 5) {
  return `
(function(){
const c=document.getElementById('${containerId}');
if(!c)return;
const rh=${rowHeight};
const buf=${buffer};
let allRows=[];
let scrollT=null;

function init(){
  allRows=Array.from(c.querySelectorAll('tbody tr'));
  if(allRows.length<50)return;
  const tbody=c.querySelector('tbody');
  const wrap=document.createElement('div');
  wrap.style.position='relative';
  wrap.style.height=(allRows.length*rh)+'px';
  tbody.innerHTML='';
  tbody.appendChild(wrap);
  c.addEventListener('scroll',()=>{
    clearTimeout(scrollT);
    scrollT=setTimeout(render,16);
  });
  render();
}

function render(){
  const st=c.scrollTop||0;
  const ch=c.clientHeight||600;
  const start=Math.max(0,Math.floor(st/rh)-buf);
  const end=Math.min(allRows.length,Math.ceil((st+ch)/rh)+buf);
  const tbody=c.querySelector('tbody>div');
  if(!tbody)return;
  tbody.innerHTML='';
  for(let i=start;i<end;i++){
    const r=allRows[i].cloneNode(true);
    r.style.position='absolute';
    r.style.top=(i*rh)+'px';
    r.style.left='0';
    r.style.right='0';
    tbody.appendChild(r);
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}
})();
`.trim()
}

export function lazyLoadImages() {
  return `
(function(){
const obs=new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const img=e.target;
      if(img.dataset.src){
        img.src=img.dataset.src;
        delete img.dataset.src;
        obs.unobserve(img);
      }
    }
  });
},{rootMargin:'50px'});
document.querySelectorAll('img[data-src]').forEach(img=>obs.observe(img));
})();
`.trim()
}

export function deferOffscreen(selector = '.defer-load') {
  return `
(function(){
const obs=new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const el=e.target;
      const html=el.dataset.content;
      if(html){
        el.innerHTML=html;
        delete el.dataset.content;
        obs.unobserve(el);
      }
    }
  });
},{rootMargin:'100px'});
document.querySelectorAll('${selector}').forEach(el=>obs.observe(el));
})();
`.trim()
}

export function debounceInput(inputId, callback, delay = 300) {
  return `
(function(){
const inp=document.getElementById('${inputId}');
if(!inp)return;
let t=null;
inp.addEventListener('input',()=>{
  clearTimeout(t);
  t=setTimeout(()=>{${callback}},${delay});
});
})();
`.trim()
}
