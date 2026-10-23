import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace,runAgent} from '../agents/core.mjs';
import {backendToolDefinitions} from '../agents/quality.mjs';
const signal=()=>new AbortController().signal;
test('backend file test schema has no ambiguous name label and only actual file names',()=>{
 const w=new Workspace();w.backend=true;w.allowCode=true;w.write('logic.js','function f(){}');
 const tools=backendToolDefinitions([{type:'function',function:{name:'test_js'}}],w);
 assert.ok(!tools.some(t=>t.function.name==='test_js'));
 const schema=tools.find(t=>t.function.name==='test_files').function.parameters;
 assert.deepEqual(schema.required,['files','code']);assert.equal(schema.properties.name,undefined);
 assert.deepEqual(schema.properties.files.items.enum,['logic.js']);
});
test('backend test tool not offered before any real code file exists',()=>{
 assert.equal(backendToolDefinitions([{function:{name:'test_js'}}],{backend:true,allowCode:true,files:new Map()}).length,0);
});
test('failed executable test invokes repair role and successful current-version retest clears test issue',async()=>{
 const w=new Workspace({signal:signal(),web:false,allowCode:true,execute:async()=>++executions===1?{passed:false,error:'window is not defined'}:{passed:true,value:{assertions:3}}});
 let executions=0;const roles=[];w.write('logic.js','// A sufficiently long fixture module for the build gate\nfunction sum(a,b){return a+b;}\nwindow.sum=sum;');
 w.strategy={objective:'Fix module',choice:'plain JS',deliverables:['logic.js'],criteria:[{id:'C1',requirement:'Works without DOM'},{id:'C2',requirement:'Passes tests'}],steps:['Fix','test']};
 const actions=a=>({kind:'actions',actions:a});
 const replies=[actions([{tool:'test_files',args:{files:['logic.js'],code:'assert(sum(1,2)===3)'}}]),actions([{tool:'write_file',args:{name:'logic.js',content:'// A sufficiently long fixture module for the build gate\nfunction sum(a,b){return a+b;}\nglobalThis.sum=sum;'}},{tool:'test_files',args:{files:['logic.js'],code:'assert(sum(1,2)===3)'}}]),{kind:'final',answer:'Fixed and tested.'}];
 const ai={provider:'backend',calls:0,async ask(){roles.push(this.role);this.calls++;return {text:JSON.stringify(replies.shift()),model:'fixture'};}};
 const result=await runAgent({question:'Skapa logic.js',space:w,ai,signal:signal(),advanced:true,review:false,maxSteps:4,mode:'build'});
 assert.equal(result.unfinished,false);assert.deepEqual(roles,['work','repair','work']);
 assert.ok(w.trace.some(x=>x.type==='repair_required'&&x.error==='window is not defined'));
 assert.equal(w.files.get('logic.js').version,2);assert.ok(!w.pendingIssues.some(x=>x.startsWith('TEST:')));
 assert.equal(w.audit.filter(x=>x.tool==='test_js').length,2);
});
