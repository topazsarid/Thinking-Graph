import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export const shortcutDefaults={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',connect:'KeyC',idea:'KeyN',question:'KeyQ',fit:'KeyF',edit:'KeyE'};
export type Shortcuts=typeof shortcutDefaults;
const storageKey='thinking-graph:map-shortcuts:v1';
const labels:Record<keyof Shortcuts,string>={up:'למעלה',down:'למטה',left:'שמאלה',right:'ימינה',connect:'התחלת חיבור מהרעיון הנבחר',idea:'רעיון חדש',question:'שאלה חדשה',fit:'מרכוז המפה',edit:'עריכת הרעיון או הקשר הנבחר'};
const choices=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(x=>'Key'+x)];
export const keyLabel=(code:string)=>({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[code]||code.replace('Key',''));
export function loadShortcuts():Shortcuts{
 try{const value=JSON.parse(localStorage.getItem(storageKey)||'null');const keys=Object.keys(shortcutDefaults) as (keyof Shortcuts)[];
 if(value&&keys.every(k=>choices.includes(value[k]))&&new Set(keys.map(k=>value[k])).size===keys.length)return value;
 }catch{}return {...shortcutDefaults};
}
export default function MapShortcuts({value,onSave,onClose}:{value:Shortcuts;onSave:(next:Shortcuts)=>void;onClose:()=>void}){
 const [draft,setDraft]=useState(value),[error,setError]=useState('');
 function save(){if(new Set(Object.values(draft)).size!==Object.keys(draft).length){setError('בחרי מקש שונה לכל פעולה.');return;}
 try{localStorage.setItem(storageKey,JSON.stringify(draft));onSave(draft);onClose();}catch{setError('לא ניתן לשמור את הקיצורים בדפדפן.');}}
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent dir="rtl" className="detail-dialog"><DialogTitle>קיצורי המקלדת שלך</DialogTitle><DialogDescription>פועלים כשהמפה ממוקדת, ולא בזמן כתיבה. האותיות מציינות את מיקום המקש באנגלית, גם כשהמקלדת בעברית. נשמרים בדפדפן הזה.</DialogDescription>
 <div className="shortcut-grid">{(Object.keys(labels) as (keyof Shortcuts)[]).map(k=><label key={k}>{labels[k]}<select value={draft[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})}>{choices.map(code=><option key={code} value={code}>{keyLabel(code)}</option>)}</select></label>)}</div>
 <p className="muted">חצים מזיזים רעיון או קשר נבחר; בלי בחירה הם מזיזים את התצוגה. Shift מזיז מהר יותר. חיבור נשמר אוטומטית כ־?. Escape מבטל לפני בחירת יעד. אפשר גם Shift וגרירה מכל מקום על בועת רעיון כדי לחבר.</p>
 {error&&<p role="alert" className="error">{error}</p>}<div className="row"><button className="primary" onClick={save}>שמירת קיצורים</button><button className="secondary" onClick={()=>setDraft({...shortcutDefaults})}>ברירת מחדל</button><button className="secondary" onClick={onClose}>ביטול</button></div></DialogContent></Dialog>;
}
