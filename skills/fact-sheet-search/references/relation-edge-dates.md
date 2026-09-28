# Relation edge dates

Load when relation predicates depend on `activeFrom` / `activeUntil`, including active/valid on a date, valid until a date, or support since a date.

**Execution:** use `mcp__leanix__execute_code`; resolve target IDs, confirm relation keys from context and, when useful, confirm edge shape with targeted introspection, fetch one/two hops, evaluate edge dates in code, dedupe, and return only the requested answer type. Keep it as one orchestration with narrow target-first searches and paged/chunked source reads; do not follow a failed target type with several full source scans. **Pagination shape:** when paginating the source type (e.g. all ITComponents or all Applications), select only `id` plus the relation connection with `activeFrom`, `activeUntil`, and target `factSheet { id }` — do not include `displayName` or `type` in the paginate loop. After filtering matched IDs in code, fetch display fields for the matched subset via a `filter.ids` query.

Named technical areas are usually taxonomy/TechnicalStack targets, not ITComponents. Include the answer type and likely named target type in the initial workspace context.

## Date semantics

Relation dates live on the relation edge, not on the fact sheet. Active/valid on a date means:

```js
const activeOn = (edge, date) => (!edge.activeFrom || edge.activeFrom <= date) && (!edge.activeUntil || edge.activeUntil >= date);
```

Unbounded edges count as active. "Since 2025 only" usually means `activeFrom >= 2025-01-01` plus still active unless the user says historical.

## Workflow

1. Resolve the named target fact sheet(s) using the target type confirmed by context/reference wording. If the wording names a business capability/process/function, search that target type first; if it names a technical area/taxonomy, search TechnicalStack/taxonomy first. Do not mix target families unless context or the user wording supports both.
2. Paginate the answer type selecting the relation edge field, `activeFrom`, `activeUntil`, and `factSheet { id displayName type }`. Prefer the Pathfinder connection shape `relation { edges { node { activeFrom activeUntil factSheet { id displayName type } } } }`. Targeted `__type` introspection is fine when the edge/connection shape is uncertain or after a shape error; it should answer a specific GraphQL-shape question, not replace workspace meta-model semantics. If the first shape is wrong, repair the edge shape once; do not drop the date predicate or return all related rows.
3. Filter edges by target ID and date predicate in JavaScript.
4. Return deduped answer rows only; include target count and completeness.

For relation validity questions, do not filter by lifecycle date facets; lifecycle dates are fact-sheet state, not relation-edge validity.

## Technical area targets

For ITComponent relation-date questions, named technical areas are usually TechnicalStack/taxonomy targets unless the user explicitly says Business Capability or Organization. Resolve the target with structured TechnicalStack search first. If text search returns no exact target, paginate the full TechnicalStack/taxonomy type and match the requested phrase against the leaf and path segments. Prefer exact normalized phrase/segment equality before broader matching: a multi-word phrase means that exact leaf or path segment, not every target containing one token from the phrase. Accept leaf/path-segment matches such as `Category / Named Technical Area`; do not require the whole `displayName` to equal the phrase. `since YEAR only` means `activeFrom` starts within that calendar year; `valid until DATE` normally means `activeUntil` equals that date unless the user says valid through/after.

```text
technicalAreaIds = TechnicalStack rows where leaf(displayName) == phrase OR path segment == phrase
itComponents = paginate ITComponent rows with relITComponentToTechnologyStack edge dates
results = ITComponents whose relation target id is in technicalAreaIds and activeOn(edge, date)
```

Compact `mcp__leanix__execute_code` shape for ITComponents linked to a technical area valid until a date. Replace the relation key with the confirmed ITComponent→taxonomy relation from context when different:

```js
const phrase = "Named Technical Area";
const until = "2027-12-31";
const relation = "relITComponentToTechnologyStack";
const norm = (s) => (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const segments = (name) => (name || "").split("/").map((part) => norm(part)).filter(Boolean);
const targetMatch = (name) => segments(name).some((segment) => segment === norm(phrase));
const stackQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["TechnicalStack"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type}}
  }
}`;
const targets = (await paginate(stackQ, {})).items.filter((row) => targetMatch(row.displayName));
const targetIds = new Set(targets.map((row) => row.id));
if (!targetIds.size) return { phrase, targetCount: 0, results: [] };
const componentQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["ITComponent"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type ... on ITComponent{${relation}{edges{node{activeFrom activeUntil factSheet{id displayName type}}}}}}}
  }
}`;
const components = (await paginate(componentQ, {})).items;
const results = [];
for (const component of components) {
  const edges = component[relation]?.edges || [];
  if (edges.some((edge) => targetIds.has(edge.node?.factSheet?.id) && edge.node?.activeUntil === until)) {
    results.push({ factSheetId: component.id, displayName: component.displayName, type: component.type });
  }
}
return { phrase, until, targetCount: targetIds.size, results };
```

Compact shape for "Applications support CAPABILITY since YEAR only". Resolve the Capability/Process target first, then traverse the confirmed Application→target edges; do not search Applications by the capability phrase and hope relation edges appear on text hits. If the first target type has no exact/segment match, check the other business target type once (for example Process vs BusinessCapability) before returning zero; do not switch to TechnicalStack for business capability wording.

```js
const capabilityPhrase = "Named Capability";
const year = "2025";
const from = `${year}-01-01`;
const to = `${year}-12-31`;
const relation = "relApplicationToBusinessCapability";
const norm = (s) => (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const segments = (name) => (name || "").split("/").map((part) => norm(part)).filter(Boolean);
const targetMatch = (name) => segments(name).some((segment) => segment === norm(capabilityPhrase));
const capabilityQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["BusinessCapability"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type}}
  }
}`;
const targets = (await paginate(capabilityQ, {})).items.filter((row) => targetMatch(row.displayName));
const targetIds = new Set(targets.map((row) => row.id));
if (!targetIds.size) return { capabilityPhrase, targetCount: 0, results: [] };
const appQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type ... on Application{${relation}{edges{node{activeFrom activeUntil factSheet{id displayName type}}}}}}}
  }
}`;
const apps = (await paginate(appQ, {})).items;
const results = [];
for (const app of apps) {
  const edges = app[relation]?.edges || [];
  if (edges.some((edge) => targetIds.has(edge.node?.factSheet?.id) && edge.node?.activeFrom >= from && edge.node?.activeFrom <= to && (!edge.node?.activeUntil || edge.node.activeUntil >= from))) {
    results.push({ factSheetId: app.id, displayName: app.displayName, type: app.type });
  }
}
return { capabilityPhrase, year, targetCount: targetIds.size, results };
```
