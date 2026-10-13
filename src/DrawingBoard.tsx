import { useEffect, useRef, useState, type PointerEvent } from 'react';

type Point = {x:number;y:number};
type Stroke = {color:string;points:Point[]};
export default function DrawingBoard({workspaceId,themeColor}:{workspaceId:string;themeColor:string}){
  const key=`thinking-graph:drawing:${workspaceId}`;
  const [error,setError]=useState('');
  const [clearing,setClearing]=useState(false);
  const [strokes,setStrokes]=useState<Stroke[]>(()=>{
    try{return workspaceId?JSON.parse(localStorage.getItem(key)||'[]'):[];}catch{return [];}
  });
  const [current,setCurrent]=useState<Stroke|null>(null);
  // Zoom: the visible part of the 600x700 drawing (viewBox). Wheel zooms at the pointer;
  // buttons zoom at the center; "הזזה" mode drags the view instead of drawing.
  const BASE={x:0,y:0,w:600,h:700};
  const [view,setView]=useState(BASE),[panMode,setPanMode]=useState(false);
  const svgRef=useRef<SVGSVGElement>(null),viewRef=useRef(view),pan=useRef<{x:number;y:number;view:typeof BASE}|null>(null);
  viewRef.current=view;
  function zoom(factor:number,cx?:number,cy?:number){
    const v=viewRef.current,w=Math.max(150,Math.min(2400,v.w/factor)),h=w*7/6;
    const px=cx??v.x+v.w/2,py=cy??v.y+v.h/2;
    const next={x:px-(px-v.x)*w/v.w,y:py-(py-v.y)*h/v.h,w,h};viewRef.current=next;setView(next);
  }
  useEffect(()=>{const svg=svgRef.current!;
    function wheel(e:WheelEvent){if(!e.deltaY)return;e.preventDefault();const m=svg.getScreenCTM();if(!m)return;
      const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());zoom(Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.002),p.x,p.y);}
    svg.addEventListener('wheel',wheel,{passive:false});return()=>svg.removeEventListener('wheel',wheel);},[]);
  const active=useRef<Stroke|null>(null);
  const [pen,setPen]=useState<{linked:boolean;color:string}>(()=>{
    try{const saved=JSON.parse(localStorage.getItem('thinking-graph:pen')||'null');
      if(saved&&typeof saved.linked==='boolean'&&/^#[0-9a-f]{6}$/i.test(saved.color))return saved;
    }catch{}
    return {linked:true,color:'#215b4b'};
  });
  const [penError,setPenError]=useState('');
  const color=pen.linked?themeColor:pen.color;
  function updatePen(next:{linked:boolean;color:string}){
    setPen(next);
    try{localStorage.setItem('thinking-graph:pen',JSON.stringify(next));setPenError('');}
    catch{setPenError('העדפת העט השתנתה אך לא נשמרה בדפדפן.');}
  }
  function save(next:Stroke[]){
    setStrokes(next);
    try{localStorage.setItem(key,JSON.stringify(next));setError('');}
    catch{setError('הציור מוצג אך לא נשמר. ייתכן שאחסון הדפדפן מלא.');}
  }
  function point(e:PointerEvent<SVGSVGElement>):Point{
    const matrix=e.currentTarget.getScreenCTM();
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix!.inverse());
    return {x:p.x,y:p.y};
  }
  function finish(){if(active.current){save([...strokes,active.current]);active.current=null;setCurrent(null);}}
  return <section className="drawing-section" aria-label="לוח ציור">
    <div className="drawing-heading"><span className="eyebrow">לוח ציור</span><p>מקום לסקיצות ולחשיבה חופשית</p></div>
    <div className="drawing-tools">
      <div className="row drawing-zoom" role="group" aria-label="זום בציור">
        <button className="secondary" aria-label="הקטנת התצוגה" onClick={()=>zoom(1/1.25)}>−</button>
        <button className="secondary" aria-label="חזרה לגודל רגיל" onClick={()=>setView(BASE)}>{Math.round(600/view.w*100)}%</button>
        <button className="secondary" aria-label="הגדלת התצוגה" onClick={()=>zoom(1.25)}>+</button>
        <button className={panMode?'primary':'secondary'} aria-pressed={panMode} onClick={()=>setPanMode(v=>!v)}>✋ הזזה</button>
      </div>
      <label>צבע העט <input aria-label="צבע העט" type="color" value={color} onChange={e=>updatePen({linked:false,color:e.target.value})}/></label>
      <button className="secondary" aria-pressed={pen.linked} onClick={()=>updatePen({linked:!pen.linked,color})}>{pen.linked?'🔗 מקושר לצבע המערכת':'קישור לצבע המערכת'}</button>
      <button className="secondary" disabled={!strokes.length||!!current} onClick={()=>save(strokes.slice(0,-1))}>ביטול קו אחרון</button>
      <button className="secondary" disabled={!strokes.length||!!current} onClick={()=>setClearing(true)}>מחיקת כל הציורים</button>
      {clearing&&<div role="group" aria-label="אישור מחיקת הציורים"><span>למחוק את כל הציורים בלוח הזה?</span><button className="secondary" disabled={!!current} onClick={()=>{save([]);setClearing(false);}}>כן, למחוק</button><button className="secondary" onClick={()=>setClearing(false)}>ביטול</button></div>}
    </div>
    {!workspaceId&&<p className="drawing-hint">שלחי הודעה או פתחי מרחב כדי להתחיל לצייר.</p>}
    <svg ref={svgRef} className={`drawing-canvas${panMode?' pan-mode':''}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label="משטח ציור חופשי" onPointerDown={e=>{
      if(panMode&&e.button===0){e.currentTarget.setPointerCapture(e.pointerId);pan.current={x:e.clientX,y:e.clientY,view};return;}
      if(!workspaceId||e.button!==0||active.current)return;
      e.currentTarget.setPointerCapture(e.pointerId);
      active.current={color,points:[point(e)]};setCurrent(active.current);
    }} onPointerMove={e=>{if(pan.current){const m=e.currentTarget.getScreenCTM();if(!m)return;const s=pan.current;setView({...s.view,x:s.view.x-(e.clientX-s.x)/m.a,y:s.view.y-(e.clientY-s.y)/m.d});return;}if(active.current){active.current={...active.current,points:[...active.current.points,point(e)]};setCurrent(active.current);}}} onPointerUp={()=>{pan.current=null;finish();}} onPointerCancel={()=>{pan.current=null;finish();}} onLostPointerCapture={()=>{pan.current=null;finish();}}>
      {[...strokes,...(current?[current]:[])].map((stroke,i)=><g key={i}>
        {stroke.points.length===1?<circle cx={stroke.points[0].x} cy={stroke.points[0].y} r="2" fill={stroke.color}/>:<polyline points={stroke.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>}
      </g>)}
    </svg>
    <p className="footnote" role="status">{error||penError||'נשמר אוטומטית בדפדפן הזה, בנפרד לכל מרחב.'}</p>
  </section>;
}
