# Find Fact Sheets by Name

Use `search_fact_sheet_by_name`. **Always include `fact_sheet_type`** — without it, results are mixed across all types. Note: `fact_sheet_type` is specific to this search tool — other tools like `get_fact_sheet_details` only need `fact_sheet_id`.

## Parameters

| Parameter         | Required        | Description                                       |
| ----------------- | --------------- | ------------------------------------------------- |
| `name`            | Yes             | Full or partial name                              |
| `fact_sheet_type` | **Recommended** | Application, Initiative, BusinessCapability, etc. |
| `page_size`       | No              | Results per page — **always set to 50 or 100 for list queries** |
| `cursor`          | No              | Pagination cursor                                 |

## Examples

- `name: "Trello", fact_sheet_type: "Application"` → found Trello
- `name: "Pega", fact_sheet_type: "Application", page_size: 50` → found Pega CRM, Pega Sales, Pega Service, etc.
- `name: "Data Center Migration 2026", fact_sheet_type: "Initiative"` → found initiative
- `name: "Logistics", fact_sheet_type: "BusinessCapability"` → found capabilities
- `name: "Zoom", fact_sheet_type: "Application"` → found Zoom

**Fails:** Name without type → mixed irrelevant results. Empty name with type → unreliable.

## Business Capability Lookups

When users ask about business capabilities (Procurement, Operations, Corporate Services, etc.), **always use `fact_sheet_type: "BusinessCapability"`**:

- `name: "Procurement", fact_sheet_type: "BusinessCapability"` → Procurement and sub-capabilities
- `name: "Operations", fact_sheet_type: "BusinessCapability"` → Operations capabilities
- `name: "Corporate Services", fact_sheet_type: "BusinessCapability"` → Corporate Services capabilities
- `name: "Sales & Distribution", fact_sheet_type: "BusinessCapability"` → Sales capabilities

**Common name mappings** — user terms often differ from actual fact sheet names. ALWAYS expand abbreviations before searching:

| User says                       | Search for                            | fact_sheet_type    |
| ------------------------------- | ------------------------------------- | ------------------ |
| "Ops capabilities"              | `"Operations"`                        | BusinessCapability |
| "Ops-related"                   | `"Operations"`                        | BusinessCapability |
| "legal capabilities"            | `"Legal & Compliance"`                | BusinessCapability |
| "ERP", "ERP systems"            | `"Enterprise Resource Planning"`      | BusinessCapability |
| "procurement capabilities"      | `"Procurement"`                       | BusinessCapability |
| "vendor management"             | `"Vendor Management"`                 | BusinessCapability |
| "data center migration"         | `"Data Center Migration"`             | Initiative         |
| "process automation"            | `"Process Automation"`                | Initiative         |
| "infrastructure providers"      | `"cloud"` or `"Heroku"` / `"Netlify"` | Provider           |
| "storage", "switches"           | `"Lenovo"` or `"Juniper"`             | ITComponent        |
| "data objects", "data entities" | `""` (empty = list all)               | DataObject         |

After finding a parent capability, use `get_fact_sheet_details` with its ID to see child capabilities via relations.

## Proven Calls with UUIDs

- `name: "Trello", fact_sheet_type: "Application"` → ID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- `name: "Data Center Migration 2026", fact_sheet_type: "Initiative"` → ID: `b2c3d4e5-f6a7-8901-bcde-f12345678901`
- `name: "Zoom", fact_sheet_type: "Application"` → ID: `c3d4e5f6-a7b8-9012-cdef-123456789012`

## Chaining with Details

After finding a fact sheet, use `get_fact_sheet_details` with the returned ID for full attributes.

## Response Fields

`id`, `name`, `displayName`, `type`, `description`, `total_count`, `cursor`

## Troubleshooting

| Problem        | Solution                                                |
| -------------- | ------------------------------------------------------- |
| Empty results  | Add `fact_sheet_type` parameter                         |
| Too many types | Specify exact `fact_sheet_type`                         |
| Wrong results  | Try the canonical name (see Common name mappings table) |
| Need more      | Increase `page_size`, use cursor                        |
