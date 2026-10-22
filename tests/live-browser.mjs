// Real API and real model tests. Only the not-yet-published static HTML/JS is staged.
// Set LIVE_URL to test the deployed site without any hosting interception.
import { chromium, webkit } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root=process.env.SOURCE_ROOT || process.cwd();
const live=process.env.LIVE_URL;
const url=live || 'https://capstere.github.io/JESP_Game/?staged-v4=1';
const output=path.join(root,'test-artifacts'); mkdirSync(output,{recursive:true});
const results=[];
async function stage(page) {
  if (live) return;
  await page.route('https://capstere.github.io/JESP_Game/**', async route=>{
    const p=new URL(route.request().url()).pathname;
    if(p==='/JESP_Game/' || p==='/JESP_Game/index.html') return route.fulfill({contentType:'text/html',body:readFileSync(path.join(root,'index.html'),'utf8')});
    if(p==='/JESP_Game/ai.js') return route.fulfill({contentType:'text/javascript',body:readFileSync(path.join(root,'ai.js'),'utf8')});
    return route.continue();
  });
}
async function waitDone(page,timeout=150000) {
  await page.waitForFunction(()=>!document.getElementById('run').disabled,{},{timeout});
  const state=await page.locator('#status').innerText();
  const answer=await page.locator('#answer').innerText();
  if(!await page.locator('#status').evaluate(e=>e.classList.contains('success'))) throw new Error(state+' | '+await page.locator('#diagnostic').innerText());
  return answer;
}
for(const [name,browserType] of [['chromium',chromium],['webkit',webkit]]){
 // Separate fresh browser sessions share this runner IP; honor the service interval.
 if(results.length) await new Promise(r=>setTimeout(r,32000));
 const browser=await browserType.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await stage(page);
  const calls=[];
  page.on('request',r=>{if(r.url().includes('text.pollinations.ai/')) calls.push({url:r.url(),headers:r.headers(),method:r.method()});});
  page.on('pageerror',e=>console.log('PAGEERROR',name,String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.JESP_AI_BOOTED);
  await page.locator('details.card summary').click();
  await page.locator('#test').click();
  const answer=await waitDone(page);
  if(!/^12[.!\s]*$/.test(answer.trim())) throw new Error('Wrong test answer: '+answer);
  if(calls.length!==1 || calls.some(c=>c.headers.authorization || c.headers.cookie)) throw new Error('Unexpected authenticated or extra requests');
  results.push({browser:name,test:'real online response, no auth',answer,requests:calls.length});
  console.log('REAL_ONLINE_RESULT',name,JSON.stringify(results.at(-1)));
  const a=21+Math.floor(Math.random()*10),b=11+Math.floor(Math.random()*10);
  await page.fill('#prompt',`Vad är ${a} plus ${b}? Svara endast med talet.`);
  await page.click('#run');
  const next=await waitDone(page);
  if(!new RegExp(`^${a+b}[.!\\s]*$`).test(next.trim())) throw new Error('Wrong normal question answer: '+next);
  results.push({browser:name,test:'real normal prompt',question:`${a}+${b}`,answer:next});
  console.log('REAL_PROMPT_RESULT',name,JSON.stringify(results.at(-1)));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Mobile horizontal overflow');
  await page.screenshot({path:path.join(output,`${name}-mobile.png`),fullPage:true});
  if(name==='chromium' && !live){
   await page.selectOption('#mode','local');
   await page.click('#test');
   const local=await waitDone(page,600000);
   if(!/\b12\b/.test(local)) throw new Error('Wrong real local answer: '+local);
   results.push({browser:name,test:'real local CDN engine and downloaded model',answer:local});
   console.log('REAL_LOCAL_RESULT',JSON.stringify(results.at(-1)));
  }
 }finally{await browser.close();}
}
writeFileSync(path.join(output,'live-results.json'),JSON.stringify({time:new Date().toISOString(),liveURL:live||null,stagedHosting:!live,mockedAI:false,results},null,2));
console.log('ALL_REAL_TESTS_PASSED',JSON.stringify(results));
