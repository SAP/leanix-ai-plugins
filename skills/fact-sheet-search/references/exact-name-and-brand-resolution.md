# Exact name and brand resolution

Load when the query names a specific multi-token product, a bare brand across types, asks what is dependent on / runs on a vendor or technology, or requires resolving a name to UUIDs before relation traversal.

**Execution:** use `mcp__leanix__execute_code` for multi-step resolve/traverse/dedupe. Use direct `mcp__leanix__filter_inventory` only when the final exact lookup fits in one call.

Confirm candidate types and traversal relation keys through workspace context. Product and vendor models differ by workspace. Resolve names with small `mcp__leanix__filter_inventory` queries, then traverse relations with normal GraphQL.

## Multi-token names

A multi-token `fullTextSearch` can over-return on broad brand tokens. Resolve candidates first, then post-filter by the full phrase in order before traversal. If the exact phrase is itself an Application and no matching ITComponent/product is modeled, returning that Application may be correct.

## Bare brand or proper name across types

For a bare brand or proper name, search across configured name-bearing types: Application, ITComponent, Interface, Provider, Platform/TechnicalStack where present. Dedupe by ID. Do not restrict to Application/ITComponent unless the user did.

## Named providers and vendor aliases

For Provider questions, resolve identity before traversal:

1. Search Provider for exact display/leaf name. Legal names may be modeled as canonical short names (`SAP` rather than `SAP SE`).
2. If no exact Provider exists, use a nearest alias only when live candidates clearly support it and state that interpretation.
3. Do not automatically union sub-branded Providers unless the user asks for the broader brand ecosystem.
4. Check both direct Application→Provider and indirect Application→ITComponent→Provider paths when configured.
5. Return separate direct, indirect, and deduped counts; final `results` should contain only the requested answer type.

## Vendor or technology dependency

A bare vendor/technology name match on Applications can miss relation-linked apps. For bare vendor/provider questions, resolve Provider/ITComponent UUIDs, find ITComponents linked to Providers, then find Applications linked to those ITComponents. For a specific multi-token product, first prefer exact full-phrase Application and ITComponent/product matches; use broad Provider expansion only if the user asks for the vendor ecosystem or no exact product/application rows exist.

For broad technology brands/classes, resolve concrete technology/product fact sheets, usually `ITComponent`, before relation traversal. Use only user-meaning-preserving spelling variants; reject broad token neighbours whose own display/description does not support the requested term.

## Brand-to-project/initiative questions

For "projects/initiatives around BRAND", first confirm which planning fact-sheet types exist in the workspace (`Project`, `Initiative`, transformation types, or equivalents). Final rows must be the configured planning type(s), not intermediate Applications or ITComponents. Prefer the structured chain exact brand/product targets → related Applications → related Project/Initiative rows when those relations exist. Also run a focused Project/Initiative name/description search for the brand/product and merge verified rows; do not repeat broad vendor-family searches if exact product targets were already resolved. Semantic search may discover candidates but must be verified by Project/Initiative name/description/relations.

## Do not broad-fallback after precision failure

If an exact product/entity, hierarchy subtree, date-valid relation, archive state, or geography intersection fails, fix the precise path or report the limitation. Never substitute an unfiltered relation set or semantic top hit.

## Minimal vendor dependency shape

```text
vendorHits = exact/leaf matches across Provider, ITComponent, Application
providerIds = Provider hits only for a bare vendor/provider interpretation
providerComponentIds = ITComponents related to providerIds, only for that vendor/provider interpretation
namedComponentIds = ITComponent hits whose own name/description supports the full vendor/product phrase
componentIds = dedupe(providerComponentIds ∪ namedComponentIds)
appsByRelation = Applications related to componentIds
appsByName = Application hits whose own name supports the vendor/product
results = dedupe(appsByRelation ∪ appsByName)
```

## Product, technology, and interface chains

Product/technology traversals are one resolve-and-traverse workflow: resolve exact targets, chunk target IDs into confirmed relation facets, fetch the requested answer type, dedupe, and cap. Do not run one traversal per candidate type or broaden to provider/vendor-family expansion unless the user asked for a vendor ecosystem or no exact product/application target exists.

For "applications using/running on PRODUCT/TECHNOLOGY", resolve the full named product/technology across Application, ITComponent, Provider, Product, and taxonomy types where configured. Prefer exact full-phrase targets: exact display name, alias, external ID, or exact leaf/path segment. If text search returns many related components for a named product, do not union the whole family; use exact targets first and only widen with a caveat when no exact target exists. If the exact phrase is itself an Application, include that Application in Application answers. If exact Application rows exist and no exact same-phrase ITComponent/product target exists, prefer those exact Application rows rather than broadening to the vendor family. Use Provider expansion only for bare vendor/provider questions or when the user asks for all applications dependent on a vendor ecosystem. Then traverse confirmed product/technology relations and dedupe.

Compact product-to-application shape:

```js
const phrase = "Exact Product Name";
const phraseLower = phrase.toLowerCase();
const resolveQ = `query($after:String, $q:String!){ allFactSheets(first:50, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  fullTextSearch:$q}){totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}}} }`;
const { items: candidates } = await paginate(resolveQ, { q: phrase }, { maxPages: 1 });
const components = candidates.filter((row) => row.type === "ITComponent" && (row.displayName || "").toLowerCase().includes(phraseLower));
const directApps = candidates.filter((row) => row.type === "Application" && (row.displayName || "").toLowerCase().includes(phraseLower));
const componentIds = components.map((component) => component.id);
const appQ = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"relApplicationToITComponent", operator:OR, keys:${JSON.stringify(componentIds)}}]}){totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}}} }`;
const relatedApps = componentIds.length ? (await paginate(appQ, {})).items : [];
const results = [...new Map([...directApps, ...relatedApps].map((row) => [row.id, row])).values()];
return { product: phrase, componentCount: components.length, results };
```

For technology lifecycle questions, use ITComponent usage lifecycle (`lifecycle`) unless the user explicitly says vendor support lifecycle. Filter ITComponents first, chunk their IDs into the Application→ITComponent relation, and return Applications only.

For interface technology questions, resolve the protocol/technology target, fetch Interfaces related to it, then return provider/consumer Applications as requested. First check whether the protocol is modeled as an Interface field/facet/enum; if so, filter Interfaces by that confirmed key. Otherwise resolve the protocol as an ITComponent/technology target and use the confirmed Interface→technology relation. Keep direct Application→Provider supplier links separate from indirect Application→ITComponent→Provider technology dependency unless the user asks for all dependency paths. Inside `mcp__leanix__execute_code`, nested GraphQL calls go through `call_tool("mcp__leanix__filter_inventory", {query, variables})`; do not call a non-existent `graphql` tool.

The facet keys used in `facetFilters` (e.g. `relProviderApplicationToInterface`) are not the same as GraphQL node field names for edge traversal in `mcp__leanix__execute_code`. For node-field names, always confirm from `mcp__leanix__get_workspace_context(include_schema=true)` — do not assume they match the facet key names.

**Provider/consumer union — NEVER put both relation keys as separate `facetFilters` entries.** Multiple `facetFilters` entries are combined with AND, so `[{facetKey:"relProviderApplicationToInterface",...},{facetKey:"relConsumerApplicationToInterface",...}]` returns only applications that are simultaneously a provider AND a consumer — almost none. Always run two separate queries (one per relation facet) and dedupe the union in code, as shown below.

Compact interface technology shape:

```js
const protocol = "named protocol or technology";
const techIds = ["resolved-technology-id"];
const ifaceQ = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Interface"]},{facetKey:"relInterfaceToITComponent", operator:OR, keys:${JSON.stringify(techIds)}}]}){totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}}} }`;
const interfaces = (await paginate(ifaceQ, {})).items;
const interfaceIds = interfaces.map((row) => row.id);
const appByInterface = (relation) => `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"${relation}", operator:OR, keys:${JSON.stringify(interfaceIds)}}]}){totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}}} }`;
const providers = interfaceIds.length ? (await paginate(appByInterface("relProviderApplicationToInterface"), {})).items : [];
const consumers = interfaceIds.length ? (await paginate(appByInterface("relConsumerApplicationToInterface"), {})).items : [];
return { protocol, interfaceCount: interfaces.length, results: [...new Map([...providers, ...consumers].map((row) => [row.id, row])).values()] };
```
