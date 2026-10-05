import MovableDialogContent from './MovableDialogContent';
import {useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export default function CreateMapIdea({kind,workspaceId,act,onWorkspace,onCreated,onClose}:{kind:'idea'|'question';workspaceId:string;act:(body:any)=>Promise<any>;onWorkspace:(id:string)=>void;onCreated:(id:string,workspaceId:string)=>void;onClose:()=>void}){
 const [title,setTitle]=useState(''),[summary,setSummary]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const workspace=useRef(workspaceId),saving=useRef(false);
 async function save(e:React.FormEvent){
  e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   if(!workspace.current){const r=await act({action:'workspace',title:'מרחב החשיבה שלי'});workspace.current=r.id;onWorkspace(r.id);}
   const name=title.trim()||(kind==='question'?'שאלה פתוחה':'רעיון פתוח');
   const created=await act({action:'create-idea',workspaceId:workspace.current,title:kind==='question'?`שאלה: ${name}`:name,summary,kind});onCreated(created.id,workspace.current);onClose();
  }catch(e){setError(e instanceof Error?e.message:'השמירה נכשלה');}finally{saving.current=false;setBusy(false);}
 }
 return <Dialog open onOpenChange={v=>{if(!v&&!saving.current)onClose();}}><MovableDialogContent dir="rtl"><DialogTitle>{kind==='question'?'שאלה חדשה במפה':'רעיון חדש במפה'}</DialogTitle><DialogDescription>אפשר להתחיל גם בלי ניסוח מלא. הפריט יישמר במפה שלך ותוכלי להזיז, לחבר ולערוך אותו בהמשך.</DialogDescription><form onSubmit={save}><fieldset disabled={busy}><label>{kind==='question'?'מה מסקרן אותך?':'על מה את חושבת?'}<input autoFocus value={title} maxLength={170} onChange={e=>setTitle(e.target.value)} placeholder={kind==='question'?'אפשר להשאיר שאלה פתוחה':'אפשר להשאיר רעיון פתוח'}/></label><label>פרטים נוספים — לא חובה<textarea rows={3} value={summary} maxLength={4000} onChange={e=>setSummary(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<div className="row"><button className="primary modal-save" type="submit">{busy?'שומרת…':'הוספה למפה'}</button><button className="secondary modal-save" type="button" onClick={onClose}>ביטול</button></div></fieldset></form></MovableDialogContent></Dialog>;
}
