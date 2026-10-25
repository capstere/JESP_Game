import {FINAL_REVIEW_PROMPT,CALCULATION_PROMPT} from './final-review.mjs?v=6.1.0';
import {enforceUserContract} from './requirements.mjs?v=6.2.0';
export * from './goal-contract.mjs?v=6.2.0';
import {qualityIssues as baseQuality,reviewCheckIssues as baseReview,taskKind as baseTaskKind,advancedPrompt as basePrompt,normalizeStrategy as baseStrategy,strategyDefinitions as baseStrategyDefinitions} from './goal-contract.mjs?v=6.2.0';
export function taskKind(question,mode='auto') {
 if(mode!=='auto')return baseTaskKind(question,mode);
 const q=String(question).toLowerCase();
 const base=baseTaskKind(question,mode);if(base==='plan')return base;
 if(/^(?:plan(?:\s|:)|planera\b|planning\b)/.test(q.trim()))return 'plan';
 if(/(?:skriv|write)\s+(?:(?:en|ett|a|the|fungerande|körbar|working|runnable)\s+)*(?:kod|code|funktion|function|program)\b|(?:utveckla|develop)\s+(?:(?:en|ett|a|an)\s+)?(?:app|spel|game|program|webbplats|website)\b/.test(q))return 'build';
 return base;
}
// Evidence is tied to the CURRENT artifact version, including read-back tool references.
const versions=e=>Array.isArray(e?.data?.versions)?e.data.versions:e?.data?.version&& (e.data.file||e.data.name)?[{name:e.data.file||e.data.name,version:e.data.version}]:[];
export function qualityIssues(space) {
 const issues=baseQuality(space);
 if(!space.advanced)return issues;
 for(const f of space.files.values()){
  const tests=space.audit.filter(e=>e.tool==='test_js'&&versions(e).some(v=>v.name===f.name&&v.version===f.version));
  if(tests.length&&(!tests.at(-1).ok||tests.at(-1).data?.passed!==true))issues.push('Senaste testet för aktuell version misslyckades: '+f.name);
 }
 return [...new Set(issues)];
}
export function reviewCheckIssues(decision,space) {
 const issues=baseReview(decision,space);
 if(!space.advanced)return issues;
 for(const c of Array.isArray(decision.checks)?decision.checks:[])for(const ref of Array.isArray(c?.evidence)?c.evidence:[]){
  const match=typeof ref==='string'&&ref.match(/^tool:(T\d+)$/);if(!match)continue;
  const event=space.audit.find(e=>e.id===match[1]);
  if(versions(event).some(v=>space.files.get(v.name)?.version!==v.version))issues.push('Föråldrat verktygsbevis '+ref+' för '+c.id+'. Granska aktuell filversion.');
 }
 return [...new Set(issues)];
}

export function advancedPrompt(space,role) {
 let prompt=basePrompt(space,role);
 if(role==='architect')prompt+='\nAcceptanskriterier ska beskriva uppdragets faktiska funktioner, inte enbart filantal/struktur. Ta med de centrala beteenden användaren begär, exempelvis rörelse, skott och återställning för ett spel eller rätt beräkningsresultat för analys. Beställ inte onödiga extra leveranser. Behåll svenska om uppdraget är svenskt. Fyll approach_a och approach_b med två olika konkreta alternativ som text. criteria är en lista med minst två strängar. Alla schemafält måste fyllas, men skriv kort.';
 if(role==='worker'&&!space.backend)prompt=prompt.replace('1500–3000','1200–1800')+'\nTjänstens svarstak är litet. Om en kodfil är större: write_file första delen, sedan append_file i separata beslut. Högst 1800 tecken kod per anrop. Skriv ALDRIG flera JSON-objekt i samma funktions arguments. Använd separata anrop eller separata beslut. Avsluta inte förrän de ihopbyggda filerna är kompletta och testade enligt tillåtelserna.';
 if(space.backend&&role==='worker')prompt+='\nFör befintliga JS-filer erbjuds test_files {files:[\"logic.js\"],code:\"assert(...)\"}. Det ersätter det äldre test_js-namnet. Det finns inget name-fält för testetiketter. Bibliotek som ska testas utan DOM måste kunna laddas utan window eller document: använd globalThis för delade exports, eller flytta fönsterkopplingen till UI-filen. const/let på toppnivå skapar INTE en egenskap på window. Referenser mellan filer måste därför vara konsekventa. Vid ett misslyckat test ska det faktiska felet i loggen rättas innan ny finish. Håll implementationen minimal; undvik tomma funktioner och överflödiga system.';
 if(space.backend&&role==='worker')prompt+='\nNär du använder test_js: Använd alltid name/files för befintliga kodfiler och skriv ENDAST assertions samt små testdata i code. Klistra aldrig in en separat kopia av implementationen. Om ett test avslöjar ett fel: rätta kodfilen, anpassa inte testkravet för att dölja felet. Håll testkod kort. Gör högst en större filskrivning per beslut för att undvika serverns tidsgräns.';
 if(space.backend)prompt+='\nBackendläget har större begärd svarbudget. Den äldre gränsen på 1500 token gäller INTE denna anslutning. Leverera kompletta användbara filer, upp till cirka 5000 tecken per beslut; använd edit_file/append_file bara när det behövs. Flera modeller kan användas: arbetare och kritiker behöver inte vara samma modell. Alla tester och slutsatser måste ändå ha konkreta belägg.';
 if(space.backend)prompt+='\nOriginaluppdragets detaljer har företräde framför det sammanfattade kontraktet. Bevara uttryckliga krav på startläge, gränsvärden, outputstruktur och verifierbara funktioner. Kombinera kantfallen i testerna; ett korrekt isolerat kantfall bevisar inte kombinationen. Förneka inte ett krav genom ett snävare antagande. Använd korta slutsvar med bara verifierade resultat; nya siffervärden och rangordningar måste först beräknas.';
 if(space.backend&&role==='worker'&&/(?:fps|first.person|shoot|skjut|spel|gameState)/i.test(space.question||''))prompt+='\nFör tangentstyrda spel: normalisera event.key med toLowerCase() eftersom användares W-tangent skickar gemen w. Testa WASD från dokumentet, inte enbart stora tecken. Om ett synligt startmål krävs ska det både RITAS på canvas framför spelaren och kunna träffas av skott redan från start; väggträff får inte ersätta målträff. Uppdatera window.gameState på varje tangenthandling, ge poäng när rätt mål träffas och återställ allt med R. För browserbeteendetest: syntetisk keydown bubblar från document till window.';
 if(space.backend&&role==='worker')prompt+='\nGör en liten krav-till-test-checklista före finish: för varje uttryckligt beteende, välj ett test som faktiskt utlöser beteendet, inklusive initialt tillstånd och återställning. Testa positiva OCH negativa utfall, inte bara att funktionen existerar. Om originaluppdraget kräver en händelse direkt från startläget, ska just startläget testas utan extra förflyttning eller omkonfigurering. test_files.files är en riktig JSON-array som ["logic.js"], inte en serialiserad sträng. I DOM-fria tester används globalThis, inte window. Testa inte samma redan godkända version om och om igen utan nytt krav eller ändring.';
 if(space.backend&&role==='architect')prompt+='\nFormulera beteendekriterier som tillstånd + handling + förväntad effekt. Bevara uttryckliga startlägeskrav och nödvändiga kombinationer av kantfall; gör dem inte till svagare allmänna funktionsbeskrivningar.';
 if(space.backend&&role==='critic')prompt+=FINAL_REVIEW_PROMPT;
 if(space.verifyBehavior&&space.allowCode)prompt+='\nEn separat testroll skapar och kör bevarade beteendetester så snart leveranserna finns. VERIFY-fel måste rättas i implementationen, inte förklaras bort. Samma tester körs automatiskt om efter en filändring. Sidtest stöder riktig DOM/canvas/input i en isolerad browserram, men ingen extern nätverkstrafik och inga moduler. Välj enkla klassiska scripts, deterministiskt startläge och strikt avgränsade loopar. Leverera full funktionalitet innan du säger klart.';
 if(space.backend&&role==='worker')prompt+='\nTestverktyget har assert(villkor,meddelande), assert.equal, assert.deepEqual och assert.throws. Använd patch_files för samordnade versionskontrollerade ändringar i flera filer som måste klara testerna som en enhet. Använd inte Chai/Jest eller array.deepEqual; inga externa testbibliotek finns. När alla leveranser finns och aktuella tester passerar går appen vidare till ett kort kandidatsvar och separat kritik. Det hindrar ändlösa omtester utan att ersätta granskningen.';
 if(space.backend&&role==='worker')prompt+=CALCULATION_PROMPT+`
Vid ett testfel: använd diagnostics för att lokalisera ALLA relevanta kvarvarande referenser i både kod och test. En read_file utan ändring reparerar inte felet. Om samma fel kvarstår efter två försök, gör en liten sammanhängande rättning av den berörda modulen, eller byt konkret angreppssätt. Maskera aldrig felet med hårdkodade godkända värden. Exponera DOM-fria funktioner via globalThis; håll browserkoppling i UI-filen. Isolera klassiska scriptfiler i egna IIFE/namnrymder så globala const/let inte kolliderar. Kör check_project efter att alla JS-filer finns: det kan upptäcka syntax- och deklarationskollisioner utan att köra själva appen.`;
 return prompt;
}

// Two required named options avoid repeatedly requesting an underfilled alternatives array.
export function strategyDefinitions() {
 const definitions=baseStrategyDefinitions();
 const schema=definitions[0].function.parameters;
 delete schema.properties.alternatives;
 schema.properties.approach_a={type:'string',description:'First feasible approach and its tradeoff.'};
 schema.properties.approach_b={type:'string',description:'A distinct second feasible approach and its tradeoff.'};
 schema.properties.criteria.minItems=2;schema.properties.criteria.maxItems=5;
 schema.properties.deliverables={type:'array',minItems:0,maxItems:6,items:{type:'string',description:'ONLY a plain file basename such as solver.js or resultat.json. No descriptions, no test steps, no extra words.'}};
 schema.required=[...schema.required.filter(k=>k!=='alternatives'),'approach_a','approach_b'];
 return definitions;
}
const itemText=value=>typeof value==='string'?value:typeof value?.requirement==='string'?value.requirement:typeof value?.description==='string'?value.description:typeof value?.text==='string'?value.text:'';

// Observed free model put file descriptions and a procedural test task in the filename list.
// Only recognize exact, unambiguous BASENAME + prose separators; never clean dangerous paths.
export function normalizeModelDeliverables(values) {
 const notes=[],names=[];
 for(const value of values) {
  if(typeof value!=='string'){names.push(value);continue;}
  const original=value.trim();
  const m=/^([\p{L}\p{N}_-]+\.(?:js|mjs|html|css|json|md|txt|csv|py|svg|yml|yaml|xml))\s+(?:(?:med|with|som|innehållande|containing|inklusive|including)\b|[-–—:]\s)/iu.exec(original);
  if(m) { names.push(m[1]);notes.push({kind:'deliverable_description',original,normalized:m[1]});continue; }
  if(/^(?:testkörning|test(?:ing| run|s)?|testa(?:ning)?|kör tester|run tests|verify|verifiering|granskning)\b/iu.test(original)&&!/^\S+\.(?:js|mjs|html|css|json|md|txt|csv|py|svg|yml|yaml|xml)$/iu.test(original)) {
   notes.push({kind:'procedural_step_not_file',original});continue;
  }
  names.push(value); // keep malformed/path-like names unchanged so validateName rejects them
 }
 return {names,notes};
}

export function normalizeStrategy(value,space,validateName) {
 if(!value||typeof value!=='object')return baseStrategy(value,space,validateName);
 const normalized={...value};
 if(typeof value.approach_a==='string'&&typeof value.approach_b==='string')normalized.alternatives=[value.approach_a,value.approach_b];
 for(const key of ['alternatives','criteria','steps','assumptions'])if(Array.isArray(normalized[key]))normalized[key]=normalized[key].map(itemText);
 const fix=Array.isArray(normalized.deliverables)?normalizeModelDeliverables(normalized.deliverables):{notes:[],names:normalized.deliverables};
 normalized.deliverables=fix.names;
 const contract=baseStrategy(normalized,space,validateName);
 const protectedContract=enforceUserContract(contract,space.question);
 space.contractCorrections=(space.contractCorrections||[]).concat(fix.notes,protectedContract.notices);
 return protectedContract.contract;
}

// Unambiguous named-file tests: model cannot confuse a test label with a file name.
export function backendToolDefinitions(tools,space){
 if(!space.backend||!space.allowCode)return tools;
 const files=[...space.files.keys()].filter(n=>/\.(?:js|mjs)$/.test(n));
 const kept=tools.filter(t=>t.function.name!=='test_js');
 if(files.length)kept.push({type:'function',function:{name:'test_files',description:'Run assertions against actual existing JS files in a disposable worker. No DOM/window/network/imports. Code contains tests only, not copied implementation. Use globalThis for shared exports. Files are loaded BEFORE assertions.',parameters:{type:'object',properties:{files:{type:'array',items:{type:'string',enum:files},minItems:1,maxItems:6},code:{type:'string',description:'Assertions using built-in assert(condition,message). Do not redeclare the implementation or add a test-name field.'}},required:['files','code'],additionalProperties:false}}});
 return kept;
}
