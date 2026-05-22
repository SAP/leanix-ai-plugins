# Filter Applications by Attributes

Use `get_applications` to filter by hosting, fit, criticality, lifecycle, and relations. **Always set `page_size` explicitly** — default is too small.

## Parameters

| Parameter                        | Required        | Values                                                                                |
| -------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `page_size`                      | **Recommended** | 1–100                                                                                 |
| `cursor`                         | No              | Pagination cursor                                                                     |
| `functionalSuitability`          | No              | `unreasonable`, `insufficient`, `appropriate`, `perfect`                              |
| `technicalSuitability`           | No              | `inappropriate`, `unreasonable`, `adequate`, `fullyAppropriate`                       |
| `missing_technicalSuitability`   | No              | `true` — apps where technicalSuitability is empty/unset (no value assigned)           |
| `missing_functionalSuitability`  | No              | `true` — apps where functionalSuitability is empty/unset (no value assigned)          |
| `businessCriticality`            | No              | `administrativeService`, `businessOperational`, `businessCritical`, `missionCritical` |
| `lxHostingType`                  | No              | `desktopOrLaptop`, `mobile`, `onPremise`, `hybrid`, `saas`, `paas`, `iaas`            |
| `lxState`                        | No              | `DRAFT`, `APPROVED`, `REJECTED`, `BROKEN_QUALITY_SEAL`, `ARCHIVED`                    |
| `lifecycle`                      | No              | `plan`, `phaseIn`, `active`, `phaseOut`, `endOfLife`                                  |
| `lifecycle_date_filter_type`     | No              | `TODAY`, `END_OF_MONTH`, `END_OF_YEAR`, `RANGE`, `RANGE_STARTS`, `RANGE_ENDS`         |
| `lifecycle_from_date`            | No              | `YYYY-MM-DD` — required for RANGE types                                               |
| `lifecycle_to_date`              | No              | `YYYY-MM-DD` — required for RANGE types                                               |
| `application_relations`          | No              | `{"BusinessCapability": ["uuid"], "Initiative": ["uuid"]}`                            |
| `missing_subscription_role`      | No              | Role name (e.g. `"Application Owner"`) — apps missing that subscription role          |
| `completion_max`                 | No              | Integer (0–100) — apps with completion percentage ≤ this value                        |

**Enum values are case-sensitive** — typos fail silently.

## Natural Language → Parameter Mapping

Users don't say enum values. Map their intent to the right params:

| User says                                                                     | Parameter               | Values                                    |
| ----------------------------------------------------------------------------- | ----------------------- | ----------------------------------------- |
| "poor functional fit", "not meeting needs"                                    | `functionalSuitability` | `["unreasonable", "insufficient"]`        |
| "poor technical fit", "technically outdated", "technical debt", "legacy tech" | `technicalSuitability`  | `["inappropriate", "unreasonable"]`       |
| "mission critical", "most important", "business critical"                     | `businessCriticality`   | `["missionCritical", "businessCritical"]` |
| "cloud", "cloud-hosted"                                                       | `lxHostingType`         | `["saas", "paas", "iaas"]`                |
| "on-premise", "on-prem"                                                       | `lxHostingType`         | `["onPremise"]`                           |
| "retiring", "sunsetted", "decommissioning"                                    | `lifecycle`             | `["phaseOut", "endOfLife"]`               |
| "planned", "introducing soon"                                                 | `lifecycle`             | `["plan", "phaseIn"]`                     |
| "trash", "deleted", "archived", "in the trash bin"                            | `lxState`               | `["ARCHIVED"]`                            |
| "without technical fit" / "no tech fit assigned" / "w/o tech fit" / "unknown tech fit" | `missing_technicalSuitability` | `true` |
| "without functional fit" / "no functional fit assigned"                               | `missing_functionalSuitability` | `true` |

**Combine multiple filters for compound queries.** When the user asks about multiple attributes in one question, pass ALL relevant parameters in a single `get_applications` call:

- "on-premise apps with technical debt" → `lxHostingType: ["onPremise"]` + `technicalSuitability: ["inappropriate", "unreasonable"]`
- "mission-critical cloud apps" → `businessCriticality: ["missionCritical"]` + `lxHostingType: ["saas", "paas", "iaas"]`
- "active apps with poor functional fit" → `lifecycle: ["active"]` + `functionalSuitability: ["unreasonable", "insufficient"]`

## `application_relations` Key Format

**CRITICAL: Use the FactSheet TYPE NAME as the key — never a relation name.**

```
application_relations: {"BusinessCapability": ["uuid1", "uuid2"]}
application_relations: {"Initiative": ["uuid1"]}
application_relations: {"Provider": ["uuid1"]}
application_relations: {"ITComponent": ["uuid1"]}
```

**Do NOT use:**
- ❌ `"relToBusinessCapability": [...]` (relation field name — wrong)
- ❌ `"relApplicationToProvider": [...]` (internal relation name — wrong)
- ❌ `{"ids": [...]}` (wrong structure)

**To find applications linked to a Provider or ITComponent:**
1. Find the Provider/ITComponent ID using `search_fact_sheet_by_name`
2. Call `get_applications(application_relations: {"Provider": ["<id>"]}, page_size: 100)`

## Examples

- Cloud apps: `lxHostingType: ["saas", "paas", "iaas"], page_size: 100`
- On-premise: `lxHostingType: ["onPremise"], page_size: 100`
- Poor functional fit: `functionalSuitability: ["unreasonable", "insufficient"], page_size: 100`
- Poor technical fit: `technicalSuitability: ["inappropriate", "unreasonable"], page_size: 100`
- **No tech fit assigned (missing)**: `missing_technicalSuitability: true, page_size: 100`
- **No functional fit assigned (missing)**: `missing_functionalSuitability: true, page_size: 100`
- Mission critical: `businessCriticality: ["missionCritical"], page_size: 100`
- By capability: `application_relations: {"BusinessCapability": ["capability-uuid"]}, page_size: 100`
- By provider: `application_relations: {"Provider": ["provider-uuid"]}, page_size: 100`
- By IT component: `application_relations: {"ITComponent": ["itcomponent-uuid"]}, page_size: 100`
- All applications: `page_size: 100` → first 100, use `cursor` for next page

## Lifecycle Date Filtering

Use `lifecycle` with `lifecycle_date_filter_type` and date params for time-based queries:

- End-of-life today: `lifecycle: ["endOfLife"], lifecycle_date_filter_type: "TODAY", page_size: 100`
- Phasing out by end of year: `lifecycle: ["phaseOut"], lifecycle_date_filter_type: "END_OF_YEAR", page_size: 100`
- End-of-life in next 6 months: `lifecycle: ["endOfLife"], lifecycle_date_filter_type: "RANGE", lifecycle_from_date: "2026-01-01", lifecycle_to_date: "2026-06-30", page_size: 100`
- Lifecycle starting after a date: `lifecycle: ["phaseOut", "endOfLife"], lifecycle_date_filter_type: "RANGE_STARTS", lifecycle_from_date: "2026-01-01", page_size: 100`

**Date precision rules — read carefully:**

- "decommissioned in 2027" / "going EOL in 2027" → use `RANGE_STARTS` with `lifecycle_from_date: "2027-01-01"` and `lifecycle_to_date: "2027-12-31"`. This matches only apps whose lifecycle phase *starts* in that year. Do NOT use `END_OF_YEAR` or plain `RANGE` — those match anything touching 2027.
- "going out of life this year" / "EOL in 2026" → `lifecycle: ["endOfLife"], lifecycle_date_filter_type: "RANGE_STARTS", lifecycle_from_date: "2026-01-01", lifecycle_to_date: "2026-12-31"`. Do NOT use all EOL IT components as a proxy — filter the lifecycle date directly.
- "tech going out of life this year" → filter ITComponents by `lifecycle: ["endOfLife"], lifecycle_date_filter_type: "RANGE_STARTS", lifecycle_from_date: "2026-01-01", lifecycle_to_date: "2026-12-31"` first, then get applications linked to only those ITComponent IDs.

## Negation Queries

For "NOT X" queries, list all **other** enum values instead:

- NOT mission critical: `businessCriticality: ["administrativeService", "businessOperational", "businessCritical"]`
- NOT cloud: `lxHostingType: ["desktopOrLaptop", "mobile", "onPremise", "hybrid"]`
- NOT active: `lifecycle: ["plan", "phaseIn", "phaseOut", "endOfLife"]`

## Pagination

Call again with `cursor` from previous response. Continue until `cursor` is null.

**NEVER stop at the first page when the user asks for a complete list.** If `total_count` is larger than the number of IDs returned, paginate to collect all results before answering.

## Response Fields

`id`, `name`, `displayName`, `functionalSuitability`, `technicalSuitability`, `businessCriticality`, `lxHostingType`, `lifecycle`, `lxState`, `tags`, `description`, `cursor`, `total_count`

## Troubleshooting

| Problem            | Solution                                     |
| ------------------ | -------------------------------------------- |
| Missing results    | Increase `page_size` to 100                  |
| Filter not working | Check exact spelling and case of enum values |
| Need by name       | Use `search_fact_sheet_by_name` instead      |
