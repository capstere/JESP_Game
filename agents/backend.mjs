import {extractAnswer,check,pause,retrySeconds} from './runtime.mjs?v=5.1.1';
export const GATEWAY='https://dzjjffgohxeoahtflqjo.supabase.co/functions/v1/jesp-gateway';
export const DEFAULT_WORKER='nvidia/nemotron-3.5-lightning:free';
export const DEFAULT_CRITIC='nvidia/nemotron-3-ultra-550b-a55b:free';
async function jsonRequest(path,body,signal){
 check(signal);const controller=new AbortController();
 const cancel=()=>controller.abort(signal?.reason||new DOMException('Avbrutet','AbortError'));
 signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Backendens tidsgräns nåddes','TimeoutError')),125000);
 try{
  const r=await fetch(GATEWAY+path,{method:body?'POST':'GET',credentials:'omit',referrerPolicy:'no-referrer',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});
  const text=await r.text();if(text.length>1500000)throw new Error('Backend-svaret är för stort.');
  let data;try{data=JSON.parse(text);}catch{throw new Error('Backend returnerade inte JSON (HTTP '+r.status+').');}
  if(!r.ok){const e=new Error(data.error+(data.detail?' · '+data.detail:''));e.status=r.status;e.retryAfter=retrySeconds(r.headers.get('Retry-After'));throw e;}
  return data;
 }catch(e){if(controller.signal.aborted)throw controller.signal.reason;throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export async function backendModels(signal){const d=await jsonRequest('/models',null,signal);if(!Array.isArray(d.models))throw new Error('Ogiltig modellkatalog.');return d.models.filter(m=>m.supported_parameters?.includes('tools')&&!/content-safety/.test(m.id));}
export async function backendAsk(ai,messages,signal,maxTokens=4096,tools){
 const model=ai.role==='critic'?ai.criticModel:ai.workerModel;
 if(!model)throw new Error('Välj en tillgänglig gratismodell för arbete och granskning.');
 if(JSON.stringify(messages).length>160000)throw new Error('Arbetskontexten överskrider backendens gräns. Dela upp uppdraget.');
 const effort=ai.reasoning==='auto'?(ai.effectiveReasoning||'medium'):ai.reasoning||'medium';
 let inputs=messages;
 if(ai.jsonProtocol&&tools?.length){inputs=[...messages,{role:'user',content:'Use validated JSON only. Return {"kind":"actions","actions":[{"tool":"name","args":{}}]} or {"kind":"final","answer":"..."}. During initial strategy return one submit_strategy action. Tool schemas: '+JSON.stringify(tools)}];tools=undefined;}
 for(let attempt=0;attempt<2;attempt++){
  check(signal);ai.onStatus((ai.role==='critic'?'Granskare: ':'Arbetsmodell: ')+model+' · anonym backend');ai.calls++;
  try{
   const data=await jsonRequest('/chat',{model,messages:inputs,max_tokens:maxTokens<=64?1024:12288,reasoning:effort,...(tools?{tools}:{})},signal);
   let result;
   try{result=extractAnswer(data);}catch(e){
    if(/ogiltigt verktygsanrop|fler än fyra samtidiga|Avslut saknar svarstext/.test(e.message||'')){ai.jsonProtocol=true;return {text:'',protocolError:'Ogiltigt funktionsanrop. Inget kördes. Använd komplett JSON nästa gång.',model:data.model,truncated:false,usage:data.usage};}
    throw e;
   }
   ai.lastModel=result.model;
   if(result.truncated&&ai.reasoning==='auto')ai.effectiveReasoning='low';
   return {...result,usage:data.usage,requestedReasoning:effort,requestedModel:model,gatewayVersion:data.gateway_version};
  }catch(e){
   check(signal);const seconds=e.retryAfter||5;
   if(attempt||![429,500,502,503,504].includes(e.status)||seconds>90)throw e;
   ai.onStatus('Backend HTTP '+e.status+'. Respekterar väntetiden '+seconds+' s; ett återförsök.');await pause(seconds*1000,signal);
  }
 }
}
