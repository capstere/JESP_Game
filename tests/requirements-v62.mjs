import test from 'node:test';
import assert from 'node:assert/strict';
import {enforceUserContract,userRequiresTarget,unsupportedReviewerIssue} from '../agents/requirements.mjs';
import {normalizeStrategy,normalizeModelDeliverables,strategyDefinitions} from '../agents/quality.mjs';
import {Workspace,runAgent} from '../agents/core.mjs';
import {executeSuite} from '../agents/verification.mjs';
const request='Bygg en FPS-prototyp där mellanslag skjuter ett synligt mål rakt fram från start och ger poäng. Visa väggar med raycasting. W/S flyttar, A/D roterar, R återställer.';
const plan=()=>({objective:'Shoot walls to score in an FPS',choice:'Canvas',criteria:[{id:'C1',requirement:'W/S movement'},{id:'C2',requirement:'Show walls on canvas'},{id:'C3',requirement:'Space fires projectile that detects collision with a wall and scores'},{id:'C4',requirement:'R resets initial state'}],deliverables:['index.html','logic.js','game.js']});
test('enforces user target scoring over invented wall scoring',()=>{
 assert.ok(userRequiresTarget(request));
 const r=enforceUserContract(plan(),request);
 assert.equal(r.notices.length,2);
 assert.match(r.contract.criteria[2].requirement,/målträff/);
 assert.doesNotMatch(r.contract.criteria[2].requirement,/detects collision with a wall/);
 assert.match(r.contract.objective,/synligt mål/);
 assert.equal(plan().criteria[2].requirement,'Space fires projectile that detects collision with a wall and scores');
});
test('does not narrow unrelated tasks or suppress honest objections',()=>{
 const p=plan();const r=enforceUserContract(p,'Skapa en FPS där mellanslag skjuter väggar.');
 assert.equal(r.contract,p);assert.deepEqual(r.notices,[]);
 assert.equal(unsupportedReviewerIssue('C3: shoot a wall to score',request),true);
 assert.equal(unsupportedReviewerIssue('C3: score does not increment when shooting target',request),false);
});
test('normalized strategy preserves original target requirement',()=>{
 const input={objective:'Shoot wall for points',approach_a:'Canvas raycasting',approach_b:'3D engine',choice:'Canvas',deliverables:['index.html','logic.js','game.js'],assumptions:[],steps:['Make game'],criteria:['W/S moves','Canvas displays a wall','Space shoots wall and scores','R resets']};
 const space={question:request,taskKind:'build',expectedNames:new Set()};
 const out=normalizeStrategy(input,space,()=>{});
 assert.match(out.criteria[2].requirement,/målträff/);
 assert.ok(space.contractCorrections.length);
});
test('previously verified behavior cannot regress during a speculative repair',async()=>{
 const question='Skapa logic.js som returnerar ett. Rätta endast verkliga fel.';
 const c=new AbortController();const s=new Workspace({signal:c.signal,question,web:false,allowCode:true,execute:async(source)=>{try{return {passed:true,value:(new Function(source))()}}catch(e){return {passed:false,error:e.message}}}});
 s.write('logic.js','function f(){return 1;}');
 s.strategy={objective:'Correct logic',choice:'Pure function',criteria:[],deliverables:['logic.js']};
 s.expectedNames.add('logic.js');s.taskKind='build';s.backend=true;s.advanced=true;s.verifyBehavior=true;
 s.verification={suite:Object.freeze([{id:'V1',kind:'js',files:['logic.js'],requirement:'f returns one',code:'assert.equal(f(),1);assert(true);'}]),passed:false,key:null,results:[]};
 await executeSuite(s);assert.equal(s.verification.passed,true);
 s.reviews.push({verdict:'revise',time:'2099-01-01T00:00:00.000Z'});
 const ai={provider:'backend',calls:0,lastModel:'mock',async ask(){this.calls++;return {text:JSON.stringify({kind:'actions',actions:[{tool:'write_file',args:{name:'logic.js',content:'function f(){return 2;}'}}]}),model:'mock'};}};
 await runAgent({question,ai,space:s,signal:c.signal,maxSteps:2,review:false,advanced:true,mode:'build',verifyBehavior:true});
 assert.equal(s.files.get('logic.js').content,'function f(){return 1;}');assert.equal(s.files.get('logic.js').version,1);
 assert.equal(s.verification.passed,true);
 assert.ok(s.trace.some(e=>e.type==='regression_rollback'));
 assert.ok(s.audit.some(e=>e.tool==='write_file'&&e.ok===false&&/ÄNDRING AVVISAD/.test(e.error)));
});
test('atomic two-file patch protects both files on invalid second edit',async()=>{
 const s=new Workspace({question:'Skapa a.js och b.js',signal:new AbortController().signal,web:false});
 s.write('a.js','let a=1;');s.write('b.js','let b=2;');
 await assert.rejects(s.tool('patch_files',{edits:[
  {name:'a.js',expected_version:1,find:'a=1',replace:'a=7'},
  {name:'b.js',expected_version:1,find:'b=invalid',replace:'b=7'}
 ]}),/matcha exakt en gång/);
 assert.equal(s.files.get('a.js').content,'let a=1;');assert.equal(s.files.get('b.js').content,'let b=2;');
 const result=await s.tool('patch_files',{edits:[
  {name:'a.js',expected_version:1,find:'a=1',replace:'a=3'},
  {name:'b.js',expected_version:1,find:'b=2',replace:'b=4'}
 ]});
 assert.equal(result.count,2);assert.equal(s.files.get('a.js').version,2);
 assert.equal(s.files.get('b.js').content,'let b=4;');
 await assert.rejects(s.tool('patch_files',{edits:[{name:'a.js',expected_version:1,find:'a=3',replace:'a=8'}]}),/Versionskonflikt/);
 assert.equal(s.files.get('a.js').content,'let a=3;');
});

test('real free architect response with descriptive filenames and procedural test step is recoverable',()=>{
 const input={objective:'solve project selection',approach_a:'enumerate combinations',approach_b:'dynamic programming',choice:'enumerate combinations',assumptions:[],criteria:['all constraints','test boundary'],steps:['implement solution','run assertions'],deliverables:[
 'solver.js med selectProjects-funktion',
 'resultat.json med {optimal:{...}, baseline:{...}}',
 'Testkörning med ≥4 assertions och loggade värden'
 ]};
 const space={question:'Skapa solver.js och resultat.json för optimering',taskKind:'build',expectedNames:new Set(['solver.js','resultat.json'])};
 const got=normalizeStrategy(input,space,name=>{if(!/^[a-zA-Z0-9_-]+\.(?:js|json)$/.test(name))throw Error('invalid filename: '+name);});
 assert.deepEqual(got.deliverables,['solver.js','resultat.json']);
 assert.equal(space.contractCorrections.filter(x=>x.kind==='deliverable_description').length,2);
 assert.equal(space.contractCorrections.filter(x=>x.kind==='procedural_step_not_file').length,1);
 const schema=strategyDefinitions()[0].function.parameters.properties.deliverables;
 assert.match(schema.items.description,/plain file basename/);
});
test('filename cleanup rejects unsafe paths or ambiguous user deliverables',()=>{
 const data=normalizeModelDeliverables(['../solver.js med ändring','report.js med en rapport','README.md','a/b.js','solver.js - generic algorithm']);
 assert.deepEqual(data.names,['../solver.js med ändring','report.js','README.md','a/b.js','solver.js']);
 const input={objective:'build',approach_a:'A',approach_b:'B',choice:'A',deliverables:['../secret.js med farlig väg'],criteria:['x','y'],steps:['build'],assumptions:[]};
 const space={question:'Skapa solver.js',taskKind:'build',expectedNames:new Set(['solver.js'])};
 assert.throws(()=>normalizeStrategy(input,space,name=>{if(name.includes('/'))throw Error('unsafe path');}),/unsafe path/);
});

test('critic must retain reports of real wall-scoring bug, not suppress them as invented requirements',()=>{
 assert.equal(unsupportedReviewerIssue('The game incorrectly scores when shooting a wall instead of the visible target',request),false);
 assert.equal(unsupportedReviewerIssue('Shooting walls should not increase score',request),false);
 assert.equal(unsupportedReviewerIssue('C3: shoot a wall to score',request),true);
});
