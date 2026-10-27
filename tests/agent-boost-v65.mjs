import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace,withExpertSupport,decodeAdvice,encodeCheckpoint,decodeCheckpoint,restoreCheckpoint,expertContext} from '../agents/agent-boost.mjs';
const signal=()=>new AbortController().signal;
const setup=()=>{const w=new Workspace({signal:signal(),question:'Fixa intervallkod',web:false,allowCode:true});w.write('merge.js','function merge(a){return a;}\n// Overlap handling');w.pendingIssues=['TEST: overlapping intervals are not merged'];return w;};
const advice={diagnosis:'Sorteringen saknar sammanslagning av överlapp.',evidence:['file:merge.js@v1'],changes:[{file:'merge.js',change:'Sammanfoga bara överlappande intervall efter sortering.'}],tests:['Prova [1,4] och [2,5].']};
test('literal workspace search exposes current lines and never uses regex',async()=>{
 const w=setup();const r=await w.tool('search_files',{query:'OVERLAP'});assert.equal(r.matches[0].line,2);assert.equal(r.matches[0].version,1);
 assert.equal((await w.tool('search_files',{query:'.*'})).total,0);await assert.rejects(w.tool('search_files',{query:''}));
 w.write('many.txt','value\n'.repeat(100));const many=await w.tool('search_files',{query:'value'});assert.equal(many.total,100);assert.equal(many.matches.length,30);assert.equal(many.truncated,true);
});
test('advice rejects fabricated evidence, unknown files and executable tool actions',()=>{
 const w=setup();assert.deepEqual(decodeAdvice(JSON.stringify(advice),w),{...advice,advisory:true});
 assert.throws(()=>decodeAdvice(JSON.stringify({...advice,evidence:['file:merge.js@v999']}),w));
 assert.throws(()=>decodeAdvice(JSON.stringify({...advice,changes:[{file:'other.js',change:'Replace'}]}),w));
 assert.throws(()=>decodeAdvice(JSON.stringify({kind:'actions',actions:[{tool:'write_file',args:advice}]}),w));
});
test('second unchanged failure obtains one bounded read-only consultation and feeds worker evidence',async()=>{
 const w=setup();const seen=[];
 const ai={provider:'backend',criticModel:'strong:free',calls:0,role:'repair',async ask(messages,_s,_n,tools){
  this.calls++;seen.push({role:this.role,messages,tools});
  return {model:'strong:free',text:JSON.stringify(tools?.[0]?.function?.name==='submit_advice'?{kind:'actions',actions:[{tool:'submit_advice',args:advice}]}:{kind:'final',answer:'work'})};
 }};
 const original=ai.ask,files=JSON.stringify([...w.files]);
 await withExpertSupport({ai,space:w,signal:w.signal,expertAssist:true},async()=>{for(let i=0;i<5;i++){ai.role='repair';await ai.ask([{role:'user',content:'Fix'}],w.signal,4000,[]);}});
 assert.equal(ai.calls,6);assert.equal(ai.ask,original);assert.equal(w.expertReports.length,1);
 assert.equal(JSON.stringify([...w.files]),files,'specialist must not write anything');assert.equal(w.expertReports[0].advisory,true);
 assert.equal(seen.filter(x=>x.tools?.[0]?.function?.name==='submit_advice').length,1);
 assert.ok(seen.at(-1).messages.some(x=>x.content.includes('LÄSANDE SPECIALISTFÖRSLAG')));assert.ok(w.trace.some(x=>x.type==='expert_end'));
});
test('free quota denial is never ignored or bypassed by consulting another provider',async()=>{
 const w=setup();const ai={provider:'backend',role:'repair',calls:0,async ask(_m,_s,_n,t){this.calls++;if(t?.[0]?.function?.name==='submit_advice'){const e=new Error('quota');e.status=429;throw e;}return {text:'{}'};}};
 const old=ai.ask;
 await assert.rejects(withExpertSupport({ai,space:w,signal:w.signal,expertAssist:true},async()=>{await ai.ask([],w.signal,4000,[]);await ai.ask([],w.signal,4000,[]);}),e=>e.status===429);
 assert.equal(ai.ask,old);assert.equal(ai.calls,2);
});
test('maximum two consultations, no hidden extra calls when feature is disabled',async()=>{
 const w=setup();let consultations=0;const ai={provider:'backend',role:'repair',calls:0,async ask(_m,_s,_n,t){this.calls++;if(t?.[0]?.function?.name==='submit_advice'){consultations++;return{text:JSON.stringify(advice)};}return{text:'{}'};}};
 const run=async()=>{for(let j=0;j<5;j++){w.pendingIssues=['Different issue '+j];for(let i=0;i<3;i++){ai.role='repair';await ai.ask([],w.signal,4000,[]);}}};
 await withExpertSupport({ai,space:w,signal:w.signal,expertAssist:true},run);assert.equal(consultations,2);
 consultations=0;await withExpertSupport({ai,space:w,signal:w.signal,expertAssist:false},run);assert.equal(consultations,0);
});
test('search is never offered when trusted failure restricts tools to edits',async()=>{
 const w=setup();let seen;const ai={provider:'backend',role:'repair',async ask(_m,_s,_n,t){seen=t;return{text:'{}'};}};
 await withExpertSupport({ai,space:w},()=>ai.ask([],w.signal,4000,[{function:{name:'edit_file'}}]));assert.deepEqual(seen.map(t=>t.function.name),['edit_file']);
 await withExpertSupport({ai,space:w},()=>ai.ask([],w.signal,4000,[{function:{name:'read_file'}}]));assert.deepEqual(seen.map(t=>t.function.name),['read_file','search_files']);
});
test('new file version invalidates specialist advice attachment',async()=>{
 const w=setup();w.expertReports=[{...advice,basedOn:JSON.stringify([['merge.js',1]])}];w.write('merge.js','changed');let messages;
 const ai={provider:'backend',role:'repair',async ask(m){messages=m;return{text:'{}'};}};
 await withExpertSupport({ai,space:w,expertAssist:true},()=>ai.ask([],w.signal,4000,[]));assert.equal(messages.length,0);
});
test('checkpoints round-trip source but do not import permissions or success claims',()=>{
 const w=setup();w.strategy={criteria:[]};w.verification={passed:true};w.reviewPassed=true;
 const raw=JSON.parse(encodeCheckpoint(w,w.question));raw.allowCode=true;raw.web=true;raw.verification={passed:true};raw.strategy={criteria:[]};raw.reviewPassed=true;
 const restored=restoreCheckpoint(JSON.stringify(raw),{signal:signal(),allowCode:true,web:true});
 assert.equal(restored.space.files.get('merge.js').content,w.files.get('merge.js').content);
 assert.equal(restored.space.allowCode,false);assert.equal(restored.space.web,false);assert.equal(restored.space.verification,undefined);assert.ok(!restored.space.strategy);
 assert.equal(restored.space.audit.length,0);assert.equal(restored.space.reviews.length,0);assert.ok(restored.space.expectedNames.has('merge.js'));
});
test('checkpoint validation rejects bad paths, duplicates, unsupported formats and oversized files',()=>{
 const good={format:'jesp-workspace',version:1,question:'task',files:[{name:'a.js',content:'ok'}]};
 for(const bad of [{...good,files:[{name:'../a.js',content:'bad'}]},{...good,files:[good.files[0],good.files[0]]},{...good,version:2},{...good,question:''},{...good,files:[{name:'a.js',content:'a'.repeat(100001)}]}])assert.throws(()=>decodeCheckpoint(JSON.stringify(bad)));
});
test('expert context stays bounded and does not include hidden model reasoning or entire audit',()=>{
 const w=setup();for(let i=0;i<11;i++)w.write('f'+i+'.txt','a'.repeat(20000));w.trace.push({type:'hidden',secret:'nope'});
 const context=JSON.stringify(expertContext(w));assert.ok(context.length<42000);assert.ok(!context.includes('nope'));
});
