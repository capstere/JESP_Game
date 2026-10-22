// Real browser + real anonymous AI. No mocked API responses or key/account.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const dir='reasoning-live-evidence';mkdirSync(dir,{recursive:true});
const published=process.env.PUBLISHED_URL;
const server=published?null:spawn('python3',['-m','http.server','8123','--bind','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const requests=[],responses=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(r.url().includes('text.pollinations.ai/openai')){const b=r.postDataJSON();requests.push({at:Date.now(),url:r.url(),authenticated:!!r.headers().authorization||!!r.headers().cookie,reasoning:b.reasoning_effort,max_tokens:b.max_tokens});}});
page.on('response',async r=>{if(r.url().includes('text.pollinations.ai/openai')){try{const j=await r.json();responses.push({status:r.status(),model:j.model,usage:j.usage,finish:j.choices?.[0]?.finish_reason,error:j.error});}catch{responses.push({status:r.status()});}}});
const task='Pröva påståendet: En vara kostar 100 kr. Priset höjs med 25 procent och sänks sedan med 20 procent. Slutpriset är 5 procent högre än startpriset. Använd calculate för de faktiska beräkningarna. Skapa underlag.md med beräkning och antaganden. Skapa granskning.md som prövar påståendet och förklarar hur procentbasen ändras. Skapa resultat.json med fälten start (tal), afterIncrease (tal), final (tal), claimCorrect (boolean). Gör alla tre filer med write_file. Avsluta kort på svenska. Ingen webbsökning behövs.';
try {
  let loaded=false;
  for(let i=0;i<12;i++){
    try{await page.goto((published||'http://127.0.0.1:8123/')+'?verify=5.1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.JESP_AGENT_BOOTED,{},{timeout:15000});loaded=await page.locator('#reasoning').count()===1;if(loaded)break;}catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!loaded)throw new Error('v5.1 did not boot');
  await page.locator('#settings summary').click();await page.uncheck('#web');
  await page.selectOption('#steps','12');await page.selectOption('#reasoning','medium');await page.fill('#prompt',task);await page.click('#run');
  await page.waitForFunction(()=>!document.getElementById('run').disabled,{},{timeout:780000});
  const status=await page.locator('#status').innerText();
  const files=await page.locator('#files .file').evaluateAll(rows=>Object.fromEntries(rows.map(r=>[r.querySelector('strong').textContent,r.querySelector('pre').textContent])));
  let error='';
  try {
    const result=JSON.parse(files['resultat.json']);
    if(result.start!==100||result.afterIncrease!==125||result.final!==100||result.claimCorrect!==false)throw new Error('Wrong numerical/logic result: '+JSON.stringify(result));
    for(const name of ['underlag.md','granskning.md'])if(!files[name]?.trim())throw new Error('Missing '+name);
    if(!(await page.locator('#status').getAttribute('class')).includes('success'))throw new Error(status);
    if(!(await page.locator('#answerNote').innerText()).includes('godkände'))throw new Error('No approved final review');
    if(!requests.length||requests.some(r=>r.authenticated||r.reasoning!=='medium'||r.max_tokens!==8192))throw new Error('Unexpected authentication or effort settings');
    if(errors.length)throw new Error(errors.join('\n'));
  }catch(e){error=String(e);}
  const dPromise=page.waitForEvent('download');await page.click('#save');await (await dPromise).saveAs(dir+'/workspace.zip');
  await page.screenshot({path:dir+'/mobile.png',fullPage:true});
  const evidence={mockedAI:false,url:page.url(),status,error,files,requests,responses,errors,answer:await page.locator('#answer').innerText(),at:new Date().toISOString()};
  writeFileSync(dir+'/result.json',JSON.stringify(evidence,null,2));console.log('LIVE_RESULT',JSON.stringify(evidence));
  if(error)throw new Error(error);
}catch(e){writeFileSync(dir+'/failure.json',JSON.stringify({mockedAI:false,error:String(e),requests,responses,errors},null,2));throw e;}
finally{await browser.close();server?.kill();}
