// Native OpenAI-style function calls are normalized to the same validated action loop.
const string={type:'string'};
const definition=(name,description,properties,required)=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
export function toolDefinitions({web=true,allowCode=false}={}){
 return [
  ...(web?[
   definition('search','Search public web sources. Read returned evidence before deciding the next step.',{query:string},['query']),
   definition('read_url','Read a public HTTPS URL already supplied by the user or returned by search.',{url:string},['url'])
  ]:[]),
  definition('calculate','Evaluate arithmetic with + - * / % ** and parentheses. No programming code.',{expression:string},['expression']),
  definition('write_file','Create or replace a complete small text/code file in the in-memory workspace.',{name:string,content:string},['name','content']),
  definition('read_file','Read an existing file in the workspace.',{name:string},['name']),
  definition('inspect_file','Check JSON syntax, or report text file structure. Does NOT execute code.',{name:string},['name']),
  ...(allowCode?[definition('test_js','Run an explicitly authorized JavaScript assertion test, without network, DOM, imports or packages. Throw Error on failure. An optional named file is prepended to code.',{name:string,code:string},['code'])]:[])
 ];
}
export function decodeNativeCalls(message){
 if(!Array.isArray(message?.tool_calls)||!message.tool_calls.length)return null;
 if(message.tool_calls.length>4)throw new Error('AI:n begärde fler än fyra samtidiga verktyg; inget kördes.');
 const ids=new Set();const actions=[];const toolCalls=[];
 for(const call of message.tool_calls){
  if(call?.type!=='function'||typeof call.id!=='string'||!call.id||call.id.length>200||ids.has(call.id)||typeof call.function?.name!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(call.function.name))throw new Error('AI:n skickade ett ogiltigt verktygsanrop.');
  ids.add(call.id);const raw=call.function.arguments;let args,argumentError;
  try{args=typeof raw==='string'?JSON.parse(raw):raw;if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Argumenten måste vara ett JSON-objekt.');}catch(e){args={};argumentError='Felaktiga verktygsargument: '+e.message;}
  toolCalls.push({id:call.id,type:'function',function:{name:call.function.name,arguments:typeof raw==='string'?raw:JSON.stringify(raw??{})}});
  actions.push({tool:call.function.name,args,...(argumentError?{argumentError}:{})});
 }
 return {text:JSON.stringify({kind:'actions',actions}),toolCalls,nativeContent:typeof message.content==='string'?message.content:null};
}
