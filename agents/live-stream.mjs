// OpenAI-compatible SSE reader for live model output.
// Collect complete native tool calls before returning: partial actions are NEVER executable.
const MAX_BYTES=1_200_000;
const MAX_TEXT=180_000;
export function visibleText(source=''){
  return String(source)
    .replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi,'')
    .replace(/<think\b[^>]*>[\s\S]*$/gi,'')
    .replace(/<think[^>]*$/gi,'')
    .replace(/<(?:t|th|thi|thin)$/i,'');
}
function streamError(message,status=502){
 const error=new Error(String(message).slice(0,600));error.status=status;error.streamPartial=true;return error;
}
function normalError(data,status){
 const error=streamError(data?.error?.message||data?.error||'Streamförfrågan misslyckades.',status);
 const retry=Number(data?.retry_after);
 if(Number.isFinite(retry)&&retry>0)error.retryAfter=retry;
 return error;
}
export async function consumeChatStream(response,{signal,onToken=()=>{},requestedModel='',maxBytes=MAX_BYTES}={}){
 if(!response.ok){
  const raw=(await response.text()).slice(0,3000);
  let data={error:raw};try{data=JSON.parse(raw);}catch{}
  const err=normalError(data,response.status);
  const seconds=Number(response.headers.get('Retry-After'));
  if(Number.isFinite(seconds)&&seconds>0)err.retryAfter=seconds;
  err.streamPartial=false;
  throw err;
 }
 if(!/text\/event-stream/i.test(response.headers.get('content-type')||''))throw streamError('Streamingservern skickade inte SSE.',502);
 if(!response.body)throw streamError('Streamingservern skickade ingen dataström.',502);
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='',bytes=0,content='',previewLength=0,model=requestedModel,usage=null,finish=null,done=false,gatewayVersion=null;
 const calls=new Map();
 function emitFrame(frame){
  if(!frame.trim())return;
  const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
  if(!data||done)return;
  if(data==='[DONE]'){done=true;return;}
  let chunk;try{chunk=JSON.parse(data);}catch{throw streamError('Ogiltigt SSE-data från AI-tjänsten.',502);}
  if(chunk.error){const err=normalError(chunk,Number(chunk.error.code)||502);err.streamPartial=true;throw err;}
  if(typeof chunk.model==='string')model=chunk.model;
  if(chunk.usage)usage=chunk.usage;
  if(chunk.gateway_version)gatewayVersion=chunk.gateway_version;
  for(const choice of chunk.choices||[]){
   if(choice.index!==0)continue;
   if(choice.finish_reason==='error')throw streamError('AI-leverantören avbröt dataströmmen.',502);
   if(choice.finish_reason!==null&&choice.finish_reason!==undefined)finish=choice.finish_reason;
   const delta=choice.delta||{};
   if(typeof delta.content==='string'){
    content+=delta.content;
    if(content.length>MAX_TEXT)throw streamError('AI-svaret överskred streaminggränsen.',502);
    const visible=visibleText(content);
    if(visible.length>previewLength){
     onToken(visible.slice(previewLength));
     previewLength=visible.length;
    }
   }
   if(Array.isArray(delta.tool_calls))for(let i=0;i<delta.tool_calls.length;i++){
    const part=delta.tool_calls[i],index=Number.isInteger(part.index)?part.index:i;
    if(index<0||index>7)throw streamError('För många strömmade verktygsanrop.',502);
    const previous=calls.get(index)||{id:'',type:'function',function:{name:'',arguments:''}};
    if(typeof part.id==='string'){
     if(!previous.id)previous.id=part.id;
     else if(part.id!==previous.id)previous.id+=part.id;
    }
    if(part.type==='function')previous.type='function';
    if(typeof part.function?.name==='string'){
     const next=part.function.name;
     previous.function.name+=previous.function.name===next?'':next;
    }
    if(typeof part.function?.arguments==='string')previous.function.arguments+=part.function.arguments;
    calls.set(index,previous);
   }
  }
 }
 function feed(data){
  buffer+=data;
  if(buffer.length>maxBytes)throw streamError('Ett SSE-paket överskred storleksgränsen.',502);
  let separator;
  while((separator=/\r?\n\r?\n/.exec(buffer))!==null){
   const frame=buffer.slice(0,separator.index);
   buffer=buffer.slice(separator.index+separator[0].length);
   emitFrame(frame);
  }
 }
 try{
  while(!done){
   if(signal?.aborted)throw signal.reason||new DOMException('Avbrutet','AbortError');
   const part=await reader.read();
   if(part.done)break;
   bytes+=part.value.byteLength;
   if(bytes>maxBytes)throw streamError('Streamingserverns svar blev för stort.',502);
   feed(decoder.decode(part.value,{stream:true}));
  }
  feed(decoder.decode());
  if(!done)throw streamError('AI-strömmen avslutades innan [DONE]. Inga ofullständiga verktygsanrop kördes.',502);
  if(!finish)throw streamError('AI-strömmen saknar fullständig finish_reason.',502);
  const message={role:'assistant',content:content||null};
  if(calls.size)message.tool_calls=[...calls.entries()].sort((a,b)=>a[0]-b[0]).map(([,call])=>call);
  return {model,requested_model:requestedModel,choices:[{index:0,finish_reason:finish,message}],usage,gateway_version:gatewayVersion};
 }finally{
  try{await reader.cancel();}catch{}
  reader.releaseLock();
 }
}
