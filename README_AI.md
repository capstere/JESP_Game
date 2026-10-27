# JESP AI 6.5 — gratis agent, specialiststöd och säker återstart

Öppna https://capstere.github.io/JESP_Game/. Besökaren behöver inget konto eller egen API-nyckel. Backend använder ägarens befintliga Supabase-projekt och kontrollerade nollprismodeller via Kilo. Det är gratis åtkomst med kvoter, inte obegränsad molnkapacitet.

## Användning

Skriv ett konkret uppdrag, välj Bygg/Plan/Research/Analys eller Auto och starta agenten. Arbetsmodellen skapar och redigerar filer; separata arbetsfaser planerar, testar och granskar. JavaScript- och browser-sandbox kräver ditt uttryckliga godkännande. En plan är inte en implementation och ett AI-godkännande är inte en korrekthetsgaranti.

Specialiststöd är ett val i inställningarna och används först när reparationsarbetet fastnar. Den extra kontexten får läsa och föreslå, inte ändra filer eller testfacit. Slutgranskning och verkliga kontroller kvarstår.

Spara en återstartfil för att behålla uppdrag och källfiler mellan sessioner. Öppna den senare och tryck Fortsätt. Kodkörning och webbsökning måste godkännas igen; tidigare testresultat och godkännanden följer inte med som bevis. Filerna lagras i klartext på den plats du väljer. Den vanliga ZIP-exporten innehåller även återstartunderlag.

SSE-livevisning är valfri; JSON är standard. Live-text är ett ogranskat utkast. Delvis mottagna verktygsanrop får inte köras. 6.4.2:s effektivare förhandsvisning och bevarade scrollposition är kvar.

## Kapacitet, kostnad och integritet

Arbets- och granskningsmodeller väljs ur den aktuella gratiskatalogen. Inga betalmodeller aktiveras automatiskt. Modellutbud och leverantörskvoter kan ändras. Backendens befintliga gränser är 90 anrop/timme per klient, 150/timme totalt, 1000/dag och 10000/månad. Ingen av dessa gränser höjs av 6.5. Extra specialistkonsultationer förbrukar anrop.

Uppdrag och källkod går via Supabase till Kilo och modellleverantören. Webbverktyg kan kontakta Parallel, Exa eller Wikipedia. Skriv inte hemligheter eller känsliga personuppgifter. Agenten kan inte ändra GitHub, skicka e-post, köpa tjänster eller styra din dator. Ingen generell terminal, paketinstallation eller Python-körning erbjuds.

## Tester och releasebevis

Se `AGENT_6_5.md`, GitHub Actions och respektive artefakt. Regressionstester använder simulerade modellsvar där det behövs; de är inte bevis för generell intelligens. De verkliga intervall- och specialistproven kör anonyma modellförfrågningar och kontrollerar rapporterad kostnad. Publiceringstestet jämför filernas byteinnehåll och anropar AI från den verkliga hemsidan.

Modellvikterna är oförändrade. Detta är en arbetsflödesuppgradering, inte ett påstående om likvärdighet med andra namngivna AI-system. Äldre teknikhistorik finns i `notes/README_before_v65.md`.
