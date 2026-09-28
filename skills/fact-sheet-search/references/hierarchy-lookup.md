# Hierarchy lookup decision tree

Load for parent lookup, immediate children, level-N nodes, subtree including the root, "all levels of X", or "level-N categories under a named root".

**Execution:** use `mcp__leanix__execute_code` for name resolution plus subtree/level filtering. Direct `mcp__leanix__filter_inventory` is acceptable only when a confirmed hierarchy facet/relation answers the question in one page, such as workspace-wide top-level/root nodes. **Pagination shape:** when paginating the full hierarchy type to resolve roots or walk paths, select only `id` and `displayName` (needed for path segment matching) — do not select relation edges or type-specific fields in the paginate loop. Fetch additional fields only for the final answer rows via a `filter.ids` query.

Confirm hierarchy type, level facet/key, and parent relation from workspace context/filterOptions. Standard hierarchy relation edges usually expose the target under `edges { node { factSheet { id displayName type } } }`; selecting `displayName` directly on the relation edge is invalid.

## Decision tree

| User asks for… | Method |
|---|---|
| Parent of X / "what is X under" | Resolve all plausible X candidates → fetch common parent relation (`relToParent` unless context says otherwise) |
| Immediate children of X | Resolve parent by exact leaf/path segment → return rows whose slash path is exactly `parent / child`, or use confirmed parent relation |
| Subtree under root including root | Resolve root by exact leaf/path segment → paginate hierarchy type → keep root plus rows whose full path starts with root path |
| Level-N nodes workspace-wide | Use confirmed `hierarchyLevel = "N"` when available |
| Level-N under named root | Resolve root path segment, stripping hierarchy type-label words from the root phrase → paginate type → keep depth N and root path prefix/segment match |
| All levels of named root | One traversal over the hierarchy type; collect root/path-prefix descendants |
| Deeper than immediate children | Walk level by level using parent IDs, or compute from slash-separated `displayName` paths |

`hierarchyLevel` alone never scopes to a named parent. A root UUID in `relToParent` matches only immediate children. If `hierarchyLevel` is unavailable or unreliable, compute user-facing depth from slash-separated `displayName` paths. For a phrase like "Corporate Services", treat "corporate" as part of the name unless the user explicitly asks for an enterprise/domain facet; do not add unrelated domain/classification facets just because a root token looks like a facet value.

For hierarchy type labels such as "Technical Stack", "Technology Stack", "tech categories", "categories", or "fact sheet", treat those words as type labels, not necessarily path text. Strip them before resolving the named root. Example: "3rd-level Tech categories from the Business Technical Stack" usually means `TechnicalStack` rows with root segment `Business` and path depth 3 (`Business / … / …`), not a root literally named `Business / Technical Stack` or `Business Technical Stack`.

Parent/child questions with qualifiers such as region, country, domain, or branch are hierarchy workflows because same-name leaves can exist in several branches.

## Top-level/root nodes

For workspace-wide top-level/root nodes, reconcile simple server-side signals:

1. Confirm the hierarchy type, `hierarchyLevel` facet, and parent relation.
2. Test `hierarchyLevel = "1"` for user-facing roots.
3. Inspect parent relation options for both `__empty__` and `__missing__`; include both when both represent no parent.
4. Use direct `mcp__leanix__filter_inventory` when the root count fits in one page; otherwise paginate in `mcp__leanix__execute_code`.

## Ambiguous hierarchy names

A leaf name can appear in multiple branches or regions. Resolve all plausible candidates in one traversal rather than stopping at the first text hit. For phrases like "Capability X in Region Y", search the leaf phrase separately from the qualifier; if text search does not expose all branches, paginate the hierarchy type and match leaf/path segments in code. The qualifier may be on the leaf, parent, ancestor, or an alias implied by the workspace naming. Do not require exact leaf equality when the leaf itself is qualifier-prefixed/suffixed; strip or ignore qualifier aliases so a qualifier-prefixed leaf still matches the requested leaf. Macro-region qualifiers need aliases, but short aliases such as `US`, `UK`, or `EU` must match whole tokens or token-prefixed path segments (`US West`, `EU Central`) — never `displayName.includes("us")` / `includes("uk")` / `includes("eu")`, because that matches inside words. Return parents for every matching candidate when several qualify.

Do not use deprecated name search for hierarchy resolution; it can miss same-name leaves. Do not invent a `hierarchy:{...}` GraphQL argument unless a tool result confirms it.

## Minimal example shape

```text
parts = displayName.split("/").map(trim)
root = row whose leaf/path segment matches the requested root
subtree = rows where id == root.id OR displayName starts with root.displayName + " /"
immediateChildren = subtree where parts.length == parts(root.displayName).length + 1
levelNUnderRoot = subtree where parts.length == N
parentOfLeaf = paginate/search hierarchy type; keep every row whose leaf matches the leaf name or whose qualifier-stripped leaf matches it (`Americas Customer Success` -> `Customer Success`); path/parent/ancestor must match qualifier aliases; short aliases match tokens/prefixes (`segment == "us" || segment startsWith "us "`), not substrings; return deduped parents for all kept leaves
```

Compact immediate-children shape:

```js
const hierarchyType = "BusinessContext"; // or confirmed hierarchy type
const parentName = "Sourcing and Procurement";
const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const parts = (name) => (name || "").split("/").map((p) => p.trim()).filter(Boolean);
const query = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["${hierarchyType}"]}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items, complete } = await paginate(query, {});
const parent = items.find((row) => norm(row.displayName) === norm(parentName) || parts(row.displayName).some((segment) => norm(segment) === norm(parentName)));
if (!parent) return { parentResolved: false, complete, results: [] };
const parentParts = parts(parent.displayName);
const prefix = `${parent.displayName} /`;
const results = items
  .filter((row) => (row.displayName || "").startsWith(prefix) && parts(row.displayName).length === parentParts.length + 1)
  .map((row) => ({ type: row.type, displayName: row.displayName, factSheetId: row.id }));
return { parent: parent.displayName, count: results.length, complete, results };
```

Compact qualifier parent example:

```js
const hierarchyType = "Organization";
const leafPhrase = "customer success";
const qualifierAliases = ["america", "americas", "north america", "usa", "us", "us east", "us west"];
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
const pathSegments = (name) => (name || "").split("/").map((p) => norm(p)).filter(Boolean);
const stripQualifier = (leaf) => qualifierAliases.reduce((s, q) => s.replace(new RegExp(`^${q}\\s+|\\s+${q}$`, "g"), ""), norm(leaf)).trim();
const segmentMatchesAlias = (segment, alias) => segment === alias || segment.startsWith(`${alias} `);
const hasQualifier = (row) => pathSegments(row.displayName).some((segment) => qualifierAliases.some((alias) => segmentMatchesAlias(segment, alias)));
const query = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["${hierarchyType}"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type ... on Organization{relToParent{edges{node{factSheet{id displayName type}}}}}}}
  }
}`;
const { items, complete } = await paginate(query, {});
const parents = new Map();
for (const row of items) {
  const segments = pathSegments(row.displayName);
  const leaf = segments[segments.length - 1] || "";
  if (stripQualifier(leaf) !== norm(leafPhrase) || !hasQualifier(row)) continue;
  for (const edge of row.relToParent?.edges || []) {
    const parent = edge.node?.factSheet;
    if (parent?.id) parents.set(parent.id, { factSheetId: parent.id, displayName: parent.displayName, type: parent.type });
  }
}
return { leafPhrase, qualifierAliases, complete, results: [...parents.values()] };
```

## Organizational/domain exclusion

For "apps/capabilities outside or not under DOMAIN", resolve the named hierarchy root, build its subtree from path prefix or parent traversal, subtract that subtree from the target hierarchy type, then traverse relations to the requested answer type. Do not use text search for the negation.

For slash-path hierarchies, prefer path-prefix matching when parent relation facets are empty or incomplete. "Level 2 factsheets from ROOT" often means rows whose path is exactly `ROOT / child` (one slash), not grandchildren reached by walking two relation hops.
