from pathlib import Path

def edit(name,old,new):
 p=Path(name);s=p.read_text();assert old in s, (name,old[:70]);p.write_text(s.replace(old,new))

edit('agents/runner.mjs',"import {synthesisReady", "import {artifactKey,verificationRequired,verificationIssues,verifierPrompt,normalizeSuite,executeSuite} from './verification.mjs?v=6.1.0';\nimport {synthesisReady")
edit('agents/runner.mjs',"advanced=false,mode='auto',emit=()=>{}", "advanced=false,mode='auto',verifyBehavior=false,emit=()=>{}")
edit('agents/runner.mjs',"space.backend=ai.provider==='backend';", "space.verifyBehavior=verifyBehavior;space.backend=ai.provider==='backend';")
edit('agents/runner.mjs',"let reviewNext=false,preserveDraft=false;", "let reviewNext=false,preserveDraft=false,verificationFormats=0;")
edit('agents/runner.mjs',"...qualityIssues(space)];", "...qualityIssues(space),...verificationIssues(space)];")
edit('agents/runner.mjs',"const planning=space.advanced&&!space.strategy;", """const planning=space.advanced&&!space.strategy;
      // Tests are written by a distinct role and retained unchanged for subsequent repairs.
      const canVerify=!planning&&!reviewNext&&verificationRequired(space)&&space.expectedNames.size&&remainingFiles(space).length===0;
      if(canVerify&&space.verification?.suite&&space.verification.key!==artifactKey(space)){
        emit('stage',{stage:'review',step,maxSteps});
        await executeSuite(space,emit);record(space,emit,'verification_result',{passed:space.verification.passed,results:space.verification.results});
        tail=[];continue;
      }
      const verifying=canVerify&&!space.verification?.suite;
      if(verifying){
        emit('stage',{stage:'review',step,maxSteps});
        const answer=await ask([{role:'system',content:verifierPrompt()},{role:'user',content:'ORIGINALUPPDRAG:\\n'+question+'\\nOPÅLITLIGT FILUNDERLAG:\\n'+JSON.stringify(snapshot(space,90000))}],undefined,'verifier');
        try{
          if(answer.truncated||answer.protocolError)throw Error('Testförslaget är avklippt eller har ogiltigt format.');
          const raw=parseJSON(answer.text);space.verification={suite:normalizeSuite(raw,space),key:null,passed:false,results:[],executions:0,model:answer.model};
          record(space,emit,'verification_suite',{model:answer.model,tests:space.verification.suite});
          await executeSuite(space,emit);record(space,emit,'verification_result',{passed:space.verification.passed,results:space.verification.results});
        }catch(e){check(signal);verificationFormats++;record(space,emit,'verification_error',{message:e.message});if(verificationFormats>=2){stopReason='verification';break;}space.pendingIssues.push('VERIFY: '+e.message);}
        tail=[];continue;
      }""")
edit('agents/runner.mjs',"strategy:space.strategy||null,taskKind:space.taskKind", "strategy:space.strategy||null,verification:space.verification||null,taskKind:space.taskKind")
edit('agents/backend.mjs',"['architect','critic','repair','synthesis']", "['architect','critic','repair','synthesis','verifier']")
edit('agents/backend.mjs',"['critic','repair','synthesis']", "['critic','repair','synthesis','verifier']")
edit('agents/workspace.mjs',"import {ASSERT_HARNESS}","import {executePageTest} from './page-test.mjs?v=6.1.0';\nimport {ASSERT_HARNESS}")
edit('agents/workspace.mjs',"if(name==='list_files')", """if(name==='test_page'){
      if(!this.allowCode)throw Error('Sidtester kräver användarens godkännande för kodkörning.');
      return executePageTest(this.files,args,this.signal);
    }
    if(name==='list_files')""")
edit('agents/app.mjs',"mode:settings.mode,emit", "mode:settings.mode,verifyBehavior:true,emit")
edit('agents/app.mjs',"const meta={version:VERSION,", "const meta={version:VERSION,verification:space.verification||null,")
edit('agents/evidence.mjs',"requiredFiles:[...space.expectedNames],", "requiredFiles:[...space.expectedNames],\n      verification:space.verification?{passed:space.verification.passed,key:space.verification.key,results:space.verification.results,tests:space.verification.suite?.map(t=>({id:t.id,requirement:t.requirement,kind:t.kind,code:t.code,files:t.files,page:t.page}))}:null,")
edit('agents/quality.mjs',"if(space.backend&&role==='critic')prompt+=FINAL_REVIEW_PROMPT;", """if(space.backend&&role==='critic')prompt+=FINAL_REVIEW_PROMPT;
 if(space.verifyBehavior&&space.allowCode)prompt+='\\nEn separat testroll skapar och kör bevarade beteendetester så snart leveranserna finns. VERIFY-fel måste rättas i implementationen, inte förklaras bort. Samma tester körs automatiskt om efter en filändring. Sidtest stöder riktig DOM/canvas/input i en isolerad browserram, men ingen extern nätverkstrafik och inga moduler. Välj enkla klassiska scripts, deterministiskt startläge och strikt avgränsade loopar. Leverera full funktionalitet innan du säger klart.';""")
for p in Path('agents').glob('*.mjs'):
 s=p.read_text().replace('?v=6.0.1','?v=6.1.0').replace("VERSION='6.0.1'","VERSION='6.1.0'");p.write_text(s)
edit('index.html','Version 6.0.1','Version 6.1.0')
edit('index.html','app.mjs?v=6.0.1','app.mjs?v=6.1.0')
edit('index.html','<meta name="description"', '<meta http-equiv="Content-Security-Policy" content="frame-src \'self\' blob: data:; object-src \'none\'; base-uri \'self\'">\n<meta name="description"')
s=Path('index.html').read_text();s=s.replace('Tillåt isolerade JavaScript-tester','Tillåt isolerade JavaScript- och sidtester');s=s.replace('Ingen nätverksåtkomst eller DOM.', 'Ingen extern nätverksåtkomst. Sidtester använder en isolerad browserram; vid låst kod kan fliken behöva stängas.');Path('index.html').write_text(s)
edit('index.html','Tillåt isolerade JavaScript- och sidtester utan nätverk (högst 4 sekunder/test)','Tillåt kodtester: isolerad JS (4 s) och browserram (10 s). Ingen extern nätverkstrafik. Låst sidkod kan kräva att fliken stängs.')
