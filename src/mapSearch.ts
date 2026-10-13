// Plain-text search over the user's ideas (instant, no model). Hebrew-aware enough for a
// first pass: ignores niqqud, punctuation, common one-letter prefixes and filler words.
const FILLER=new Set(['של','את','על','עם','מה','איך','איפה','איזה','איזו','הוא','היא','זה','זאת','אני','יש','לא','כן','גם','או','אם','כי','רעיון','רעיונות','הרעיון','מחפשת','מחפש','חיפוש','למצוא','תמצא','תמצאי','במפה','מפה','שלי','לגבי','כתבתי','the','and','for','with','idea','ideas','find','where','about']);
const PREFIXES='הובלמשכ';

export function normalize(text:string){
 return text.toLowerCase().replace(/[֑-ׇ]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

function terms(query:string){
 const words=normalize(query).split(' ').filter(w=>w.length>=2&&!FILLER.has(w));
 // Each term may also match without one leading Hebrew prefix letter (ה/ו/ב/ל/מ/ש/כ).
 return [...new Set(words)].map(w=>w.length>=4&&PREFIXES.includes(w[0])?[w,w.slice(1)]:[w]);
}

export type IdeaHit={id:string;title:string;score:number;workspaceIds:string[]};

export function searchIdeas(query:string,ideas:{id:string;title:string;summary?:string;status?:string}[],workspaceIdeas:{workspace_id:string;idea_id:string}[]):IdeaHit[]{
 const wanted=terms(query);
 if(!wanted.length)return [];
 const hits:IdeaHit[]=[];
 for(const idea of ideas){
  if(idea.status==='rejected')continue;
  const title=normalize(idea.title),summary=normalize(idea.summary||'');
  let score=0;
  for(const variants of wanted){
   if(variants.some(v=>title.includes(v)))score+=2;
   else if(variants.some(v=>summary.includes(v)))score+=1;
  }
  if(score)hits.push({id:idea.id,title:idea.title,score,workspaceIds:workspaceIdeas.filter(w=>w.idea_id===idea.id).map(w=>w.workspace_id)});
 }
 return hits.sort((a,b)=>b.score-a.score).slice(0,5);
}
