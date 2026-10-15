import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import FlowerBirds from './FlowerBirds';
import GrowingGarden from './GrowingGarden';
import FireScreen from './FireScreen';

// Browser-local effects. The studio creates two kinds (2026-10-13):
// - pattern: a print drawn on a grid of squares (more squares = more detail), tiled over the screen;
// - images: up to 8 uploaded pictures that float freely around the screen.
// garden/birds/fire remain only so effects saved earlier still play.
export type EffectConfig={kind:'garden'|'birds'|'fire'|'pattern'|'images';color:string;speed:number;density:number;area:'full'|'bottom'|'edges';
 pattern?:{size:number;cells:(string|null)[]};tile?:number;images?:string[]};
type SavedEffect={id:string;name:string;config:EffectConfig};
const storageKey='thinking-graph:effects:v1';
const MAX_IMAGES=8,IMAGE_PX=180;
const hexColor=/^#[0-9a-f]{6}$/i;
function blankPattern(size:number){return {size,cells:Array<string|null>(size*size).fill(null)};}
const defaults:EffectConfig={kind:'pattern',color:'#e85b9d',speed:1,density:.6,area:'full',pattern:blankPattern(8),tile:80,images:[]};

export function validEffect(value:any):value is EffectConfig{
 if(!value||!['garden','birds','fire','pattern','images'].includes(value.kind)||!hexColor.test(value.color)||!Number.isFinite(value.speed)||value.speed<.25||value.speed>2||!Number.isFinite(value.density)||value.density<.1||value.density>1.5||!['full','bottom','edges'].includes(value.area))return false;
 if(value.kind==='pattern'){const p=value.pattern;return !!p&&Number.isInteger(p.size)&&p.size>=3&&p.size<=24&&Array.isArray(p.cells)&&p.cells.length===p.size*p.size&&p.cells.every((c:any)=>c===null||hexColor.test(c))&&Number.isFinite(value.tile)&&value.tile>=24&&value.tile<=240;}
 if(value.kind==='images')return Array.isArray(value.images)&&value.images.length>=1&&value.images.length<=MAX_IMAGES&&value.images.every((s:any)=>typeof s==='string'&&s.startsWith('data:image/')&&s.length<600000);
 return true;
}
export function loadSavedEffects():SavedEffect[]{try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(data)?data.filter((x:any)=>typeof x.id==='string'&&typeof x.name==='string'&&validEffect(x.config)).slice(0,24):[];}catch{return [];}}
function storeEffects(list:SavedEffect[]){localStorage.setItem(storageKey,JSON.stringify(list));}

// Draws the grid once into an image and repeats it over the effect area, drifting slowly.
function PatternLayer({config}:{config:EffectConfig}){
 const p=config.pattern!,tile=config.tile||80;
 const url=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=p.size*8;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  p.cells.forEach((c,i)=>{if(c){ctx.fillStyle=c;ctx.fillRect((i%p.size)*8,Math.floor(i/p.size)*8,8,8);}});return canvas.toDataURL();},[p.size,p.cells]);
 return <div className="pattern-layer" style={{backgroundImage:`url(${url})`,backgroundSize:`${tile}px ${tile}px`,opacity:Math.min(.9,config.density),animationDuration:`${Math.round(60/config.speed)}s`,['--tile' as any]:`${tile}px`}}/>;
}

// Each picture floats on its own path and bounces off the screen edges.
function FloatingImages({config}:{config:EffectConfig}){
 const box=useRef<HTMLDivElement>(null);
 const copies=Math.max(1,Math.round(config.density*2));
 const items=useMemo(()=>(config.images||[]).flatMap((src,i)=>Array.from({length:copies},(_,c)=>({key:`${i}-${c}`,src}))),[config.images,copies]);
 useEffect(()=>{
  const root=box.current;if(!root)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes=[...root.querySelectorAll<HTMLImageElement>('img')];
  const state=nodes.map(()=>({x:Math.random()*(window.innerWidth-120),y:Math.random()*(window.innerHeight-120),vx:(Math.random()-.5)*1.6,vy:(Math.random()-.5)*1.6,r:Math.random()*360,vr:(Math.random()-.5)*.4}));
  let frame=0,last=performance.now();
  function step(now:number){
   const dt=Math.min(50,now-last)/16.7*config.speed;last=now;
   const w=root!.clientWidth,h=root!.clientHeight;
   nodes.forEach((node,i)=>{const s=state[i],size=node.offsetWidth||100;
    if(!reduce){s.x+=s.vx*dt;s.y+=s.vy*dt;s.r+=s.vr*dt;}
    if(s.x<0||s.x>w-size){s.vx*=-1;s.x=Math.max(0,Math.min(w-size,s.x));}
    if(s.y<0||s.y>h-size){s.vy*=-1;s.y=Math.max(0,Math.min(h-size,s.y));}
    node.style.transform=`translate(${s.x}px,${s.y}px) rotate(${s.r}deg)`;});
   frame=requestAnimationFrame(step);
  }
  frame=requestAnimationFrame(step);
  return()=>cancelAnimationFrame(frame);
 },[items,config.speed]);
 return <div ref={box} className="floating-images">{items.map(item=><img key={item.key} src={item.src} alt=""/>)}</div>;
}

export function CustomEffect({config}:{config:EffectConfig}){
 const props={color:config.color,speed:config.speed,density:config.density};
 const content=config.kind==='pattern'?<PatternLayer config={config}/>:config.kind==='images'?<FloatingImages config={config}/>:
  config.kind==='garden'?<GrowingGarden {...props}/>:config.kind==='birds'?<FlowerBirds {...props}/>:<FireScreen {...props}/>;
 return <div className={`custom-effect-layer effect-area-${config.area}`} aria-hidden="true">{content}</div>;
}

// Shrinks an uploaded picture so several fit in browser storage.
function shrink(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{const scale=Math.min(1,IMAGE_PX/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
   canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/png'));};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('bad image'));};img.src=url;});
}
function resample(pattern:{size:number;cells:(string|null)[]},size:number){
 return {size,cells:Array.from({length:size*size},(_,i)=>{const x=Math.floor((i%size)*pattern.size/size),y=Math.floor(Math.floor(i/size)*pattern.size/size);return pattern.cells[y*pattern.size+x]??null;})};
}

export default function EffectStudio({open,onOpenChange,onApply}:{open:boolean;onOpenChange:(open:boolean)=>void;onApply:(config:EffectConfig)=>void}){
 const [config,setConfig]=useState<EffectConfig>(defaults),[name,setName]=useState(''),[message,setMessage]=useState(''),[erase,setErase]=useState(false);
 const [saved,setSaved]=useState<SavedEffect[]>(loadSavedEffects);
 // Painting follows the pointer over the grid and fills every square on the way, so a fast drag
 // never skips squares (pointer events can arrive far apart).
 const painting=useRef<number|null>(null),gridRef=useRef<HTMLDivElement>(null);
 const pattern=config.pattern||blankPattern(8);
 useEffect(()=>{if(open)setSaved(loadSavedEffects());},[open]);
 function paintCells(list:number[]){setConfig(c=>{const p=c.pattern||blankPattern(8);const cells=[...p.cells];list.forEach(i=>{cells[i]=erase?null:c.color;});return {...c,pattern:{...p,cells}};});}
 function cellAt(x:number,y:number){const grid=gridRef.current;if(!grid)return null;const r=grid.getBoundingClientRect(),n=pattern.size;
  if(x<r.left||y<r.top||x>=r.right||y>=r.bottom)return null;
  // The grid runs right-to-left (RTL), so column 0 is on the right.
  const col=n-1-Math.floor((x-r.left)/r.width*n),row=Math.floor((y-r.top)/r.height*n);return row*n+col;}
 function lineBetween(a:number,b:number){const n=pattern.size;let [x0,y0]=[a%n,Math.floor(a/n)];const [x1,y1]=[b%n,Math.floor(b/n)];
  const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx+dy;const out:number[]=[];
  for(;;){out.push(y0*n+x0);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}return out;}
 function startPaint(e:React.PointerEvent<HTMLDivElement>){const i=cellAt(e.clientX,e.clientY);if(i===null)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);painting.current=i;paintCells([i]);}
 function movePaint(e:React.PointerEvent<HTMLDivElement>){if(painting.current===null)return;const i=cellAt(e.clientX,e.clientY);if(i===null||i===painting.current)return;paintCells(lineBetween(painting.current,i));painting.current=i;}
 function randomFill(){const palette=[config.color,'#ffffff',null,null];setConfig(c=>({...c,pattern:{...pattern,cells:pattern.cells.map(()=>palette[Math.floor(Math.random()*palette.length)])}}));}
 async function addImages(files:FileList|null){
  if(!files)return;const room=MAX_IMAGES-(config.images||[]).length;const chosen=[...files].filter(f=>f.type.startsWith('image/')).slice(0,room);
  if(!chosen.length){setMessage(room?'בחרי קובצי תמונה.':`אפשר עד ${MAX_IMAGES} תמונות.`);return;}
  try{const urls=await Promise.all(chosen.map(shrink));setConfig(c=>({...c,images:[...(c.images||[]),...urls]}));setMessage('');}catch{setMessage('אחת התמונות לא נפתחה. נסי קובץ אחר.');}
 }
 const ready=config.kind==='pattern'?pattern.cells.some(Boolean):(config.images||[]).length>0;
 function finalConfig():EffectConfig{return config.kind==='pattern'?{...config,images:undefined}:{...config,pattern:undefined,tile:undefined};}
 function save(){
  if(!name.trim()){setMessage('תני שם לאפקט לפני השמירה.');return;}
  if(saved.length>=24){setMessage('ניתן לשמור עד 24 אפקטים. מחקי אפקט ישן.');return;}
  const next=[...saved,{id:crypto.randomUUID(),name:name.trim(),config:finalConfig()}];
  try{storeEffects(next);setSaved(next);setMessage('האפקט נשמר בדפדפן הזה ויופיע בתפריט האפקטים.');}catch{setMessage('אין מספיק מקום באחסון הדפדפן (תמונות תופסות מקום). אפשר להפעיל בלי לשמור, או להשתמש בפחות תמונות.');}
 }
 function remove(id:string){const next=saved.filter(s=>s.id!==id);try{storeEffects(next);}catch{}setSaved(next);}
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="detail-dialog effect-studio"><DialogTitle>יצירת אפקט</DialogTitle><DialogDescription>הדפס משבצות או תמונות שמרחפות במסך. הכול נשמר רק בדפדפן הזה.</DialogDescription>
  <div className="studio-kinds" role="radiogroup" aria-label="סוג האפקט">{([['pattern','הדפס'],['images','תמונות']] as const).map(([kind,label])=><button key={kind} role="radio" aria-checked={config.kind===kind} className={config.kind===kind?'primary':'secondary'} onClick={()=>setConfig(c=>({...c,kind}))}>{label}</button>)}</div>
  {config.kind==='pattern'?<>
   <label>מספר משבצות בכל שורה · {pattern.size} (יותר משבצות = הדפס מפורט יותר)<input type="range" min="3" max="24" step="1" value={pattern.size} onChange={e=>setConfig(c=>({...c,pattern:resample(c.pattern||blankPattern(8),Number(e.target.value))}))}/></label>
   <div className="row studio-tools"><label className="inline-check">צבע<input aria-label="צבע המכחול" type="color" value={config.color} onChange={e=>{setConfig({...config,color:e.target.value});setErase(false);}}/></label>
    <button className={erase?'primary':'secondary'} aria-pressed={erase} onClick={()=>setErase(v=>!v)}>מחק</button><button className="secondary" onClick={randomFill}>מילוי אקראי</button><button className="secondary" onClick={()=>setConfig(c=>({...c,pattern:blankPattern(pattern.size)}))}>ניקוי</button></div>
   <div ref={gridRef} className="pattern-grid" style={{gridTemplateColumns:`repeat(${pattern.size},1fr)`}} onPointerDown={startPaint} onPointerMove={movePaint} onPointerUp={()=>{painting.current=null;}} onPointerCancel={()=>{painting.current=null;}}>
    {pattern.cells.map((cell,i)=><button key={i} aria-label={`משבצת ${i+1}`} style={{background:cell||'transparent'}} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();paintCells([i]);}}}/>)}
   </div>
   <label>גודל ההדפס במסך · {config.tile}px<input type="range" min="24" max="240" step="4" value={config.tile||80} onChange={e=>setConfig({...config,tile:Number(e.target.value)})}/></label>
  </>:<>
   <label>העלאת תמונות (עד {MAX_IMAGES})<input type="file" accept="image/*" multiple onChange={e=>{void addImages(e.target.files);e.target.value='';}}/></label>
   <div className="studio-images">{(config.images||[]).map((src,i)=><span key={i}><img src={src} alt={`תמונה ${i+1}`}/><button aria-label={`הסרת תמונה ${i+1}`} onClick={()=>setConfig(c=>({...c,images:(c.images||[]).filter((_,n)=>n!==i)}))}>×</button></span>)}</div>
  </>}
  <label>מהירות · {config.speed.toFixed(2)}×<input type="range" min=".25" max="2" step=".05" value={config.speed} onChange={e=>setConfig({...config,speed:Number(e.target.value)})}/></label>
  <label>{config.kind==='pattern'?'עוצמה':'כמות'} · {Math.round(config.density*100)}%<input type="range" min=".1" max="1.5" step=".1" value={config.density} onChange={e=>setConfig({...config,density:Number(e.target.value)})}/></label>
  <label>מיקום<select value={config.area} onChange={e=>setConfig({...config,area:e.target.value as EffectConfig['area']})}><option value="full">כל המסך</option><option value="bottom">תחתית המסך</option><option value="edges">שולי המסך</option></select></label>
  <button className="primary" disabled={!ready} onClick={()=>{onApply(finalConfig());onOpenChange(false);}}>הפעלה</button>
  <label>שם לאפקט<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="ההדפס הוורוד שלי"/></label><button className="secondary" disabled={!ready} onClick={save}>שמירה לאפקטים שלי</button>
  {message&&<p role="status" className="muted">{message}</p>}
  {saved.length>0&&<><h3>האפקטים שלי · {saved.length}</h3><div className="saved-effects">{saved.map(item=><span key={item.id} className="saved-effect"><button className="secondary" onClick={()=>{onApply({...item.config});onOpenChange(false);}}>{item.name}</button><button className="icon-button" aria-label={`מחיקת ${item.name}`} onClick={()=>remove(item.id)}>×</button></span>)}</div></>}
 </DialogContent></Dialog>;
}
