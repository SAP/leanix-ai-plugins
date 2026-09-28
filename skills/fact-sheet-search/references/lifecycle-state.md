# Lifecycle and workflow state

Load for lifecycle phase/status, lifecycle date windows, workflow/approval state, quality-seal state, and obsolescence risk. Use `tags-and-archive.md` for tags or trash/archive.

**Execution:** direct `mcp__leanix__filter_inventory` is fine for one precise lifecycle/state facet and count-only questions. Use `mcp__leanix__execute_code` for full-set list-all reads that exceed one page, target-side lifecycle traversals, or computed/grouped answers.

## Lifecycle

Lifecycle filters need a `dateFilter`. If no date/range is specified, interpret lifecycle status as current and use `dateFilter:{type:TODAY}`. For wording such as current/currently/in the planning stage, use the current lifecycle facet/state or a confirmed current/asString value; do not list fact sheets that only have a historical or future lifecycle phase matching the word. Confirm phase keys from context/filterOptions; standard keys are `active`, `phaseOut`, and `endOfLife`. Put ISO date strings directly in `dateFilter`; do not declare guessed GraphQL date variables such as `Date`, `DateTime`, or `LocalDate`. Lifecycle phase object fields are workspace/API-shape dependent. For "starts within" windows, prefer the lifecycle facet `dateFilter:{type:RANGE_STARTS,...}`. 
If you need phase object fields, set `include_schema=true` on the **initial** `mcp__leanix__get_workspace_context` call — do not make a separate schema-only round trip. Confirm lifecycle phase fields via SDL; do not assume fields such as `endDate` exist. After a `FieldUndefined` error for any lifecycle subfield, stop trying phase-object selections and use the lifecycle facet/`dateFilter` path instead.

| User phrasing | Filter |
|---|---|
| active / live / in production | `lifecycle=["active"]` + `TODAY` |
| retiring / phasing out / sunsetting | `lifecycle=["phaseOut"]` + `TODAY` unless a range is named |
| retired / end of life | `lifecycle=["endOfLife"]` + `TODAY` unless a range is named |
| retiring/EOL in YEAR | matching lifecycle key + `RANGE_STARTS` for that year |
| as of DATE | matching lifecycle key + `RANGE` from DATE to DATE |

When the answer type differs from the lifecycle-filtered type, filter the target side first and traverse relations. Example: "Applications using End-of-Life IT Components" means fetch EOL ITComponent IDs, chunk them into the Application→ITComponent relation facet, dedupe Application IDs, and return Applications only. For generic "software/solutions/systems/tools retiring or going out of life", include both Application and ITComponent branches unless the user narrows the type, then dedupe only within the requested answer type. For generic "technology going out of life in YEAR", use the ITComponent usage lifecycle facet `lifecycle` with `endOfLife`/`RANGE_STARTS`; use vendor lifecycle fields only when the user explicitly says vendor support lifecycle. Relation-edge `activeFrom`/`activeUntil` dates are different; use `relation-edge-dates.md` for relation validity/as-of semantics.

"Alternatives", "replacement", or "what replaces X" requires traversing `relToSuccessor` (or `relToPredecessor` for the reverse); the related fact sheet is under `edges { node { factSheet { id displayName type } } }`, not `edges { node { displayName } }`.

"Unaddressed risk of obsolescence" is not a name search. Prefer a confirmed Application aggregate risk facet such as `aggregatedObsolescenceRisk`; common unaddressed keys are `unaddressedEndOfLife` and `unaddressedPhaseOut`. If unavailable, compute in two stages: first resolve target ITComponents by lifecycle as of the date, then fetch Applications related to those ITComponent IDs and inspect the Application→ITComponent edge `obsolescenceRiskStatus`, excluding `riskAddressed` and `riskAccepted`. Do not put target lifecycle facets and relation-edge fields in the same relation `subFilter` unless workspace context/filterOptions confirms that exact shape; `obsolescenceRiskStatus` is a relation-edge field, not an ITComponent facet.

Created/updated timestamps are node fields, not lifecycle facets; use `completion-and-ranking.md` for metadata date filtering.

## Workflow / quality-seal state

| Concept | Typical facet/key |
|---|---|
| Broken quality seal | `lxState = BROKEN_QUALITY_SEAL` |
| Rejected based on quality seal | `lxState = REJECTED` only |
| Data-quality findings | `DataQuality` categorical values such as `_qualitySealBroken_` |

Broken quality seal, rejected approval, and `DataQuality` findings are different concepts. Do not answer "rejected based on quality seal" with `BROKEN_QUALITY_SEAL`; use `REJECTED` unless the user explicitly says broken/failed quality seal. Completion percentage is not `DataQuality`.

## Lifecycle data-quality quirks

`__missing__` is valid only for relation and subscription facets, not the `lifecycle` facet. For apps missing lifecycle data, do not query `lifecycle` with `keys:["__missing__"]`; inspect `filterOptions` for the `DataQuality` sentinel (such as `_noLifecycle_`) and use the exposed key. Do not invent `DataQuality` keys.
