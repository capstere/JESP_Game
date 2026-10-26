// Real Chromium UI/transport integration with MOCKED AI chunks (clearly separated from live inference).
import {chromium} from 'playwright';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const origin='https://capstere.github.io/JESP_Game/';
const prefix='https://dzjjffgohxeoahtflqjo.supabase.co/functions/v1/';
const browser=await chromium.launch({headless:true});
const event=obj=>'data: '+(typeof obj==='string'?obj:JSON.stringify(obj))+'\n\n';
const chunk=(text,finish_reason=null)=>({model:'worker-test:free',choices:[{index:0,delta:{content:text},finish_reason}]});
const models={models:[{id:'worker-test:free',name:'Free mock worker',pricing:{prompt:0,completion:0},supported_parameters:['tools']},{id:'review-test:free',name:'Free mock reviewer',pricing:{prompt:0,completion:0},supported_parameters:['tools']}]};
async function setup(){
 const page=await browser.newPage();
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route(origin+'**',async route=>{
  const path=decodeURIComponent(new URL(route.request().url()).pathname.slice('/JESP_Game/'.length))||'index.html';
  if(path.includes('..')||!existsSync(path))return route.abort();
  await route.fulfill({status:200,contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript',body:readFileSync(path)});
 });
 const cors={'Access-Control-Allow-Origin':'https://capstere.github.io','Cache-Control':'no-store'};
 await page.route(prefix+'jesp-gateway/models',route=>route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(models)}));
 await page.route(prefix+'jesp-gateway/chat',route=>{requests.push({kind:'json',body:route.request().postDataJSON()});return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({model:'worker-test:free',choices:[{index:0,message:{role:'assistant',content:'12'},finish_reason:'stop'}],usage:{cost:0}})});});
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.JESP_AGENT_BOOTED&&document.getElementById('run').disabled===false,{timeout:30000});
 await page.locator('#settings summary').click();
 return {page,requests,errors,cors};
}
try{
 {
  const {page,requests,errors,cors}=await setup();
  await page.route(prefix+'jesp-stream/chat-stream',route=>{requests.push({kind:'sse',body:route.request().postDataJSON()});return route.fulfill({status:200,contentType:'text/event-stream',headers:cors,body:event(chunk('1'))+event(chunk('2','stop'))+event({choices:[],usage:{cost:0,total_tokens:2}})+event('[DONE]')});});
  await page.locator('#liveStream').check();
  await page.locator('#test').click();
  await page.waitForFunction(()=>!document.getElementById('test').disabled&&document.getElementById('status').className.includes('success'),{timeout:30000});
  assert.equal(requests.length,1);assert.equal(requests[0].kind,'sse');assert.equal(requests[0].body.model,'worker-test:free');
  assert.equal(await page.locator('#answer').innerText(),'12');
  assert.equal(await page.locator('#livePreview').innerText(),'12');
  assert.match(await page.locator('#liveRole').innerText(),/worker-test:free/);
  assert.deepEqual(errors,[]);await page.close();
  console.log('BROWSER_SSE_SUCCESS',{requests:requests.length});
 }
 {
  const {page,requests,errors,cors}=await setup();
  await page.route(prefix+'jesp-stream/chat-stream',route=>{requests.push({kind:'sse'});return route.fulfill({status:200,contentType:'text/event-stream',headers:cors,body:event(chunk('unsafe partial','stop'))});});
  await page.locator('#liveStream').check();await page.locator('#test').click();
  await page.waitForFunction(()=>!document.getElementById('test').disabled&&document.getElementById('status').className.includes('error'),{timeout:30000});
  assert.equal(requests.length,1);
  assert.match(await page.locator('#status').innerText(),/innan \[DONE\]/);
  assert.ok(!(await page.locator('#answer').innerText()).includes('unsafe partial'),'Partial stream must not become final answer');
  assert.match(await page.locator('#answerNote').innerText(),/Ofullständig/);
  assert.deepEqual(errors,[]);await page.close();
  console.log('BROWSER_SSE_FAIL_CLOSED',{requests:requests.length});
 }
 {
  const {page,requests,errors}=await setup();
  assert.equal(await page.locator('#liveStream').isChecked(),false,'JSON fallback must remain default until real SSE verified');
  await page.locator('#test').click();
  await page.waitForFunction(()=>!document.getElementById('test').disabled&&document.getElementById('status').className.includes('success'),{timeout:30000});
  assert.equal(requests.length,1);assert.equal(requests[0].kind,'json');
  assert.equal(await page.locator('#answer').innerText(),'12');
  assert.deepEqual(errors,[]);await page.close();
  console.log('BROWSER_JSON_COMPATIBLE');
 }
}finally{await browser.close();}
