// If a long local-model request loses its response, recover the saved run by ID.
// Never resubmit the generation request while it may still be running.
export async function requestExtraction(body:{requestId:string;messageId:string;workspaceId:string},fetcher:typeof fetch=fetch,pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 try{
  const response=await fetcher('/api/extractions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'החילוץ נכשל');
  return result;
 }catch(error){
  if(!(error instanceof TypeError))throw error;
  for(let attempt=0;attempt<90;attempt++){
   try{const response=await fetcher('/api/graph');if(response.ok){const graph=await response.json();const run=graph.extraction_runs?.find((r:any)=>r.id===body.requestId);if(run)return run;}}catch{}
   await pause(2000);
  }
  throw Error('לא התקבלה תשובת חילוץ. המקור נשמר; אפשר לבדוק בשיחת המקור אם הטיוטה הושלמה, או לנסות שוב.');
 }
}
