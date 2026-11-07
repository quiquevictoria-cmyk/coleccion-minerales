// ---- Fotos desde Wikipedia (se cargan al vuelo y se recuerdan en el navegador) ----
// Solo se guardan en caché las fotos encontradas; si una falla, se reintenta en la próxima visita.
const KEY='min-img-v5';
try{ localStorage.removeItem('min-img-v4'); }catch(e){}
try{ localStorage.removeItem('min-img-v3'); }catch(e){}
try{ localStorage.removeItem('min-img'); }catch(e){}
const cacheId = e=>e.q||e.en;
const cache = (()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } })();
const save = ()=>{ try{ localStorage.setItem(KEY, JSON.stringify(cache)); }catch(e){} };
const pending = {};
// Cola: como mucho 4 peticiones a la vez, para no saturar a Wikipedia
let running=0; const queue=[];
function limit(fn){ return new Promise(res=>{ queue.push(()=>fn().then(res,()=>res(null))); pump(); }); }
function pump(){ while(running<4 && queue.length){ running++; const job=queue.shift(); job().finally(()=>{ running--; pump(); }); } }
async function getJSON(u){ const r=await fetch(u); if(!r.ok) throw new Error(r.status); return r.json(); }
async function lookup(e){
  // 0) Si la ficha tiene búsqueda propia (q), se busca la foto directamente en Wikimedia Commons
  if(e.q){
    const c='https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime&iiurlwidth=500&gsrsearch='+encodeURIComponent('filetype:bitmap '+e.q);
    try{ const j=await getJSON(c); const ps=j.query?Object.values(j.query.pages).sort((a,b)=>a.index-b.index):[];
         const p=ps.find(x=>x.imageinfo&&/jpeg|png/.test(x.imageinfo[0].mime));
         if(p) return {src:p.imageinfo[0].thumburl, page:p.imageinfo[0].descriptionurl, commons:true}; }catch(err){}
  }
  // 1) API de Wikipedia: imagen principal del artículo, en anchura estándar (500 px)
  const u='https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=500&titles='+encodeURIComponent(e.en);
  try{ const j=await getJSON(u); const p=j.query&&Object.values(j.query.pages)[0];
       if(p&&p.thumbnail) return {src:p.thumbnail.source, page:p.fullurl}; }catch(err){}
  // 2) Si el artículo no tiene imagen, búsqueda por nombre
  const s='https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=3&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=500&gsrsearch='+encodeURIComponent(e.en+' mineral');
  try{ const j=await getJSON(s); const ps=j.query?Object.values(j.query.pages).sort((a,b)=>a.index-b.index):[];
       const p=ps.find(x=>x.thumbnail); if(p) return {src:p.thumbnail.source, page:p.fullurl}; }catch(err){}
  return null;
}
function imageFor(e){
  if (e.img) return Promise.resolve({src:e.img, own:true});
  const k=cacheId(e);
  if (cache[k]) return Promise.resolve(cache[k]);
  if (!pending[k]) pending[k] = limit(()=>lookup(e)).then(r=>{ if(r){ cache[k]=r; save(); } delete pending[k]; return r; });
  return pending[k];
}
function fill(img, e){
  imageFor(e).then(r=>{ if(!r) return;
    img.onload=()=>img.classList.add('on');
    img.onerror=()=>{ delete cache[cacheId(e)]; save(); };
    img.src = r.src; });
}

