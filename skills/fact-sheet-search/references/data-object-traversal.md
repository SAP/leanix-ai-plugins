# Data-object traversal

Load for invoice/customer/personal/sensitive/confidential data used by applications.

Confirm answer type, bridge types, relation keys, and edge fields from workspace context. Resolve named targets to verified IDs before traversal. Use `mcp__leanix__execute_code`; fetch one or two relation hops at a time and join by IDs in JavaScript. Return compact requested answer-type rows. Data terms such as invoice/customer/sensitive are workspace data: resolve DataObject/Application rows with inventory query/search tools, not tool-catalog search.

## Workflow

1. Confirm answer type, bridge types, relation keys, and edge fields from workspace context.
2. Resolve named targets to verified `{ id, displayName, type }` rows before traversal.
3. Pick relation keys from the resolved target **type**, not from words in the name.
4. Resolve target names against the type the wording implies. Concrete products/technologies are usually `ITComponent` targets; technology areas/categories/stacks are usually the workspace taxonomy/stack type (often `TechnicalStack`). Do not use Organization or BusinessCapability unless the user explicitly says organization, location, capability, or process.
5. Fetch one or two relation hops at a time; join deeper chains by IDs in code.
6. When the predicate depends on fields of related fact sheets or relation edge fields/dates/statuses, select those rows/edges and evaluate the predicate in JavaScript. Use source-side facet/subFilter shortcuts only when workspace context confirms the exact shape.
7. Return only requested answer-type rows; keep bridge rows for explanation only.
8. After one complete paginated relation traversal returns the requested rows, stop and answer; do not repeat the same traversal unless the previous call had a concrete tool error or incomplete read.

### Data-object classification

For sensitive, confidential, personal, or named data questions, resolve/filter DataObject rows by the configured classification/name fields first, then traverse the Application↔DataObject relation. For broad "sensitive data objects", inspect the classification facet/options and include every configured non-public/non-empty option whose key or label means sensitive, confidential, personal, critical, restricted, private, or protected; do not use only the literal key `sensitive` unless context/filterOptions shows it is the sole matching value. Prefer fetching Applications through the confirmed Application→DataObject relation facet with the resolved DataObject IDs; reverse DataObject edges can be incomplete or shaped differently. Classification enum keys such as `sensitive` or `confidential` are not relation target IDs and must not be used as `relApplicationToDataObject` keys. Use `paginate` for both DataObjects and Applications; a one-page `call_tool("mcp__leanix__filter_inventory")` under-returns. Final Application results require a confirmed Application↔DataObject relation. If the DataObject exists but the relation traversal returns zero Applications, answer zero; do not run an Application text/semantic fallback and do not return Applications whose name/description merely mentions the data term unless the user explicitly asks for text matches.

Compact DataObject-to-Application shape:

```js
const classificationFacet = "dataClassification"; // replace with confirmed facet if different
const meaning = /sensitive|confidential|restricted|personal|private|protected|critical/i;
const optionsQ = `query {
  allFactSheets(first:0, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["DataObject"]}]
  }){
    filterOptions{facets{facetKey results{key name count}}}
  }
}`;
const optionsRes = await call_tool("mcp__leanix__filter_inventory", { query: optionsQ });
const facets = optionsRes.data.allFactSheets.filterOptions.facets || [];
const classificationKeys = (facets.find((facet) => facet.facetKey === classificationFacet)?.results || [])
  .filter((option) => option.count > 0 && meaning.test(`${option.key} ${option.name || ""}`))
  .map((option) => option.key);
if (!classificationKeys.length) return { classificationFacet, results: [] };

const dataObjectQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[
      {facetKey:"FactSheetTypes", operator:OR, keys:["DataObject"]},
      {facetKey:"${classificationFacet}", operator:OR, keys:${JSON.stringify(classificationKeys)}}
    ]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type}}
  }
}`;
const dataObjects = await paginate(dataObjectQ, {});
const dataObjectIds = dataObjects.items.map((row) => row.id);
if (!dataObjectIds.length) return { classificationKeys, results: [] };

const appQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[
      {facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},
      {facetKey:"relApplicationToDataObject", operator:OR, keys:${JSON.stringify(dataObjectIds)}}
    ]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type}}
  }
}`;
const apps = await paginate(appQ, {});
return { classificationKeys, dataObjectCount: dataObjects.totalCount, complete: apps.complete, results: apps.items.map((app) => ({ factSheetId: app.id, displayName: app.displayName, type: app.type })) };
```

## Zero-result rule

A confirmed typed relation/facet query returning zero is meaningful. Do not replace it with unrelated semantic search results. Retry only when context shows a different relation key, type, or edge field should have been used.
