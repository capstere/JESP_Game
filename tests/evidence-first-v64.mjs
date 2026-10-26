import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace,runAgent} from '../agents/core.mjs';
import {artifactKey,currentTrustedPass,currentTrustedFailure,projectPropertyTest,executeSuite} from '../agents/verification.mjs';
import {qualityIssues} from '../agents/quality.mjs';
import {completionIssues} from '../agents/evidence.mjs';
const create=(question)=>{
 const c=new AbortController();
 return new Workspace({signal:c.signal,question,web:false,allowCode:true,
  execute:async source=>{try{return {passed:true,value:Function(source)()};}catch(e){return {passed:false,error:String(e?.message||e)};}}});
};
const question='Skapa solver.js och resultat.json. Implementera selectProjects(projects, budget), högst 12 projekt. A kostar 6 och ger 30 nytta, B kostar 3 och ger 14, C kostar 4 och ger 16, D kostar 2 och ger 9. Budgeten är 10. Budget 0 med kostnadsfritt projekt måste ge optimal lösning.';
const broken=[
 "function selectProjects(projects,budget){",
 " if(!Number.isFinite(budget)||budget<0)throw Error('invalid budget');",
 " if(budget===0)return {selected:[],total_cost:0,total_benefit:0};",
 " let best={selected:[],total_cost:0,total_benefit:0};",
 " for(let mask=0;mask<(1<<projects.length);mask++){",
 "   let cost=0,benefit=0,selected=[];",
 "   for(let i=0;i<projects.length;i++)if(mask&(1<<i)){cost+=projects[i].cost;benefit+=projects[i].benefit;selected.push(projects[i].id);}",
 "   if(cost<=budget&&benefit>best.total_benefit)best={selected,total_cost:cost,total_benefit:benefit};",
 " }",
 " return best;",
 "}",
 "globalThis.selectProjects=selectProjects;"
].join('\n');
const defect='if(budget===0)return {selected:[],total_cost:0,total_benefit:0};';
const resultFile=JSON.stringify({optimal:{selected:['A','C'],total_cost:10,total_benefit:46},baseline:{selected:['A','B'],total_cost:9,total_benefit:44}});
test('early locked oracle carries the exact zero-budget counterexample',async()=>{
 const w=create(question);w.backend=true;w.advanced=true;w.verifyBehavior=true;w.taskKind='build';w.write('solver.js',broken);
 w.verification={trusted:true,suite:[projectPropertyTest(w)],passed:false,key:null,results:[]};
 await executeSuite(w);
 assert.equal(currentTrustedFailure(w),true);
 const err=w.verification.results[0].error;
 assert.match(err,/"budget":0/);assert.match(err,/"expectedBenefit":23/);
 assert.match(err,/Nonoptimal result/);
});
test('agent corrects code before generating missing JSON and proceeds to checked finish',async()=>{
 const w=create(question);const roles=[],offered=[],timeline=[];
 let repairCount=0,workCount=0;
 const contract={objective:'Solve 0/1 selection',assumptions:[],approach_a:'Enumerate 2^n subsets',approach_b:'Dynamic programming',choice:'Exhaustive for n<=12',deliverables:['solver.js','resultat.json'],criteria:['Select optimum even if budget 0 with free project','Report correct greedy comparison'],steps:['Write code','Test code','Write JSON']};
 const action=(name,args)=>({kind:'actions',actions:[{tool:name,args}]});
 const ai={provider:'backend',calls:0,lastModel:'mock',async ask(_messages,_signal,_max,tools){
  this.calls++;roles.push(this.role);offered.push(tools?.map(t=>t.function.name)||[]);timeline.push([...w.files].map(([k,v])=>k+'@'+v.version));
  if(this.role==='architect')return{model:'mock',text:JSON.stringify(contract)};
  if(this.role==='repair'){repairCount++;assert.ok(tools.every(t=>['write_file','edit_file','patch_files','append_file'].includes(t.function.name)));return{model:'mock',text:JSON.stringify(action('edit_file',{name:'solver.js',expected_version:1,find:defect,replace:''}))};}
  if(this.role==='work'){workCount++;return{model:'mock',text:JSON.stringify(workCount===1?action('write_file',{name:'solver.js',content:broken}):action('write_file',{name:'resultat.json',content:resultFile}))};}
  if(this.role==='synthesis')return{model:'mock',text:JSON.stringify({kind:'final',answer:'Optimal A+C ger nytta 46 vid kostnad 10; girig kvot A+B ger 44 vid kostnad 9. Girig metod missar en bättre kombination.'})};
  if(this.role==='critic')return{model:'mock',text:JSON.stringify({verdict:'pass',answer:'Aktuell kod och numerisk jämförelse stöds.',issues:[],checks:[
   {id:'C1',status:'pass',finding:'Oberoende optimala kantfall har körts.',evidence:['file:solver.js@v2']},
   {id:'C2',status:'pass',finding:'Beräkningarna 46 och 44 finns i aktuell JSON.',evidence:['file:resultat.json@v1']}
  ],answer_check:{status:'pass',finding:'Slutsvaret jämför faktiskt 46 och 44.',evidence:['file:resultat.json@v1']}})};
  throw Error('Unexpected role: '+this.role);
 }};
 const out=await runAgent({question,ai,space:w,signal:w.signal,advanced:true,review:true,mode:'build',verifyBehavior:true,maxSteps:12});
 assert.equal(out.unfinished,false,JSON.stringify({issues:out.issues,roles,trace:w.trace.slice(-8)}));
 assert.equal(out.reviewPassed,true);
 assert.equal(repairCount,1);
 assert.deepEqual(roles,['architect','work','repair','work','synthesis','critic']);
 assert.equal(w.files.get('solver.js').version,2);
 assert.ok(timeline[2].includes('solver.js@1')&&!timeline[2].includes('resultat.json@1'));
 assert.ok(w.trace.some(e=>e.type==='repair_focus'));
 assert.equal(currentTrustedPass(w),true);
 assert.equal(w.verification.executions,3);
 assert.ok(w.audit.some(e=>e.testId==='V8'&&e.data?.passed===false));
 assert.ok(w.audit.some(e=>e.testId==='V8'&&e.data?.passed===true));
});
test('current trusted browser proof overrides stale manual test while code edits invalidate it',()=>{
 const w=create('Bygg en minimal FPS med riktiga browserkontroller');w.backend=true;w.advanced=true;w.taskKind='build';
 w.write('index.html','<!doctype html><canvas></canvas><script src="logic.js"></script><script src="game.js"></script>');
 w.write('logic.js','globalThis.gameState={x:2.5,y:2.5,angle:0,score:0};function moveForward(){globalThis.gameState.x++;}function resetGame(){globalThis.gameState.x=2.5;}');
 w.write('game.js',"document.addEventListener('keydown',function(event){if(event.key==='w')moveForward();});function render(){requestAnimationFrame(render)}render();");
 w.strategy={objective:'Browser FPS',choice:'Canvas',deliverables:['index.html','logic.js','game.js'],criteria:[]};
 for(const n of ['index.html','logic.js','game.js'])w.expectedNames.add(n);
 w.audit.push({id:'T1',tool:'test_js',args:{name:'game.js'},ok:true,data:{passed:false,file:'game.js',version:1,versions:[{name:'game.js',version:1}],error:'document is not defined'}});
 w.verification={suite:[{id:'V9',kind:'page',page:'index.html',files:[],code:'assert(true);assert(true);'}],trusted:true,passed:true,key:artifactKey(w),results:[{id:'V9',passed:true}],executions:1};
 assert.equal(currentTrustedPass(w),true);
 assert.deepEqual(completionIssues(w),[]);
 assert.deepEqual(qualityIssues(w),[]);
 w.write('logic.js',w.files.get('logic.js').content+'\n// invalidates proof');
 assert.equal(currentTrustedPass(w),false);
 assert.ok(completionIssues(w).length>0);
 assert.ok(qualityIssues(w).length>0);
});
test('passing trusted FPS browser suite moves directly to synthesis and critic',async()=>{
 const question='Bygg FPS spel med index.html logic.js game.js, W/S, A/D, window.gameState, window.resetGame';
 const w=create(question);
 w.write('index.html','<!doctype html><canvas id="c"></canvas><script src="logic.js"></script><script src="game.js"></script>');
 w.write('logic.js','globalThis.gameState={x:2.5,y:2.5,angle:0,score:0};function resetGame(){globalThis.gameState.x=2.5;}function shoot(){globalThis.gameState.score=10;}');
 w.write('game.js',"window.addEventListener('keydown',e=>{if(e.key===' ')shoot()});const c=document.getElementById('c');c.getContext('2d').fillRect(0,0,12,12);");
 w.backend=true;w.advanced=true;w.taskKind='build';
 w.strategy={objective:'FPS starter',choice:'Canvas',criteria:[{id:'C1',requirement:'Playable input'}],deliverables:['index.html','logic.js','game.js']};
 for(const n of ['index.html','logic.js','game.js'])w.expectedNames.add(n);
 w.audit.push({id:'T1',tool:'test_js',args:{name:'game.js'},ok:true,data:{passed:false,file:'game.js',versions:[{name:'game.js',version:1}],error:'document is not defined'}});
 w.pendingIssues.push('TEST: game.js: document is not defined');
 w.verification={suite:[{id:'V9',kind:'page',page:'index.html',files:[],code:'assert(true);assert(true);'}],trusted:true,passed:true,key:artifactKey(w),results:[{id:'V9',requirement:'input',passed:true}],executions:1};
 const roles=[];const ai={provider:'backend',calls:0,lastModel:'mock',async ask(_messages,_signal,_max,tools){
  this.calls++;roles.push(this.role);
  if(this.role==='synthesis'){assert.deepEqual(tools.map(t=>t.function.name),['finish']);return{model:'mock',text:JSON.stringify({kind:'final',answer:'Levererade HTML och JS. Browserbeteende testat av låst svit.'})};}
  if(this.role==='critic')return{model:'mock',text:JSON.stringify({verdict:'pass',answer:'Kontrollerat',issues:[],checks:[{id:'C1',status:'pass',finding:'Aktuell filversion har oberoende testbevis.',evidence:['file:index.html@v1']}],answer_check:{status:'pass',finding:'Slutsvaret anger endast testat beteende.',evidence:['file:index.html@v1']}})};
  throw Error('Agent must not self-test after proof: '+this.role);
 }};
 const out=await runAgent({question,ai,space:w,signal:w.signal,advanced:true,review:true,mode:'build',verifyBehavior:true,maxSteps:5});
 assert.equal(out.unfinished,false,JSON.stringify(out.issues));
 assert.deepEqual(roles,['synthesis','critic']);
 assert.equal(w.files.get('game.js').version,1);
});
