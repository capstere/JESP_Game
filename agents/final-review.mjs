// Validate evidence for the final explanation as well as generated artifacts.
// This validates traceability, not the semantic truth of arbitrary model prose.
import {reviewCheckIssues as artifactReview} from './goal-contract.mjs?v=5.2.0';
export function finalAnswerIssues(decision,space){
 if(!space.backend||!space.advanced)return [];
 const issues=[];
 if(typeof decision.final_answer!=='string'||!decision.final_answer.trim()||decision.final_answer.length>12000)issues.push('Slutgranskningen saknar ett komplett final_answer (1–12000 tecken).');
 const check=decision.answer_check;
 if(!check||typeof check!=='object'||Array.isArray(check))return [...issues,'Slutsvarets fakta och jämförelser saknar separat answer_check.'];
 const scope={...space,strategy:{criteria:[{id:'ANSWER',requirement:'Slutsvarets fakta, siffror och jämförelsemetoder följer av faktiskt underlag.'}]}};
 issues.push(...artifactReview({checks:[{...check,id:'ANSWER'}]},scope));
 for(const ref of Array.isArray(check.evidence)?check.evidence:[]){
  const id=typeof ref==='string'&&ref.match(/^tool:(T\d+)$/)?.[1];
  if(!id)continue;
  const event=space.audit.find(e=>e.id===id);
  const versions=event?.data?.versions||(event?.data?.version&&event?.data?.name?[{name:event.data.name,version:event.data.version}]:[]);
  if(versions.some(v=>space.files.get(v.name)?.version!==v.version))issues.push('Slutsvaret hänvisar till föråldrat verktygsbevis '+ref);
  if(event?.tool==='test_js'&&(!(event.data?.assertions>0)||event.data?.passed!==true))issues.push('Slutsvaret hänvisar till ett test utan godkända assertions: '+ref);
 }
 return [...new Set(issues)];
}
export function computationEvidence(space,cap=2000){
 return space.audit.filter(e=>e.ok&&['calculate','verify_quote','test_js'].includes(e.tool)&&e.data?.passed!==false&&(!e.data?.versions||e.data.versions.every(v=>space.files.get(v.name)?.version===v.version))).slice(-12).map(e=>({
  id:e.id,tool:e.tool,expression:e.args?.expression,value:e.data?.value,
  versions:e.data?.versions,assertions:e.data?.assertions,passed:e.data?.passed,matched:e.data?.matched,
  logs:Array.isArray(e.data?.logs)?e.data.logs.slice(-8).map(x=>String(x).slice(0,Math.min(cap,1800))):undefined,
  note:'Faktiskt verktygsresultat. Testdata bevisar inte allmän korrekthet.'
 }));
}
export const FINAL_REVIEW_PROMPT=`
SLUTSVARET ÄR EN EGEN LEVERANS. Granska även notes.draft, inte bara kodfiler och C-kriterier. Kontrollera alla konkreta siffror, jämförelser och motexempel mot computationEvidence och aktuella filer. En jämförelsealgoritms resultat måste vara beräknat med dess faktiska regel, inte ett godtyckligt sämre alternativ. Om sådant underlag saknas eller motsäger svaret: begär revise med en konkret beräkning/test som arbetsagenten ska utföra. Introducera inte nya, obestyrkta resultat när du sammanfattar.
Returnera utöver verdict, answer, issues, checks också:
"answer_check":{"status":"pass|fail|unknown","evidence":["tool:T3" eller "file:resultat.json@v1" eller "source:S1"],"finding":"saklig kontroll av slutsvaret och dess jämförelser"},
"final_answer":"Det slutliga användarsvaret på användarens språk, grundat i kontrollerade resultat; säg konkret vad som inte testats."
Pass kräver både godkända C-kriterier och godkänd answer_check. Enbart återläsning av en fil bevisar inte en numerisk slutsats. Vid sakfel: revise, inte godkänn. Vid pass visas final_answer, inte det ogranskade utkastet.`;
export const CALCULATION_PROMPT=`
När slutsvaret innehåller ett numeriskt resultat, en jämförelsemetod eller ett motexempel: beräkna det med calculate eller test_files och logga den faktiska lösningen med console.log(JSON.stringify(...)). Förlita dig inte på en gissad jämförelsesiffra. Förklara vad testet faktiskt visar och undvik nya sakpåståenden i finish som inte finns i underlaget. Arbetsytan bevarar dessa beräkningsbevis även efter filåterläsning.`;
