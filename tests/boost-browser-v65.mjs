// UI fixtures are mocked. LIVE=1 additionally executes real anonymous inference and generated code in the isolated browser sandbox.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
const origin='https://capstere.github.io/JESP_Game/';
const browser=await chromium.launch({headless:true});
const evidence={live:process.env.LIVE==='1',mockedAI:process.env.LIVE!=='1',ui:false,success:false};
mkdirSync('boost-evidence',{recursive:true});
try{
 const page=await browser.newPage();const errors=[],responses=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{if(r.url().endsWith('/jesp-gateway/chat'))requests.push({authenticated:!!r.headers().authorization,model:r.postDataJSON()?.model});});
 page.on('response',async r=>{if(r.url().endsWith('/jesp-gateway/chat'))try{const j=await r.json();responses.push({status:r.status(),model:j.model,usage:j.usage,error:j.error});}catch{responses.push({status:r.status()});}});
 await page.route(origin+'**',async route=>{
  const path=decodeURIComponent(new URL(route.request().url()).pathname.slice('/JESP_Game/'.length))||'index.html';
  if(path.includes('..')||!existsSync(path))return route.abort();
  await route.fulfill({status:200,contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript',body:readFileSync(path)});
 });
 if(!evidence.live)await page.route('**/functions/v1/jesp-gateway/models',r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://capstere.github.io'},body:JSON.stringify({models:[{id:'fixture:free',supported_parameters:['tools'],pricing:{prompt:0,completion:0}}]})}));
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.JESP_AGENT_BOOTED&&!document.getElementById('run').disabled,null,{timeout:45000});
 assert.equal(await page.locator('#expertAssist').isChecked(),true);
 const checkpoint={format:'jesp-workspace',version:1,question:'Bygg app.html',allowCode:true,reviewPassed:true,files:[{name:'app.html',content:'<script>window.INJECTED=true</script><p>hello</p>'}]};
 await page.locator('#checkpointFile').setInputFiles({name:'checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(checkpoint))});
 await page.waitForFunction(()=>document.getElementById('fileCount').textContent==='1');
 assert.equal(await page.locator('#code').isChecked(),false);assert.equal(await page.locator('#web').isChecked(),false);
 assert.equal(await page.evaluate(()=>window.INJECTED),undefined);assert.equal(await page.locator('#continue').isEnabled(),true);
 const download=page.waitForEvent('download');await page.locator('#saveCheckpoint').click();const downloaded=await download;
 const saved=JSON.parse(readFileSync(await downloaded.path(),'utf8'));
 assert.deepEqual(saved.files,checkpoint.files);assert.equal(saved.reviewPassed,undefined);
 await page.locator('#checkpointFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...checkpoint,files:[{name:'../x.js',content:'bad'}]}))});
 await page.waitForFunction(()=>document.getElementById('status').className.includes('error'));
 assert.equal(await page.locator('#fileCount').innerText(),'1');assert.deepEqual(errors,[]);
 evidence.ui=true;
 if(evidence.live){
  const result=await page.evaluate(async()=>{
   const {AI,Workspace,runAgent}=await import('./agents/core.mjs?v=6.5.0');
   const {executeJS}=await import('./agents/sandbox.mjs?v=5.2.0');
   const {ADVICE_TOOL,decodeAdvice,expertContext}=await import('./agents/agent-boost.mjs?v=6.5.0');
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(new DOMException('Test deadline','AbortError')),660000);
   const ai=new AI({provider:'backend',workerModel:document.getElementById('workerModel').value,criticModel:document.getElementById('criticModel').value,reasoning:'auto'});
   const question='Reparera intervals.js. Funktionen mergeIntervals(intervals) tar en array av halvöppna intervall [start,end) med ändliga tal och start < end. Returnera nya sorterade intervall med alla verkliga överlapp sammanslagna. Intilliggande intervall [1,2) och [2,3) ska INTE slås ihop. Ändra aldrig indata. Tom array ger []. Kasta Error vid ogiltig indata, fel längd, strängtal, NaN, Infinity eller start >= end. Leverera intervals.js och ett kort korrekt slutsvar. Behåll befintliga tester.';
   const w=new Workspace({question,signal:ctl.signal,web:false,allowCode:true,execute:executeJS});
   const seed='// Initial buggy implementation: sorting alone does not fulfill the specified interval union contract.\nfunction mergeIntervals(intervals){return intervals.sort((a,b)=>a[0]-b[0]);}';
   w.write('intervals.js',seed);w.expectedNames.add('intervals.js');
   w.strategy={objective:'Repair interval union without input mutation',assumptions:[],alternatives:['Sorted sweep','Overlap components'],choice:'Sorted sweep over copied inputs',deliverables:['intervals.js'],criteria:[{id:'C1',requirement:'Merge overlaps but not adjacency; handle empty and nested intervals.'},{id:'C2',requirement:'Reject invalid values and never mutate input.'}],steps:['Repair code','Run unchanged tests','Review']};
   const suite=[
    {id:'V1',kind:'js',files:['intervals.js'],requirement:'Correct union, nested and adjacent intervals',code:"assert.deepEqual(mergeIntervals([]),[]);assert.deepEqual(mergeIntervals([[2,5],[1,4]]),[[1,5]]);assert.deepEqual(mergeIntervals([[1,2],[2,3]]),[[1,2],[2,3]]);assert.deepEqual(mergeIntervals([[1,9],[3,4],[8,12]]),[[1,12]]);"},
    {id:'V2',kind:'js',files:['intervals.js'],requirement:'Input is copied and every invalid input throws',code:"const input=[[4,6],[1,3]],before=JSON.stringify(input);assert.deepEqual(mergeIntervals(input),[[1,3],[4,6]]);assert.equal(JSON.stringify(input),before);for(const bad of [null,{},[[1,1]],[[2,1]],[[0,Infinity]],[[NaN,2]],[['1',2]],[[1,2,3]]])assert.throws(()=>mergeIntervals(bad));"}
   ];
   w.verification={suite:Object.freeze(suite.map(Object.freeze)),trusted:false,passed:false,key:null,results:[],executions:0};
   try{
    const outcome=await runAgent({question,space:w,ai,signal:ctl.signal,maxSteps:14,advanced:true,review:true,mode:'build',verifyBehavior:true,expertAssist:true});
    // A second independent oracle with unseen deterministic-random cases. Never run model code in Node or with repository credentials.
    const external=await w.tool('test_js',{name:'intervals.js',code:"function reference(xs){let a=xs.map(x=>x.slice()),changed=true;while(changed){changed=false;outer:for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i][0]<a[j][1]&&a[j][0]<a[i][1]){a[i]=[Math.min(a[i][0],a[j][0]),Math.max(a[i][1],a[j][1])];a.splice(j,1);changed=true;break outer;}}return a.sort((x,y)=>x[0]-y[0]);}let seed=84631;const next=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};for(let k=0;k<40;k++){const xs=Array.from({length:next()%9},()=>{const s=(next()%24)-12;return[s,s+1+next()%7];});const before=JSON.stringify(xs);assert.deepEqual(mergeIntervals(xs),reference(xs));assert.equal(JSON.stringify(xs),before);}const xs=[[3,8],[1,2]],ys=mergeIntervals(xs);ys[0][0]=-999;assert.equal(xs[1][0],1);"});
    // Separate genuine one-call specialist probe; does not edit any file or manufacture a passing verdict.
    const sample=new Workspace({question,signal:ctl.signal,web:false,allowCode:false});sample.write('intervals.js',seed);sample.pendingIssues=['Overlapping intervals remain separate and input is mutated.'];
    ai.role='critic';
    const response=await ai.ask([{role:'system',content:'Diagnose the supplied bug. You cannot run tools or change files. Return submit_advice with diagnosis, evidence using file:intervals.js@v1, concrete changes and suggested tests. Keep the response under 300 words.'},{role:'user',content:JSON.stringify(expertContext(sample))}],ctl.signal,2048,[ADVICE_TOOL]);
    const advice=decodeAdvice(response.text,sample);
    return {unfinished:outcome.unfinished,reviewPassed:outcome.reviewPassed,answer:outcome.answer,issues:outcome.issues,external,specialist:{model:response.model,advice,sourceUnchanged:sample.files.get('intervals.js').content===seed},files:outcome.files,trace:w.trace,audit:w.audit,expertReports:w.expertReports,calls:ai.calls};
   }finally{clearTimeout(timer);}
  });
  writeFileSync('boost-evidence/agent.json',JSON.stringify(result,null,2));
  assert.equal(result.unfinished,false,JSON.stringify(result.issues));assert.equal(result.reviewPassed,true);
  assert.equal(result.external.passed,true,JSON.stringify(result.external));assert.ok(result.external.assertions>=81);
  assert.equal(result.specialist.sourceUnchanged,true);assert.equal(result.specialist.advice.advisory,true);
  assert.ok(requests.length>0&&requests.every(x=>!x.authenticated),'No user authorization headers');
  const successful=responses.filter(x=>x.status===200);assert.ok(successful.length>0&&successful.every(x=>x.usage?.cost===0),'Every successful inference must report zero cost');
  evidence.independentAssertions=result.external.assertions;evidence.agentCompleted=true;evidence.specialistReadOnly=true;evidence.calls=result.calls;
  evidence.models=[...new Set(successful.map(x=>x.model))];evidence.requests=requests;evidence.responses=responses;
 }
 evidence.errors=errors;assert.deepEqual(errors,[]);evidence.success=true;
 console.log('JESP_BOOST_ACCEPTANCE',JSON.stringify(evidence));
}catch(e){evidence.error=String(e);throw e;}
finally{writeFileSync('boost-evidence/result.json',JSON.stringify(evidence,null,2));await browser.close();}
