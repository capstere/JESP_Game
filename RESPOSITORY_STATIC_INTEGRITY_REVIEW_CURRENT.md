# Repository and Static Integrity Review — Current

**Review date:** 2026-08-13  
**Primary-cleanup commit reviewed:** `a6e7dc3`  
**Scope:** repository hygiene, current report/package integrity and post-measure semantic-model hygiene. No Service publish/refresh, Power Automate run or production write was performed.

## Release/static integrity result

| Check | Result | Evidence |
|---|---|---|
| Current report pages | **PASS** | Exactly two pages: visible `01 Overview` with 27 visual containers and `02 Trend & Drivers DRAFT` with 28, marked `HiddenInViewMode`. |
| Obsolete Test page | **PASS** | No Test page exists in current `pages.json` or page folders. |
| Report JSON | **PASS** | All 63 files under the report definition parse as JSON. |
| Repository JSON | **PASS** | All 74 current repository JSON files parse. |
| Visual interactions | **PASS** | All seven page-interaction source/target IDs resolve to current visual IDs. |
| Current performance evidence | **PASS / qualified** | The trace contains current Overview visual IDs only; it is one Desktop refresh capture, not a Service or initial-load proof. |
| DAX cleanup references | **PASS** | 115 measures remain; every structured report measure node, bookmark measure, DAX dependency, culture binding and the Flow query resolves after cleanup. |
| Service/runtime release declaration | **NOT PERFORMED** | Static maintenance did not publish, refresh the Service, run the flow or claim runtime release readiness. |

## Power Apps App Checker evidence

There is no standalone `01_PowerApps/AppChecker.txt`. However, the current package `01_PowerApps/Ne7b6dba9-d28e-43d7-bc11-4437ed41b8b4-document.msapp` does contain current embedded App Checker evidence:

- `Header.json`: last saved `2026-08-13 07:49:58 UTC`; document version `1.349`.
- `Properties.json`: `ParserErrorCount = 0`; `BindingErrorCount = 0`.
- `AppCheckerResult.sarif`: execution successful; **60 Medium** findings and **zero Error-level** findings.
  - 46 `acc-TabIndexShouldBeDefinedForInteractiveControl`.
  - 3 `app-CollectDelegatableDataSource`.
  - 7 `app-CollectingReadOnlyTable`.
  - 4 `app-ForAllWithMutation`.

This qualifies the Source of Truth/Technical Overview statement that the current upload lacks fresh App Checker evidence: it lacks a standalone export, but the `.msapp` embeds a saved result. A deliberate final App Checker rerun/export remains a release gate; this review does not fabricate or substitute runtime evidence.

## Repository hygiene classification

No secondary artifact below was deleted in this task. Classification precedes any later removal.

| Artifact | Verified evidence | Classification / action |
|---|---|---|
| `01_PowerApps/te.txt` | Exactly 3 bytes, content `ef\n`; no repository reference; Git history shows repeated creation/deletion around upload sessions. | **SAFE-DELETE CANDIDATE**, but leave for a separate explicit repository-hygiene commit. |
| `04_PowerBI/IPT-QDIP-PowerBI_2026-08-05.0728.SemanticModel/DAXQueries/Query 1.dax` | Exactly 0 bytes; no executable or report reference. | **SAFE-DELETE CANDIDATE**, separate commit. |
| `02_PowerAutomate/manifest.json` and `manifest (1).json` | Not duplicates. The 99-byte file lists the flow asset path; the 2,323-byte package manifest describes the flow, APIs, connections and dependencies. | **PROTECTED / KEEP**; the odd filename alone is not deletion evidence. |
| `01 Overview_DesignDraft.png` | No executable reference, but it is a design artifact and Overview design is explicitly open. | **PROTECTED / KEEP** pending the design session. |
| `QDIP_Technical_Handoff_2026-08-07_REVISED.md` | Historical authority only; contains statements superseded by current artifacts. | **KEEP AS HISTORY**; an archival banner may reduce misuse, but do not rewrite it as current truth. |
| `00_READ_ME/QDIP — second-pass full repository technical audit.md` | Historical audit; contains now-stale Test-page and TMDL-fence findings. | **KEEP AS HISTORY**; do not use as executable authority. |
| Service PNG evidence | Point-in-time screenshots, not current runtime proof. | **KEEP AS EVIDENCE**, with date/scope qualification. |

## Bookmark/report-state residue

The two serialized bookmarks, `Trend & causes` and `Actions`, each target 13 visual IDs, of which only three remain. Both retain old `FiscalYearMonth = 2026-M08` exploration state. They use `applyOnlyToTargetVisuals = true` and `suppressData = true`; the active fiscal selector is not a bookmark target, and no on-canvas bookmark binding was found.

This is **DEFERRED P2 design-state cleanup**, not a current slicer-correctness defect. Bookmark/navigation design is explicitly open, so do not delete or rebuild them during technical hygiene.

The Performance Analyzer title for visual `453716d388b0b06e72c0` is `EHS Checklist`, although the visual is the Delivery Lagging calendar. This is **P3 metadata hygiene** only.

## Semantic-model hygiene after measure cleanup

The post-cleanup model contains **11 tables, 261 columns, 115 measures and 9 relationships**. It has no calculation groups, field parameters or hierarchies. Only two columns are calculated in DAX.

### Protected objects

- `Delivery Lagging Driver Stage` is deliberately disconnected and is used by draft visual `250b649720fa0c1299bf` plus `[Delivery Lagging Driver Hours]`; its `SortOrder` is a live sort dependency.
- `_Measures[Dummy]` and its one-row partition are the current measure-home table and remain required.
- `Active Production Orders` and `Historical Production Orders` are intentionally disconnected DirectQuery tables; current visuals and DAX reference them explicitly.
- The two similarly named Solna connection expressions are independently bound to Active and Historical tables; they are not proven duplicates.
- `DimDate[FiscalMonthSort]`, `FiscalDayOfWeekNum`, `QDIPLeadingExpected`, `QDIPLaggingDueDate`, Historical weekday-index columns and `DimMetric[SortOrder]` have sort/report/DAX dependencies.
- Current relationships among result, cause, metric, date, action and LFI facts remain part of the documented model contract unless separately proven otherwise.

### Review candidates, not deleted

- `DimDate[FiscalMonthSelector]`, one of the two calculated columns, is **PROTECTED** by both report pages and its `FiscalMonthSort` dependency.
- `_Measures[LFI Auto Latest Closure Date]`, the other calculated column, is a strong **SAFE-DELETE CANDIDATE**: it has no report, DAX, sort, relationship, culture, Flow, App or Power Query consumer. Its expression is `MAX ( LFI[LFI_closure_date] )`. Validate model serialization in Desktop before removal.
- The inactive relationship `123e3184-fb60-4b6b-4c6f-58cdc4cafda8` (`FactAction[ExpectedDueDateKey]` → `DimDate[DateKey]`) and `0e3cf986-b5f7-ce9f-6add-d7002578f4e0` (`FactAction[RequiredDueDateKey]` → `DimDate[DateKey]`) no longer have a surviving `USERELATIONSHIP` measure after the dead Action analytics family was removed. Raw Required/Expected dates and `[Overview Action Rank]` remain live but do not use these keys. Treat both relationships as **UNKNOWN_REVIEW**, not automatic deletes: clarify whether future due-date-role analytics are still intended. If not, remove each relationship, matching key column and M `AddColumn` step together in a separate change.
- Four fields lost their only local DAX consumer during cleanup: `DimMetric[YearlyTargetMax]`, `DimDate[FiscalYear]`, `DimDate[FiscalMonthName]` and `FactResultCause[ResultCauseKey]`. They retain target-versioning/date/key-integrity semantics and are **UNKNOWN_REVIEW / KEEP**, not dead-code deletions.
- The scan found 165 source columns without a local semantic consumer. This is not safe-deletion proof: 93 belong to the upstream DirectQuery surface and 72 are imported schema/audit/business fields. Preserve them unless a source-ownership and future-design review proves abandonment.

No calculated column, helper table or relationship was removed in this secondary pass.

## Recommended next maintenance order

1. Confirm the intended Overview Delivery Lagging detail context (Due packet versus selected month) before performance refactoring.
2. Run a deliberate final App Checker and preserve a standalone export if that is the chosen release-evidence convention.
3. If desired, remove only `01_PowerApps/te.txt` and the empty `Query 1.dax` in a separate reviewable hygiene commit.
4. Decide bookmark/navigation design before cleaning stale target state.
5. Review the hidden LFI calculated column and inactive Action due-date role relationships in Power BI Desktop before any semantic-model deletion.
