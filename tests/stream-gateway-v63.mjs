import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,freeModel,filterStreamChunk} from '../backend/stream-gateway.mjs';
test('stream gateway accepts only explicit zero-priced free catalogue entries',()=>{
 assert.equal(freeModel({id:'good:free',pricing:{prompt:0,completion:0}}),true);
 assert.equal(freeModel({id:'model-paid',pricing:{prompt:0,completion:0}}),false);
 assert.equal(freeModel({id:'fake:free',pricing:{prompt:0,completion:0,image:0.01}}),false);
 assert.equal(freeModel({id:'fake:free',pricing:{prompt:0,completion:0}}),true);
});
test('chat-stream server still limits roles, tools, context and outputs',()=>{
 assert.throws(()=>validate({model:'m:free',messages:[]}),/1–60/);
 assert.throws(()=>validate({model:'m:free',messages:[{role:'root',content:'hi'}]}),/Invalid role/);
 assert.throws(()=>validate({model:'m:free',messages:[{role:'user',content:'hi'}],max_tokens:20000}),/64–16384/);
 const valid=validate({model:'m:free',messages:[{role:'user',content:'hi'}],max_tokens:100});
 assert.equal(valid.stream,false,'Upstream stream mode is set server-side only after quota validation');
 assert.equal(valid.model,'m:free');
});
test('gateway strips hidden reasoning fields and visible think blocks, preserving safe output',()=>{
 const state={model:'m:free',raw:'',sent:0,finished:false};
 let first=filterStreamChunk({model:'m:free',choices:[{index:0,delta:{content:'<think>secret analysis',reasoning_content:'private hidden tokens'},finish_reason:null}]},state);
 assert.equal(first.choices[0].delta.content,undefined);
 assert.equal(first.choices[0].delta.reasoning_content,undefined);
 let second=filterStreamChunk({choices:[{index:0,delta:{content:'</think>Result'},finish_reason:'stop'}]},state);
 assert.equal(second.choices[0].delta.content,'Result');assert.equal(state.finished,true);
});
test('gateway relays fragmented tool-calls but discards unexpected model diagnostics',()=>{
 const state={model:'m:free',raw:'',sent:0,finished:false};
 const clean=filterStreamChunk({model:'m:free',meta:{internal_secret:'x'},choices:[{index:0,delta:{tool_calls:[{index:0,id:'id0',type:'function',function:{name:'write_file',arguments:'{"name":"a.md"',reasoning:'secret'}}],reasoning:'SECRET'},finish_reason:'tool_calls'}]},state);
 assert.equal(clean.meta,undefined);
 assert.equal(clean.choices[0].delta.reasoning,undefined);
 assert.equal(clean.choices[0].delta.tool_calls[0].function.reasoning,undefined);
 assert.equal(clean.choices[0].finish_reason,'tool_calls');
});
test('midstream provider errors produce failure and never a false success',()=>{
 const state={model:'m:free',raw:'',sent:0,finished:false};
 assert.throws(()=>filterStreamChunk({error:{message:'Disconnected',code:502}},state),/Disconnected/);
 assert.throws(()=>filterStreamChunk({choices:[{index:0,delta:{content:'x'},finish_reason:'error'}]},state),/interrupted/);
});
