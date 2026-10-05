import MovableDialogContent from './MovableDialogContent';
import {requestExtraction} from './requestExtraction';
import NotesPanel from './NotesPanel';
import MobileNotes from './MobileNotes';
import {DropdownMenu} from 'radix-ui';

import { useEffect, useState, useRef } from 'react';
import ExtractionReview, {ExtractionEvidence} from './ExtractionReview';
import CreateMapIdea from './CreateMapIdea';
import DrawingBoard from './DrawingBoard';
import ResizablePanels from './ResizablePanels';
import FlowerBirds from './FlowerBirds';
import GrowingGarden from './GrowingGarden';
import FireScreen from './FireScreen';
import EffectStudio, {CustomEffect,type EffectConfig} from './EffectStudio';
import ThemePicker from './ThemePicker';
import {Taxonomy} from './Taxonomy';
import IdeaMap from './IdeaMap';
import ConnectionEditor, {ConnectionDetails} from './ConnectionEditor';
import { Network, Plus, Send, Link2, MessageSquare, ArrowUpRight, Check, X, Sparkles, Layers } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
const empty:any={users:[],conversations:[],messages:[],ideas:[],workspaces:[],workspace_ideas:[],message_ideas:[],connections:[],connection_participants:[],events:[]};
function Picker({value,onChange,items,label}:any){return <Select value={value||undefined} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{items.map((x:any)=><SelectItem key={x.id} value={x.id}>{x.title}</SelectItem>)}</SelectContent></Select>}
export default function App(){
 const [mobileView,setMobileView]=useState('menu');
 const [notesOpen,setNotesOpen]=useState(false),[newNote,setNewNote]=useState(false),[selectedNotes,setSelectedNotes]=useState<string[]>([]),[notesPreparing,setNotesPreparing]=useState(false),[deletedConnectionsOpen,setDeletedConnectionsOpen]=useState(false);
 const noteWork=useRef(false),noteSnapshot=useRef<{key:string,id:string}|null>(null);
 const [customEffect,setCustomEffect]=useState<EffectConfig|null>(null);
 function applyEffect(config:EffectConfig){setGarden(false);setGrowing(false);setFire(false);setCustomEffect(config);}
 const [fire,setFire]=useState(false);
 const [growing,setGrowing]=useState(false);
 const [garden,setGarden]=useState(()=>{try{return localStorage.getItem('thinking-graph:garden')==='true';}catch{return false;}});
 function toggleGarden(){const next=!garden;setGarden(next);try{localStorage.setItem('thinking-graph:garden',String(next));}catch{}}
 const [themeColor,setThemeColor]=useState('#215b4b');
 const [g,setG]=useState(empty),[conv,setConv]=useState(''),[ws,setWs]=useState(''),[draft,setDraft]=useState(''),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[modal,setModal]=useState(''),[name,setName]=useState(''),[ids,setIds]=useState<string[]>([]),[linkIdea,setLinkIdea]=useState(''),[source,setSource]=useState(''),[editTitle,setEditTitle]=useState(''),[editSummary,setEditSummary]=useState('');
 async function refresh(){const r=await fetch('/api/graph'); const data:any=await r.json(); if(!r.ok){throw Error(data.error)}setG(data);setConv(c=>c||data.conversations[0]?.id||'');setWs(w=>w||data.workspaces[0]?.id||'');setLoaded(true);return data;}
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
 const [connectionIds,setConnectionIds]=useState<string[]|null>(null),[connectionId,setConnectionId]=useState('');
 const [mapPlacement,setMapPlacement]=useState<{id:string;workspaceId:string;point:{x:number;y:number}}|null>(null);
 const mapCreatePoint=useRef<{x:number;y:number}|null>(null);
 const [newMapItem,setNewMapItem]=useState<'idea'|'question'|null>(null);
 const [taxonomyOpen,setTaxonomyOpen]=useState(false);
 const [extractionRun,setExtractionRun]=useState(''),[extracting,setExtracting]=useState('');
 const extractionRequest=useRef<{key:string,id:string}|null>(null);
 async function extract(messageId:string,workspaceId=ws){
  if(extracting||!workspaceId)return;setExtracting(messageId);setError('');
  const key=messageId+workspaceId;
  if(extractionRequest.current?.key!==key)extractionRequest.current={key,id:crypto.randomUUID()};
  try{const data=await requestExtraction({requestId:extractionRequest.current.id,messageId,workspaceId});await refresh();setExtractionRun(data.id);extractionRequest.current=null;}catch(e){setError(e instanceof Error?e.message:'לא ניתן להתחבר לשרת');}finally{setExtracting('');}
 }
 async function extractNotes(noteIds:string[]){
  if(noteWork.current||extracting||busy)return;
  const chosen=(g.notes||[]).filter((n:any)=>noteIds.includes(n.id));
  if(!chosen.length||chosen.length>12){setError('בחרי בין פתק אחד ל־12 פתקים.');setNotesOpen(false);return;}
  noteWork.current=true;setNotesPreparing(true);setError('');
  try{let workspaceId=ws;if(!workspaceId){const r=await act({action:'workspace',title:'מרחב החשיבה שלי'});workspaceId=r.id;setWs(workspaceId);}
   const key=JSON.stringify([workspaceId,chosen.map((n:any)=>[n.id,n.updated_at])]);
   if(noteSnapshot.current?.key!==key){const r=await act({action:'snapshot-notes',noteIds:chosen.map((n:any)=>n.id),workspaceId});noteSnapshot.current={key,id:r.id};}
   setNotesOpen(false);await extract(noteSnapshot.current.id,workspaceId);
  }catch(e){setNotesOpen(false);setError(e instanceof Error?e.message:'החילוץ נכשל');}finally{noteWork.current=false;setNotesPreparing(false);}
 }
 const pending = useRef<{key:string,id:string}|null>(null);
 const working = useRef(false);
 async function act(body:any){
   if(working.current) throw Error('פעולה כבר מתבצעת');
   working.current=true;setBusy(true);setError('');
   const key=JSON.stringify(body);
   if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
   try{
     const r=await fetch('/api/graph',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,commandId:pending.current.id})});
     const result=await r.json();
     if(!r.ok){if(r.status<500)pending.current=null;throw Error(result.error||'השמירה נכשלה');}
     pending.current=null;
     try{await refresh();}catch{setError('הפעולה נשמרה, אבל התצוגה לא התעדכנה. לחצי על ניסיון נוסף.');}
     return result;
   }catch(e){setError(e instanceof Error?e.message:'לא ניתן להתחבר לשרת המקומי');throw e;}
   finally{working.current=false;setBusy(false);}
 }

 const sending = useRef(false);
 async function send(withExtraction=false){
   if(!draft.trim()||busy||sending.current||!loaded)return;
   sending.current=true;
   const content=draft;
   try{
     let workspaceId=ws,conversationId=conv;
     if(!workspaceId){const r=await act({action:'workspace',title:'מרחב החשיבה שלי'});workspaceId=r.id;setWs(r.id);}
     if(!conversationId){const r=await act({action:'conversation',title:'חקירה ראשונה'});conversationId=r.id;setConv(r.id);}
     const message=await act({action:'message',content,conversationId,workspaceId,extractRules:false});
     if(withExtraction)await extract(message.id,workspaceId);
     setDraft(current=>current===content?'':current);
   }catch{}finally{sending.current=false;}
 }
 const active=g.ideas.find((i:any)=>i.id===selected); const visible=g.ideas.filter((i:any)=>i.status!=='rejected'&&g.workspace_ideas.some((w:any)=>w.workspace_id===ws&&w.idea_id===i.id));
 const positions=new Map(visible.map((i:any,n:number)=>[i.id,{x:160+(n%3)*245,y:100+Math.floor(n/3)*190}]));
 const edges=g.connections.filter((c:any)=>!c.deleted_at).map((c:any)=>({...c,ps:g.connection_participants.filter((p:any)=>p.connection_id===c.id)})).filter((c:any)=>c.ps.length>=2&&c.ps.every((p:any)=>positions.has(p.idea_id)));
 const messages=g.messages.filter((m:any)=>m.conversation_id===conv).sort((a:any,b:any)=>a.created_at.localeCompare(b.created_at));
 const sources=active?g.message_ideas.filter((l:any)=>l.idea_id===active.id).map((l:any)=>({...g.messages.find((m:any)=>m.id===l.message_id),method:l.method})):[];
 function open(kind:string){setModal(kind);setName('');setIds([]);setLinkIdea('');}
 function inspect(id:string){setSelected(id);const i=g.ideas.find((x:any)=>x.id===id);setEditTitle(i.title);setEditSummary(i.summary);}
 async function revise(status:string){try{await act({action:'idea',id:active.id,title:editTitle,summary:editSummary,status});}catch{}}

 return <main dir="rtl" className={`workspace-page${(garden||growing||fire||customEffect)?' garden-mode':''}`}>
 <div className="board-effects" aria-hidden="true">{garden&&<FlowerBirds color={themeColor}/>}{growing&&<GrowingGarden color={themeColor}/>}{fire&&<FireScreen/>}{customEffect&&<CustomEffect config={customEffect}/>}</div>
 <header className="topbar"><div className="brand" dir="ltr"><span className="brand-icon"><Network size={22}/></span>Thinking Graph<span className="version">0.1</span></div><div className="row"><button className="secondary" disabled={!loaded||busy} onClick={()=>{setNewNote(true);setNotesOpen(true);}}>＋ פתק</button><button className="secondary" disabled={!loaded} onClick={()=>{setNewNote(false);setNotesOpen(true);}}>פתקים ({(g.notes||[]).length})</button><button className="primary" disabled={!loaded||busy||!!extracting||notesPreparing} onClick={()=>{if(selectedNotes.length)void extractNotes(selectedNotes);else{setNewNote(false);setNotesOpen(true);}}}>{extracting||notesPreparing?'מחלצת…':`חילוץ מפתקים${selectedNotes.length?` (${selectedNotes.length})`:''}`}</button><ThemePicker onColorChange={setThemeColor}/><EffectStudio onApply={applyEffect} onStop={()=>setCustomEffect(null)} active={!!customEffect}/><button className="secondary" aria-pressed={garden} onClick={toggleGarden}>{garden?'כיבוי גן הציפורים':'גן ציפורים'}</button><button className="secondary" aria-pressed={growing} onClick={()=>setGrowing(v=>!v)}>{growing?'כיבוי הגן הצומח':'גן צומח'}</button><button className="secondary" aria-pressed={fire} onClick={()=>setFire(v=>!v)}>{fire?'כיבוי האש':'מסך בוער'}</button></div><div className="status">{busy?'שומרת…':loaded?'שמירה מקומית במחשב':'מתחברים לגרף…'}</div></header>
 {error&&<div className="error" role="alert">{error} {<button onClick={()=>refresh().then(()=>setError('')).catch(e=>setError(e.message))}>ניסיון נוסף</button>}</div>}
 <div className="workspace-bar"><div className="row"><Layers size={19}/><Picker value={ws} onChange={(v:string)=>{setWs(v);setSelected('')}} items={g.workspaces} label="בחרי מרחב"/><button className="icon-button" aria-label="מרחב חדש" onClick={()=>open('workspace')}><Plus size={18}/></button></div><button className="secondary" onClick={()=>setTaxonomyOpen(true)}>עץ סוגי הקשרים</button></div>
 <div className="mobile-navigation" dir="rtl"><strong>Thinking Graph</strong><select aria-label="מסך בנייד" value={mobileView} onChange={e=>setMobileView(e.target.value)}><option value="menu">תפריט</option><option value="chat">שיחה</option><option value="notes">פתקים</option><option value="map">המפה שלי</option></select></div>
 {mobileView==='menu'&&<nav className="mobile-entry" aria-label="בחירת מסך"><h2>מרחב החשיבה שלך</h2>{[['chat','שיחה'],['notes','פתקים'],['map','המפה שלי']].map(([id,label])=><button key={id} className="secondary" onClick={()=>setMobileView(id)}>{label}</button>)}</nav>}
 <div className="mobile-notes" hidden={mobileView!=='notes'}><MobileNotes notes={g.notes||[]} act={act} ready={loaded&&!busy}/></div>
 <ResizablePanels mobileView={mobileView}>
 <section className="chat"><div className="section-heading"><span className="eyebrow"><MessageSquare size={16}/> שיחה</span><button className="icon-button" aria-label="שיחה חדשה" onClick={()=>open('conversation')}><Plus size={18}/></button></div><Picker value={conv} onChange={setConv} items={g.conversations} label="בחרי שיחה"/>
 <div className="messages">{!messages.length&&<div className="chat-empty"><span className="small-icon"><Sparkles size={23}/></span><h2>מחשבה אחת.<br/>הרבה כיוונים.</h2><p>כתבי מחשבה, שאלה או הבחנה.<br/>אפשר לשמור אותה ולבקש חילוץ, או להתחיל ישירות במפה.</p><button className="example" onClick={()=>setDraft('אני חושבת שיש קשר בין [[שדה]] לבין [[כוח]]. איך [[שדה]] משפיע על תנועה?')}>נסי: מה הקשר בין שדה לכוח? <ArrowUpRight size={16}/></button></div>}
 {messages.map((m:any)=><article tabIndex={-1} id={'message-'+m.id} key={m.id} className="message"><div className="message-meta">{g.users.find((u:any)=>u.id===m.created_by)?.name||'כותבת'}<time>{new Date(m.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.content}</p><div className="chips">{g.message_ideas.filter((l:any)=>l.message_id===m.id).map((l:any)=><button key={l.idea_id} onClick={()=>inspect(l.idea_id)}>{g.ideas.find((i:any)=>i.id===l.idea_id)?.title}</button>)}</div><button className="text-button" disabled={!!extracting||busy||!ws} onClick={()=>extract(m.id)}>{extracting===m.id?'מחלצת עם המודל המקומי…':'חילוץ רעיונות, קשרים והקשר'}</button>{(g.extraction_runs||[]).filter((r:any)=>r.message_id===m.id).map((r:any)=><button className="text-button" key={r.id} onClick={()=>setExtractionRun(r.id)}>{r.status==='pending'?'בדיקת טיוטת חילוץ':'רעיונות והקשר שאושרו'}</button>)}<button className="text-button" onClick={()=>{setSource(m.id);open('link')}}>קישור לרעיון קיים <Link2 size={13}/></button></article>)}
 </div><div className="composer"><label className="sr-only" htmlFor="draft">המחשבה שלך</label><textarea id="draft" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="מה מעסיק אותך עכשיו?" maxLength={12000}/><div><button className="text-button" disabled={busy||!!extracting||!draft.trim()||!loaded} onClick={()=>send(true)}>שמירה וחילוץ חכם</button><button aria-label="שליחת הודעה" className="primary send" disabled={busy||!!extracting||!draft.trim()||!loaded} onClick={()=>send()}><Send size={17}/></button></div></div><p className="footnote">השליחה שומרת את הטקסט. חילוץ חכם יוצר טיוטה לבדיקה לפני הוספה למפה.</p>
 </section>
 <section className="map-section spatial-map"><div className="map-toolbar"><div><span className="eyebrow">המפה שלי</span></div><div className="row"><DropdownMenu.Root dir="rtl"><DropdownMenu.Trigger asChild><button className="secondary" aria-label="הוספה למפה" disabled={busy||!loaded}>＋</button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="map-context-menu" collisionPadding={10}>
 <DropdownMenu.Item onSelect={()=>{mapCreatePoint.current=null;setNewMapItem('idea');}}>רעיון חדש</DropdownMenu.Item>
 <DropdownMenu.Item onSelect={()=>{mapCreatePoint.current=null;setNewMapItem('question');}}>שאלה חדשה</DropdownMenu.Item>
 <DropdownMenu.Item disabled={!ws} onSelect={()=>{setSource('');open('link');}}>רעיון קיים</DropdownMenu.Item>
 <DropdownMenu.Item disabled={visible.length<2} onSelect={()=>setConnectionIds([])}>קשר חדש</DropdownMenu.Item>
 <DropdownMenu.Item onSelect={()=>setDeletedConnectionsOpen(true)}>קשרים שנמחקו</DropdownMenu.Item><DropdownMenu.Label className="map-context-label">{visible.length} רעיונות · {edges.length} קשרים</DropdownMenu.Label>
 </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div>
 <div className="map-scroll"><IdeaMap onDelete={async id=>{await act({action:'connection-visibility',id,deleted:true});}} onQuickCreate={async(title,point)=>{let workspace=ws;if(!workspace){const r=await act({action:'workspace',title:'מרחב החשיבה שלי'});workspace=r.id;setWs(workspace);}const r=await act({action:'create-idea',workspaceId:workspace,title,summary:'',kind:'idea'});setMapPlacement({id:r.id,workspaceId:workspace,point});}} onPlaced={()=>setMapPlacement(null)} placement={mapPlacement} onCreate={(kind,point)=>{mapCreatePoint.current=point;setNewMapItem(kind);}} key={ws} workspaceId={ws} ideas={visible} edges={edges} busy={busy||!loaded} onInspect={inspect} onConnect={async ideaIds=>{await act({action:'connection',ideaIds,label:'?',description:''});}} onConnection={setConnectionId}/></div>
 
 </section><DrawingBoard key={ws || 'unassigned'} workspaceId={ws} themeColor={themeColor}/></ResizablePanels>
 {extractionRun&&(g.extraction_runs||[]).find((r:any)=>r.id===extractionRun)&&<ExtractionReview key={extractionRun} run={g.extraction_runs.find((r:any)=>r.id===extractionRun)} graph={g} act={act} busy={busy} onClose={()=>setExtractionRun('')}/>}
 {notesOpen&&<NotesPanel key={newNote?'new':'list'} startNew={newNote} notes={g.notes||[]} selected={selectedNotes} onSelected={setSelectedNotes} act={act} extracting={!!extracting||notesPreparing} onExtract={extractNotes} onClose={()=>setNotesOpen(false)}/>}
 {deletedConnectionsOpen&&<Dialog open onOpenChange={setDeletedConnectionsOpen}><DialogContent dir="rtl" className="detail-dialog"><DialogTitle>קשרים שנמחקו</DialogTitle><DialogDescription>אפשר לשחזר קשר עם אותם משתתפים, פירוט ומקורות.</DialogDescription>{!g.connections.some((c:any)=>c.deleted_at)&&<p>אין קשרים שנמחקו.</p>}{g.connections.filter((c:any)=>c.deleted_at).map((c:any)=><div className="row" key={c.id}><span>{c.label} · {g.connection_participants.filter((p:any)=>p.connection_id===c.id).map((p:any)=>g.ideas.find((i:any)=>i.id===p.idea_id)?.title).join(' / ')}</span><button className="secondary" disabled={busy} onClick={()=>void act({action:'connection-visibility',id:c.id,deleted:false}).catch(()=>{})}>שחזור</button></div>)}</DialogContent></Dialog>}
 {newMapItem&&<CreateMapIdea kind={newMapItem} onCreated={(id,workspaceId)=>{if(mapCreatePoint.current)setMapPlacement({id,workspaceId,point:mapCreatePoint.current});}} workspaceId={ws} act={act} onWorkspace={setWs} onClose={()=>setNewMapItem(null)}/>}
 {taxonomyOpen&&<Taxonomy graph={g} act={act} busy={busy} onClose={()=>setTaxonomyOpen(false)}/>}
 {connectionIds!==null&&<ConnectionEditor graph={g} initialIds={connectionIds} visible={visible} act={act} busy={busy} onClose={()=>setConnectionIds(null)}/>}
 {connectionId&&g.connections.find((c:any)=>c.id===connectionId)&&<ConnectionDetails key={connectionId} act={act} connection={g.connections.find((c:any)=>c.id===connectionId)} graph={g} onClose={()=>setConnectionId('')}/>}
 <Dialog open={!!selected} onOpenChange={v=>{if(!v)setSelected('')}}><MovableDialogContent dir="rtl" className="detail-dialog"><DialogTitle>הרעיון והמקורות שלו</DialogTitle><DialogDescription>שינוי הרעיון יתעדכן בכל המרחבים שמפנים אליו.</DialogDescription>{active&&<><label>שם הרעיון<input value={editTitle} onChange={e=>setEditTitle(e.target.value)} maxLength={180}/></label><label>תיאור<textarea value={editSummary} onChange={e=>setEditSummary(e.target.value)} maxLength={4000}/></label><div className="row"><button disabled={busy} className="primary" onClick={()=>revise('accepted')}><Check size={16}/> {active.status==='accepted'?'שמירת שינויים':'אישור ושמירה'}</button><button disabled={busy} className="secondary" onClick={()=>revise('rejected')}><X size={15}/> דחייה</button></div>{error&&<p className="error" role="alert">{error}</p>}<p className="muted">נוצר על ידי {g.users.find((u:any)=>u.id===active.created_by)?.name} · {new Date(active.created_at).toLocaleString('he-IL')}</p><ExtractionEvidence graph={g} entityId={active.id}/><h3>מקורות · {sources.length}</h3>{!sources.length&&g.events.some((e:any)=>e.entity_id===active.id&&e.action==='create-on-map')&&<p className="muted">נוצר ישירות במפה שלך. אין הודעת מקור; פעולת היצירה מתועדת בהיסטוריה.</p>}{sources.map((m:any)=><button className="source-card" key={m.id} onClick={()=>{setConv(m.conversation_id);setSelected('');setTimeout(()=>document.getElementById('message-'+m.id)?.focus(),100)}}><small>{g.conversations.find((c:any)=>c.id===m.conversation_id)?.title} · {m.method==='manual'?'קישור ידני':m.method==='exact-title'?'שם זהה':m.method==='reviewed-model'?'חילוץ שאושר':'חילוץ ראשוני'}</small><p>{m.content}</p><span>מעבר להודעה <ArrowUpRight size={14}/></span></button>)}<details><summary>היסטוריית השינויים</summary>{g.events.filter((e:any)=>e.entity_id===active.id).map((e:any)=><div className="history" key={e.id}><span>{e.action} · {g.users.find((u:any)=>u.id===e.created_by)?.name}</span><time>{new Date(e.created_at).toLocaleString('he-IL')}</time><pre dir="ltr">{JSON.stringify({before:e.before?JSON.parse(e.before):null,after:JSON.parse(e.after)},null,2)}</pre></div>)}</details></>}</MovableDialogContent></Dialog>
 <Dialog open={!!modal} onOpenChange={v=>{if(!v)setModal('')}}><DialogContent dir="rtl"><DialogTitle>{({workspace:'מרחב חדש',conversation:'שיחה חדשה',connection:'יצירת קשר',link:'קישור רעיון קיים'} as any)[modal]}</DialogTitle><DialogDescription>{modal==='connection'?'בחרי שני רעיונות או יותר ותני לקשר שם.':modal==='link'?'אותו רעיון יכול להופיע בכמה שיחות ומרחבים.':'שם שיעזור לך לחזור לכאן בהמשך.'}</DialogDescription><form onSubmit={async e=>{e.preventDefault();try{let r;if(modal==='link'){r=await act({action:'link',ideaId:linkIdea,workspaceId:ws,messageId:source||undefined})}else if(modal==='connection'){r=await act({action:'connection',label:name,ideaIds:ids})}else{r=await act({action:modal,title:name});if(modal==='workspace')setWs(r.id);else setConv(r.id)}setModal('')}catch{}}}>
 {modal==='link'?<Picker value={linkIdea} onChange={setLinkIdea} items={g.ideas.filter((i:any)=>i.status!=='rejected')} label="בחירת רעיון"/>:<label>{modal==='connection'?'שם הקשר':'שם'}<input autoFocus required value={name} onChange={e=>setName(e.target.value)} maxLength={180} placeholder={modal==='connection'?'למשל: משפיע על, דומה ל…':''}/></label>}
 {modal==='connection'&&<div className="choices">{visible.map((i:any)=><label key={i.id}><Checkbox checked={ids.includes(i.id)} onCheckedChange={v=>setIds(v?[...ids,i.id]:ids.filter(x=>x!==i.id))}/>{i.title}</label>)}</div>}
 {error&&<p role="alert" className="error">{error}</p>}<button className="primary modal-save" disabled={busy||(modal==='link'&&!linkIdea)||(modal==='connection'&&ids.length<2)}>שמירה</button></form></DialogContent></Dialog>
 </main>
}



