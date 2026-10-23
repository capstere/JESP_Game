# JESP AI 6.0.1 — anonym backend och granskade leveranser

Öppna https://capstere.github.io/JESP_Game/. Besökaren behöver inget konto, ingen API-nyckel och ingen betalning. Backend finns i ägarens befintliga Supabase-projekt på Free-planen. Detta är inte kontofri serverdrift: ägaren har redan GitHub- och Supabase-konton.

## Motor och arbetsflöde

Standard är Kilos dokumenterade anonyma gratisåtkomst via `jesp-gateway`, inte Puter och inte det gamla begränsade Pollinations-anropet. Arbetsmodell: `nvidia/nemotron-3.5-lightning:free`. Separat kritiker och felsökningsmodell: `nvidia/nemotron-3-ultra-550b-a55b:free`. De aktiveras bara om de finns i den aktuella nollpriskatalogen. Modell-ID:n är leverantörens identiteter; modellen har inte tränats om här och storlek är inte ett eget kvalitetstest.

Agenten jämför två lösningar, formulerar ett uppdragskontrakt, använder verkliga verktyg och granskar varje krav mot aktuella filer och testresultat. Fel skickas tillbaka för riktig rättning. Byggläge kräver kod, inte en plan. Planläge levererar beslut och avgränsningar, inte oombedd implementation.

Auto begär 3 072 token för uppdragsanalys, 6 144 för arbetssteg och 8 192 för kritik/felsökning. Servern accepterar högst 16 384 svarstoken och 160 000 indatatecken; dessa är begärda gränser, inte utlovad tillgänglig kapacitet. Leverantörens egna kontext-, kvot- och tidsgränser gäller. Pollinations och lokalt läge finns kvar som uttryckliga manuella alternativ, inte en dold fallback.

## Rättningen i 6.0.1

Ett tidigare liveprov skapade korrekt optimeringskod men skrev ett felaktigt jämförelsevärde i slutsvaret. Nu bevaras beräknings- och testloggar även efter slutlig filåterläsning. Granskaren måste kontrollera slutsvaret separat (`answer_check`) och kontrollera exakt det befintliga utkastet. Ett generiskt godkännande av kodfilerna räcker inte. Bara det granskade arbetarutkastet visas vid godkänt avslut. Kritikern får inte införa en ny omskrivning med nya, okontrollerade uppgifter. Felaktiga eller föråldrade evidensreferenser blockerar godkännande. Detta förbättrar kontrollen men är inte en matematisk verifiering av godtycklig AI-prosa.

## Verktyg och behörigheter

Sökning/sidläsning, räknare, citatmatchning, textfiler, versionskontrollerad redigering och statisk projektkontroll. JS-tester är avstängda tills användaren godkänner dem. De körs i en isolerad worker/iframe utan nätverk och DOM med tidsgräns. Testverktyget använder faktisk filversion, räknar assertions och bevarar fel. Varken agenten eller gatewayen kan ändra GitHub, skicka e-post, köpa tjänster eller styra din dator.

Upp till 24 beslut per körning; Fortsätt behåller uppdraget i samma flik. ZIP innehåller uppdrag, kontrakt, aktuella filer, källunderlag, fel, modeller, anropsstatistik och granskningar. Omladdning tömmer minnesarbetsytan. Genererad kod visas som text och ska granskas före användning.

## Gratisgräns och integritet

Servern tillåter bara katalogbekräftade gratisvarianter med nollpris. Ingen AI-leverantörsnyckel, betald fallback eller automatisk uppgradering används. Kvoter: 90 anrop/timme per klient, 150/timme för hela projektet, 1 000/dag och 10 000/månad; högst 3 samtidiga AI-anrop. Kvoterna är delade, atomiska och får inte kringgås. Gratisåtkomst kan begränsas eller upphöra. Använd inga hemligheter eller personuppgifter: uppdrag och verktygsunderlag går via Supabase till Kilo och vald modellleverantör. Backenddatabasen lagrar kvoträknare och tillfälliga HMAC-baserade klientidentifierare, inte prompts eller råa IP-adresser.

## Verifiering — läs utfallen, inte testfilens namn

Regressionssviten testar programlogik och använder simulerad AI där det behövs. Liveproven använder riktiga anonyma modell- och backendanrop, utan simulerad inferens. Förhandsprovet levererar kandidatens statiska appfiler i en webbläsare på GitHub Pages-origin; publiceringsprovet använder den publicerade sidan utan filersättning.

`tests/agent-optimization-v6.mjs`: agenten skriver en generell optimerare. Testaren kör 28 separata kontroller som inte är modellens egna assertions, inklusive 20 ytterligare indatafall. Kontrollen omfattar nu även det kvotgiriga jämförelseresultatet och slutsvarets numeriska jämförelse.

`tests/backend-hardened-live-v6.mjs`: agenten bygger en minimal FPS-prototyp. Separat browser verifierar rörelse, rotation, skott/poäng, återställning och icke-tom canvas. Modellgenererad kod körs aldrig med GitHub-token eller som ett Node-program på runnern; externa nätverksanrop blockeras i testbrowsern.

Aktuella utfall finns i GitHub Actions-artefakterna och `AI_TEST_RESULTS.json`. Ett grönt regressionstest är inte ett godkänt liveprov. Ett godkänt optimerings- eller spelprov bevisar den testade uppgiften, inte obegränsad kapacitet eller generell felfri intelligens.

## Observerade rättningar före merge

Det första skärpta provet räknade korrekt men använde {optimal, baseline} i JSON medan testaren antog en platt rot. Testaren accepterar nu båda entydiga representationerna men kräver samma numeriska resultat och samma 28 separata kodkontroller. Spelprovet missade träffbarhet från start och fastnade i dubbelt JSON-kodade filnamnslistor. Endast en strikt JSON-array av filnamn kan nu normaliseras; detta loggas och ändrar inte behörighet, filnamnskontroll eller sandbox. Krav på startläge och kombinerade kantfall ska bevaras i kriterier och faktiska tester. Ett nytt liveprov krävs efter dessa ändringar.
