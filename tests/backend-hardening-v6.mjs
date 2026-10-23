import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace} from '../agents/workspace.mjs';
import {snapshot} from '../agents/evidence.mjs';
test('backend build tests must name an actual file, not a pasted implementation',async()=>{
 let executions=0;const w=new Workspace({allowCode:true,execute:async()=>{executions++;return {passed:true,value:{assertions:1}};}});
 w.advanced=true;w.backend=true;w.write('logic.js','function sum(a,b){return a+b;}');
 await assert.rejects(()=>w.tool('test_js',{code:'function sum(a,b){return a+b;} assert(sum(1,2)===3)'}),/name eller files/);
 assert.equal(executions,0);
 const r=await w.tool('test_js',{name:'logic.js',code:'assert(sum(1,2)===3)'});
 assert.equal(r.passed,true);assert.deepEqual(r.versions,[{name:'logic.js',version:1}]);assert.equal(executions,1);
});
test('analysis without code files may still use a standalone assertion',async()=>{
 const w=new Workspace({allowCode:true,execute:async()=>({passed:true,value:{assertions:1}})});w.advanced=true;w.backend=true;
 assert.equal((await w.tool('test_js',{code:'assert(2+2===4)'})).passed,true);
});
test('durable state keeps the actual assertion failure, not just passed=false',()=>{
 const w=new Workspace();w.backend=true;w.audit.push({id:'T1',tool:'test_js',ok:true,args:{name:'logic.js'},data:{passed:false,error:'collision failed',versions:[{name:'logic.js',version:1}]}});
 assert.equal(snapshot(w).recentTools[0].error,'collision failed');
});
