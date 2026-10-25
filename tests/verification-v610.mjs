import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactKey,normalizeSuite,executeSuite,verificationIssues,verificationRequired,verifierInput,verifierDefinitions,unwrapVerifierDecision} from '../agents/verification.mjs';
import {Workspace,runAgent} from '../agents/core.mjs';
const setup=()=>{const s=new Workspace({signal:new AbortController().signal,web:false,allowCode:true,execute:async()=>({passed:true,value:'{"assertions":3}'})});Object.assign(s,{backend:true,advanced:true,verifyBehavior:true,taskKind:'build',pendingIssues:[],reviews:[],trace:[]});s.write('logic.js','function f(x) {return x+1;}');return s;};
const suite=(code='assert(true);assert(true);')=>({tests:[{id:'V1',kind:'js',requirement:'Positive behavior',files:['logic.js'],code},{id:'V2',kind:'js',requirement:'Combined boundary',files:['logic.js'],code}]});
test('execution consent is required',()=>{const s=setup();assert.ok(verificationRequired(s));s.allowCode=false;assert.equal(verificationRequired(s),false);});
test('reject nonexistent or duplicate files',()=>{const s=setup();for(const files of [['missing.js'],['logic.js','logic.js'],[]]){const raw=suite();raw.tests[0].files=files;assert.throws(()=>normalizeSuite(raw,s));}});
test('require 2-6 tests with distinct IDs',()=>{const s=setup();assert.throws(()=>normalizeSuite({tests:[]},s));const raw=suite();raw.tests[1].id='V1';assert.throws(()=>normalizeSuite(raw,s));});
test('HTML requires browser behavior test',()=>{const s=setup();s.write('index.html','<p>App</p>');assert.throws(()=>normalizeSuite(suite(),s));const raw=suite();raw.tests[1]={id:'V2',kind:'page',page:'index.html',requirement:'Browser behavior',code:'assert(document.querySelector("p"));assert(true);'};assert.equal(normalizeSuite(raw,s).length,2);});
test('unauthorized paths rejected',()=>{const s=setup();const raw=suite();raw.tests[0].files=['../logic.js'];assert.throws(()=>normalizeSuite(raw,s));});
test('suite frozen and tests preserved after execution',async()=>{const s=setup();s.verification={suite:normalizeSuite(suite(),s)};const original=JSON.stringify(s.verification.suite);await executeSuite(s);assert.ok(s.verification.passed);assert.equal(JSON.stringify(s.verification.suite),original);assert.equal(s.audit[0].origin,'independent-verifier');assert.deepEqual(verificationIssues(s),[]);assert.throws(()=>s.verification.suite[0].code='');});
test('file edits invalidate passing verification',async()=>{const s=setup();s.verification={suite:normalizeSuite(suite(),s)};await executeSuite(s);const key=artifactKey(s);s.write('logic.js','function f(x){return x+2;}');assert.notEqual(artifactKey(s),key);assert.ok(verificationIssues(s)[0].includes('aktuell'));});
test('failed tests retain counterexample',async()=>{const s=setup();s.execute=async()=>({passed:false,error:'zero resources with free item'});s.verification={suite:normalizeSuite(suite(),s)};await executeSuite(s);assert.equal(s.verification.passed,false);assert.match(verificationIssues(s)[0],/zero resources/);});
for(const count of [0,1])test(count+' assertions do not satisfy independent suite',async()=>{const s=setup();s.execute=async()=>({passed:true,value:JSON.stringify({assertions:count})});s.verification={suite:normalizeSuite(suite(),s)};await executeSuite(s);assert.equal(s.verification.passed,false);});
test('abort propagates',async()=>{const s=setup();s.verification={suite:normalizeSuite(suite(),s)};const c=new AbortController();c.abort(new DOMException('Stopped','AbortError'));s.signal=c.signal;await assert.rejects(executeSuite(s),{name:'AbortError'});});
test('repair reruns same suite against new versions',async()=>{const s=setup();let good=false;s.execute=async()=>good?{passed:true,value:'{"assertions":4}'}:{passed:false,error:'counterexample'};s.verification={suite:normalizeSuite(suite(),s)};await executeSuite(s);s.write('logic.js','function f(x){return x+1;}');good=true;await executeSuite(s);assert.ok(s.verification.passed);assert.equal(s.verification.executions,2);assert.deepEqual(s.audit.at(-1).data.versions,[{name:'logic.js',version:2}]);assert.deepEqual(verificationIssues(s),[]);});
test('runner cannot finish after independent failure',async()=>{
 const s=setup();s.strategy={objective:'increment',criteria:[],deliverables:['logic.js'],choice:'function'};s.expectedNames.add('logic.js');const roles=[];
 const ai={provider:'backend',calls:0,lastModel:'mock',async ask(){this.calls++;roles.push(this.role);return {text:JSON.stringify(this.role==='verifier'?suite():{kind:'final',answer:'done'}),model:'mock'};}};
 s.execute=async()=>({passed:false,error:'counterexample'});
 const r=await runAgent({question:'Skapa logic.js',ai,space:s,signal:s.signal,maxSteps:3,review:false,advanced:true,mode:'build',verifyBehavior:true});
 assert.equal(r.unfinished,true);assert.ok(roles.includes('verifier'));assert.ok(r.issues.some(x=>x.startsWith('VERIFY:')));
});

test('unsupported module loader is rejected before freezing a suite',()=>{const s=setup();for(const code of ["const {f}=require('./logic.js');assert(f(1));", "import {f} from './logic.js';", "export const test=1;"]){assert.throws(()=>normalizeSuite(suite(code),s),/require|import|export/);}});
test('independent expectation prompt cannot see implementation branches or prior outcomes',()=>{const s=setup();s.write('logic.js',"function choose(input){if(input.limit===0)return 999;} globalThis.reset=function(){};");const input=verifierInput(s);const raw=JSON.stringify(input);assert.ok(raw.includes('choose(input)'));assert.ok(raw.includes('reset'));assert.ok(!raw.includes('999'));assert.ok(!raw.includes('return'));});

test('compile failure is sent for repair before any verifier is called',async()=>{
 const s=setup();s.write('index.html','<!doctype html><script src="logic.js"></script>');s.strategy={objective:'working program',criteria:[],deliverables:['logic.js','index.html'],choice:'plain JS'};s.expectedNames.add('logic.js');s.expectedNames.add('index.html');const roles=[];
 const tool=s.tool.bind(s);s.tool=async(name,args)=>name==='check_project'?{passed:false,issues:['Duplicate lexical declaration in scripts']}:tool(name,args);
 const ai={provider:'backend',calls:0,lastModel:'mock',async ask(){this.calls++;roles.push(this.role);return {text:JSON.stringify({kind:'final',answer:'done'}),model:'mock'};}};
 const r=await runAgent({question:'Skapa logic.js och index.html',ai,space:s,signal:s.signal,maxSteps:2,review:false,advanced:true,mode:'build',verifyBehavior:true});
 assert.equal(r.unfinished,true);assert.ok(!roles.includes('verifier'));assert.ok(roles.every(x=>x==='repair'));assert.equal(s.audit.filter(x=>x.tool==='check_project').length,1);
});

test('typed submit_tests tool and repaired labels preserve executable code',()=>{
 const schema=verifierDefinitions()[0].function;assert.equal(schema.name,'submit_tests');
 const raw=suite();raw.tests[1].id='V1';
 const unwrapped=unwrapVerifierDecision({kind:'actions',actions:[{tool:'submit_tests',args:raw}]});
 assert.deepEqual(unwrapped.tests.map(t=>t.id),['V1','V2']);assert.equal(unwrapped.tests[1].code,raw.tests[1].code);
 assert.equal(normalizeSuite(unwrapped,setup()).length,2);
 assert.throws(()=>unwrapVerifierDecision({kind:'actions',actions:[{tool:'write_file',args:raw}]}));
});
test('verifier formatting failures recover at third real suite proposal',async()=>{
 const s=setup();s.strategy={objective:'increment',criteria:[],deliverables:['logic.js'],choice:'function'};s.expectedNames.add('logic.js');let verifierCalls=0;
 const ai={provider:'backend',calls:0,lastModel:'mock',async ask(_msg,_sig,_tok,tools){this.calls++;if(this.role==='verifier'){verifierCalls++;assert.equal(tools?.[0]?.function?.name,'submit_tests');return {text:JSON.stringify(verifierCalls<3?{tests:[suite().tests[0]]}:{kind:'actions',actions:[{tool:'submit_tests',args:suite()}]}),model:'mock'};}return {text:JSON.stringify({kind:'final',answer:'Done'}),model:'mock'};}};
 const result=await runAgent({question:'Skapa logic.js',ai,space:s,signal:s.signal,maxSteps:6,review:false,advanced:true,mode:'build',verifyBehavior:true});
 assert.equal(verifierCalls,3);assert.equal(s.verification?.passed,true);assert.equal(s.verification.executions,1);
 assert.equal(s.audit.filter(e=>e.origin==='independent-verifier').length,2);
 assert.equal(s.trace.filter(e=>e.type==='verification_error').length,2);
 assert.ok(!result.issues.some(e=>e.startsWith('VERIFY:')));
});


test('trusted property oracle precedes stochastic verifier and preserves counterexample through real repair',async()=>{
 const question='Skapa solver.js och resultat.json: selectProjects(projects, budget). A kostar 6 och ger 30 nytta, B kostar 3 och ger 14, C kostar 4 och ger 16, D kostar 2 och ger 9. Budgeten är 10.';
 const signal=new AbortController().signal;
 const s=new Workspace({signal,question,web:false,allowCode:true,execute:async source=>{try{return {passed:true,value:new Function(source)()};}catch(e){return {passed:false,error:String(e.message||e)};}}});
 const source=[
 'function selectProjects(projects,budget){',
 'if(!Number.isFinite(budget)||budget<0)throw Error("invalid budget");',
 'if(budget===0)return {selected:[],total_cost:0,total_benefit:0};',
 'let best={selected:[],total_cost:0,total_benefit:0};',
 'for(let mask=0;mask<(1<<projects.length);mask++){let cost=0,benefit=0,selected=[];for(let i=0;i<projects.length;i++){if(mask&(1<<i)){cost+=projects[i].cost;benefit+=projects[i].benefit;selected.push(projects[i].id);}}if(cost<=budget&&benefit>best.total_benefit)best={selected,total_cost:cost,total_benefit:benefit};}return best;}'
 ].join('\n');
 s.write('solver.js',source);
 s.write('resultat.json',JSON.stringify({optimal:{selected:['A','C'],total_cost:10,total_benefit:46},baseline:{selected:['A','B'],total_cost:9,total_benefit:44}}));
 s.strategy={objective:'Choose optimal project combination',criteria:[],deliverables:['solver.js','resultat.json'],choice:'enumerate subsets'};
 s.expectedNames.add('solver.js');s.expectedNames.add('resultat.json');
 const roles=[];
 const ai={provider:'backend',calls:0,lastModel:'mock',async ask(){this.calls++;roles.push(this.role);return {text:JSON.stringify({kind:'actions',actions:[{tool:'edit_file',args:{name:'solver.js',expected_version:1,find:'if(budget===0)return {selected:[],total_cost:0,total_benefit:0};',replace:''}}]}),model:'mock'};}};
 await runAgent({question,ai,space:s,signal,maxSteps:3,review:false,advanced:true,mode:'build',verifyBehavior:true});
 assert.equal(s.verification?.trusted,true);
 assert.equal(s.verification?.passed,true,JSON.stringify(s.verification?.results));
 assert.equal(s.verification?.executions,2);
 assert.ok(s.audit.some(e=>e.testId==='V8'&&e.data?.passed===false));
 assert.ok(s.audit.some(e=>e.testId==='V8'&&e.data?.passed===true));
 assert.ok(!roles.includes('verifier'),'Known reference tasks must not depend on AI-authored test fixtures');
 assert.equal(s.files.get('solver.js').version,2);
});
test('trusted FPS UI contract targets actual initial coordinates and user input, not (0,0)',async()=>{
 const {fpsPropertyTest}=await import('../agents/oracle.mjs');
 const q='Bygg en FPS-prototyp med window.gameState och window.resetGame. W/S flytta, A/D rotera, Space skjuta målet direkt från start, R återställa.';
 const s=setup();s.question=q;s.write('index.html','<!doctype html><canvas></canvas>');
 const t=fpsPropertyTest(s);
 assert.equal(t.kind,'page');assert.equal(t.page,'index.html');assert.equal(t.id,'V9');
 assert.match(t.code,/Math\.hypot\(window\.gameState\.x-start\.x/);
 assert.match(t.code,/key\('Space'/);
 assert.match(t.code,/colors\.size>=3/);
 assert.doesNotMatch(t.code,/gameState\.x===0/);
 assert.equal(fpsPropertyTest({...s,question:'Skapa en FPS-plan'}),null);
});

test('FPS source-based behavior oracle detects scoring without target deactivation',async()=>{
 const {fpsPropertyTest}=await import('../agents/oracle.mjs');
 const s=setup();s.question='Bygg en FPS med window.gameState och window.resetGame. W/S flyttar, A/D roterar, Space skjuter synligt startmål, R återställer.';
 s.write('index.html','<!doctype html><canvas></canvas>');
 const t=fpsPropertyTest(s);
 assert.match(t.code,/deactivate the hit target/);assert.match(t.code,/restore the starting target/);
});