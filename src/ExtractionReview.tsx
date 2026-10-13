import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

type Item={key:string;kind:'idea'|'connection'|'metadata';text:string;detail:string;quote:string;epistemic:string;relation:string;source:string|null;target:string|null;uncertainty:string};
const kinds={idea:'רעיון',connection:'קשר בין רעיונות',metadata:'הקשר / מטא־דאטה'};
const states:Record<string,string>={statement:'אמירה',belief:'אמונה',hypothesis:'השערה',question:'שאלה',preference:'העדפה',unclear:'לא ברור'};

export function ExtractionEvidence({graph,entityId}:{graph:any;entityId:string}){
 const sources=(graph.extraction_runs||[]).filter((r:any)=>r.status==='reviewed').flatMap((r:any)=>{
  const review=JSON.parse(r.review);
  const keys=Object.keys(review.entities).filter(key=>review.entities[key]===entityId);
  if(!keys.length)return [];
  return review.items.filter((i:Item)=>keys.includes(i.key)||(i.kind==='metadata'&&(!i.target||keys.includes(i.target)))).map((i:Item)=>({...i,run:r}));
 });
 if(!sources.length)return null;
 return <section><h3>המשמעות וההקשר מהמקור</h3>{sources.map((i:any)=><div className="extraction-item" key={i.run.id+i.key}><strong>{kinds[i.kind as Item['kind']]} · {i.text}</strong><p>{states[i.epistemic]}{i.relation?` · ${i.relation}`:''}</p>{i.kind==='metadata'&&!i.target&&<small>מתייחס להודעה כולה; אינו בהכרח ייחודי לרעיון הזה.</small>}<p>{i.detail}</p>{i.uncertainty&&<p>דורש הבהרה: {i.uncertainty}</p>}<blockquote>{i.quote}</blockquote><details><summary>הודעת המקור · חילוץ {i.run.model}, באישור משתמשת</summary><p className="extraction-original">{graph.messages.find((m:any)=>m.id===i.run.message_id)?.content}</p></details></div>)}</section>;
}

export default function ExtractionReview({run,graph,act,busy,onClose,onApproved}:{run:any;graph:any;act:(body:any)=>Promise<any>;busy:boolean;onClose:()=>void;onApproved?:(runId:string)=>void}){
 const reviewed=run.status==='reviewed';
 const stored=JSON.parse(reviewed?run.review:run.proposal);
 const [items,setItems]=useState<Item[]>(stored.items);
 const [included,setIncluded]=useState<string[]>(stored.items.map((i:Item)=>i.key));
 const [bindings,setBindings]=useState<Record<string,string>>(stored.bindings||{});
 const [error,setError]=useState('');
 const source=graph.messages.find((m:any)=>m.id===run.message_id);
 const ideas=items.filter(i=>i.kind==='idea'&&included.includes(i.key));
 function edit(key:string,patch:Partial<Item>){setItems(old=>old.map(i=>i.key===key?{...i,...patch}:i));}
 async function save(){
  const chosen=items.filter(i=>included.includes(i.key));
  const keys=new Set(chosen.filter(i=>i.kind==='idea').map(i=>i.key));
  if(chosen.some(i=>i.kind==='connection'&&(!keys.has(i.source||'')||!keys.has(i.target||'')||i.source===i.target))){setError('לכל קשר צריך לבחור שני רעיונות שונים שנכללים באישור. אפשר גם להסיר את הקשר.');return;}
  if(chosen.some(i=>i.kind==='metadata'&&i.target&&!keys.has(i.target))){setError('ההקשר מפנה לרעיון שהוסר. בחרי בהודעה כולה או ברעיון אחר.');return;}
  try{await act({action:'review-extraction',runId:run.id,proposal:{items:chosen},bindings:Object.fromEntries(Object.entries(bindings).filter(([key,value])=>keys.has(key)&&value))});onApproved?.(run.id);onClose();}catch(e){setError(e instanceof Error?e.message:'השמירה נכשלה');}
 }
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent dir="rtl" className="detail-dialog extraction-dialog"><DialogTitle>{reviewed?'החילוץ שאושר':'בדיקת החילוץ מהטקסט'}</DialogTitle><DialogDescription>הצעות מהמודל המקומי {run.model}. בדקי את המשמעות ואת הציטוטים. הקשרים כאן אמורים לשקף את הטקסט שלך; הם אינם עובדות מאומתות.</DialogDescription>
 <details><summary>הטקסט המקורי</summary>{(graph.note_message_sources||[]).some((n:any)=>n.message_id===run.message_id)&&<p>מקור: צילום מצב של הפתקים {(graph.note_message_sources||[]).filter((n:any)=>n.message_id===run.message_id).map((n:any)=>n.title).join(" · ")}. עריכות מאוחרות בפתקים אינן משנות מקור זה.</p>}<p className="extraction-original">{source?.content}</p></details>
 <p className="muted">רעיונות וקשרים שאושרו יופיעו במפה. הקשרים להתפתחות המחשבה נשמרים כמטא־דאטה. אפשר לשנות סיווג לפני האישור. טיוטת המודל נשמרת; העריכות שלך נשמרות רק באישור.</p>
 {!items.length&&<p>לא זוהו פריטים. אפשר לסגור או לאשר טיוטה ריקה.</p>}
 <fieldset disabled={busy||reviewed}>
 {items.map((item,index)=><section className="extraction-item" key={item.key}>
  <label className="inline-check"><input type="checkbox" checked={included.includes(item.key)} onChange={e=>setIncluded(old=>e.target.checked?[...old,item.key]:old.filter(k=>k!==item.key))}/>כלול באישור · {index+1}</label>
  <label>סיווג<select value={item.kind} onChange={e=>edit(item.key,{kind:e.target.value as Item['kind'],source:null,target:null,relation:''})}>{Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label>ניסוח<input maxLength={160} value={item.text} onChange={e=>edit(item.key,{text:e.target.value})}/></label>
  <label>פירוט<textarea maxLength={4000} value={item.detail} onChange={e=>edit(item.key,{detail:e.target.value})}/></label>
  <label>אופי האמירה<select value={item.epistemic} onChange={e=>edit(item.key,{epistemic:e.target.value})}>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  {item.kind==='idea'&&<label>שמירה כרעיון חדש או קישור לקיים<select value={bindings[item.key]||''} onChange={e=>setBindings(old=>({...old,[item.key]:e.target.value}))}><option value="">רעיון חדש</option>{graph.ideas.filter((i:any)=>i.status!=='rejected').map((i:any)=><option value={i.id} key={i.id}>{i.title}</option>)}</select><small>קישור לקיים מוסיף מקור; הוא אינו מחליף את התיאור הקיים. ברעיון חדש אופי האמירה יופיע בכותרת, למשל „השערה: …”.</small></label>}
  {item.kind!=='idea'&&<><label>{item.kind==='metadata'?'תפקיד ההקשר (למשל חיזק / עורר / תאריך)':'סוג הקשר'}<input maxLength={180} value={item.relation} onChange={e=>edit(item.key,{relation:e.target.value})}/></label>{item.kind==='connection'&&<label>מרעיון<select value={item.source||''} onChange={e=>edit(item.key,{source:e.target.value||null})}><option value="">בחרי רעיון</option>{ideas.map(i=><option key={i.key} value={i.key}>{i.text}</option>)}</select></label>}<label>{item.kind==='metadata'?'ההקשר מתייחס אל':'אל רעיון'}<select value={item.target||''} onChange={e=>edit(item.key,{target:e.target.value||null})}><option value="">{item.kind==='metadata'?'ההודעה כולה / לא ברור':'בחרי רעיון'}</option>{ideas.map(i=><option key={i.key} value={i.key}>{i.text}</option>)}</select></label></>}
  <label>מה דורש הבהרה?<input maxLength={1000} value={item.uncertainty} onChange={e=>edit(item.key,{uncertainty:e.target.value})}/></label>
  <blockquote><small>הציטוט המקורי</small><p>{item.quote}</p></blockquote>
 </section>)}
 </fieldset>
 {error&&<p role="alert" className="error">{error}</p>}
 {!reviewed&&<button className="primary" disabled={busy||items.some(i=>included.includes(i.key)&&!i.text.trim())} onClick={save}>{included.length?'אישור ושמירת הפריטים שנבחרו':'דחיית כל ההצעות'}</button>}
 <button className="secondary" disabled={busy} onClick={onClose}>{reviewed?'סגירה':'סגירה ללא שמירת העריכות'}</button>
 </DialogContent></Dialog>;
}
