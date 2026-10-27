// Browser-level checks of the actual app; model responses are explicitly simulated.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(process.env.JESP_SOURCE_DIR||'.');
const origin=process.env.JESP_TEST_ORIGIN||'https://capstere.github.io/JESP_Game/';
const base='https://dzjjffgohxeoahtflqjo.supabase.co/functions/v1/';
const report={mockedAI:true,scope:'presentation only',cases:[],burst:null};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const event=v=>'data: '+(typeof v==='string'?v:JSON.stringify(v))+'\n\n';
const chunk=(content,finish_reason=null)=>({model:'fixture:free',choices:[{index:0,delta:{content},finish_reason}]});
async function setup({stream,controlled=false,pausedFrames=false}={}){
 const page=await browser.newPage({viewport:{width:980,height:900}});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url.startsWith(origin)){
   const name=decodeURIComponent(new URL(url).pathname.slice('/JESP_Game/'.length))||'index.html';
   const path=resolve(root,name);
   if(!path.startsWith(root+sep)||!existsSync(path))return route.abort();
   return route.fulfill({status:200,contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript',body:readFileSync(path)});
  }
  const cors={'Access-Control-Allow-Origin':new URL(origin).origin};
  if(url===base+'jesp-gateway/models')return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({models:[{id:'fixture:free',name:'Test fixture',pricing:{prompt:0,completion:0},supported_parameters:['tools']}]})});
  if(url===base+'jesp-stream/chat-stream'){
   requests.push({kind:'sse',payload:route.request().postDataJSON(),headers:route.request().headers()});
   return route.fulfill({status:200,contentType:'text/event-stream',headers:cors,body:stream||event(chunk('OK','stop'))+event('[DONE]')});
  }
  if(url===base+'jesp-gateway/chat'){
   requests.push({kind:'json',payload:route.request().postDataJSON()});
   return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({model:'fixture:free',choices:[{index:0,finish_reason:'stop',message:{content:'12'}}],usage:{cost:0}})});
  }
  return route.abort();
 });
 if(pausedFrames)await page.addInitScript(()=>{
  let id=0;window.__raf=new Map();window.requestAnimationFrame=cb=>{const n=id++;window.__raf.set(n,cb);return n;};window.cancelAnimationFrame=n=>window.__raf.delete(n);
 });
 if(controlled)await page.addInitScript(()=>{
  const native=window.fetch.bind(window);window.__controlledCalls=0;
  window.fetch=async(url,options)=>{
   if(!String(url).includes('/jesp-stream/chat-stream'))return native(url,options);
   window.__controlledCalls++;let ctl;
   const stream=new ReadableStream({start(c){ctl=c;},cancel(){window.__controlledCancelled=true;}});
   options.signal.addEventListener('abort',()=>ctl.error(options.signal.reason),{once:true});
   window.__send=content=>ctl.enqueue(new TextEncoder().encode('data: '+JSON.stringify({model:'fixture:free',choices:[{index:0,delta:{content},finish_reason:null}]})+'\n\n'));
   window.__complete=()=>{ctl.enqueue(new TextEncoder().encode('data: '+JSON.stringify({model:'fixture:free',choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'));ctl.close();};
   return new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream'}});
  };
 });
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.JESP_AGENT_BOOTED&&!document.getElementById('run').disabled,null,{timeout:10000});
 await page.locator('#settings summary').click();
 await page.evaluate(()=>{
  const pre=document.getElementById('livePreview'),descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  window.__previewWrites=0;
  Object.defineProperty(pre,'textContent',{configurable:true,get(){return descriptor.get.call(this);},set(v){window.__previewWrites++;descriptor.set.call(this,v);}});
 });
 return {page,requests,errors};
}
async function start(page,stream=true){if(stream)await page.locator('#liveStream').check();await page.locator('#test').click();}
async function success(page){await page.waitForFunction(()=>!document.getElementById('test').disabled&&document.getElementById('status').classList.contains('success'),null,{timeout:10000});}
function passed(name){report.cases.push({name,passed:true});}
try{
 const tokens=Array.from({length:1000},(_,i)=>i%2?'å':'x');
 const {page,requests,errors}=await setup({stream:tokens.map(t=>event(chunk(t))).join('')+event(chunk('','stop'))+event('[DONE]'),pausedFrames:true});
 await start(page);await success(page);
 assert.equal(await page.locator('#answer').innerText(),tokens.join(''));
 assert.equal(await page.locator('#livePreview').innerText(),tokens.join(''));
 const writes=await page.evaluate(()=>window.__previewWrites);
 const baseline=process.env.JESP_BASELINE==='1';
 assert.ok(baseline?writes>=1000:writes<=2,'Burst paint count: '+writes);
 assert.equal(requests.length,1);assert.ok(!requests[0].headers.authorization);
 assert.equal(await page.evaluate(()=>window.__raf.size),0);
 const terminal=await page.locator('#livePhase').innerText();await page.waitForTimeout(160);assert.equal(await page.locator('#livePhase').innerText(),terminal);
 assert.deepEqual(errors,[]);
 report.burst={fragments:1000,previewTextWrites:writes,finalTextIdentical:true,modelCalls:requests.length};
 passed('1000 fragments: identical output and one coalesced preview update');await page.close();
 if(!baseline){
  {
   const {page,requests,errors}=await setup({stream:event(chunk('x'.repeat(8000),'stop'))+event('[DONE]')});await start(page);await success(page);
   assert.equal((await page.locator('#livePreview').innerText()).length,6000);
   assert.equal((await page.locator('#answer').innerText()).length,8000);
   assert.equal(requests.length,1);assert.deepEqual(errors,[]);passed('6000-character preview never truncates final 8000-character answer');await page.close();
  }
  {
   const {page,errors}=await setup({controlled:true});await start(page);
   await page.waitForFunction(()=>typeof window.__send==='function');
   await page.evaluate(()=>window.__send('rad med tillräckligt innehåll\n'.repeat(120)));
   await page.waitForFunction(()=>document.getElementById('livePreview').textContent.includes('rad'));
   await page.evaluate(()=>{document.getElementById('livePreview').scrollTop=0;});
   await page.evaluate(()=>window.__send('ny rad\n'));
   await page.waitForFunction(()=>document.getElementById('livePreview').textContent.endsWith('ny rad\n'));
   assert.equal(await page.locator('#livePreview').evaluate(e=>e.scrollTop),0);
   await page.evaluate(()=>{const pre=document.getElementById('livePreview');pre.scrollTop=pre.scrollHeight;window.__send('följer botten\n');});
   await page.waitForFunction(()=>document.getElementById('livePreview').textContent.endsWith('följer botten\n'));
   assert.ok(await page.locator('#livePreview').evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop<5));
   await page.locator('#cancel').click();await page.waitForFunction(()=>!document.getElementById('test').disabled);
   assert.match(await page.locator('#status').innerText(),/Avbrutet/);
   assert.equal(await page.locator('#answer').innerText(),'');
   const phase=await page.locator('#livePhase').innerText();await page.waitForTimeout(160);assert.equal(await page.locator('#livePhase').innerText(),phase);
   assert.deepEqual(errors,[]);passed('scroll-up is preserved; bottom follows; cancel stays incomplete');await page.close();
  }
  {
   const {page,requests,errors}=await setup({stream:event(chunk('first','stop'))+event('[DONE]'),pausedFrames:true});await start(page);await success(page);
   await page.route(base+'jesp-stream/chat-stream',route=>route.fulfill({status:200,contentType:'text/event-stream',headers:{'Access-Control-Allow-Origin':new URL(origin).origin},body:event(chunk('<img src=x onerror="window.BAD=1">second','stop'))+event('[DONE]')}));
   await start(page);await success(page);
   assert.equal(await page.locator('#livePreview img').count(),0);
   assert.ok(!(await page.locator('#livePreview').innerText()).includes('first'));
   assert.equal(await page.evaluate(()=>window.BAD),undefined);
   assert.deepEqual(errors,[]);passed('second same-role request resets; HTML-looking model text is inert');await page.close();
  }
  {
   const {page,requests,errors}=await setup();assert.equal(await page.locator('#liveStream').isChecked(),false);
   assert.match(await page.locator('#status').innerText(),/Version 6\.4\.2/);
   await start(page,false);await success(page);
   assert.equal(await page.locator('#answer').innerText(),'12');assert.equal(requests.length,1);assert.equal(requests[0].kind,'json');
   assert.deepEqual(errors,[]);passed('JSON remains default; startup version matches actual release');await page.close();
  }
 }
 console.log('STREAM_PREVIEW_BROWSER',JSON.stringify(report));
}finally{
 mkdirSync('preview-evidence',{recursive:true});writeFileSync('preview-evidence/browser.json',JSON.stringify(report,null,2));await browser.close();
}
