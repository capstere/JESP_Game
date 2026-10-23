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
 if(role==='worker')prompt=prompt.replace('1500–3000','1200–1800')+'\nTjänstens svarstak är litet. Om en kodfil är större: write_file första delen, sedan append_file i separata beslut. Högst 1800 tecken kod per anrop. Skriv ALDRIG flera JSON-objekt i samma funktions arguments. Använd separata anrop eller separata beslut. Avsluta inte förrän de ihopbyggda filerna är kompletta och testade enligt tillåtelserna.';
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
