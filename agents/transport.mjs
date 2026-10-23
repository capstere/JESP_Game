import {AI as ProviderAI,pause,check} from './runtime.mjs?v=5.1.1';
export function transientDelay(error,attempt) {
 if(![500,502,503,504].includes(error?.status)||attempt>=2)return null;
 const seconds=Number(error.retryAfter)||31;
 if(seconds>120)return null;
 return Math.max(31,seconds+1)*1000;
}
// Retry only transient server errors. No new provider/account, no quota bypass.
export class AI extends ProviderAI {
 async requestOnce(...args){return super.ask(...args);}
 async wait(ms,signal){return pause(ms,signal);}
 async ask(messages,signal,maxTokens,tools) {
  if(this.jsonProtocol&&tools?.length){
   messages=[...messages,{role:'user',content:'Native function calls are disabled for this recovery. Return ONLY JSON, no code fences: {"kind":"actions","actions":[{"tool":"TOOL_NAME","args":{...}}]} or {"kind":"final","answer":"..."}. For the initial strategy use a single submit_strategy action. Tool names and argument schemas: '+JSON.stringify(tools.map(t=>({name:t.function.name,parameters:t.function.parameters})))}];
   tools=undefined;
  }
  for(let attempt=0;attempt<3;attempt++){
   check(signal);
   try{return await this.requestOnce(messages,signal,maxTokens,tools);}
   catch(error){
    check(signal);
    if(!error.status && /AI:n skickade ett ogiltigt verktygsanrop|fler än fyra samtidiga verktyg|Avslut saknar svarstext/.test(error.message||'')){
     this.jsonProtocol=true;
     this.onStatus('Modellen gav ett ogiltigt funktionsanrop. Inget kördes; nästa beslut använder validerad JSON i stället.');
     return {text:'',protocolError:'Ogiltigt native-anrop. Svara med ett komplett JSON-beslut; inga åtgärder ur det felaktiga svaret kördes.',model:this.lastModel||'ej rapporterad',truncated:false};
    }
    const delay=transientDelay(error,attempt);if(delay===null)throw error;
    this.onStatus(`Tillfälligt serverfel ${error.status}. Behåller arbetet och väntar ${Math.ceil(delay/1000)} s före återförsök ${attempt+1}/2.`);
    await this.wait(delay,signal);
   }
  }
 }
}
