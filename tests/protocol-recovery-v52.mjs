import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace,filename,runAgent} from '../agents/core.mjs';
import {strategyDefinitions,normalizeStrategy} from '../agents/quality.mjs';
import {AI} from '../agents/transport.mjs';
test('architecture schema demands two named alternatives',()=>{
 const p=strategyDefinitions()[0].function.parameters;
 assert.ok(p.required.includes('approach_a')&&p.required.includes('approach_b'));assert.equal(p.properties.criteria.minItems,2);
});
test('named alternatives and structured criterion text retain semantic content',()=>{
 const w=new Workspace({web:false});w.taskKind='build';
 const s=normalizeStrategy({objective:'App',approach_a:'Canvas with compact rendering',approach_b:'DOM with simpler UI',choice:'Canvas',assumptions:[],deliverables:['index.html'],criteria:[{requirement:'Moves on W'},{description:'Resets on R'}],steps:['Build','Test']},w,filename);
 assert.deepEqual(s.alternatives,['Canvas with compact rendering','DOM with simpler UI']);assert.equal(s.criteria[1].requirement,'Resets on R');
});
test('invalid native call is not executed; next call uses validated JSON protocol',async()=>{
 let calls=0;class Stub extends AI{async requestOnce(messages,signal,max,tools){calls++;if(calls===1)throw new Error('AI:n skickade ett ogiltigt verktygsanrop.');assert.equal(tools,undefined);assert.match(messages.at(-1).content,/Native function calls are disabled/);return {text:'{"kind":"final","answer":"Done"}'};}}
 const ai=new Stub();const tools=[{type:'function',function:{name:'write_file',parameters:{type:'object'}}}];
 const a=await ai.ask([],new AbortController().signal,1000,tools);assert.ok(a.protocolError);assert.equal(a.text,'');
 const b=await ai.ask([],new AbortController().signal,1000,tools);assert.match(b.text,/Done/);assert.equal(calls,2);
});
test('three invalid strategies cannot consume the full task budget',async()=>{
 const w=new Workspace({web:false});const ai={calls:0,async ask(){this.calls++;return {text:'{}',model:'MOCK'};}};
 const r=await runAgent({question:'Bygg en app',space:w,ai,signal:new AbortController().signal,advanced:true,maxSteps:24});
 assert.equal(r.calls,3);assert.equal(r.stopReason,'strategy');assert.equal(r.unfinished,true);assert.equal(w.files.size,0);
});

import {transientDelay} from '../agents/transport.mjs';
test('observed HTTP 500 is a bounded transient failure, not a reason to switch to paid service',()=>{
 assert.equal(transientDelay({status:500,retryAfter:10},0),31000);
 assert.equal(transientDelay({status:500,retryAfter:10},2),null);
});
