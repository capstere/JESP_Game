"""One-time, deterministic v6.5 wiring. Refuses unexpected sources; no downloads."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
paths=['agents/core.mjs','agents/app.mjs','index.html']
code={p:(root/p).read_text() for p in paths}
if 'withExpertSupport' in code['agents/core.mjs'] and 'encodeCheckpoint' in code['agents/app.mjs'] and 'id="expertAssist"' in code['index.html']:
    print('v6.5 already applied')
    raise SystemExit(0)
def replace(path,a,b):
    if a not in code[path]:
        raise RuntimeError('Unexpected source in '+path+': '+a[:90])
    code[path]=code[path].replace(a,b)
replace('agents/core.mjs',"export {Workspace} from './workspace.mjs?v=6.4.0';", "export {Workspace} from './agent-boost.mjs?v=6.5.0';\nimport {withExpertSupport} from './agent-boost.mjs?v=6.5.0';")
replace('agents/core.mjs',"VERSION='6.4.1'","VERSION='6.5.0'")
replace('agents/core.mjs',"return runAgentImpl(options,{parseJSON,check});", "return withExpertSupport(options,opts=>runAgentImpl(opts,{parseJSON,check}));")
p='agents/app.mjs'
replace(p,"core.mjs?v=6.4.1","core.mjs?v=6.5.0")
code[p]="import {encodeCheckpoint,restoreCheckpoint} from './agent-boost.mjs?v=6.5.0';\n"+code[p]
replace(p,"'steps','liveStream','advanced'","'steps','liveStream','expertAssist','restoreCheckpoint','checkpointFile','advanced'")
replace(p," $('copy').disabled=!$('answer').textContent;"," $('copy').disabled=!$('answer').textContent;\n $('saveCheckpoint').disabled=busy||!space||!space.files.size;")
replace(p,"allowCode:$('code').checked,liveStream:","allowCode:$('code').checked,expertAssist:$('expertAssist').checked,liveStream:")
replace(p,"mode:settings.mode,verifyBehavior:true,emit","mode:settings.mode,verifyBehavior:true,expertAssist:settings.expertAssist,emit")
replace(p," const meta={version:VERSION,verification:"," const meta={version:VERSION,expertReports:space.expertReports||[],verification:")
replace(p," if(type==='trace')controls();"," if(type==='trace'&&data.type.startsWith('expert_')){appendLiveEvent(data.type==='expert_start'?'Specialist granskar återkommande fel':data.type==='expert_end'?'Specialistförslag mottaget – ej verifierat':'Specialist kunde inte lämna råd','review');log('Specialist: '+data.type,data);}\n if(type==='trace')controls();")
replace(p,"status('Version 6.0.1 · Backend, arbetsmodell och separat kritiker. Ingen inloggning eller betalreserv.');","status('Version '+VERSION+' · Agent, läsande specialist och separat kritiker. Ingen inloggning eller betalreserv.');")
ui="""$('saveCheckpoint').onclick=()=>{if(busy||!space)return;try{download('JESP_aterstart.json',encodeCheckpoint(space,question));status('Återstartfil sparad. Den innehåller ditt uppdrag och koden i klartext.','success');}catch(e){status(e.message,'error');}};
$('restoreCheckpoint').onclick=()=>{if(!busy)$('checkpointFile').click();};
$('checkpointFile').onchange=async()=>{
 const file=$('checkpointFile').files?.[0];if(!file||busy)return;
 busy=true;controls();
 try{
  if(file.size>1200000)throw Error('Återstartfilen är för stor.');
  const restored=restoreCheckpoint(await file.text(),{signal:new AbortController().signal,emit,execute:executeJS});
  space=restored.space;question=restored.question;result={unfinished:true};
  $('prompt').value=question;$('code').checked=false;$('web').checked=false;$('advanced').checked=true;$('taskMode').value='auto';
  settings={advanced:true,mode:'auto'};
  for(const id of ['answer','issues','log','files','sources','plan','contract','liveTimeline','livePreview'])$(id).replaceChildren();
  $('sourceCount').textContent='0';$('workspace').hidden=false;files();
  $('answerNote').textContent='Återlästa filer är inte verifierade. Kodkörning och webbåtkomst är av; godkänn dem på nytt vid behov.';
  log('Återstart',space.trace.at(-1));status('Filer återlästa. Kontrollera behörigheterna och tryck Fortsätt.','success');
 }catch(e){status('Återstart kunde inte läsas: '+e.message,'error');}
 finally{busy=false;$('checkpointFile').value='';controls();}
};
"""
replace(p,"$('run').onclick=()=>run();",ui+"$('run').onclick=()=>run();")
replace(p," if(space.strategy)all.push("," all.push({name:'aterstart.json',content:encodeCheckpoint(space,question)});\n if(space.strategy)all.push(")
p='index.html'
replace(p,'Version 6.4.1','Version 6.5.0')
replace(p,'app.mjs?v=6.4.1','app.mjs?v=6.5.0')
replace(p,'<div class="checks">','<div class="checks"><label><input id="expertAssist" type="checkbox" checked> Specialiststöd vid återkommande fel (backend): högst två extra konsultationer per körning. Samma gratismodeller och kvoter; förslag måste fortfarande testas.</label>')
replace(p,'<button id="cancel"','<button id="restoreCheckpoint" type="button">Öppna återstartfil</button><input id="checkpointFile" type="file" accept=".json,application/json" hidden><button id="cancel"')
replace(p,'<button id="save" disabled>','<button id="saveCheckpoint" disabled>Spara återstartfil</button><button id="save" disabled>')
replace(p,'Arbetsytan finns i minnet tills du lämnar sidan.','Arbetsytan finns i minnet tills du lämnar sidan. Spara en återstartfil för att fortsätta senare; efter import måste tester och behörigheter bekräftas på nytt.')
for path,content in code.items():
    (root/path).write_text(content)
print('Applied v6.5:',', '.join(paths))
