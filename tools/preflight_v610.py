from pathlib import Path
p=Path('agents/runner.mjs');s=p.read_text()
old='const canVerify=!planning&&!reviewNext&&verificationRequired(space)&&space.expectedNames.size&&remainingFiles(space).length===0;'
new='''let canVerify=!planning&&!reviewNext&&verificationRequired(space)&&space.expectedNames.size&&remainingFiles(space).length===0;
      if(canVerify){
        const signature=JSON.stringify([...space.files.values()].map(f=>[f.name,f.version]));
        if(space.projectCheckpoint?.signature!==signature){
          const project=await toolAction(space,{tool:'check_project',args:{}},emit,check,signal,'pre-verification');
          space.projectCheckpoint={signature,passed:project.ok&&project.data?.passed===true,issues:project.data?.issues||[project.error||'Projektkontroll misslyckades.']};
        }
        space.pendingIssues=space.pendingIssues.filter(x=>!x.startsWith('PROJECT: '));
        if(!space.projectCheckpoint.passed){space.pendingIssues.push(...space.projectCheckpoint.issues.map(x=>'PROJECT: '+x));canVerify=false;}
      }'''
assert old in s;p.write_text(s.replace(old,new))
p=Path('tests/verification-v610.mjs');p.write_text(p.read_text()+'''
test('compile failure is sent for repair before any verifier is called',async()=>{
 const s=setup();s.write('index.html','<!doctype html><script src="logic.js"></script>');s.strategy={objective:'working program',criteria:[],deliverables:['logic.js','index.html'],choice:'plain JS'};s.expectedNames.add('logic.js');s.expectedNames.add('index.html');const roles=[];
 const tool=s.tool.bind(s);s.tool=async(name,args)=>name==='check_project'?{passed:false,issues:['Duplicate lexical declaration in scripts']}:tool(name,args);
 const ai={provider:'backend',calls:0,lastModel:'mock',async ask(){this.calls++;roles.push(this.role);return {text:JSON.stringify({kind:'final',answer:'done'}),model:'mock'};}};
 const r=await runAgent({question:'Skapa logic.js och index.html',ai,space:s,signal:s.signal,maxSteps:2,review:false,advanced:true,mode:'build',verifyBehavior:true});
 assert.equal(r.unfinished,true);assert.ok(!roles.includes('verifier'));assert.ok(roles.every(x=>x==='repair'));assert.equal(s.audit.filter(x=>x.tool==='check_project').length,1);
});
''')
