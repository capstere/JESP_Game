// Native OpenAI-style function calls are normalized to the same validated action loop.
const string={type:'string'};
const definition=(name,description,properties,required)=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
export function toolDefinitions({web=true,allowCode=false}={}){
 return [
  ...(web?[
   definition('search','Search public web sources. Read returned evidence before deciding the next step.',{query:string},['query']),
   definition('read_url','Read a public HTTPS URL already supplied by the user or returned by search.',{url:string},['url'])
  ]:[]),
  ...(web?[definition('verify_quote','Check whether a quote occurs in an actually read source. A match is not proof of interpretation or truth.',{source_id:string,quote:string},['source_id','quote'])]:[]),
  definition('calculate','Evaluate arithmetic with + - * / % ** and parentheses. No programming code.',{expression:string},['expression']),
  definition('write_file','Create or replace a complete small text/code file in the in-memory workspace.',{name:string,content:string},['name','content']),
  definition('read_file','Read an existing file in the workspace.',{name:string},['name']),
  definition('inspect_file','Check JSON syntax, or report text file structure. Does NOT execute code.',{name:string},['name']),
  definition('finish','Finish the task with a concise final answer, after completing all requested files and checks. Do not claim work without tool evidence.',{answer:string},['answer']),
  ...(allowCode?[definition('test_js','Run an explicitly authorized JavaScript assertion test, without network, DOM, imports or packages. Throw Error on failure. An optional named file is prepended to code.',{name:string,code:string},['code'])]:[])
 ];
}
export function reviewDefinitions(advanced=false){
 const props={answer:string,issues:{type:'array',maxItems:12,items:string},verdict:{type:'string',enum:['pass','revise']}};
 const required=['answer','issues','verdict'];
 if(advanced){
  props.checks={type:'array',minItems:1,maxItems:6,items:{type:'object',properties:{
   id:string,status:{type:'string',enum:['pass','fail','unknown']},evidence:{type:'array',minItems:1,maxItems:6,items:string},finding:string
  },required:['id','status','evidence','finding'],additionalProperties:false}};
  props.answer_check={type:'object',properties:{status:{type:'string',enum:['pass','fail','unknown']},evidence:{type:'array',minItems:1,maxItems:6,items:string},finding:string},required:['status','evidence','finding'],additionalProperties:false};
  required.push('checks','answer_check');
 }
 return [definition('submit_review','Submit SHORT evidence-based verdict for each criterion and the exact candidate answer. Use existing tool/file references. Never invent test passes.',props,required)];
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
 if(actions.length===1&&!actions[0].argumentError&&['finish','submit_review'].includes(actions[0].tool)){
  const a=actions[0];if(typeof a.args.answer!=='string'||!a.args.answer.trim())throw new Error('Avslut saknar svarstext.');
  return {text:JSON.stringify(a.tool==='finish'?{kind:'final',answer:a.args.answer}:{answer:a.args.answer,issues:Array.isArray(a.args.issues)?a.args.issues:[],verdict:a.args.verdict,...(Array.isArray(a.args.checks)?{checks:a.args.checks}:{}),...(a.args.answer_check&&typeof a.args.answer_check==='object'?{answer_check:a.args.answer_check}:{})})};
 }
 return {text:JSON.stringify({kind:'actions',actions}),toolCalls,nativeContent:typeof message.content==='string'?message.content:null};
}
