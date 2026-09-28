# Subscription ownership

Load for owner/responsible/subscription questions, including named users, named roles, missing owners, and person-owned cross-relation questions.

**Execution:** direct `mcp__leanix__filter_inventory` is fine for one resolved user/role filter that fits in one page. Use `mcp__leanix__execute_code` for role discovery plus set arithmetic, multiple role interpretations, cross-relation ownership, or pagination.

**Schema verification before selecting subscription node fields** — do not assume field names on `Subscription` or `SubscriptionRole` nodes. When the query will need node-field selections in `mcp__leanix__execute_code`, set `include_schema=true` on the **initial** `mcp__leanix__get_workspace_context` call — do not make a separate schema-only round trip. The confirmed field on `Subscription` is `roles` (an array of role objects), not a bare `role` field. For a single-page named-role missing-owner query, use the two-call `mcp__leanix__filter_inventory` path shown in "Minimal subscription shapes" rather than `mcp__leanix__execute_code`.

Confirm subscription roles and source fact-sheet types through workspace context or `allSubscriptionRoles`. Role IDs must be UUIDs from the workspace, never composite strings such as `RESPONSIBLE_APPLICATION_OWNER`.

## Subscription facet semantics

| Keys/filter | Meaning |
|---|---|
| `keys:["__me__"]` | Current user |
| `keys:[userId]` | Specific person from `mcp__leanix__search_users` (`data[].userId`) |
| `keys:["__missing__"]` + `subscriptionFilter` + `OR` | Missing that subscription type/role |
| `keys:["__missing__"]` + `subscriptionFilter` + `NOR` | Has that subscription type/role |
| bare `__missing__` without `subscriptionFilter` | No subscriptions at all |

For a named person, resolve the user once with `mcp__leanix__search_users`, then query the `Subscriptions` facet with `subscriptionFilter:{type:RESPONSIBLE}`. Person lookup is workspace data, not tool discovery; skip no-op/safeguard/catalog calls and use the named user/inventory tools already available in the workflow. If the user asks for a named role such as Application Owner, resolve that role first and include `roleId`. If the user only says "responsible", do not add a role ID; the word names the RESPONSIBLE subscription type.

Do not inspect guessed `subscriptions.role` or `subscriptions.userId` fields on fact-sheet nodes unless a tool result confirms their shape. Do not hardcode user IDs or role IDs from another workspace.

## Named role and missing-owner workflow

1. Resolve all subscription roles for the source type.
2. Match exact role labels first; if several plausible labels exist, state the selected one or return labeled alternatives.
3. Query `Subscriptions` with the resolved UUID `roleId` and `type`; never use the role label, enum-like text, or `RESPONSIBLE_<NAME>` as `roleId`.
4. For missing role questions, use `keys:["__missing__"]` with `OR` and the `subscriptionFilter`, or a confirmed role-specific `DataQuality` sentinel if `filterOptions` exposes one.
5. For broad "missing responsible", omit `roleId` and use `type:RESPONSIBLE`; broad `DataQuality` values such as `_noResponsible_` are cross-checks, not named-role filters.

Phrases such as IT responsible, business responsible, technical owner, or application owner are workspace-specific. Per-role missing counts are not the same as "missing all qualifying roles". A single union interpretation requires set arithmetic: all source IDs minus the union of rows that have any qualifying role.

If role discovery fails, do not invent role UUIDs. Use role names/enums from workspace context or validated tool schemas only as reduced-confidence fallbacks and state that limitation.

## Direct named-person ownership

Use a two-call path when the result fits in one page: `mcp__leanix__search_users` once, then `mcp__leanix__filter_inventory` once. This avoids unnecessary `mcp__leanix__execute_code` and catalog discovery.

```text
mcp__leanix__search_users(query:"Person Name", size:10) -> choose exact userId
mcp__leanix__filter_inventory allFactSheets with FactSheetTypes + Subscriptions keys:[userId] subscriptionFilter:{type:RESPONSIBLE}
```

Only use `mcp__leanix__execute_code` for pagination over more than one page, combining multiple roles/types, or traversing from the owned fact sheets to another answer type.

## Cross-relation ownership

"Organizations connected to Applications owned by a person" means:

1. Resolve person with `mcp__leanix__search_users`.
2. Resolve the intended subscription role/type.
3. Filter Applications by `Subscriptions`.
4. Traverse the confirmed Application↔Organization/UserGroup relation.
5. Return only Organization/UserGroup rows, not intermediate Applications.

Organization/place ownership is different from person subscription ownership. If the owner is an organization/place such as headquarters, also use `geography-and-usage.md`. Resolve the owner/place fact-sheet IDs first, then use the confirmed Application→Organization/UserGroup relation facet and optional subscription filters; do not scan all Applications with every organization edge when a relation facet can scope by owner IDs.

Example compact result shape for ambiguous missing-owner questions: `{ interpretation, selectedRole, missingCount, missingAnyResponsibleCount, roleCandidates, partialRoleCounts, sampleResults }`. For business-critical plus missing-owner questions, filter the business-critical branch and the missing-subscription branch server-side where possible and intersect IDs in `mcp__leanix__execute_code`; avoid hydrating subscriptions for every Application.

## Minimal subscription shapes

**Before building any `subscriptionFilter` argument**, confirm the exact input type shape via `__type(name:"SubscriptionFilterInput") { inputFields { name type { kind name ofType { kind name } } } }` introspection inside `mcp__leanix__execute_code`, or from `include_schema=true` on the initial `mcp__leanix__get_workspace_context`. Do not construct the argument from memory — the accepted fields and their types must be confirmed from the live schema. Note: `facetKey` is a field on the returned `FacetResult` response object, not an argument to `filterOptions { facets { ... } }`; do not pass it as an argument.

```text
role discovery: allSubscriptionRoles(filter:{factSheetType:Application}) { edges { node { id name subscriptionType } } }
person responsible: facetKey="Subscriptions", keys=[userId], subscriptionFilter={type:RESPONSIBLE}
missing any responsible: facetKey="Subscriptions", keys=["__missing__"], operator=OR, subscriptionFilter={type:RESPONSIBLE}
missing named role: resolve role UUID first, then add roleId to subscriptionFilter
has named role: same filter but operator=NOR with keys=["__missing__"] or keys=[userId] for a person
```

Compact named-role shape:

```js
const rolesQ = `query { allSubscriptionRoles(filter:{factSheetType:Application}) { edges { node { id name subscriptionType } } } }`;
const rolesResponse = await call_tool("mcp__leanix__filter_inventory", { query: rolesQ, variables: {} });
const role = (rolesResponse.data.allSubscriptionRoles.edges || [])
  .map((edge) => edge.node)
  .find((candidate) => /owner|responsible/i.test(candidate.name || "") && candidate.subscriptionType === "RESPONSIBLE");
if (!role?.id) return { roleResolved: false, results: [] };
const query = `query($after:String, $roleId:ID!){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["Application"]},{facetKey:"Subscriptions", operator:OR, keys:["__missing__"], subscriptionFilter:{type:RESPONSIBLE, roleId:$roleId}}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items: results, totalCount, complete } = await paginate(query, { roleId: role.id });
return { selectedRole: role, count: totalCount, complete, results };
```

Compact person-to-related-organization shape:

```js
const users = await call_tool("mcp__leanix__search_users", { query: "Person Name", page: 1, size: 10 });
const user = users.data?.[0];
if (!user?.userId) return { userResolved: false, results: [] };
// Filter Applications by Subscriptions using user.userId, then traverse Application→Organization/UserGroup and dedupe those targets.
```
