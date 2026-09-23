import { getChatGPTUser } from '../../chatgpt-auth';
import { database } from '@/db/raw';
import { candidates, normalize, validText } from '@/lib/domain';
const tables=['users','conversations','messages','ideas','workspaces','workspace_ideas','message_ideas','connections','connection_participants','events'];
export async function GET() {
  if(!await getChatGPTUser()) return Response.json({error:'יש להתחבר כדי לפתוח את הגרף'}, {status:401});
  try { const db=database(); const rows=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM ${t}`))); return Response.json(Object.fromEntries(tables.map((t,i)=>[t,rows[i].results])),{headers:{'Cache-Control':'no-store'}}); }
  catch(e) { console.error(e); return Response.json({error:'לא ניתן לטעון את הגרף כרגע. אפשר לנסות שוב.'},{status:503}); }
}
export async function POST(request:Request) {
  const user=await getChatGPTUser(); if(!user) return Response.json({error:'נדרשת התחברות'}, {status:401});
  if(request.headers.get('origin') && new URL(request.url).origin!==request.headers.get('origin')) return Response.json({error:'Invalid origin'},{status:403});
  try {
    const b:any=await request.json(); const db=database(); const now=new Date().toISOString(); const uid=user.userId; const id=crypto.randomUUID();
    const q=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
    const batch:any[]=[q('INSERT INTO users(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',uid,user.displayName),q('INSERT OR IGNORE INTO users(id,name) VALUES(?,?)','system:rules','הצעה אוטומטית · כללים פשוטים')];
    const exists=async(table:string,key:string,value:string)=>{ if(!await q(`SELECT 1 FROM ${table} WHERE ${key}=?`,value).first()) throw new Error('הפריט כבר אינו זמין'); };
    const event=(entity:string,type:string,action:string,before:any,after:any,actor=uid)=>batch.push(q('INSERT INTO events VALUES(?,?,?,?,?,?,?,?)',crypto.randomUUID(),entity,type,action,before?JSON.stringify(before):null,JSON.stringify(after),actor,now));
    if(b.action==='conversation' || b.action==='workspace') {
      const title=validText(b.title); const table=b.action==='conversation'?'conversations':'workspaces';
      batch.push(q(`INSERT INTO ${table} VALUES(?,?,?,?)`,id,title,uid,now)); event(id,b.action,'create',null,{title});
    } else if(b.action==='message') {
      const content=validText(b.content,12000); await exists('conversations','id',b.conversationId); await exists('workspaces','id',b.workspaceId);
      batch.push(q('INSERT INTO messages VALUES(?,?,?,?,?)',id,b.conversationId,content,uid,now)); event(id,'message','create',null,{content});
      const all=(await q("SELECT * FROM ideas WHERE status!='rejected'").all()).results as any[];
      for(const title of candidates(content)) {
        const match=all.find(i=>normalize(i.title)===normalize(title)); const ideaId=match?.id??crypto.randomUUID();
        if(!match) batch.push(q('INSERT INTO ideas VALUES(?,?,?,?,?,?)',ideaId,title,title,'proposed','system:rules',now));
        batch.push(q('INSERT OR IGNORE INTO message_ideas VALUES(?,?,?,?,?)',id,ideaId,match?'exact-title':'rule-extraction','system:rules',now));
        batch.push(q('INSERT OR IGNORE INTO workspace_ideas VALUES(?,?,?,?)',b.workspaceId,ideaId,uid,now));
        event(ideaId,'idea',match?'link-source':'propose',null,{messageId:id,title,method:match?'exact-title':'rule-extraction'},'system:rules');
        if(!match) all.push({id:ideaId,title});
      }
    } else if(b.action==='idea') {
      const old=await q('SELECT * FROM ideas WHERE id=?',b.id).first<any>(); if(!old) throw new Error('רעיון לא נמצא');
      const title=validText(b.title); const summary=validText(b.summary,4000); if(!['proposed','accepted','rejected'].includes(b.status)) throw new Error('סטטוס לא תקין');
      batch.push(q('UPDATE ideas SET title=?,summary=?,status=? WHERE id=?',title,summary,b.status,b.id)); event(b.id,'idea','revise',old,{title,summary,status:b.status});
    } else if(b.action==='link') {
      await exists('ideas','id',b.ideaId); await exists('workspaces','id',b.workspaceId);
      if(b.messageId){ await exists('messages','id',b.messageId); batch.push(q('INSERT OR IGNORE INTO message_ideas VALUES(?,?,?,?,?)',b.messageId,b.ideaId,'manual',uid,now)); }
      batch.push(q('INSERT OR IGNORE INTO workspace_ideas VALUES(?,?,?,?)',b.workspaceId,b.ideaId,uid,now)); event(b.ideaId,'idea','manual-link',null,{messageId:b.messageId??null,workspaceId:b.workspaceId});
    } else if(b.action==='connection') {
      const label=validText(b.label); if(!Array.isArray(b.ideaIds)) throw new Error('יש לבחור רעיונות');
      const ids=[...new Set(b.ideaIds)] as string[]; if(ids.length<2||ids.length>12) throw new Error('בחרי בין 2 ל־12 רעיונות');
      for(const ideaId of ids) await exists('ideas','id',ideaId);
      batch.push(q('INSERT INTO connections VALUES(?,?,?,?)',id,label,uid,now));
      for(const ideaId of ids) batch.push(q('INSERT INTO connection_participants VALUES(?,?,?,?,?)',id,ideaId,'participant',uid,now));
      event(id,'connection','create',null,{label,participants:ids});
    } else throw new Error('פעולה לא מוכרת');
    await db.batch(batch); return Response.json({id});
  } catch(e) { console.error(e); return Response.json({error:e instanceof Error && !/SQL|D1|database/i.test(e.message)?e.message:'השמירה נכשלה. התוכן נשאר כאן; אפשר לנסות שוב.'},{status:400}); }
}

