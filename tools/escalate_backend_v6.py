from pathlib import Path
r=Path(__file__).resolve().parents[1]
if 'repair_required' in (r/'agents/runner.mjs').read_text() and 'backendToolDefinitions' in (r/'agents/quality.mjs').read_text():
 print('Escalation patch already applied');raise SystemExit(0)
p=r/'agents/backend.mjs';s=p.read_text().replace("const model=ai.role==='critic'?ai.criticModel:ai.workerModel;","const model=['critic','repair'].includes(ai.role)?ai.criticModel:ai.workerModel;");p.write_text(s)
p=r/'agents/quality.mjs';s=p.read_text()
if 'backendToolDefinitions' not in s:
 s+='''
// Unambiguous named-file tests: model cannot confuse a test label with a file name.
export function backendToolDefinitions(tools,space){
 if(!space.backend||!space.allowCode)return tools;
 const files=[...space.files.keys()].filter(n=>/\\.(?:js|mjs)$/.test(n));
 const kept=tools.filter(t=>t.function.name!=='test_js');
 if(files.length)kept.push({type:'function',function:{name:'test_files',description:'Run assertions against actual existing JS files in a disposable worker. No DOM/window/network/imports. Code contains tests only, not copied implementation. Use globalThis for shared exports. Files are loaded BEFORE assertions.',parameters:{type:'object',properties:{files:{type:'array',items:{type:'string',enum:files},minItems:1,maxItems:6},code:{type:'string',description:'Assertions using built-in assert(condition,message). Do not redeclare the implementation or add a test-name field.'}},required:['files','code'],additionalProperties:false}}});
 return kept;
}
'''
 s=s.replace(" if(space.backend&&role==='worker')prompt+=", " if(space.backend&&role==='worker')prompt+='\\nFör befintliga JS-filer erbjuds test_files {files:[\\\"logic.js\\\"],code:\\\"assert(...)\\\"}. Det ersätter det äldre test_js-namnet. Det finns inget name-fält för testetiketter. Bibliotek som ska testas utan DOM måste kunna laddas utan window eller document: använd globalThis för delade exports, eller flytta fönsterkopplingen till UI-filen. const/let på toppnivå skapar INTE en egenskap på window. Referenser mellan filer måste därför vara konsekventa. Vid ett misslyckat test ska det faktiska felet i loggen rättas innan ny finish. Håll implementationen minimal; undvik tomma funktioner och överflödiga system.';\n if(space.backend&&role==='worker')prompt+=",1)
p.write_text(s)
p=r/'agents/runner.mjs';s=p.read_text().replace('import {taskKind,normalizeStrategy,','import {backendToolDefinitions,taskKind,normalizeStrategy,',1)
s=s.replace("const tool=typeof action?.tool==='string'?action.tool:'okänt';","const requestedTool=typeof action?.tool==='string'?action.tool:'okänt';\n  const tool=requestedTool==='test_files'?'test_js':requestedTool;")
s=s.replace('  space.audit.push(event);emit(\'observation\',event);',"""  space.audit.push(event);emit('observation',event);
  if(space.backend&&space.advanced&&tool==='test_js'){
    // A successful HTTP/tool dispatch is NOT a passed code test.
    const failed=!event.ok||event.data?.passed!==true||!(event.data?.assertions>0);
    space.pendingIssues=space.pendingIssues.filter(x=>!x.startsWith('TEST: '));
    if(failed){
      const names=args.files||[args.name].filter(Boolean);
      space.pendingIssues.push('TEST: '+names.join(', ')+': '+(event.error||event.data?.error||'Inga körda assertions')+'. Felsök den aktuella kodfilen; kör inte samma fel oförändrat.');
      record(space,emit,'repair_required',{reason:'actual_test_failure',files:names,error:event.error||event.data?.error||'No assertions',nextRole:'repair'});
    }else{
      const current=new Set((event.data.versions||[]).filter(v=>space.files.get(v.name)?.version===v.version).map(v=>v.name));
      space.pendingIssues=space.pendingIssues.filter(x=>!x.startsWith('Inga godkända assertions mot aktuell version')&&![...current].some(n=>x==='Misslyckat test för '+n||x==='Senaste testet för aktuell version misslyckades: '+n));
    }
  }""")
s=s.replace('      const answer=await ask(messages,tools,',"      if(space.backend&&!planning&&!reviewNext)tools=backendToolDefinitions(tools,space);\n      const answer=await ask(messages,tools,")
p.write_text(s)
p=r/'tests/backend-v6.mjs';s=p.read_text().replace("['work','architect','critic']","['work','architect','critic','repair']").replace("role==='critic'?'critic:free'","['critic','repair'].includes(role)?'critic:free'");p.write_text(s)
