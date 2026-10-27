// Browser-only live task; generated code runs only through executeJS's isolated sandbox.
export async function runIntervalTask(){
 const {AI,Workspace,runAgent}=await import('../agents/core.mjs?v=6.5.0');
 const {executeJS}=await import('../agents/sandbox.mjs?v=5.2.0');
 const {ADVICE_TOOL,decodeAdvice,expertContext}=await import('../agents/agent-boost.mjs?v=6.5.0');
 const {requestSpecialist}=await import('../agents/specialist-request.mjs?v=6.5.0');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(new DOMException('Test deadline','AbortError')),660000);
 const ai=new AI({provider:'backend',workerModel:document.getElementById('workerModel').value,criticModel:document.getElementById('criticModel').value,reasoning:'auto'});
 const question='Reparera intervals.js. Funktionen mergeIntervals(intervals) tar en array av halvöppna intervall [start,end) med ändliga tal och start < end. Returnera nya sorterade intervall med alla verkliga överlapp sammanslagna. Intilliggande intervall [1,2) och [2,3) ska INTE slås ihop. Ändra aldrig indata. Tom array ger []. Kasta Error vid ogiltig indata, fel längd, strängtal, NaN, Infinity eller start >= end. Leverera intervals.js och ett kort korrekt slutsvar. Behåll befintliga tester.';
 const w=new Workspace({question,signal:ctl.signal,web:false,allowCode:true,execute:executeJS});
 const seed='// Initial buggy implementation: sorting alone does not fulfill the specified interval union contract.\nfunction mergeIntervals(intervals){return intervals.sort((a,b)=>a[0]-b[0]);}';
 w.write('intervals.js',seed);w.expectedNames.add('intervals.js');
 w.strategy={objective:'Repair interval union without input mutation',assumptions:[],alternatives:['Sorted sweep','Overlap components'],choice:'Sorted sweep over copied inputs',deliverables:['intervals.js'],criteria:[{id:'C1',requirement:'Merge overlaps but not adjacency; handle empty and nested intervals.'},{id:'C2',requirement:'Reject invalid values and never mutate input.'}],steps:['Repair code','Run unchanged tests','Review']};
 const suite=[
 {id:'V1',kind:'js',files:['intervals.js'],requirement:'Correct union, nested and adjacent intervals',code:"assert.deepEqual(mergeIntervals([]),[]);assert.deepEqual(mergeIntervals([[2,5],[1,4]]),[[1,5]]);assert.deepEqual(mergeIntervals([[1,2],[2,3]]),[[1,2],[2,3]]);assert.deepEqual(mergeIntervals([[1,9],[3,4],[8,12]]),[[1,12]]);"},
 {id:'V2',kind:'js',files:['intervals.js'],requirement:'Input is copied and every invalid input throws',code:"const input=[[4,6],[1,3]],before=JSON.stringify(input);assert.deepEqual(mergeIntervals(input),[[1,3],[4,6]]);assert.equal(JSON.stringify(input),before);for(const bad of [null,{},[[1,1]],[[2,1]],[[0,Infinity]],[[NaN,2]],[['1',2]],[[1,2,3]]])assert.throws(()=>mergeIntervals(bad));"}];
 w.verification={suite:Object.freeze(suite.map(Object.freeze)),trusted:false,passed:false,key:null,results:[],executions:0};
 try{
  const outcome=await runAgent({question,space:w,ai,signal:ctl.signal,maxSteps:14,advanced:true,review:true,mode:'build',verifyBehavior:true,expertAssist:true});
  const external=await w.tool('test_js',{name:'intervals.js',code:"function reference(xs){let a=xs.map(x=>x.slice()),changed=true;while(changed){changed=false;outer:for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i][0]<a[j][1]&&a[j][0]<a[i][1]){a[i]=[Math.min(a[i][0],a[j][0]),Math.max(a[i][1],a[j][1])];a.splice(j,1);changed=true;break outer;}}return a.sort((x,y)=>x[0]-y[0]);}let seed=84631;const next=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};for(let k=0;k<40;k++){const xs=Array.from({length:next()%9},()=>{const s=(next()%24)-12;return[s,s+1+next()%7];});const before=JSON.stringify(xs);assert.deepEqual(mergeIntervals(xs),reference(xs));assert.equal(JSON.stringify(xs),before);}const xs=[[3,8],[1,2]],ys=mergeIntervals(xs);ys[0][0]=-999;assert.equal(xs[1][0],1);"});
  const sample=new Workspace({question,signal:ctl.signal,web:false,allowCode:false});sample.write('intervals.js',seed);sample.pendingIssues=['Overlapping intervals remain separate and input is mutated.'];
  let specialist;
  try{
   const response=await requestSpecialist({ai,signal:ctl.signal,context:expertContext(sample),tool:ADVICE_TOOL,decode:t=>decodeAdvice(t,sample)});
   specialist={model:response.model,advice:response.advice,attempts:response.attempts,sourceUnchanged:sample.files.get('intervals.js').content===seed};
  }catch(e){specialist={error:String(e.message||e),attempts:e.adviceAttempts||[]};}
  return {unfinished:outcome.unfinished,reviewPassed:outcome.reviewPassed,answer:outcome.answer,issues:outcome.issues,external,specialist,files:outcome.files,trace:w.trace,audit:w.audit,expertReports:w.expertReports,calls:ai.calls};
 }catch(e){return {unfinished:true,error:String(e.message||e),trace:w.trace,audit:w.audit,files:[...w.files.values()]};}
 finally{clearTimeout(timer);}
}
