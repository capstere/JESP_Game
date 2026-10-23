// Real anonymous model, followed by independent browser checks of its generated app.
// No API keys, credentials, paid fallback, request replay or mocked inference.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const dir='build-live-evidence';mkdirSync(dir,{recursive:true});mkdirSync(dir+'/generated',{recursive:true});
const server=spawn('python3',['-m','http.server','8123','--bind','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const requests=[],responses=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(r.url().includes('text.pollinations.ai/openai')){const b=r.postDataJSON();requests.push({at:Date.now(),authenticated:!!r.headers().authorization||!!r.headers().cookie,reasoning:b.reasoning_effort,max_tokens:b.max_tokens});}});
page.on('response',async r=>{if(r.url().includes('text.pollinations.ai/openai'))try{const j=await r.json();responses.push({status:r.status(),model:j.model,usage:j.usage,finish:j.choices?.[0]?.finish_reason,error:j.error});}catch{responses.push({status:r.status()});}});
const task=`Bygg en liten fungerande FPS-prototyp för webbläsaren, inte en plan. Skapa index.html, logic.js och game.js. Inga externa bibliotek, modeller eller nätverksanrop. Canvas ska visa en enkel förstapersonsvy av väggar, exempelvis raycasting i ett litet rutnät. W/S ska flytta och A/D rotera. Mellanslag ska skjuta ett mål som är synligt rakt fram från start och ge poäng. R ska återställa spelet. Visa korta kontroller på sidan.
Håll prototypen minimal, inte en full spelmotor. Skilj DOM-fri logik i logic.js från render/input i game.js. Använd vanliga scripts, inte moduler/import. Testa minst tre meningsfulla kantfall med test_js och assert mot logic.js.
För oberoende testning: exponera window.gameState med numeriska x, y, angle och score, samt window.resetGame(). Uppdatera objektet när spelaren rör sig, roterar eller skjuter. resetGame ska återställa startvärdena. Leverera kodfilerna, inte en tidplan. Ange vad som inte har testats.`;
let generatedServer;
try {
  for(let i=0;i<15;i++){try{await page.goto('http://127.0.0.1:8123/',{waitUntil:'domcontentloaded'});break;}catch{await new Promise(r=>setTimeout(r,500));}}
  await page.waitForFunction(()=>window.JESP_AGENT_BOOTED);
  await page.locator('#settings summary').click();await page.uncheck('#web');await page.check('#code');await page.check('#advanced');await page.selectOption('#taskMode','build');await page.selectOption('#steps','24');await page.fill('#prompt',task);await page.click('#run');
  await page.waitForFunction(()=>!document.getElementById('run').disabled,null,{timeout:1050000});
  const files=await page.locator('#files .file').evaluateAll(rows=>Object.fromEntries(rows.map(r=>[r.querySelector('strong').textContent,r.querySelector('pre').textContent])));
  const status=await page.locator('#status').innerText();
  const d=page.waitForEvent('download');await page.click('#save');await (await d).saveAs(dir+'/workspace.zip');
  await page.screenshot({path:dir+'/agent.png',fullPage:true});
  writeFileSync(dir+'/agent-result.json',JSON.stringify({mockedAI:false,status,files,requests,responses,errors,task,answer:await page.locator('#answer').innerText()},null,2));
  for(const name of ['index.html','logic.js','game.js']){if(!files[name]?.trim())throw new Error('Missing generated file: '+name);writeFileSync(dir+'/generated/'+name,files[name]);}
  generatedServer=spawn('python3',['-m','http.server','8124','--bind','127.0.0.1'],{cwd:dir+'/generated',stdio:'ignore'});
  const isolated=await browser.newContext({acceptDownloads:false,serviceWorkers:'block'});
  await isolated.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8124/')?r.continue():r.abort());
  const game=await isolated.newPage();const gameErrors=[];game.on('pageerror',e=>gameErrors.push(String(e)));
  for(let i=0;i<12;i++){try{await game.goto('http://127.0.0.1:8124/',{waitUntil:'load',timeout:10000});break;}catch{await new Promise(r=>setTimeout(r,500));}}
  await game.waitForFunction(()=>window.gameState&&document.querySelector('canvas'),null,{timeout:10000});
  const state=()=>game.evaluate(()=>({...window.gameState}));const start=await state();
  if(!['x','y','angle','score'].every(k=>Number.isFinite(start[k])))throw new Error('Invalid gameState');
  await game.keyboard.down('w');await game.waitForTimeout(350);await game.keyboard.up('w');const moved=await state();
  if(Math.hypot(moved.x-start.x,moved.y-start.y)<0.01)throw new Error('W did not move player');
  await game.keyboard.down('d');await game.waitForTimeout(350);await game.keyboard.up('d');const turned=await state();
  if(Math.abs(turned.angle-moved.angle)<0.01)throw new Error('D did not rotate player');
  await game.evaluate(()=>window.resetGame());await game.waitForTimeout(80);await game.keyboard.press('Space');await game.waitForTimeout(150);const shot=await state();
  if(!(shot.score>start.score))throw new Error('Shooting visible initial target did not increase score');
  await game.keyboard.press('r');await game.waitForTimeout(100);const reset=await state();
  if(reset.score!==start.score||Math.abs(reset.x-start.x)>0.001||Math.abs(reset.y-start.y)>0.001)throw new Error('R did not reset');
  const pixels=await game.evaluate(()=>{const c=document.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const colors=new Set();for(let i=0;i<d.length;i+=64)colors.add([d[i],d[i+1],d[i+2]].join());return colors.size;});
  if(pixels<3)throw new Error('Canvas is blank or uniform');
  await game.screenshot({path:dir+'/generated-game.png'});
  const report={mockedAI:false,model:responses.find(r=>r.model)?.model,independentChecks:{movement:true,rotation:true,shooting:true,restart:true,canvasNonBlank:true},start,moved,turned,shot,reset,canvasColors:pixels,gameErrors,status,at:new Date().toISOString()};
  writeFileSync(dir+'/independent-result.json',JSON.stringify(report,null,2));console.log('INDEPENDENT_RESULT',JSON.stringify(report));
  if(gameErrors.length||errors.length)throw new Error('Browser errors: '+[...gameErrors,...errors].join('; '));
  if(requests.some(r=>r.authenticated)||!requests.length)throw new Error('Unexpected authentication or missing real inference');
  if(!(await page.locator('#status').getAttribute('class')).includes('success'))throw new Error('Agent did not meet its own completion checks: '+status);
}catch(e){writeFileSync(dir+'/failure.json',JSON.stringify({mockedAI:false,error:String(e),requests,responses,errors},null,2));throw e;}
finally{await browser.close();server.kill();generatedServer?.kill();}
