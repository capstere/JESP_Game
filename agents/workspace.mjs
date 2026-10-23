import {Workspace as BaseWorkspace,filename,check} from './runtime.mjs?v=5.1.1';
import {projectCheck} from './quality.mjs?v=6.0.0';
export class Workspace extends BaseWorkspace {
  async tool(name,args={}) {
    check(this.signal);
    if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Verktygsargument måste vara ett objekt.');
    if(name==='list_files')return {files:[...this.files.values()].map(({name,version,bytes,content})=>({name,version,bytes,lines:content.split('\n').length}))};
    if(name==='check_project')return projectCheck(this);
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
      const harness='let __jesp_assertions=0;const assert=(ok,message="Assertion failed")=>{__jesp_assertions++;if(!ok)throw new Error(message);};\n'+body+'\n;return {assertions:__jesp_assertions};';
      const result=await this.execute(harness,this.signal);
      let count=Number(result.value?.assertions??0);if(typeof result.value==='string')try{count=Number(JSON.parse(result.value).assertions||0);}catch{}
      return {...result,assertions:Number.isFinite(count)?count:0,versions:files.map(f=>({name:f.name,version:f.version})),...(files.length===1?{file:files[0].name,version:files[0].version}:{})};
    }
    return super.tool(name,args);
  }
}
