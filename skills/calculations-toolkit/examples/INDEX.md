# Calculation Examples Index

Ready-to-use calculation scripts organized by category.

---

## ⚠️ Before Using Any Example

> **Examples use STANDARD names that may not exist in your workspace.**
>
> Before copying any example, you MUST discover your workspace's actual data model.

### 1. Discover Your Data Model

Query your workspace to find actual field and relation names:

```
Tool: mcp__leanix__get_fact_sheet_details
Parameters: { "fact_sheet_type": "Application", "fact_sheet_ids": ["{REAL_UUID}"] }
```

This returns all fields and relations for a real fact sheet — inspect the keys to discover:
- All fields available on the fact sheet
- All relation names (e.g. `relApplicationToITComponent`)
- Enum values visible in field data

### 2. Identify Matching Names

Examples use **standard names** like:
- `relApplicationToITComponent` - your workspace might use different naming
- `businessCriticality` - might not exist or have a different name
- `annualCost` - check if this field exists on your fact sheet type

### 3. Customize Before Using

Each example file contains comments indicating what to customize:

```javascript
// ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's relation name ↓↓↓
const RELATION_NAME = "relApplicationToITComponent";
// ↑↑↑ Discover via get_fact_sheet_details on a real Application fact sheet ↑↑↑
```

Replace these values with your workspace's actual names.

### 4. Test with Dry-Run

Before creating the calculation, test your customized code against a real fact sheet using `test_run_calculation`:

```
Tool: mcp__leanix__test_run_calculation
Parameters: {
  "type": "fact-sheet",
  "code": "<your JavaScript code>",
  "affected_field_key": "yourFieldKey",
  "affected_fact_sheet_type": "Application",
  "affected_fact_sheet_id": "uuid-of-test-fact-sheet"
}
```

For relation-targeted calculations, use `type: "relation"` with `affected_relation_name` plus either `affected_from_fact_sheet_id` + `affected_to_fact_sheet_id` (recommended — both UUIDs are available via `get_fact_sheet_details`) or a known `affected_relation_id`.

This executes the code in a sandbox and returns the input data, raw result, and a `success` flag — no calculation is created or modified. `success=false` means the code ran but produced an invalid value for the target field (not a crash).

> **Before calling:** verify `affected_field_key` exists on the target fact sheet type via `get_fact_sheet_details`.

---

## Categories

| Category | Scripts | Description |
|----------|---------|-------------|
| [basic/](#basic) | 3 | Simple starter calculations |
| [counting/](#counting) | 4 | Relation counting patterns |
| [aggregation/](#aggregation) | 5 | Sum, average, min/max |
| [status-derivation/](#status-derivation) | 5 | Derive status from fields |
| [date-calculations/](#date-calculations) | 4 | Date math and comparisons |
| [string-operations/](#string-operations) | 4 | Text manipulation |
| [multi-select/](#multi-select) | 3 | Collect values into arrays |
| [conditional-logic/](#conditional-logic) | 4 | Complex if-then patterns |
| [completeness/](#completeness) | 3 | Data quality checks |

**Total: 35 examples**

---

## basic/

Starter calculations for learning the patterns.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `hello-world.js` | String | Returns a static value |
| `echo-field.js` | String | Echoes another field's value |
| `simple-count.js` | Integer | Basic relation count |

---

## counting/

Patterns for counting relations.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `count-linked-itcs.js` | Integer | Count IT Components |
| `count-active-relations.js` | Integer | Count relations with active lifecycle |
| `count-by-usage-type.js` | Integer | Count by relation attribute |
| `count-with-threshold.js` | Single Select | Return category based on count |

---

## aggregation/

Sum, average, and extremes from relations.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `sum-annual-costs.js` | Double | Sum costs from ITCs |
| `average-rating.js` | Double | Average numeric field |
| `min-eol-days.js` | Integer | Days to earliest EOL |
| `max-user-count.js` | Integer | Max users across relations |
| `weighted-average.js` | Double | Weighted average calculation |

---

## status-derivation/

Derive status fields from other data.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `criticality-to-status.js` | Single Select | Map criticality to status |
| `worst-case-status.js` | Single Select | Worst status from relations |
| `best-case-rating.js` | Single Select | Best rating from providers |
| `lifecycle-to-flag.js` | Single Select | Lifecycle phase to flag |
| `majority-category.js` | Single Select | Most common category |

---

## date-calculations/

Date math and comparisons.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `days-to-eol.js` | Integer | Days until EOL |
| `days-since-creation.js` | Integer | Age in days |
| `age-in-months.js` | Integer | Age in months |
| `earliest-related-eol.js` | Integer | Min days to related EOL |

---

## string-operations/

Text concatenation and manipulation.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `display-label.js` | String | Name + version + status |
| `provider-list.js` | String | Comma-separated providers |
| `summary-text.js` | String | Generate summary from fields |
| `id-prefix.js` | External ID | Auto-generated ID |

---

## multi-select/

Collect values into multi-select fields.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `collect-categories.js` | Multiple Select | Unique ITC categories |
| `collect-provider-types.js` | Multiple Select | Provider types from relations |
| `collect-risk-flags.js` | Multiple Select | Risk flags from conditions |

---

## conditional-logic/

Complex decision logic.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `retirement-eligibility.js` | Single Select | Multi-factor retirement check |
| `risk-level.js` | Single Select | Score-based risk level |
| `tech-debt-score.js` | Double | Weighted multi-factor score |
| `approval-required.js` | Single Select | Determine if approval needed |

---

## completeness/

Data quality and completeness checks.

| Script | Target Type | Description |
|--------|-------------|-------------|
| `field-completeness.js` | Double | Percentage of fields filled |
| `relation-coverage.js` | Single Select | Relation coverage status |
| `data-quality-score.js` | Double | Weighted quality score |

---

## Usage

### Create a Calculation

Use the `calculations-toolkit` skill — it guides you through code generation, test-run validation, and creation via the LeanIX Calculations MCP tools.

### Customize Before Using

1. Open the script file
2. Update field names to match your workspace
3. Adjust logic as needed
4. Create using the steps above

### Common Customizations

| What to Change | Where |
|----------------|-------|
| Relation name | `data.relXxxToYyy` |
| Field name | `data.fieldName` or `r.factsheet?.fieldName` |
| Enum values | Mapping objects |
| Thresholds | Constants at top of script |

---

## Finding the Right Script

| I want to... | Use this script |
|--------------|-----------------|
| Count related fact sheets | [count-linked-itcs.js](counting/count-linked-itcs.js) |
| Count only active relations | [count-active-relations.js](counting/count-active-relations.js) |
| Count by relation attribute | [count-by-usage-type.js](counting/count-by-usage-type.js) |
| Return category based on count | [count-with-threshold.js](counting/count-with-threshold.js) |
| Sum numeric values from relations | [sum-annual-costs.js](aggregation/sum-annual-costs.js) |
| Calculate average from relations | [average-rating.js](aggregation/average-rating.js) |
| Find minimum value | [min-eol-days.js](aggregation/min-eol-days.js) |
| Find maximum value | [max-user-count.js](aggregation/max-user-count.js) |
| Calculate weighted average | [weighted-average.js](aggregation/weighted-average.js) |
| Find worst status from relations | [worst-case-status.js](status-derivation/worst-case-status.js) |
| Find best rating from relations | [best-case-rating.js](status-derivation/best-case-rating.js) |
| Find most common value | [majority-category.js](status-derivation/majority-category.js) |
| Map criticality to status | [criticality-to-status.js](status-derivation/criticality-to-status.js) |
| Derive flag from lifecycle | [lifecycle-to-flag.js](status-derivation/lifecycle-to-flag.js) |
| Calculate days until EOL | [days-to-eol.js](date-calculations/days-to-eol.js) |
| Calculate age in days | [days-since-creation.js](date-calculations/days-since-creation.js) |
| Calculate age in months | [age-in-months.js](date-calculations/age-in-months.js) |
| Find earliest related EOL | [earliest-related-eol.js](date-calculations/earliest-related-eol.js) |
| Concatenate text from fields | [display-label.js](string-operations/display-label.js) |
| Create comma-separated list | [provider-list.js](string-operations/provider-list.js) |
| Generate summary text | [summary-text.js](string-operations/summary-text.js) |
| Generate auto-ID | [id-prefix.js](string-operations/id-prefix.js) |
| Collect unique values into multi-select | [collect-categories.js](multi-select/collect-categories.js) |
| Collect provider types | [collect-provider-types.js](multi-select/collect-provider-types.js) |
| Collect risk flags | [collect-risk-flags.js](multi-select/collect-risk-flags.js) |
| Calculate completeness percentage | [field-completeness.js](completeness/field-completeness.js) |
| Check relation coverage | [relation-coverage.js](completeness/relation-coverage.js) |
| Calculate data quality score | [data-quality-score.js](completeness/data-quality-score.js) |
| Calculate weighted score | [tech-debt-score.js](conditional-logic/tech-debt-score.js) |
| Determine risk level | [risk-level.js](conditional-logic/risk-level.js) |
| Check retirement eligibility | [retirement-eligibility.js](conditional-logic/retirement-eligibility.js) |
| Determine if approval needed | [approval-required.js](conditional-logic/approval-required.js) |
| Start with the simplest example | [hello-world.js](basic/hello-world.js) |
| Echo another field's value | [echo-field.js](basic/echo-field.js) |

---

## Scripts by Complexity

### Beginner
Start here if you're new to LeanIX calculations:
- [hello-world.js](basic/hello-world.js) - Returns a static value
- [echo-field.js](basic/echo-field.js) - Copies one field to another
- [simple-count.js](basic/simple-count.js) - Basic relation count

### Intermediate
Common patterns you'll use frequently:
- [count-linked-itcs.js](counting/count-linked-itcs.js) - Count relations
- [sum-annual-costs.js](aggregation/sum-annual-costs.js) - Sum values
- [days-to-eol.js](date-calculations/days-to-eol.js) - Date math
- [collect-categories.js](multi-select/collect-categories.js) - Multi-select

### Advanced
Complex logic and multi-factor calculations:
- [tech-debt-score.js](conditional-logic/tech-debt-score.js) - Weighted scoring
- [retirement-eligibility.js](conditional-logic/retirement-eligibility.js) - Multi-factor decision
- [field-completeness.js](completeness/field-completeness.js) - Completeness checks
