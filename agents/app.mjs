import {AI,Workspace,runAgent,freeModels,VERSION,check} from './core.mjs';
import {executeJS} from './sandbox.mjs';
import {zipFiles} from './zip.mjs';
import {localAnswer,unloadLocal} from './local.mjs';
const $=id=>document.getElementById(id);
let busy=false,controller=null,space=null,result=null,question='';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function status(text,cls=''){ $('status').textContent=text;$('status').className=cls; }
function controls(){
 for(const id of ['run','test','checkKilo','provider','model','steps','web','review','code','prompt','downloadConsent'])$(id).disabled=busy;
 for(const e of document.querySelectorAll('[data-example]'))e.disabled=busy;
 $('cancel').disabled=!busy||!controller||controller.signal.aborted;
 $('run').textContent=busy?'Agenten arbetar…':'Starta agenten gratis';
 $('copy').disabled=!$('answer').textContent;
 $('save').disabled=!space;
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
function emit(type,data){
 if(type==='stage'){for(const el of document.querySelectorAll('[data-stage]'))el.classList.toggle('active',el.dataset.stage===data.stage);if(data.step)status(`Agentbeslut ${data.step}/${data.maxSteps}…`);else status('Separat granskning…');}
 if(type==='plan'){$('plan').replaceChildren(...data.map(s=>node('li',s)));}
 if(type==='model'){$('answerMeta').textContent=`${data.model} · ${data.calls} AI-anrop`;}
 if(type==='warning')log(data,undefined,'warning');
 if(type==='action'){const args=data.args||{};const label=args.query||args.url||args.name||args.expression||'';log('Start: '+data.tool+(label?' · '+String(label).slice(0,180):''));}
 if(type==='observation')log((data.ok?'OK: ':'Fel: ')+data.tool,data,data.ok?'':'error');
 if(type==='file'){files();controls();}
 if(type==='source'){const div=node('div',undefined,'source');const a=node('a',`[${data.id}] ${data.title}`);a.href=data.url;a.target='_blank';a.rel='noopener noreferrer';div.append(a,node('small',new URL(data.url).hostname));$('sources').append(div);$('sourceCount').textContent=space.sources.size;}
 if(type==='draft'){$('answer').textContent=data;$('answerNote').textContent='Utkast. Granskning är inte slutförd.';controls();}
 if(type==='review'){$('issues').textContent=data.issues.map(String).join('\n');log('Granskarens anmärkningar',data.issues);}
 if(type==='done'){result=data;$('answer').textContent=data.answer;$('answerNote').textContent=(data.unfinished?'Ofullständigt uppdrag. ':'')+(data.reviewed?'Separat AI-granskning utförd. Det är inte en garanti för korrekthet.':'Ingen slutförd separat AI-granskning.');}
}
function explain(e){
 if(e.name==='AbortError')return 'Avbrutet. Skapade filer och mottagna resultat finns kvar.';
 if(e.name==='TimeoutError')return 'Tjänsten svarade inte i tid. Arbetsytan finns kvar.';
 if([401,402,403].includes(e.status)&&!e.freeLimit)return 'Tjänsten nekade gratisåtkomst. Ingen inloggning eller betalning öppnas. '+e.message;
 if(e.status===429||e.freeLimit)return 'Gratisgränsen är nådd. Försök senare. Arbetsytan finns kvar.';
 if(e instanceof TypeError)return 'Nätverksfel eller blockerad webbläsaranslutning. '+e.message;
 return e.message||String(e);
}
async function run(test=false){
 if(busy)return;
 const input=test?'Vad är 7 plus 5? Svara endast med talet.':$('prompt').value.trim();
 if(!input){status('Skriv ett uppdrag först.');$('prompt').focus();return;}
 if($('provider').value==='local'&&!$('downloadConsent').checked){status('Godkänn modellnedladdningen i inställningarna först.','error');$('settings').open=true;return;}
 question=input;controller=new AbortController();const signal=controller.signal;busy=true;result=null;
 space=new Workspace({signal,emit,web:$('web').checked,allowCode:$('code').checked,execute:executeJS,question});
 $('workspace').hidden=false;for(const id of ['answer','issues','log','files','sources','plan'])$(id).replaceChildren();$('fileCount').textContent=$('sourceCount').textContent='0';$('answerNote').textContent='Arbetar. Verktygsresultat visas i loggen.';controls();
 const ai=new AI({provider:$('provider').value,model:$('model').value,onStatus:status,local:localAnswer});
 try{
  if(test){const answer=await ai.ask([{role:'user',content:input}],signal,64);check(signal);emit('done',{answer:answer.text,reviewed:false,unfinished:false,calls:ai.calls,model:answer.model});emit('model',{model:answer.model,calls:ai.calls});status('Ett riktigt AI-svar mottogs. Detta testar anslutningen, inte hela agenten.','success');}
  else{result=await runAgent({question,ai,space,signal,maxSteps:Number($('steps').value),review:$('review').checked,emit});status(result.unfinished?'Steggränsen nåddes. Se delresultaten.':'Körningen är klar. Kontrollera resultat och filer.',result.unfinished?'warning':'success');}
 }catch(e){status(explain(e),e.name==='AbortError'?'':'error');log('Körningen stoppades',String(e.message||e),'error');$('answerNote').textContent='Ofullständig körning. Resultat och filer som redan skapats har behållits.';}
 finally{busy=false;controller=null;for(const el of document.querySelectorAll('[data-stage]'))el.classList.remove('active');controls();}
}
$('run').onclick=()=>run();$('test').onclick=()=>run(true);
$('cancel').onclick=()=>{controller?.abort(new DOMException('Avbrutet av användaren','AbortError'));status('Avbryter…');controls();};
$('prompt').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}});
$('provider').onchange=()=>{$('localNote').hidden=$('provider').value!=='local';$('kiloSettings').hidden=$('provider').value!=='kilo';if($('provider').value!=='local')unloadLocal();};
$('checkKilo').onclick=async()=>{
 if(busy)return;busy=true;controller=new AbortController();controls();status('Kontrollerar Kilos publika modellkatalog…');
 try{const models=await freeModels(controller.signal);if(!models.length)throw new Error('Inga bekräftade gratisvarianter hittades hos Kilo. Pollinations är fortfarande tillgängligt.');$('model').replaceChildren(...models.map(m=>{const o=node('option',m.name||m.id);o.value=m.id;return o;}));$('kiloOption').disabled=false;$('kiloOption').textContent='Kilo · katalogens gratisvarianter';status(`${models.length} gratisvarianter i Kilos katalog. Välj Kilo och testa anslutningen före ett större uppdrag.`,'success');}
 catch(e){status('Kilo kunde inte aktiveras. Pollinations påverkas inte. '+explain(e),'error');}
 finally{busy=false;controller=null;controls();}
};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('answer').textContent);status('Svaret kopierat.','success');}catch{status('Urklipp blockerades. Markera texten och kopiera manuellt.','error');}};
$('save').onclick=()=>{
 if(!space)return;
 const meta={version:VERSION,question,answer:$('answer').textContent,reviewed:result?.reviewed||false,unfinished:busy||!result||result.unfinished,sources:[...space.sources.values()],audit:space.audit};
 const all=[...space.files.values()].map(f=>({name:'filer/'+f.name,content:f.content}));
 all.push({name:'uppdrag.json',content:JSON.stringify(meta,null,2)},{name:'resultat.md',content:'# JESP AI\n\n'+question+'\n\n'+$('answer').textContent+'\n\n## Källor\n'+[...space.sources.values()].map(s=>`[${s.id}] ${s.url}`).join('\n')});
 download('JESP_AI_uppdrag.zip',zipFiles(all));
};
const examples={research:'Sök i officiella källor vad WebAssembly är. Läs en relevant källa och skriv en kort svensk rapport med källhänvisningar. Spara rapporten som webassembly.md. Hitta inte på fakta om verktygen misslyckas.',code:'Skapa en liten JavaScript-funktion sum(a,b) i sum.js. Skriv två tester, inklusive negativa tal. Kör testerna om jag har aktiverat isolerade JavaScript-tester. Spara en README.md som är tydlig med vilka tester som faktiskt kördes.',calculate:'Räkna (125 * 8) - 175 med calculate-verktyget. Skapa resultat.json med uttrycket och resultatet. Kontrollera filens JSON-syntax med inspect_file och sammanfatta resultatet.'};
for(const e of document.querySelectorAll('[data-example]'))e.onclick=()=>{$('prompt').value=examples[e.dataset.example];$('prompt').focus();};
window.JESP_AGENT_BOOTED=true;window.JESP_AI_BOOTED=true;status('Redo. Skriv ett uppdrag eller välj ett exempel.');controls();
