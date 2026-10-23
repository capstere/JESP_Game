import {FINAL_REVIEW_PROMPT,CALCULATION_PROMPT} from './final-review.mjs?v=6.0.1';
export * from './goal-contract.mjs?v=5.2.0';
import {qualityIssues as baseQuality,reviewCheckIssues as baseReview,taskKind as baseTaskKind,advancedPrompt as basePrompt,normalizeStrategy as baseStrategy,strategyDefinitions as baseStrategyDefinitions} from './goal-contract.mjs?v=5.2.0';
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
 if(space.backend&&role==='critic')prompt+=FINAL_REVIEW_PROMPT;
 if(space.backend&&role==='worker')prompt+=CALCULATION_PROMPT;
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
 schema.required=[...schema.required.filter(k=>k!=='alternatives'),'approach_a','approach_b'];
 return definitions;
}
const itemText=value=>typeof value==='string'?value:typeof value?.requirement==='string'?value.requirement:typeof value?.description==='string'?value.description:typeof value?.text==='string'?value.text:'';
export function normalizeStrategy(value,space,validateName) {
 if(!value||typeof value!=='object')return baseStrategy(value,space,validateName);
 const normalized={...value};
 if(typeof value.approach_a==='string'&&typeof value.approach_b==='string')normalized.alternatives=[value.approach_a,value.approach_b];
 for(const key of ['alternatives','criteria','steps','assumptions'])if(Array.isArray(normalized[key]))normalized[key]=normalized[key].map(itemText);
 return baseStrategy(normalized,space,validateName);
}

// Unambiguous named-file tests: model cannot confuse a test label with a file name.
export function backendToolDefinitions(tools,space){
 if(!space.backend||!space.allowCode)return tools;
 const files=[...space.files.keys()].filter(n=>/\.(?:js|mjs)$/.test(n));
 const kept=tools.filter(t=>t.function.name!=='test_js');
 if(files.length)kept.push({type:'function',function:{name:'test_files',description:'Run assertions against actual existing JS files in a disposable worker. No DOM/window/network/imports. Code contains tests only, not copied implementation. Use globalThis for shared exports. Files are loaded BEFORE assertions.',parameters:{type:'object',properties:{files:{type:'array',items:{type:'string',enum:files},minItems:1,maxItems:6},code:{type:'string',description:'Assertions using built-in assert(condition,message). Do not redeclare the implementation or add a test-name field.'}},required:['files','code'],additionalProperties:false}}});
 return kept;
}
