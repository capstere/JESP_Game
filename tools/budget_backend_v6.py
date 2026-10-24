from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'agents/backend.mjs';s=p.read_text()
if 'roleBudget' in s:raise SystemExit(0)
s=s.replace("export const DEFAULT_CRITIC=", "export function roleBudget(ai){const auto=ai.reasoning==='auto'||!ai.reasoning;const reflective=['architect','critic','repair'].includes(ai.role);return {effort:auto?(reflective?'medium':'low'):ai.reasoning,maxTokens:auto?(ai.role==='architect'?3072:reflective?8192:6144):12288};}\nexport const DEFAULT_CRITIC=",1)
s=s.replace("const effort=ai.reasoning==='auto'?(ai.effectiveReasoning||'medium'):ai.reasoning||'medium';","let {effort,maxTokens:budget}=roleBudget(ai);if(ai.effectiveReasoning==='low'&&ai.reasoning==='auto')effort='low';")
s=s.replace("max_tokens:maxTokens<=64?1024:12288","max_tokens:maxTokens<=64?1024:budget")
s=s.replace("   ai.onStatus('Backend HTTP '","   if(e.status===504&&ai.reasoning==='auto'){effort='low';budget=Math.min(budget,4096);inputs=[...messages,{role:'user',content:'Återhämtning efter tidsgräns. Gör endast ett kort nästa steg: en liten komplett fil eller exakt versionskontrollerad ändring. Försök inte skriva hela projektet i ett svar. Inga verktyg kördes från det förra anropet.'}];}\n   ai.onStatus('Backend HTTP '")
p.write_text(s)
p=r/'tests/backend-v6.mjs';s=p.read_text().replace("assert.equal(sent.body.max_tokens,12288)","assert.equal(sent.body.max_tokens,role==='architect'?3072:['critic','repair'].includes(role)?8192:6144)");p.write_text(s)
p=r/'index.html';s=p.read_text().replace('Backend begär upp till 12 288 svarstoken och kan hantera mer underlag.','Auto fördelar budgeten: uppdragsanalys 3 072 token, verktygsarbete 6 144 och granskning/felsökning 8 192. Manuellt medium/high kan begära 12 288.').replace('Auto anpassar efter avklippning.','Auto använder medium för analys/granskning och low för konkreta verktygssteg, samt anpassar efter avklippning och tidsgränser.');p.write_text(s)
