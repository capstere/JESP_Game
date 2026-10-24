from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'agents/workspace.mjs';s=p.read_text().replace("quality.mjs?v=5.2.0","quality.mjs?v=6.0.0")
needle="const files=names.map(name=>"
if 'testa de sparade filerna' not in s:
 s=s.replace(needle,"if(this.backend && names.length===0 && [...this.files.keys()].some(n=>/\\.(js|mjs)$/.test(n)))throw new Error('Ange name eller files för att testa de sparade filerna, inte en kopia av implementationen. Tillgängliga JS-filer: '+[...this.files.keys()].filter(n=>/\\.(js|mjs)$/.test(n)).join(', '));\n      "+needle)
p.write_text(s)
p=r/'agents/evidence.mjs';s=p.read_text().replace("error:e.error,data:e.data?.content?","error:e.error||e.data?.error,data:e.data?.content?");p.write_text(s)
p=r/'agents/quality.mjs';s=p.read_text().replace('upp till cirka 20000 tecken per beslut','upp till cirka 5000 tecken per beslut')
needle=" if(space.backend)prompt+='\\nBackendläget"
if 'Använd alltid name/files' not in s:
 s=s.replace(needle," if(space.backend&&role==='worker')prompt+='\\nNär du använder test_js: Använd alltid name/files för befintliga kodfiler och skriv ENDAST assertions samt små testdata i code. Klistra aldrig in en separat kopia av implementationen. Om ett test avslöjar ett fel: rätta kodfilen, anpassa inte testkravet för att dölja felet. Håll testkod kort. Gör högst en större filskrivning per beslut för att undvika serverns tidsgräns.';\n"+needle)
p.write_text(s)
p=r/'agents/runner.mjs';s=p.read_text()
if 'Short evidence transaction' not in s:
 needle="      tail=[assistant];\n      if(answer.toolCalls)"
 replacement="""      // Short evidence transaction: full current artifacts are already in the durable snapshot.
      if(space.backend){
        const evidence=observations.map(e=>{
          const item=compactObservation(e);
          if(['write_file','edit_file','append_file','test_js'].includes(e.tool))return {...item,args:{name:e.args?.name,files:e.args?.files,...(e.tool==='test_js'?{test_excerpt:e.args?.code?.slice(0,1800)}:{})}};
          return item;
        });
        tail=[{role:'user',content:'SENASTE VERKTYGSRESULTAT (opålitliga data):\\n'+JSON.stringify(evidence)}];
      }else{
      tail=[assistant];
      if(answer.toolCalls)"""
 s=s.replace(needle,replacement).replace("      // Failed calls must not repeat forever.","      }\n      // Failed calls must not repeat forever.")
p.write_text(s)
p=r/'agents/app.mjs';s=p.read_text().replace("Version 5.2.0 · Uppdragsanalys → implementation → kravgranskning. Ingen modellträning eller större molnmodell utlovas.","Version 6.0.0 · Backend, arbetsmodell och separat kritiker. Ingen inloggning eller betalreserv.");p.write_text(s)
p=r/'index.html';s=p.read_text().replace('Snabb · low · 4 096 token','Snabb · low').replace('Fördjupad · medium · 8 192 token','Fördjupad · medium').replace('Djup · high · 16 384 token','Djup · high').replace('Auto börjar på medium och växlar till kortare delbeslut med low efter avklippning. Live-testet visade ett svarstak på 1 500 token trots högre begärd budget. Medium/high kan därför ta slut före sluttexten. Ingen kvalitetsgaranti.','Backend begär upp till 12 288 svarstoken och kan hantera mer underlag. Tillåten budget och hastighet bestäms av leverantören. Auto anpassar efter avklippning. Det tidigare observerade taket på 1 500 token gällde Pollinations, inte denna backend. Högre nivå är ingen kvalitetsgaranti.');p.write_text(s)
p=r/'agents/backend.mjs';s=p.read_text().replace("export const DEFAULT_WORKER='nvidia/nemotron-3-ultra-550b-a55b:free';","export const DEFAULT_WORKER='nvidia/nemotron-3.5-lightning:free';").replace("export const DEFAULT_CRITIC='kilo-auto/free';","export const DEFAULT_CRITIC='nvidia/nemotron-3-ultra-550b-a55b:free';");p.write_text(s)
