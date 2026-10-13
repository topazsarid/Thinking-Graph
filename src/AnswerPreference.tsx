import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

// General answer preference for one conversation, used by "consult yourself" and "external advisor".
export default function AnswerPreference({conversation,act,busy,onClose}:{conversation:any;act:(body:any)=>Promise<any>;busy:boolean;onClose:()=>void}){
 const [text,setText]=useState(conversation.answer_preference||''),[error,setError]=useState('');
 async function save(){try{await act({action:'conversation-preference',id:conversation.id,preference:text});onClose();}catch(e){setError(e instanceof Error?e.message:'השמירה נכשלה');}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent dir="rtl"><DialogTitle>העדפת תשובה לשיחה „{conversation.title}”</DialogTitle>
  <DialogDescription>איך היית רוצה שיענו לך בשיחה הזו? למשל: „תשובות קצרות”, „שאלות פתוחות בלבד”, „דוגמאות מהחיים”. ההעדפה חלה על כל התשובות בשיחה.</DialogDescription>
  <label>ההעדפה שלך<textarea maxLength={1000} value={text} onChange={e=>setText(e.target.value)} placeholder="לדוגמה: תשובות קצרות וברורות, בלי מונחים מקצועיים"/></label>
  {error&&<p role="alert" className="error">{error}</p>}
  <button className="primary modal-save" disabled={busy} onClick={()=>void save()}>שמירה</button>
 </DialogContent></Dialog>;
}
