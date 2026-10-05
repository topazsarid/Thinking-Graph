import {Children,useEffect,useRef,useState,type ReactNode,type PointerEvent} from 'react';
type WindowBox={x:number;y:number;width:number;height:number;visible:boolean};
const names=['שיחה','המפה שלי','ציור'];
const storageKey='thinking-graph:floating-panels:v1';
function clamp(box:WindowBox,width:number,height:number):WindowBox{
 const w=Math.max(Math.min(280,width-16),Math.min(box.width,width-16)),h=Math.max(280,Math.min(box.height,height-16));
 return {...box,width:w,height:h,x:Math.max(8,Math.min(box.x,width-w-8)),y:Math.max(8,Math.min(box.y,height-h-8))};
}
function defaults(w:number,h:number):WindowBox[]{
 const sizes=w<900?[.86,.92,.8]:[.25,.47,.25];
 return [0,1,2].map(i=>clamp({x:w<900?12+i*16:i===0?w*.745:i===1?w*.267:12,y:18+i*12,width:w*sizes[i],height:h-(i===1?50:95),visible:true},w,h));
}
export default function ResizablePanels({children,mobileView}:{children:ReactNode;mobileView:string}){
 const root=useRef<HTMLDivElement>(null),ready=useRef(false);
 const bounds=useRef({width:1200,height:720});
 const [boxes,setBoxes]=useState<WindowBox[]>(()=>defaults(1200,720)),[order,setOrder]=useState([2,0,1]),[maximized,setMaximized]=useState<number|null>(null),[error,setError]=useState('');
 const latest=useRef(boxes);latest.current=boxes;
 const drag=useRef<{kind:'move'|'size';index:number;x:number;y:number;box:WindowBox;pointer:number}|null>(null);
 function persist(value:WindowBox[]){try{localStorage.setItem(storageKey,JSON.stringify(value));setError('');}catch{setError('סידור הלוחות השתנה, אך לא נשמר בדפדפן.');}}
 function update(value:WindowBox[],save=true){latest.current=value;setBoxes(value);if(save)persist(value);}
 useEffect(()=>{const observer=new ResizeObserver(()=>{if(!root.current)return;const {width,height}=root.current.getBoundingClientRect();if(!width||!height)return;bounds.current={width,height};let value=latest.current;
 if(!ready.current){ready.current=true;value=defaults(width,height);try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(stored)&&stored.length===3&&stored.every(b=>b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>0&&b.height>0&&typeof b.visible==='boolean'))value=stored;}catch{}}
 update(value.map(b=>b.x>=0&&b.y>=0&&b.x+b.width<=width+.5&&b.y+b.height<=height+.5?b:clamp(b,width,height)),false);});observer.observe(root.current!);return()=>observer.disconnect();},[]);
 function rearrange(){
  const {width,height}=bounds.current;
  const visible=latest.current.map((box,index)=>({box,index})).filter(({box})=>box.visible).sort((a,b)=>a.box.x-b.box.x||a.box.y-b.box.y||a.index-b.index);
  if(!visible.length)return;
  const next=[...latest.current];
  visible.forEach(({box,index},position)=>{next[index]={...box,x:position*width/visible.length,y:0,width:width/visible.length,height};});
  update(next);setMaximized(null);
 }
 function raise(index:number){setOrder(old=>[...old.filter(i=>i!==index),index]);}
 function toggle(index:number){if(maximized!==null&&maximized!==index){setMaximized(null);raise(index);update(latest.current.map((b,i)=>i===index?{...b,visible:true}:b));return;}const value=latest.current.map((b,i)=>i===index?{...b,visible:!b.visible}:b);if(maximized===index)setMaximized(null);raise(index);update(value);}
 function resize(index:number,factor:number){const {width,height}=bounds.current;setMaximized(null);raise(index);update(latest.current.map((b,i)=>i===index?clamp({...b,width:b.width*factor,height:b.height*factor},width,height):b));}
 function start(e:PointerEvent,index:number,kind:'move'|'size'){
  if(e.button!==0||maximized!==null||(e.target as Element).closest('button'))return;
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);raise(index);drag.current={kind,index,x:e.clientX,y:e.clientY,box:latest.current[index],pointer:e.pointerId};
 }
 function move(e:PointerEvent){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;const {width,height}=bounds.current;
 const box=clamp({...d.box,...(d.kind==='move'?{x:d.box.x+dx,y:d.box.y+dy}:{width:d.box.width+dx,height:d.box.height+dy})},width,height);
 update(latest.current.map((b,i)=>i===d.index?box:b),false);
 }
 function finish(){if(!drag.current)return;drag.current=null;persist(latest.current);}
 const panels=Children.toArray(children);
 return <div data-mobile-view={mobileView} className={`panels-container floating-workspace${maximized!==null?' workspace-maximized':''}`}><div className="floating-panel-toolbar" dir="rtl"><div className="row"><span>הלוחות שלי</span>{names.map((name,index)=><button key={name} className="secondary" aria-pressed={boxes[index].visible&&(maximized===null||maximized===index)} aria-label={`${boxes[index].visible&&(maximized===null||maximized===index)?'הסתרת':'הצגת'} לוח ${name}`} onClick={()=>toggle(index)}>{boxes[index].visible&&(maximized===null||maximized===index)?'◉':'○'} {name}</button>)}</div><button className="text-button" onClick={rearrange}>סידור מחדש</button></div>
 {error&&<p role="status" className="error">{error}</p>}
 <div ref={root} className="floating-board">
 {!boxes.some(b=>b.visible)&&<p className="board-empty">רגע של שקט. הלוחות שלך מחכים בכפתורים למעלה.</p>}
 {panels.map((panel,index)=>{const b=boxes[index];const expanded=maximized===index;return <section key={index} data-mobile-panel={['chat','map','drawing'][index]} className={`floating-window${expanded?' window-maximized':''}`} aria-label={`לוח ${names[index]}`} style={{left:expanded?8:b.x,top:expanded?8:b.y,width:expanded?'calc(100% - 16px)':b.width,height:expanded?'calc(100% - 16px)':b.height,zIndex:expanded?10:order.indexOf(index)+1,display:b.visible&&(maximized===null||expanded)?'flex':'none'}} onPointerDownCapture={()=>raise(index)} onFocusCapture={()=>raise(index)}>
 <div className="floating-window-bar" tabIndex={0} aria-label={`הזזת לוח ${names[index]}`} onPointerDown={e=>start(e,index,'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={e=>{if(e.target!==e.currentTarget||maximized!==null||!e.key.startsWith('Arrow'))return;e.preventDefault();const step=e.shiftKey?40:10;const {width,height}=bounds.current;update(latest.current.map((v,i)=>i===index?clamp({...v,x:v.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:v.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)},width,height):v));}}><strong>{names[index]}</strong><div className="row"><button aria-label={`הקטנת לוח ${names[index]}`} onClick={()=>resize(index,.88)}>−</button><button aria-label={`הגדלת לוח ${names[index]}`} onClick={()=>resize(index,1.12)}>＋</button><button aria-label={`${expanded?'החזרת':'הרחבת'} לוח ${names[index]}`} onClick={()=>{raise(index);setMaximized(expanded?null:index);}}>{expanded?'↙':'⤢'}</button><button aria-label={`הסתרת ${names[index]}`} onClick={()=>toggle(index)}>—</button></div></div>
 <div className="floating-window-body" dir="rtl">{panel}</div>
 {!expanded&&<div className="window-resize-grip" role="separator" aria-label={`שינוי גודל לוח ${names[index]}`} tabIndex={0} onPointerDown={e=>start(e,index,'size')} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();const step=e.shiftKey?40:10;const {width,height}=bounds.current;update(latest.current.map((v,i)=>i===index?clamp({...v,width:v.width+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),height:v.height+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)},width,height):v));}}>◢</div>}
 </section>;})}</div></div>;
}
