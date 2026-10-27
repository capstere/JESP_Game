import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreamPreview} from '../agents/stream-preview.mjs';
function fixture(options={}){
 let id=0;const frames=new Map(),timers=new Map(),paints=[];
 const ui=createStreamPreview({render:(text,meta)=>paints.push({text,meta}),requestFrame:cb=>{const k=id++;frames.set(k,cb);return k;},cancelFrame:k=>frames.delete(k),setTimer:cb=>{const k=id++;timers.set(k,cb);return k;},clearTimer:k=>timers.delete(k),...options});
 return {ui,frames,timers,paints,frame:()=>[...frames.values()].forEach(f=>f()),timer:()=>[...timers.values()].forEach(f=>f())};
}
test('1000 token fragments become one scheduled paint, not 1000 DOM updates',()=>{
 const f=fixture();for(let i=0;i<1000;i++)f.ui.append('x',{role:'work',model:'fixture'});
 assert.equal(f.paints.length,0);assert.equal(f.frames.size,1);assert.equal(f.timers.size,1);
 f.frame();assert.equal(f.paints.length,1);assert.equal(f.paints[0].text,'x'.repeat(1000));
 assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});
test('each subsequent frame contains every appended fragment in order',()=>{
 const f=fixture();f.ui.append('a');f.frame();f.ui.append('b');f.ui.append('c');f.frame();
 assert.deepEqual(f.paints.map(p=>p.text),['a','abc']);
});
test('terminal flush runs even when requestAnimationFrame never fires',()=>{
 const f=fixture();f.ui.append('slut');f.ui.flush();f.ui.flush();
 assert.equal(f.paints.length,1);assert.equal(f.paints[0].text,'slut');
 assert.equal(f.frames.size+f.timers.size,0);
});
test('timer fallback paints a background-tab preview once',()=>{
 const f=fixture();f.ui.append('background');const staleFrame=[...f.frames.values()][0];
 f.timer();staleFrame();assert.equal(f.paints.length,1);assert.equal(f.paints[0].text,'background');
});
test('reset cancels both callbacks including request ID zero',()=>{
 const f=fixture();f.ui.append('old');assert.ok(f.frames.has(0));
 const stale=[...f.frames.values(),...f.timers.values()];f.ui.reset({role:'critic'});
 f.ui.append('new',{role:'critic'});stale.forEach(fn=>fn());
 assert.deepEqual(f.paints,[{text:'',meta:{role:'critic'}}]);
 f.frame();assert.equal(f.paints.at(-1).text,'new');
});
test('two calls of the same role never combine after reset',()=>{
 const f=fixture();f.ui.append('first',{role:'work',model:'one'});f.frame();
 f.ui.reset({role:'work'});f.ui.append('second',{role:'work',model:'two'});f.frame();
 assert.deepEqual(f.paints.at(-1),{text:'second',meta:{role:'work',model:'two'}});
});
test('role boundary discards the previous role buffer before paint',()=>{
 const f=fixture();f.ui.append('worker',{role:'work',model:'one'});f.ui.append('review',{role:'critic'});f.frame();
 assert.deepEqual(f.paints.at(-1),{text:'review',meta:{role:'critic'}});
});
test('preview memory stays bounded at 6000 characters',()=>{
 const f=fixture();for(let i=0;i<2000;i++)f.ui.append(String(i).padStart(4,'0'));
 f.ui.flush();assert.equal(f.paints[0].text.length,6000);assert.ok(f.paints[0].text.endsWith('1999'));
});
test('truncation cannot expose half of an emoji at the start of the preview',()=>{
 const f=fixture({maxChars:4});f.ui.append('😀abc');f.ui.flush();
 assert.equal(f.paints[0].text,'abc');
});
test('Unicode split between fragments is retained',()=>{
 const f=fixture();f.ui.append('\ud83d');f.ui.append('\ude00');f.ui.flush();assert.equal(f.paints[0].text,'😀');
});
test('dispose cancels pending work and ignores future fragments',()=>{
 const f=fixture();f.ui.append('old');const stale=[...f.frames.values()][0];
 f.ui.dispose();stale();f.ui.append('new');f.ui.flush();f.ui.reset();
 assert.equal(f.paints.length,0);assert.equal(f.frames.size+f.timers.size,0);
});
test('empty/non-string chunks do not schedule a repaint',()=>{
 const f=fixture();for(const x of ['',null,undefined,12])f.ui.append(x);
 assert.equal(f.frames.size+f.timers.size,0);assert.equal(f.paints.length,0);
});
test('render cannot mutate internal metadata for the next frame',()=>{
 const texts=[];const f=fixture({render:(text,meta)=>{texts.push(text);meta.role='modified';}});
 f.ui.append('one',{role:'work'});f.frame();f.ui.append('two',{role:'work'});f.frame();
 assert.deepEqual(texts,['one','onetwo']);assert.equal(f.frames.size,0);
});
test('invalid buffer and timer configuration rejected',()=>{
 assert.throws(()=>createStreamPreview(),TypeError);
 for(const maxChars of [0,1,2.5,Infinity,180001])assert.throws(()=>createStreamPreview({render(){},maxChars}),RangeError);
 for(const fallbackMs of [0,-1,Infinity,1001])assert.throws(()=>createStreamPreview({render(){},fallbackMs}),RangeError);
});
