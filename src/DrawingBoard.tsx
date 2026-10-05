import { useRef, useState, type PointerEvent } from 'react';

type Point = {x:number;y:number};
type Stroke = {color:string;points:Point[]};
export default function DrawingBoard({workspaceId,themeColor}:{workspaceId:string;themeColor:string}){
  const key=`thinking-graph:drawing:${workspaceId}`;
  const [error,setError]=useState('');
  const [strokes,setStrokes]=useState<Stroke[]>(()=>{
    try{return workspaceId?JSON.parse(localStorage.getItem(key)||'[]'):[];}catch{return [];}
  });
  const [current,setCurrent]=useState<Stroke|null>(null);
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
      <label>צבע העט <input aria-label="צבע העט" type="color" value={color} onChange={e=>updatePen({linked:false,color:e.target.value})}/></label>
      <button className="secondary" aria-pressed={pen.linked} onClick={()=>updatePen({linked:!pen.linked,color})}>{pen.linked?'🔗 מקושר לצבע המערכת':'קישור לצבע המערכת'}</button>
      <button className="secondary" disabled={!strokes.length||!!current} onClick={()=>save(strokes.slice(0,-1))}>ביטול קו אחרון</button>
    </div>
    {!workspaceId&&<p className="drawing-hint">שלחי הודעה או פתחי מרחב כדי להתחיל לצייר.</p>}
    <svg className="drawing-canvas" viewBox="0 0 600 700" role="img" aria-label="משטח ציור חופשי" onPointerDown={e=>{
      if(!workspaceId||e.button!==0||active.current)return;
      e.currentTarget.setPointerCapture(e.pointerId);
      active.current={color,points:[point(e)]};setCurrent(active.current);
    }} onPointerMove={e=>{if(active.current){active.current={...active.current,points:[...active.current.points,point(e)]};setCurrent(active.current);}}} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      {[...strokes,...(current?[current]:[])].map((stroke,i)=><g key={i}>
        {stroke.points.length===1?<circle cx={stroke.points[0].x} cy={stroke.points[0].y} r="2" fill={stroke.color}/>:<polyline points={stroke.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>}
      </g>)}
    </svg>
    <p className="footnote" role="status">{error||penError||'נשמר אוטומטית בדפדפן הזה, בנפרד לכל מרחב.'}</p>
  </section>;
}
