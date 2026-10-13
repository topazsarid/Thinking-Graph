import {useEffect,useState} from 'react';

// The visible line of local-model requests (extraction, replies, smart search).
// Ollama answers one at a time; the user can cancel waiting or running requests.
const STATUS:Record<string,string>={running:'פועל עכשיו',waiting:'ממתין בתור',cancelling:'מבטל…'};
const KIND:Record<string,string>={extraction:'חילוץ',reply:'תשובה'};

// Call right after sending a model request so the queue shows it without waiting for the next poll.
export function pokeQueue(){window.dispatchEvent(new Event('model-queue-poke'));}

export default function ModelQueue(){
 const [items,setItems]=useState<any[]>([]),[open,setOpen]=useState(true);
 useEffect(()=>{
  let stopped=false,timer:any;
  async function poll(){
   let next:any[]=[];
   try{const r=await fetch('/api/queue');if(r.ok)next=(await r.json()).items;}catch{}
   if(stopped)return;
   setItems(next);
   timer=setTimeout(poll,next.length?1500:4000);
  }
  function poke(){clearTimeout(timer);timer=setTimeout(poll,200);}
  window.addEventListener('model-queue-poke',poke);
  void poll();
  return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('model-queue-poke',poke);};
 },[]);
 async function cancel(id:string){
  setItems(old=>old.map(i=>i.id===id?{...i,status:'cancelling'}:i));
  try{await fetch(`/api/queue/${id}/cancel`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}catch{}
 }
 if(!items.length)return null;
 return <aside className="model-queue" dir="rtl" aria-label="תור המודל המקומי">
  <button className="model-queue-head" onClick={()=>setOpen(o=>!o)} aria-expanded={open}>תור המודל המקומי · {items.length}</button>
  {open&&<ol>{items.map((i,n)=><li key={i.id} className={`queue-${i.status}`}>
   <span><strong>{n+1}. {KIND[i.kind]||i.kind}</strong> · {STATUS[i.status]||i.status}<br/><small>{i.label}</small></span>
   <button className="secondary" disabled={i.status==='cancelling'} onClick={()=>void cancel(i.id)}>{i.status==='running'?'עצירה':'ביטול'}</button>
  </li>)}</ol>}
 </aside>;
}
