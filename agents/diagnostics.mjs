// Bounded source-location hints from actual failed tests. Not code execution or semantic proof.
export function failureDiagnostics(files,test,error){
 const message=String(error||'').slice(0,1000);
 const match=message.match(/\b([A-Za-z_$][\w$]*) is not defined\b/);
 const identifier=match?.[1];
 if(!identifier)return {kind:'runtime_error',message,hint:'Felsök den senaste misslyckade assertionen mot aktuell filversion; ändra inte ett korrekt krav bara för att få grönt.'};
 const re=new RegExp('(^|[^\\w$])'+identifier.replace(/[$]/g,'\\$')+'(?![\\w$])');
 const occurrences=[];
 for(const f of [...files,{name:'<test>',version:null,content:test}]){
  const lines=String(f.content||'').split('\n');
  for(let i=0;i<lines.length&&occurrences.length<16;i++)if(re.test(lines[i]))occurrences.push({file:f.name,version:f.version,line:i+1,text:lines[i].slice(0,260)});
 }
 return {kind:'missing_identifier',identifier,occurrences,hint:identifier==='window'||identifier==='document'?'Testmiljön saknar DOM. Flytta DOM-koppling till UI-filen; använd globalThis för DOM-fria exportobjekt och rätta SAMTLIGA relevanta kvarvarande referenser i både implementation och test. Testmiljön får inte maskera detta genom en falsk DOM.':'Kontrollera var identifieraren definieras och exponeras. Matcherna är textbaserade ledtrådar, inte bevis för exekveringsordning.'};
}
export function scriptGroups(space){
 const groups=[];
 for(const f of space.files.values()){
  if(!/\.html?$/i.test(f.name))continue;
  const names=[];
  for(const tag of f.content.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi)){
   if(/\btype\s*=\s*["']module["']/i.test(tag[1]))continue;
   const src=tag[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
   if(!src||/^(?:https?:|\/\/|data:)/i.test(src))continue;
   const name=src.replace(/^\.\//,'').split(/[?#]/)[0];
   if(space.files.has(name)&&/\.js$/i.test(name))names.push(name);
  }
  if(names.length>=2&&names.length<=6)groups.push({page:f.name,names,versions:names.map(n=>({name:n,version:space.files.get(n).version})),source:names.map(n=>space.files.get(n).content).join('\n;\n')});
 }
 return groups;
}
export async function crossScriptSyntax(space,signal){
 const groups=scriptGroups(space);
 if(!groups.length)return {performed:false,reason:'Ingen grupp med flera lokala klassiska scripts.'};
 if(!space.allowCode||!space.execute)return {performed:false,reason:'Kodkontroll kräver separat användargodkännande.'};
 const checks=[];
 for(const group of groups){
  if(group.source.length>23000){checks.push({page:group.page,passed:false,error:'Scriptgruppen är för stor för den isolerade syntaxkontrollen; dela upp implementationen.',versions:group.versions});continue;}
  // Compile only in the existing opaque-origin worker. Source is JSON-encoded data, never invoked.
  const code='const source='+JSON.stringify(group.source)+';new Function("\\\"use strict\\\";\\n"+source);return "compiled_without_execution";';
  const result=await space.execute(code,signal);
  checks.push({page:group.page,files:group.names,versions:group.versions,passed:result.passed===true,error:result.error||null});
 }
 return {performed:true,passed:checks.every(c=>c.passed),checks,scope:'Enbart syntax/global deklarationskollision för klassiska scripts. Genererade program anropades INTE. Ingen DOM- eller spelbarhetskontroll.'};
}
