# JESP AI v4 — utan Puter eller inloggning

Öppna https://capstere.github.io/JESP_Game/?v=4.0, skriv din fråga och klicka på **Fråga AI gratis**. Ingen egen server, API-nyckel eller inloggning används.

## Verifierat på den publicerade hemsidan

Den 22 oktober 2026 kl. 19:05 UTC klarade det publicerade online-läget ett verkligt Chromium-test. Varken AI-svar, HTML eller JavaScript ersattes av testdata.

- Testknappen: `7 + 5` gav `12`.
- En vanlig fråga i frågefältet: `31 + 24` gav `55`.
- Båda API-anropen gav HTTP 200 utan autentisering, cookies eller API-nycklar.
- Den automatiska väntetiden mellan anrop respekterade tjänstens gratisintervall.
- Mobilbredd 390 px hade ingen horisontell överströmning.

**Godkänd körning:** https://github.com/capstere/JESP_Game/actions/runs/39836828551

Råresultatet finns i `tests/published-evidence.json`. En skärmbild och resultatfil finns också som artefakt i körningen. Detta bevisar fungerande online-anrop vid testtillfället, inte framtida drifttid, obegränsad tillgång eller korrekthet i alla AI-svar.

## Online-läge är förvalt

Appen använder Pollinations publika text-API. Ett anonymt anrop skickas per klick efter eventuell väntetid, med `credentials: omit`. Inga tokens läggs in i källkoden. Ingen betalreserv, CORS-proxy, kontoregistrering eller kvotkringgång används. Vid trafikgränser eller åtkomstfel visas felet; inget köps och ingen lokal modell laddas ner automatiskt.

Vid live-testet angav tjänsten gratisgränsen **ett svar per 30 sekunder och IP-adress**. Appen väntar före följande frågor, hanterar HTTP 402 med `FREE_LIMIT`, respekterar `Retry-After` och erbjuder ingen betalväg. Delade nätverk kan dela samma IP-gräns. Tjänsten kan ändra villkor eller bli otillgänglig.

Frågor skickas till Pollinations; skicka inte känsligt innehåll. Varje fråga är fristående. Appen använder inga analysverktyg och sparar inte frågor/svar. Ingen webbsökning eller automatisk körning av genererad kod ingår.

## Frivilligt lokalt läge

Välj lokalt läge i inställningarna och klicka för att hämta modellen. Qwen2.5-0.5B-Instruct Q4_K_M hämtas från Hugging Face (cirka 400 MB) och körs på enheten via `@wllama/wllama@3.8.1`. Körmotorn hämtas från jsDelivr. CPU-körning använder en tråd och kräver inte WebGPU eller särskilda COOP/COEP-rubriker från GitHub Pages.

Frågetexten skickas inte till någon AI-server i lokalt läge. Modellen är liten, kan vara långsam och har lägre kapacitet än stora molnmodeller. Tillräckligt minne, modern WebAssembly och lokal webbläsarlagring krävs. Nedladdning, datatrafik och batteriförbrukning tillkommer; ingen avgift per AI-anrop. Modellen mellanlagras av webbläsaren; knappen Radera hämtad modell raderar modellcachen.

Den lokala modellens byggstenar har gett ett verkligt svar `12` i Chromium i körning https://github.com/capstere/JESP_Game/actions/runs/39833414852 . Detta är separat från verifieringen av hela det publicerade online-flödet; det är inte ett fullständigt kompatibilitetstest av den lokala funktionen på alla enheter.

## Tester

- `tests/live-online-check.mjs`: publicerad hemsida, verkliga anonyma API-svar, två frågor, tidsintervall, autentiseringsfrihet och mobilbredd. Arbetsflödet **Published anonymous AI check** körs efter lyckad Pages-publicering och kan även startas manuellt.
- `tests/live-browser.mjs`: utökat, manuellt startbart test i Chromium och WebKit, inklusive den lokala modellen vid förpubliceringstest. AI-anrop mockas inte. Testmiljön kräver större webbläsarberoenden.
- `tests/ui-tests.py`: nio passerade lokala fel- och UI-tester med simulerade svar. De testar bland annat felkoder, avbrytning, HTML-säker textvisning och väntetid; de är inte bevis på en AI-tjänsts drifttid.

`AI_TEST_RESULTS.json` skiljer på dessa testnivåer. Den tidigare Puter-integrationen och dess modellprisfilter används inte. Befintliga kataloger med övriga tillgångar har bevarats.
