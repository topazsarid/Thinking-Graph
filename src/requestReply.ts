// Asks the local model for a chat reply. Like extraction, a lost response is recovered by
// the request ID instead of starting a second generation. A cancelled request (HTTP 410)
// rejects with an error named 'Cancelled' so the UI can stay quiet about it.
export type ReplyMode='self'|'external'|'search';

export function cancelledError(message:string){const error=Error(message);error.name='Cancelled';return error;}

export async function requestReply(body:{requestId:string;messageId:string;workspaceId?:string;mode:ReplyMode},fetcher:typeof fetch=fetch,pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 try{
  const response=await fetcher('/api/replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(response.status===410)throw cancelledError(result.error||'הבקשה בוטלה.');
  if(!response.ok)throw Error(result.error||'התשובה נכשלה');
  return result;
 }catch(error){
  if(!(error instanceof TypeError))throw error;
  for(let attempt=0;attempt<90;attempt++){
   try{const response=await fetcher('/api/graph');if(response.ok){const graph=await response.json();const reply=graph.chat_replies?.find((r:any)=>r.id===body.requestId);if(reply)return reply;}}catch{}
   await pause(2000);
  }
  throw Error('לא התקבלה תשובה. אפשר לנסות שוב.');
 }
}
