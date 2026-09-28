# Name and semantic search

Load for abbreviated/partial names, feature questions, broad concepts, or meaning-based questions where the user describes what something does rather than naming an exact fact sheet.

**Execution:** use direct `mcp__leanix__filter_inventory` for simple exact/abbreviation name lookup. Feature, category, and broad-concept questions are not simple name lookups: use `mcp__leanix__execute_code` to inspect evidence fields, combine probes/pages, verify semantic candidates, expand through relations, and dedupe.

## Abbreviations and partial names

- Expand token-wise while preserving acronyms (`mgmt` → `Management`; "ac mgmt" → "AC Management", not "Account Management").
- For short abbreviations (1–3 tokens, no type qualifier from the user), start with a single `mcp__leanix__search_inventory` call on the expanded form and filter the results to the plausible answer types. Escalate to multi-probe `mcp__leanix__execute_code` only when `mcp__leanix__search_inventory` returns zero results or when the question explicitly spans several unrelated types. Multi-probe `mcp__leanix__execute_code` across all types tends to over-retrieve — it surfaces type matches that fit the token but not the user's intent.
- Try `quickSearch` or `fullTextSearch` on the expanded form with inventory query/search tools. Tool-catalog search finds tools, not fact sheets. Never call `mcp__leanix__search_mcp_tools` for abbreviations, fragments, or as a no-op/mandatory step; if the exact inventory tool schema is already known or loaded, proceed directly with inventory search.
- For bare name/code fragments where the user did not name a type, include likely name-bearing types such as Interface in addition to Application/ITComponent.
- For UUIDs, use structured `ids` lookup instead of text or semantic search.

## Semantic search discipline

Semantic rows are candidates, not final proof for lifecycle, ownership, geography, taxonomy, broad concepts, or relation claims. Verify candidates with structured inventory data before final answering. Support count or search rank alone is weak evidence, but semantic discovery can surface product names whose fields do not repeat the user phrase. Before returning broad-concept rows, fetch/inspect evidence fields such as name, alias, description, category/product fields, or confirmed relations; keep product-name candidates when repeated probes or relation evidence tie them to the concept. Semantic top hits alone are suitable only when the user explicitly asks for candidate suggestions.

For broad concepts such as a product category, feature, acronym, or business capability:

If the workspace has no exact field/facet/tag/relation for the user's concept but you answer using a confirmed proxy, state the interpretation in the first sentence, for example `Interpreting "outdated" as Lifecycle = End of Life...` or `Using the Productivity technical-stack relation as the proxy...`; otherwise ask a concise clarification.

1. Search/verify every requested answer type when the wording could mean more than one type.
2. Include both semantic discovery (`mcp__leanix__search_inventory`) and focused full-text probes when the concept may be represented by product/vendor names that do not contain the user phrase; full-text alone under-recovers product-name concepts.
3. Keep rows with direct evidence in name, alias, description, product/category fields, or confirmed relations. If the retrieval query selected only `id/displayName/type`, hydrate or re-query candidate rows with evidence fields before final filtering.
4. Treat vendor-family names and adjacent business terms as weak evidence. They can discover candidates, but final rows need their own field evidence or a confirmed category/relation for the requested concept.
5. For acronym/category questions, require the standalone acronym, the full expanded phrase, a confirmed category/relation, or strong product evidence for that category in inspected fields. Individual words from the expansion are not enough evidence by themselves (for example "customer" alone does not prove a CRM category). A full-text hit alone is not enough if the selected evidence fields do not expose the concept. For singular "Which <category/acronym>" questions, return the strongest exact category/acronym matches in `results`; mention weaker adjacent candidates only in the answer/caveat.
6. If relation-derived candidates are relevant, confirm the relation path from context and dedupe final answer rows.
7. For broad concepts, run multiple user-meaning-preserving probes and keep rows with repeated or direct evidence.

## Feature phrases

Feature phrases may live in description or add-on text, not display name. Start with structured Application `fullTextSearch` for the feature phrase/noun and include searchable evidence fields when schema allows. If the first query selected only `id/displayName/type`, preserve full-text ranking or fetch descriptions for top candidates; rank by feature evidence instead of display name alone.

When the user asks whether a feature exists or asks for a "<feature> app", description or add-on evidence can satisfy the feature even when the application is broader than a dedicated/named product. Select description/evidence fields before rejecting a result because its display name is broader. For singular yes/no feature-app questions, return the strongest verified feature candidate(s) in `results`; keep weak adjacent candidates (planning, tracking, generic task/event tools, or low-score semantic neighbours) in the answer/caveat rather than final rows. If no candidate exposes field-level feature evidence but semantic discovery repeatedly identifies one plausible Application/ITComponent, return the single strongest semantic candidate with a caveat instead of answering zero. Keep archive/trash rows only for archive-scoped questions; use `tags-and-archive.md` for those searches.

## Broad concept expansion

Use a small set of user-meaning-preserving probes only when needed: synonyms, product category wording, sub-capability wording, or domain vocabulary. Product-family probes should come from the user wording or live workspace evidence. Keep enough context words in derived probes so generic neighbouring concepts do not flood the answer. For domain automation/category wording, include direct phrase probes plus domain-specific task/channel probes that are part of the concept (for example campaign/email/newsletter/journey/lead wording for marketing automation), then verify final rows by evidence or relation expansion. For "<concept> apps and IT components", use one compact `mcp__leanix__execute_code` workflow to union both answer types across multiple probes and pages. Keep final rows in the requested types. After finding strong concept seed Applications/ITComponents, follow confirmed Application↔ITComponent relations and include related rows when their name/description shares the product/application evidence or the relation clearly represents the supporting/hosting component for a concept seed. Related components can qualify through relation evidence even when they do not repeat the full concept phrase in their own description.

```text
probes = [user phrase, phrase + "application", phrase + "IT component", key synonyms]
semanticCandidates = union(mcp__leanix__search_inventory(probe) for probe in probes)
structuredCandidates = union(fullTextSearch probes over requested types)
results = dedupe rows with direct evidence or repeated probe support, in requested types only
```

Compact `mcp__leanix__execute_code` shape for broad concepts:

```js
const probes = ["user phrase", "user phrase application", "domain synonym"];
const semantic = [];
for (const probe of probes) {
  const response = await call_tool("mcp__leanix__search_inventory", { query: probe });
  semantic.push(...response.data.results); // mcp__leanix__search_inventory shape is data.results
}
const query = `query Search($after:String, $q:String!){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    fullTextSearch:$q
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application","ITComponent"]}]
  }) {
    totalCount pageInfo { hasNextPage endCursor }
    edges { node { id displayName type ... on Application { alias description } ... on ITComponent { alias description } } }
  }
}`;
const structured = [];
for (const probe of probes) {
  const { items } = await paginate(query, { q: probe });
  structured.push(...items);
}
return { results: [] }; // replace with compact deduped/evidence-filtered rows
```

When the user asks for both Applications and ITComponents, expand from strong seeds through the confirmed Application↔ITComponent relation:

```js
// after strongSeedIds are known, fetch their Application↔ITComponent edges
// include related rows when relation evidence shows hosting/supporting/implementation
// or the related row shares the product/application family evidence in name/description
// relation evidence can qualify related components even without repeating the full phrase
return { seedCount: 0, expandedCount: 0, results: [] };
```

## Provider/vendor candidate expansion

If semantic search returns an ITComponent tied to a Provider, verify by Provider/ITComponent/Application relations. Expand Applications from direct semantic ITComponent seeds only through a confirmed relation chain; see `exact-name-and-brand-resolution.md` for vendor/product workflows.
