import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace,runAgent} from '../agents/core.mjs';
const signal=()=>new AbortController().signal;
const act=(tool,args)=>({tool,args});
const actions=(...a)=>({kind:'actions',actions:a});
const final=answer=>({kind:'final',answer});
function mock(replies,inspect=()=>{}){return {calls:0,lastModel:'MOCK-ONLY',async ask(messages){inspect(messages,this.calls);this.calls++;return {text:JSON.stringify(replies.shift()),model:'MOCK-ONLY'};}};}

test('successful recovery clears obsolete FORMAT issue and targets missing file',async()=>{
 const question='Skapa a.md och b.md';const w=new Workspace({signal:signal(),question,web:false});w.pendingIssues=['FORMAT: previous truncation'];
 const seen=[];const ai=mock([actions(act('write_file',{name:'a.md',content:'A'})),actions(act('write_file',{name:'b.md',content:'B'})),final('Done')],m=>seen.push(m));
 const r=await runAgent({question,space:w,ai,signal:signal(),review:false});
 assert.equal(r.unfinished,false);assert.equal(w.pendingIssues.some(x=>x.startsWith('FORMAT:')),false);
 assert.match(seen[1].at(-1).content,/Skapa nu den saknade filen b.md/);
});
test('repeated rewriting cannot consume all delivery budget while an output is missing',async()=>{
 const question='Skapa a.md och b.md';const w=new Workspace({signal:signal(),question,web:false});
 const ai=mock([actions(act('write_file',{name:'a.md',content:'A'})),actions(act('write_file',{name:'a.md',content:'Unnecessary rewrite'})),actions(act('write_file',{name:'b.md',content:'B'})),final('Done')]);
 const r=await runAgent({question,space:w,ai,signal:signal(),review:false,maxSteps:4});
 assert.equal(r.unfinished,false);assert.equal(w.files.get('a.md').version,1);
 assert.equal(w.audit[1].ok,false);assert.match(w.audit[1].error,/b.md/);
});
