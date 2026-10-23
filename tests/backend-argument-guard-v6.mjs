import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace,runAgent} from '../agents/core.mjs';
const signal=()=>new AbortController().signal;
for(const malformed of ["['solver.js']",{},5,null])test('invalid files argument is observed, never executed or allowed to crash recovery: '+JSON.stringify(malformed),async()=>{
 let executions=0;const w=new Workspace({signal:signal(),web:false,allowCode:true,execute:async()=>{executions++;return {passed:true,value:{assertions:1}};}});
 w.write('solver.js','// A complete fixture for the build gate, not a real generated algorithm\nfunction f(){return 42;}');
 w.strategy={objective:'A fixture',choice:'Plain JS',deliverables:['solver.js'],criteria:[{id:'C1',requirement:'Works'},{id:'C2',requirement:'Is tested'}],steps:['test']};
 const roles=[],replies=[{kind:'actions',actions:[{tool:'test_files',args:{files:malformed,code:'assert(f()===42)'}}]},{kind:'actions',actions:[{tool:'test_files',args:{files:['solver.js'],code:'assert(f()===42)'}}]},{kind:'final',answer:'Tested.'}];
 const ai={provider:'backend',calls:0,async ask(){roles.push(this.role);this.calls++;return {model:'fixture',text:JSON.stringify(replies.shift())};}};
 const result=await runAgent({question:'Skapa solver.js',space:w,ai,signal:signal(),advanced:true,review:false,mode:'build',maxSteps:4});
 assert.equal(result.unfinished,false);assert.equal(executions,1);assert.deepEqual(roles,['work','repair','synthesis']);assert.equal(w.audit[0].ok,false);assert.equal(w.lastError,null);
});
