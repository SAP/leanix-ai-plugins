# Geography and usage

Load for place questions: used in a country/region, at headquarters, not at a place, common/shared software across places, country-scoped mandatory fields, or organization/business-unit/team/domain scope.

**Execution:** use one self-contained `mcp__leanix__execute_code` orchestration for region/country set building, exclusion, union, intersection, organization hierarchy, or aggregate questions. One orchestration may make multiple narrow paged/chunked `mcp__leanix__filter_inventory` calls. Put branch discovery, pagination/chunking, set operations, and final `results` in the same snippet; a series of small snippets tends to retry partial branches and waste tokens. Direct `mcp__leanix__filter_inventory` is only enough for one confirmed place tag/relation when the question is explicitly that narrow. If the question also names a concept/category/acronym/product (for example "which <category> in <place>"), use the Place plus concept workflow below instead of returning a generic regional application list or a single region-tag branch. Do not run several separate `mcp__leanix__execute_code` attempts for the same place question; one snippet should inspect available branches, execute viable branches, and return branch counts/limitations. Do not translate this into one giant GraphQL query that selects every possible place relation/tag path at once.

Confirm the answer type, organization-like type(s), geography tags, location facets, and usage/ownership relation keys from workspace context. Prefer **Application** answers for "software/solutions/systems used in <place>" unless the user explicitly asks for IT components/technologies.

## Organization-like wording

Not every workspace has an `Organization` type. For organization, business unit, department, team, function, or domain wording, check configured constructs in this order as applicable:

- `Organization` plus location/region tags.
- `UserGroup` / `FunctionalUserGroup` for user/team/department ownership or usage groups.
- `BusinessCapability` hierarchy or domain tags when the wording is about a business function/domain.
- Tags or custom fields matching the requested place/domain.
- Subscriptions only when the wording is person/role responsibility rather than usage/scope.

If several constructs match, state the interpretation and return compact cross-checks when the answer materially changes. Do not answer zero solely because one construct is absent.

For organization ownership rankings, prefer relation-edge ownership (`usageType = owner`) on UserGroup/FunctionalUserGroup/Application relations before subscriptions; subscriptions usually model person/role responsibility.

## Geography semantics

"Used in <geo>" is a union of confirmed geography signals:

1. Applications linked to Organizations representing that geography.
2. Applications linked to Organizations whose live location/country facet is in that geography.
3. Applications tagged with the relevant region/country tag.
4. For macro-regions, Organizations whose display/path names are member places or region aliases.

Do not answer broad usage questions such as "solutions/software/applications used in <region>" from a region tag alone; it commonly under-returns and is only an optional branch. A tag-only result is acceptable only when the user explicitly asks for that tag. Do not put a tag UUID into an Application→place relation; relation keys must be place/organization fact-sheet UUIDs. If you have a `regionTagId`, use it only in that tag facet branch; first resolve separate Organization/place IDs before running the relation branch.

## Common patterns

- **Country / place**: resolve exact Organization leaf/path matches across all organization rows, country-specific location options, and country-specific tags for that country; then fetch Applications via the confirmed Application→Organization relation. Do not require an optional `category=country` facet unless `filterOptions` proves it is populated, because many workspaces encode countries only as organization path/leaf names or locations. Do not substitute a broader region tag such as Europe for Italy/Spain/France.
- **Macro-region (Europe, APAC, Americas)**: expand to member countries/places first, keep only members present in Organization/location/tag options, union all matching branches, dedupe Application IDs. For Europe, use country/member signals such as Germany, France, Spain, Italy, Poland, UK, Netherlands, etc. when the workspace has country orgs but no complete Europe org/tag.
- **HQ / headquarters**: resolve workspace spellings such as `Headquarter`, `Headquarters`, `HQ`; use exact leaf match where possible. If the user asks for Applications **owned by** HQ/organization, require the confirmed Application→Organization ownership edge value (often `usageType = owner`). If edge-field facet/subFilter syntax fails or is not confirmed, select relation edges with their edge fields and filter `usageType` in code; do not fall back to all Applications merely linked to HQ.
- **Any country but HQ**: require at least one Organization relation, then subtract Applications linked to the resolved HQ Organization. `but` is exclusion, not AND.
- **Common/shared software across A and B**: build Application sets for each place and intersect IDs. Resolve each place from all plausible organization/location/tag branches. If one branch such as an organization category facet returns no place rows, fall back to leaf/path/location matching before answering zero. Do not semantic-search for "common software".
- **What does <place> use for <function/domain>**: build the place Application set and the concept Application set independently, then intersect them. Do not let a geographic name or weak terms inside the place set substitute for concept evidence.
- **Mandatory fields in <country>**: build the country Application set first, then evaluate mandatory field/relation/tag/subscription presence on that set.

## Region lookup checklist

Use one compact `mcp__leanix__execute_code` traversal and paginate every branch; capped `first:200` reads silently under-return:

1. Inspect focused `filterOptions` for Application place relations/tag facets and Organization location/country options.
2. Prefer the branch family with populated evidence in this order: Application→Organization relation with place/path matches; Organization location/country options; geography tag facets. Still include other populated branches in the same snippet when their keys are already known.
3. Resolve Organization IDs by exact country/region/member leaf/path names and location option keys.
4. Fetch Applications for all Organization IDs through the confirmed relation, chunking Organization IDs if needed.
5. Fetch Applications for confirmed geography tag facets when available.
6. Union and dedupe by Application ID; return counts for each branch plus final results.

If the `location` facet is absent or has no country option, use Organization leaf/path matching. If a tag facet is invalid, skip only the tag branch and keep Organization/location branches. For broad region usage, if the snippet only executed a tag branch and did not attempt Organization/place resolution, the workflow is incomplete. Do not retry a completed region workflow in a second tool call just because one optional branch was empty; return the completed union with branch counts.

## Minimal example shape

```text
region = "Europe"
memberPlaces = countries/places from context that belong to the region
orgIds = Organizations whose leaf/path/location matches region OR memberPlaces
countryTagApps = Applications tagged with member country tags, if exposed
regionTagApps = Applications tagged with the macro-region tag, if exposed
appsFromOrgs = Applications where confirmed Application→place relation targets orgIds (place fact-sheet IDs only, not region/country tag IDs)
results = dedupe(appsFromOrgs ∪ countryTagApps ∪ regionTagApps)
return { branchCounts, count: results.length, results }
```

Compact `mcp__leanix__execute_code` shape for region/place usage. Replace the relation/tag constants with keys confirmed from context/filterOptions; keep it as one snippet so branches share state and failures do not cause broad retries:

```js
const region = "Named region";
const members = [region, "Member country", "Another member country"];
const appToPlaceRelation = "confirmedApplicationToPlaceRelation";
// Fill from filterOptions when region/country tags are modeled; use _TAGS_ or the tag-group UUID, not a generic "tags" facet.
const tagBranches = [
  // { facetKey: "_TAGS_", tagId: "confirmed-region-or-country-tag-id" },
];
const norm = (s) => (s || "").toLowerCase().trim();
const leafParts = (name) => (name || "").split("/").map((p) => norm(p)).filter(Boolean);
const matchesMember = (name) => leafParts(name).some((part) => members.some((m) => part === norm(m) || part.startsWith(`${norm(m)} `)));

const orgQ = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Organization"]}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items: allOrgs } = await paginate(orgQ, {});
const orgIds = [...new Set(allOrgs.filter((org) => matchesMember(org.displayName)).map((org) => org.id))];

const byId = new Map();
if (orgIds.length) {
  const appByOrgQ = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"${appToPlaceRelation}", operator:OR, keys:${JSON.stringify(orgIds)}}]}){
    totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
  for (const row of (await paginate(appByOrgQ, {})).items) byId.set(row.id, row);
}
for (const branch of tagBranches) {
  const tagQ = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"${branch.facetKey}", operator:OR, keys:["${branch.tagId}"]}]}){
    totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
  for (const row of (await paginate(tagQ, {})).items) byId.set(row.id, row);
}
return { region, branchCounts: { organizations: orgIds.length, tagBranches: tagBranches.length }, results: [...byId.values()] };
```

Compact common-place/exclusion shapes. For common/shared software, do the complete intersection in one snippet; do not rerun separate Spain/France/region variants after this returns branch counts.

```js
const appToPlaceRelation = "confirmedApplicationToPlaceRelation";
const places = ["Spain", "France"];
const norm = (s) => (s || "").toLowerCase().trim();
const matchesPlace = (name, place) => (name || "").split("/").some((part) => norm(part) === norm(place) || norm(part).startsWith(`${norm(place)} `));
const chunks = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

const orgQ = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Organization"]}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items: orgRows } = await paginate(orgQ, {});
const orgIdsByPlace = new Map(places.map((place) => [place, orgRows.filter((org) => matchesPlace(org.displayName, place)).map((org) => org.id)]));

const appsForOrgIds = async (orgIds) => {
  const byId = new Map();
  for (const chunk of chunks(orgIds, 50)) {
    const q = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
      facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"${appToPlaceRelation}", operator:OR, keys:${JSON.stringify(chunk)}}]}){
      totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
    for (const row of (await paginate(q, {})).items) byId.set(row.id, row);
  }
  return byId;
};
const sets = [];
for (const place of places) sets.push(await appsForOrgIds(orgIdsByPlace.get(place) || []));
if (sets.some((set) => set.size === 0)) return { complete: true, branchCounts: Object.fromEntries(places.map((p, i) => [p, { orgIds: (orgIdsByPlace.get(p) || []).length, apps: sets[i].size }])), results: [] };
const commonIds = [...sets[0].keys()].filter((id) => sets.every((set) => set.has(id)));
return { complete: true, branchCounts: Object.fromEntries(places.map((p, i) => [p, { orgIds: (orgIdsByPlace.get(p) || []).length, apps: sets[i].size }])), results: commonIds.map((id) => sets[0].get(id)) };
```

```js
const hqId = "resolved-hq-org-id";
const appToPlaceRelation = "confirmedApplicationToPlaceRelation";
const query = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"${appToPlaceRelation}", operator:NOR, keys:["__missing__"]},{facetKey:"${appToPlaceRelation}", operator:NOR, keys:["${hqId}"]}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items: results, complete } = await paginate(query, {});
return { excludedOrganizationId: hqId, complete, results };
```

## Place plus business/function concept

For "what does PLACE use for FUNCTION/CATEGORY" build two independent sets in one workflow: the concept Application set and the place Application set, then intersect them. If the intersection is empty, inspect the returned branch counts/evidence before retrying: only run one corrected workflow when the first omitted a confirmed place branch or concept branch; do not run several weaker-probe snippets.

Concept set branches:
1. Application text/category evidence from name, alias, description, product/category fields.
2. Applications related to BusinessCapability/Process/DataObject targets whose leaf/path/category matches the function/category wording.
3. Semantic candidates only as discovery; hydrate/verify them structurally before final inclusion.

Place set branches must follow the region lookup checklist; do not use only a macro-region tag unless `filterOptions`/counts prove that tag is the complete geography model. A macro-region tag branch is only one branch; if it does not intersect strong concept candidates, test those candidates against member country/organization/location branches before answering zero.

Candidate-first shape for narrow concept-in-region questions:

```js
const region = "Named region";
const members = [region, "Member country", "Another member country"];
const conceptRegex = /requested acronym|expanded phrase|product evidence/i;
const appToPlaceRelation = "confirmedApplicationToPlaceRelation";
const norm = (s) => (s || "").toLowerCase().trim();
const matchesPlace = (name) => (name || "").split("/").some((part) => members.some((m) => norm(part) === norm(m) || norm(part).startsWith(`${norm(m)} `)));

const conceptQ = `query($after:String, $q:String!){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    fullTextSearch:$q
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]}]
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type ... on Application{alias description}}}
  }
}`;
const conceptRows = new Map();
for (const q of ["user phrase", "expanded phrase", "product/category synonym"]) {
  for (const app of (await paginate(conceptQ, { q })).items) {
    const evidence = `${app.displayName || ""} ${app.alias || ""} ${app.description || ""}`;
    if (conceptRegex.test(evidence)) conceptRows.set(app.id, app);
  }
}
const ids = [...conceptRows.keys()];
if (!ids.length) return { region, results: [] };
const verifyQ = `query($after:String){
  allFactSheets(first:200, after:$after, filter:{
    responseOptions:{maxFacetDepth:5}
    ids:${JSON.stringify(ids)}
  }){
    totalCount
    pageInfo{hasNextPage endCursor}
    edges{node{id displayName type ... on Application{${appToPlaceRelation}{edges{node{factSheet{id displayName type}}}}}}}
  }
}`;
const verified = [];
for (const app of (await paginate(verifyQ, {})).items) {
  const placeEdges = app[appToPlaceRelation]?.edges || [];
  if (placeEdges.some((edge) => matchesPlace(edge.node?.factSheet?.displayName))) {
    verified.push({ factSheetId: app.id, displayName: app.displayName, type: app.type });
  }
}
return { region, candidateCount: ids.length, results: verified };
```

For multiple concepts, union all concept branches first, then intersect with the place set. Category/acronym concepts require evidence for that concept in inspected fields or confirmed relations. For acronym wording, prefer standalone acronym, full expanded phrase, confirmed category/relation evidence, or strong product evidence; individual words from the expansion are not enough by themselves. If the region tag branch has no strong concept hit, test global concept candidates against place relations inside the same workflow instead of broadening to weak partial-word matches or hand-copying an intermediate regional sample. When the user asks for a singular "Which <acronym/category>" answer, put only strong exact acronym/category matches in `results`; mention weaker adjacent candidates in the answer/caveat instead of final rows. Repeated CRM/ERP/category snippets usually add cost without improving evidence; retry only to add a confirmed branch that was omitted.
