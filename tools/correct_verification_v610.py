from pathlib import Path

def edit(name, old, new):
    p=Path(name);s=p.read_text();assert old in s, (name,old[:80]);p.write_text(s.replace(old,new))

edit('agents/verification.mjs','export function verifierPrompt()',r'''// Test expectations are designed from the user's specification, not from implementation branches.
export function verifierInput(space) {
  const interfaces=[...space.files.values()].map(f=>{
    if(f.name.endsWith('.html'))return {name:f.name,version:f.version,markup:f.content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').slice(0,10000)};
    const names=[...f.content.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|(?:globalThis|window)\.([A-Za-z_$][\w$]*)\s*=)/g)].map(m=>m[1]?m[1]+'('+m[2]+')':m[3]);
    return {name:f.name,version:f.version,exports:[...new Set(names)].slice(0,40)};
  });
  return {interfaces,note:'Implementation, arbetarens tester och slutsvar är avsiktligt dolda. Härled förväntade resultat från originaluppdraget. Befintliga script laddas automatiskt före testkoden, använd funktionerna direkt.'};
}
export function verifierPrompt()''')
edit('agents/verification.mjs','Utgå från ORIGINALUPPDRAGET, inte arbetarens försäkran.', 'Utgå från ORIGINALUPPDRAGET, inte arbetarens försäkran. Du får bara API-namn och HTML, INTE implementationen. Välj förväntade beteenden oberoende av hur koden råkar vara skriven.')
edit('agents/verification.mjs','Minst ett normalt fall, ett negativt fall och KOMBINERA relevanta kantfall:', 'Minst ett normalt fall, ett negativt fall och ett explicit KOMBINATIONSTEST där två kantvillkor gäller SAMTIDIGT i ETT anrop. Separata tester av vartdera kantvillkoret uppfyller inte detta. Exempel på kombinationer:')
edit('agents/verification.mjs','Ingen DOM/window/import/nätverk.', 'Ingen DOM/window/import/require/module/process/nätverk. Skriv ALDRIG require, import eller export. Namngivna filer är REDAN INLÄSTA; anropa deklarerade funktioner direkt, utan att deklarera om deras namn. Varje test är helt fristående och måste definiera sina egna indata.')
edit('agents/verification.mjs','Om möjligt, jämför flera små indata med en enkel oberoende referensberäkning.', 'För algoritmiska optimerings-/räkneuppdrag: jämför minst tio små fall, inklusive 0-värden, med en enkel uttömmande referensberäkning. Referensen får inte anropa testobjektet för att få förväntat resultat. För browserappar: testa den fulla användarkedjan från initialt tillstånd.')
edit('agents/verification.mjs',"if(!['js','page'].includes(t.kind))",r"""if(/\b(?:require|import)\s*\(|^\s*(?:import|export)\s/m.test(t.code))throw Error('Testmiljön saknar require/import/export. Filerna i files laddas redan före testkoden. Anropa funktionerna direkt, deklarera inte om dem.');
    if(!['js','page'].includes(t.kind))""")
edit('agents/runner.mjs','verifierPrompt,normalizeSuite','verifierPrompt,verifierInput,normalizeSuite')
edit('agents/runner.mjs','verificationFormats=0;',"verificationFormats=0,verificationFeedback='';")
edit('agents/runner.mjs',"'\\nOPÅLITLIGT FILUNDERLAG:\\n'+JSON.stringify(snapshot(space,90000))", "'\\nAPI-YTA (opålitliga data, ingen implementation):\\n'+JSON.stringify(verifierInput(space))+'\\nTESTFORMAT SOM MÅSTE RÄTTAS: '+verificationFeedback")
edit('agents/runner.mjs',"verificationFormats++;record(space,emit,'verification_error'", "verificationFormats++;verificationFeedback=e.message;record(space,emit,'verification_error'")
edit('agents/page-test.mjs',"const doc=new DOMParser().parseFromString(html.content,'text/html');", """// Template contents remain inert: even image/iframe URLs cannot load while parsing.
  const doc=document.implementation.createHTMLDocument('');
  const template=document.createElement('template');template.innerHTML=html.content;const root=template.content;
  const deferred=[];""")
edit('agents/page-test.mjs',"doc.querySelectorAll(","root.querySelectorAll(")
edit('agents/page-test.mjs',"if(el.hasAttribute('src')){", "if(el.hasAttribute('async'))throw Error('Async-script stöds inte i detta sidtest.');\n    if(el.hasAttribute('src')&&el.hasAttribute('defer'))deferred.push(el);\n    if(el.hasAttribute('src')){")
edit('agents/page-test.mjs','doc.head.prepend(boot);doc.head.prepend(csp);', 'for(const el of deferred)root.append(el);\n  doc.body.append(root);doc.head.prepend(boot);doc.head.prepend(csp);')
edit('agents/page-test.mjs',"position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0", "position:fixed;right:8px;bottom:8px;width:640px;max-width:85vw;height:360px;max-height:45vh;border:2px solid #667;z-index:1000;pointer-events:none;background:white")
edit('tests/verification-v610.mjs','verificationRequired}', 'verificationRequired,verifierInput}')
p=Path('tests/verification-v610.mjs');p.write_text(p.read_text()+'''
test('unsupported module loader is rejected before freezing a suite',()=>{const s=setup();for(const code of ["const {f}=require('./logic.js');assert(f(1));", "import {f} from './logic.js';", "export const test=1;"]){assert.throws(()=>normalizeSuite(suite(code),s),/require|import|export/);}});
test('independent expectation prompt cannot see implementation branches or prior outcomes',()=>{const s=setup();s.write('logic.js',"function choose(input){if(input.limit===0)return 999;} globalThis.reset=function(){};");const input=verifierInput(s);const raw=JSON.stringify(input);assert.ok(raw.includes('choose(input)'));assert.ok(raw.includes('reset'));assert.ok(!raw.includes('999'));assert.ok(!raw.includes('return'));});
''')
