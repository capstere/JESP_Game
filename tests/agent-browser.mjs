// Default: actual anonymous AI + actual search/fetch through the production agent UI.
// MOCK_AI=1: explicitly marked regression fixture, not evidence of live availability.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const root=process.env.SOURCE_ROOT||process.cwd();
const out=path.join(root,'agent-test-evidence');mkdirSync(out,{recursive:true});
const mocked=process.env.MOCK_AI==='1';
const url=process.env.BASE_URL||'http://127.0.0.1:8123/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const requests=[],responses=[],checks=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/text\.pollinations\.ai|ai-gateway\.kilo\.ai|search\.parallel\.ai|mcp\.exa\.ai/.test(r.url()))requests.push({url:r.url(),at:Date.now(),hasAuth:!!r.headers().authorization,hasCookie:!!r.headers().cookie});});
page.on('response',r=>{if(/text\.pollinations\.ai|search\.parallel\.ai|mcp\.exa\.ai/.test(r.url()))responses.push({url:r.url(),status:r.status(),at:Date.now()});});
function ok(value,label){if(!value)throw new Error(label);checks.push(label);}
try{
 if(mocked){
  const queue=[{kind:'actions',plan:['Räkna','Skapa fil','Granska'],actions:[{tool:'calculate',args:{expression:'(125*8)-175'}}]},{kind:'actions',actions:[{tool:'write_file',args:{name:'resultat.json',content:'{"result":825}'}},{tool:'inspect_file',args:{name:'resultat.json'}}]},{kind:'final',answer:'Resultatet är 825.'},{answer:'Resultatet är 825, JSON-syntax kontrollerad.',issues:[]}];
  await page.route('https://ai-gateway.kilo.ai/api/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r.request().url().endsWith('/models')?{data:[{id:'test:free',pricing:{prompt:0,completion:0}}]}:{model:'TEST-MOCK',choices:[{message:{content:JSON.stringify(queue.shift())},finish_reason:'stop'}]})}));
 }
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.JESP_AGENT_BOOTED,{}, {timeout:20000});
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no horizontal overflow');
 for(const [name,code,expected] of [['assertion','if(7*8!==56)throw Error("bad");return 56;',true],['network blocked','await fetch("https://example.com");',false],['parent unavailable','return parent.document.body;',false]]){
  const result=await page.evaluate(async code=>{const {executeJS}=await import('./agents/sandbox.mjs');return executeJS(code,new AbortController().signal);},code);
  ok(result.passed===expected,'sandbox: '+name);
 }
 const timeout=await page.evaluate(async()=>{const {executeJS}=await import('./agents/sandbox.mjs');try{await executeJS('while(true){}',new AbortController().signal);return false;}catch(e){return /4 sekunder/.test(e.message);}});
 ok(timeout,'infinite worker terminated');
 if(mocked){await page.locator('#settings summary').click();await page.click('#checkKilo');await page.waitForFunction(()=>!document.getElementById('kiloOption').disabled);await page.selectOption('#provider','kilo');}
 const assignment=mocked?'Räkna (125*8)-175 med calculate och skriv resultat.json. Inspektera filen.':
 'Utför med verktygen: 1. Sök efter officiell WebAssembly-dokumentation och läs en relevant källsida. 2. Räkna (125*8)-175 med calculate. 3. Skapa resultat.json med fälten expression, result (tal) och source (en URL du faktiskt läst). 4. Kontrollera JSON-syntax med inspect_file. Avsluta med en kort svensk sammanfattning. Håll JSON-besluten korta. Filer skapas med write_file, inte bara i svaret.';
 await page.fill('#prompt',assignment);await page.click('#run');
 await page.waitForFunction(()=>!document.getElementById('run').disabled,{}, {timeout:420000});
 const status=await page.locator('#status').innerText();const log=await page.locator('#log').innerText();
 console.log('AGENT_STATUS',status);console.log('AGENT_LOG',log.slice(0,14000));
 ok(await page.locator('#status').evaluate(e=>e.classList.contains('success')),'agent completes: '+status);
 ok((await page.locator('#answerNote').innerText()).includes('Separat AI-granskning utförd'),'separate review completed');
 const rows=page.locator('#files .file');let file;
 for(let i=0;i<await rows.count();i++)if(await rows.nth(i).locator('strong').innerText()==='resultat.json')file=JSON.parse(await rows.nth(i).locator('pre').textContent());
 ok(file?.result===825,'downloadable JSON contains actual calculated result 825');
 for(const tool of ['calculate','write_file','inspect_file',...mocked?[]:['search','read_url']])ok(log.includes('OK: '+tool),'actual tool result: '+tool);
 if(!mocked){ok(await page.locator('#sources a').count()>0,'real source links returned');ok(typeof file.source==='string'&&file.source.startsWith('https://'),'file cites a real URL');}
 ok(requests.every(r=>!r.hasAuth&&!r.hasCookie),'all API requests anonymous');
 const ai=requests.filter(r=>r.url.includes('text.pollinations.ai'));
 for(let i=1;i<ai.length;i++)ok(ai[i].at-ai[i-1].at>=30000,'anonymous AI cooldown respected '+i);
 const downloadPromise=page.waitForEvent('download');await page.click('#save');const download=await downloadPromise;await download.saveAs(path.join(out,mocked?'mock-workspace.zip':'live-workspace.zip'));checks.push('workspace ZIP downloaded');
 await page.screenshot({path:path.join(out,mocked?'mock-mobile.png':'live-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(out,mocked?'mock-desktop.png':'live-desktop.png'),fullPage:true});
 ok(errors.length===0,'no uncaught JavaScript errors');
 const evidence={at:new Date().toISOString(),url,mockedAI:mocked,checks,status,answer:await page.locator('#answer').innerText(),model:await page.locator('#answerMeta').innerText(),file,requests,responses};
 writeFileSync(path.join(out,mocked?'mock-results.json':'live-results.json'),JSON.stringify(evidence,null,2));
 console.log('AGENT_TEST_PASSED',JSON.stringify(evidence));
}catch(error){
 await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
 const evidence={at:new Date().toISOString(),url,mockedAI:mocked,error:String(error),checks,requests,responses,errors};
 writeFileSync(path.join(out,'failure.json'),JSON.stringify(evidence,null,2));console.error('AGENT_TEST_FAILED',JSON.stringify(evidence));throw error;
}finally{await browser.close();}
