# JESP AI 6.5 — specialiststöd och återstartbara uppdrag

## Nya funktioner

**Läsande felsökningsspecialist.** När samma fel återkommer i två reparationsbeslut kan en separat, kort modellkontext ge en diagnos med hänvisningar till aktuella filer och testloggar. Högst två konsultationer per körning, med en formatkorrigering per konsultation. Samma katalogkontrollerade gratis granskningsmodell används. Rådet kan inte ändra filer, tester, behörigheter eller godkänna en leverans. Ändrade filversioner gör gammalt råd inaktuellt.

**Sökning i arbetsfiler.** `search_files` söker bokstavlig text med exakta radnummer och aktuella versioner. Högst 30 träffar visas, med totalantal och avkortningsmarkering. Ingen regex, kodkörning eller nätverkstrafik. Sökning erbjuds bara där arbetsfasen redan tillåter läsning.

**Återstart från disk.** Spara `JESP_aterstart.json` och öppna den senare med **Öppna återstartfil**. Filen sparar uppdrag och källkod i klartext. Behörigheter, modeller, testresultat och gamla godkännanden importeras inte. Kodkörning och webbsökning är av efter import och måste godkännas igen. Ny planering och verifiering görs vid **Fortsätt**. ZIP-exporten innehåller också `aterstart.json`.

## Rättningar från verkliga prov

Specialistmodellen gav först tolv testförslag trots en listgräns. Den får nu tre namngivna textfält som omvandlas till en lista utan att något råd tappas bort. Blandade format och gamla överlånga listor avvisas fortfarande. Källreferenser och ändringsfilnamn begränsas i anropsschemat till faktiskt tillgängliga filversioner/loggar. Ett separat valideringssteg avvisar fortfarande felaktiga referenser, även om modellen ignorerar schemat. Ogiltiga förslag loggas tillsammans med de tillåtna referenserna.

Den publicerade 6.4.2-optimeringen är bevarad: bildrutesamlad, begränsad textförhandsvisning, bevarad scrollposition, fullständigt slutsvar och återställning mellan anrop. En importerad arbetsyta tömmer även väntande förhandsvisning.

## Vad detta inte lovar

Ingen omträning av modeller, ingen verifierad likvärdighet med Luna/Sol och ingen obegränsad kapacitet. Extra konsultationer kostar gratisanrop och tid. Råd är förslag, inte bevis. Befintliga kvoter, sandbox, säkerhetskontroller, gratisfilter och krav på godkända tester kvarstår. Inga nya användarkonton, nycklar eller betalreserver.

## Verifiering

`tests/agent-boost-v65.mjs` och `tests/advice-slots-v65.mjs` testar rådgivning, falska referenser, kvotfel, sökning och återstart med simulerad AI. `tests/boost-browser-v65.mjs` testar faktisk Chromium-UI; `LIVE=1` använder verkliga anonyma inferensanrop. Agenten reparerar en intervallfunktion och kör en separat granskning. Testaren kör 40 extra fall och en kontroll av att resultatet inte delar muterbara indataintervall (81 assertions), samt prövar ett verkligt läsande specialistförslag. Genererad kod körs enbart i browser-sandboxen, inte på runnern med GitHub-behörigheter.

`.github/workflows/release-v65.yml` testar exakt commit och har endast läsbehörighet. Den ändrar inte källkod under testet. Efter merge kontrollerar `published-v65.yml` publicerade filers SHA-256 och ett riktigt anonymt AI-anrop från den publika sidan utan källkodsersättning. Faktiska utfall finns i Actions-artefakterna, inte i versionsnumret.
