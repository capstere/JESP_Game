import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const base='https://dzjjffgohxeoahtflqjo.supabase.co/functions/v1';
const origin='https://capstere.github.io';
const log={mockedAI:false,authenticated:false,when:new Date().toISOString(),success:false};
mkdirSync('stream-evidence',{recursive:true});
try{
 const models=await fetch(base+'/jesp-gateway/models',{headers:{origin},signal:AbortSignal.timeout(20000)});
 assert.equal(models.status,200,'Free catalogue available');
 const list=(await models.json()).models||[];
 const model=list.find(m=>m.id==='nvidia/nemotron-3.5-lightning:free'&&Number(m.pricing?.prompt)===0&&Number(m.pricing?.completion)===0)||list.find(m=>m.id.endsWith(':free')&&m.supported_parameters?.includes('tools')&&Number(m.pricing?.prompt)===0&&Number(m.pricing?.completion)===0);
 assert.ok(model,'No verified zero-price tool model exists');
 log.model=model.id;
 const started=Date.now();
 const response=await fetch(base+'/jesp-stream/chat-stream',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({model:model.id,messages:[{role:'user',content:'Say exactly: JESP STREAM OK'}],max_tokens:640,reasoning:'low'}),signal:AbortSignal.timeout(115000)});
 log.status=response.status;log.contentType=response.headers.get('content-type');log.cors=response.headers.get('access-control-allow-origin');
 assert.equal(response.status,200,'SSE endpoint must return HTTP 200');
 assert.match(log.contentType||'',/text\/event-stream/);
 assert.equal(log.cors,origin);
 const reader=response.body.getReader(),decode=new TextDecoder();let bytes=0,text='',done=false,finish=false,answer='',events=0;
 while(!done){
  const b=await reader.read();if(b.done)break;bytes+=b.value.byteLength;assert.ok(bytes<1200000,'SSE within cap');
  text+=decode.decode(b.value,{stream:true});let match;
  while((match=/\r?\n\r?\n/.exec(text))!==null){
   const frame=text.slice(0,match.index);text=text.slice(match.index+match[0].length);
   for(const line of frame.split(/\r?\n/)){if(!line.startsWith('data:'))continue;const d=line.slice(5).trim();
    if(d==='[DONE]'){done=true;continue;}
    const obj=JSON.parse(d);if(obj.error)throw Error('SSE provider error: '+JSON.stringify(obj.error));
    if(obj.usage)log.usage=obj.usage;
    for(const c of obj.choices||[]){answer+=c.delta?.content||'';if(c.finish_reason)finish=true;}
    events++;
   }
  }
 }
 log.events=events;log.bytes=bytes;log.milliseconds=Date.now()-started;log.answer=answer.slice(0,500);log.done=done;log.finish=finish;
 assert.ok(done&&finish&&events>0,'Streaming must have a final frame');
 assert.ok(answer.includes('JESP')&&answer.toUpperCase().includes('STREAM'),'Real model answered');
 if(log.usage&&log.usage.cost!==undefined)assert.equal(Number(log.usage.cost),0,'Actual reported cost is zero');
 log.success=true;
 console.log('LIVE_SSE_INFERENCE_PASSED',JSON.stringify(log));
}catch(e){log.error=String(e);console.error('LIVE_SSE_INFERENCE_FAILED',JSON.stringify(log));throw e;}
finally{writeFileSync('stream-evidence/probe.json',JSON.stringify(log,null,2));}
