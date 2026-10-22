import {requestedFiles,sourceDocuments,cleanText,textQuality,verifyQuote} from './evidence.mjs?v=5.1.0';
import {decodeNativeCalls} from './protocol.mjs?v=5.1.0';
import {runAgentImpl} from './runner.mjs?v=5.1.0';
/* JESP AI v5. No API keys, paid routes, accounts or persistent prompt storage. */
export const VERSION = '5.1.0';
const POLL = 'https://text.pollinations.ai/openai';
const KILO = 'https://ai-gateway.kilo.ai/api/v1';
const enc = new TextEncoder();
export const check = signal => { if (signal?.aborted) throw signal.reason || new DOMException('Avbrutet', 'AbortError'); };
export function pause(ms, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    const end = () => {signal?.removeEventListener('abort', stop); resolve();};
    const timer = setTimeout(end, ms);
    const stop = () => {clearTimeout(timer); signal.removeEventListener('abort', stop); reject(signal.reason || new DOMException('Avbrutet','AbortError'));};
    signal?.addEventListener('abort', stop, {once:true});
  });
}
export function retrySeconds(value, now = Date.now()) {
  if (!value) return 31;
  const seconds = /^\d+(\.\d+)?$/.test(value) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 31;
}
async function limitedText(r, max = 450000) {
  const reader = r.body.getReader(), decoder = new TextDecoder();
  let text = '', size = 0;
  try { while (true) {const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > max) throw new Error('Tjänstens svar överskred storleksgränsen.'); text += decoder.decode(value,{stream:true});} return text + decoder.decode(); }
  finally {await reader.cancel().catch(()=>{});}
}
async function request(url, {signal, body, headers = {}, timeout = 60000, consume} = {}) {
  check(signal);
  const ctl = new AbortController();
  const abort = () => ctl.abort(signal.reason);
  signal?.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(()=>ctl.abort(new DOMException('Tjänsten svarade inte inom tidsgränsen.','TimeoutError')),timeout);
  try {
    const r = await fetch(url, {method:body === undefined ? 'GET':'POST', credentials:'omit', referrerPolicy:'no-referrer', signal:ctl.signal, headers:{...(body === undefined ? {} : {'Content-Type':'application/json'}), ...headers}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    if (!r.ok) {
      const raw = await limitedText(r, 30000);
      const error = new Error(`HTTP ${r.status}: ${raw.slice(0,350)}`);
      error.status = r.status; error.retryAfter = retrySeconds(r.headers.get('Retry-After') || raw.match(/Retry after\s+(\d+)s/i)?.[1]);
      error.freeLimit = /FREE_LIMIT/.test(raw); throw error;
    }
    return consume ? await consume(r) : JSON.parse(await limitedText(r));
  } catch (e) { if (ctl.signal.aborted) throw ctl.signal.reason; throw e; }
  finally {clearTimeout(timer); signal?.removeEventListener('abort',abort);}
}
export function extractAnswer(data) {
  if (data?.error) throw new Error(data.error.message || String(data.error));
  const choice = data?.choices?.[0];
  if(choice?.finish_reason==='length')return {text:'',model:String(data.model||'okänt modellalias'),truncated:true,usage:data.usage||null};
  const native=decodeNativeCalls(choice?.message);
  if(native)return {...native,model:String(data.model||'okänt modellalias'),truncated:choice.finish_reason==='length',usage:data.usage||null};
  let text = choice?.message?.content;
  if (Array.isArray(text)) text = text.filter(p=>p.type === 'text').map(p=>p.text).join('\n');
  if (typeof text !== 'string' || !text.trim()) {
    const info = {model:data?.model,finish:choice?.finish_reason,fields:Object.keys(choice?.message||{}),usage:data?.usage};
    throw new Error('AI:n gav inget slutsvar. ' + (choice?.finish_reason === 'length' ? 'Svarstoken tog slut före sluttexten. ' : '') + JSON.stringify(info));
  }
  return {text:text.trim(), model:String(data.model || 'okänt modellalias'), truncated:choice.finish_reason === 'length',usage:data.usage||null};
}
let nextPoll = 0;
function savedNext() {try{return Number(localStorage.getItem('jesp-next-anonymous-call')) || 0;}catch{return 0;}}
function setNext(time) {nextPoll = time; try{localStorage.setItem('jesp-next-anonymous-call',String(time));}catch{}}
export function freeModel(m) {
  if (typeof m?.id !== 'string' || !(m.id.endsWith(':free') || m.id === 'kilo-auto/free')) return false;
  const p = m.pricing;
  return !!p && ['prompt','completion'].every(k => (typeof p[k] === 'number' || typeof p[k] === 'string' && p[k].trim() !== '') && Number(p[k]) === 0) && Object.values(p).every(v=>v === null || v === undefined || Number(v) === 0);
}
export async function freeModels(signal) {
  const list = await request(KILO + '/models',{signal,timeout:20000});
  return (Array.isArray(list.data) ? list.data : []).filter(freeModel);
}
export class AI {
  constructor({provider = 'pollinations', model = '', onStatus = ()=>{}, local = null, reasoning = 'auto'} = {}) {Object.assign(this,{provider,model,onStatus,local}); this.reasoning=['auto','low','medium','high'].includes(reasoning)?reasoning:'auto'; this.effectiveReasoning=this.reasoning==='auto'?'medium':this.reasoning; this.calls=0; this.lastModel='';}
  async ask(messages, signal, maxTokens = 1800, tools) {
    check(signal);
    const effort=this.effectiveReasoning;
    if (this.provider==='pollinations') {
      messages=messages.map(m=>({...m}));
      const system=messages.find(m=>m.role==='system');
      const instruction='Reasoning: '+effort+'.\n';
      if(system)system.content=instruction+system.content;else messages.unshift({role:'system',content:instruction});
    }
    if (JSON.stringify(messages).length > 65000) throw new Error('Uppdragets kontext är för stor. Dela upp det i mindre uppdrag.');
    if (this.provider === 'local') {
      if (!this.local) throw new Error('Den lokala motorn är inte tillgänglig.');
      this.calls++; const answer = await this.local(messages,signal,maxTokens,this.onStatus); this.lastModel=answer.model; return answer;
    }
    if (this.provider === 'kilo') {
      const list = await freeModels(signal);
      const selected = list.find(m=>m.id === this.model);
      if (!selected) throw new Error('Vald Kilo-modell är inte längre bekräftat gratis. Välj Pollinations eller uppdatera modellistan.');
      this.onStatus('Anropar ' + selected.id + ' utan nyckel…'); this.calls++;
      const result = extractAnswer(await request(KILO+'/chat/completions',{signal,timeout:90000,body:{model:selected.id,messages,max_tokens:maxTokens,temperature:0.2,stream:false,...(tools?{tools,tool_choice:'auto'}:{})}}));
      this.lastModel=result.model; return result;
    }
    if (this.provider !== 'pollinations') throw new Error('Okänd leverantör.');
    const run = async () => {
      for (let attempt=0; attempt<2; attempt++) {
        const waitUntil = Math.max(nextPoll,savedNext());
        if (waitUntil-Date.now()>120000) throw new Error('Tjänsten begär en längre paus. Uppdraget stoppas; försök senare.');
        while(Date.now()<Math.max(nextPoll,savedNext())) {
          this.onStatus(`Gratisintervallet: ${Math.ceil((Math.max(nextPoll,savedNext())-Date.now())/1000)} s till nästa AI-anrop. Avbryt går bra.`);
          await pause(700,signal);
        }
        check(signal); this.onStatus('Frågar Pollinations utan konto…'); this.calls++; setNext(Date.now()+31000);
        try {
          const result = extractAnswer(await request(POLL,{signal,timeout:({low:90000,medium:150000,high:210000})[effort],body:{model:'openai',messages,max_tokens:Math.min(16384,Math.max(maxTokens,({low:4096,medium:8192,high:16384})[effort])),reasoning_effort:effort,temperature:0.2,stream:false,...(tools?{tools,tool_choice:'auto'}:{})}}));
          result.requestedReasoning=effort;
          if(result.truncated && this.reasoning==='auto'){this.effectiveReasoning='low';this.onStatus('Servern klippte svaret. Automatläge väljer kortare delbeslut och low för nästa anrop. Inga ofullständiga åtgärder körs.');}
          setNext(Date.now()+31000); this.lastModel=result.model; return result;
        } catch (e) {
          const limited = e.freeLimit || e.status === 429;
          setNext(Date.now()+Math.max(31,limited ? e.retryAfter+1 : 31)*1000);
          if (!limited || attempt || e.retryAfter>120) throw e;
          this.onStatus('Gratisgräns nådd. Ett återförsök efter tjänstens väntetid.');
        }
      }
    };
    return globalThis.navigator?.locks ? navigator.locks.request('jesp-anonymous-ai',{signal},run) : run();
  }
}
export function parseJSON(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const value=JSON.parse(cleaned);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Förväntade ett JSON-objekt.');
  return value;
}
export function safeURL(value) {
  const u = new URL(String(value));
  const h = u.hostname.toLowerCase();
  if(u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' || !h.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(h) || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) throw new Error('Endast publika HTTPS-adresser utan inloggningsuppgifter är tillåtna.');
  u.hash=''; return u.href;
}
export function filename(name) {
  if(typeof name !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,99}$/u.test(name) || name.includes('..') || /[. ]$/.test(name) || !/\.(txt|md|html|css|js|mjs|json|csv|svg|py|xml|yaml|yml)$/i.test(name)) throw new Error('Otillåtet filnamn. Använd ett enkelt namn med exempelvis .md, .js eller .html.');
  return name;
}
export function calculate(expression) {
  if(typeof expression !== 'string' || expression.length>300 || /[^\d.eE+\-*/%()\s]/.test(expression)) throw new Error('Endast tal, parenteser och + - * / % ** är tillåtna.');
  const tokens=expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|\*\*|[+\-*/%()]/g)||[];
  if(tokens.join('') !== expression.replace(/\s/g,'')) throw new Error('Ogiltigt räkneuttryck.');
  let i=0;
  const atom=()=>{if(tokens[i]==='('){i++;const v=sum();if(tokens[i++]!==')')throw new Error('Saknad parentes.');return v;}const t=tokens[i++];if(!t||!/^\d|^\.\d/.test(t))throw new Error('Förväntade ett tal.');return Number(t);};
  const power=()=>{let v=atom();if(tokens[i]==='**'){i++;v=v**unary();}return v;};
  const unary=()=>{if(tokens[i]==='+'){i++;return unary();}if(tokens[i]==='-'){i++;return -unary();}return power();};
  const product=()=>{let v=unary();while(['*','/','%'].includes(tokens[i])){const op=tokens[i++],r=unary();v=op==='*'?v*r:op==='/'?v/r:v%r;}return v;};
  const sum=()=>{let v=product();while(['+','-'].includes(tokens[i])){const op=tokens[i++],r=product();v=op==='+'?v+r:v-r;}return v;};
  const value=sum();if(i!==tokens.length||!Number.isFinite(value))throw new Error('Ogiltigt eller oändligt resultat.');return value;
}
async function rpcBody(response,id) {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) return JSON.parse(await limitedText(response));
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>450000)throw new Error('MCP-svaret är för stort.');buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let at;
      while((at=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,at);buffer=buffer.slice(at+2);const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)continue;const msg=JSON.parse(data);if(msg.id===id)return msg;}
    }
    throw new Error('MCP-strömmen avslutades utan svar.');
  } finally {await reader.cancel().catch(()=>{});}
}
class MCP {
  constructor(url) {this.url=url;this.id=0;this.session='';this.version='2024-11-05';this.ready=false;}
  async rpc(method,params,signal,notify=false) {
    const id=++this.id;
    return request(this.url,{signal,timeout:25000,body:{jsonrpc:'2.0',...(notify?{}:{id}),method,params},headers:{Accept:'application/json, text/event-stream',...(this.ready?{'MCP-Protocol-Version':this.version}:{}),...(this.session?{'Mcp-Session-Id':this.session}:{})},consume:async r=>{
      this.session=r.headers.get('mcp-session-id') || this.session;
      if(notify){await r.body?.cancel();return null;}
      const data=await rpcBody(r,id);if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));return data.result;
    }});
  }
  async call(name,args,signal) {
    if(!this.ready){const init=await this.rpc('initialize',{protocolVersion:this.version,capabilities:{},clientInfo:{name:'JESP-AI',version:VERSION}},signal);this.version=init.protocolVersion||this.version;this.ready=true;await this.rpc('notifications/initialized',{},signal,true);}
    const result=await this.rpc('tools/call',{name,arguments:args},signal);
    if(result?.isError) throw new Error((result.content||[]).map(c=>c.text||'').join('\n').slice(0,400));
    return result;
  }
}
function plainHTML(value) {return String(value).replace(/<[^>]*>/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
export class Workspace {
  constructor({signal,emit=()=>{},web=true,allowCode=false,execute=null,question=''}={}) {
    Object.assign(this,{signal,emit,web,allowCode,execute,question});
    this.expectedNames=new Set(requestedFiles(question).filter(n=>{try{filename(n);return true;}catch{return false;}}));
    this.files=new Map();this.sources=new Map();this.allowed=new Set();this.evidence=new Map();this.audit=[];this.trace=[];this.reviews=[];this.pendingIssues=[];this.totalCalls=0;this.lastError=null;
    this.session=globalThis.crypto?.randomUUID?.()||String(Date.now());
    this.parallel=new MCP('https://search.parallel.ai/mcp');this.exa=new MCP('https://mcp.exa.ai/mcp');this.offline=new Set();
    for(const u of question.match(/https:\/\/[^\s<>"\])]+/g)||[]){try{this.allowed.add(safeURL(u));}catch{}}
  }
  addSource(url,title='') {
    try {const safe=safeURL(url);this.allowed.add(safe);if(!this.sources.has(safe)){const item={id:'S'+(this.sources.size+1),url:safe,title:title||new URL(safe).hostname};this.sources.set(safe,item);this.emit('source',item);}return this.sources.get(safe);}catch{return null;}
  }
  sourceText(data,provider,requestedURL='') {
    const docs=sourceDocuments(data,requestedURL),results=[];
    for(const doc of docs) {
      let url;try{url=safeURL(doc.url);}catch{continue;}
      if(requestedURL && url!==requestedURL)continue;
      const source=this.addSource(url,doc.title);if(!source)continue;
      const text=cleanText(doc.text),quality=textQuality(text);
      if(requestedURL){source.status=quality.usable?'read':'thin';source.fetchedAt=new Date().toISOString();source.provider=provider;source.quality=quality;this.evidence.set(source.id,text.slice(0,40000));}
      else if(!source.status)source.status='found';
      this.emit('source',source);
      results.push({source_id:source.id,url:source.url,title:source.title,status:source.status,text:text.slice(0,requestedURL?9000:1200),truncated:text.length>(requestedURL?9000:1200),...(requestedURL?{quality}:{})});
    }
    if(!results.length)throw new Error('Tjänsten gav ingen identifierbar källa med innehåll. Inga länkar i sidans navigering räknas som källor.');
    return {provider,results,note:requestedURL?'Hämtad text. Kontrollera relevans, citat och tolkning.':'Sökutdrag, INTE fullständigt lästa källor.'};
  }
  async search(query) {
    if(!this.web)throw new Error('Webbverktyg är avstängda.');
    if(typeof query!=='string'||!query.trim()||query.length>400)throw new Error('Sökfrågan måste vara 1–400 tecken.');
    const errors=[];
    for(const [name,client,tool,args] of [
      ['Parallel',this.parallel,'web_search',{objective:query,search_queries:[query],session_id:this.session}],
      ['Exa',this.exa,'web_search_exa',{query,objective:query,numResults:4}]
    ]){
      if(this.offline.has(name+':search'))continue;
      try{return this.sourceText(await client.call(tool,args,this.signal),name);}catch(e){check(this.signal);errors.push(name+': '+e.message);this.offline.add(name+':search');this.emit('warning',name+' kunde inte användas. Provar nästa öppen sökväg.');}
    }
    const wiki=await request('https://sv.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',list:'search',srsearch:query,srlimit:'4',format:'json',origin:'*'}),{signal:this.signal,timeout:15000});
    if(wiki.error)throw new Error(wiki.error.info||'Wikipedia-sökningen misslyckades.');
    const results=(wiki.query?.search||[]).map(x=>({title:x.title,excerpt:plainHTML(x.snippet),source:this.addSource('https://sv.wikipedia.org/wiki/'+encodeURIComponent(x.title.replaceAll(' ','_')),x.title)}));
    return {provider:'Wikipedia – begränsad reserv, inte allmän webbsökning',results,unavailable:errors};
  }
  async readURL(raw) {
    if(!this.web)throw new Error('Webbverktyg är avstängda.');
    const url=safeURL(raw);if(!this.allowed.has(url))throw new Error('Läs bara en URL som användaren gav eller som sökningen faktiskt hittade.');
    const cached=this.sources.get(url);if(cached?.status==='read'&&this.evidence.has(cached.id))return {cached:true,results:[{source_id:cached.id,url,text:this.evidence.get(cached.id),status:'read'}]};
    for(const [name,client,tool,args] of [
      ['Parallel',this.parallel,'web_fetch',{urls:[url],session_id:this.session}],
      ['Exa',this.exa,'web_fetch_exa',{urls:[url]}]
    ]){if(this.offline.has(name+':read'))continue;try{const result=this.sourceText(await client.call(tool,args,this.signal),name,url);if(result.results.some(r=>r.status==='read'))return result;this.emit('warning',name+' gav för lite löptext. Provar nästa läsare.');}catch(e){check(this.signal);this.offline.add(name+':read');this.emit('warning',name+' kunde inte läsa sidan.');}}
    const u=new URL(url);
    if(/^(sv|en)\.wikipedia\.org$/.test(u.hostname)&&u.pathname.startsWith('/wiki/')){
      const data=await request(u.origin+'/w/api.php?'+new URLSearchParams({action:'query',prop:'extracts',explaintext:'1',titles:decodeURIComponent(u.pathname.slice(6)),format:'json',origin:'*'}),{signal:this.signal,timeout:15000});
      return this.sourceText({structuredContent:{results:[{url,text:Object.values(data.query?.pages||{}).map(p=>p.extract||'').join('\n')}]}},'Wikipedia',url);
    }
    throw new Error('Sidläsning är inte tillgänglig från den här webbläsaren just nu. Inget innehåll har lästs.');
  }
  write(name,content) {
    filename(name);if(this.expectedNames.size===1&&!this.files.size&&!this.expectedNames.has(name))throw new Error('Använd först exakt efterfrågat filnamn: '+[...this.expectedNames][0]);if(typeof content!=='string')throw new Error('Filinnehåll måste vara text.');
    const bytes=enc.encode(content).length;
    const total=[...this.files.values()].filter(f=>f.name!==name).reduce((n,f)=>n+f.bytes,0)+bytes;
    if(bytes>100000||total>500000||!this.files.has(name)&&this.files.size>=12)throw new Error('Filgräns: 100 kB/fil, 12 filer, 500 kB totalt.');
    const file={name,content,bytes,version:(this.files.get(name)?.version||0)+1};this.files.set(name,file);this.emit('file',file);return {saved:true,name,bytes,version:file.version};
  }
  async tool(name,args={}) {
    check(this.signal);if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Verktygsargument måste vara ett objekt.');
    switch(name){
      case 'search':return this.search(args.query);
      case 'read_url':return this.readURL(args.url);
      case 'verify_quote':{const s=[...this.sources.values()].find(s=>s.id===args.source_id);if(!s||s.status!=='read')throw new Error('Läs källan innan citatet kontrolleras.');if(typeof args.quote!=='string'||args.quote.length>2000)throw new Error('Citat måste vara text, högst 2000 tecken.');return {source_id:s.id,...verifyQuote(this.evidence.get(s.id)||'',args.quote)};}
      case 'calculate':return {expression:args.expression,value:calculate(args.expression)};
      case 'write_file':return this.write(args.name,args.content);
      case 'read_file':{const f=this.files.get(filename(args.name));if(!f)throw new Error('Filen finns inte.');return f;}
      case 'inspect_file':{const f=this.files.get(filename(args.name));if(!f)throw new Error('Filen finns inte.');if(f.name.endsWith('.json')){JSON.parse(f.content);return {name:f.name,version:f.version,check:'JSON-syntax',passed:true};}return {name:f.name,version:f.version,bytes:f.bytes,lines:f.content.split('\n').length,note:'Endast filstruktur kontrollerad. Koden har INTE körts.'};}
      case 'test_js':{
        if(!this.allowCode||!this.execute)throw new Error('Kodtester är avstängda. Användaren måste aktivera dem före körningen.');
        const file=args.name?this.files.get(filename(args.name)):null;
        if(args.name&&!file)throw new Error('Filen finns inte.');
        const code=(file?file.content+'\n':'')+(args.code||'');
        if(typeof args.code!=='string'||code.length>30000)throw new Error('Testkod krävs; högst 30 000 tecken totalt.');
        return {...await this.execute(code,this.signal),...(file?{file:file.name,version:file.version}:{})};
      }
      default:throw new Error('Otillåtet verktyg: '+name);
    }
  }
}

export function runAgent(options){return runAgentImpl(options,{parseJSON,check});}
