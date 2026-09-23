import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
mkdirSync(new URL('.sites-runtime/',root),{recursive:true}); const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync(new URL('drizzle/',root)).filter(x=>x.endsWith('.sql')).sort()) db.exec(readFileSync(new URL('drizzle/'+file,root),'utf8'));
const prepare=(sql)=>({bind(...values){return statement(sql,values)}});
function statement(sql,values=[]){return {sql,values,first(){return db.prepare(sql).get(...values)||null},all(){return {results:db.prepare(sql).all(...values)}}}}
globalThis.testDb={prepare(sql){return {...statement(sql),...prepare(sql)}},batch(statements){db.exec('BEGIN');try{const out=statements.map(s=>{const st=db.prepare(s.sql);return st.columns().length?{results:st.all(...s.values)}:{results:[],...st.run(...s.values)}});db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.testUser={userId:'u1',displayName:'Tester'};
let source=readFileSync(new URL('app/api/graph/route.ts',root),'utf8');
source=source.replace(/import \{ getChatGPTUser \}[^;]+;/,"const getChatGPTUser=async()=>globalThis.testUser;").replace(/import \{ database \}[^;]+;/,'const database=()=>globalThis.testDb;').replace(/import \{ candidates, normalize, validText \}[^;]+;/,readFileSync(new URL('lib/domain.ts',root),'utf8').replaceAll('export ',''));
writeFileSync(new URL('.sites-runtime/test-route.mjs',root),ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}));
const {POST,GET}=await import(new URL('.sites-runtime/test-route.mjs',root).href);
async function post(body,status=200){const r=await POST(new Request('https://test.local/api/graph',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://test.local'},body:JSON.stringify(body)}));const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b}
const w=await post({action:'workspace',title:'W1'}),c=await post({action:'conversation',title:'C1'});
const m=await post({action:'message',workspaceId:w.id,conversationId:c.id,content:'[[Field]] and [[Force]]'});
let graph=await (await GET()).json();assert.equal(graph.ideas.length,2);assert.equal(graph.message_ideas.length,2);
const idea=graph.ideas[0];assert.equal(idea.created_by,'system:rules');
await post({action:'idea',id:idea.id,title:idea.title,summary:'Edited summary',status:'accepted'});
const c2=await post({action:'conversation',title:'C2'}),w2=await post({action:'workspace',title:'W2'});
await post({action:'message',workspaceId:w2.id,conversationId:c2.id,content:'[[FIELD]]'});
graph=await (await GET()).json();assert.equal(graph.ideas.length,2);assert.equal(graph.message_ideas.filter(l=>l.idea_id===idea.id).length,2);
assert.equal(graph.workspace_ideas.filter(l=>l.idea_id===idea.id).length,2);
globalThis.testUser={userId:'u2',displayName:'Collaborator'};
await post({action:'link',workspaceId:w2.id,ideaId:graph.ideas[1].id,messageId:m.id});
const conn=await post({action:'connection',label:'analogy',ideaIds:graph.ideas.map(i=>i.id)});
assert.equal(db.prepare('SELECT count(*) n FROM connection_participants WHERE connection_id=?').get(conn.id).n,2);
await post({action:'connection',label:'invalid',ideaIds:[idea.id,idea.id]},400);
const before=db.prepare('SELECT count(*) n FROM messages').get().n;
await post({action:'message',workspaceId:w.id,conversationId:'missing',content:'Hello'},400);
assert.equal(db.prepare('SELECT count(*) n FROM messages').get().n,before);
const ev=db.prepare("SELECT * FROM events WHERE action='revise'").get();assert.equal(JSON.parse(ev.before).summary,idea.title);assert.equal(JSON.parse(ev.after).summary,'Edited summary');
const badOrigin=await POST(new Request('https://test.local/api/graph',{method:'POST',headers:{origin:'https://other.local'},body:'{}'}));assert.equal(badOrigin.status,403);
globalThis.testUser=null;assert.equal((await GET()).status,401);await post({action:'workspace',title:'No'},401);
console.log('PASS: persistence, exact-title reuse across conversations, shared workspaces, multi-actor provenance, connections, edit history, validation, rollback, auth and origin checks.');


