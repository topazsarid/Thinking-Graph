import {useRef,useState} from 'react';
import {requestReply,type ReplyMode} from './requestReply';
import {searchIdeas,type IdeaHit} from './mapSearch';
import {pokeQueue} from './ModelQueue';

// Three reply choices under each user message. Nothing runs until the user clicks.
// Requests do not use the app's busy lock, so the rest of the app keeps working meanwhile.
const MODES:{mode:ReplyMode;label:string;hint:string}[]=[
 {mode:'self',label:'התייעצות עם עצמך',hint:'שיקוף של מה שכתבת ושאלה אחת — כמו להתייעץ עם עצמך, בלי ידע חיצוני'},
 {mode:'search',label:'חיפוש במפה שלי',hint:'חיפוש טקסט מהיר ברעיונות שלך; אם לא נמצא, אפשר לבקש חיפוש חכם'},
 {mode:'external',label:'יועץ חיצוני',hint:'תשובה עם ידע כללי של המודל המקומי — לא עובדה מאומתת, ואינה נכנסת למפה שלך'},
];
const LABELS:Record<string,string>={self:'שיקוף · כמו להתייעץ עם עצמך',external:'יועץ חיצוני · ידע כללי של מודל מקומי, לא עובדה מאומתת',search:'חיפוש חכם במפה'};

type Props={message:any;graph:any;workspaceId:string;onReveal:(ids:string[],workspaceId:string)=>void;onRefresh:()=>Promise<any>;onExternal:()=>void};

export default function MessageReplies({message,graph,workspaceId,onReveal,onRefresh,onExternal}:Props){
 const [pending,setPending]=useState<ReplyMode[]>([]),[error,setError]=useState(''),[search,setSearch]=useState<{hits:IdeaHit[]}|null>(null);
 const requestIds=useRef<Partial<Record<ReplyMode,string>>>({});
 const replies=(graph.chat_replies||[]).filter((r:any)=>r.message_id===message.id);
 const titleOf=(id:string)=>graph.ideas.find((i:any)=>i.id===id)?.title;
 const workspaceTitle=(id:string)=>graph.workspaces.find((w:any)=>w.id===id)?.title||'מרחב אחר';

 // Prefer showing an idea in the current workspace; otherwise its first workspace.
 function reveal(ids:string[]){
  const inCurrent=ids.filter(id=>graph.workspace_ideas.some((w:any)=>w.idea_id===id&&w.workspace_id===workspaceId));
  if(inCurrent.length){onReveal(inCurrent,workspaceId);return;}
  const other=graph.workspace_ideas.find((w:any)=>w.idea_id===ids[0])?.workspace_id;
  if(other)onReveal(ids.filter(id=>graph.workspace_ideas.some((w:any)=>w.idea_id===id&&w.workspace_id===other)),other);
 }

 async function ask(mode:ReplyMode){
  if(pending.includes(mode))return;
  setError('');setPending(p=>[...p,mode]);
  requestIds.current[mode]??=crypto.randomUUID();
  try{
   const request=requestReply({requestId:requestIds.current[mode]!,messageId:message.id,workspaceId:workspaceId||undefined,mode});
   pokeQueue();
   const reply=await request;
   delete requestIds.current[mode];
   await onRefresh().catch(()=>{});
   if(mode==='external')onExternal();
   if(mode==='search'){const ids=JSON.parse(reply.idea_ids||'[]');if(ids.length)reveal(ids);}
  }catch(e){
   if(e instanceof Error&&e.name==='Cancelled')delete requestIds.current[mode];
   else setError(e instanceof Error?e.message:'התשובה נכשלה');
  }finally{setPending(p=>p.filter(m=>m!==mode));}
 }

 function textSearch(){
  const hits=searchIdeas(message.content,graph.ideas,graph.workspace_ideas);
  setSearch({hits});
  const here=hits.filter(h=>h.workspaceIds.includes(workspaceId));
  if(here.length)onReveal(here.slice(0,3).map(h=>h.id),workspaceId);
 }

 const here=search?.hits.filter(h=>h.workspaceIds.includes(workspaceId))||[];
 const elsewhere=search?.hits.filter(h=>!h.workspaceIds.includes(workspaceId)&&h.workspaceIds.length)||[];
 return <div className="message-replies">
  <div className="reply-actions" role="group" aria-label="בקשת תשובה">{MODES.map(m=><button key={m.mode} className={`reply-choice reply-${m.mode}`} title={m.hint} disabled={pending.includes(m.mode)} onClick={()=>m.mode==='search'?textSearch():void ask(m.mode)}>{pending.includes(m.mode)?'ממתינה לתשובה…':m.label}</button>)}</div>
  {search&&<div className="assistant-reply reply-search" aria-live="polite">
   <small>חיפוש טקסט במפות שלך</small>
   {here.length>0&&<p>נמצא במפה הנוכחית: {here.map(h=><button key={h.id} className="link-chip" onClick={()=>onReveal([h.id],workspaceId)}>{h.title}</button>)}</p>}
   {!here.length&&elsewhere.length>0&&<p>לא במפה הנוכחית, אבל נמצא {elsewhere.map(h=><button key={h.id} className="link-chip" onClick={()=>onReveal([h.id],h.workspaceIds[0])}>{h.title} · מעבר ל„{workspaceTitle(h.workspaceIds[0])}”</button>)}</p>}
   {!search.hits.length&&<p>לא נמצאה התאמה מילולית. <button className="link-chip" disabled={pending.includes('search')} onClick={()=>void ask('search')}>{pending.includes('search')?'החיפוש החכם ממתין בתור…':'לחפש בחיפוש חכם (AI) — גם רעיונות דומים?'}</button></p>}
  </div>}
  {replies.map((r:any)=>{const ids:string[]=JSON.parse(r.idea_ids||'[]');const concept=r.concept?JSON.parse(r.concept):null;return <div key={r.id} className={`assistant-reply reply-${r.mode}`}>
   <small>{LABELS[r.mode]}</small><p>{r.content}</p>
   {r.mode==='search'&&(ids.length?<p>{ids.filter(titleOf).map(id=><button key={id} className="link-chip" onClick={()=>reveal([id])}>{titleOf(id)}</button>)}</p>:<p className="muted">לא נמצא רעיון קרוב.</p>)}
   {concept&&<button className="link-chip" onClick={onExternal}>במרחב ההסבר: {concept.title}</button>}
  </div>;})}
  {error&&<p role="alert" className="error">{error}</p>}
 </div>;
}
