// Tests the test harness itself with deterministic programs. No AI inference.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined}),page=await browser.newPage();const results=[];
await page.setContent('<!doctype html><meta http-equiv="Content-Security-Policy" content="frame-src \'self\' blob: data:; object-src \'none\'"><p>Test host</p>');
const bundle=readFileSync('agents/test-harness.mjs','utf8').replace('export const','const')+'\n'+readFileSync('agents/page-test.mjs','utf8').replace(/^import .*;$/m,'').replaceAll('export async function','async function').replaceAll('export function','function')+'\nwindow.runPageTest=executePageTest;';
await page.addScriptTag({content:bundle});
const run=(files,code)=>page.evaluate(async({files,code})=>await window.runPageTest(new Map(Object.entries(files).map(([name,content])=>[name,{name,content,version:1}])),{page:'index.html',code},new AbortController().signal),{files,code});
const check=async(name,fn)=>{try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:String(e)});}};
const files={'index.html':'<button id="add">Add</button><canvas width="20" height="20"></canvas><script src="logic.js"></script><script src="game.js"></script>','logic.js':'globalThis.count=0;','game.js':'document.querySelector("#add").onclick=()=>count++;window.addEventListener("keydown",e=>{if(e.key==="w")count+=2;});document.querySelector("canvas").getContext("2d").fillRect(0,0,10,10);'};
try{
await check('real click and keyboard',async()=>assert.equal((await run(files,'assert.equal(count,0);click("#add");assert.equal(count,1);await key("w",30);assert.equal(count,3);')).passed,true));
await check('animation frames must advance',async()=>assert.equal((await run({'index.html':'<canvas></canvas><script>window.framesSeen=0;function step(){framesSeen++;requestAnimationFrame(step)}step();</script>'},'await wait(400);assert(framesSeen>3,"animation paused");assert(true);')).passed,true));
await check('canvas is real',async()=>assert.equal((await run(files,'const c=document.querySelector("canvas");assert(c);assert.equal(c.getContext("2d").getImageData(0,0,1,1).data[3],255);')).passed,true));
await check('runtime error fails',async()=>assert.equal((await run({'index.html':'<script>throw Error("runtime error")</script>'},'assert(true);assert(true);')).passed,false));
await check('incorrect assertion fails',async()=>assert.equal((await run(files,'assert.equal(count,27);assert(true);')).passed,false));
await check('empty assertion set fails',async()=>assert.equal((await run(files,'const a=1;')).passed,false));
await check('opaque origin prevents parent DOM access',async()=>assert.equal((await run(files,'let blocked=false;try{parent.document.body.innerHTML="bad"}catch{blocked=true}assert(blocked);assert(true);')).passed,true));
await check('external fetch blocked',async()=>assert.equal((await run({'index.html':'<script>fetch("https://example.com").catch(()=>{});</script>'},'assert(true);assert(true);')).passed,false));
await check('cleanup after result',async()=>assert.equal(await page.locator('iframe').count(),0));
await check('external script rejected before execution',async()=>assert.rejects(run({'index.html':'<script src="https://example.com/a.js"></script>'},'assert(true);')));
await check('deferred local script runs after markup',async()=>assert.equal((await run({'index.html':'<script defer src="game.js"></script><p id="item">Before</p>','game.js':'document.querySelector("#item").textContent="After";'},'assert.equal(document.querySelector("#item").textContent,"After");assert(true);')).passed,true));
await check('async unsupported is explicit, not silently changed',async()=>assert.rejects(run({'index.html':'<script async src="game.js"></script>','game.js':'void 0;'},'assert(true);')));
}finally{await browser.close();mkdirSync('browser-verification-evidence',{recursive:true});writeFileSync('browser-verification-evidence/checks.json',JSON.stringify({inference:'none',realDOM:true,checks:results},null,2));}
console.log(JSON.stringify(results));assert.ok(results.every(r=>r.passed));
