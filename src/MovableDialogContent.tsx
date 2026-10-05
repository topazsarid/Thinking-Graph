import {useEffect,useRef,useState,type ComponentProps,type PointerEvent} from 'react';
import {DialogContent} from '@/components/ui/dialog';

export default function MovableDialogContent({children,className='',...props}:ComponentProps<typeof DialogContent>){
 const element=useRef<HTMLDivElement>(null);
 const [box,setBox]=useState<{left:number;top:number;width:number;height:number}|null>(null);
 const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 function fit(left:number,top:number,width:number,height:number){
  width=Math.min(window.innerWidth-16,Math.max(280,width));height=Math.min(window.innerHeight-16,Math.max(220,height));
  setBox({left:Math.max(8,Math.min(left,window.innerWidth-width-8)),top:Math.max(8,Math.min(top,window.innerHeight-height-8)),width,height});
 }
 function resize(factor:number){const b=element.current!.getBoundingClientRect();fit(b.left,b.top,b.width*factor,b.height*factor);}
 function start(e:PointerEvent){if(e.button!==0||(e.target as Element).closest('button'))return;const b=element.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,left:b.left,top:b.top};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}
 useEffect(()=>{const resized=()=>{if(element.current){const b=element.current.getBoundingClientRect();fit(b.left,b.top,b.width,b.height);}};window.addEventListener('resize',resized);return()=>window.removeEventListener('resize',resized);},[]);
 return <DialogContent {...props} ref={element} className={`movable-dialog ${className}`} style={box?{...props.style,...box,transform:'none',translate:'none'}:props.style}>
  <div className="dialog-move-bar" aria-label="הזזת חלון" tabIndex={0} onPointerDown={start} onPointerMove={e=>{const d=drag.current;if(!d)return;const b=element.current!.getBoundingClientRect();fit(d.left+e.clientX-d.x,d.top+e.clientY-d.y,b.width,b.height);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={e=>{if(e.target!==e.currentTarget||!e.key.startsWith('Arrow'))return;e.preventDefault();const b=element.current!.getBoundingClientRect();fit(b.left+(e.key==='ArrowRight'?20:e.key==='ArrowLeft'?-20:0),b.top+(e.key==='ArrowDown'?20:e.key==='ArrowUp'?-20:0),b.width,b.height);}}>
   <span>⠿ גרירה להזזה</span><button type="button" aria-label="הקטנת חלון" onClick={()=>resize(.85)}>−</button><button type="button" aria-label="הגדלת חלון" onClick={()=>resize(1.15)}>＋</button>
  </div>{children}
 </DialogContent>;
}
