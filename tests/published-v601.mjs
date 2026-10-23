// Verify deployed bytes before testing the real, unmodified GitHub Pages application.
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='https://capstere.github.io/JESP_Game/';
const dir='published-v601-evidence';mkdirSync(dir,{recursive:true});
const names=['index.html',...readdirSync('agents').filter(n=>/\.(mjs|css)$/.test(n)).map(n=>'agents/'+n)];
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=Object.fromEntries(names.map(n=>[n,digest(readFileSync(n))]));
let last=[];
for(let attempt=0;attempt<12;attempt++){
 last=await Promise.all(names.map(async name=>{try{const r=await fetch(base+name+'?release='+sha,{cache:'no-store',signal:AbortSignal.timeout(15000)});const actual=digest(Buffer.from(await r.arrayBuffer()));return {name,status:r.status,match:r.ok&&actual===expected[name],expected:expected[name],actual};}catch(e){return {name,match:false,error:String(e)};}}));
 writeFileSync(dir+'/deployment.json',JSON.stringify({commit:sha,publishedOrigin:base,attempt,files:last,at:new Date().toISOString()},null,2));
 if(last.every(x=>x.match))break;
 console.log('Deployment not synchronized yet:',last.filter(x=>!x.match).map(x=>x.name).join(', '));
 if(attempt===11)throw Error('Published application bytes do not match the merged candidate');
 await new Promise(resolve=>setTimeout(resolve,20000));
}
console.log('PUBLISHED_BYTES_VERIFIED',names.length,sha);
process.env.PUBLISHED='1';process.env.RELEASE_OUTPUT=dir;
await import('./agent-optimization-v6.mjs');
