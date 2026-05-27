---
name: fact-sheet-search
description: >-
  Answers natural language questions about LeanIX fact sheets by choosing the
  best retrieval approach — structured GraphQL query or vector search — then
  executing it. Use when searching fact sheets by lifecycle, approval state,
  ownership, relations, field values, date ranges, or exact name/UUID lookup.
argument-hint: "[natural language question about fact sheets]"
license: Apache-2.0
compatibility: Requires LeanIX MCP server for API access (mcp__leanix__* tools)
metadata:
  author: SAP LeanIX
  version: "2.0"
allowed-tools:
  - mcp__leanix__get_fact_sheet_types
  - mcp__leanix__get_all_fact_sheets_schema
  - mcp__leanix__get_meta_model
  - mcp__leanix__read_inventory
  - mcp__leanix__vector_search
  - mcp__leanix__search_users
---

# GraphQL Fact Sheet Search

Answer questions about LeanIX fact sheets by choosing the right retrieval approach and executing it.

**Always call `get_fact_sheet_types`, `get_all_fact_sheets_schema`, and `get_meta_model` first, before reasoning about the query.**

---

## Choosing the retrieval approach

After loading the workspace context, decide which approach fits the query.

**Always use `read_inventory`** for:
- Lifecycle phase (phasing out, end of life, retiring)
- Approval / workflow state (rejected, approved, draft, archived)
- Ownership / subscription (missing responsible, has accountable)
- Relation presence or absence (has IT components, missing owner, dependent on X)
- Structured field values (technicalSuitability, businessCriticality, completion %, maturity level)
- Date ranges (created after, updated before)
- Exact full name, brand name, code, or UUID lookup — use `fullTextSearch`
- Any query where the answer depends on relations, field values, or metadata not stored in text descriptions

**Use `vector_search`** when the query is an **abbreviation, acronym, or partial name** that you cannot expand with confidence — e.g. "ac mgmt", "hr sys", "fin tool". Do NOT guess what the abbreviation stands for; let vector search find matches by semantic similarity.

**Do NOT use `vector_search`** for:
- Concept or business intent queries ("marketing automation system", "invoice data apps") — embeddings only contain displayName, description, type, lxState, status, and category; whether a fact sheet matches a business concept is not reliably encoded
- Queries about relations ("apps dependent on IBM", "apps used in Spain") — relations are **not** in embeddings
- Queries about field values (lifecycle, completion %, maturity, TCO) — field values are **not** in embeddings
- Queries about subscription/ownership — not in embeddings
- Exact full name / code / UUID lookups — GraphQL `fullTextSearch` is more precise
- Any query where the structured approach already has a clear filter path

When in doubt, use `read_inventory` first. Only use `vector_search` if the query is an abbreviated or partial name and GraphQL `fullTextSearch` returns 0 results.

---

## STRICT TOOL CONSTRAINTS

You are permitted to call **exactly these tools**:

1. `get_fact_sheet_types` — called **once** at the start
2. `get_all_fact_sheets_schema` — called **once** at the start
3. `get_meta_model` — called **once** at the start (or once per fact sheet type if the query targets multiple specific types)
4. `search_users` — called **at most once** to resolve a person's name to a UUID when the query names a specific subscriber/owner/responsible
5. `read_inventory` — called to run a structured GraphQL query, and again for each pagination page
6. `vector_search` — called with a natural language query when the structured approach is insufficient

**No other tool calls are permitted.** Do NOT call `get_applications`, `text_to_fact_sheets`, `semantic_search`, `get_workspace_data_model`, or any other tool.

**Retry rule:** If `read_inventory` returns an error OR returns 0 results, generate a refined/broader query and retry at most **3 times**. Each retry must use a meaningfully different query. After 3 retries with 0 results, fall back to `vector_search` **only if** the query is about an abbreviated or partial name. Do NOT re-call `get_fact_sheet_types`, `get_all_fact_sheets_schema`, or `get_meta_model` — they return the same data every time.

---

## Step 0 — Load Workspace Context

Call `get_fact_sheet_types`, `get_all_fact_sheets_schema`, and `get_meta_model` in parallel.

From `get_fact_sheet_types`: record all fact sheet type names — these are the only valid `FactSheetTypes` facet keys.

From `get_all_fact_sheets_schema`: study the exact shape of `FilterInput`, valid `facetFilters` fields (`facetKey`, `operator`, `keys`, `dateFilter`, `subFilter`, `subscriptionFilter`), sort structure, and enum values.

From `get_meta_model`: for every fact sheet type, learn which fields and relations exist, their valid enum values, and which fields/relations have `inFacet: true` (these are the valid `facetKey` values for filtering and sorting). **Always use the field names and enum values from this response** — do not guess or use hardcoded values from your training data, as custom fields vary per workspace.

---

## Label Resolution

When the user mentions a concept name (e.g. "Tech Category", "Technology Stack"), resolve it by checking — in priority order:
1. Fact sheet type names from `get_fact_sheet_types`
2. Relation target type names from `get_meta_model`
3. Field names from `get_meta_model`

Prefer relation/type matches over similarly-named fields.

Example: "Tech Category" → TechnicalStack via `relITComponentToTechnologyStack` (relation), NOT `lxTechnologyAssessmentCategory` (field).

---

## Type Selection: "software" / "solutions" / "systems" Vocabulary

These words can map to multiple fact sheet types depending on workspace configuration:
- **ITComponent** (subtypes: Software, SaaS, IaaS, PaaS, Hardware, Services, AI Model) — technology/infrastructure layer
- **Application** — business function layer
- Possibly custom fact sheet types configured in the workspace

Resolution:
1. Check the fact sheet types returned by `get_fact_sheet_types` for this workspace
2. If only standard types exist → query **both** Application AND ITComponent for "software"/"solutions"/"systems"/"tools"
3. If a custom type matches the user's vocabulary → note the ambiguity and query the most likely type

---

## Step 1 — Write the allFactSheets GraphQL Query

### Required query rules

- Always include `id`, `displayName`, `type` in node selection.
- Always request `totalCount` and `pageInfo { hasNextPage endCursor }`.
- Always add `first: 50` (use `first: 200` for numeric/threshold queries).
- Always add `responseOptions: { maxFacetDepth: 5 }` to the filter root.
- Do NOT select `lifecycle` as a scalar — use `lifecycle { phases { phase startDate } }` or omit it.

### Inline filter default — always do this

```graphql
# CORRECT — filter always applied:
query FactSheetSearch($filter: FilterInput = { responseOptions: { maxFacetDepth: 5 }, facetFilters: [...] }) {
  allFactSheets(filter: $filter, first: 50) { ... }
}

# WRONG — filter is null at runtime:
query FactSheetSearch($filter: FilterInput) {
  allFactSheets(filter: $filter, first: 50) { ... }
}
```

**Exception**: if the filter needs `subFilter` or `subscriptionFilter` inside `facetFilters`, those cannot go in an inline default (causes `BadValueForDefaultArg`). Pass the filter as a literal in the query body instead — see filter-examples.md.

### Never use `types` in a default value

`types: ["Application"]` inside `$filter: FilterInput = {...}` causes `BadValueForDefaultArg`. Always use `facetFilters` with `facetKey: "FactSheetTypes"` instead.

---

### Filter decision tree — apply the FIRST matching rule

**1. Lifecycle phase** — plan / phasing out / end of life / retiring / decommissioning:

Always requires `dateFilter`. Examples in filter-examples.md.

```graphql
{ facetKey: "lifecycle", operator: OR, keys: ["phaseOut"], dateFilter: { type: TODAY } }
```

Valid keys: `"plan"`, `"phaseIn"`, `"active"`, `"phaseOut"`, `"endOfLife"`.
Valid `dateFilter.type`: `TODAY`, `END_OF_MONTH`, `END_OF_YEAR`, `RANGE`, `RANGE_STARTS`, `RANGE_ENDS`.
"Phasing out" → `"phaseOut"`. "End of life / decommissioned" → `"endOfLife"`.

**2. Approval / workflow state** — rejected / approved / draft:

```graphql
{ facetKey: "lxState", operator: OR, keys: ["REJECTED"] }
```

Valid: `"DRAFT"`, `"APPROVED"`, `"REJECTED"`, `"BROKEN_QUALITY_SEAL"`.
"Rejected by quality seal" → `["REJECTED"]` only (NOT `BROKEN_QUALITY_SEAL`).

**Archived / trash bin items** — use `TrashBin` facet key (NOT `lxState`):

```graphql
{ facetKey: "TrashBin", operator: OR, keys: ["archived"] }
```

This is the only way to reach archived items — `allFactSheets` never returns them without this filter.
User vocabulary: "trash", "trash bin", "deleted", "removed", "archived" → use `TrashBin` filter above.

**3. Subscription / ownership** — missing owner, has responsible, etc.:

```graphql
{ facetKey: "Subscriptions", operator: OR, keys: ["__missing__"], subscriptionFilter: { type: "RESPONSIBLE" } }
```

Valid `subscriptionFilter.type`: `"RESPONSIBLE"`, `"ACCOUNTABLE"`, `"OBSERVER"`.
Note: `facetKey` must be `"Subscriptions"` (capital S).

**Named-person subscription lookup** ("Frank Martin as responsible", "which apps does Kent Eisenberg own"):

The API cannot filter by display name — it requires a user UUID. **You have access to `search_users` to resolve names to UUIDs.** Apply this two-step approach:

1. Call `search_users` with the person's name extracted from the query (e.g. `query: "Frank Martin"`).
2. From the response, take the `userId` field (NOT the `id` field — they differ).
3. Build the `Subscriptions` facet filter using `keys: [userId]` and `subscriptionFilter: { type: "RESPONSIBLE" }` (or whichever role was mentioned).

```graphql
# "applications where Frank Martin is responsible":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        { facetKey: "Subscriptions", operator: OR, keys: ["<userId-from-search_users>"], subscriptionFilter: { type: "RESPONSIBLE" } }
      ]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

If `search_users` returns 0 results, report that the person was not found. If multiple users match, pick the closest name match. See `references/subscription-person-filter.md` for full examples.

If **no specific person** is mentioned (just "has responsible" / "missing accountable"), use `__missing__` or `NOR + __missing__` without calling `search_users`:
```graphql
# "applications missing a responsible":
{ facetKey: "Subscriptions", operator: OR, keys: ["__missing__"], subscriptionFilter: { type: "RESPONSIBLE" } }
# "applications that have a responsible":
{ facetKey: "Subscriptions", operator: NOR, keys: ["__missing__"], subscriptionFilter: { type: "RESPONSIBLE" } }
```

**4. Fact sheet type** — pick the type of the answer entity, not the subject:

```graphql
{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
```

"Which providers do we rely on?" → `ITComponent` (providers = ITComponents in LeanIX).

**5. Multi-hop / indirect relation** — FS related to another FS with a property:

Use `keys: []` on the parent relation facet + `subFilter`. Must pass as a literal (not inline default). Full examples in `references/multi-hop-filter.md`.

**Choose the right subFilter pattern based on what you are filtering on:**

**Before picking a pattern, ask: does the related FS have a filterable field for this property?**
- If YES (e.g. `strategicImportance`, `category`, `lifecycle`, a custom field visible in `get_meta_model`) → **Pattern B**
- If the property is a name/text string → **Pattern A**
- If no filterable field exists for the concept (e.g. "non-IT", "commodity" as a concept without a matching enum) → **this is a two-step negation limitation, see below** — do NOT attempt `fullTextSearch` on the concept word

*Pattern A — related FS matched by name/text* (`fullTextSearch` in subFilter):
```graphql
# "apps running on .NET" — ITComponent name contains ".NET":
{ facetKey: "relApplicationToITComponent", operator: OR, keys: [],
  subFilter: { facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] }], fullTextSearch: ".NET" } }
```
**Pattern A is for matching FS whose display name or description contains the search string.** Do NOT use Pattern A to filter by a business concept (e.g. `fullTextSearch: "IT"` to find "IT-related BCs") — this matches BC names containing the letters "IT", not BCs belonging to an IT domain.

*Pattern B — related FS matched by field value* (`facetFilters` with a field facet in subFilter):
```graphql
# "apps supporting non-commodity capabilities" — BC where strategicImportance = tier1|tier2:
{ facetKey: "relApplicationToBusinessCapability", operator: OR, keys: [],
  subFilter: { facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["BusinessCapability"] },
    { facetKey: "strategicImportance", operator: OR, keys: ["tier1", "tier2"] }
  ] } }

# "apps storing sensitive/confidential data" — DataObject where dataClassification = confidential|restricted:
{ facetKey: "relApplicationToDataObject", operator: OR, keys: [],
  subFilter: { facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["DataObject"] },
    { facetKey: "dataClassification", operator: OR, keys: ["confidential", "restricted"] }
  ] } }
```
**CRITICAL:** When filtering related FS by a field value (lifecycle phase, category, strategicImportance, dataClassification, etc.), ALWAYS use `subFilter.facetFilters` with the field facet key — **do NOT use `subFilter.fullTextSearch`** with the field value name. `fullTextSearch` matches text in names/descriptions, NOT field enum values.

**DataObject `dataClassification`** — valid enum values (verify from `get_meta_model`): `"public"`, `"internal"`, `"confidential"`, `"restricted"`. Queries like "sensitive data", "confidential data objects", "restricted data" should use Pattern B with these enum values, NOT `fullTextSearch: "sensitive"` / `"confidential"` / `"restricted"` on DataObject names.

*Pattern C — related FS matched by UUID* (`ids` in subFilter) — used for three-hop traversal:
```graphql
# "apps with interfaces using FTP technology" — three steps:
# Step 1: find FTP ITComponent UUID via read_inventory with fullTextSearch: "FTP" + FactSheetTypes: ITComponent
# Step 2a: find PROVIDER apps — apps that provide interfaces using FTP:
{ facetKey: "relProviderApplicationToInterface", operator: OR, keys: [],
  subFilter: { facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Interface"] },
    { facetKey: "relInterfaceToITComponent", operator: OR, keys: ["<ftp-itcomponent-uuid>"] }
  ] } }
# Step 2b: find CONSUMER apps — apps that consume interfaces using FTP (MUST also issue this call):
{ facetKey: "relConsumerApplicationToInterface", operator: OR, keys: [],
  subFilter: { facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Interface"] },
    { facetKey: "relInterfaceToITComponent", operator: OR, keys: ["<ftp-itcomponent-uuid>"] }
  ] } }
# Union results from Step 2a and Step 2b (deduplicate by id).
```
**IMPORTANT:** For App→Interface queries, you MUST issue **two** separate `read_inventory` calls — one for `relProviderApplicationToInterface` and one for `relConsumerApplicationToInterface` — then union the results. Querying only the provider side will miss all consumer apps.

When the query spans three fact sheet types (App → Interface → ITComponent, or Org → App → User), use this UUID-based pattern. Get the leaf UUID first via `read_inventory`, then wire it into the intermediate `subFilter.facetFilters`.

*Pattern D — related FS matched by lifecycle phase* (`lifecycle` facet with `dateFilter` in subFilter):
```graphql
# "apps with technology going out of life this year" — ITComponent lifecycle endOfLife in current year:
{ facetKey: "relApplicationToITComponent", operator: OR, keys: [],
  subFilter: { facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] },
    { facetKey: "lifecycle", operator: OR, keys: ["endOfLife"], dateFilter: { type: RANGE, from: "2026-01-01", to: "2026-12-31" } }
  ] } }
```
`dateFilter` is valid inside `subFilter.facetFilters` on the `lifecycle` facet, same as at the top level.

Standard relations for `Application`: `relApplicationToITComponent`, `relApplicationToUserGroup`, `relApplicationToBusinessCapability`, `relApplicationToBusinessContext`, `relApplicationToDataObject`, `relApplicationToInterface`, `relApplicationToProvider`, `relProviderApplicationToInterface`, `relConsumerApplicationToInterface`.

subFilter rules: one level deep (no `subFilter` inside a `subFilter`); only on relation facets; `subFilter.facetFilters` supports the same field and relation facet keys as top level; `dateFilter` valid on `lifecycle` inside `subFilter.facetFilters`; never combine `operator: NOR` with `subFilter`.

**Two-step negation is not possible in one query** ("apps for BCs that don't belong to IT", "software used in countries but not HQ country"): combining `subFilter` with `operator: NOR` is forbidden. When the concept has no filterable field (e.g. "non-IT BCs" — there is no `isIT` field on BusinessCapability), execute the **positive side** immediately and note the limitation. Do NOT attempt `subFilter.fullTextSearch` on the concept word as a workaround.

**Positive side** means: return all apps that have *any* relation of that type, without filtering the related FS:
```graphql
# "apps for BCs that don't belong to IT" — positive side only (all apps linked to any BC):
{ facetKey: "relApplicationToBusinessCapability", operator: OR, keys: [] }
```
Report: "Returning all applications linked to a Business Capability. Filtering to exclude IT-domain BCs is not possible in one query as the API does not support NOR with subFilter."

Do NOT loop trying to construct the negative side. Do NOT use `fullTextSearch` on the concept name (e.g. `fullTextSearch: "IT"`) — this matches BC display names containing those letters, not the intended domain.

**6. Missing relation (negation):**

```graphql
{ facetKey: "relApplicationToITComponent", operator: NOR, keys: [] }
```

`operator: NOR` must NOT have `subFilter`.

"Not used in any process" / "no relation to X" → use NOR on the relevant relation facet. Execute immediately.

**7. Sort / ordering:**

```graphql
sort: [{ facetKey: "displayName", order: asc }]
```

`facetKey` accepts any field or relation name where `inFacet` is `true` — verify from `get_meta_model` output. Valid `order` values: `asc`, `desc`.

**8. Date / creation / update year:**

Use `updatedAfter`, `updatedBefore`, `createdAfter`, `createdBefore` on the `FilterInput` root (not as facet keys).

**CRITICAL**: `updatedAfter`/`updatedBefore`/`createdAfter`/`createdBefore` **cannot** go in an inline default value — they cause `BadValueForDefaultArg`. Pass the filter as a literal in the query body instead:

```graphql
# CORRECT — date filter as literal in query body:
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["BusinessCapability"] }]
      updatedAfter: "2026-01-01"
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# WRONG — will cause BadValueForDefaultArg:
query FactSheetSearch($filter: FilterInput = { updatedAfter: "2026-01-01", ... }) { ... }
```

**9. Structured field facets** — prefer over `fullTextSearch`:

Common fields present in most workspaces (verify values from `get_meta_model`):
- `technicalSuitability` — e.g. `"inadequate"`, `"adequate"`, `"fullyAppropriate"`, `"unreasonable"`, `"__missing__"`
- `businessCriticality` — e.g. `"missionCritical"`, `"businessCritical"`, `"businessOperational"`, `"administrativeService"`
- `functionalSuitability` — e.g. `"unreasonable"`, `"inadequate"`, `"adequate"`, `"fullyAppropriate"`
- `category` — valid values differ per fact sheet type (e.g. `"process"` for BusinessContext, `"software"` for ITComponent). Always look up the correct values for the specific type from `get_meta_model`.

**Custom fields** (e.g. `lxSixRClassification`, `lxHostingType`, `projectStatus`) are workspace-specific — only use them if they appear in the `get_meta_model` response for that fact sheet type. Never hardcode field names or values from training data.

**10. UUID / exact ID lookup:**

`FilterInput` has an `ids` field — use it directly for UUID queries instead of `fullTextSearch`:

```graphql
query FactSheetSearch {
  allFactSheets(filter: { responseOptions: { maxFacetDepth: 5 }, ids: ["728926ed-e9aa-4ec2-b790-875e39792a58"] }, first: 1) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

`fullTextSearch` does NOT match on UUIDs — always use `ids: [...]` for UUID lookups.

**11. Text / keyword / name search:**

Two options — choose based on query intent:
- `fullTextSearch` — searches all text fields including descriptions; good for brand names, codes (e.g. "IF-K14"), exact names
- `quickSearch` — fuzzy name-only matching; good for partial names or approximate spellings

Both go **inside** `filter:{}`, not at the query root:

```graphql
# fullTextSearch — exact/brand name:
filter: { responseOptions: { maxFacetDepth: 5 }, facetFilters: [...], fullTextSearch: "Salesforce" }

# quickSearch — fuzzy name match:
filter: { responseOptions: { maxFacetDepth: 5 }, facetFilters: [...], quickSearch: "SAP Conc" }
```

Always combine with a `FactSheetTypes` facet filter to narrow results — without it, results span every type and inflate the result set. Do NOT use for lifecycle phases, lxState, negation, or numeric comparisons.

For **single-token code lookups** (e.g. "IF-K14", "APP-003") where the query is just an identifier with no other context, use `first: 1` — the correct fact sheet will be the top result.

**12. Lifecycle scope — always include all relevant types:**

"Planning to retire" / "phasing out" queries should include **all fact sheet types** that can have a lifecycle, not just Application. ITComponents, Interfaces, and other types also retire. Use multiple type keys:

```graphql
{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application", "ITComponent"] }
```

**13. Numeric/threshold queries** (completion %, TCO, maturity):

No numeric range filter exists. Sort ascending + large `first:` value and return all results. See filter-examples.md.

**Maturity level** — the facet key is `"maturityLevel"` with string keys `"1"`, `"2"`, `"3"`, `"4"`, `"5"`. If the API rejects it with `INVALID_FACET_KEY`, the workspace does not expose this facet — report that and return all fact sheets of that type sorted by name.

**Aggregation queries** ("providers relied on by more than 3 apps", "TCO greater than 100k"): no COUNT or GROUP BY exists. Fetch all items of the relevant type with `first: 200` and return the full list — note that filtering by count or numeric threshold requires post-processing. Execute immediately. Do NOT loop.

**14. Fallback:** combine type filter + `fullTextSearch` with most distinctive noun phrases.

**15. Intentionally empty relations (`naFields`):**

`naFields` filters for relations explicitly marked "Leave Empty on Purpose" (an intentional decision, distinct from just not being filled in). Use it when the user says "intentionally empty", "marked as N/A", "no IT component assigned on purpose", or "leave empty".

```graphql
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      naFields: ["relApplicationToITComponent"]
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Distinction from `__missing__`:
- `__missing__` = unfilled (unknown / neglected)
- `naFields` = intentionally empty (explicit "Leave Empty" decision by a user)

**Queries that cannot be answered with available tools — report immediately, do NOT retry:**

- **Calculated/derived metrics**: Fields computed on the fly by backend services (e.g. aggregated obsolescence risk, technology risk scores) are not stored on fact sheets and not filterable. Report: "This metric is calculated dynamically and is not available as a filterable fact sheet field."
- **`category` as a process indicator**: `category` is a single-select field whose valid values differ per fact sheet type. For `BusinessContext`, `category` can be `"process"` — but querying "used in a process" means filtering by `BusinessContext` fact sheets where `category = "process"`, then finding Applications related to them via `subFilter`. This is a multi-hop query; use `relApplicationToBusinessContext` with a `subFilter` on `category`.

### Do NOT

- Invent facet keys — only use names confirmed for the specific fact sheet type by `get_meta_model`.
- Use `createdAt`/`updatedAt` as a `facetKey` — use `createdAfter`/`updatedAfter` on the root instead.
- Use `responseOptions` inside a `facetFilters` entry.
- Combine `operator: NOR` with `subFilter`.
- Use `displayName` as a `FilterInput` field — use `fullTextSearch` or `quickSearch`.
- Use `types: [...]` in an inline default value.
- Omit `dateFilter` from a lifecycle facet filter.
- Use `facetKey: "subscriptions"` (lowercase) — must be `"Subscriptions"` (capital S).
- Use `fullTextSearch` for UUID lookups — use `ids: [...]` instead.
- Use `fullTextSearch` or `quickSearch` without a `FactSheetTypes` filter — always narrow by type to avoid over-retrieval.
- Re-call `get_fact_sheet_types` or `get_meta_model` after Step 0.
- Use enum values not confirmed by `get_meta_model` — they are case-sensitive and fail silently.
- Hardcode role IDs for subscription filters — they are workspace-specific UUIDs; always read from `get_meta_model`.
- Use `factSheetType` param and `facetFilters[FactSheetTypes]` together — they are mutually exclusive; use one or the other.
- Put `quickSearch` or `fullTextSearch` at the query root — they belong inside `filter: {}`.

### See also

- `references/filter-examples.md` — complete query templates for each filter pattern
- `references/multi-hop-filter.md` — subFilter pattern reference (A: name, B: field value, C: UUID/three-hop, D: lifecycle, E: org→app→user)
- `references/subscription-person-filter.md` — named-person subscription lookup (search_users → userId → Subscriptions filter)

---

## Step 2 — Execute and Paginate

Call `read_inventory` with your query string.

**Paginate when the user asks for ALL items** ("all", "list all", "how many", "which ones", threshold queries like "below 40%"): add `after: "<endCursor>"` on each subsequent call and accumulate results until `hasNextPage` is `false`.

If `read_inventory` returns an error: read it, fix only the query, retry up to 3 times.

---

## Step 3 — Present the Results

```
## Results for: "<user query>"

<Direct answer in 1–2 sentences.>

### Fact Sheets Found (<count> total)

| Name | Type |
|---|---|
| <displayName> | <type> |
```

- **Populate `results` with ALL retrieved fact sheets** — every ID from every pagination page (GraphQL) or from the `data` array (vector search).
- For vector search results, `displayName` is in `fields.displayName` and `type` is in `fields.type`.
- Table may be truncated to 20 rows for readability.
- If 0 results: say so and suggest a broader filter or try vector search.
- Do NOT show the generated query unless the user asks for it.
