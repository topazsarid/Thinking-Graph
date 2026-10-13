import {useRef,useState} from 'react';

export function NoteKindPicker({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 return <label>סוג הפתק<select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="general">כללי</option><option value="task">משימה</option></select></label>;
}

export function NoteStatus({note,act}:{note:any;act:(body:any)=>Promise<any>}){
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const working=useRef(false);
 async function toggle(){
  if(working.current)return;
  working.current=true;setSaving(true);setError('');
  try{await act({action:'complete-note',id:note.id,completed:!note.completed});}
  catch(e){setError(e instanceof Error?e.message:'עדכון המשימה נכשל');}
  finally{working.current=false;setSaving(false);}
 }
 return <div>{note.kind==='task'?<button className="secondary" aria-label={`בוצע: ${note.title}`} aria-pressed={!!note.completed} disabled={saving} onClick={()=>void toggle()}>{saving?'שומרת…':note.completed?'✓ בוצע':'○ סימון כבוצע'}</button>:<span className="muted">כללי</span>}{error&&<p role="alert" className="error">{error}</p>}</div>;
}
