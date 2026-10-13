// The Explanation screen: concepts raised by the external advisor in this conversation.
// It is separate from My Map on purpose: nothing here is saved to the map or extracted.
export default function ExplanationPanel({graph,conversationId,onClose}:{graph:any;conversationId:string;onClose:()=>void}){
 const items=(graph.chat_replies||[]).filter((r:any)=>r.conversation_id===conversationId&&r.mode==='external'&&r.concept)
  .map((r:any)=>({reply:r,concept:JSON.parse(r.concept),question:graph.messages.find((m:any)=>m.id===r.message_id)?.content||''}));
 return <aside className="explanation-panel" dir="rtl" aria-label="מרחב ההסבר">
  <div className="explanation-head"><strong>מרחב ההסבר</strong><button className="secondary" onClick={onClose}>סגירה</button></div>
  <p className="muted">מושגים שהיועץ החיצוני העלה בשיחה הזו. המרחב נפרד מהמפה שלך: שום דבר כאן לא נשמר בה ולא מחולץ ממנו.</p>
  {!items.length&&<p>עדיין אין כאן מושגים. בחרי „יועץ חיצוני” מתחת להודעה.</p>}
  <div className="explanation-concepts">{items.slice().reverse().map(({reply,concept,question}:any)=><article key={reply.id} className="explanation-concept">
   <strong>{concept.title}</strong>{concept.detail&&<p>{concept.detail}</p>}
   <details><summary>מתוך התשובה</summary><p>{reply.content}</p><small>בעקבות: {question.slice(0,140)}</small></details>
  </article>)}</div>
 </aside>;
}
