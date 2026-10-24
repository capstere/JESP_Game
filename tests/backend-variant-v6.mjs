// Identical full task and independent assertions across the two worker assignments.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const worker=process.env.AGENT_WORKER;
if(!['nvidia/nemotron-3.5-lightning:free','kilo-auto/free'].includes(worker))throw new Error('Unexpected worker');
let text=readFileSync(new URL('./backend-live-v6.mjs',import.meta.url),'utf8');
text=text.replace("const dir='backend-live-evidence'","const dir='backend-variant-evidence'")
 .replace("selectOption('#workerModel','nvidia/nemotron-3-ultra-550b-a55b:free')","selectOption('#workerModel',"+JSON.stringify(worker)+")")
 .replace("selectOption('#criticModel','kilo-auto/free')","selectOption('#criticModel','nvidia/nemotron-3-ultra-550b-a55b:free')");
const file=new URL('./_variant_live.generated.mjs',import.meta.url);writeFileSync(file,text);
try{await import(file.href);}finally{unlinkSync(file);}
