import {backendModels,DEFAULT_WORKER,DEFAULT_CRITIC} from './backend.mjs?v=6.3.0';
import {AI,Workspace,runAgent,freeModels,VERSION,check} from './core.mjs?v=6.4.1';
import {executeJS} from './sandbox.mjs?v=5.2.0';
import {zipFiles} from './zip.mjs';
import {localAnswer,unloadLocal} from './local.mjs';
const $=id=>document.getElementById(id);
let backendReady=false;
let busy=false,controller=null,space=null,result=null,question='',settings={};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function status(text,cls=''){ $('status').textContent=text;$('status').className=cls; }
function controls(){
 for(const id of ['run','test','checkKilo','refreshBackend','workerModel','criticModel','provider','model','steps','liveStream','advanced','taskMode','reasoning','web','review','code','prompt','downloadConsent'])$(id).disabled=busy;
 for(const e of document.querySelectorAll('[data-example]'))e.disabled=busy;
 if($('provider').value==='backend'&&!backendReady){$('run').disabled=true;$('test').disabled=true;}
 $('cancel').disabled=!busy||!controller||controller.signal.aborted;
 $('run').textContent=busy?'Agenten arbetar…':'Starta agenten gratis';
 $('copy').disabled=!$('answer').textContent;
 $('save').disabled=!space || !(space.audit.length || space.files.size || space.trace?.length);
 $('save').textContent=busy?'Spara diagnostik / delresultat':'Spara uppdrag som ZIP';
 $('continue').disabled=busy||!space||(!result?.unfinished&&!space.lastError);
 $('continue').hidden=!space;
}
function download(name,content){const blob=content instanceof Blob?content:new Blob([content],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function log(title,data,kind=''){
 if(data===undefined){$('log').append(node('p',title,'lognote '+kind));return;}
 const d=node('details');const s=node('summary',title,kind);const p=node('pre',typeof data==='string'?data:JSON.stringify(data,null,2));d.append(s,p);$('log').append(d);
}
function files(){
 $('files').replaceChildren();$('fileCount').textContent=space.files.size;
 for(const file of space.files.values()){
  const row=node('div',undefined,'file');row.append(node('strong',file.name),node('span',` · ${file.bytes} byte · v${file.version}`,'small'));
  const detail=node('details');detail.append(node('summary','Visa filens text'),node('pre',file.content));
  const button=node('button','Ladda ner fil');button.onclick=()=>download(file.name,file.content);row.append(detail,button);$('files').append(row);
 }
}

const roleLabel={architect:'Arkitekt',work:'Arbetsagent',repair:'Felsökare',verifier:'Testförfattare',critic:'Granskare',synthesis:'Slutsvar'};
function appendLiveEvent(message,kind='work'){
 const panel=$('liveTimeline');if(!panel)return;
 const li=node('li',new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · '+String(message).slice(0,260),'live-'+kind);
 panel.append(li);while(panel.children.length>70)panel.firstElementChild.remove();
 panel.scrollTop=panel.scrollHeight;
}
function liveToken(token,{role,model}={}){
 const pre=$('livePreview');if(!pre||!token)return;
 if(role&&pre.dataset.role&&role!==pre.dataset.role){pre.textContent='';}
 if(role)pre.dataset.role=role;
 pre.textContent=(pre.textContent+String(token)).slice(-6000);
 pre.scrollTop=pre.scrollHeight;
 if(model)$('liveRole').textContent=(roleLabel[role]||role||'AI')+' · '+model;
 $('livePhase').textContent='Mottar live-text från AI-modellen. Utkastet är inte verifierat.';
}
function emit(type,data){
 if(type==='stage'){for(const el of document.querySelectorAll('[data-stage]'))el.classList.toggle('active',el.dataset.stage===data.stage);if(data.step)status(`Agentbeslut ${data.step}/${data.maxSteps}…`);else status('Separat granskning…');}
 if(type==='contract'){
  $('contract').replaceChildren(node('p',data.objective),node('p','Val: '+data.choice));
  for(const x of data.alternatives)$('contract').append(node('p',x,'small'));
  for(const x of data.assumptions)$('contract').append(node('p','Antagande: '+x,'small'));
  for(const c of data.criteria)$('contract').append(node('p',c.id+' · '+c.requirement));
 }
 if(type==='plan'){$('plan').replaceChildren(...data.map(s=>node('li',s)));}
 if(type==='model'){$('answerMeta').textContent=`${data.model} · ${data.calls} AI-anrop`;}
 if(type==='warning')log(data,undefined,'warning');
 if(type==='action'){const args=data.args||{};const label=args.query||args.url||args.name||args.expression||'';log('Start: '+data.tool+(label?' · '+String(label).slice(0,180):''));}
 if(type==='observation')log((data.ok?'OK: ':'Fel: ')+data.tool,data,data.ok?'':'error');
 if(type==='observation')appendLiveEvent((data.ok?'Verktyg klart: ':'Verktyg misslyckades: ')+data.tool,data.ok?'work':'error');
 if(type==='file'){files();controls();}
 if(type==='source'){let div=[...$('sources').children].find(e=>e.dataset.sourceId===data.id);if(!div){div=node('div',undefined,'source');div.dataset.sourceId=data.id;$('sources').append(div);}const a=node('a',`[${data.id}] ${data.title}`);a.href=data.url;a.target='_blank';a.rel='noopener noreferrer';const labels={read:'Hämtad text',found:'Sökträff',thin:'Otillräcklig text'};div.replaceChildren(a,node('small',`${labels[data.status]||'Hittad länk'} · ${new URL(data.url).hostname}`));$('sourceCount').textContent=space.sources.size;}
 if(type==='draft'){$('answer').textContent=data;$('answerNote').textContent='Utkast. Granskning är inte slutförd.';controls();}
 if(type==='review')appendLiveEvent(data.verdict==='pass'?'Granskaren godkände aktuell version':'Granskaren begärde konkreta rättningar',data.verdict==='pass'?'review':'error');
 if(type==='review'){$('issues').textContent=data.issues.map(String).join('\n');log(data.verdict==='pass'&&!data.issues.length?'AI-kravgranskning utan kvarvarande invändningar':'Kritik → rättningsrunda',data);}
 if(type==='trace'){
  if(data.type==='ai_start'){
   const role=roleLabel[data.role]||data.role||'AI';
   $('liveRole').textContent=role;
   $('livePreview').textContent='';$('livePreview').dataset.role=data.role||'';
   $('livePhase').textContent='AI-anrop pågår: '+role+(settings.liveStream?' · SSE-streaming aktiverad':' · väntar på fullständigt svar');
   appendLiveEvent(role+' påbörjade ett modell-anrop',data.role==='critic'?'review':'work');
  }
  if(data.type==='ai_end'){
   $('livePhase').textContent='Modellsvaret mottaget. Nästa steg: validera verktyg och resultat.';
   appendLiveEvent((roleLabel[data.role]||data.role||'AI')+' svarade med '+String(data.model||'modell')+(data.truncated?' (avklippt)':''),data.truncated?'error':'work');
  }
  if(data.type==='ai_error'||data.type==='run_stopped'){
   $('livePhase').textContent='AI-anropet avbröts eller misslyckades. Ett ofullständigt svar körs inte.';
   appendLiveEvent(String(data.message||data.error?.message||'AI-fel'),'error');
  }
 }
 if(type==='trace')controls();
 if(type==='trace'&&['ai_start','ai_end','ai_error','finish_blocked','run_stopped','strategy','strategy_error'].includes(data.type))log('Körspår: '+data.type,data);
 if(type==='done'){appendLiveEvent(data.unfinished?'Körningen är ofullständig':'Körningen har avslutats',data.unfinished?'error':'review');$('livePhase').textContent=data.unfinished?'Ofullständig agentkörning. Delresultaten finns kvar.':'Agentkörningen avslutad. Kontrollera granskning och filer.';result=data;$('answer').textContent=data.answer;$('answerNote').textContent=(data.unfinished?'Ofullständigt uppdrag. ':'')+(data.reviewPassed?'Separat AI-granskning godkände aktuell leverans; ingen korrekthetsgaranti.':data.reviewed?'Granskning utförd, men slutleveransen är inte godkänd.':'Ingen godkänd separat AI-granskning.');$('issues').textContent=(data.issues||[]).join('\n');}
}
function explain(e){
 if(e.name==='AbortError')return 'Avbrutet. Skapade filer och mottagna resultat finns kvar.';
 if(e.name==='TimeoutError')return 'Tjänsten svarade inte i tid. Arbetsytan finns kvar.';
 if([401,402,403].includes(e.status)&&!e.freeLimit)return 'Tjänsten nekade gratisåtkomst. Ingen inloggning eller betalning öppnas. '+e.message;
 if(e.status===429||e.freeLimit)return 'Gratisgränsen är nådd. Försök senare. Arbetsytan finns kvar.';
 if(e instanceof TypeError&&/fetch|network|load failed/i.test(e.message))return 'Nätverksfel eller blockerad webbläsaranslutning. '+e.message;
 return e.message||String(e);
}
async function run(test=false,resume=false){
 if(busy)return;
 if($('provider').value==='backend'&&!backendReady){status('Backendens modellkatalog är inte tillgänglig. Uppdatera modellerna.','error');return;}
 const input=test?'Vad är 7 plus 5? Svara endast med talet.':resume?question:$('prompt').value.trim();
 if(resume&&$('prompt').value.trim()!==question){status('Återställ uppdragstexten innan du fortsätter, eller välj Starta för ett nytt uppdrag.','error');return;}
 if(!input){status('Skriv ett uppdrag först.');$('prompt').focus();return;}
 if($('provider').value==='local'&&!$('downloadConsent').checked){status('Godkänn modellnedladdningen i inställningarna först.','error');$('settings').open=true;return;}
 if(resume&&(settings.advanced!==$('advanced').checked||settings.mode!==$('taskMode').value)){status('Behåll samma arbetssätt och uppdragstyp när du fortsätter, eller starta ett nytt uppdrag.','error');return;}
 question=input;controller=new AbortController();const signal=controller.signal;busy=true;result=null;
 settings={workerModel:$('workerModel').value,criticModel:$('criticModel').value,advanced:$('advanced').checked,mode:$('taskMode').value,provider:$('provider').value,model:$('model').value,reasoning:$('reasoning').value,maxSteps:Number($('steps').value),web:$('web').checked,review:$('review').checked,allowCode:$('code').checked,liveStream:$('provider').value==='backend'&&$('liveStream').checked};
 if(resume){space.signal=signal;space.web=settings.web;space.allowCode=settings.allowCode;space.offline.clear();space.lastError=null;}else space=new Workspace({signal,emit,web:settings.web,allowCode:settings.allowCode,execute:executeJS,question});
 $('workspace').hidden=false;if(!resume){for(const id of ['answer','issues','log','files','sources','plan','contract','liveTimeline','livePreview'])$(id).replaceChildren();$('liveRole').textContent='Väntar på modell';$('livePhase').textContent=settings.liveStream?'SSE-tokenströmning aktiverad. Väntar på första AI-svaret.':'Verktyg och agentroller visas live. SSE-tokenströmning är av.';$('fileCount').textContent=$('sourceCount').textContent='0';$('answerNote').textContent='Arbetar. Verktygsresultat visas i loggen.';}controls();
 let lastStatusKey='';
 const transportStatus=text=>{status(text);const key=text.replace(/\d+/g,'#');if(key!==lastStatusKey){space.trace.push({time:new Date().toISOString(),type:'status',message:text});lastStatusKey=key;}};
 const ai=new AI({workerModel:settings.workerModel,criticModel:settings.criticModel,provider:$('provider').value,model:$('model').value,onStatus:transportStatus,local:localAnswer,reasoning:settings.reasoning,liveStream:settings.liveStream,onToken:liveToken});
 try{
  if(test){const answer=await ai.ask([{role:'user',content:input}],signal,64);check(signal);space.totalCalls=ai.calls;space.trace.push({type:'connection_test',model:answer.model,calls:ai.calls,requestedReasoning:ai.reasoning});emit('done',{answer:answer.text,reviewed:false,reviewPassed:false,unfinished:false,calls:ai.calls,model:answer.model});emit('model',{model:answer.model,calls:ai.calls});status('Ett riktigt AI-svar mottogs. Detta testar anslutningen, inte hela agenten.','success');}
  else{result=await runAgent({question,ai,space,signal,maxSteps:Number($('steps').value),review:$('review').checked,advanced:settings.advanced,mode:settings.mode,verifyBehavior:true,emit});status(result.unfinished?'Uppdraget är ofullständigt. Se kvarvarande problem eller tryck Fortsätt.':'Leveranskontrollen är klar. Kontrollera resultat och filer.',result.unfinished?'warning':'success');}
 }catch(e){space.lastError={name:e.name,message:e.message,status:e.status||null,time:new Date().toISOString()};space.trace.push({type:'ui_error',...space.lastError});$('livePhase').textContent='AI-strömmen eller körningen stoppades innan validerat slutresultat. Ett ofullständigt svar körs inte.';appendLiveEvent('Körningen stoppades: '+String(e.message||e).slice(0,180),'error');status(explain(e),e.name==='AbortError'?'':'error');log('Körningen stoppades',String(e.message||e),'error');$('answerNote').textContent='Ofullständig körning. Resultat och filer som redan skapats har behållits.';}
 finally{busy=false;controller=null;for(const el of document.querySelectorAll('[data-stage]'))el.classList.remove('active');controls();}
}
$('run').onclick=()=>run();$('test').onclick=()=>run(true);$('continue').onclick=()=>run(false,true);
$('cancel').onclick=()=>{controller?.abort(new DOMException('Avbrutet av användaren','AbortError'));status('Avbryter…');controls();};
$('prompt').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}});
$('provider').onchange=()=>{$('backendSettings').hidden=$('provider').value!=='backend';controls();$('localNote').hidden=$('provider').value!=='local';$('kiloSettings').hidden=$('provider').value!=='kilo';if($('provider').value!=='local')unloadLocal();};
$('checkKilo').onclick=async()=>{
 if(busy)return;busy=true;controller=new AbortController();controls();status('Kontrollerar Kilos publika modellkatalog…');
 try{const models=await freeModels(controller.signal);if(!models.length)throw new Error('Inga bekräftade gratisvarianter hittades hos Kilo. Pollinations är fortfarande tillgängligt.');$('model').replaceChildren(...models.map(m=>{const o=node('option',m.name||m.id);o.value=m.id;return o;}));$('kiloOption').disabled=false;$('kiloOption').textContent='Kilo · katalogens gratisvarianter';status(`${models.length} gratisvarianter i Kilos katalog. Välj Kilo och testa anslutningen före ett större uppdrag.`,'success');}
 catch(e){status('Kilo kunde inte aktiveras. Pollinations påverkas inte. '+explain(e),'error');}
 finally{busy=false;controller=null;controls();}
};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('answer').textContent);status('Svaret kopierat.','success');}catch{status('Urklipp blockerades. Markera texten och kopiera manuellt.','error');}};
$('save').onclick=()=>{
 if(!space)return;
 const meta={version:VERSION,verification:space.verification||null,strategy:space.strategy||null,taskKind:space.taskKind||null,question,answer:$('answer').textContent,settings,reviewed:result?.reviewed||false,reviewPassed:result?.reviewPassed||false,unfinished:busy||!result||result.unfinished,stopReason:busy?'running':space.lastError?'error':result?.stopReason||'unknown',error:space.lastError,calls:space.totalCalls,model:result?.model||space.lastModel||null,issues:result?.issues||space.pendingIssues||[],sources:[...space.sources.values()],audit:space.audit,reviews:space.reviews,trace:space.trace,files:[...space.files.values()].map(({name,bytes,version})=>({name,bytes,version}))};
 const all=[...space.files.values()].map(f=>({name:'filer/'+f.name,content:f.content}));
 if(space.strategy)all.push({name:'uppdragskontrakt.json',content:JSON.stringify(space.strategy,null,2)});
 all.push({name:'korspar.json',content:JSON.stringify(space.trace,null,2)},{name:'kallunderlag.json',content:JSON.stringify(Object.fromEntries(space.evidence),null,2)},{name:'uppdrag.json',content:JSON.stringify(meta,null,2)},{name:'resultat.md',content:'# JESP AI\n\n'+question+'\n\n'+$('answer').textContent+'\n\n## Källor\n'+[...space.sources.values()].map(s=>`[${s.id}] ${s.url}`).join('\n')});
 download('JESP_AI_uppdrag.zip',zipFiles(all));
};
const examples={research:'Sök i officiella källor vad WebAssembly är. Läs en relevant källa och skriv en kort svensk rapport med källhänvisningar. Spara rapporten som webassembly.md. Hitta inte på fakta om verktygen misslyckas.',code:'Bygg en liten körbar webbläsarapp för en inköpslista, inte en plan. Skapa index.html och logic.js. Användaren ska kunna lägga till, bocka av och ta bort varor. Separera logiken från DOM så att den kan testas utan webbläsare. Använd inga externa bibliotek. Testa normalfall, tom inmatning och borttagning av okänt id med test_js om jag har godkänt kodkörning. Annars ange tydligt att testen inte körts.',calculate:'Räkna (125 * 8) - 175 med calculate-verktyget. Skapa resultat.json med uttrycket och resultatet. Kontrollera filens JSON-syntax med inspect_file och sammanfatta resultatet.'};
for(const e of document.querySelectorAll('[data-example]'))e.onclick=()=>{$('prompt').value=examples[e.dataset.example];$('prompt').focus();};
window.JESP_AGENT_BOOTED=true;window.JESP_AI_BOOTED=true;status('Version 6.0.1 · Backend, arbetsmodell och separat kritiker. Ingen inloggning eller betalreserv.');controls();

async function refreshBackend(){
 if(busy)return;backendReady=false;controls();$('backendInfo').textContent='Hämtar aktuella gratismodeller från backend…';
 try{const models=await backendModels();if(!models.length)throw new Error('Inga tillgängliga gratis verktygsmodeller.');
 for(const [id,preferred] of [['workerModel',DEFAULT_WORKER],['criticModel',DEFAULT_CRITIC]]){const old=$(id).value;$(id).replaceChildren(...models.map(m=>{const o=node('option',m.name||m.id);o.value=m.id;return o;}));$(id).value=models.some(m=>m.id===old)?old:models.some(m=>m.id===preferred)?preferred:models[0].id;}
 backendReady=true;$('backendInfo').textContent=models.length+' verktygsmodeller med katalogpris 0. Backendens gränser: 90 anrop/timme per IP, 150/timme totalt. Leverantörens kvoter gäller också.';
 }catch(e){$('backendInfo').textContent='Backend kunde inte kontrolleras: '+e.message+' Ingen betald reserv används.';}
 finally{controls();}
}
$('refreshBackend').onclick=refreshBackend;
refreshBackend();
