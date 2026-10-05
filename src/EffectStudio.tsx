import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import FlowerBirds from './FlowerBirds';
import GrowingGarden from './GrowingGarden';
import FireScreen from './FireScreen';

export type EffectConfig={kind:'garden'|'birds'|'fire';color:string;speed:number;density:number;area:'full'|'bottom'|'edges'};
type SavedEffect={id:string;name:string;config:EffectConfig};
const defaults:EffectConfig={kind:'garden',color:'#e85b9d',speed:1,density:1,area:'full'};
const storageKey='thinking-graph:effects:v1';
export function validEffect(value:any):value is EffectConfig{return !!value&&['garden','birds','fire'].includes(value.kind)&&/^#[0-9a-f]{6}$/i.test(value.color)&&Number.isFinite(value.speed)&&value.speed>=.25&&value.speed<=2&&Number.isFinite(value.density)&&value.density>=.3&&value.density<=1.5&&['full','bottom','edges'].includes(value.area);}
export function parseEffect(text:string,base:EffectConfig):{config:EffectConfig;message:string}{
 const config={...base};const found:string[]=[];
 const kinds:Array<[RegExp,EffectConfig['kind']]>=[[/אש|מדורה|בוער/,'fire'],[/ציפור|ציפורים/,'birds'],[/גן|פרח|פרחים|צמח|צמחים/,'garden']];
 const matches=kinds.filter(([pattern])=>pattern.test(text));
 // Flower birds is one supported effect, rather than two conflicting effects.
 if(matches.some(([,kind])=>kind==='birds')&&!matches.some(([,kind])=>kind==='fire')){config.kind='birds';found.push('ציפורים');}
 else if(matches.length===1){config.kind=matches[0][1];found.push('סוג אפקט');}
 else if(matches.length>1)return {config:base,message:'יש כאן כמה אפקטים שונים. בחרי אפקט אחד בעורך.'};
 const colors:Array<[RegExp,string]>=[[/ורוד/,'#e85b9d'],[/כחול/,'#245dcc'],[/ירוק/,'#215b4b'],[/סגול/,'#7639a7'],[/כתום/,'#ed6c02'],[/אדום/,'#c62828'],[/צהוב/,'#ffcf33'],[/לבן/,'#ffffff']];
 const colorMatches=colors.filter(([pattern])=>pattern.test(text));
 if(colorMatches.length===1){config.color=colorMatches[0][1];found.push('צבע');}
 if(/איטי|לאט/.test(text)){config.speed=.5;found.push('מהירות');}else if(/מהיר/.test(text)){config.speed=1.7;found.push('מהירות');}
 if(/מעט|דליל|עדין/.test(text)){config.density=.5;found.push('צפיפות');}else if(/הרבה|צפוף/.test(text)){config.density=1.5;found.push('צפיפות');}
 if(/שוליים|בשולי|מסביב/.test(text)){config.area='edges';found.push('מיקום');}else if(/למטה|תחתית/.test(text)){config.area='bottom';found.push('מיקום');}else if(/כל המסך/.test(text)){config.area='full';found.push('מיקום');}
 return {config,message:found.length?`עודכנו: ${found.join(', ')}. זהו פירוש לפי מילים מוכרות בלבד; בדקי את השדות. פרטים אחרים בתיאור לא פורשו.`:'לא זוהתה הוראה נתמכת. אפשר לבחור את ההגדרות ידנית; התיאור לא שינה דבר.'};
}
export function CustomEffect({config}:{config:EffectConfig}){
 const props={color:config.color,speed:config.speed,density:config.density};
 return <div className={`custom-effect-layer effect-area-${config.area}`} aria-hidden="true">{config.kind==='garden'?<GrowingGarden {...props}/>:config.kind==='birds'?<FlowerBirds {...props}/>:<FireScreen {...props}/>}</div>;
}
export default function EffectStudio({onApply,onStop,active}:{onApply:(config:EffectConfig)=>void;onStop:()=>void;active:boolean}){
 const [open,setOpen]=useState(false),[config,setConfig]=useState<EffectConfig>(defaults),[prompt,setPrompt]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState('');
 const [saved,setSaved]=useState<SavedEffect[]>(()=>{try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(data)?data.filter(x=>typeof x.id==='string'&&typeof x.name==='string'&&validEffect(x.config)).slice(0,24):[];}catch{return [];}});
 function save(){if(!name.trim()){setMessage('תני שם לאפקט לפני השמירה.');return;}if(saved.length>=24){setMessage('ניתן לשמור עד 24 אפקטים.');return;}const next=[...saved,{id:crypto.randomUUID(),name:name.trim(),config:{...config}}];try{localStorage.setItem(storageKey,JSON.stringify(next));setSaved(next);setMessage('האפקט נשמר בדפדפן הזה.');}catch{setMessage('לא ניתן לשמור באחסון הדפדפן. אפשר עדיין להפעיל תצוגה מקדימה.');}}
 return <><button className="secondary" onClick={()=>setOpen(true)}>יצירת אפקט</button>{active&&<button className="secondary" onClick={onStop}>כיבוי האפקט שלי</button>}<Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="detail-dialog"><DialogTitle>סטודיו לאפקטים</DialogTitle><DialogDescription>הרכיבי אפקט מקומי. אין מודל AI או שליחת מידע לשירות חיצוני.</DialogDescription>
 <label>מה תרצי לראות?<textarea maxLength={500} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="למשל: גן ורוד שגדל לאט מסביב למסך"/></label><button className="secondary" disabled={!prompt.trim()} onClick={()=>{const result=parseEffect(prompt,config);setConfig(result.config);setMessage(result.message);}}>פירוש התיאור</button>
 <label>אפקט<select value={config.kind} onChange={e=>setConfig({...config,kind:e.target.value as EffectConfig['kind']})}><option value="garden">גן צומח</option><option value="birds">ציפורים מפרחים</option><option value="fire">אש</option></select></label>
 <label>צבע<input aria-label="צבע האפקט" type="color" value={config.color} onChange={e=>setConfig({...config,color:e.target.value})}/></label>
 <label>מהירות · {config.speed.toFixed(2)}×<input type="range" min=".25" max="2" step=".05" value={config.speed} onChange={e=>setConfig({...config,speed:Number(e.target.value)})}/></label>
 <label>צפיפות · {Math.round(config.density*100)}%<input type="range" min=".3" max="1.5" step=".1" value={config.density} onChange={e=>setConfig({...config,density:Number(e.target.value)})}/></label>
 <label>מיקום<select value={config.area} onChange={e=>setConfig({...config,area:e.target.value as EffectConfig['area']})}><option value="full">כל המסך</option><option value="bottom">תחתית המסך</option><option value="edges">שולי המסך</option></select></label>
 <button className="primary" onClick={()=>{onApply({...config});setOpen(false);}}>הפעלה לתצוגה מקדימה</button>
 <label>שם לאפקט שלי<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="הגן הוורוד שלי"/></label><button className="secondary" onClick={save}>שמירה לאפקטים שלי</button>
 {message&&<p role="status" className="muted">{message}</p>}<h3>האפקטים שלי · {saved.length}</h3>{!saved.length&&<p className="muted">אפקטים שתשמרי יופיעו כאן, גם אחרי רענון באותו דפדפן.</p>}<div className="saved-effects">{saved.map(item=><button key={item.id} className="secondary" onClick={()=>{setConfig(item.config);setName(item.name);onApply({...item.config});setOpen(false);}}>{item.name}</button>)}</div>
 </DialogContent></Dialog></>;
}
