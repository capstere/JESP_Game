import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace} from '../agents/core.mjs';
import {snapshot} from '../agents/evidence.mjs';
test('context preserves real tool IDs and assertion/file-version evidence',()=>{
 const w=new Workspace({web:false});
 w.audit.push({id:'T4',tool:'test_js',ok:true,data:{passed:true,assertions:3,versions:[{name:'logic.js',version:2}]}});
 const e=snapshot(w).recentTools[0];
 assert.equal(e.id,'T4');assert.equal(e.assertions,3);assert.deepEqual(e.versions,[{name:'logic.js',version:2}]);
});
import {reviewCheckIssues,qualityIssues} from '../agents/quality.mjs';
test('read-back tool evidence must refer to current version',()=>{
 const w=new Workspace({web:false});w.advanced=true;w.strategy={criteria:[{id:'C1',requirement:'Current content'}]};
 w.write('a.js','const x=1;');w.audit.push({id:'T1',tool:'read_file',ok:true,data:{name:'a.js',version:1}});w.write('a.js','const x=2;');
 assert.ok(reviewCheckIssues({checks:[{id:'C1',status:'pass',finding:'File seen',evidence:['tool:T1']}]},w).some(x=>x.includes('Föråldrat')));
});
test('a later failure overrides prior passing multifile assertions for current version',()=>{
 const w=new Workspace({web:false});w.advanced=true;w.strategy={criteria:[]};w.taskKind='build';w.allowCode=true;
 w.write('a.js','function testFunction(x){return x+1;}\n'.repeat(3));
 for(const passed of [true,false])w.audit.push({tool:'test_js',args:{files:['a.js']},ok:true,data:{passed,assertions:3,versions:[{name:'a.js',version:1}]}});
 assert.ok(qualityIssues(w).some(x=>x.includes('Senaste testet')));
});

import {taskKind} from '../agents/quality.mjs';
for(const [q,k] of [['Skriv kod för ett FPS-spel','build'],['Skriv en funktion som summerar tal','build'],['Utveckla ett spel','build'],['Plan för ett FPS-spel','plan'],['Granska denna kod','analyse']])test('Swedish intent '+q,()=>assert.equal(taskKind(q),k));

import {AI,transientDelay} from '../agents/transport.mjs';
test('temporary failures obey retry hints and stop after two retries',async()=>{
 let calls=0;const waits=[];class Stub extends AI{async requestOnce(){calls++;throw Object.assign(new Error('busy'),{status:503,retryAfter:45});}async wait(ms){waits.push(ms);}}
 await assert.rejects(new Stub().ask([],new AbortController().signal),/busy/);assert.equal(calls,3);assert.deepEqual(waits,[46000,46000]);
});
test('temporary retry can recover without losing a completed response',async()=>{
 let calls=0;class Stub extends AI{async requestOnce(){calls++;if(calls===1)throw Object.assign(new Error('busy'),{status:503,retryAfter:10});return {text:'real shape'};}async wait(ms){assert.equal(ms,31000);}}
 assert.equal((await new Stub().ask([],new AbortController().signal)).text,'real shape');assert.equal(calls,2);
});
test('no transient retry for authentication, payment, quota or long cooldown',()=>{
 for(const status of [400,401,402,403,429])assert.equal(transientDelay({status,retryAfter:10},0),null);
 assert.equal(transientDelay({status:503,retryAfter:500},0),null);
});
