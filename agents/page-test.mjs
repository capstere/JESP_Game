// Opt-in DOM testing in an opaque-origin iframe. No same-origin access or external resources.
// The watchdog is best effort: a synchronous infinite loop may require closing the tab.
import {ASSERT_HARNESS} from './test-harness.mjs?v=6.1.0';
const escapeScript = s => s.replace(/<\/script/gi,'<\\/script');
export function buildTestPage(files,page,code,nonce) {
  if(typeof DOMParser==='undefined')throw Error('Browserns DOM-parser saknas.');
  if(typeof code!=='string'||!code.trim()||code.length>8000)throw Error('Sidtest kräver 1–8000 tecken testkod.');
  const html=files.get(page);if(!html||!page.endsWith('.html'))throw Error('HTML-filen saknas.');
  const doc=new DOMParser().parseFromString(html.content,'text/html');
  const used=new Map([[html.name,html.version]]);
  const resource=raw=>{const name=String(raw).replace(/^\.\//,'').split(/[?#]/)[0];if(!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*\.(?:js|css)$/u.test(name)||!files.has(name))throw Error('Sidtest stöder bara befintliga lokala resurser: '+raw);const f=files.get(name);used.set(name,f.version);return f;};
  doc.querySelectorAll('base,meta[http-equiv],iframe,frame,object,embed').forEach(e=>e.remove());
  for(const el of doc.querySelectorAll('script')){
    if(el.type&&el.type!=='text/javascript'&&el.type!=='application/javascript')throw Error('Sidtest stöder klassiska scripts, inte '+el.type);
    if(el.hasAttribute('src')){const f=resource(el.getAttribute('src'));el.removeAttribute('src');el.textContent=f.content;}
    el.removeAttribute('async');el.removeAttribute('defer');
    el.textContent=escapeScript(el.textContent);
  }
  for(const el of doc.querySelectorAll('link')){
    if(el.rel==='stylesheet'){const f=resource(el.getAttribute('href'));const style=doc.createElement('style');style.textContent=f.content;el.replaceWith(style);}else el.remove();
  }
  // Make forms, navigation and externally embedded media inert before insertion.
  for(const el of doc.querySelectorAll('*'))for(const a of [...el.attributes]){
    if(/^(?:href|action|formaction|srcset|ping|target)$/i.test(a.name))el.removeAttribute(a.name);
    if(a.name==='src'&&!/^data:image\//i.test(a.value))el.removeAttribute(a.name);
  }
  const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
  const boot=doc.createElement('script');
  // Listener and channel are installed before application code, diagnostics stay local.
  boot.textContent=escapeScript(`(()=>{const send=parent.postMessage.bind(parent),token=${JSON.stringify(nonce)},errors=[],logs=[];let sent=false;const sleep=ms=>new Promise(r=>setTimeout(r,Math.min(1500,Math.max(0,Number(ms)||0))));window.addEventListener('error',e=>errors.push(String(e.message).slice(0,500)));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason).slice(0,500)));window.addEventListener('securitypolicyviolation',e=>errors.push('Blocked resource: '+e.violatedDirective));for(const k of ['log','info','warn','error'])console[k]=(...v)=>{if(logs.length<20)logs.push(v.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ').slice(0,600));};const report=r=>{if(!sent){sent=true;send({nonce:token,result:{...r,logs,errors}},'*');}};window.addEventListener('load',async()=>{let __pageCount=0;try{await sleep(80);if(errors.length)throw Error(errors.join('; '));const run=async()=>{${ASSERT_HARNESS}\nconst wait=sleep;const key=async(k,ms=100)=>{const key=k==='Space'?' ':k,code=k==='Space'?'Space':k.length===1?'Key'+k.toUpperCase():k;const options={key,code,bubbles:true,cancelable:true};document.dispatchEvent(new KeyboardEvent('keydown',options));await sleep(ms);document.dispatchEvent(new KeyboardEvent('keyup',options));await sleep(50);};const click=s=>{const e=document.querySelector(s);assert(e,'Missing element: '+s);e.click();};const input=(s,value)=>{const e=document.querySelector(s);assert(e,'Missing input: '+s);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};\n${code}\nreturn __jesp_assertions;};__pageCount=await run();if(errors.length)throw Error(errors.join('; '));report({passed:__pageCount>0,assertions:__pageCount,error:__pageCount?null:'No assertions'});}catch(e){report({passed:false,assertions:__pageCount,error:String(e.message||e).slice(0,1800)});}});setTimeout(()=>report({passed:false,assertions:0,error:'Sidtestets tidsgräns nåddes.'}),8000);})();`);
  doc.head.prepend(boot);doc.head.prepend(csp);
  return {html:'<!doctype html>'+doc.documentElement.outerHTML,versions:[...used].map(([name,version])=>({name,version}))};
}
export async function executePageTest(files,args,signal) {
  if(signal?.aborted)throw signal.reason;
  const nonce=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');const built=buildTestPage(files,args.page,args.code,nonce);
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');frame.sandbox='allow-scripts';frame.referrerPolicy='no-referrer';frame.title='Isolerat beteendetest';frame.style.cssText='position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0';
    let done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',stop);frame.remove();error?reject(error):resolve({...value,versions:built.versions,scope:'Browserram, lokala klassiska script, syntetisk input. Ingen prestanda- eller full säkerhetsgaranti.'});};
    const stop=()=>finish(signal.reason||new DOMException('Avbrutet','AbortError'));
    const receive=e=>{if(e.source===frame.contentWindow&&e.data?.nonce===nonce&&e.data.result){const r=e.data.result;finish(null,{passed:r.passed===true,assertions:Number(r.assertions)||0,error:typeof r.error==='string'?r.error:null,logs:Array.isArray(r.logs)?r.logs.slice(0,20):[],errors:Array.isArray(r.errors)?r.errors.slice(0,20):[]});}};
    const timer=setTimeout(()=>finish(null,{passed:false,assertions:0,error:'Sidtestet svarade inte inom 10 sekunder.'}),10000);
    window.addEventListener('message',receive);signal?.addEventListener('abort',stop,{once:true});frame.srcdoc=built.html;document.body.append(frame);
  });
}
