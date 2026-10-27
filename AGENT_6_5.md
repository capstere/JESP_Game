# JESP AI 6.5 — specialiststöd och återstartbara uppdrag

## Vad målet betyder

Den här uppgraderingen förstärker agentens arbetsmiljö. Den tränar inte nya modellvikter, ger inte obehörig åtkomst till GPT Luna/Sol och hävdar inte likvärdig generell prestanda. JESP använder fortfarande användarens val av katalogkontrollerade gratismodeller via befintlig backend; inga nya konton, API-nycklar, betalvägar eller kvotförändringar införs.

## Nya funktioner

**Läsande felsökningsspecialist.** Om samma blockerande fel finns kvar vid två reparationsbeslut får en separat, avgränsad modellkontext granska uppdraget, aktuella filutdrag och testfel. Högst två konsultationer per körning. Den använder den redan valda granskningsmodellen. Befintliga transportåterförsök kan ge fler HTTP-försök; kvoter gäller som tidigare. Rådet måste hänvisa till befintliga filer/loggar, sparas separat och kan aldrig ändra filer, testfacit, behörigheter eller ett godkännandebeslut. Ändrade filversioner gör det gamla rådet inaktuellt. Råd är förslag, inte fakta eller bevis.

**Sökning i arbetsfiler.** Verktyget `search_files` söker en bokstavlig text i befintliga filer och ger radnummer, version och utdrag. Högst 30 matchningar visas; totalantal och eventuell avkortning anges. Ingen regex, nätverkstrafik eller kodkörning. Ett begränsat reparationsläge får inte extra verktyg som dess styrning förbjuder.

**Återstart från disk.** Spara `JESP_aterstart.json` och öppna den senare med knappen Öppna återstartfil. Den sparar uppdrag och källfiler i klartext. Ingen automatisk serverlagring. Tidigare godkännanden, testresultat, modeller och behörigheter importeras inte som betrodda. Kodkörning och webbsökning är av efter import och måste uttryckligen väljas igen. Ny planering och verifiering görs vid Fortsätt. Den vanliga ZIP-exporten innehåller också `aterstart.json`.

## Varför detta i stället för en obegränsad agentflotta?

Specialister får egen kort kontext, men extra modellkörningar ökar latens och kvotförbrukning. Därför används de vid upprepade problem, inte för varje fråga. Arbetsfiler, källor och råd är fortfarande opålitliga data. Slutgranskaren och körda tester bestämmer vad som får godkännas, inte specialistens säkerhet i formuleringarna.

Utvecklingsunderlag:
- https://www.anthropic.com/research/effective-harnesses-for-long-running-agents — inkrementellt arbete, återupptagning och verkliga tester.
- https://www.anthropic.com/research/multi-agent-research-system — avgränsade underagenter och avvägningen mot tokenförbrukning; resultaten gäller deras system, inte JESP.
- https://openai.com/index/introducing-gpt-6-1-sol/ — officiell modell- och prisinformation. Ingen åtkomst till Sol införs av denna ändring.

## Kontrollera bevis, inte versionsnumret

`tests/agent-boost-v65.mjs` testar gränser, oföränderlig arbetsyta under rådgivning, evidensreferenser, kvotfel, sökning och säkra återstarter. Dessa tester använder simulerade modellresponser.

`tests/boost-browser-v65.mjs` testar faktisk Chromium-UI med simulerad modellkatalog i standardläget. `LIVE=1` använder riktiga anonyma modell-anrop: reparerar en felaktig intervallfunktion, granskar resultatet, kör 40 extra fall och en separat kontroll av att resultatet inte delar muterbara indata, samt hämtar ett verkligt läsande specialistförslag. Modellkod exekveras enbart i den befintliga webbläsarsandboxen, aldrig med repository-token eller som Node-program på runnern.

Faktiska utfall finns i Actions-artefakterna `v65-ui-evidence` och `v65-real-agent-evidence`. Ett lyckat fall är inte en jämförelse mot Luna/Sol, en generell intelligensmätning eller ett löfte om obegränsad gratis kapacitet. Befintliga begränsningar för webbläsare, filstorlek, nätverk och leverantörskvoter kvarstår.
