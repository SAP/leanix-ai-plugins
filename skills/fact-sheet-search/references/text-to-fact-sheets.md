# text_to_fact_sheets — Read This Before Calling

**MANDATORY: Read this reference before every `text_to_fact_sheets` call.**

This tool translates natural language into a structured filter, then runs that filter against the workspace. The filter translation is a black box — you cannot control it directly. Use the techniques below to get accurate results.

## Parameters

| Parameter     | Required | Description                                                               |
| ------------- | -------- | ------------------------------------------------------------------------- |
| `text`        | Yes      | Natural language search query                                             |
| `page_size`   | No       | Results per page (default: 20)                                            |
| `cursor`      | No       | Pagination cursor                                                         |
| `return_mode` | No       | `results_only` (default), `filter_only`, or `results_and_filter`          |
| `filter_id`   | No       | Reuse a cached filter from a previous call (for deterministic pagination) |

## Step 1: Verify the Filter First

**ALWAYS** call with `return_mode: "results_and_filter"` and `page_size: 1` on your first call. This peeks at the generated filter without fetching all results:

```
text_to_fact_sheets(text: "mission critical cloud apps", page_size: 1, return_mode: "results_and_filter")
```

The response includes:

- `generated_filter` — the exact structured filter that was created from your text
- `filter_id` — a cached ID you MUST reuse for the full query
- 1 sample result to verify correctness

## Step 2: Inspect the Filter

Check `generated_filter` for correctness:

- Does it filter the right fact sheet type?
- Does it include the right lifecycle, criticality, hosting filters?
- Does it have the right relationship constraints?

## Step 3: Get Full Results

**If filter looks correct:** Call again with `filter_id` from Step 1 + `page_size: 100`:

```
text_to_fact_sheets(filter_id: "<id-from-step-1>", page_size: 100)
```

This reuses the exact same cached filter — deterministic, no re-translation.

**If the response has more pages** (`has_next_page: true` or `cursor` is not null) **and the user asked for a complete list**, continue paginating:

```
text_to_fact_sheets(filter_id: "<id-from-step-1>", page_size: 100, cursor: "<cursor>")
```

Repeat until `cursor` is null. Collect all IDs across pages.

**NEVER stop at the first page and report `total_count` as if you have retrieved all results.** The `total_count` field tells you how many exist — if it is larger than the number of IDs you have, you must paginate to get the rest.

**If filter is wrong:** Retry Step 1 with a more explicit `text`:

- Missing lifecycle → `"applications in phase out lifecycle phase"`
- Missing criticality → `"mission critical applications with businessCriticality missionCritical"`
- Wrong fact sheet type → `"only Application type fact sheets for cloud hosting"`
- Missing relationship → `"applications related to Procurement business capability"`

**If filter is still wrong after retry:** Fall back to `get_applications` with explicit parameters.

## Improving Text Quality

The text-to-filter translation works better with synonyms and domain terms:

| Instead of              | Use                                                                     |
| ----------------------- | ----------------------------------------------------------------------- |
| `"procurement tools"`   | `"procurement applications procurement automation contract management"` |
| `"legal operations"`    | `"legal operations compliance regulatory affairs"`                      |
| `"ERP systems"`         | `"ERP enterprise resource planning business operations"`                |
| `"document management"` | `"document management content services ECM DMS"`                        |

## Thin Results Fallback

If `total_count` from the response is **0–2** and the query is about a domain/function:

1. Find the parent capability: `search_fact_sheet_by_name(name: "<domain>", fact_sheet_type: "BusinessCapability")`
2. Get linked apps: `get_applications(application_relations: {"BusinessCapability": ["<id>"]}, page_size: 100)`

## "My Apps" Special Case

When user says "my apps" or "my applications":

1. Call `text_to_fact_sheets(text: "my applications")` — returns apps where user is subscribed
2. If `total_count: 0` → tell user "You have no subscribed applications"
3. Do NOT fall back to `get_applications` — that returns ALL apps, not the user's

## What This Tool Cannot Do

- Cannot filter by `fact_sheet_type` directly — it guesses the type from your text
- Cannot do exact attribute filtering (use `get_applications` for precise lifecycle/criticality/hosting filters)
- Cannot do negation ("NOT mission critical") — use `get_applications` with the other enum values instead
- Literal filters like `"fact sheets starting with A"` do not work
