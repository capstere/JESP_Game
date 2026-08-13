# Power BI Performance Review — Current Evidence

**Evidence artifact:** `04_PowerBI/PowerBIPerformanceData.json`  
**Review date:** 2026-08-13  
**Scope:** measured current-report query behavior only; no Service refresh, flow run, report redesign or source-architecture change was performed.

## Executive result

The captured Overview refresh is dominated by four DirectQuery visuals, not by report rendering or the other imported-model visuals.

- The trace contains **411 events** from one Desktop `UserAction_Refresh`; it is not an initial-load trace.
- It contains **23 query-bearing Overview visuals** and no hidden-draft visual execution.
- The observed page critical path is approximately **35 seconds**.
- Four DirectQuery visuals account for **89,382 of 94,313 ms** of aggregate visual-query duration (**94.8%**).
- The other 19 queries have a median of **313 ms** and a maximum of **382 ms**.
- Rendering is not the measured bottleneck: the slow DirectQuery visuals spend only **42–63 ms** rendering, and the largest render in the trace is **210 ms**.

Aggregate query duration includes work that can overlap. It must not be read as page elapsed time; in particular, summing all nested `Execute Direct Query` events materially overstates the user-visible duration.

## Ranked measured operations

| Rank | Page / visual | Query duration | DirectQuery evidence | Interpretation |
|---:|---|---:|---|---|
| 1 | `01 Overview` / Historical affected-lots table `959f14c89056e9f81d46` | **34.889 s** | 24 Historical DirectQuery events; 40 output rows; intermediate reads up to 1,069 rows; generated remote query text up to 57,763 characters | The live lot-visibility/detail/formatting chain fans out repeated Historical queries. |
| 2 | `01 Overview` / current Active WIP table `11f6a5c52f6368441095` | **20.998 s** | 6 Active DirectQuery events; 5 output rows | Population filters are the intended `Filter IPT/FQC = 1`, Order# prefix `11`, and `IPT LT >= 10`; do not replace them with a convenient proxy. |
| 3 | `01 Overview` / Delivery Lagging calendar `453716d388b0b06e72c0` | **20.740 s** | 14 Historical DirectQuery events; 35 output cells | The Performance Analyzer title is stale (`EHS Checklist`), but the visual is the D_OVER_20H calendar. |
| 4 | `01 Overview` / Delivery Lagging Due card `8ddd184fa5f3cd5d9a01` | **12.755 s** | 11 Historical DirectQuery events; one output row | Repeated Due-date/late-population evaluation is the likely query cost, not card rendering. |

The trace is retained evidence captured before this maintenance task's dead-measure removal. The cleanup changed no retained measure expression, so it is still useful for targeting; it is not a post-cleanup runtime benchmark.

## Dependency implications

The following Historical detail path is live and was intentionally retained during DAX cleanup:

`Delivery Lagging Affected Lot Visible`
→ `Delivery Lagging Lot Total LT`
→ `Delivery Lagging Lot Main Driver`
→ `Delivery Lagging Lot Issue`
→ the two related background-format measures.

`Delivery Lagging Affected Lot Visible` calls canonical `[Delivery Lagging Over20 Lots]`. The table projects three row measures, sorts by Total LT, and applies formatting measures that call the row logic again. That is consistent with the observed Historical DirectQuery fan-out, but it is not yet proof that one specific DAX subexpression is the sole cause.

The disconnected `Delivery Lagging Driver Stage` table is not overhead to remove: the hidden draft uses it in visual `250b649720fa0c1299bf` with `[Delivery Lagging Driver Hours]`, and `SortOrder` controls its stage order.

## Semantic issue to settle before optimization

The Technical Overview says the Overview detail should show today's Due packet, while Trend analysis may show the selected fiscal month. The current Overview Historical affected-lots table instead receives the Overview `FiscalMonthSelector` interaction and its row gate uses period `[Delivery Lagging Over20 Lots]`; the trace query includes `Current fiscal month` context.

This is a pre-existing **semantic `UNKNOWN_REVIEW`**, not a performance fix to guess. Confirm the intended Overview population before optimizing the table, otherwise a faster query could preserve the wrong context.

## Ranked experiments

Perform one experiment at a time in a non-production/local diagnostic copy:

1. **VALIDATE semantics first:** confirm whether Overview visual `959f14c89056e9f81d46` should be Due-packet or selected-month detail.
2. Benchmark `959f14c89056e9f81d46` after removing one projected/formatting measure at a time. Preserve Order# prefix `11`, Document Review date and `Lead time >= 20` in every comparison.
3. Use Server Timings on the affected-lot visibility chain and compare an equivalent single population gate only after row-by-row and total equivalence is proven.
4. Capture Delivery Lagging calendar and Due card Server Timings separately to locate repeated date/prefix/lot materialization.
5. Consider an upstream eligibility/prefix field or upstream measure only if it exactly preserves the canonical population; do not create a second QDIP snapshot layer.
6. Benchmark the Active WIP table with each of its two background-format measures removed separately. Keep `Filter IPT/FQC = 1`; do not substitute `PQC lot` or another proxy.
7. Capture at least three comparable warm/cold-equivalent refreshes before accepting an improvement.

## Deferred by design

- Hidden `02 Trend & Drivers DRAFT` performance is unknown because no draft visual appears in this trace.
- No snapshot layer is proposed for Delivery Lagging or LFI.
- No page layout, bookmark/navigation or visual-design change is recommended from this trace.
- No live DAX refactor was combined with dead-code cleanup.

## Exact artifact locations

- Performance trace: `04_PowerBI/PowerBIPerformanceData.json`
- Historical table: `04_PowerBI/IPT-QDIP-PowerBI_2026-08-05.0728.Report/definition/pages/eec2c78670920dbb304a/visuals/959f14c89056e9f81d46/visual.json`
- Active table: `04_PowerBI/IPT-QDIP-PowerBI_2026-08-05.0728.Report/definition/pages/eec2c78670920dbb304a/visuals/11f6a5c52f6368441095/visual.json`
- Delivery Lagging calendar: `04_PowerBI/IPT-QDIP-PowerBI_2026-08-05.0728.Report/definition/pages/eec2c78670920dbb304a/visuals/453716d388b0b06e72c0/visual.json`
- Delivery Lagging Due card: `04_PowerBI/IPT-QDIP-PowerBI_2026-08-05.0728.Report/definition/pages/eec2c78670920dbb304a/visuals/8ddd184fa5f3cd5d9a01/visual.json`
- Retained measure definitions: `04_PowerBI/IPT-QDIP-PowerBI_2026-08-05.0728.SemanticModel/definition/tables/_Measures.tmdl`
