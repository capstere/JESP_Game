// Real deployed HTML, real deployed JavaScript, real AI responses. No route interception.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const output=path.join(process.env.SOURCE_ROOT||process.cwd(),'test-artifacts-online');
mkdirSync(output,{recursive:true});
const url='https://capstere.github.io/JESP_Game/?verified=4.0';
const results=[];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const calls=[], responses=[];
page.on('request',r=>{if(r.url().startsWith('https://text.pollinations.ai/')) calls.push({url:r.url(),method:r.method(),headers:r.headers(),at:Date.now()});});
page.on('response',r=>{if(r.url().startsWith('https://text.pollinations.ai/')) responses.push({url:r.url(),status:r.status(),at:Date.now()});});
page.on('pageerror',e=>console.log('PAGE_ERROR',String(e)));
async function answer() {
 await page.waitForFunction(()=>!document.getElementById('run').disabled,{}, {timeout:150000});
 const state=await page.locator('#status').innerText();
 if(!await page.locator('#status').evaluate(e=>e.classList.contains('success'))) throw new Error(state+' | '+await page.locator('#diagnostic').textContent());
 return (await page.locator('#answer').innerText()).trim();
}
try {
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.JESP_AI_BOOTED,{}, {timeout:30000});
 if(!/Version 4/.test(await page.locator('.eyebrow').innerText())) throw new Error('Published version is not v4');
 await page.locator('details.card summary').click();
 await page.click('#test');
 const first=await answer();
 if(!/^12[.!\s]*$/.test(first)) throw new Error('Unexpected arithmetic reply: '+first);
 results.push({test:'published test button, real AI',answer:first});
 console.log('PUBLISHED_REAL_RESPONSE',JSON.stringify(results.at(-1)));
 const a=31+Math.floor(Math.random()*10),b=21+Math.floor(Math.random()*10);
 await page.fill('#prompt',`Vad är ${a} plus ${b}? Svara endast med talet.`);
 await page.click('#run');
 const second=await answer();
 if(!new RegExp(`^${a+b}[.!\\s]*$`).test(second)) throw new Error('Unexpected normal reply: '+second);
 results.push({test:'published normal question, real AI',question:`${a}+${b}`,answer:second});
 console.log('PUBLISHED_REAL_RESPONSE',JSON.stringify(results.at(-1)));
 if(calls.length!==2 || calls.some(c=>c.headers.authorization || c.headers.cookie)) throw new Error('Unexpected authenticated or extra requests');
 if(calls[1].at-calls[0].at<30000) throw new Error('Free interval was not respected');
 if(responses.length!==2 || responses.some(r=>r.status!==200)) throw new Error('Unexpected API status');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Mobile horizontal overflow');
 await page.screenshot({path:path.join(output,'published-mobile.png'),fullPage:true});
 const evidence={time:new Date().toISOString(),url,mockedAI:false,mockedHosting:false,results,requests:calls.map(({headers,...rest})=>({...rest,authenticated:false})),responses};
 writeFileSync(path.join(output,'published-results.json'),JSON.stringify(evidence,null,2));
 console.log('PASS_PUBLISHED_WEBSITE_REAL_ANONYMOUS_AI',JSON.stringify(evidence));
} catch(error) {
 await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
 writeFileSync(path.join(output,'failure.json'),JSON.stringify({time:new Date().toISOString(),error:String(error),results,responses},null,2));
 throw error;
} finally {await browser.close();}
