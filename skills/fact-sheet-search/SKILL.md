---
name: fact-sheet-search
description: Searches and filters LeanIX fact sheets by reasoning about query intent — loading the workspace fact sheet types first to confirm type names — then calling the best-fit tool: semantic search for conceptual queries, or structured tools for named/filtered queries.
argument-hint: "[search query or question about fact sheets]"
license: Apache-2.0
compatibility: Requires LeanIX MCP server for API access (mcp__leanix__* tools)
metadata:
  author: SAP LeanIX
  version: "1.0"
allowed-tools:
  - Read
  - AskUserQuestion
  - "mcp__leanix__*"
---

# Fact Sheet Search

Search, discover, filter, and inspect LeanIX fact sheets.

## Quick start

1. Call `get_fact_sheet_types` — get the list of fact sheet type names for this workspace.
2. Route the query: specific name → `vector_search`; relation/attribute/lifecycle/domain → `text_to_fact_sheets`; initiatives → `get_initiatives`; UUID or detail → `get_fact_sheet_details`.
3. Verify the filter (for `text_to_fact_sheets`: use `return_mode: "results_and_filter"` on the first call), collect results, paginate if needed.
4. Fall back only if the primary tool returns empty or cannot express the query — see Step 1 for fallback rules.
5. Return matching fact sheet IDs and a concise answer.

> Full routing logic, special cases, and per-tool guidance are in the sections below.

---

## When to Use

Use this skill when:

- User mentions a specific application, system, or initiative name ("Find Trello", "Show me Pega apps")
- User asks about their apps ("my apps", "my applications", "what are my applications?")
- User wants to discover fact sheets by domain ("Find legal applications", "ERP tools")
- User wants to filter applications by attributes ("cloud apps", "mission critical", "poor fit")
- User needs full details about a fact sheet ("show me details of X")
- User asks about apps linked to a capability or initiative ("apps in Procurement", "apps affected by Data Center Migration")
- User asks about initiatives or transformation programs ("active initiatives", "Data Center Migration status")
- User asks about lifecycle timelines ("apps reaching end-of-life in 6 months", "phasing out this year")
- User asks a conceptual or exploratory question ("tools for managing customer relationships", "what supports our finance domain")

NOT for:

- General greetings or unrelated questions
- Creating or modifying fact sheets (use other skills)
- GraphQL queries (use leanix-graphql skill)

**Action-first rule:** NEVER ask clarifying questions before searching. Always call the most likely tool first, show results, then ask follow-up questions only if results are empty or ambiguous.

**Anti-loop rule:** Each unique (tool, args) combination may be called **at most once**. If you are about to call a tool with arguments you have already used, STOP immediately and return the best answer you have from existing results. Never repeat an identical call.

**Deduplication rule:** Before every tool call, check your call history. If (tool + args) already appears: do NOT call it. Use the result you already have.

**Pagination rule:** When the user asks for a complete list ("all", "list", "how many", "which ones"), you MUST paginate until `cursor` is null. Never stop at the first page and claim the list is complete.

---

## Step 0 — Load the Workspace Fact Sheet Types

**Always start here**, before routing to any search tool.

Call `get_fact_sheet_types` (no parameters).

The response has this shape:

```json
{
  "factSheetTypes": ["Application", "BusinessCapability", "ITComponent", "Provider", "Initiative", "Interface", "DataObject", "UserGroup", "TechnicalStack", "Project"]
}
```

Record the type names. Use them in Step 1 to confirm which types exist in this workspace before routing — type names vary per workspace (some may be renamed or missing).

**What this tool does NOT return** — use general LeanIX knowledge for these:

- **Single-select field values**: standard values are documented in `references/filter-applications.md`
- **Relations between types**: standard relations are documented in `references/cross-type-relationships.md`
- **Lifecycle phases**: standard phases are `plan`, `phaseIn`, `active`, `phaseOut`, `endOfLife`

If `get_fact_sheet_types` is not available, skip Step 0 and proceed directly to Step 1 using general LeanIX knowledge.

---

## Step 1 — Route the Query

**Default routing — apply in order:**

1. **UUID detected** → `get_fact_sheet_details(fact_sheet_id: "<uuid>")` directly
2. **Name lookup** — any of:
   - Explicit framing: "find X", "show me X", "search for X", "what is X"
   - Short bare query with no filter signals (1–4 words, no relation/attribute/lifecycle keywords): `"ac mgmt"`, `"Salesforce"`, `"IF-K14"`, `"SAP"`
   - Abbreviation or partial name that expands to a proper noun
   → `vector_search(query: "<name>")` first. Fall back to `search_fact_sheet_by_name` if empty.
3. **"My apps" / subscription query** → `text_to_fact_sheets(text: "my applications")`
4. **Any relation, attribute, lifecycle, domain, or concept query** → `text_to_fact_sheets` first. See signal list below. Fall back to `get_applications` only when `text_to_fact_sheets` cannot express the query.
5. **Initiatives** → `get_initiatives` directly
6. **Full details for a known fact sheet** → `get_fact_sheet_details(fact_sheet_id: "<id>")`

---

### Route to `text_to_fact_sheets` first for these query signals

Use `text_to_fact_sheets` as the **first call** whenever the query contains any of these signals — regardless of which fact sheet type is involved:

| Signal | Example queries |
| --- | --- |
| **Multi-hop relation** ("via", "through", "provided by", "running on", "using") | "apps linked to IBM via IT component", "apps running on .NET technology", "apps with interfaces using FTP" |
| **Cross-entity / geography** (country, region, org, user group) | "solutions used in Europe", "what does Spain use for finance", "apps used by our HQ", "which CRM do we use in Europe" |
| **Ownership / subscription** (person name, role) | "apps where Frank Martin is responsible", "applications owned by Paula Watson's org" |
| **Domain / concept** (no specific name) | "marketing automation systems", "apps that deal with invoice data", "solutions for non-commodity capabilities" |
| **Indirect hierarchy** ("all levels", "level 3", "underneath") | "all levels of corporate services", "BCs at level 3 without apps" |
| **Missing relation** ("without", "no X", "don't have") | "apps without IT components", "solutions not used in any process", "BCs without related applications" |
| **Attribute filter on non-Application types** | "BCs updated this year", "interfaces starting with IF-L", "projects around SAP" |

`text_to_fact_sheets` handles these because it translates the full natural language into a structured filter — including multi-hop relations and cross-type constraints that `get_applications` cannot express (it only covers the Application type with direct relations).

---

### Fall back to `get_applications` only when `text_to_fact_sheets` returns wrong/empty results AND the query maps to one of these explicit params:

- `missing_technicalSuitability: true` / `missing_functionalSuitability: true` — "no tech fit assigned"
- `missing_subscription_role: "Application Owner"` — "without an application owner"
- `completion_max: N` — "below X% completion"
- `lxState: ["ARCHIVED"]` — "in the trash bin"
- Negation ("NOT mission critical") — enumerate the other enum values
- Lifecycle date range with `RANGE_STARTS` precision — "decommissioned in 2027"

---

Write your reasoning explicitly before deciding:

```
Query: "apps running on .NET technology"
- Multi-hop relation signal ("running on") → text_to_fact_sheets first
→ text_to_fact_sheets(text: "applications running on .NET technology", page_size: 1, return_mode: "results_and_filter")
→ inspect filter → if correct, reuse filter_id for full results
→ if wrong/empty → fall back: search ITComponent by name ".NET", then get_applications(application_relations: {"ITComponent": ["<id>"]})
```

```
Query: "Find Trello"
- Specific name → vector_search first
→ vector_search(query: "Trello")
→ if empty → fall back: search_fact_sheet_by_name(name: "Trello", fact_sheet_type: "Application")
```

```
Query: "ac mgmt"
- Short bare query (2 words, no filter signals) → name lookup → vector_search first
→ vector_search(query: "ac mgmt")
→ returns AC Management, AC Management Cloud, AC Management to HR Admin
```

```
Query: "IF-K14"
- Short bare query, looks like an external ID / code → vector_search first
→ if empty → search_fact_sheet_by_name(name: "IF-K14", fact_sheet_type: "Interface")
```

```
Query: "Which applications are below 40% completion?"
- text_to_fact_sheets cannot express numeric completion threshold
→ get_applications(completion_max: 40, page_size: 100)
```

---

## Semantic Search

Use `vector_search` as the **primary tool** for name lookups and conceptual queries:

- Specific names ("Find Trello", "Show me Pega", "SAP systems", "IBM", ".NET")
- Conceptual / exploratory ("tools for managing customer relationships", "what supports our finance domain")
- Vendor / brand searches — finds the entity regardless of which fact sheet type it lives in

Call with `query` set to the user's natural language verbatim.

If `vector_search` returns empty:
- Name lookup → fall back to `search_fact_sheet_by_name(name: "...", fact_sheet_type: "...")`
- Conceptual query → fall back to `text_to_fact_sheets` with expanded synonyms

---

## Non-Application Fact Sheet Types

For queries about non-Application types where `text_to_fact_sheets` returns empty or wrong type:

- List all of a type → `search_fact_sheet_by_name(name: "", fact_sheet_type: "Provider")`
- Find by name → `search_fact_sheet_by_name(name: "Juniper", fact_sheet_type: "ITComponent")`
- Use type names confirmed in Step 0 — they vary per workspace

---

## Multi-Type Search for Vendor / Brand Names

When `vector_search` returns empty for a vendor/brand ("Salesforce", "SAP", "IBM"), search across all relevant types — the same entity may exist as Application, Provider, ITComponent, or Interface:

```
search_fact_sheet_by_name(name: "Salesforce", fact_sheet_type: "Application")
search_fact_sheet_by_name(name: "Salesforce", fact_sheet_type: "Provider")
search_fact_sheet_by_name(name: "Salesforce", fact_sheet_type: "ITComponent")
```

Collect all IDs across calls.

---

## Quick Ref

| User Intent | Primary tool | Fallback |
| --- | --- | --- |
| Find by name — explicit ("Find Trello") or short bare query with no filter signals ("ac mgmt", "Salesforce", "IF-K14") | `vector_search(query: "<name>")` | `search_fact_sheet_by_name(name: "...", fact_sheet_type: "...")` |
| Relation / attribute / lifecycle / domain | `text_to_fact_sheets` — verify filter first | `get_applications` for missing fields, negation, date precision |
| "My apps" / subscriptions | `text_to_fact_sheets(text: "my applications")` | do NOT fall back to `get_applications` |
| List all of a type ("all providers") | `search_fact_sheet_by_name(name: "", fact_sheet_type: "...")` | — |
| UUID lookup | `get_fact_sheet_details(fact_sheet_id: "...")` | — |
| Initiatives | `get_initiatives` | — |
| Full details for a known fact sheet | `get_fact_sheet_details(fact_sheet_id: "...")` | — |

---

## Aggregation Queries (count, "more than N", "relied on by X apps")

When users ask "which providers are relied on for >3 apps" or "how many providers have >N applications":

**Do NOT use `count_fact_sheet_relations` with wrong source types — it only counts direct relations.**

**Correct multi-step approach:**

1. **Get all entities of the target type** — e.g. `search_fact_sheet_by_name(name: "", fact_sheet_type: "Provider", page_size: 100)` to list all providers
2. **For each entity, get linked apps** — `get_applications(application_relations: {"Provider": ["<provider-id>"]}, page_size: 100)`
3. **Count and filter** — keep only those where the count exceeds the threshold
4. **Return the matching entity IDs** (Provider IDs, not Application IDs) in `retrieved_fact_sheet_ids`

**STOP after the threshold scan.** Do not also call `get_fact_sheet_details` on each entity — you already have the IDs you need.

**General rule:** Never call `get_fact_sheet_details` unless the user explicitly asks for full details of a specific fact sheet. Search results (IDs + names) are sufficient for most queries.

---
## Reference Files

Read these before calling the corresponding tool:

| Reference file | Read before... | When |
| --- | --- | --- |
| `references/text-to-fact-sheets.md` | every `text_to_fact_sheets` call | filter verification required |
| `references/filter-applications.md` | `get_applications` fallback calls | NL → param mapping |
| `references/find-by-name.md` | `search_fact_sheet_by_name` | name expansion, abbreviations |
| `references/cross-type-relationships.md` | relation fallback via `get_applications` | relation lookup |
| `references/fact-sheet-details.md` | `get_fact_sheet_details` | full attribute/relation retrieval |
