export function connectedGroup(seeds:string[],ideas:{id:string}[],edges:{id:string;ps:{idea_id:string}[]}[]){
 const available=new Set(ideas.map(i=>i.id));
 const nodes=new Set(seeds.filter(id=>available.has(id)));
 const links=new Set(seeds.filter(id=>id.startsWith('edge:')).map(id=>id.slice(5)));
 let changed=true;
 while(changed){changed=false;for(const edge of edges){
  const participants=edge.ps.map(p=>p.idea_id).filter(id=>available.has(id));
  if(!links.has(edge.id)&&!participants.some(id=>nodes.has(id)))continue;
  if(!links.has(edge.id)){links.add(edge.id);changed=true;}
  for(const id of participants)if(!nodes.has(id)){nodes.add(id);changed=true;}
 }}
 return [...nodes,...[...links].filter(id=>edges.some(e=>e.id===id)).map(id=>'edge:'+id)];
}

export function titleLines(title:string,measure:(text:string)=>number=text=>Array.from(text).length,limit=18){
 const lines:string[]=[];let line='';
 for(const word of title.split(/\s+/)){
  if(line&&measure(line+' '+word)>limit){lines.push(line);line='';}
  for(const char of Array.from(word)){
   if(line&&measure(line+char)>limit){lines.push(line);line='';}
   line+=char;
  }
  if(line)line+=' ';
 }
 if(line.trim())lines.push(line.trimEnd());return lines.length?lines.map(s=>s.trimEnd()):[''];
}
