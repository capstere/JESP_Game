Ja — det är precis den sidan vi har pratat om, och jag gled nyss åt fel håll när jag började prata om trend mellan fiskalmånader.

Det vi ska bygga är bättre:

Välj en fiskalmånad → se hur KPI:n utvecklades inom den månaden → se vad som drev resultatet / vilka causes som låg bakom.

Alltså ska samma fiskalmånad styra både Trend och Driver/Cause.

För exempelvis vald 2026-M08 skulle sidan kunna fungera så här:

┌──────────────────────────────────────────────────────────────────────────┐
│ 2026-M08                 KPI: Delivery Leading                           │
│ Result: 2.7              Target: ≤3              Status: GREEN           │
├──────────────────────────────────────┬───────────────────────────────────┤
│ TREND INOM FISKALMÅNADEN             │ DRIVER / CAUSE                    │
│                                      │                                   │
│ 5 ┤                 ●                │ Testing        ███████  7          │
│ 4 ┤       ●    ●                     │ Resampling     █████    5          │
│ 3 ┤ ● ───────── target ─────────     │ Reviewing      ███      3          │
│ 2 ┤            ●      ●              │ Compiling      ██       2          │
│   └ W1   W2   W3   W4 / dagar       │                                   │
├──────────────────────────────────────┴───────────────────────────────────┤
│ DETAIL: berörda lots / order / faktisk driver / lead time               │
└──────────────────────────────────────────────────────────────────────────┘

Och Delivery är där sidan kan bli riktigt bra, eftersom vi inte bara har våra QDIP-resultat utan också upstream-data.

För Delivery Leading har vi Active Production Orders. Den officiella KPI-trenden kommer från de dagliga 09:00-snapshots vi redan sparar i QDIP_MetricResults. Men Driver-panelen kan gå djupare in i de lots som faktiskt ligger >=10h just nu och visa var de befinner sig. I vår tidigare profiling såg vi användbara tillstånd som Testing, Resampling, Compiling och Reviewing, och IS IPT såg lovande ut som driverdimension. Men vi ska först reconcila populationen exakt mot [Delivery Leading Live Count] och Filter IPT/FQC = 1; vi ska inte använda PQC lot = Yes eller någon annan bekväm proxy bara för att den råkar finnas. Det är också nu uttryckligen låst i SoT.

Det betyder att Delivery Leading kan få en mycket mer användbar analys än bara ett vanligt cause-diagram:

Trend: dag för dag under vald fiskalmånad, antal lots >=10h vid official snapshot.
Driver: var de problematiska lotsen befinner sig — Testing / Resampling / Reviewing / Compiling / osv.
Detail: Order#, aktuell lead time, driver/state och eventuella relevanta error-/retestfält vi kan verifiera i upstreammodellen.

För Delivery Lagging är det ännu bättre historiskt, eftersom vi har Historical Production Orders. Där kan vi begränsa oss till exakt den kanoniska populationen:

vald fiskalmånad
+ Order# börjar 11
+ Document review date inom perioden
+ DISTINCT Order#
+ Lead time >= 20h

och sedan försöka svara på den mycket mer intressanta frågan:

Var förlorade de sena loterna tiden?

Om Historical-tabellen innehåller de process-/tidskolumner vi redan sett kan Driver-panelen exempelvis visa vilket steg som bidrog mest till >=20h, snarare än bara säga “15 lots var sena”. Det är exakt nästa experiment som står dokumenterat i SoT.

Samma sida kan sedan byta logik beroende på KPI. För EHS Checklist/Incident/NRFT använder Driver/Cause våra riktiga FactResultCause; LFI använder LFI_root_cause; Delivery Leading använder upstream Active-driver; Delivery Lagging använder Historical-driver. Ingen fake gemensam cause-dimension som försöker pressa alla KPI:er genom samma datakälla.

Så jag ändrar planen

Behåll namnet:

02 Trend & Drivers

Men sidan ska inte primärt vara en 12-månaders trend.

Den ska vara en fiskalmånadsanalys:

Selected Fiscal Month
        │
        ├── KPI result / target / status
        │
        ├── Trend inom månaden
        │      └─ datum eller fiscal week
        │
        └── Driver / Cause inom samma period
               ├─ manuella causes
               ├─ LFI root cause
               ├─ Delivery Leading upstream driver
               └─ Delivery Lagging upstream bottleneck

Och jag vill dessutom lägga en detail-del längst ner, för framför allt Delivery. Om ett möte visar “Delivery Lagging Red”, ska man kunna gå från:

15 late lots → Reviewing är största drivern → här är de 8 orders som bidrar

utan att lämna sidan.

Det är mycket närmare det vi tidigare pratade om.

Nästa steg ska därför inte vara att skapa något generiskt Trend-DAX ännu. Först kartlägger vi exakt vilka fält vi faktiskt har i Active Production Orders och Historical Production Orders och bestämmer den bästa Delivery-driver-designen. Sedan bygger vi sidan runt den — för Delivery är den svåraste och mest värdefulla delen.
