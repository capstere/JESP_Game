// Trusted exhaustive reference for validating independent tests of the explicitly
// recognized 0/1-project selection task. All other tasks are out of scope.
import {ASSERT_HARNESS} from './test-harness.mjs?v=6.1.0';
export function exhaustiveProjects(projects,budget){
  if(!Number.isFinite(budget))throw Error('Icke-finit budget');
  if(budget<0)throw Error('Negativ budget');
  if(!Array.isArray(projects)||projects.length>12)throw Error('At most 12 projects required');
  let best={selected:[],total_cost:0,total_benefit:0};
  for(let mask=0;mask<2**projects.length;mask++){
    let cost=0,benefit=0;const selected=[];
    for(let i=0;i<projects.length;i++)if(mask&(1<<i)){cost+=projects[i].cost;benefit+=projects[i].benefit;selected.push(projects[i].id);}
    if(cost<=budget&&benefit>best.total_benefit)best={selected,total_cost:cost,total_benefit:benefit};
  }
  return best;
}
export function greedyProjects(projects,budget){
  if(!Number.isFinite(budget))throw Error('Icke-finit budget');
  if(budget<0)throw Error('Negativ budget');
  const sorted=projects.map((p,i)=>({p,i})).sort((a,b)=>{
    const ar=a.p.cost===0?(a.p.benefit>0?Infinity:a.p.benefit<0?-Infinity:0):a.p.benefit/a.p.cost;
    const br=b.p.cost===0?(b.p.benefit>0?Infinity:b.p.benefit<0?-Infinity:0):b.p.benefit/b.p.cost;
    return br-ar||a.i-b.i;
  });
  let total_cost=0,total_benefit=0;const selected=[];
  for(const {p} of sorted)if(total_cost+p.cost<=budget&&p.benefit>=0){selected.push(p.id);total_cost+=p.cost;total_benefit+=p.benefit;}
  return {selected,total_cost,total_benefit};
}
export function projectSelectionFixture(question){
  if(typeof question!=='string'||!/selectProjects\s*\(/.test(question)||!/budget/i.test(question))return null;
  const matches=[...question.matchAll(/\b([A-Z])\s+kostar\s+(\d+(?:[.,]\d+)?)\s+och\s+ger\s+(\d+(?:[.,]\d+)?)(?:\s+nytta)?/gi)];
  const budget=question.match(/budgeten\s+(?:är|=)\s*(\d+(?:[.,]\d+)?)/i);
  if(matches.length<2||!budget)return {reference:true,fixture:null};
  const projects=matches.map(m=>({id:m[1].toUpperCase(),cost:Number(m[2].replace(',','.')),benefit:Number(m[3].replace(',','.'))}));
  if(projects.length>12||new Set(projects.map(p=>p.id)).size!==projects.length)return null;
  const capacity=Number(budget[1].replace(',','.'));
  return {reference:true,fixture:{projects,budget:capacity,optimal:exhaustiveProjects(projects,capacity),greedy:greedyProjects(projects,capacity)}};
}
const SOURCE=exhaustiveProjects.toString().replace('function exhaustiveProjects','function selectProjects')+'\n'+greedyProjects.toString().replace('function greedyProjects','function greedyBaseline');
export async function checkSuiteAgainstOracle(space,suite){
  const facts=projectSelectionFixture(space.question);
  if(!facts?.reference||!space.allowCode||typeof space.execute!=='function')return {applicable:false};
  let checked=0;
  for(const t of suite){
    if(t.kind!=='js'||!/\b(selectProjects|greedyBaseline)\s*\(/.test(t.code))continue;
    const script=ASSERT_HARNESS+'\n'+SOURCE+'\n'+t.code+'\nreturn {assertions:__jesp_assertions};';
    if(script.length>29000)throw Error('Referenstest för stort; gör testerna mindre.');
    let result;
    try{result=await space.execute(script,space.signal);}
    catch(e){if(space.signal?.aborted)throw space.signal.reason;result={passed:false,error:String(e.message||e)};}
    checked++;
    if(result?.passed!==true){
      const derived=facts.fixture?JSON.stringify(facts.fixture):'Härled förväntat resultat med uttömmande urval.';
      throw Error('TESTFACIT UNDERKÄNT: '+t.id+' misslyckas även mot en oberoende uttömmande 0/1-referens. Ändra TESTETS förväntan, inte implementationen. Fel: '+String(result?.error||'okänt').slice(0,220)+'. Härledda exempel: '+derived.slice(0,950));
    }
  }
  return {applicable:true,checked,fixture:facts.fixture};
}
// Generalized, deterministic property tests. The model does not write this oracle
// and its test values are computed independently, not copied from model output.
export function projectPropertyTest(space){
  if(!projectSelectionFixture(space.question)?.reference)return null;
  const file=[...space.files.values()].find(f=>/\.m?js$/i.test(f.name)&&/\b(?:function\s+selectProjects\s*\(|(?:const|let|var)\s+selectProjects\s*=)/.test(f.content));
  if(!file)return null;
  const code=[
    '{',
    'let checked=0;',
    'function checkProjectSelection(items,budget){',
    'const original=JSON.stringify(items);const r=selectProjects(items,budget);',
    "assert(r&&Array.isArray(r.selected),'Must return selected array');",
    "assert.equal(new Set(r.selected).size,r.selected.length,'Duplicate selected IDs');",
    "let c=0,b=0;for(const id of r.selected){const p=items.find(x=>x.id===id);assert(!!p,'Unknown selected ID');c+=p.cost;b+=p.benefit;}",
    'let best=0;for(let mask=0;mask<(1<<items.length);mask++){let cost=0,benefit=0;for(let i=0;i<items.length;i++)if(mask&(1<<i)){cost+=items[i].cost;benefit+=items[i].benefit;}if(cost<=budget&&benefit>best)best=benefit;}',
    "assert(c<=budget,'Budget exceeded');assert.equal(r.total_cost,c,'Incorrect cost');assert.equal(r.total_benefit,b,'Incorrect benefit');assert.equal(b,best,'Nonoptimal result');assert.equal(JSON.stringify(items),original,'Input mutated');checked++;",
    '}',
    'checkProjectSelection([],0);',
    "checkProjectSelection([{id:'FREE',cost:0,benefit:23}],0);",
    "checkProjectSelection([{id:'A',cost:6,benefit:30},{id:'B',cost:3,benefit:14},{id:'C',cost:4,benefit:16},{id:'D',cost:2,benefit:9}],10);",
    'let seed=9127;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed;}',
    "for(let n=0;n<20;n++){let ps=Array.from({length:6},(_,i)=>({id:'P'+i,cost:rand()%8,benefit:rand()%30}));checkProjectSelection(ps,rand()%19);}",
    "for(const bad of [-1,NaN,Infinity]){let threw=false;try{selectProjects([],bad);}catch{threw=true;}assert(threw,'Invalid budget accepted');}",
    "assert.equal(checked,23,'Incorrect property test count');",
    '}'
  ].join('\n');
  return Object.freeze({id:'V8',kind:'js',files:Object.freeze([file.name]),requirement:'Oberoende 0/1-facit: 23 fall inklusive kostnadsfritt projekt med nollbudget, slumpade optimala urval och ogiltig budget',code});
}
