import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeChatStream,visibleText} from '../agents/live-stream.mjs';
function event(object){return 'data: '+(typeof object==='string'?object:JSON.stringify(object))+'\n\n';}
function chunk(delta={},finish_reason=null,extra={}){return {model:'free-test:free',choices:[{index:0,delta,finish_reason}],...extra};}
function responseFromParts(parts,{status=200,contentType='text/event-stream'}={}){
 const encoder=new TextEncoder();
 let index=0;
 return new Response(new ReadableStream({pull(ctrl){if(index>=parts.length){ctrl.close();return;}ctrl.enqueue(encoder.encode(parts[index++]));}}),{status,headers:{'content-type':contentType}});
}
test('actual incremental SSE chunks arrive before the model finishes, including split UTF-8',async()=>{
 const raw=event(chunk({content:'Ha'}))+event(chunk({content:'llå'}))+event(chunk({},'stop',{usage:{prompt_tokens:2,completion_tokens:3}}))+event('[DONE]');
 const bytes=new TextEncoder().encode(raw);
 const sections=[bytes.slice(0,35),bytes.slice(35,67),bytes.slice(67,83),bytes.slice(83,101),bytes.slice(101)];
 let tokens='';
 const result=await consumeChatStream(new Response(new ReadableStream({start(c){for(const b of sections)c.enqueue(b);c.close();}}),{headers:{'content-type':'text/event-stream'}}),{onToken:token=>tokens+=token,requestedModel:'test:free'});
 assert.equal(tokens,'Hallå');assert.equal(result.choices[0].message.content,'Hallå');
 assert.equal(result.choices[0].finish_reason,'stop');assert.equal(result.usage.prompt_tokens,2);
});
test('hides think tags even when opening and closing markers split across events',async()=>{
 const parts=[event(chunk({content:'Svar: '})),event(chunk({content:'<thi'})),event(chunk({content:'nk>hemligt innehåll'})),event(chunk({content:'</think>42'})),event(chunk({},'stop')),event('[DONE]')];
 const fragments=[];const d=await consumeChatStream(responseFromParts(parts),{onToken:x=>fragments.push(x)});
 assert.equal(fragments.join(''),'Svar: 42');
 assert.ok(!fragments.join('').includes('hemligt'));
 assert.equal(visibleText('<think>hemligt</think>ja'),'ja');
 assert.equal(d.choices[0].message.content,'Svar: <think>hemligt innehåll</think>42');
});
test('streamed fragmented native tool calls are reconstructed, not executed midstream',async()=>{
 const events=[
  event(chunk({tool_calls:[{index:0,id:'tool',type:'function',function:{name:'write_',arguments:'{"na'}}]})),
  event(chunk({tool_calls:[{index:0,id:'-1',function:{name:'file',arguments:'me":"r.md",'}}]})),
  event(chunk({tool_calls:[{index:0,function:{arguments:'"content":"hello"}'}}]})),
  event(chunk({},'tool_calls')),event('[DONE]')];
 let previews=0;
 const d=await consumeChatStream(responseFromParts(events),{onToken:()=>previews++});
 assert.equal(previews,0);
 assert.deepEqual(d.choices[0].message.tool_calls,[{id:'tool-1',type:'function',function:{name:'write_file',arguments:'{"name":"r.md","content":"hello"}'}}]);
 assert.equal(d.choices[0].finish_reason,'tool_calls');
});
test('mid-stream provider error cannot be reported as success even with HTTP 200',async()=>{
 const r=responseFromParts([event(chunk({content:'partial'})),event({error:{message:'Provider disconnected',code:503}}),event('[DONE]')]);
 await assert.rejects(consumeChatStream(r),e=>e.status===503&&/Provider disconnected/.test(e.message));
});
test('missing DONE and missing finish_reason are both fatal',async()=>{
 await assert.rejects(consumeChatStream(responseFromParts([event(chunk({content:'partial'},'stop'))])),/innan \[DONE\]/);
 await assert.rejects(consumeChatStream(responseFromParts([event(chunk({content:'partial'})),event('[DONE]')])),/finish_reason/);
});
test('non-SSE 404 response reports status for explicit backward-compatible fallback',async()=>{
 const r=new Response(JSON.stringify({error:'Not found'}),{status:404,headers:{'Content-Type':'application/json'}});
 await assert.rejects(consumeChatStream(r),e=>e.status===404&&/Not found/.test(e.message));
});
test('size limits fail closed before incomplete actions become executable',async()=>{
 const r=responseFromParts([event(chunk({content:'long reply'})),event(chunk({},'stop')),event('[DONE]')]);
 await assert.rejects(consumeChatStream(r,{maxBytes:40}),/för stort/);
});
test('usage-only final chunk and CRLF SSE separators supported',async()=>{
 const events=[event(chunk({content:'OK'})).replaceAll('\n','\r\n'),event(chunk({},'stop')).replaceAll('\n','\r\n'),event({choices:[],usage:{cost:0,total_tokens:42}}).replaceAll('\n','\r\n'),event('[DONE]').replaceAll('\n','\r\n')];
 const res=await consumeChatStream(responseFromParts(events));
 assert.equal(res.choices[0].message.content,'OK');assert.equal(res.usage.cost,0);
});

test('partial SSE is flagged non-retriable while a pre-response 503 remains retryable',async()=>{
 const incomplete=responseFromParts([event(chunk({content:'partial'},'stop'))]);
 await assert.rejects(consumeChatStream(incomplete),e=>e.streamPartial===true&&e.status===502);
 const denied=new Response(JSON.stringify({error:'Provider unavailable'}),{status:503,headers:{'Content-Type':'application/json','Retry-After':'5'}});
 await assert.rejects(consumeChatStream(denied),e=>e.streamPartial===false&&e.status===503&&e.retryAfter===5);
});
