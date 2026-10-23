// Code runs only after explicit opt-in, in an opaque-origin iframe + disposable worker.
// No same-origin access, fetch, sockets, images, forms, popups or persistent storage.
export function executeJS(code, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (typeof code !== 'string' || code.length > 30000) return Promise.reject(new Error('Testkoden är för stor.'));
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');frame.hidden=true;frame.sandbox='allow-scripts';frame.title='Isolerat kodtest';
    const nonce=crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');let done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',stop);frame.remove();error?reject(error):resolve(value);};
    const stop=()=>finish(signal.reason||new DOMException('Avbrutet','AbortError'));
    const timer=setTimeout(()=>finish(new Error('Kodtestet stoppades efter 4 sekunder.')),4000);
    const receive=e=>{
      if(e.source!==frame.contentWindow||e.data?.nonce!==nonce)return;
      if(e.data.ready){frame.contentWindow.postMessage({nonce,code},'*');return;}
      if(e.data.error)finish(new Error(String(e.data.error).slice(0,1000)));
      else if(e.data.result)finish(null,e.data.result);
    };
    window.addEventListener('message',receive);signal?.addEventListener('abort',stop,{once:true});
    const workerSource=`self.onmessage=async e=>{const logs=[];let size=0;const log=(...v)=>{const t=v.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');size+=t.length;if(logs.length<40&&size<6000)logs.push(t);};console.log=console.info=console.warn=console.error=log;try{const f=new (Object.getPrototypeOf(async function(){}).constructor)('"use strict";\\n'+e.data);const value=await f();self.postMessage({passed:true,logs,value:(typeof value==='object'?JSON.stringify(value):String(value??'')).slice(0,3000),note:'Endast medföljande testkod kördes; detta är ingen fullständig säkerhets- eller funktionsgranskning.'});}catch(e){self.postMessage({passed:false,logs,error:String(e.message||e).slice(0,1000)});}};`;
    const boot=`const nonce=${JSON.stringify(nonce)};const blob=new Blob([${JSON.stringify(workerSource)}],{type:'text/javascript'});const url=URL.createObjectURL(blob);const worker=new Worker(url);URL.revokeObjectURL(url);worker.onmessage=e=>{parent.postMessage({nonce,result:e.data},'*');worker.terminate();};worker.onerror=e=>{parent.postMessage({nonce,error:e.message||'Worker-fel'},'*');worker.terminate();};window.addEventListener('message',e=>{if(e.source===parent&&e.data?.nonce===nonce)worker.postMessage(e.data.code);},{once:true});parent.postMessage({nonce,ready:true},'*');`;
    frame.srcdoc=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><script>${boot.replace(/<\/script/gi,'<\\/script')}<\/script>`;
    document.body.append(frame);
  });
}
