import test from 'node:test';
import assert from 'node:assert/strict';
import {requestSpecialist} from '../agents/specialist-request.mjs';
test('specialist transport state is isolated from worker protocol and token preview',async()=>{
 let calls=0,tokenCalls=0;const cap=new Set(['worker']);
 const ai={calls:5,role:'repair',jsonProtocol:true,backendEffortCaps:cap,onToken:()=>tokenCalls++,async ask(){calls++;this.calls++;assert.equal(this.role,'critic');assert.equal(this.jsonProtocol,false);assert.equal(this.backendEffortCaps,undefined);this.jsonProtocol=true;this.onToken('partial');return{model:'free',text:'ok'};}};
 const r=await requestSpecialist({ai,signal:new AbortController().signal,context:{},tool:{},decode:x=>x});
 assert.equal(r.advice,'ok');assert.equal(ai.calls,6);assert.equal(calls,1);assert.equal(ai.role,'repair');assert.equal(ai.jsonProtocol,true);assert.equal(ai.backendEffortCaps,cap);assert.equal(tokenCalls,0);
});
test('one rejected proposal is corrected but never accepted without validation',async()=>{
 const ai={calls:0,async ask(messages){this.calls++;if(this.calls===1)return{model:'free',text:'bad'};assert.match(messages.at(-1).content,/avvisades/);return{model:'free',text:'valid'};}};
 const out=await requestSpecialist({ai,context:{},tool:{},decode:x=>{if(x!=='valid')throw Error('missing fields');return x;}});
 assert.equal(ai.calls,2);assert.equal(out.attempts.length,2);assert.equal(out.advice,'valid');assert.match(out.attempts[0].rejectedReason,/missing fields/);
});
test('persistent invalid proposals stop at two, retaining diagnostics and request counts',async()=>{
 const ai={calls:0,async ask(){this.calls++;return{text:'bad'};}};
 await assert.rejects(requestSpecialist({ai,context:{},tool:{},decode:()=>{throw Error('invalid');}}),e=>e.adviceAttempts.length===2);assert.equal(ai.calls,2);
});
test('quota failure is not a format correction opportunity',async()=>{
 const ai={calls:0,async ask(){this.calls++;const e=Error('quota');e.status=429;throw e;}};
 await assert.rejects(requestSpecialist({ai,context:{},tool:{},decode:x=>x}),e=>e.status===429);assert.equal(ai.calls,1);
});
