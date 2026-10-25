// Real Chromium smoke test of the audited starter, separate from AI inference.
// A starter passing here is NOT an autonomous model build passing acceptance.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fpsStarter} from '../agents/game-scaffold.mjs';
const src=fpsStarter();
let html=src['index.html'];
html=html.replace('<script src="logic.js"></script>','<script>'+src['logic.js']+'</script>').replace('<script defer src="game.js"></script>','<script>'+src['game.js']+'</script>');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent(html,{waitUntil:'load'});
 await page.waitForFunction(()=>!!window.gameState&&!!document.querySelector('canvas'),null,{timeout:9000});
 await page.waitForTimeout(150);
 const state=()=>page.evaluate(()=>structuredClone(window.gameState));
 const start=await state();
 assert.deepEqual(Object.keys(start).includes('target'),true);
 assert.equal(start.score,0);
 const pixelColors=await page.evaluate(()=>{const c=document.querySelector('canvas'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const colors=new Set();for(let i=0;i<data.length;i+=48)colors.add(data[i]+','+data[i+1]+','+data[i+2]);return colors.size;});
 assert.ok(pixelColors>=3,'Canvas must draw multiple colors');
 await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
 const moved=await state();
 assert.ok(Math.hypot(moved.x-start.x,moved.y-start.y)>0.01,'W must move player');
 await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');
 const turned=await state();
 assert.ok(Math.abs(turned.angle-moved.angle)>0.01,'D must rotate player');
 await page.evaluate(()=>window.resetGame());
 await page.waitForTimeout(80);
 await page.keyboard.press('Space');
 await page.waitForTimeout(150);
 const shot=await state();
 assert.ok(shot.score>start.score,'Visible initial target must be shootable');
 await page.keyboard.press('r');await page.waitForTimeout(100);
 const reset=await state();
 assert.equal(reset.score,start.score);
 assert.ok(Math.hypot(reset.x-start.x,reset.y-start.y)<0.0001,'R must reset player');
 assert.deepEqual(errors,[]);
 const summary={kind:'audited-starter-only',mockedAI:false,modelInference:false,movement:true,rotation:true,shooting:true,reset:true,canvasColors:pixelColors,errors,at:new Date().toISOString()};
 mkdirSync('scaffold-evidence',{recursive:true});
 writeFileSync('scaffold-evidence/browser.json',JSON.stringify(summary,null,2));
 console.log('FPS_SCAFFOLD_BROWSER_OK',JSON.stringify(summary));
}finally{await browser.close();}