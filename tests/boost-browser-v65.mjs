// Standard mode mocks only the catalogue. LIVE=1 uses real anonymous inference.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
const origin='https://capstere.github.io/JESP_Game/';
const browser=await chromium.launch({headless:true});
const evidence={live:process.env.LIVE==='1',mockedAI:process.env.LIVE!=='1',ui:false,success:false};
const errors=[],responses=[],requests=[];
mkdirSync('boost-evidence',{recursive:true});
try{
 const page=await browser.newPage();
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
 assert.equal(await page.locator('#fileCount').innerText(),'1');assert.deepEqual(errors,[]);evidence.ui=true;
 if(evidence.live){
  const result=await page.evaluate(async()=>{const m=await import('./tests/boost-task-v65.mjs');return m.runIntervalTask();});
  writeFileSync('boost-evidence/agent.json',JSON.stringify(result,null,2));
  assert.equal(result.unfinished,false,JSON.stringify(result.error||result.issues));assert.equal(result.reviewPassed,true);
  assert.equal(result.external.passed,true,JSON.stringify(result.external));assert.ok(result.external.assertions>=81);
  assert.ok(!result.specialist.error,JSON.stringify(result.specialist));assert.equal(result.specialist.sourceUnchanged,true);assert.equal(result.specialist.advice.advisory,true);
  assert.ok(requests.length>0&&requests.every(x=>!x.authenticated),'No user authorization headers');
  const successful=responses.filter(x=>x.status===200);assert.ok(successful.length>0&&successful.every(x=>x.usage?.cost===0),'Every successful inference must report zero cost');
  evidence.independentAssertions=result.external.assertions;evidence.agentCompleted=true;evidence.specialistReadOnly=true;evidence.calls=result.calls;
  evidence.models=[...new Set(successful.map(x=>x.model))];
 }
 assert.deepEqual(errors,[]);evidence.success=true;
 console.log('JESP_BOOST_ACCEPTANCE',JSON.stringify({...evidence,requests,responses}));
}catch(e){evidence.error=String(e);throw e;}
finally{writeFileSync('boost-evidence/result.json',JSON.stringify({...evidence,requests,responses,errors},null,2));await browser.close();}
