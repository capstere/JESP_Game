# QDIP — enkel förklaring av projektet

**Underlag:** `QDIP_SOURCE_OF_TRUTH_CURRENT.md` (2026-08-13)
**Syfte:** förklara vad som byggts, för dig själv och för andra

---

# Vad projektet är

Den fysiska QDIP-tavlan på väggen har blivit digital.

Samma tre områden. Samma sju mätetal. Samma gröna och röda dagar. Skillnaden är att siffrorna nu hämtas eller matas in en gång, räknas automatiskt, och visas likadant för alla.

---

# De fyra delarna

**1. SharePoint** — där siffrorna bor
Sex listor. En för resultaten, en för orsakerna, och fyra som beskriver reglerna: vilka mätetal som finns, vilka orsaker som är giltiga, vilka dagar som ska rapporteras, och vilka åtgärder som pågår.

**2. Power Apps** — där människan rapporterar
Fyra skärmar: välj mätetal, fyll i dagens siffra, se historik, hantera åtgärder. Appen vet själv vilka dagar som väntar och vad som redan är klart.

**3. Power Automate** — det automatiska jobbet
Varje vardag klockan 09:00 hämtar det Delivery Leading från produktionssystemet, sparar siffran och startar uppdateringen.

**4. Power BI** — tavlan
Läser allt, jämför mot målen, visar sex kalendrar med grönt och rött per dag.

---

# Det viktigaste beslutet

**Dagens siffra låses när den rapporteras.**

Ändras produktionsdatan i efterhand står gårdagens resultat kvar. Precis som på papperstavlan — när en siffra väl står i rutan ändras den inte för att verkligheten justerades senare.

Utan den regeln skulle en grön månad kunna bli röd i efterhand, och tavlan skulle inte gå att lita på.

---

# De sju mätetalen

| Mätetal | Var siffran kommer ifrån |
|---|---|
| EHS Checklist | Person, varje vardag |
| EHS Incident | Person |
| EHS Amplicon | Person — men bara vid händelse |
| NRFT | Person |
| Closed LFI | Automatiskt från kvalitetsuppföljningen |
| Delivery Leading | Automatiskt kl 09:00 |
| Delivery Lagging | Automatiskt från produktionsdata |

Tre nivåer av automatik, och det är medvetet:

**Manuellt** — kräver en mänsklig bedömning.

**ExceptionOnly** (Amplicon) — ingen rad betyder noll. Man rapporterar bara när något hänt.

**ExternalAutomatic** (LFI, Delivery Lagging) — siffran räknas fram direkt i Power BI från källan. Ingen kopia mellanlagras.

**AutomaticWithFallback** (Delivery Leading) — automatiken skriver normalt, men har den inte levererat 09:15 får en människa fylla i. Raden märks då som manuell reserv.

Den sista är den viktiga: **mötet kan aldrig blockeras av att ett system ligger nere.**

---

# Hur rapporteringsdagarna fungerar

**Leading** rapporteras samma dag, måndag till fredag. Helger räknas inte.

**Lagging** rapporteras dagen efter:
- Tisdag–fredag → gårdagen
- Måndag → fredag, lördag och söndag på en gång

Helgerna är alltså riktiga rapporteringsdagar för lagging — de rapporteras bara på måndagen.

Kalendern i SharePoint bestämmer detta. Ingen behöver hålla reda på det själv.

---

# Vad som är klart

```
✅ Sex SharePoint-listor med skydd mot dubbletter
✅ Power Apps — fyra skärmar, noll formelfel
✅ Automatiskt flöde verifierat i drift
✅ Power BI-modell med separata lager för period, dagsläge och kalender
✅ Alla sex kalendrar validerade
✅ Fiskalmånadsväljaren fungerar
```

Projektet är i praktiken färdigt för användning. Det som återstår är analysdelen.

---

# Vad som kommer härnäst

**Trend och orsaksanalys.**

Kalendern visar *vilken dag* som var röd. Nästa steg svarar på *varför* och *är vi på väg åt rätt håll*.

Och det byggs olika beroende på mätetal — vilket är rätt:

- Manuella mätetal har registrerade orsaker att gruppera
- LFI har sina egna orsaksfält från källan
- Delivery analyseras uppströms, i produktionsdatan

Att tvinga alla sju in i samma orsaksmodell hade gett en analys som ser enhetlig ut men betyder olika saker.

---

# Tre saker som är medvetet accepterade

**Skrivningar mot två listor kan inte göras helt atomära.** Resultat och orsaker sparas i olika listor. Ordningen och felhanteringen är genomtänkta, men en teoretisk lucka finns.

**En liten tidslucka vid samtidig redigering.** Appen kontrollerar raden innan den sparar, men SharePoint erbjuder ingen låsning. Unika nycklar skyddar mot dubbletter.

**Appen använder klientens klocka.** Fungerar så länge alla användare sitter i Solna. En framtida utlandsanvändning skulle behöva serverns tid.

Alla tre är dokumenterade som accepterade — inte förbisedda.

---

# Om någon frågar

**"Varför inte automatisera allt?"**
Vissa siffror kräver en bedömning. En checklista måste någon gå igenom. Automatik som gissar är sämre än en människa som vet.

**"Vad händer när automatiken fallerar?"**
Appen visar det direkt och öppnar för manuell inmatning. Mötet fortsätter.

**"Kan siffror ändras i efterhand?"**
Ja, men som en medveten handling — och det syns vem som gjorde det och när.

**"Hur vet vi att siffrorna stämmer?"**
De har jämförts mot den officiella rapporten. Där de skiljde sig har avvikelsen utretts.

---

# Det som gjorde projektet svårt

Inte tekniken. Utan att få siffrorna att **betyda samma sak överallt**.

Ett exempel: månadsmålet för LFI. Är det ett dagsmedelvärde eller en månadssumma? Skillnaden är tre stängda LFI per månad mot ungefär nittio. Frågan såg liten ut men avgjorde om mätetalet var användbart alls.

Sådana frågor tog merparten av tiden. Att visa siffrorna var den enkla delen.
