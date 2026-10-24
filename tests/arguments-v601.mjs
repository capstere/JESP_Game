import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeToolArguments} from '../agents/arguments.mjs';
import {Workspace,runAgent} from '../agents/core.mjs';
const signal=()=>new AbortController().signal;
test('observed double-encoded file list normalizes with explicit audit note',()=>{const r=normalizeToolArguments('test_files',{files:'["logic.js"]',code:'assert(true)'});assert.deepEqual(r.args.files,['logic.js']);assert.equal(r.changes.length,1);});
test('canonical list remains unchanged',()=>{const args={files:['logic.js'],code:'x'};assert.equal(normalizeToolArguments('test_files',args).args,args);});
for(const files of ["['logic.js']",'logic.js','[1]','["a.js","a.js"]','{"files":["a.js"]}'])test('reject ambiguous or malformed files '+files,()=>assert.throws(()=>normalizeToolArguments('test_files',{files,code:'x'})));
test('normalization never overrides code consent or filename guards',async()=>{const w=new Workspace({signal:signal(),web:false});w.advanced=true;w.backend=true;const args=normalizeToolArguments('test_files',{files:'["logic.js"]',code:'assert(true)'}).args;await assert.rejects(w.tool('test_js',args),/godkännande/);w.allowCode=true;w.execute=async()=>({passed:true});await assert.rejects(w.tool('test_js',{...args,files:['../logic.js']}),/filnamn/);});
test('invalid name plus files remains rejected',()=>assert.throws(()=>normalizeToolArguments('test_files',{files:'["logic.js"]',name:'logic.js',code:'x'})));
test('normalization cannot expand to external files',async()=>{const w=new Workspace({signal:signal(),web:false,allowCode:true,execute:async()=>({passed:true})});w.advanced=true;w.backend=true;const args=normalizeToolArguments('test_files',{files:'["secret.js"]',code:'assert(true)'}).args;await assert.rejects(w.tool('test_js',args),/finns inte/);});

test('canonicalized test executes only current authorized workspace file and records conversion',async()=>{
 let executions=0;const w=new Workspace({signal:signal(),web:false,allowCode:true,execute:async code=>{executions++;assert.ok(code.includes('function f()'));return {passed:true,value:{assertions:1}};}});
 w.write('solver.js','// Actual fixture content for the current file evidence gate, not a generated algorithm\nfunction f(){return 42;}');
 w.strategy={objective:'fixture',choice:'JS',deliverables:['solver.js'],criteria:[{id:'C1',requirement:'works'}],steps:['test']};
 const replies=[{kind:'actions',actions:[{tool:'test_files',args:{files:'["solver.js"]',code:'assert(f()===42)'}}]},{kind:'final',answer:'Tested fixture'}];
 const ai={provider:'backend',calls:0,async ask(){this.calls++;return {model:'fixture-not-live',text:JSON.stringify(replies.shift())};}};
 const r=await runAgent({question:'Skapa solver.js',space:w,ai,signal:signal(),advanced:true,review:false,mode:'build',maxSteps:3});
 assert.equal(r.unfinished,false);assert.equal(executions,1);assert.deepEqual(w.audit[0].args.files,['solver.js']);assert.equal(w.audit[0].argumentNormalization.length,1);
});
