# Relation aggregation

Load for grouped counts, thresholds, rankings, or target-side predicates over relation chains: providers used by more than N applications, capabilities supported by an application set, most critical provider, or apps linked to capabilities with a classification.

**Execution:** use `mcp__leanix__execute_code`; resolve group/target IDs, confirm relation keys from context/filterOptions, fetch one/two hops, join/dedupe in code, aggregate by the requested grouping entity, and return only the requested answer type. **Pagination shape:** when paginating a large source type, select only `id` plus the relation-edge fields needed for the join (relation connection with target `factSheet { id }` and any edge fields used for filtering); do not select `displayName` or `type` on every paginated row. Fetch display fields for the final answer rows only, using a targeted `filter.ids` query after joining/deduping. For large workspaces, prefer a two-phase approach: identify candidate groups/targets first, then refine with chunked joins rather than paginating every source and bridge edge in one pass.

## `paginate()` contract

Every query passed to `paginate()` **must** select these three things on `allFactSheets`:

```
totalCount
pageInfo { hasNextPage endCursor }
edges { node { id ... } }
```

Omitting `totalCount` or `pageInfo { hasNextPage endCursor }` causes an immediate runtime error:
`"paginate needs the query to select totalCount and pageInfo { hasNextPage endCursor }; add them and retry."`

Return shape: `{ items, totalCount, pages, complete }` — `complete` is `true` when `items.length >= totalCount`.

Optional third argument `{ maxPages: N }` caps the number of pages fetched (useful for probes or bounded traversals). Example: `await paginate(query, {}, { maxPages: 1 })` fetches only the first page.

## Relation-count semantics

When counting relations, first decide which count the user asks for; the same relation can answer different questions:

| User asks | Source / target setup | Count to return |
|---|---|---|
| "how many X per Y" / grouped by target | source type = X, relation = X→Y, target type = Y | per-target counts from the relation facet/filterOptions, excluding `__missing__`/`__empty__` |
| "how many X have a Y" / coverage | source type = X, relation = X→Y | source count with relation present; use `NOR keys:["__missing__"]` or a confirmed has-relation shape |
| "how many X are missing Y" | source type = X, relation = X→Y | source count with `keys:["__missing__"]` |
| "how many X are explicitly not applicable / intentionally empty" | source type = X, relation = X→Y | source count with confirmed `__empty__` / `naFields` representation |

Relation facet option counts can answer grouped/count-only questions without fetching every source row. For final row lists, fetch the requested answer type and dedupe by fact-sheet ID.

## Relation field predicates

Relation filters have two distinct parts:

| Predicate lives on | Shape |
|---|---|
| Related target identity | relation facet `facetKey:"relXToY"`, `keys:[targetIds]` |
| Relation edge field such as support/fit/status | confirmed relation field filter or select relation edges and filter in code |
| Target fact-sheet field/tag/classification | target-first query for Y, then relation facet from X to the resulting target IDs |

Do not put enum values, tag IDs, or classification values into a relation facet unless they are actual related fact-sheet IDs for that relation.

## Application to Business Capability support aggregation

For questions like "business capabilities supported by <application set>", confirm the source is `Application`, the target is `BusinessCapability`, and the relation is the workspace's Application→BusinessCapability relation. Support predicates are often relation-edge fields such as `supportType`, not Application fields.

Workflow:
1. Resolve/filter the Application set.
2. Select relation edges with confirmed edge fields and target `factSheet`.
3. Filter non-qualifying edges client-side when relation field filter syntax is unclear.
4. Dedupe target capabilities by ID and optionally count Applications per capability.

## Applications by target-side capability classification

For "apps supporting non-commodity/strategic capabilities", the predicate belongs to related BusinessCapabilities, not Application text. Resolve qualifying capability rows first using the confirmed field, tag, or classification model, then fetch Applications related to those capability IDs. Do not fall back to semantic Application search when a target-side relation traversal is required.

If the classification is not exposed as a BusinessCapability field/facet, check tags or classification-like tag groups for the target type. When subFilter syntax for target fields fails or is unavailable, use a two-step traversal: paginate qualifying targets, chunk their IDs into the source relation facet, and dedupe source rows.

## Provider/application aggregation

For "providers supplying applications", first check direct Application→Provider service/supplier/vendor relations. Treat Application→ITComponent→Provider as a technology dependency path; report separately or union only when the user asks for all dependency paths.

For "providers we rely on for more than N applications" where wording implies technology dependency, count unique Applications reached through Provider ← ITComponent ← Application. Final grouped counts should dedupe Application IDs; relation facet option counts are only hints. In `mcp__leanix__execute_code`, use the injected `paginate(query, variables)` helper with a `$after` variable; avoid manually interpolating cursor strings into GraphQL because it often creates malformed queries.

For large workspaces, avoid fetching every source and bridge edge in one pass. Use a two-phase approach: identify candidate Providers or groups first, then refine top candidates with chunked joins.

For redundancy or consolidation questions such as "multiple databases" or "integration platforms", use target-first category aggregation instead of scanning every Application with all ITComponent edges. Resolve the technology category/taxonomy targets from `TechnicalStack`/category names or confirmed tag/facet options, fetch ITComponent IDs in those categories, then fetch Applications related to those ITComponent IDs in chunks. Aggregate by Application and by shared ITComponent, cap examples, and return `{categoryCounts, sharedComponentsTop, complete, results}`. If the final row set is large, keep raw edge dumps inside `mcp__leanix__execute_code` and return only top-N candidates plus omitted counts.

## Provider criticality ranking

"Most critical provider" can mean explicit provider classification, dependency footprint, or critical linked applications. Confirm available Provider fields and Application/ITComponent criticality fields before scoring. Return a transparent heuristic with direct app count, indirect app count, deduped app count, explicit classification, score, and caveats.

## Field name collisions

Some names exist both as top-level fields and relation-edge fields, for example `functionalSuitability`. If the user says the entity "has" the value, prefer the top-level field. If the wording is about fit/support "for" a related object, use the relation-edge field in that relation scope.

## Minimal target-side classification shape

```text
qualifyingTargets = BusinessCapabilities where confirmed field/tag/classification means non-commodity/strategic
sourceRows = Applications related to qualifyingTargets through the confirmed Application→BusinessCapability relation
results = dedupe(sourceRows)
return { targetCount: qualifyingTargets.length, count: results.length, results }
```

Compact outside-hierarchy-target shape:

```js
const excludedRoot = "Resolved Root";
const capabilitiesQ = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["BusinessCapability"]}]}){totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}}} }`;
const { items: capabilities } = await paginate(capabilitiesQ, {});
const excludedPrefix = `${excludedRoot} /`;
const targetIds = capabilities
  .filter((capability) => capability.displayName !== excludedRoot && !(capability.displayName || "").startsWith(excludedPrefix))
  .map((capability) => capability.id);
const query = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"relApplicationToBusinessCapability", operator:OR, keys:${JSON.stringify(targetIds)}}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items: results, complete } = targetIds.length ? await paginate(query, {}) : { items: [], complete: true };
return { excludedRoot, targetCount: targetIds.length, complete, results };
```

## Minimal provider threshold shape

```text
providers = Provider rows
componentsByProvider = ITComponents grouped by relITComponentToProvider
appsByComponent = Applications grouped by relApplicationToITComponent
appsByProvider = provider -> dedupe(apps linked to any provider component)
results = providers where appsByProvider[provider].size > threshold
```

Compact multi-hop aggregation shape. Keep the queries multi-line and balanced; relation connection rows expose the related fact sheet under `edge.node.factSheet`.

```js
const providersQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Provider"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type}}
  }
}`;
const componentsQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["ITComponent"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{
      node{
        id displayName type
        ... on ITComponent{
          relITComponentToProvider{
            edges{node{factSheet{id displayName type}}}
          }
        }
      }
    }
  }
}`;
const appsQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{
      node{
        id displayName type
        ... on Application{
          relApplicationToITComponent{
            edges{node{factSheet{id displayName type}}}
          }
        }
      }
    }
  }
}`;
const [{ items: providers }, { items: components }, { items: apps }] = await Promise.all([
  paginate(providersQ, {}),
  paginate(componentsQ, {}),
  paginate(appsQ, {}),
]);
const providerToComponents = new Map(providers.map((provider) => [provider.id, new Set()]));
for (const component of components) {
  for (const edge of component.relITComponentToProvider?.edges || []) {
    const providerId = edge.node?.factSheet?.id;
    if (providerId) providerToComponents.get(providerId)?.add(component.id);
  }
}
const componentToApps = new Map();
for (const app of apps) {
  for (const edge of app.relApplicationToITComponent?.edges || []) {
    const componentId = edge.node?.factSheet?.id;
    if (!componentId) continue;
    if (!componentToApps.has(componentId)) componentToApps.set(componentId, new Set());
    componentToApps.get(componentId).add(app.id);
  }
}
const threshold = 3;
const results = providers.map((provider) => {
  const appIds = new Set();
  for (const componentId of providerToComponents.get(provider.id) || []) {
    for (const appId of componentToApps.get(componentId) || []) appIds.add(appId);
  }
  return { provider, applicationCount: appIds.size };
}).filter((row) => row.applicationCount > threshold);
return { threshold, results: results.map((row) => ({ factSheetId: row.provider.id, displayName: row.provider.displayName, type: row.provider.type, applicationCount: row.applicationCount })) };
```
