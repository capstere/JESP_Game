import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace,runAgent,filename} from '../agents/core.mjs';
import {taskKind,normalizeStrategy,qualityIssues,reviewCheckIssues,projectCheck,editingDefinitions} from '../agents/quality.mjs';
const signal=()=>new AbortController().signal;
const workspace=(question='Bygg ett spel')=>{const w=new Workspace({signal:signal(),question,web:false});w.advanced=true;w.taskKind=taskKind(question);return w;};
const strategy={objective:'Körbar app',assumptions:['Webbläsare, inga paket'],alternatives:['Canvas: liten och fristående','WebGL: mer komplex'],choice:'Canvas för minsta körbara prototyp',deliverables:['index.html','logic.js'],criteria:['Innehåller körbar kod med användarinput','Logiken klarar kantfall'],steps:['Bygg logik','Bygg UI','Testa och rätta']};
const apply=w=>{w.strategy=normalizeStrategy(strategy,w,filename);w.strategy.deliverables.forEach(n=>w.expectedNames.add(n));};
for(const [q,kind] of [['Bygg ett FPS-spel','build'],['Gör en plan för ett FPS-spel','plan'],['Skapa en konkret plan för en app','plan'],['Bygg en app, inte bara en plan','build'],['Sök i officiella källor','research'],['Pröva påståendet att 2+2 är 5','analyse'],['Write a plan for a game','plan'],['Create a playable game, not a plan','build']])test('intent: '+q,()=>assert.equal(taskKind(q),kind));
test('explicit intent can override ambiguous auto classification',()=>assert.equal(taskKind('Plan för ett spel','build'),'build'));
test('strategy cannot downgrade a build to Markdown',()=>{const w=workspace();assert.throws(()=>normalizeStrategy({...strategy,deliverables:['plan.md']},w,filename),/kodfiler/);});
test('strategy preserves user-named outputs',()=>{const w=workspace('Bygg en app och skapa app.html');const s=normalizeStrategy(strategy,w,filename);assert.ok(s.deliverables.includes('app.html'));});
test('strategy rejects unsafe paths',()=>assert.throws(()=>normalizeStrategy({...strategy,deliverables:['../bad.js']},workspace(),filename)));
test('strategy needs two alternatives',()=>assert.throws(()=>normalizeStrategy({...strategy,alternatives:['x']},workspace(),filename)));
test('append and unique edit require current versions',async()=>{const w=workspace();w.write('logic.js','const x = 1;\n');await w.tool('append_file',{name:'logic.js',expected_version:1,content:'const y=2;\n'});assert.equal(w.files.get('logic.js').version,2);await assert.rejects(w.tool('edit_file',{name:'logic.js',expected_version:1,find:'1',replace:'3'}),/Versionskonflikt/);await w.tool('edit_file',{name:'logic.js',expected_version:2,find:'x = 1',replace:'x = 3'});assert.match(w.files.get('logic.js').content,/x = 3/);});
test('ambiguous replacement leaves file untouched',async()=>{const w=workspace();w.write('a.js','foo foo');await assert.rejects(w.tool('edit_file',{name:'a.js',expected_version:1,find:'foo',replace:'bar'}),/EN gång/);assert.equal(w.files.get('a.js').version,1);});
test('append honors existing byte limits',async()=>{const w=workspace();w.write('a.js','a'.repeat(99999));await assert.rejects(w.tool('append_file',{name:'a.js',expected_version:1,content:'bb'}));assert.equal(w.files.get('a.js').bytes,99999);});
test('ranged reads expose current version and line boundaries',async()=>{const w=workspace();w.write('a.js','a\nb\nc');const r=await w.tool('read_file',{name:'a.js',start_line:2,end_line:3});assert.equal(r.content,'b\nc');assert.equal(r.version,1);await assert.rejects(w.tool('read_file',{name:'a.js',start_line:0}));});
test('static project check catches missing local scripts',()=>{const w=workspace();w.write('index.html','<!doctype html><canvas></canvas><script src="./logic.js"></script>');assert.match(projectCheck(w).issues.join(' '),/logic.js/);w.write('logic.js','let x=1;');assert.equal(projectCheck(w).passed,true);});
test('a saved plan is not a build',()=>{const w=workspace();apply(w);w.write('fps_plan.md','Välj motor. Bygg och testa.');assert.ok(qualityIssues(w).some(x=>x.includes('implementation')));});
test('empty reviewer approval is rejected',()=>{const w=workspace();apply(w);assert.equal(reviewCheckIssues({verdict:'pass',issues:[]},w).length,2);});
test('stale and invented review evidence is rejected',()=>{const w=workspace();apply(w);w.write('logic.js','abc');const c=id=>({id,status:'pass',finding:'Present',evidence:['file:logic.js@v9']});assert.equal(reviewCheckIssues({checks:[c('C1'),c('C2')]},w).length,2);});
test('actual evidence references accepted without claiming semantic proof',()=>{const w=workspace();apply(w);w.write('logic.js','abc');const c=id=>({id,status:'pass',finding:'A function exists in file.',evidence:['file:logic.js@v1']});assert.deepEqual(reviewCheckIssues({checks:[c('C1'),c('C2')]},w),[]);});
test('code permissions cannot be enabled by model arguments',async()=>{const w=workspace();await assert.rejects(w.tool('test_js',{name:'a.js',code:'assert(true)'}),/godkännande/);});
test('unasserted or stale tests do not satisfy build gate',()=>{const w=workspace();apply(w);w.allowCode=true;w.write('index.html','<html><body><button id="x">Run</button><script src="logic.js"></script></body></html>');w.write('logic.js','function move(x){return x+1;}\n'.repeat(5));w.audit.push({tool:'test_js',ok:true,data:{passed:true,assertions:0,versions:[{name:'logic.js',version:1}]}});assert.ok(qualityIssues(w).some(x=>x.includes('assertions')));w.audit.at(-1).data.assertions=2;assert.deepEqual(qualityIssues(w),[]);w.write('logic.js',w.files.get('logic.js').content+'\n//changed');assert.ok(qualityIssues(w).some(x=>x.includes('assertions')));});
test('full advanced flow blocks plan-only and rubber-stamp review',async()=>{
 const question='Bygg en liten app';const w=workspace(question);
 const replies=[strategy,{kind:'actions',actions:[{tool:'write_file',args:{name:'plan.md',content:'Bygg och testa'}}]},{kind:'final',answer:'Klar'},
 {kind:'actions',actions:[{tool:'write_file',args:{name:'logic.js',content:'function add(a,b){return a+b;} // A simple testable implementation.'}},{tool:'write_file',args:{name:'index.html',content:'<!doctype html><html><body><button onclick="document.body.dataset.sum=add(2,3)">Test</button><script src="logic.js"></script></body></html>'}}]},
 {kind:'final',answer:'Kod finns; ej runtime-testad.'},{verdict:'pass',answer:'Fin',issues:[]},{kind:'final',answer:'Kod finns; ej runtime-testad.'},
 {verdict:'pass',answer:'Statisk kodgranskning, inte runtime-test.',issues:[],checks:['C1','C2'].map(id=>({id,status:'pass',finding:'Kodens funktion och input är läsbara. Endast statisk bedömning.',evidence:['file:index.html@v1','file:logic.js@v1']}))}];
 const ai={calls:0,lastModel:'MOCK',async ask(){this.calls++;return {text:JSON.stringify(replies.shift()),model:'MOCK'};}};
 const r=await runAgent({question,space:w,ai,signal:signal(),advanced:true,maxSteps:12});
 assert.equal(r.unfinished,false);assert.equal(r.calls,8);assert.equal(w.reviews.length,2);assert.ok(w.reviews[0].issues.length);assert.ok(w.trace.some(e=>e.type==='finish_blocked'));assert.equal(w.files.has('index.html'),true);
});

test('DOM-free requested logic rejects browser globals and allows portable globalThis',()=>{
 const w=workspace('Bygg en prototyp: Skilj DOM-fri logik i logic.js från rendering i game.js.');
 w.write('logic.js','window.gameState={x:1}; document.addEventListener("keydown",()=>{});');
 assert.match(projectCheck(w).issues.join(' '),/DOM-fri logik/);
 w.write('logic.js','globalThis.gameState={x:1}; function move(){globalThis.gameState.x++;}');
 assert.deepEqual(projectCheck(w).issues,[]);
});
test('explicit keyboard controls require case-insensitive event key matching',()=>{
 const w=workspace('Bygg ett FPS-spel där W/S flyttar och A/D roterar.');
 w.write('game.js',`window.addEventListener('keydown',event=>{if(event.key==='W')move();});`);
 assert.match(projectCheck(w).issues.join(' '),/Tangentinput/);
 w.write('game.js',`window.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='w')move();});`);
 assert.deepEqual(projectCheck(w).issues,[]);
});
test('browser dependent logic permitted unless explicitly required to be DOM-free',()=>{
 const w=workspace('Bygg en webbsida');w.write('logic.js','window.gameState={};');
 assert.deepEqual(projectCheck(w).issues,[]);
});

test('FPS scaffold creates three safe files only for FPS build task',async()=>{
 const w=workspace('Bygg FPS. Skilj DOM-fri logik i logic.js och W/S, A/D input.');
 assert.ok(editingDefinitions(w).some(t=>t.function.name==='scaffold_fps'));
 const result=await w.tool('scaffold_fps',{});
 assert.equal(result.template,'audited-fps-v1');
 assert.deepEqual(result.files.map(f=>f.name).sort(),['game.js','index.html','logic.js']);
 assert.equal(projectCheck(w).passed,true,projectCheck(w).issues.join('; '));
 assert.match(w.files.get('logic.js').content,/targetVisible/);
 await assert.rejects(w.tool('scaffold_fps',{}),/får inte ersätta/);
 const other=workspace('Bygg en hemsida');
 assert.equal(editingDefinitions(other).some(t=>t.function.name==='scaffold_fps'),false);
 await assert.rejects(other.tool('scaffold_fps',{}),/enbart/);
});

test('FPS project preflight rejects reset teleportation away from the initial target',()=>{
 const w=workspace('Bygg FPS med window.gameState och window.resetGame samt synligt mål rakt fram från start.');
 w.write('logic.js','const START={x:2.5,y:2.5,angle:0};const gameState={x:START.x,y:START.y};function resetGame(){gameState.x=0;gameState.y=0;}');
 assert.match(projectCheck(w).issues.join(' '),/START.x/);
 w.write('logic.js','const START={x:2.5,y:2.5,angle:0};const gameState={x:START.x,y:START.y};function resetGame(){gameState.x=START.x;gameState.y=START.y;}');
 assert.deepEqual(projectCheck(w).issues,[]);
});
