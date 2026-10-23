# JESP AI 5.2 — mål, implementation och prövbara krav

Öppna https://capstere.github.io/JESP_Game/. Samma anonyma Pollinations-anslutning är kvar. Ingen Puter, API-nyckel, betald reserv eller ny inloggning. Detta är en förbättring av agentprogrammet, inte nya modellvikter eller ett löfte om högre generell intelligens.

## Nytt arbetssätt

Fördjupad problemlösning är på från början. En separat uppdragsanalys jämför två genomförbara alternativ, väljer en lösning och formulerar 2–5 uppdragsspecifika acceptanskriterier. Analysen sparas som uppdragskontrakt och visas i gränssnittet. Det är korta beslut, inte dold tankekedja.

Arbetsagenten får sedan använda verktyg och skapa en faktisk leverans. Auto-läget skiljer heuristiskt mellan bygguppdrag, plan, research och analys. Typen kan väljas uttryckligen. Bygguppdrag får inte avslutas med enbart en Markdown-plan; en begärd plan ska däremot inte i smyg bli en kodbeställning.

Kritikern måste bedöma varje kriterium, ange pass/fail/unknown, en saklig förklaring och en aktuell referens till filversion, lyckat verktygsresultat eller läst källa. Ett generiskt ”ser bra ut” räcker inte. Kritiken skickas tillbaka för riktiga rättningar. Referensvalidering bevisar att underlaget finns, inte att en AI-tolkning är riktig.

## Nya verktyg och tester

- `edit_file`: exakt unik textersättning med versionskontroll.
- `append_file`: större filer byggs i delar med versionskontroll. Ingen 150-ordsgräns för hela leveransen.
- `read_file`: valfria 1-baserade radintervall. `list_files`: aktuell fillista/versioner.
- `check_project`: statisk kontroll av JSON, vissa HTML-strukturfel och saknade lokala script-/stilmallsfiler. Inte ett funktionstest.
- `test_js`: efter separat godkännande körs vanlig JS i befintlig isolerad worker/iframe, utan nätverk eller DOM. Inbyggd `assert` räknar faktiskt körda assertions. Namngivna filer/filversioner följer med testresultatet. Stale tester godtas inte som aktuell testning. Mätningen är inte en säkerhetsgaranti mot medvetet falsk testkod.

Högst 24 beslut per körning, 18 som standard. Fortsätt-knappen behåller filer och kontrakt i samma flik. Omladdning raderar minnesarbetsytan. Exportera ZIP först. Export innehåller kontrakt, filer, kriteriegranskningar, källunderlag, anrop och fel.

Tillfälliga serverfel 502/503/504 får högst två extra försök efter tjänstens väntetid (minst 31 sekunder). Längre begärd paus än 120 sekunder stoppar körningen. Autentiserings-/betalningsfel utlöser ingen sådan återhämtning.

## Begränsningar

Samma modell kan göra misstag i alla roller. GPT-OSS-20B blir inte en större modell genom dessa ändringar. Tjänstens faktiskt tillåtna modeller, tokenbudget, resonemangsinställningar och kvoter är utanför appens kontroll. Auto begär medium och anpassar efter avklippning; tidigare live-test visade 1500 genererade token trots större begärd budget. Inget kringgående av tjänstens gränser används.

Agenten har inte Unity, Unreal, npm-installation, en full webbläsartestare, e-post, konton eller operativsystemåtkomst. HTML och kod visas som inert text i appen och körs inte vid filvisning. Kodtester kräver en separat kryssruta. Genererade filer ska granskas före användning. Full spelbarhet, säkerhet och prestanda kan inte bevisas av statiska filkontroller eller en AI-granskare.

Gratisåtkomst är kvotbegränsad och kan upphöra. Ingen betalreserv används. AI och webbverktyg får uppdrag och relevanta utdrag; använd inte hemligheter. Kilo är fortsatt ett manuellt valt alternativ, inte en verifierad starkare standardmodell. Den befintliga klassiska chatten finns kvar.

## Verifiering

```sh
node --test tests/agent-unit.mjs tests/reasoning-v51.mjs tests/cap-v51.mjs tests/progress-v511.mjs tests/quality-v52.mjs tests/snapshot-v52.mjs
```

De deterministiska testerna använder simulerade modeller. De kontrollerar bl.a. avvisning av plan i byggläge, underkänd tom granskning, versionskonflikter, saknade beroenden, obehörig kodkörning och bevarade funktioner från 5.1.1. Lokala webbläsartester använder simulerad AI men kör JS-sandboxen på riktigt.

Det separata `build-v52.yml` kör en riktig anonym bygguppgift. En separat webbläsare öppnar den genererade FPS-prototypen och testar rörelse, rotation, skott/poäng, återställning och icke-tom canvas. Testresultatet ska läsas från körningens faktiska logg/artefakt; förekomsten av testfilen betyder INTE att testet har passerat. Ingen modellgenererad kod körs i Node eller med repo-/kontoautentisering; spelprovet serveras separat med externa webbförfrågningar blockerade.
