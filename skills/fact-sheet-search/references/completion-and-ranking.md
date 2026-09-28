# Completion and ranking

Load for completion percentages, lowest/highest-N rankings, numeric thresholds, created/updated year filters, service level/SLA tier, or data-quality-score wording.

**Execution:** use one self-contained `mcp__leanix__execute_code` orchestration; values are usually calculated, ranked, or filtered client-side after pagination. One orchestration may make multiple narrow paged/chunked `mcp__leanix__filter_inventory` calls. Put metric discovery/selection, pagination/chunking, comparison/ranking, and final `results` in one snippet where possible; repeated snippets for the same metric usually add cost without improving evidence. Do not translate this into one giant GraphQL query that selects every relation and edge field at once. **Pagination shape:** during the accumulation loop select only `id` plus the predicate field(s) needed for comparison/ranking; do not include `displayName`, `type`, or relation edges in the paginate query. After filtering the matched IDs in code, fetch display fields for the matched subset only via a targeted `filter.ids` query — this bounds context cost to the matched set regardless of workspace size.

Confirm the answer type and field from workspace context/filterOptions. Common/base fields such as `completion { percentage }`, `createdAt`, and `updatedAt` can be selected without type-specific fragments; custom numeric fields usually need an inline fragment.

## Completion and numeric fields

- Completion shape is usually `completion { percentage }` where percentage is `0..100`.
- For lowest/highest N, paginate the answer type, read the score field, sort in JavaScript, and return N rows.
- For thresholds such as below 40% or named metric > 100k, paginate, read the numeric/scalar field, and compare in JavaScript. Do not try unsupported server-side range or `GT` facet syntax unless context/filterOptions confirms it.
- For entity-level numeric wording, first discover fields/facets on the answer type whose key/label matches the user's metric. Prefer direct fields on the answer type. Use relation-edge numeric fields only when the user asks about that relation or when the workspace clearly models the requested metric only on that edge. Match the metric label/key exactly enough to avoid adjacent proxies: a request for total cost of ownership/TCO should use fields labeled total cost of ownership/TCO, not merely total annual cost, run cost, provider cost, or any numeric cost field.
- If only adjacent proxy fields exist for the requested metric, return a compact caveat with proxy field names and sample candidates rather than a final `results` list that pretends the proxy is the requested metric.
- For average/aggregate scores, return exact count, scored count, average/min/max, `complete`, and a small sample only.

## Metadata timestamps

`createdAt` and `updatedAt` are node fields, not lifecycle facets. Filter ISO timestamp prefixes in JavaScript for year/month/day questions. Do not use `fullTextSearch` for dates.

## Service level / SLA ranking

For "highest service level" or SLA tier questions, do not assume a relation-edge field named `serviceLevel`. First identify how the workspace models ordered service level:

1. service-level/SLA tag group or tag facet,
2. Application field,
3. relation-edge field,
4. related fact-sheet field.

If tag context was not loaded, the initial focused context should include tags for service-level/SLA wording. Use relation-edge `serviceLevel` only when context/filterOptions confirms that field and non-empty values on the relevant relation. Rank by the discovered order and return every row in the highest tier when reasonably sized.

## Data quality score wording

Users may mean completion, quality seal, or a custom quality metric. Verify the workspace model before averaging:

- Prefer a confirmed numeric score field.
- Use `completion.percentage` as a proxy only when stated explicitly.
- Categorical facets such as `DataQuality`, quality-seal state, or workflow status are not averageable numeric scores.
- If several plausible score fields exist, return the selected metric and compact cross-checks rather than a single uncaveated number.

## Minimal ranking shapes

```text
lowest completion: paginate answer type -> read completion.percentage -> sort ascending -> take N
numeric threshold: discover/select metric field -> paginate answer type -> compare numeric value in code
created in year: paginate answer type -> keep createdAt startsWith("YYYY-")
updated in year: paginate answer type -> keep updatedAt startsWith("YYYY-")
highest service level: discover ordered SLA/service-level model -> keep rows in highest populated tier
```

Compact numeric threshold shape for a direct field (ID-first: accumulate only `id` + metric, fetch display fields for matched set):

```js
const threshold = 100000;
const metricField = "confirmedMetricField"; // from workspace context/filterOptions
// Phase 1: paginate IDs + metric field only
const idQuery = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id ... on Application{${metricField}}}} } }`;
const { items, complete } = await paginate(idQuery, {});
// Phase 2: filter matched IDs in code
const matchedIds = items
  .filter((row) => typeof row[metricField] === "number" && row[metricField] > threshold)
  .map((row) => row.id);
if (!matchedIds.length) return { metricField, threshold, count: 0, complete, results: [] };
// Phase 3: fetch display fields only for matched set (small query regardless of workspace size)
const displayRes = await call_tool("mcp__leanix__filter_inventory", { query:
  `query($ids:[ID!]!){ allFactSheets(first:200, filter:{ids:$ids}){
    edges{node{id displayName type}} } }`, variables: { ids: matchedIds } });
const results = (displayRes.data.allFactSheets.edges || []).map((e) => ({ factSheetId: e.node.id, displayName: e.node.displayName, type: e.node.type }));
return { metricField, threshold, count: results.length, complete, results };
```

Compact relation-edge threshold fallback when context confirms the metric is modeled only on relation edges. Replace relation and metric constants with keys confirmed from context/filterOptions; do not copy placeholder names literally:

```js
const threshold = 100000;
const relation = "confirmedRelationKey";
const metricField = "confirmedRelationEdgeMetricField";
const query = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]}]}){
  totalCount pageInfo{hasNextPage endCursor}
  edges{node{id displayName type ... on Application{
    ${relation}{edges{node{${metricField} factSheet{id displayName type}}}}
  }}} } }`;
const { items, complete } = await paginate(query, {});
const results = [];
for (const app of items) {
  const values = (app[relation]?.edges || [])
    .map((edge) => edge.node?.[metricField])
    .filter((value) => typeof value === "number");
  if (values.some((value) => value > threshold)) results.push({ factSheetId: app.id, displayName: app.displayName, type: app.type });
}
return { relation, metricField, threshold, complete, count: results.length, results };
```

Compact highest service-level shape for a confirmed facet/tag model:

```js
const serviceFacetKey = "confirmedServiceLevelFacetKey";
const preferredOrder = ["platinum", "gold", "silver", "bronze", "high", "medium", "low"];
const optionsQ = `query { allFactSheets(first:0, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]}]}){
  filterOptions{facets{facetKey results{key name count}}} } }`;
const options = (await call_tool("mcp__leanix__filter_inventory", { query: optionsQ })).data.allFactSheets.filterOptions.facets.find((facet) => facet.facetKey === serviceFacetKey)?.results || [];
const ranked = options
  .map((option) => ({ ...option, rank: preferredOrder.findIndex((label) => String(option.name || option.key).toLowerCase().includes(label)) }))
  .filter((option) => option.count > 0 && option.rank >= 0)
  .sort((a, b) => a.rank - b.rank);
const top = ranked[0];
if (!top) return { serviceFacetKey, results: [] };
const query = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"${serviceFacetKey}", operator:OR, keys:["${top.key}"]}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items, complete } = await paginate(query, {});
return { serviceFacetKey, topServiceLevel: top.name || top.key, complete, results: items.map((row) => ({ factSheetId: row.id, displayName: row.displayName, type: row.type })) };
```

## Strategic scoring / portfolio reduction

For portfolio-reduction, rationalization, strategic-fit, or cost/value ranking, treat the answer as a transparent heuristic unless the workspace exposes an official score. `mcp__leanix__execute_code` is the right tool for large scans and manipulation, but design the scan as staged/chunked GraphQL plus in-sandbox joins rather than one monolithic query that asks the API to materialize every relation and edge field at once. Build focused branches and combine compact evidence:

1. lifecycle branches (`endOfLife`, `phaseOut`, date windows),
2. rationalization/action/status fields if exposed,
3. criticality / business value / functional and technical fit,
4. cost fields, preferring exact TCO labels; relation-edge cost only as a stated proxy,
5. redundancy signals from relation aggregation, successors, or same target capability/component clusters,
6. strategic-fit signals such as hosting/model/tag fields when confirmed.

If a full all-relation scoring query times out, keep using `mcp__leanix__execute_code` but chunk it: fetch candidate IDs by branch, page relation edges per chunk, join/dedupe/rank inside the sandbox, and return only the aggregate/top-N. If the API still cannot complete a branch, return complete counts for branches that did complete plus a capped scored sample and `complete:false` for the global ranking. Do not rerun the same full scoring query with minor variations; narrow by branch/chunk or state the limitation.

## Stale review / updated windows

`updatedAt` and review-date fields are node/scalar fields, not `FilterInput` date filters. For "not reviewed or updated in the last 12 months", discover the review-date field if present, then paginate sorted rows and compare `updatedAt`/review dates in code; stop paging once sort order proves remaining rows cannot match.

For broad "which Fact Sheets" stale-data questions in large workspaces, do not repeatedly run one all-type pagination if it times out. Split by fact sheet type or return a compact limitation with checked types, cutoff date, sample stale rows, and `complete:false`. If the user asks for an exact complete list across all types and the API cannot server-side filter `updatedAt`/review date, state that limitation rather than retrying the same scan.
