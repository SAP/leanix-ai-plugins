---
name: fact-sheet-search
description: >-
  Always activate before inventory/search/list/count questions about LeanIX fact
  sheets: search, filter, count, aggregate, list, UUID lookup, lifecycle/state,
  ownership, relations, tags, dates, geography, hierarchy, providers, or
  cross-relation questions. Prefer this fact-sheet workflow for bare UUIDs
  unless the user explicitly names another object type such as diagram or
  report.
license: Apache-2.0
compatibility: Requires LeanIX MCP server for API access (mcp__leanix__* tools)
metadata:
  author: SAP LeanIX
  version: "1.0"
allowed-tools:
  - mcp__leanix__get_workspace_context
  - mcp__leanix__filter_inventory
  - mcp__leanix__search_inventory
  - mcp__leanix__search_users
  - mcp__leanix__execute_code
---

## Scope

This skill routes fact-sheet questions. Tool mechanics belong to tool descriptions; workflow details belong to the reference files. Treat every type, relation, field, facet, enum, tag, role, and example key here or in references as an example shape until it is confirmed in the current workspace. For each answer, bind the actual workspace keys from `mcp__leanix__get_workspace_context`, targeted tool results, or GraphQL introspection before building GraphQL. Semantic search is candidate discovery only; for broad concept routing rows, load the focused reference and verify candidates structurally before answering.

Retrieval tools for this workflow are `mcp__leanix__get_workspace_context`, `mcp__leanix__filter_inventory`, `mcp__leanix__search_inventory`, `mcp__leanix__search_users`, `mcp__leanix__execute_code`, and `load_leanix_skill_reference`. This skill already names the retrieval tools. If a retrieval tool is directly available, call it directly; if it is hidden, load its schema by exact name. Do not call `mcp__leanix__search_mcp_tools` in this workflow: it searches for tools, not inventory data. Do not use it to rediscover these known retrieval tools or to look up fact-sheet names, concepts, data objects, users, fields, lifecycle, ownership, or geography. Never satisfy a mandatory/safeguard/no-op step by calling `mcp__leanix__search_mcp_tools` with queries like "noop", "irrelevant", or "mandatory tool call"; skip that step and continue with the exact workflow tool. Avoid deprecated inventory shortcuts.

## API Access

> Before any LeanIX tool call: if only `mcp__leanix__authenticate` and `mcp__leanix__complete_authentication` are available, tell the user to run `/mcp` and authenticate the `leanix` server (browser opens automatically). Do NOT call `authenticate` yourself or suggest `claude mcp add` — the former returns a URL without triggering the browser flow (copy-paste UX), the latter would shadow the plugin's bundled server. If `/mcp` doesn't surface tools after auth, treat it as a plugin bug.

## Tool availability & fallback

- **`mcp__leanix__execute_code` fallback** — when a workflow calls for `mcp__leanix__execute_code` (toolset `code_execution`) but it errors as unavailable, answer with one or more `mcp__leanix__filter_inventory` calls instead: push every predicate server-side as facet filters (`FactSheetTypes`, relation facets with target `keys`, lifecycle/tag/enum facets); for grouped counts use a `filterOptions` `first:0` probe; for relations go target-first (resolve target IDs, then filter the source by relation facet `keys:[targetIds]`); chunk IDs across sequential calls when one `filter.ids` call is too large. If the answer genuinely needs in-memory joins, dedupe, or ranking across many pages that server-side facets cannot express, return the best server-side approximation with a short `limitation` note rather than presenting partial data as `complete`.
- **Required tool not available** — if a tool a question needs errors as unavailable and cannot be loaded by exact name, do not guess or fabricate. State plainly that the required tool(s) are not enabled, name them exactly, and recommend enabling the owning toolset (e.g. "The required tool `mcp__leanix__execute_code` (toolset `code_execution`) is not enabled in this session; ask your workspace admin to enable it, then retry."). For `mcp__leanix__execute_code`, apply the fallback above first and surface this only when the fallback cannot fully answer. If all `inventory` retrieval tools are missing, state the inventory workflow cannot run and name the `inventory` toolset plus tools.

## Default flow

1. For plain UUID, exact code/name, type-only, count-only, or one confirmed simple facet, run the narrow `mcp__leanix__filter_inventory` path directly — do not load any reference first. Exception: if the user names a lifecycle/status phase in natural language (`active`, `plan`/`planning`, `phase in`, `phase out`, `end of life`, `retired`, `sunset`), load `lifecycle-state.md` before querying because current vs historical phase semantics matter.
2. For non-trivial questions, get focused workspace context before loading references.
3. Use that context and the routing table to choose the workflow, final answer type, and any bridge/target types.
4. When the question matches a routing row, load every listed focused reference before executing the workflow. If multiple references are listed, call `load_leanix_skill_reference` once for each reference filename. Do not shortcut routed hierarchy, geography, broad-concept, archive, or relation-date questions with a single text page.
5. Execute using the selected reference guidance and the relevant tool descriptions.

## Execution essentials

- Exact UUID / fact sheet ID input is a structured ID lookup: use `mcp__leanix__filter_inventory` with top-level `filter.ids`; do not use semantic search for UUIDs. Short codes, abbreviations, or fragments such as `IF-K14` are not UUIDs: search them as names/text with the plausible fact sheet types.
- Load focused references for routed complex workflows, but skip references for plain UUID, exact-name/code lookup, type-only listing, and one confirmed simple facet. A named product/technology inside a relation question ("applications use/run on/depend on X") is not a simple name lookup: resolve the exact target and traverse relations with `exact-name-and-brand-resolution.md`. More broadly, skip the reference when you can already identify a single `mcp__leanix__filter_inventory` query that directly answers the question using only standard sentinels or facets confirmed by `mcp__leanix__get_workspace_context` — the reference is only needed when the workflow requires non-obvious traversal, multi-step logic, or workspace key discovery beyond what context already provides.
- `mcp__leanix__search_inventory` discovers candidates only and accepts only `{query}`. Constrained final rows need structured verification by `mcp__leanix__filter_inventory` or `mcp__leanix__execute_code`. Feature/category/concept listings across multiple answer types are routed complex workflows; load `name-and-semantic-search.md` and verify evidence rather than using one direct full-text page as the final answer.
- Use direct `mcp__leanix__filter_inventory` when a server-side query can return the requested rows or exact count in one page; if the full answer fits in ≤2 sequential `mcp__leanix__filter_inventory` calls, use `mcp__leanix__filter_inventory` directly without `mcp__leanix__execute_code`. Use `mcp__leanix__execute_code` when the answer needs pagination loops over more than one page, joins, relation traversal, edge dates, grouping, ranking, dedupe, set operations not expressible as server-side facets, or calculations. Do not wrap a single `mcp__leanix__filter_inventory` query inside `mcp__leanix__execute_code` just to format the result. For analytical queries — field-presence checks, lifecycle aggregations, missing-field counts, or any query whose intent is "which fact sheets are missing/have X" — always construct the most specific server-side facet combination first; do not start with a full-type scan and filter in code. Before starting a full paginated scan, run a `first:0 totalCount` probe to estimate workspace size. A large `totalCount` is not a reason to decline the query or defer to the user; it signals that `mcp__leanix__execute_code` with grouping or pagination is needed. If `totalCount` exceeds 200, apply the tightest possible server-side facet filters first — never paginate the full workspace just to filter in code when a server-side filter would reduce the set beforehand. After an `"An unexpected error occurred"` server response, narrow the facet filter or reduce `first` before retrying; never retry the same payload unchanged. **`paginate()` contract** — every query passed to `paginate()` must select `totalCount` and `pageInfo { hasNextPage endCursor }` on `allFactSheets`, plus `edges { node { id ... } }`; omitting either of the first two causes a runtime error (`"paginate needs the query to select totalCount and pageInfo { hasNextPage endCursor }"`). Use the optional `{ maxPages }` argument to cap expensive traversals.
- **`filterOptions` probe** — `filterOptions` is a GraphQL response field on `allFactSheets` that returns every available facet key and its enumerated values for the current filter. Use it to discover workspace-specific keys you cannot safely guess. Request shape (use `first:0` so no rows are fetched): `query { allFactSheets(first:0, filter:{ responseOptions:{maxFacetDepth:5} facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["<Type>"]}] }) { filterOptions{ facets{ facetKey results{ key name count } } } } }`. Two triggers: (1) **proactive** — before building a query that depends on a workspace-specific facet key you have not yet confirmed (tag-group UUID, custom field enum, service-level facet); (2) **reactive** — after one validation error on a guessed field, run a focused probe instead of retrying with renamed guesses. Tag filtering always requires the confirmed key from this probe or from `mcp__leanix__get_workspace_context`: usually the tag-group UUID or `_TAGS_` for ungrouped tags — never the literal string `"tags"`.
- **Schema SDL for node field selection** — when a query will select any type-specific field on a fact-sheet node — any field beyond the five `BaseFactSheet` scalars (`id`, `displayName`, `type`, `createdAt`, `updatedAt`), including relation fields, custom `lx*` fields, or any field under a relation edge's `node` — set `include_schema=true` on the **initial** `mcp__leanix__get_workspace_context` call. Do not guess field names or relation field names from naming conventions or from facet key names; facet keys and GraphQL node field names are not interchangeable — the same relation has different names in each context, and both must be confirmed from the SDL. Do not make a separate schema-only round trip; include it in the initial call. Omit `include_schema=true` only for simple name/UUID lookups, count-only queries, or facet/filter-only queries where no node fields beyond the five base scalars are selected. The schema SDL is a live, pruned GraphQL SDL listing every selectable field on every type reachable from `allFactSheets` — including `BaseFactSheet`, lifecycle phase types, and `Subscription`. Reactively: after any `FieldUndefined` validation error, if `mcp__leanix__get_workspace_context` was not already called with `include_schema=true`, call it with `include_schema=true` (omit `include_tags`/`include_meta_model` if not needed) and retry once with the confirmed field name; do not guess renamed variants. After any `WrongType` or `UnknownArgument` validation error on a subscription filter argument, introspect `__type(name:"SubscriptionFilterInput")` before retrying. See `mcp__leanix__filter_inventory` description for always-invalid argument-placement patterns.
- For facet/enum distributions, preserve the confirmed `filterOptions.results.key` or exact workspace `name`; do not invent friendlier spellings, hyphenation, translations, or category names. If reporting missing/unset values, label them separately as `Not set` or `Not classified`, not as a new category/subtype.
- Keep result identity tied to the requested answer type. When traversing via an intermediate node, return the answer fact sheet's own `factSheetId`.

## Workflow invariants

Use these invariants for routed complex workflows; they are generic checks, not workspace-specific rules:

- If a reference describes building multiple branches or sets, complete that workflow in one compact `mcp__leanix__execute_code` orchestration before final answering. This means one sandbox that can make several narrow paged/chunked `mcp__leanix__filter_inventory` calls, not one giant GraphQL request. Do not treat the first successful-looking branch as final when other modeled branches are part of the workflow. The snippet should discover branch keys, paginate/chunk, combine sets, and return `{branchCounts, complete, results}` or `{complete:false, limitation}`.
- A zero result from one plausible branch is not final when the reference names other confirmed branches. Try the alternative confirmed branch, or return a limitation with the branch that was verified.
- Relation facet keys expect related fact-sheet IDs. Enum keys, classification values, tag IDs, or labels are not relation target IDs; confirm the actual key with a `filterOptions` probe (see Execution essentials) before using it as a relation facet value.
- Prefer facet-filter traversal for relations — target IDs as `keys` on the relation `facetKey` — it avoids edge-shape errors and cuts steps. Only select relation-edge subfields when facet keys are unavailable; when you must, the target fact sheet is under `edges { node { factSheet { id displayName type } } }` — selecting `displayName`/`type` directly on a relation edge's `node` is always invalid. After resolving a candidate set (a place, domain, or named target), intersect it with the remaining predicate facets in one `mcp__leanix__execute_code` orchestration rather than re-probing full-text search.
- For hierarchy names with qualifiers, resolve all matching leaves/branches and return all deduped parents or children; do not stop at the first text-search hit.
- For exact product, technology, taxonomy, archive, geography, and relation-date workflows, fix the precise path or state the limitation. Do not substitute a broad semantic/text candidate as final evidence.
- After a complete compact `mcp__leanix__execute_code` returns non-empty rows or a clear limitation, do not rerun the same workflow with small query variations. Retry only after a concrete validation error, timeout, or missing schema shape, and then first narrow the GraphQL shape with a targeted `filterOptions` probe or introspection (see Execution essentials) before retrying.
- Keep GraphQL and final payloads small: select IDs/names/types plus only evidence fields needed for the predicate; return counts, capped samples, omitted counts, and `complete` instead of large raw edge dumps.
- In `mcp__leanix__execute_code` pagination loops, select only `id` (plus the minimum fields needed to evaluate the predicate) during the accumulation phase. Do not accumulate full node payloads — on large workspaces a full-field paginated scan multiplies context cost by page count. After filtering the matched IDs in code, fetch display fields (`displayName`, `type`, evidence fields) for the matched subset only, using a targeted `filter.ids` query. Pattern: paginate IDs → filter in code → fetch fields for matched set.

## Final answer policy

For "which", "list", "find", "give me", or "do we have" fact-sheet questions, prefer compact-but-complete answers over asking the user to narrow immediately. For estate-overview or technology-landscape questions (the user asks *what X do we have for domain Y*, not *list every X individually*), a large result count is not a deferral signal — group by vendor, category, or type in `mcp__leanix__execute_code` and return a structured summary instead of asking the user to narrow down. If a requested concept is not a confirmed workspace field, facet, tag, relation, or lifecycle state, label any rows as candidates/proxy results or ask a concise clarification instead of presenting them as the exact requested set; when you use a proxy, start with the interpretation, for example `Interpreting "outdated" as Lifecycle = End of Life...`. If a tool or `mcp__leanix__execute_code` result already has a `results` array with `factSheetId`, pass those rows through unchanged; do not cap, reconstruct, or manually retype UUIDs. If you compose the rows yourself, list all rows when the set is reasonably sized (roughly 200 rows or fewer) using only `displayName`, `type`, and optionally `factSheetId`. For explicit full-set prompts such as "list every", "list all", "complete list", "enumerate every", or "show me every", do not ask the user to narrow and do not stop after a count; paginate or use `mcp__leanix__execute_code` and return the full list when it is at or below this size. For larger sets, return the exact count, a representative or first-N list, `omittedCount`, `complete`, and the filtering interpretation used. Avoid verbose row details unless the user asks for detail. When `mcp__leanix__execute_code` returns a `results` array, cap it at 200 rows before the final return — for larger sets return `{count, complete, omittedCount, results: first200Rows}`. Never return raw paginated pages or full field dumps as the final value; the final value re-enters model context and inflates it for every subsequent step.

## Reference routing

| Load when… | Typical shape | References |
|---|---|---|
| Abbreviation, partial name, meaning/feature search | abbreviated term, named feature, product category | `name-and-semantic-search.md` |
| Geography, region, country, HQ exclusion, common software across places | used in a named region, common in Country A and Country B, not at headquarters | `geography-and-usage.md` |
| Place + business/function/product concept | what does a country use for a named function, which category/acronym is used in a region; include BusinessCapability/Process as bridge types when functions/domains are named | `geography-and-usage.md`, `name-and-semantic-search.md` |
| Applications related to capabilities with target-side classification | apps supporting non-commodity/strategic capabilities, capabilities with maturity/importance | `relation-aggregation.md` |
| Organizational domain hierarchy/exclusion | BCs outside IT; apps for non-IT capabilities | `hierarchy-lookup.md`, `relation-aggregation.md` |
| Technology/product/acronym under taxonomy/category | class/acronym/product falls under named category, "which X under Y category", "which CRM falls under Marketing & Advertising" | `technology-category-filter.md` |
| Lifecycle, obsolescence risk, or workflow state | plan/planning stage, currently active, phasing out, end of life, unaddressed obsolescence risk, rejected, broken quality seal | `lifecycle-state.md` |
| Tags or archive/trash | tagged Global, archived, in trash bin | `tags-and-archive.md` |
| Ownership/responsible subscriptions | my apps, apps owned by person | `subscription-ownership.md` |
| Organization/place ownership | applications owned by headquarters / org / region | `subscription-ownership.md`, `geography-and-usage.md` |
| Missing/present/empty relations or fields | without IT components, intentionally empty process relation, known not used, without tech fit | `relation-presence-and-empty.md` |
| Missing mandatory fields | required attributes/subscriptions/relations/tags, country-scoped apps missing mandatory fields | `relation-presence-and-empty.md`; add geography/subscription/tag references when the question adds that scope |
| Numeric/completion/timestamps/ranking/service level | lowest completion, created in year, updated in year, cost/TCO threshold, highest service level, SLA tier; use `mcp__leanix__execute_code` for thresholds unless a confirmed facet answers it | `completion-and-ranking.md` |
| Hierarchy root/parent/children/subtree/level | parent organization of X in a region/branch, all levels, immediate children, parent in qualifier, level-N tech categories | `hierarchy-lookup.md` |
| Relation edge dates | active/valid on date, applications support named capability/function since year, IT components linked to area as of date | `relation-edge-dates.md` |
| Aggregation over relation chains | providers relied on by N applications, groups with more than N related rows | `relation-aggregation.md` |
| Data object/classification traversal | invoice/customer/personal/sensitive data used by apps | `data-object-traversal.md`, `name-and-semantic-search.md` |
| Provider/vendor dependency | applications dependent on abbreviated company (like IBM), apps using a vendor/provider | `exact-name-and-brand-resolution.md`, `relation-aggregation.md` |
| Product/technology/interface chains | named runtime/database/product, interfaces with named protocol technology | `exact-name-and-brand-resolution.md` |
| Projects/initiatives around a product or vendor | projects around named product/vendor, initiatives for named platform | `exact-name-and-brand-resolution.md` |

## Common term mapping

| User term | Interpret as |
|---|---|
| apps / applications | `Application` |
| software / solutions / systems / tools | Application + ITComponent unless narrowed |
| business concept in a geography | usually Application answer with geo intersection; include BusinessCapability/Process bridge types for named functions/domains |
| technology class as taxonomy/component question | ITComponent or taxonomy type confirmed from context |
| providers / vendors | `Provider` when configured |
| mission critical / crown jewel / enterprise critical | discover workspace criticality-like field/facet/relation field and state selected key; prefer direct application/business criticality over granular derived classifications unless the user names the latter |
| business unit / department / organization / team | discover Organization/UserGroup/FunctionalUserGroup/BusinessCapability/tag modeling; report ambiguity |
| cloud-first / SaaS-preferred / target architecture fit | discover the workspace hosting/deployment model first; it may be an Application field, relation field, tag group, provider/platform relation, or ITComponent category |
| data quality score | confirmed numeric quality metric or explicitly stated `completion.percentage` proxy; not categorical `DataQuality` |
| Provider/vendor dependency | exact Provider identity plus direct and indirect relation paths when configured |
| capabilities | `BusinessCapability` |
| process(es) | process/business-context type confirmed from workspace context |
| initiatives / projects | `Initiative` by default; confirm Project/Initiative/transformation types from workspace context when needed |
| Tech Category / Technology Stack | taxonomy/stack type confirmed from context |
| applications support a named capability/function since/valid on a date | Application answer + BusinessCapability/Process target; evaluate relation edge dates |
| IT Components linked/related to a named technical area with active/valid relation date | ITComponent answer + TechnicalStack/taxonomy target unless the user explicitly says BusinessCapability or Organization |
| data object / sensitive data | data-object relation plus classification field |
| missing relation | missing sentinel from context/tool docs |
| intentionally empty relation | empty sentinel from context/tool docs |
| rejected based on quality seal / quality seal rejected | workflow state `lxState=REJECTED` only; not `BROKEN_QUALITY_SEAL` |
| broken quality seal / broken seal | workflow state `lxState=BROKEN_QUALITY_SEAL` when accepted; not rejected approval and not averageable data quality |
| unaddressed obsolescence risk | prefer confirmed aggregate risk facet; otherwise compute Application→ITComponent risk/lifecycle/status from `lifecycle-state.md` |
