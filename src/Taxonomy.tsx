import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function typePath(types:any[],id:string):string{
 const names:string[]=[],seen=new Set<string>();let current=types.find(t=>t.id===id);
 while(current&&!seen.has(current.id)){seen.add(current.id);names.unshift(current.title);current=types.find(t=>t.id===current.parent_id);}
 return names.join(' / ');
}
export function Taxonomy({graph,act,busy,onClose}:{graph:any;act:(body:any)=>Promise<any>;busy:boolean;onClose:()=>void}){
 const types=graph.relation_types||[],aliases=graph.relation_aliases||[];
 const [id,setId]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[parentId,setParentId]=useState(''),[error,setError]=useState(''),[filter,setFilter]=useState<string|null>(null);
 function descendants(root:string):Set<string>{const found=new Set([root]);let more=true;while(more){more=false;for(const t of types){if(found.has(t.parent_id)&&!found.has(t.id)){found.add(t.id);more=true;}}}return found;}
 function edit(t:any){setId(t.id);setTitle(t.title);setDescription(t.description);setParentId(t.parent_id||'');setError('');}
 function reset(){setId('');setTitle('');setDescription('');setParentId('');}
 function branch(parent:string|null,depth=0):any{return types.filter((t:any)=>t.parent_id===parent).map((t:any)=>{const family=descendants(t.id);const total=graph.connections.filter((c:any)=>family.has(c.type_id)).length;return <li key={t.id}><div className="taxonomy-node"><button type="button" onClick={()=>setFilter(t.id)}><strong>{t.title}</strong><span>{total} קשרים בענף</span></button><button type="button" className="text-button" onClick={()=>edit(t)}>עריכה</button></div>{aliases.some((a:any)=>a.type_id===t.id)&&<p className="alias-list">שמות נרדפים: {aliases.filter((a:any)=>a.type_id===t.id).map((a:any)=>a.title).join(' · ')}</p>}{depth<30&&<ul>{branch(t.id,depth+1)}</ul>}</li>;});}
 const filtered=filter===null?[]:graph.connections.filter((c:any)=>filter===''?!c.type_id:descendants(filter).has(c.type_id));
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent dir="rtl" className="detail-dialog taxonomy-dialog"><DialogTitle>עץ סוגי הקשרים</DialogTitle><DialogDescription>כל סוג יכול להכיל סוגים מפורטים יותר. המספרים כוללים את כל המרחבים ואת תתי־הסוגים.</DialogDescription>
 {!types.length&&<p>העץ עדיין ריק. הוסיפי קטגוריה כאן, או הקלידי סוג חדש בזמן שמירת קשר.</p>}
 <ul className="taxonomy-tree">{branch(null)}</ul><button className="secondary" onClick={()=>setFilter('')}>ללא סיווג · {graph.connections.filter((c:any)=>!c.type_id).length}</button>
 {filter!==null&&<div className="taxonomy-results"><h3>{filter?typePath(types,filter):'ללא סיווג'}</h3>{filtered.length?filtered.map((c:any)=><article key={c.id}><strong>{c.label}</strong><p>{c.description||'ללא הסבר'}</p></article>):<p>אין עדיין קשרים בענף הזה.</p>}</div>}
 <form onSubmit={async e=>{e.preventDefault();try{await act({action:'relation-type',id:id||null,title,description,parentId:parentId||null});reset();setError('');}catch(e){setError(e instanceof Error?e.message:'השמירה נכשלה');}}}><fieldset disabled={busy}><h3>{id?'עריכת סוג':'הוספת קטגוריה או סוג'}</h3><label>שם הסוג<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>תחת הקטגוריה<select value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">ברמה הראשית</option>{types.filter((t:any)=>!id||!descendants(id).has(t.id)).map((t:any)=><option key={t.id} value={t.id}>{typePath(types,t.id)}</option>)}</select></label><label>הגדרה<textarea maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="מה המשמעות של הסוג הזה?"/></label>{error&&<p className="error" role="alert">{error}</p>}<div className="row"><button className="primary" disabled={!title.trim()}>שמירת סוג</button>{id&&<button type="button" className="secondary" onClick={reset}>ביטול עריכה</button>}</div></fieldset></form></DialogContent></Dialog>;
}
