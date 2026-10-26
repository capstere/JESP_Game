// Accountless, fixed-destination gateway. No provider credentials or paid routes.
export const VERSION='6.3.0-stream';
const BASE='https://ai-gateway.kilo.ai/api/v1';
const ORIGIN='https://capstere.github.io';
const encoder=new TextEncoder();
let catalogue=null,expires=0,pending=null;
export const zero=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)===0;
export function freeModel(m){return !!m&&typeof m.id==='string'&&(m.id.endsWith(':free')||m.id==='kilo-auto/free')&&m.pricing&&zero(m.pricing.prompt)&&zero(m.pricing.completion)&&Object.entries(m.pricing).every(([k,v])=>k==='discount'||v===null||zero(v));}
export function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('JSON object required');
 if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>60)throw new Error('1–60 messages required');
 for(const m of body.messages){
  if(!m||!['system','user','assistant','tool'].includes(m.role))throw new Error('Invalid role');
  if(typeof m.content!=='string'&&!(m.role==='assistant'&&m.content===null&&Array.isArray(m.tool_calls)))throw new Error('Text messages only');
  if(m.tool_calls&&(!Array.isArray(m.tool_calls)||m.tool_calls.length>8))throw new Error('Invalid tool calls');
  if(m.role==='tool'&&typeof m.tool_call_id!=='string')throw new Error('Tool result ID required');
 }
 if(body.tools!==undefined&&(!Array.isArray(body.tools)||body.tools.length>24||body.tools.some(t=>t?.type!=='function'||!/^[A-Za-z0-9_-]{1,80}$/.test(t.function?.name)||!t.function?.parameters||typeof t.function.parameters!=='object')))throw new Error('Invalid tool definitions');
 if(typeof body.model!=='string'||body.model.length>180)throw new Error('Model ID required');
 const max=body.max_tokens===undefined?8192:Number(body.max_tokens);
 if(!Number.isInteger(max)||max<64||max>16384)throw new Error('max_tokens must be 64–16384');
 if(JSON.stringify(body.messages).length>160000)throw new Error('Context exceeds 160000 characters');
 return {model:body.model,messages:body.messages.map(m=>({role:m.role,content:m.content,...(m.tool_calls?{tool_calls:m.tool_calls}:{}),...(m.tool_call_id?{tool_call_id:m.tool_call_id}:{})})),max_tokens:max,stream:false,temperature:0.2,...(body.tools?.length?{tools:body.tools,tool_choice:'auto'}:{})};
}
async function boundedText(response,limit){
 const reader=response.body?.getReader();if(!reader)return '';
 const decoder=new TextDecoder();let value='',size=0;
 try{while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>limit)throw new Error('Response exceeds size limit');value+=decoder.decode(x.value,{stream:true});}return value+decoder.decode();}finally{await reader.cancel().catch(()=>{});}
}
async function models(){
 if(catalogue&&Date.now()<expires)return catalogue;
 if(pending)return pending;
 pending=(async()=>{const r=await fetch(BASE+'/models',{signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)throw new Error('Model catalogue unavailable (HTTP '+r.status+')');const data=JSON.parse(await boundedText(r,3000000));if(!Array.isArray(data.data))throw new Error('Invalid catalogue');catalogue=data.data.filter(freeModel);expires=Date.now()+30000;return catalogue;})();
 try{return await pending;}finally{pending=null;}
}
function response(value,status=200,extra={}){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Expose-Headers':'Retry-After','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
async function rpc(name,args){
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
 if(!key||!url)throw new Error('Server quota protection is unavailable');
 const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(6000)});
 if(!r.ok)throw new Error('Server quota protection is unavailable');
 const s=await r.text();return s?JSON.parse(s):null;
}
async function clientHash(req){
 const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret)throw new Error('Quota protection unavailable');
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',').at(-1)||'unknown').trim().slice(0,100);
 const bytes=await crypto.subtle.sign('HMAC',key,encoder.encode(new Date().toISOString().slice(0,10)+'|'+ip));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function sanitize(data,requested){
 if(!Array.isArray(data?.choices)||!data.choices.length)throw new Error('Provider returned no choices');
 const choices=data.choices.slice(0,1).map(c=>({index:0,finish_reason:c.finish_reason,message:{role:'assistant',content:typeof c.message?.content==='string'?c.message.content.replace(/<think>[\s\S]*?<\/think>/gi,'').trim():null,...(Array.isArray(c.message?.tool_calls)?{tool_calls:c.message.tool_calls}: {})}}));
 return {model:String(data.model||requested),requested_model:requested,choices,usage:data.usage||null,gateway_version:VERSION};
}

function safeVisibleText(raw){
 return String(raw)
 .replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi,'')
 .replace(/<think\b[^>]*>[\s\S]*$/gi,'')
 .replace(/<think[^>]*$/gi,'')
 .replace(/<(?:t|th|thi|thin)$/i,'');
}
const streamHeaders={
 'Content-Type':'text/event-stream; charset=utf-8',
 'Access-Control-Allow-Origin':ORIGIN,
 'Vary':'Origin','Cache-Control':'no-store, no-transform',
 'X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no',
 'Connection':'keep-alive'
};
export function filterStreamChunk(chunk,state){
 if(chunk?.error)throw new Error(String(chunk.error?.message||'AI provider stream error').slice(0,500));
 const result={model:typeof chunk.model==='string'?chunk.model:state.model,choices:[]};
 if(chunk.usage&&typeof chunk.usage==='object')result.usage=chunk.usage;
 for(const choice of Array.isArray(chunk.choices)?chunk.choices:[]){
  if(choice?.index!==0)continue;
  if(choice.finish_reason==='error')throw new Error('AI provider interrupted stream');
  const d=choice.delta||{},delta={};
  if(d.role==='assistant')delta.role='assistant';
  if(typeof d.content==='string'){
    state.raw+=d.content;
    if(state.raw.length>180000)throw new Error('AI answer exceeds text limit');
    const visible=safeVisibleText(state.raw);
    if(visible.length>state.sent){delta.content=visible.slice(state.sent);state.sent=visible.length;}
  }
  if(Array.isArray(d.tool_calls))delta.tool_calls=d.tool_calls.slice(0,8).map(t=>({
   index:t.index,id:typeof t.id==='string'?t.id:undefined,type:t.type==='function'?'function':undefined,
   function:t.function?{name:typeof t.function.name==='string'?t.function.name:undefined,arguments:typeof t.function.arguments==='string'?t.function.arguments:undefined}:undefined
  }));
  if(choice.finish_reason!=null)state.finished=true;
  result.choices.push({index:0,delta,finish_reason:choice.finish_reason||null});
 }
 return result;
}
function streamResponse(upstream,lease){
 let reader,releaseDone=false,cancelled=false;
 const closeLease=async()=>{
  if(releaseDone)return;releaseDone=true;
  await rpc('jesp_gateway_release',{p_lease:lease}).catch(()=>{});
 };
 const stream=new ReadableStream({
  async start(controller){
   let buffer='',bytes=0,events=0,done=false;
   const state={model:'',raw:'',sent:0,finished:false};
   const send=value=>controller.enqueue(encoder.encode('data: '+JSON.stringify(value)+'\n\n'));
   const feed=data=>{
    buffer+=data;
    if(buffer.length>250000)throw new Error('Oversize streaming event');
    let match;
    while((match=/\r?\n\r?\n/.exec(buffer))!==null){
     const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);
     const item=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
     if(!item)continue;
     if(item==='[DONE]'){
      if(!state.finished)throw new Error('Provider signalled DONE before finish_reason');
      done=true;controller.enqueue(encoder.encode('data: [DONE]\n\n'));break;
     }
     if(++events>10000)throw new Error('Too many SSE events');
     let obj;try{obj=JSON.parse(item);}catch{throw new Error('Invalid provider SSE JSON');}
     const out=filterStreamChunk(obj,state);
     if(out.model)state.model=out.model;
     if(out.choices.length||out.usage)send(out);
    }
   };
   try{
    reader=upstream.body.getReader();const decode=new TextDecoder();
    while(!done&&!cancelled){
     const part=await reader.read();if(part.done)break;
     bytes+=part.value.byteLength;if(bytes>1_200_000)throw new Error('Provider SSE limit exceeded');
     feed(decode.decode(part.value,{stream:true}));
    }
    if(!done&&!cancelled){feed(decode.decode());if(!done)throw new Error('Provider stream ended before [DONE]');}
    if(!cancelled)controller.close();
   }catch(e){
    if(!cancelled){
     try{send({error:{code:502,message:String(e?.message||'Provider stream failed').slice(0,500)}});controller.close();}catch{}
    }
   }finally{
    try{await reader?.cancel();}catch{}
    await closeLease();
   }
  },
  async cancel(){
   cancelled=true;
   try{await reader?.cancel();}catch{}
   await closeLease();
  }
 });
 return new Response(stream,{headers:streamHeaders});
}

export async function handle(req){
 const origin=req.headers.get('origin');if(origin&&origin!==ORIGIN)return response({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Access-Control-Max-Age':'600','Vary':'Origin'}});
 const path=new URL(req.url).pathname;
 if(req.method==='GET'&&path.endsWith('/health'))return response({version:VERSION,inference_enabled:true,login_required:false,provider:'Kilo anonymous free models',limits:{project_per_hour:150,client_per_hour:90,project_per_day:1000,project_per_month:10000,max_output_tokens:16384,max_input_characters:160000},note:'Provider quotas also apply. Catalogue size is not a quality guarantee.'});
 if(req.method==='GET'&&path.endsWith('/models')){try{return response({models:(await models()).map(m=>({id:m.id,name:m.name,context_length:m.context_length,pricing:m.pricing,supported_parameters:m.supported_parameters})),authenticated:false});}catch(e){return response({error:e.message},503);}}
 if(req.method!=='POST'||!path.endsWith('/chat-stream'))return response({error:'Not found'},404);
 if(!(req.headers.get('content-type')||'').startsWith('application/json'))return response({error:'JSON required'},415);
 if(Number(req.headers.get('content-length')||0)>240000)return response({error:'Payload too large'},413);
 let input,payload;
 try{input=JSON.parse(await boundedText(req,240000));payload=validate(input);}catch(e){return response({error:e.message},400);}
 let lease,leasedToStream=false;
 try{
  const selected=(await models()).find(m=>m.id===payload.model);if(!selected)return response({error:'Only currently listed zero-price free models are allowed. Refresh the catalogue.'},403);
  const gate=await rpc('jesp_gateway_reserve',{p_client:await clientHash(req)});
  if(!gate?.allowed)return response({error:'Free gateway quota reached',reason:gate?.reason,retry_after:gate?.retry_after||60},429,{'Retry-After':String(gate?.retry_after||60)});
  lease=gate.lease;
  if(selected.supported_parameters?.includes('reasoning'))payload.reasoning={effort:['low','medium','high'].includes(input.reasoning)?input.reasoning:'medium',exclude:true};
  const signal=AbortSignal.any([req.signal,AbortSignal.timeout(110000)]);
  payload.stream=true;
  const r=await fetch(BASE+'/chat/completions',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','X-KiloCode-Version':'JESP-6.3'},body:JSON.stringify(payload)});
  if(!r.ok){
   const raw=await boundedText(r,10000);
   return response({error:'AI provider HTTP '+r.status,detail:raw.slice(0,700)},r.status,{'Retry-After':r.headers.get('retry-after')||'30'});
  }
  if(!r.body||!/text\/event-stream/i.test(r.headers.get('content-type')||''))return response({error:'Provider refused streaming protocol'},502);
  leasedToStream=true;
  return streamResponse(r,lease);
 }catch(e){return response({error:e.name==='TimeoutError'?'AI response timed out':e.message||'Gateway unavailable'},e.name==='TimeoutError'?504:503);}
 finally{if(lease&&!leasedToStream)await rpc('jesp_gateway_release',{p_lease:lease}).catch(()=>{});}
}
if(typeof Deno!=='undefined')Deno.serve(handle);
