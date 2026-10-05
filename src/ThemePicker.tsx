import {useLayoutEffect,useState,type PointerEvent} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
type Color={h:number;s:number;v:number};
function rgb({h,s,v}:Color){
 const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
 const parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return parts.map(p=>Math.round((p+m)*255));
}
function hex(color:Color){return '#'+rgb(color).map(n=>n.toString(16).padStart(2,'0')).join('');}
function fromHex(value:string):Color{
 const [r,g,b]=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 const h=d===0?0:max===r?60*(((g-b)/d+6)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
 return {h,s:max===0?0:d/max,v:max};
}
const colors=[['שחור','#161616'],['אפור','#808080'],['לבן','#ffffff'],['אדום','#c62828'],['כתום','#ed6c02'],['צהוב','#ffcf33'],['ירוק','#215b4b'],['טורקיז','#008b8b'],['כחול','#245dcc'],['סגול','#7639a7'],['ורוד','#e85b9d'],['ורוד בהיר','#ffc3dc'],['אפור בהיר','#c7c7c7'],['חום','#8c5738'],['אפרסק','#ffb48f'],['קרם','#fff0b0'],['ירוק בהיר','#a8d5a2'],['תכלת','#a0d8ef'],['לבנדר','#c6b7ec'],['בורדו','#81264e']];
function initial():Color{try{const saved=JSON.parse(localStorage.getItem('thinking-graph:color')||'null');if(saved&&Number.isFinite(saved.h)&&saved.h>=0&&saved.h<=360&&saved.s>=0&&saved.s<=1&&saved.v>=0&&saved.v<=1)return saved;const old=localStorage.getItem('thinking-graph:hue');if(old!==null&&Number.isFinite(Number(old)))return {h:Number(old),s:.64,v:.48};}catch{}return fromHex('#215b4b');}
export default function ThemePicker({onColorChange}:{onColorChange:(color:string)=>void}){
 const [open,setOpen]=useState(false),[error,setError]=useState(''),[color,setColor]=useState<Color>(initial);
 const selected=hex(color);
 useLayoutEffect(()=>{
   onColorChange(selected);
   const root=document.documentElement.style;
   root.setProperty('--hue',String(color.h));root.setProperty('--chosen-color',selected);
   const linear=rgb(color).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
   const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
   root.setProperty('--chosen-foreground',luminance>.179?'#171717':'#ffffff');
   root.setProperty('--theme-ink',`hsl(${color.h} ${Math.round(color.s*60)}% 28%)`);
 },[color,selected,onColorChange]);
 function choose(next:Color){setColor(next);try{localStorage.setItem('thinking-graph:color',JSON.stringify(next));setError('');}catch{setError('הצבע השתנה, אך לא ניתן לשמור את ההעדפה בדפדפן.');}}
 function pick(e:PointerEvent<HTMLDivElement>){const box=e.currentTarget.getBoundingClientRect();choose({...color,s:Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),v:1-Math.max(0,Math.min(1,(e.clientY-box.top)/box.height))});}
 return <><button className="secondary" onClick={()=>setOpen(true)}>שינוי צבע</button><Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="color-dialog"><DialogTitle>בחירת צבע למערכת</DialogTitle><DialogDescription>בחרי משבצת או צבע מדויק בריבוע. הבחירה נשמרת בדפדפן הזה.</DialogDescription>
 <div className="paint-swatches">{colors.map(([name,value])=><button key={value} aria-label={name} title={name} aria-pressed={selected===value} style={{background:value}} onClick={()=>choose(fromHex(value))}/>)}</div>
 <div className="color-square" role="group" aria-label="בחירת עוצמת צבע ובהירות" style={{backgroundColor:`hsl(${color.h} 100% 50%)`}} onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);pick(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))pick(e);}}><span className="color-cursor" style={{left:`${color.s*100}%`,top:`${(1-color.v)*100}%`}}/></div>
 <label>משפחת הצבע<input className="hue-strip" dir="ltr" type="range" min="0" max="359" value={Math.round(color.h)} onChange={e=>choose({...color,h:Number(e.target.value)})}/></label>
 <div className="color-preview-row"><span className="color-preview" style={{background:selected}} aria-label={`הצבע שנבחר ${selected}`}/><span>הצבע שבחרת</span><button className="secondary" onClick={()=>choose(fromHex('#215b4b'))}>חזרה לירוק המקורי</button></div>
 <details><summary>דיוק בצבע באמצעות מקלדת</summary><label>עוצמת הצבע<input dir="ltr" type="range" min="0" max="100" value={Math.round(color.s*100)} onChange={e=>choose({...color,s:Number(e.target.value)/100})}/></label><label>בהירות<input dir="ltr" type="range" min="0" max="100" value={Math.round(color.v*100)} onChange={e=>choose({...color,v:Number(e.target.value)/100})}/></label></details>
 <p className="muted">עט מקושר יקבל את הצבע החדש. קווים שכבר צוירו שומרים על צבעם.</p>{error&&<p role="alert">{error}</p>}<button className="primary" onClick={()=>setOpen(false)}>סיום</button></DialogContent></Dialog></>;
}
