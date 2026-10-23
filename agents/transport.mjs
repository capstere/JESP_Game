import {AI as ProviderAI,pause,check} from './runtime.mjs?v=5.1.1';
export function transientDelay(error,attempt) {
 if(![502,503,504].includes(error?.status)||attempt>=2)return null;
 const seconds=Number(error.retryAfter)||31;
 if(seconds>120)return null;
 return Math.max(31,seconds+1)*1000;
}
// Retry only transient server errors. No new provider/account, no quota bypass.
export class AI extends ProviderAI {
 async requestOnce(...args){return super.ask(...args);}
 async wait(ms,signal){return pause(ms,signal);}
 async ask(messages,signal,maxTokens,tools) {
  for(let attempt=0;attempt<3;attempt++){
   check(signal);
   try{return await this.requestOnce(messages,signal,maxTokens,tools);}
   catch(error){
    check(signal);const delay=transientDelay(error,attempt);if(delay===null)throw error;
    this.onStatus(`Tillfälligt serverfel ${error.status}. Behåller arbetet och väntar ${Math.ceil(delay/1000)} s före återförsök ${attempt+1}/2.`);
    await this.wait(delay,signal);
   }
  }
 }
}
