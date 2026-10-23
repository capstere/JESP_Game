// Same FPS task and independent acceptance assertions; compare the worker/critic assignment.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
let text=readFileSync(new URL('./backend-live-v6.mjs',import.meta.url),'utf8');
text=text.replace("const dir='backend-live-evidence'","const dir='backend-cross-evidence'")
 .replace("selectOption('#workerModel','nvidia/nemotron-3-ultra-550b-a55b:free')","selectOption('#workerModel','kilo-auto/free')")
 .replace("selectOption('#criticModel','kilo-auto/free')","selectOption('#criticModel','nvidia/nemotron-3-ultra-550b-a55b:free')");
const file=new URL('./_cross_live.generated.mjs',import.meta.url);writeFileSync(file,text);
try{await import(file.href);}finally{unlinkSync(file);}
