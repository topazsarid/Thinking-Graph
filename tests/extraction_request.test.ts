import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestExtraction} from '../src/requestExtraction.ts';

test('lost generation response is recovered without starting another generation',async()=>{
 const calls:string[]=[];let reads=0;
 const request={requestId:'run',messageId:'message',workspaceId:'workspace'};
 const fetcher=(async(url:any)=>{calls.push(String(url));if(url==='/api/extractions')throw new TypeError('network');reads++;return new Response(JSON.stringify({extraction_runs:reads===1?[]:[{id:'other'},{id:'run',status:'pending'}]}));}) as typeof fetch;
 assert.equal((await requestExtraction(request,fetcher,async()=>{})).id,'run');
 assert.deepEqual(calls,['/api/extractions','/api/graph','/api/graph']);
});
test('model validation failures surface immediately instead of polling',async()=>{
 let count=0;
 const fetcher=(async()=>{count++;return new Response(JSON.stringify({error:'invalid quote'}),{status:422});}) as typeof fetch;
 await assert.rejects(requestExtraction({requestId:'r',messageId:'m',workspaceId:'w'},fetcher,async()=>{}),/invalid quote/);
 assert.equal(count,1);
});
