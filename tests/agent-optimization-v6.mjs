// Real agent workflow plus independent out-of-sample assertions in the isolated worker.
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='optimization-agent-evidence';mkdirSync(dir,{recursive:true});
const origin='https://capstere.github.io/JESP_Game/';
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const requests=[],responses=[],errors=[];
await page.route(origin+'**',async route=>{const path=decodeURIComponent(new URL(route.request().url()).pathname.slice('/JESP_Game/'.length))||'index.html';if(path.includes('..')||!existsSync(path)){await route.abort();return;}await route.fulfill({status:200,contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript',body:readFileSync(path)});});
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(r.url().includes('/jesp-gateway/chat')){const b=r.postDataJSON();requests.push({model:b.model,authenticated:!!r.headers().authorization||!!r.headers().cookie,max_tokens:b.max_tokens,reasoning:b.reasoning});}});
page.on('response',async r=>{if(r.url().includes('/jesp-gateway/chat'))try{const d=await r.json();responses.push({status:r.status(),model:d.model,usage:d.usage,finish:d.choices?.[0]?.finish_reason});}catch{}});
const task=`Skapa solver.js och resultat.json. Lös ett diskret projektvalsproblem korrekt, inte med en girig kvotregel. Varje projekt får väljas högst en gång. A kostar 6 och ger 30 nytta, B kostar 3 och ger 14, C kostar 4 och ger 16, D kostar 2 och ger 9. Budgeten är 10. Maximera total nytta.
I solver.js: skriv en generell funktion selectProjects(projects, budget), där projects är en array av objekt {id,cost,benefit}. Returnera {selected:[id], total_cost, total_benefit}. Funktionen ska hitta ett optimalt urval för högst 12 projekt, hantera tom lista, budget 0, projekt med kostnad 0 och budget som inte räcker till något. Inga delade projekt och inga dubbletter i urvalet. Ändra inte indata. Negativ eller icke-finit budget ska ge ett kastat fel. Använd vanlig JavaScript utan DOM, moduler, import eller paket.
Kör minst fyra meningsfulla assertions mot den riktiga solver.js med erbjudet testverktyg. Logga beräknad lösning i testet. Skapa resultat.json med den faktiskt beräknade lösningen för A–D. Skriv ett kort svar som motiverar varför enbart nytta per kostnad inte garanterar bästa urval. Skapa inga extra rapportfiler.`;
try{
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.JESP_AGENT_BOOTED&&!document.getElementById('run').disabled,null,{timeout:45000});
 await page.locator('#settings summary').click();await page.selectOption('#provider','backend');await page.selectOption('#workerModel','nvidia/nemotron-3.5-lightning:free');await page.selectOption('#criticModel','nvidia/nemotron-3-ultra-550b-a55b:free');await page.uncheck('#web');await page.check('#code');await page.check('#advanced');await page.selectOption('#taskMode','build');await page.selectOption('#steps','18');await page.fill('#prompt',task);await page.click('#run');
 await page.waitForFunction(()=>!document.getElementById('run').disabled,null,{timeout:600000});
 const files=await page.locator('#files .file').evaluateAll(rows=>Object.fromEntries(rows.map(r=>[r.querySelector('strong').textContent,r.querySelector('pre').textContent])));
 const status=await page.locator('#status').innerText();writeFileSync(dir+'/agent.json',JSON.stringify({mockedAI:false,task,status,files,requests,responses,errors,answer:await page.locator('#answer').innerText()},null,2));
 const download=page.waitForEvent('download');await page.click('#save');await(await download).saveAs(dir+'/workspace.zip');await page.screenshot({path:dir+'/agent.png',fullPage:true});
 assert.ok(files['solver.js']&&files['resultat.json'],'Both requested files must exist');
 const solution=JSON.parse(files['resultat.json']);assert.equal(solution.total_cost,10);assert.equal(solution.total_benefit,46);assert.deepEqual([...solution.selected].sort(),['A','C']);
 const independent=await page.evaluate(async source=>{
  const {executeJS}=await import('./agents/sandbox.mjs');
  const tests=`
let checked=0;
function verify(items,budget){
 const before=JSON.stringify(items),result=selectProjects(items,budget);
 if(!result||!Array.isArray(result.selected))throw Error('Invalid return type');
 if(new Set(result.selected).size!==result.selected.length)throw Error('Duplicate project');
 let cost=0,benefit=0;for(const id of result.selected){const row=items.find(p=>p.id===id);if(!row)throw Error('Unknown ID');cost+=row.cost;benefit+=row.benefit;}
 let optimum=0;for(let mask=0;mask<(1<<items.length);mask++){let c=0,b=0;for(let i=0;i<items.length;i++)if(mask&(1<<i)){c+=items[i].cost;b+=items[i].benefit;}if(c<=budget)optimum=Math.max(optimum,b);}
 if(cost>budget||cost!==result.total_cost||benefit!==result.total_benefit||benefit!==optimum)throw Error('Nonoptimal/invalid solution: '+JSON.stringify({items,budget,result,optimum}));
 if(JSON.stringify(items)!==before)throw Error('Input mutated');checked++;
}
verify([],0);verify([],10);verify([{id:'F',cost:0,benefit:23}],0);verify([{id:'X',cost:20,benefit:100}],3);
verify([{id:'A',cost:6,benefit:30},{id:'B',cost:3,benefit:14},{id:'C',cost:4,benefit:16},{id:'D',cost:2,benefit:9}],10);
let seed=9127;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed;}
for(let round=0;round<20;round++){const items=Array.from({length:6},(_,i)=>({id:'P'+i,cost:rand()%8,benefit:rand()%30}));verify(items,rand()%19);}
for(const bad of [-1,NaN,Infinity]){let threw=false;try{selectProjects([],bad);}catch{threw=true;}if(!threw)throw Error('Invalid budget accepted');checked++;}
return {checked};`;
  return await executeJS(source+'\n;\n'+tests,new AbortController().signal);
 },files['solver.js']);
 assert.equal(independent.passed,true,JSON.stringify(independent));const parsed=JSON.parse(independent.value);assert.equal(parsed.checked,28);
 assert.ok((await page.locator('#status').getAttribute('class')).includes('success'),'Agent must complete its own evidence gates');assert.deepEqual(errors,[]);assert.ok(requests.every(r=>!r.authenticated));
 writeFileSync(dir+'/independent.json',JSON.stringify({mockedAI:false,authenticated:false,checks:parsed.checked,scope:'Four boundary cases, one requested problem, twenty unseen enumerated comparisons, three invalid-budget checks',models:[...new Set(responses.map(r=>r.model).filter(Boolean))],solution,independent,status,at:new Date().toISOString()},null,2));
 console.log('VERIFIED_AGENT_OPTIMIZATION',JSON.stringify({checks:parsed.checked,solution}));
}catch(e){writeFileSync(dir+'/failure.json',JSON.stringify({error:String(e),requests,responses,errors},null,2));try{await page.screenshot({path:dir+'/failure.png',fullPage:true});writeFileSync(dir+'/last-ui.json',JSON.stringify(await page.evaluate(()=>({status:document.getElementById('status')?.textContent,log:document.getElementById('log')?.textContent})),null,2));}catch{}throw e;}
finally{await browser.close();}
