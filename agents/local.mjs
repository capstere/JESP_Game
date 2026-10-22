import {check} from './core.mjs';
let engine=null, worker=null;
async function bounded(work,signal,ms){
 check(signal);let abort;
 const cancelled=new Promise((_,reject)=>{abort=()=>reject(signal.reason||new DOMException('Avbrutet','AbortError'));signal.addEventListener('abort',abort,{once:true});});
 let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new DOMException('Den lokala motorn nådde tidsgränsen.','TimeoutError')),ms);});
 try{return await Promise.race([work(),cancelled,timeout]);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
export async function localAnswer(messages,signal,maxTokens,onStatus) {
 check(signal);
 if(!navigator.gpu)throw new Error('WebGPU saknas. Använd online-läget, eller den mindre CPU-modellen i den klassiska chatten.');
 const stop=()=>{worker?.terminate();worker=null;engine=null;};signal.addEventListener('abort',stop,{once:true});
 try{
  if(!engine){
   onStatus('Hämtar lokal Qwen3 1.7B. Första gången krävs ungefär 1–2 GB och flera GB ledigt minne.');
   const {CreateWebWorkerMLCEngine}=await bounded(()=>import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm'),signal,30000);
   check(signal);worker=new Worker(new URL('./local-worker.mjs',import.meta.url),{type:'module'});
   const instance=await bounded(()=>CreateWebWorkerMLCEngine(worker,'Qwen3-1.7B-q4f16_1-MLC',{initProgressCallback:r=>{if(!signal.aborted)onStatus('Lokal modell: '+r.text);}},{context_window_size:8192}),signal,600000);
   check(signal);engine=instance;
  }
  onStatus('Agenten arbetar med Qwen3 på din enhet…');
  const result=await bounded(()=>engine.chat.completions.create({messages:messages.map(m=>({...m,content:m.role==='user'?m.content+'\n/no_think':m.content})),max_tokens:maxTokens,temperature:0.2,stream:false}),signal,180000);
  check(signal);const choice=result.choices?.[0];if(!choice?.message?.content)throw new Error('Den lokala modellen gav inget svar.');
  return {text:choice.message.content,model:'Qwen3 1.7B · på enheten',truncated:choice.finish_reason==='length'};
 }catch(e){stop();throw e;}finally{signal.removeEventListener('abort',stop);}
}
export async function unloadLocal(){worker?.terminate();worker=null;engine=null;}
