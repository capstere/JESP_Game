// Identical build task and gameplay requirements, with the measured faster worker.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
let text=readFileSync(new URL('./backend-live-v6.mjs',import.meta.url),'utf8');
text=text.replace("const dir='backend-live-evidence'","const dir='backend-hardened-evidence'")
 .replace("selectOption('#workerModel','nvidia/nemotron-3-ultra-550b-a55b:free')","selectOption('#workerModel','nvidia/nemotron-3.5-lightning:free')")
 .replace("selectOption('#criticModel','kilo-auto/free')","selectOption('#criticModel','nvidia/nemotron-3-ultra-550b-a55b:free')");
const file=new URL('./_hardened_live.generated.mjs',import.meta.url);writeFileSync(file,text);
try{await import(file.href);}finally{unlinkSync(file);}
