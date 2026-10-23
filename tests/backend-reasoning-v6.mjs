// Small, explicitly scoped live reasoning benchmark. No model-generated assertions.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='https://dzjjffgohxeoahtflqjo.supabase.co/functions/v1/jesp-gateway';
const model='nvidia/nemotron-3-ultra-550b-a55b:free';
const dir='reasoning-v6-evidence';mkdirSync(dir,{recursive:true});
const tasks=[
 {name:'precedence-constrained scheduling',prompt:'Schedule six indivisible tasks on two identical workers, one worker per task, no preemption. Durations: A=3,B=4,C=2,D=5,E=2,F=4. Dependencies: D requires A and B; E requires C; F requires D and E. Minimize makespan starting at time 0. Return only JSON {makespan:number,schedule:[{task,start,end,worker:1 or 2}],lower_bound:number,reason:string}. Include every task exactly once.',verify(j){
  assert.equal(j.makespan,13);assert.equal(j.lower_bound,13);assert.equal(j.schedule.length,6);
  const times={A:3,B:4,C:2,D:5,E:2,F:4};const seen=new Set();const s={};
  for(const x of j.schedule){assert.ok(times[x.task]&&!seen.has(x.task));seen.add(x.task);assert.ok([1,2].includes(x.worker));assert.ok(Number.isFinite(x.start)&&x.start>=0);assert.equal(x.end-x.start,times[x.task]);s[x.task]=x;}
  for(const [after,before] of [['D','A'],['D','B'],['E','C'],['F','D'],['F','E']])assert.ok(s[after].start>=s[before].end);
  for(const x of j.schedule)for(const y of j.schedule)if(x!==y&&x.worker===y.worker)assert.ok(x.end<=y.start||y.end<=x.start);
  assert.equal(Math.max(...j.schedule.map(x=>x.end)),13);
 }},
 {name:'base-rate reasoning, not sensitivity confusion',prompt:'A hypothetical factory has 10000 items. Exactly 1% are defective. A screening process flags 99% of defective items and 5% of non-defective items. Someone says that a flagged item has 99% probability of being defective. Use expected counts; these are exact assumptions, not real-world measurements. Return JSON only {true_positives:number,false_positives:number,probability_defective_given_flag:number,claim_correct:boolean,explanation:string}.',verify(j){assert.equal(j.true_positives,99);assert.equal(j.false_positives,495);assert.ok(Math.abs(j.probability_defective_given_flag-1/6)<0.00001);assert.equal(j.claim_correct,false);}},
 {name:'discrete optimization with independently checked optimum',prompt:'Choose each project at most once. Costs/benefits: A=(6,30), B=(3,14), C=(4,16), D=(2,9). Total budget 10, projects cannot be split. Return JSON only {selected:[IDs],total_cost:number,total_benefit:number,reason:string}. Maximize total benefit, not benefit per cost greedily.',verify(j){
  const projects={A:[6,30],B:[3,14],C:[4,16],D:[2,9]};assert.equal(new Set(j.selected).size,j.selected.length);assert.ok(j.selected.every(x=>projects[x]));
  const cost=j.selected.reduce((n,k)=>n+projects[k][0],0),benefit=j.selected.reduce((n,k)=>n+projects[k][1],0);
  let optimum=0;const ids=Object.keys(projects);for(let mask=0;mask<16;mask++){let c=0,v=0;for(let k=0;k<4;k++)if(mask&(1<<k)){c+=projects[ids[k]][0];v+=projects[ids[k]][1];}if(c<=10)optimum=Math.max(optimum,v);}
  assert.ok(cost<=10);assert.equal(j.total_cost,cost);assert.equal(j.total_benefit,benefit);assert.equal(benefit,optimum);
 }}
];
const report={at:new Date().toISOString(),mockedAI:false,authenticated:false,scope:'Three reasoning tasks only; not a general-intelligence or uptime guarantee',results:[]};
for(const task of tasks){
 const start=Date.now();let data;
 try{
  const r=await fetch(base+'/chat',{method:'POST',headers:{Origin:'https://capstere.github.io','Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:task.prompt}],max_tokens:6144,reasoning:'medium'}),signal:AbortSignal.timeout(125000)});
  data=await r.json();assert.equal(r.status,200,JSON.stringify(data));
  const content=data.choices?.[0]?.message?.content;assert.equal(data.choices?.[0]?.finish_reason,'stop');
  const answer=JSON.parse(String(content).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));task.verify(answer);
  report.results.push({name:task.name,passed:true,model:data.model,usage:data.usage,answer,ms:Date.now()-start});
 }catch(e){report.results.push({name:task.name,passed:false,error:e.message,response:data,ms:Date.now()-start});}
}
writeFileSync(dir+'/result.json',JSON.stringify(report,null,2));console.log('REASONING_RESULT '+JSON.stringify(report));
if(report.results.some(x=>!x.passed))process.exitCode=1;
