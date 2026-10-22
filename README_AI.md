# JESP AI v5 – verktygsanvändande agenter utan konto

Öppna https://capstere.github.io/JESP_Game/, skriv ett uppdrag och klicka **Starta agenten gratis**. V4-chatten är bevarad på `chat.html`; dess fungerande `ai.js` är oförändrad.

## Vad agenten faktiskt gör

Den valda modellen kan planera, välja verktyg, läsa verkliga verktygsresultat och välja nästa steg. Verktyg körs i en begränsad loop, inte som dekorativa animationer. En separat granskningsroll får sedan uppdraget, utkastet, filerna och verktygsbevisen. Roller använder samma valda modell – detta är inte flera oberoende expertmodeller.

Verktygen är webbsökning, läsning av kända publika källor, räknare utan eval, textbaserad filarbetsyta, filinspektion och opt-in JavaScript-tester. Resultat, källor och filversioner visas i loggen. Arbetsytan kan sparas som ZIP med filer, uppdrag och verktygslogg.

Agenten kan inte skicka mejl, logga in på andra webbplatser, skriva till GitHub, köpa tjänster eller styra din dator. Skapad HTML/kod visas som inert text, inte körbart innehåll.

## Anslutningar och gratisbegränsningar

**Pollinations** är standard: den fungerande anonyma vägen `https://text.pollinations.ai/openai`, alias `openai`. Det verkliga modellnamnet i svaret visas; ingen fast större modell utlovas. Ingen Authorization-header, cookie eller API-nyckel skickas. Minst 31 sekunders mellanrum används efter varje svar, plus leverantörens Retry-After vid kvotfel. Högst ett automatiskt återförsök för trafikgräns görs. En agent gör flera anrop och tar därför längre tid än ett chattmeddelande. Samtliga väntelägen kan avbrytas. Ingen betalreserv finns.

**Sökning:** Parallel MCP, Exa MCP, sedan Wikipedia som uttryckligen begränsad reserv. Publika sök-/läsverktyg används; inga betalda forskningsagentfunktioner används. Källadresser måste vara publika HTTPS-adresser. Sidläsning begränsas till URL:er som användaren gav eller som verktygen faktiskt returnerade. Det går inte att läsa godtyckliga interna/lokala adresser.

**Kilo** är inte aktiverat som standard: kataloghämtning misslyckades i det verkliga webbläsarförtestet från GitHub Pages. Knappen Kontrollera Kilo gratis testar åtkomsten i din webbläsare. Endast katalogmodeller märkta `:free` eller `kilo-auto/free` med verifierat nollpris tillåts. Katalogen kontrolleras inför varje anrop. Detta är ett klientfilter, inte ett löfte om leverantörens framtida priser eller tillgänglighet. Inga betalda eller okända modeller väljs.

**Lokal Qwen3 1.7B:** separat experimentellt alternativ via WebLLM 0.2.85 och WebGPU. Nedladdningen kräver aktivt godkännande; räkna med ungefär 1–2 GB och flera GB ledigt minne. Enheten kan sakna stöd, och denna mindre modell kan ha svårt att följa agentprotokollet. Lokal generering har inte verifierats på användarens hårdvara. Stäng av webbverktyg för att inte skicka sökfrågor externt. Den tidigare lilla CPU-modellen finns kvar i klassisk chatt.

Gratis betyder inte obegränsad tillgång eller garanterad upptid. Vid nekad åtkomst visas felet. Appen öppnar ingen inloggning eller betalning och förutsätter inga krediter.

## Säkerhet och sekretess

Online skickas uppdrag, relevanta verktygsresultat och filinnehåll till den valda AI-leverantören. Sökfrågor och URL:er skickas till sökleverantörerna. Deras behandling, lagring och villkor ligger utanför denna apps kontroll. Skriv inte hemligheter eller känsliga personuppgifter.

Appens arbetsyta finns i flikens minne. Den sparar inte uppdrag i localStorage. En anonym väntetidsstämpel sparas för att respektera AI-kvoten, och en lokalt vald modell kan cachas av körmotorn. Inga analysverktyg eller egna serverloggar används av appen.

Webbinnehåll markeras som opålitliga data, aldrig instruktioner. Verktygsnamn och argument valideras separat. Filer begränsas till 12 filer, 100 kB per fil och 500 kB totalt. Modellbeslut begränsas till 3, 5 eller 8 steg plus valfri granskning. Filnamn får inte innehålla sökvägar.

JavaScript-tester är avstängda tills användaren uttryckligen aktiverar dem. De körs i en separat Worker inuti en opaque-origin sandboxad iframe med CSP som blockerar nätverk, föräldradokument och beständig lagring. Testet avbryts efter fyra sekunder. Importer, npm-paket och DOM är inte tillgängliga. Godkända testassertioner bevisar bara dessa testfall, inte att all genererad kod är säker eller korrekt.

## Tester – skilj på nivåerna

`node --test tests/agent-unit.mjs` kör 42 enhetstester utan verklig AI. Lokala browser-fixtures har även kontrollerat mobilvisning, injektionssäker textvisning, avbrytning och sandboxens nätverks-/lagringsspärrar. Dessa är inte bevis på AI-tjänstens tillgänglighet.

GitHub Actions **JESP agent checks** kör både uttryckligt simulerade regressionstester och ett separat riktigt agentuppdrag. Det riktiga uppdraget söker WebAssembly-dokumentation, läser en källa, räknar `(125*8)-175`, skapar `resultat.json`, kontrollerar JSON-syntax och låter granskningsrollen avsluta. Inga AI- eller söksvar simuleras i livekontrollen. HTTP-status, verkligt modellnamn, anropstider, skapad fil, skärmbilder och ZIP sparas som artefakter. Efter en lyckad Pages-publicering körs livekontrollen mot själva publicerade sidan; på utvecklingsgrenen körs den mot en lokalt serverad kopia.

Aktuell körningsstatus finns under repositoryts Actions-flik. En lyckad publicering bevisar inte i sig att agentuppdraget lyckades. Lokal WebGPU-inferens ingår inte i det automatiska live-testet.

## Lokalt utvecklingsläge

Kör `python3 -m http.server 8123` i repositoryts rot och öppna `http://localhost:8123/`. Ingen byggkedja krävs för appen. För tester används Node och Playwright; se workflowfilen. Appen måste serveras över HTTP/HTTPS, inte öppnas som file://.
