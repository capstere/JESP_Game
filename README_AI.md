# JESP AI v5 – gratis agentläge utan konto

Öppna https://capstere.github.io/JESP_Game/, beskriv ett uppdrag och klicka **Starta agenten gratis**. Den fungerande v4-chatten finns kvar på `chat.html`; dess `ai.js` är oförändrad.

För ett större uppdrag med sökning, sidläsning, fil och kontroll: välj **8 beslut** under inställningar. Börja med knappen **Räkna och skapa en fil** för ett litet uppdrag. Kodtester är avstängda tills du godkänner dem.

## Funktioner

Agenten väljer verktyg, läser verkliga resultat och väljer nästa steg. Inbyggda modellverktygsanrop och textbaserade JSON-beslut stöds. Verktygen är sökning, läsning av publika källor, räknare utan eval, filskapande, filinspektion och valfria isolerade JavaScript-tester. En separat granskningsroll får uppdraget, utkastet, filerna och verktygsbevisen. Roller använder samma valda modell – inte flera oberoende expertmodeller.

Verktygsresultat, källor och filversioner syns i arbetsytan. Filer visas som inert text. Spara uppdraget som ZIP för att behålla filer, svar, källor och logg. Avbrytning behåller redan mottagna delresultat. Arbetsytan ligger i minnet och försvinner när fliken lämnas.

## Gratisvägar och begränsningar

**Pollinations är standard.** Den tidigare fungerande anonyma anslutningen `https://text.pollinations.ai/openai` används med alias `openai`. Verkligt modellnamn visas. Ingen API-nyckel, Authorization-header eller cookie skickas. Minst 31 sekunder mellan anrop används; Retry-After respekteras vid kvotfel, med högst ett automatiskt återförsök. En agent behöver flera anrop. Uppdrag begränsas till 3, 5 eller 8 beslut plus valfri granskning. Betalreserv finns inte.

**Webbverktyg:** Parallel MCP, Exa MCP och Wikipedia som uttryckligen begränsad reserv. Endast deras publika sök-/läsverktyg används, inte betalda forskningsagenter. Sidläsning kräver en publik HTTPS-adress som användaren gav eller som sökningen faktiskt hittade. Interna/lokala adresser och URL:er med inloggningsuppgifter avvisas.

**Kilo är ett avstängt alternativ tills åtkomsten kontrollerats.** Den publika modellkatalogen kunde inte hämtas i förtestet från GitHub Pages. Kontrollknappen testar åtkomsten i din webbläsare. Endast `:free` eller `kilo-auto/free` med verifierat nollpris får väljas. Katalogen kontrolleras inför varje anrop. Detta är ett klientfilter, inte en ekonomisk garanti från leverantören.

**Lokal Qwen3 1.7B är experimentell.** WebLLM 0.2.85 och WebGPU används. Modellnedladdning kräver uttryckligt godkännande: ungefär 1–2 GB och flera GB ledigt minne. Enheten kan sakna stöd, och denna mindre modell kan ha svårt med agentprotokollet. Lokal inferens ingår inte i live-testet och är inte verifierad på användarens hårdvara. Stäng av webbverktygen för att även hålla sökfrågor på enheten. Den lilla CPU-modellen finns kvar i klassisk chatt.

Gratis är inte samma sak som obegränsad tillgång eller garanterad upptid. Appen köper inget, öppnar ingen inloggning och väljer ingen betalmodell vid fel.

## Säkerhet och sekretess

Online skickas uppdrag, relevanta verktygsresultat och filinnehåll till vald AI-leverantör. Sökfrågor och källadresser skickas till sökleverantörerna. Deras behandling, lagring och villkor ligger utanför appens kontroll. Skriv inte hemligheter eller känsliga personuppgifter.

Appen sparar inte uppdrag i localStorage; endast en anonym väntetidsstämpel används för kvoten. En vald lokal modell kan cachas av körmotorn. Webbinnehåll behandlas som opålitliga data, aldrig som instruktioner. Verktyg och argument valideras separat. Filer begränsas till 12 stycken, 100 kB per fil och 500 kB totalt; sökvägar i filnamn tillåts inte.

JavaScript-tester är avstängda tills användaren aktivt godkänner dem. Koden körs i en Worker i en opaque-origin sandboxad iframe med CSP som blockerar nätverk, föräldradokument och beständig lagring. Testet stoppas efter fyra sekunder. DOM, importer och npm-paket saknas. Ett godkänt test bevisar bara de körda testfallen, inte kodens allmänna korrekthet eller säkerhet.

Agenten kan inte skicka e-post, styra din dator, logga in på webbplatser, göra inköp eller skriva till GitHub. Filer ändras bara i den tillfälliga arbetsytan.

## Verifiering

`node --test tests/agent-unit.mjs` kör **48 enhetstester** utan verkliga tjänsteanrop. Offline-webbläsartester har dessutom kontrollerat mobilvisning, injektionssäker textvisning, avbrytning och sandboxens spärrar. Detta bevisar inte molntjänsternas tillgänglighet.

Workflow **JESP agent checks** skiljer uttryckliga simulerade regressionstester från ett riktigt agentuppdrag: söka officiell WebAssembly-dokumentation, läsa en källa, räkna `(125*8)-175`, skapa `resultat.json`, kontrollera JSON-syntax och genomföra separat AI-granskning. Testet använder inställningen åtta beslut. Inga AI- eller söksvar simuleras i live-delen. Modellnamn, HTTP-status, anropstider, fil, skärmbilder och ZIP sparas som artefakter.

På utvecklingsgrenen körs browser-testet mot en lokalt serverad kopia. Efter lyckad Pages-publicering körs det mot den publicerade sidan. Aktuell status och bevis finns i repositoryts Actions-flik. En lyckad publicering ensam bevisar inte ett fungerande agentuppdrag.

## Lokal utveckling

Kör `python3 -m http.server 8123` i repositoryts rot och öppna `http://localhost:8123/`. Appen kräver HTTP/HTTPS, inte file://. Ingen byggkedja krävs. Tester använder Node och Playwright enligt workflowfilen.
