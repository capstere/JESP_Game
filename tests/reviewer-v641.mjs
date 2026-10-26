import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeNativeCalls,reviewDefinitions} from '../agents/protocol.mjs';
import {backendAsk} from '../agents/backend.mjs';
const REVIEW={
 verdict:'pass',answer:'Verifierat utan kvarstående fel.',issues:[],
 checks:[
  {id:'C1',status:'pass',finding:'Korrekt kod kördes.',evidence:['file:logic.js@v1']},
  {id:'C2',status:'pass',finding:'Riktiga assertions passerade.',evidence:['tool:T9']}
 ],
 answer_check:{status:'pass',finding:'Sammanfattningen stöds av filerna.',evidence:['file:logic.js@v1']}
};
const call={type:'function',id:'tool-review-1',function:{name:'submit_review',arguments:JSON.stringify(REVIEW)}};
test('advanced reviewer schema requires per-criterion checks and answer_check',()=>{
 const regular=reviewDefinitions()[0].function;
 const advanced=reviewDefinitions(true)[0].function;
 assert.equal(regular.name,'submit_review');
 assert.ok(!regular.parameters.required.includes('checks'));
 assert.ok(advanced.parameters.required.includes('checks'));
 assert.ok(advanced.parameters.required.includes('answer_check'));
 assert.deepEqual(advanced.parameters.properties.checks.items.required,['id','status','evidence','finding']);
 assert.deepEqual(advanced.parameters.properties.answer_check.required,['status','evidence','finding']);
});
test('native submit_review retains structured checks and exact answer_check evidence',()=>{
 const decoded=decodeNativeCalls({tool_calls:[call]});
 assert.ok(!decoded.toolCalls);
 assert.deepEqual(JSON.parse(decoded.text),REVIEW);
});
test('basic review native calls remain backward compatible',()=>{
 const input={verdict:'revise',answer:'Needs a fix',issues:['missing x']};
 const decoded=decodeNativeCalls({tool_calls:[{type:'function',id:'id',function:{name:'submit_review',arguments:JSON.stringify(input)}}]});
 assert.deepEqual(JSON.parse(decoded.text),input);
});
test('real transport code accepts an advanced reviewer tool response without brittle freeform JSON',async t=>{
 let sent;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  sent=JSON.parse(options.body);
  return new Response(JSON.stringify({model:'c:free',choices:[{index:0,finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[call]}}],usage:{cost:0}}),{status:200,headers:{'Content-Type':'application/json'}});
 });
 const ai={workerModel:'w:free',criticModel:'c:free',reasoning:'auto',role:'critic',calls:0,onStatus:()=>{}};
 const res=await backendAsk(ai,[{role:'system',content:'Review the evidence'},{role:'user',content:'Check C1 C2'}],new AbortController().signal,4096,reviewDefinitions(true));
 assert.equal(sent.model,'c:free');
 assert.equal(sent.tools[0].function.name,'submit_review');
 assert.deepEqual(JSON.parse(res.text),REVIEW);
 assert.equal(res.usage.cost,0);
});
