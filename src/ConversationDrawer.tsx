import {useEffect,useRef} from 'react';

// Side menu of chat conversations, on the reading-start side (right in Hebrew, left in English).
// Opens only from its button; closes on Escape or a click anywhere outside it.
export default function ConversationDrawer({open,setOpen,conversations,messages,current,onSelect,onNew,busy}:{open:boolean;setOpen:(open:boolean)=>void;conversations:any[];messages:any[];current:string;onSelect:(id:string)=>void;onNew:()=>void;busy:boolean}){
 const side=(document.documentElement.getAttribute('dir')||document.dir||'rtl')==='ltr'?'left':'right';
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
  const outside=(e:PointerEvent)=>{const t=e.target as Element;if(panel.current?.contains(t)||t.closest?.('[data-drawer-toggle]'))return;setOpen(false);};
  window.addEventListener('keydown',key);document.addEventListener('pointerdown',outside,true);
  return()=>{window.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside,true);};},[open]);
 const items=conversations.map(c=>{const own=messages.filter(m=>m.conversation_id===c.id).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const last=own.length?own[own.length-1].created_at:c.created_at;
  const generic=['חקירה ראשונה','שיחה חדשה'].includes(c.title);
  return {id:c.id,label:generic&&own.length?own[0].content.slice(0,48):c.title,count:own.length,last};}).sort((a,b)=>b.last.localeCompare(a.last));
 return <>
  {open&&<aside ref={panel} className={`conversation-drawer drawer-${side}`} dir="rtl" aria-label="שיחות">
   <div className="drawer-head"><strong>שיחות</strong><button className="icon-button" aria-label="סגירת תפריט השיחות" onClick={()=>setOpen(false)}>×</button></div>
   <button className="primary drawer-new" disabled={busy} onClick={onNew}>＋ שיחה חדשה</button>
   <nav><ul>{items.map(item=><li key={item.id}><button className={item.id===current?'active':''} aria-current={item.id===current?'true':undefined} onClick={()=>{onSelect(item.id);setOpen(false);}}>
    <span>{item.label}</span><small>{item.count} הודעות · {new Date(item.last).toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})}</small></button></li>)}</ul>
   {!items.length&&<p className="muted">אין עדיין שיחות. כתבי הודעה כדי להתחיל.</p>}</nav>
  </aside>}
 </>;
}
