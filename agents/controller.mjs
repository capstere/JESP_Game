// Move a delivery into an independent review rather than endlessly re-testing it.
// This is a checkpoint request, not a correctness verdict.
export function synthesisReady(space,gates){
 if(!space.backend||!space.advanced||space.taskKind!=='build'||!space.strategy||!space.expectedNames.size||gates.length)return false;
 if([...space.expectedNames].some(n=>!space.files.has(n)))return false;
 if((space.pendingIssues||[]).some(x=>/^(?:TEST:|FORMAT:|STRATEGI:)/.test(x)))return false;
 const review=space.reviews.at(-1);
 if(review?.verdict==='revise')return space.audit.some(e=>e.ok&&e.data?.passed!==false&&e.time>review.time&&['write_file','edit_file','append_file','test_js','calculate','verify_quote'].includes(e.tool));
 return true;
}
export const SYNTHESIS_INSTRUCTION='GRANSKNINGSPUNKT: Beställda filer finns och grundkontrollerna är utförda. Upprepa inte oförändrade tester eller filläsningar. Skriv nu ett kort, konkret kandidatsvar med finish, med de faktiskt beräknade resultaten och tydliga begränsningar. Svara på användarens språk. Använd inte nya obestyrkta siffror eller sakpåståenden. Detta är INTE ett godkännande: en separat kritiker prövar svaret och leveransen och kan begära fler tester och rättningar.';
