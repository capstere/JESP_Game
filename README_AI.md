# JESP AI 5.1 — granska, rätta, kontrollera

Öppna https://capstere.github.io/JESP_Game/. Ingen Puter, användarinloggning, API-nyckel eller betalreserv har lagts till. Klassisk chatt finns kvar i `chat.html`.

## Vad som ändrats

- Pollinations-anrop var låsta till `reasoning_effort: low` och minst 4096 svarstoken. Nu är **medium / 8192** standard; low / 4096 och high / 16384 är valbara. Systemmeddelandet anger också begärd nivå. Detta är inställningar i anropet, inte nya modellvikter. Leverantören kan begränsa eller ignorera dem. Längre resonemang är inte alltid bättre.
- Normalläget har 12 beslut, inklusive kritiker och rättningar. 6, 18 och 24 är också valbara. HTTP-återförsök räknas som anrop men inte som ytterligare beslut.
- En separat kritiker granskar faktiska filer och underlag. Kritik skickas till arbetsagenten som får använda verktyg och ändra filer. Därefter krävs ny granskning. `reviewed` och `reviewPassed` är skilda statusar.
- Saknade explicit beställda filer blockerar avslut. Filer läses tillbaka automatiskt före slutgranskning och JSON-filer syntaxkontrolleras. Detta är leveranskontroll, inte ett bevis på innehållets riktighet.
- Sökdata parsas innan utdrag begränsas. Navigeringslänkar inuti artiklar räknas inte längre som ytterligare källor. En sökträff är `found`; hämtad tillräcklig löptext är `read`; för lite text är `thin`. Innehållskontrollen är heuristisk, inte en sanningskontroll.
- `verify_quote` jämför citat med faktiskt hämtad text. Match innebär inte att en slutsats följer av citatet. Granskaren instrueras särskilt att skilja mått, enheter, jämförelser och villkor.
- Kontexten byggs om från aktuella filer och källunderlag, utan att klippa mitt i serialiserad JSON. Fullt underlag behålls i arbetsytan och ZIP-exporten.
- **Fortsätt med delresultaten** återanvänder filer, källor, kritik och logg i samma flik. En omladdning raderar fortfarande minnesarbetsytan; detta är inte beständig lagring eller import av gamla ZIP-filer.
- ZIP innehåller `uppdrag.json`, `korspar.json`, `kallunderlag.json`, `resultat.md` och skapade filer. Modell, antal anrop, begärda inställningar, fel, kritik, versionsnummer och faktisk verktygsaudit följer med. Ingen dold modellresonemangstext exporteras.

## Kostnad, integritet och begränsningar

Pollinations klassiska anonyma anslutning är kvar. Normalt minst 31 sekunder mellan anrop; tjänstens `Retry-After` respekteras. Ingen IP-rotation, inloggningsgenväg, köpt kredit eller betald fallback används. Vid nekad åtkomst stannar körningen. Gratis tillgång eller obegränsad kvot kan inte garanteras av appen.

Kilo är fortfarande ett valfritt, uttryckligen valt alternativ med gratisfilter; åtkomsten kan misslyckas. Den nya resonemangsinställningen gäller Pollinations, inte ett löfte om funktioner hos Kilo eller den mindre lokala Qwen-modellen. Lokal AI kräver separat samtycke till modellnedladdning.

Online går uppdrag och relevanta verktygsresultat till vald AI-tjänst. Sökfrågor och läsadresser kan skickas till Parallel, Exa och Wikipedia. Lägg inte in hemligheter. Utomstående källtexter är opålitliga. Inga e-postutskick, externa skrivningar, köp eller datorstyrning stöds. JS-exekvering är avstängd tills användaren godkänner den och sandboxen är oförändrad.

Roller är separata anrop till samma modell, inte oberoende experter. Uppgraderingen är ett bättre arbetsflöde och andra begärda inferensinställningar, **inte finjustering eller ett bevis på högre generell modellintelligens**.

## Tester

```sh
node --test tests/agent-unit.mjs tests/reasoning-v51.mjs
```

Regressionssviten är deterministisk och använder simulerade modeller där AI behövs. Den kontrollerar bland annat riktig filändring efter kritik, saknade leveranser, felaktiga käll-ID, citatmatchning, kontextbudget, återupptagning och anonym anropskonfiguration.

`tests/reasoning-live-v51.mjs` är ett separat riktigt Chromium-test mot den anonyma tjänsten. Det skapar tre filer, kontrollerar procentberäkningar och kräver godkänd slutgranskning. Det sparar den faktiska körningen som GitHub Actions-artifact. Ett grönt simulerat test ska aldrig beskrivas som bevis för att detta live-test lyckats.
