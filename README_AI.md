# JESP AI – Super CODEX, låst gratisläge

Öppna https://capstere.github.io/JESP_Game/, skriv din fråga och klicka på **Fråga AI gratis**. Första gången behöver du slutföra Puters inloggning i popup-fönstret. Inga egna API-nycklar eller lokala installationer behövs för den publicerade sidan.

## Vad gratisläget betyder

Appen anropar endast modeller som har **både** modell-ID med `:free` och katalogpris 0 för text in/ut i Puters aktuella modellkatalog. Modellens leverantör låses också i anropet. Betalda eller okända alternativ, motsägelsefulla prisuppgifter och saknad prissättning blockeras. Det finns inget reglage för att slå på betalmodeller och ingen betald reservmodell.

Kostnadskontrollen gäller vanliga svar, testanrop, reservmodeller och sammanställningen. Katalogen läses inför varje anrop, men Puters SDK kan mellanlagra den i 60 sekunder. Detta är ett klientbaserat urvalsfilter, **inte en ekonomisk garanti från Puter** eller en serverstyrd budgetspärr. Tjänstens faktiska priser, avgifter, krediter, villkor och tillgänglighet ligger utanför denna apps kontroll. Okända priser gör att appen stannar.

Gratisvarianter kan ha kvoter, driftstörningar och tas bort. Om Puter nekar åtkomst av saldo-, konto- eller kvotskäl stannar körningen; appen köper inget och byter inte till betalmodeller. Puters SDK kan ändå visa en uppgraderingsdialog. **Stäng den – köp inte krediter för att felsöka den här appen.**

## Funktioner

- Enkel startknapp som öppnar inloggning från användarens klick vid behov.
- Ett svar som standard; jämförelse av två eller tre svar med domare är valbar.
- Högst två extra gratisalternativ vid modellfel; inga nya anrop vid konto- eller kvotfel.
- Timeout, avbrytning, bevarade delsvar samt hantering av tomma/avklippta svar.
- AI-text renderas med `textContent`, aldrig som aktiv HTML. Ingen AI-genererad kod körs.
- Kopiering och textnedladdning. Ingen app-lagring av frågor eller API-hemligheter.
- Ingen webbsökning eller automatiserad agentfunktion: detta är en text-AI-app.

Puter hanterar inloggningssessionen. Frågor skickas till Puter och berörd modellleverantör. Skicka inte hemligheter, personuppgifter eller konfidentiellt material.

## Verifiering

18 lokala Chromium-tester passerade den 22 oktober 2026. Testerna använder ett **simulerat SDK** och en offline-HTML-fixtur där endast origin- och SDK-transporten ersätts. De kontrollerar app-logik och gränssnitt, inte åtkomst till Puter i verklig drift. Det finns ingen simulerad AI i produktionsfilen.

**Inget autentiserat AI-anrop mot Puter har verifierats från denna utvecklingsmiljö.** Inloggning och en riktig fråga behöver lyckas i besökarens webbläsare. Ett grönt GitHub Pages-bygge bevisar bara publicering, inte AI-tjänstens åtkomst.

Testsviten följer med leveranspaketet under `tests/test_browser.py`. För utvecklare:

```sh
python -m pip install playwright
playwright install chromium
python tests/test_browser.py
```

`CHROMIUM_PATH` kan ange en egen Chromium-binär. `TEST_GROUP=1`, `2` eller `3` delar upp testkörningen. Testerna behöver ingen API-nyckel och gör inga riktiga AI-anrop.

## Publicering och underhåll

Startsidan är en fristående `index.html`. Övriga mappar i repot lämnas oförändrade. GitHub Pages befintliga publicering från `main` används. Inga hemligheter, egna backendservrar eller nya betaltjänster läggs till. Puter.js hämtas från dess officiella CDN; externa SDK-uppdateringar kan påverka funktionen.

## Officiella referenser, kontrollerade 2026-10-22

- Modellkatalog, prisformat, :free och cache: https://docs.puter.com/AI/listModels/
- Chattanrop, leverantörsval, AbortSignal: https://docs.puter.com/AI/chat/
- Inloggning, popup och webbplats-origin: https://docs.puter.com/Auth/signIn/
- Kredit- och kvotfel samt uppgraderingsdialog: https://docs.puter.com/rate-limits-and-quotas/
- Användarkontots ansvar för användning: https://docs.puter.com/user-pays-model/
