import {executePageTest} from './page-test.mjs?v=6.1.0';
import {ASSERT_HARNESS} from './test-harness.mjs?v=6.1.0';
import {failureDiagnostics,crossScriptSyntax} from './diagnostics.mjs?v=6.1.0';
import {Workspace as BaseWorkspace,filename,check} from './runtime.mjs?v=5.1.1';
import {projectCheck} from './quality.mjs?v=6.4.0';
import {fpsStarter} from './game-scaffold.mjs?v=6.1.0';
export class Workspace extends BaseWorkspace {
  async tool(name,args={}) {
    check(this.signal);
    if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Verktygsargument måste vara ett objekt.');
    if(name==='scaffold_fps'){
      if(this.taskKind!=='build'||!/(?:\bfps\b|first[- ]person|förstaperson)/i.test(this.question||''))throw new Error('FPS-startmotorn är enbart för ett uttryckligt FPS-bygguppdrag.');
      const files=fpsStarter();
      if(Object.keys(files).some(path=>this.files.has(path)))throw new Error('Startmotorn får inte ersätta befintliga filer. Fortsätt med edit_file/append_file.');
      const saved=[];
      for(const [path,source] of Object.entries(files))saved.push(this.write(path,source));
      return {saved:true,template:'audited-fps-v1',files:saved.map(f=>({name:f.name,version:f.version,bytes:f.bytes})),note:'Startkoden är en granskad mall, inte kod som modellen har uppfunnit. Testa fortfarande uppdragets beteenden innan avslut.'};
    }
    if(name==='test_page'){
      if(!this.allowCode)throw Error('Sidtester kräver användarens godkännande för kodkörning.');
      return executePageTest(this.files,args,this.signal);
    }
    if(name==='list_files')return {files:[...this.files.values()].map(({name,version,bytes,content})=>({name,version,bytes,lines:content.split('\n').length}))};
    if(name==='check_project'){
      const base=projectCheck(this);
      if(!base.passed||!this.backend||!this.allowCode||!this.execute)return base;
      const syntax=await crossScriptSyntax(this,this.signal);
      const syntaxIssues=syntax.performed?syntax.checks.filter(c=>!c.passed).map(c=>'Klassiska scripts i '+c.page+': '+c.error):[];
      return {...base,passed:base.passed&&!syntaxIssues.length,issues:[...base.issues,...syntaxIssues],syntax};
    }
    if(name==='patch_files') {
      const edits=args.edits;
      if(!Array.isArray(edits)||edits.length<1||edits.length>6)throw new Error('patch_files kräver 1–6 versionskontrollerade ändringar.');
      const changed=new Map(),seen=new Set();
      for(const edit of edits){
        if(!edit||typeof edit!=='object'||Array.isArray(edit))throw new Error('Varje ändring måste vara ett objekt.');
        const path=filename(edit.name),old=this.files.get(path);
        if(!old)throw new Error('Filen finns inte: '+path);
        if(seen.has(path))throw new Error('Samma fil får bara ändras en gång i en transaktion: '+path);seen.add(path);
        if(!Number.isInteger(edit.expected_version)||edit.expected_version!==old.version)throw new Error('Versionskonflikt: '+path+'. Läs version '+old.version+' igen.');
        if(typeof edit.find!=='string'||!edit.find.length||typeof edit.replace!=='string')throw new Error('Kräver icke-tom find och text i replace.');
        const i=old.content.indexOf(edit.find);
        if(i<0||old.content.indexOf(edit.find,i+1)>=0)throw new Error('find måste matcha exakt en gång i '+path);
        const next=old.content.slice(0,i)+edit.replace+old.content.slice(i+edit.find.length),bytes=new TextEncoder().encode(next).length;
        if(bytes>100000)throw new Error('Filen är större än 100 kB: '+path);
        changed.set(path,{name:path,content:next,version:old.version+1,bytes});
      }
      const next=new Map(this.files);for(const [path,file] of changed)next.set(path,file);
      if([...next.values()].reduce((n,f)=>n+f.bytes,0)>500000)throw new Error('Arbetsytans maximala storlek är 500 kB.');
      this.files=next;for(const file of changed.values())this.emit('file',file);
      return {patched:true,versions:[...changed.values()].map(({name,version,bytes})=>({name,version,bytes})),count:changed.size};
    }
    if(['append_file','edit_file'].includes(name)) {
      const file=this.files.get(filename(args.name));if(!file)throw new Error('Filen finns inte.');
      if(!Number.isInteger(args.expected_version)||args.expected_version!==file.version)throw new Error('Versionskonflikt. Läs '+file.name+' igen. Aktuell version: '+file.version);
      if(name==='append_file') {
        if(typeof args.content!=='string'||!args.content.length)throw new Error('Icke-tom content krävs.');
        return this.write(file.name,file.content+args.content);
      }
      if(typeof args.find!=='string'||!args.find.length||typeof args.replace!=='string')throw new Error('find måste vara icke-tom text och replace text.');
      const at=file.content.indexOf(args.find);
      if(at<0||file.content.indexOf(args.find,at+1)>=0)throw new Error('find måste matcha exakt EN gång. Läs filen och välj ett unikt avsnitt.');
      return this.write(file.name,file.content.slice(0,at)+args.replace+file.content.slice(at+args.find.length));
    }
    if(name==='read_file'&&(args.start_line!==undefined||args.end_line!==undefined)) {
      const f=this.files.get(filename(args.name));if(!f)throw new Error('Filen finns inte.');
      const lines=f.content.split('\n'),start=args.start_line??1,end=args.end_line??Math.min(lines.length,start+159);
      if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||start>lines.length||end-start>299)throw new Error('Ange giltiga 1-baserade rader; högst 300 rader per läsning.');
      return {name:f.name,version:f.version,totalLines:lines.length,start_line:start,end_line:Math.min(end,lines.length),content:lines.slice(start-1,end).join('\n')};
    }
    if(name==='test_js'&&this.advanced) {
      if(!this.allowCode||!this.execute)throw new Error('Kodtester kräver användarens godkännande.');
      if(typeof args.code!=='string'||!args.code.trim())throw new Error('Testkod krävs.');
      const names=args.files!==undefined?args.files:args.name?[args.name]:[];
      if(!Array.isArray(names)||names.length>6||args.files&&args.name)throw new Error('Ange name ELLER files (högst sex), inte båda.');
      if(this.backend && names.length===0 && [...this.files.keys()].some(n=>/\.(js|mjs)$/.test(n)))throw new Error('Ange name eller files för att testa de sparade filerna, inte en kopia av implementationen. Tillgängliga JS-filer: '+[...this.files.keys()].filter(n=>/\.(js|mjs)$/.test(n)).join(', '));
      const files=names.map(name=>{const f=this.files.get(filename(name));if(!f)throw new Error('Filen finns inte: '+name);return f;});
      const source=files.map(f=>f.content).join('\n;\n');
      const body=source+'\n;\n'+args.code;
      if(body.length>29000)throw new Error('Högst 29 000 tecken kod/test; testa en mindre modul.');
      const harness=ASSERT_HARNESS+body+'\n;return {assertions:__jesp_assertions};';
      const result=await this.execute(harness,this.signal);
      let count=Number(result.value?.assertions??0);if(typeof result.value==='string')try{count=Number(JSON.parse(result.value).assertions||0);}catch{}
      return {...result,...(result.passed!==true?{diagnostics:failureDiagnostics(files,args.code,result.error)}:{}),assertions:Number.isFinite(count)?count:0,versions:files.map(f=>({name:f.name,version:f.version})),...(files.length===1?{file:files[0].name,version:files[0].version}:{})};
    }
    return super.tool(name,args);
  }
}
