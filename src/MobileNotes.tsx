import {useRef,useState} from 'react';
import {NoteKindPicker,NoteStatus} from './NoteControls';

export default function MobileNotes({notes,act,ready}:{notes:any[];act:(body:any)=>Promise<any>;ready:boolean}){
 const [content,setContent]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const [kind,setKind]=useState('general');
 const working=useRef(false);
 async function save(e:React.FormEvent){
  e.preventDefault();if(working.current||!content.trim()||!ready)return;
  working.current=true;setSaving(true);setError('');
  try{await act({action:'note',title:'פתק ללא כותרת',content,kind});setContent('');}
  catch(e){setError(e instanceof Error?e.message:'שמירת הפתק נכשלה');}
  finally{working.current=false;setSaving(false);}
 }
 return <section dir="rtl" aria-label="פתקים בנייד"><h2>פתקים</h2><form onSubmit={save}><NoteKindPicker value={kind} onChange={setKind} disabled={saving}/><label>פתק חדש<textarea rows={5} maxLength={12000} value={content} disabled={saving} onChange={e=>setContent(e.target.value)}/></label><button className="primary" disabled={!ready||saving||!content.trim()}>{saving?'שומרת…':'שמירת פתק'}</button></form>{error&&<p role="alert" className="error">{error}</p>}<h3>פתקים שמורים</h3>{!notes.length&&<p>עדיין אין פתקים.</p>}{[...notes].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(note=><article className="note-card" key={note.id}><strong>{note.title}</strong><NoteStatus note={note} act={act}/><p>{note.content}</p><time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString('he-IL')}</time></article>)}</section>;
}
