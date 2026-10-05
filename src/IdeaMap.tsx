import {connectedGroup,titleLines} from './mapGroups';
import MapShortcuts,{loadShortcuts,keyLabel} from './MapShortcuts';
import {ContextMenu} from 'radix-ui';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
type Point={x:number;y:number;scale?:number};
type Gesture={kind:'pan'|'move'|'link'|'edge'|'select';id:string;start:Point;original:Point;moved:boolean;pointer:number;group?:Record<string,Point>};
export default function IdeaMap({ideas,edges,workspaceId,onInspect,onConnect,onConnection,onDelete,onCreate,onQuickCreate,placement,onPlaced,busy}:{ideas:any[];edges:any[];workspaceId:string;onInspect:(id:string)=>void;onConnect:(ids:string[])=>Promise<void>;onConnection:(id:string)=>void;onDelete:(id:string)=>Promise<void>;onQuickCreate:(title:string,point:Point)=>Promise<void>;onCreate:(kind:'idea'|'question',point:Point)=>void;onPlaced:()=>void;placement:{id:string;workspaceId:string;point:Point}|null;busy:boolean}){
 const [shortcuts,setShortcuts]=useState(loadShortcuts),[shortcutsOpen,setShortcutsOpen]=useState(false),[pendingLink,setPendingLink]=useState<string[]|null>(null),[linkBusy,setLinkBusy]=useState(false);
 const linkSaving=useRef(false);
 const [edgeSelection,setEdgeSelection]=useState('');
 const [groupMode,setGroupMode]=useState(false),[group,setGroup]=useState<string[]>([]),[marquee,setMarquee]=useState<{start:Point;end:Point}|null>(null);
 const [selection,setSelection]=useState(''),[help,setHelp]=useState(false),[quick,setQuick]=useState<Point|null>(null),[quickTitle,setQuickTitle]=useState(''),[quickBusy,setQuickBusy]=useState(false);
 const quickSaving=useRef(false);
 async function saveQuick(e:React.FormEvent){e.preventDefault();if(quickSaving.current||!quick)return;quickSaving.current=true;setQuickBusy(true);try{await onQuickCreate(quickTitle.trim()||'רעיון פתוח',quick);setQuick(null);setQuickTitle('');}catch{setError('לא הצלחנו לשמור. אפשר לנסות שוב.');}finally{quickSaving.current=false;setQuickBusy(false);}}
 const storageKey=`thinking-graph:layout:${workspaceId}`;
 const [saved,setSaved]=useState<Record<string,Point>>(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{return {};}});
 const [pan,setPan]=useState<Point>({x:0,y:0}),[zoom,setZoom]=useState(1),[source,setSource]=useState(''),[tip,setTip]=useState<Point|null>(null),[target,setTarget]=useState(''),[error,setError]=useState('');
 const svg=useRef<SVGSVGElement>(null),world=useRef<SVGGElement>(null),gesture=useRef<Gesture|null>(null);
 const [size,setSize]=useState({width:400,height:600});
 const view=useRef({pan,zoom});view.current={pan,zoom};
 useEffect(()=>{
  const canvas=svg.current!;
  function wheel(e:WheelEvent){
   if(!e.deltaY)return;
   e.preventDefault();
   if(gesture.current)return;
   const matrix=canvas.getScreenCTM();if(!matrix)return;
   const cursor=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
   const current=view.current;
   const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
   const nextZoom=Math.max(.1,Math.min(2,current.zoom*Math.exp(-Math.max(-300,Math.min(300,delta))*.002)));
   const ratio=nextZoom/current.zoom;
   const nextPan={x:cursor.x-(cursor.x-current.pan.x)*ratio,y:cursor.y-(cursor.y-current.pan.y)*ratio};
   view.current={pan:nextPan,zoom:nextZoom};setPan(nextPan);setZoom(nextZoom);
  }
  canvas.addEventListener('wheel',wheel,{passive:false});
  return()=>canvas.removeEventListener('wheel',wheel);
 },[]);
 useEffect(()=>{const observer=new ResizeObserver(entries=>{const box=entries[0].contentRect;setSize({width:Math.max(240,box.width),height:Math.max(200,box.height)});});observer.observe(svg.current!);return()=>observer.disconnect();},[]);
 const latestSaved=useRef(saved);latestSaved.current=saved;
 function storePositions(next:Record<string,Point>){latestSaved.current=next;setSaved(next);try{localStorage.setItem(storageKey,JSON.stringify(next));setError('');}catch{setError('המיקום השתנה, אך לא נשמר בדפדפן.');}}
 useEffect(()=>{if(pendingLink)svg.current?.focus({preventScroll:true});},[pendingLink]);
 function stageLink(ids:string[]){if(linkSaving.current)return;cancel();setError('');setPendingLink(ids);void saveLink(ids);}
 async function saveLink(ids=pendingLink){if(!ids||linkSaving.current)return;linkSaving.current=true;setLinkBusy(true);try{await onConnect(ids);setPendingLink(null);setError('');}catch(e){setError(e instanceof Error?e.message:'שמירת הקשר נכשלה. אפשר לנסות שוב.');}finally{linkSaving.current=false;setLinkBusy(false);}}
 const createPoint=useRef<Point>({x:40,y:40});
 useEffect(()=>{if(!placement||placement.workspaceId!==workspaceId)return;
  setSaved(old=>{const next={...old,[placement.id]:placement.point};try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{setError('הרעיון נשמר, אך מיקומו לא נשמר בדפדפן.');}return next;});
  onPlaced();
 },[placement,workspaceId,storageKey]);
 const positions:Record<string,Point>={};
 const columns=Math.max(1,Math.floor((size.width-40)/240));
 ideas.forEach((i,n)=>{const p=saved[i.id];positions[i.id]=p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?p:{x:40+(n%columns)*240,y:40+Math.floor(n/columns)*170};});
 const [textMeasure]=useState(()=>{const ctx=document.createElement('canvas').getContext('2d')!;ctx.font='15px Arial';return (text:string)=>ctx.measureText(text).width;});
 const shapes:Record<string,{scale:number;height:number;lines:string[]}>= {};
 ideas.forEach(i=>{const lines=titleLines(i.title,textMeasure,156);shapes[i.id]={scale:Math.max(.6,Math.min(3,positions[i.id].scale||1)),height:Math.max(60,lines.length*22+24),lines};});
 function ideaCenter(id:string){const p=positions[id],shape=shapes[id];return {x:p.x+92*shape.scale,y:p.y+(20+shape.height/2)*shape.scale};}
 function changeSize(id:string,factor:number){const p=positions[id];storePositions({...latestSaved.current,[id]:{...p,scale:Math.max(.6,Math.min(3,shapes[id].scale*factor))}});}
 const edgeCenters:Record<string,Point>={};
 edges.forEach((c,n)=>{const pts=c.ps.filter((p:any)=>positions[p.idea_id]).map((p:any)=>ideaCenter(p.idea_id)) as Point[];if(!pts.length)return;const stored=saved['edge:'+c.id];edgeCenters[c.id]=stored&&Number.isFinite(stored.x)&&Number.isFinite(stored.y)?stored:{x:pts.reduce((v,p)=>v+p.x,0)/pts.length,y:pts.reduce((v,p)=>v+p.y,0)/pts.length+(n%3)*28};});
 async function removeEdge(id:string){try{await onDelete(id);setEdgeSelection('');setError('');}catch(e){setError(e instanceof Error?e.message:'מחיקת הקשר נכשלה');}}
 function point(e:{clientX:number;clientY:number},space:'world'|'screen'='world'){const matrix=(space==='world'?world.current:svg.current)!.getScreenCTM()!;return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());}
 function hit(p:Point,except:string){return [...ideas].reverse().find(i=>i.id!==except&&p.x>=positions[i.id].x-12&&p.x<=positions[i.id].x+184*shapes[i.id].scale+12&&p.y>=positions[i.id].y+20*shapes[i.id].scale-12&&p.y<=positions[i.id].y+(20+shapes[i.id].height)*shapes[i.id].scale+12)?.id||'';}
 function begin(e:PointerEvent,kind:Gesture['kind'],id=''){
   if(e.button!==0||gesture.current||busy||quick||pendingLink)return;e.stopPropagation();
   if(kind==='pan'&&groupMode)kind='select';
   if(kind==='move'&&!groupMode&&(e.shiftKey||source))kind='link';
   const key=kind==='edge'?'edge:'+id:id;
   const members=(kind==='move'||kind==='edge')?(groupMode?connectedGroup([...group,key],ideas,edges):group.includes(key)?group:[]):[];
   if(members.length)setGroup(members);else if(kind==='move'||kind==='edge')setGroup([]);
   const originals:Record<string,Point>={};
   for(const member of members){const origin=member.startsWith('edge:')?edgeCenters[member.slice(5)]:positions[member];if(origin)originals[member]={...origin};}

   if(kind==='edge'){setEdgeSelection(id);setSelection('');}else if(id){setSelection(id);setEdgeSelection('');}
   const p=point(e,kind==='pan'?'screen':'world');
   gesture.current={kind,id,start:p,original:kind==='pan'?pan:kind==='edge'?edgeCenters[id]:positions[id]||p,moved:false,pointer:e.pointerId,group:originals};
   if(kind==='select'){setGroup([]);setSelection('');setEdgeSelection('');setMarquee({start:p,end:p});}
   e.currentTarget.setPointerCapture(e.pointerId);
   if(kind==='link'){if(source&&source!==id){setSource('');setTip(null);gesture.current=null;stageLink([source,id]);return;}setSource(id);setTip(p);}
 }
 function move(e:PointerEvent){
   const g=gesture.current;
   if(!g){if(source){const p=point(e);setTip(p);setTarget(hit(p,source));}return;}
   if(g.pointer!==e.pointerId)return;
   const p=point(e,g.kind==='pan'?'screen':'world'),dx=p.x-g.start.x,dy=p.y-g.start.y;
   if(Math.hypot(dx,dy)>4)g.moved=true;
   if(g.kind==='pan')setPan({x:g.original.x+dx,y:g.original.y+dy});
   if(g.kind==='select')setMarquee({start:g.start,end:p});
   if(g.kind==='move'||g.kind==='edge'){
    const originals=g.group&&Object.keys(g.group).length?g.group:{[g.kind==='edge'?'edge:'+g.id:g.id]:g.original};
    const next={...latestSaved.current};for(const [id,origin] of Object.entries(originals))next[id]={...origin,x:origin.x+dx,y:origin.y+dy};
    latestSaved.current=next;setSaved(next);
   }
   if(g.kind==='link'){setTip(p);setTarget(hit(p,g.id));}
 }
 function cancel(){gesture.current=null;setMarquee(null);setSource('');setTip(null);setTarget('');}
 function finish(e:PointerEvent){
   const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;gesture.current=null;
   if(g.kind==='select'){
    const end=point(e),left=Math.min(g.start.x,end.x),right=Math.max(g.start.x,end.x),top=Math.min(g.start.y,end.y),bottom=Math.max(g.start.y,end.y);
    const seeds=ideas.filter(i=>{const c=ideaCenter(i.id);return c.x>=left&&c.x<=right&&c.y>=top&&c.y<=bottom;}).map(i=>i.id);
    for(const [id,c] of Object.entries(edgeCenters))if(c.x>=left&&c.x<=right&&c.y>=top&&c.y<=bottom)seeds.push('edge:'+id);
    setGroup(connectedGroup(seeds,ideas,edges));setMarquee(null);
   }
   if(g.kind==='edge'){if(g.moved)storePositions(latestSaved.current);else setEdgeSelection(g.id);}
   if(g.kind==='move'){
     if(g.moved){storePositions(latestSaved.current);}
     else if(source&&source!==g.id){stageLink([source,g.id]);}else setSelection(g.id);
   }
   if(g.kind==='link'&&g.moved){const end=hit(point(e),g.id);if(end)stageLink([g.id,end]);else cancel();}
   if(g.kind==='pan'&&!g.moved){setGroup([]);cancel();setSelection('');setEdgeSelection('');}
 }
 function fitMap(){
  const pts=[...ideas.flatMap(i=>[positions[i.id],{x:positions[i.id].x+184*shapes[i.id].scale,y:positions[i.id].y+(20+shapes[i.id].height)*shapes[i.id].scale}]),...Object.values(edgeCenters)];if(!pts.length){setPan({x:0,y:0});setZoom(1);cancel();return;}
  const left=Math.min(...pts.map(p=>p.x)),right=Math.max(...pts.map(p=>p.x))+196;
  const top=Math.min(...pts.map(p=>p.y)),bottom=Math.max(...pts.map(p=>p.y))+136;
  const scale=Math.max(.1,Math.min(1.4,(size.width-60)/(right-left),(size.height-160)/(bottom-top)));
  setZoom(scale);setPan({x:(size.width-(right-left)*scale)/2-left*scale,y:80+(size.height-160-(bottom-top)*scale)/2-top*scale});cancel();
 }
 function keyboardLink(id:string){if(busy||pendingLink)return;if(source&&source!==id){stageLink([source,id]);cancel();}else{setSource(id);setTip(ideaCenter(id));svg.current?.focus({preventScroll:true});}}
 function mapKey(e:React.KeyboardEvent){
  const element=e.target as Element;
  if(element.closest('input,textarea,select,[contenteditable=true],[role=dialog],[role=menu]')||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){e.preventDefault();setGroup([]);setGroupMode(false);cancel();setSelection('');setEdgeSelection('');svg.current?.focus({preventScroll:true});if(!linkSaving.current)setPendingLink(null);if(!quickSaving.current)setQuick(null);return;}
  if(pendingLink&&e.key==='Enter'){e.preventDefault();if(!e.repeat)void saveLink();return;}
  if(busy||quick||pendingLink||element.closest('button'))return;
  const step=e.shiftKey?40:10;
  const directions:Record<string,Point>={[shortcuts.up]:{x:0,y:-step},[shortcuts.down]:{x:0,y:step},[shortcuts.left]:{x:-step,y:0},[shortcuts.right]:{x:step,y:0}};
  if(directions[e.code]){e.preventDefault();const d=directions[e.code];const focused=element.closest('[data-idea-id]')?.getAttribute('data-idea-id');const id=focused||selection;const eid=element.closest('[data-connection-id]')?.getAttribute('data-connection-id')||edgeSelection;
   if(group.length){const next={...latestSaved.current};for(const key of group){const p=key.startsWith('edge:')?edgeCenters[key.slice(5)]:positions[key];if(p)next[key]={...p,x:p.x+d.x,y:p.y+d.y};}storePositions(next);return;}
   if(eid&&edgeCenters[eid]){setEdgeSelection(eid);storePositions({...latestSaved.current,['edge:'+eid]:{x:edgeCenters[eid].x+d.x,y:edgeCenters[eid].y+d.y}});return;}
   if(id&&positions[id]){setSelection(id);storePositions({...latestSaved.current,[id]:{...positions[id],x:positions[id].x+d.x,y:positions[id].y+d.y}});}else setPan(p=>({x:p.x+d.x,y:p.y+d.y}));return;}
  if(e.code===shortcuts.connect&&selection){e.preventDefault();keyboardLink(selection);}
  if(e.code===shortcuts.edit&&(selection||edgeSelection)){e.preventDefault();if(edgeSelection)onConnection(edgeSelection);else onInspect(selection);}
  if(e.code===shortcuts.fit){e.preventDefault();fitMap();}
  if(e.code===shortcuts.idea||e.code===shortcuts.question){e.preventDefault();const p=point({clientX:svg.current!.getBoundingClientRect().left+size.width/2,clientY:svg.current!.getBoundingClientRect().top+size.height/2});onCreate(e.code===shortcuts.idea?'idea':'question',p);}
 }
 return <div className="interactive-map" onKeyDown={mapKey}><div className="map-controls"><button className="secondary" aria-pressed={groupMode} onClick={()=>{cancel();setGroupMode(v=>!v);setGroup([]);}}>בחירת קבוצה</button>{group.length>0&&<><span className="map-group-status">{group.length} פריטים מחוברים</span><button className="secondary" onClick={()=>{setGroup([]);setGroupMode(false);}}>ביטול בחירה</button></>}<button className="secondary" aria-label="קיצורי מקלדת" onClick={()=>setShortcutsOpen(true)}>⌨</button><button className="secondary" onClick={()=>setZoom(z=>Math.min(2,z+.2))} aria-label="הגדלת המפה">＋</button><button className="secondary" onClick={()=>setZoom(z=>Math.max(.3,z-.2))} aria-label="הקטנת המפה">−</button><button className="secondary" onClick={fitMap}>מרכוז התצוגה</button>{source&&<button className="secondary" onClick={cancel}>ביטול חיבור</button>}</div>
 <button className="map-help-toggle secondary" aria-label="עזרה במפה" aria-expanded={help} onClick={()=>setHelp(v=>!v)}>?</button>{(help||error||source)&&<p className="map-help" role="status">{error|| (source?'לחצי או שחררי על כל שטח הרעיון השני. הקשר יישמר אוטומטית כ־?. Escape לביטול לפני בחירת יעד.':`בחירת קבוצה: גררי מסגרת סביב פריטים ואז גררי אחד מהם; המחוברים יזוזו יחד. לחיצה כפולה לעריכה. גררי רעיון לסידור. Shift וגרירה מהבועה מחברים; אפשר גם לבחור וללחוץ ${keyLabel(shortcuts.connect)}. חצים להזזה, Shift לתנועה גדולה. ⌨ להתאמת קיצורים.`)}</p>}
 {shortcutsOpen&&<MapShortcuts value={shortcuts} onSave={setShortcuts} onClose={()=>setShortcutsOpen(false)}/>}
 {pendingLink&&<div className="pending-link-actions" role="status"><span>{linkBusy?'שומרת קשר…':'הקשר לא נשמר'}</span><button className="primary" disabled={linkBusy||busy} onClick={()=>void saveLink()}>ניסיון נוסף</button><button className="secondary" disabled={linkBusy} onClick={()=>{setPendingLink(null);setError('');}}>ביטול</button><small>הקשר נשמר אוטומטית · אפשר לערוך בלחיצה ימנית</small></div>}
 {!ideas.length&&!quick&&<div className="spatial-invite">מקום למחשבה הבאה שלך<small>לחצי פעמיים על הרקע כדי להתחיל</small></div>}
 {quick&&<form className="map-quick-create" style={{left:Math.max(10,Math.min(size.width-240,quick.x*zoom+pan.x)),top:Math.max(70,Math.min(size.height-140,quick.y*zoom+pan.y))}} onSubmit={saveQuick}><label>מחשבה חדשה<input autoFocus value={quickTitle} maxLength={170} disabled={quickBusy} onChange={e=>setQuickTitle(e.target.value)} placeholder="אפשר גם להשאיר בלי שם"/></label><div className="row"><button className="primary" disabled={quickBusy}>הוספה</button><button className="secondary" type="button" disabled={quickBusy} onClick={()=>setQuick(null)}>ביטול</button></div></form>}
 <ContextMenu.Root dir="rtl"><ContextMenu.Trigger asChild disabled={busy} onContextMenu={e=>{
 if((e.target as Element).closest('[data-idea-id],.map-edge')){e.preventDefault();return;}
 cancel();createPoint.current=point(e);
 }}><svg ref={svg} tabIndex={0} className="map-canvas" viewBox={`0 0 ${size.width} ${size.height}`} aria-label="מפת רעיונות אינטראקטיבית" onPointerDown={e=>begin(e,'pan')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onDoubleClick={e=>{if(busy||groupMode||(e.target as Element).closest('[data-idea-id],.map-edge'))return;if(pendingLink)return;cancel();setSelection('');setQuickTitle('');setQuick(point(e));}}>
 <g ref={world} transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
 {edges.map(c=>{const pts=c.ps.filter((p:any)=>positions[p.idea_id]).map((p:any)=>ideaCenter(p.idea_id)) as Point[];if(pts.length<2)return null;const center=edgeCenters[c.id];return <ContextMenu.Root key={c.id} dir="rtl"><ContextMenu.Trigger asChild disabled={busy} onContextMenu={e=>{e.stopPropagation();setSelection('');setEdgeSelection(c.id);}}><g className={`map-edge ${edgeSelection===c.id?'edge-selected':''} ${group.includes('edge:'+c.id)?'group-selected':''}`} data-connection-id={c.id} role="button" tabIndex={0} aria-label={`קשר: ${c.label}`} onPointerDown={e=>begin(e,'edge',c.id)} onDoubleClick={e=>{e.stopPropagation();onConnection(c.id);}} onKeyDown={e=>{if(e.key==='Enter'&&!pendingLink){e.preventDefault();e.stopPropagation();onConnection(c.id);}}}>
 {pts.map((p,i)=><path key={i} d={`M${p.x},${p.y} Q${p.x},${center.y} ${center.x},${center.y}`} fill="none" stroke="var(--primary)" strokeWidth="2"/>)}<rect x={center.x-(c.label==='?'?18:58)} y={center.y-15} width={c.label==='?'?36:116} height="30" rx="5"/><text x={center.x} y={center.y+5} textAnchor="middle">{c.label.slice(0,17)}</text><title>{c.label} · גררי להזזה, לחיצה ימנית לעריכה ומחיקה</title>
 {edgeSelection===c.id&&<foreignObject x={center.x-80} y={center.y+22} width={160} height={46}><div className="node-actions" onPointerDown={e=>e.stopPropagation()}><button disabled={busy} onClick={()=>onConnection(c.id)}>עריכה</button><button disabled={busy} onClick={()=>void removeEdge(c.id)}>מחיקה</button></div></foreignObject>}
 </g></ContextMenu.Trigger><ContextMenu.Portal><ContextMenu.Content onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="map-context-menu" collisionPadding={10} onCloseAutoFocus={e=>e.preventDefault()}><ContextMenu.Item disabled={busy} onSelect={()=>onConnection(c.id)}>עריכת הקשר</ContextMenu.Item><ContextMenu.Item disabled={busy} onSelect={()=>void removeEdge(c.id)}>מחיקת הקשר</ContextMenu.Item></ContextMenu.Content></ContextMenu.Portal></ContextMenu.Root>;})}
 {source&&tip&&positions[source]&&<line className="connection-preview" x1={ideaCenter(source).x} y1={ideaCenter(source).y} x2={target?ideaCenter(target).x:tip.x} y2={target?ideaCenter(target).y:tip.y} stroke="var(--primary)" strokeWidth="3" strokeDasharray="7 5" opacity=".45" pointerEvents="none"/>}
 {pendingLink&&pendingLink.every(id=>positions[id])&&<g className="pending-link" pointerEvents="none"><line x1={ideaCenter(pendingLink[0]).x} y1={ideaCenter(pendingLink[0]).y} x2={ideaCenter(pendingLink[1]).x} y2={ideaCenter(pendingLink[1]).y}/><text x={(positions[pendingLink[0]].x+positions[pendingLink[1]].x)/2+92} y={(positions[pendingLink[0]].y+positions[pendingLink[1]].y)/2+44} textAnchor="middle">?</text></g>}
 {ideas.map(i=>{const p=positions[i.id],shape=shapes[i.id];return <g key={i.id} transform={`translate(${p.x} ${p.y}) scale(${shape.scale})`} data-idea-id={i.id} className={`map-node ${target===i.id?'link-target':''} ${selection===i.id||group.includes(i.id)?'is-selected':''} ${source?'is-connecting':''}`}>
 <g role="button" tabIndex={0} aria-label={`רעיון: ${i.title}`} onDoubleClick={e=>{e.stopPropagation();cancel();onInspect(i.id);}} onPointerDown={e=>begin(e,'move',i.id)} onKeyDown={e=>{if(e.key==='Enter'){if(pendingLink)return;e.preventDefault();e.stopPropagation();if(source)keyboardLink(i.id);else setSelection(i.id);}}}>
 <rect x="0" y="20" width="184" height={shape.height} rx="22" strokeDasharray={i.status==='proposed'?'5 3':undefined}/>{i.status==='proposed'&&<text x="168" y="12" textAnchor="end" className="node-status">הצעה לבדיקה</text>}<text x="92" y="47" textAnchor="middle" className="node-title">{shape.lines.map((line,n)=><tspan key={n} x="92" dy={n?22:0}>{line}</tspan>)}</text><title>{i.title}</title></g>
 <circle role="button" tabIndex={0} aria-label={`חיבור מ־${i.title}`} className="connection-handle" cx="184" cy={20+shape.height/2} r="12" onPointerDown={e=>begin(e,'link',i.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){if(pendingLink)return;e.preventDefault();e.stopPropagation();keyboardLink(i.id);}}}/>{selection===i.id&&<foreignObject x={-20} y={shape.height+28} width={224} height={90}><div className="node-actions" onPointerDown={e=>e.stopPropagation()}><button aria-label={`הגדלת רעיון: ${i.title}`} onClick={()=>changeSize(i.id,1.2)}>＋</button><button aria-label={`הקטנת רעיון: ${i.title}`} onClick={()=>changeSize(i.id,1/1.2)}>−</button><button disabled={busy} onClick={()=>onInspect(i.id)}>עריכה ומקורות</button><button disabled={busy} onClick={()=>keyboardLink(i.id)}>חיבור</button></div></foreignObject>}</g>;})}
 {marquee&&<rect className="map-selection-box" x={Math.min(marquee.start.x,marquee.end.x)} y={Math.min(marquee.start.y,marquee.end.y)} width={Math.abs(marquee.end.x-marquee.start.x)} height={Math.abs(marquee.end.y-marquee.start.y)}/>}
 </g></svg></ContextMenu.Trigger><ContextMenu.Portal><ContextMenu.Content onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="map-context-menu" collisionPadding={10} onCloseAutoFocus={e=>e.preventDefault()}>
 <ContextMenu.Label className="map-context-label">הוספה למפה</ContextMenu.Label>
 <ContextMenu.Item disabled={busy} onSelect={()=>onCreate('idea',createPoint.current)}>＋ רעיון חדש</ContextMenu.Item>
 <ContextMenu.Item disabled={busy} onSelect={()=>onCreate('question',createPoint.current)}>＋ שאלה חדשה</ContextMenu.Item>
 </ContextMenu.Content></ContextMenu.Portal></ContextMenu.Root></div>;
}
