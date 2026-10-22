# JESP AI v4 — utan Puter eller inloggning

Öppna https://capstere.github.io/JESP_Game/, skriv din fråga och klicka på **Fråga AI gratis**. Ingen egen server, API-nyckel eller inloggning används.

## Online-läge är förvalt

Appen använder Pollinations publika text-API. Ett anonymt anrop skickas per klick efter eventuell väntetid, med `credentials: omit`. Inga tokens läggs in i källkoden. Ingen betalreserv, CORS-proxy, kontoregistrering eller kvotkringgång används. Vid trafikgränser eller åtkomstfel visas felet; inget köps och ingen lokal modell laddas ner automatiskt.

Vid live-testet svarade tjänsten att gratisgränsen är ett svar per 30 sekunder och IP-adress. Appen väntar före följande frågor, hanterar även HTTP 402 med `FREE_LIMIT`, respekterar `Retry-After` och erbjuder ingen betalväg. Delade nätverk kan dela samma IP-gräns.

Detta är gratis åtkomst som tjänsten erbjuder vid testtillfället, inte en garanti om obegränsad eller framtida tillgång. Frågor skickas till Pollinations; skicka inte känsligt innehåll. Varje fråga är fristående. Appen använder inga analysverktyg och sparar inte frågor/svar. Ingen webbsökning eller automatisk körning av genererad kod ingår.

## Frivilligt lokalt läge

Välj lokalt läge i inställningarna och klicka för att hämta modellen. Qwen2.5-0.5B-Instruct Q4_K_M hämtas från Hugging Face (cirka 400 MB) och körs på enheten via `@wllama/wllama@3.8.1`, låst till en testad publicerad version. Körmotorn hämtas från jsDelivr. CPU-körning använder en tråd och kräver inte WebGPU eller särskilda COOP/COEP-rubriker från GitHub Pages.

Frågetexten skickas inte till någon AI-server i lokalt läge. Modellen är liten, kan vara långsam och har lägre kapacitet än stora molnmodeller. Tillräckligt minne, modern WebAssembly och lokal webbläsarlagring krävs. Nedladdning, datatrafik och batteriförbrukning tillkommer; ingen avgift per AI-anrop. Modellen mellanlagras av webbläsaren; knappen Radera hämtad modell raderar modellcachen.

## Verifiering — verkliga svar skiljs från simulerade tester

Det första diagnostiska testet på GitHub Actions lyckades med ett riktigt anonymt Pollinations-svar och faktisk lokal modellinferens i Chromium: https://github.com/capstere/JESP_Game/actions/runs/39833414852 . Det testet verifierade byggstenarna, inte hela v4-gränssnittet.

Ett riktigt anonymt POST-anrop från appen i Chromium returnerade också `12`: https://github.com/capstere/JESP_Game/actions/runs/39834830863 . Den körningen som helhet misslyckades på nästa fråga på grund av tjänstens 30-sekundersgräns. Därefter lades en avbrytbar väntetid och hantering av `FREE_LIMIT` till. Resultatet från en enskild lyckad fråga ska inte förväxlas med ett helt godkänt testflöde.

`tests/live-browser.mjs` testar den faktiska appen i Chromium och WebKit. AI-anrop mockas aldrig där. Innan publicering iscensätts endast repoets HTML/JS under sidans origin. Efter lyckad Pages-publicering kör arbetsflödet samma online-test mot den riktiga hemsidan utan denna fil-iscensättning. Det kontrollerar en testfråga, en slumpad additionsfråga, avsaknad av autentisering, mobilbredd och, i förpubliceringstestet, verklig lokal modellgenerering.

`tests/ui-tests.py` testar felkoder, avbrytning, säker textrendering, väntetid och mobilvy med simulerade svar. Nio sådana lokala tester passerade, men de är inte bevis på tjänstens drifttid. Resultat från riktiga körningar och skärmbilder finns i arbetsflödets logg och artefakter. Ett grönt test är en observation vid testtillfället, inte en drifttidsgaranti.

## Filer

- `index.html`: användargränssnitt.
- `ai.js`: anonymt online-anrop, frivillig lokal AI, avbrytning och felhantering.
- `.github/workflows/ai-live-test.yml`: verklig webbläsarverifiering.
- `tests/`: reproducerbara testskript.

Övriga befintliga kataloger i repot bevaras. Tidigare Puter-integration och dess modellprisfilter används inte av v4.
