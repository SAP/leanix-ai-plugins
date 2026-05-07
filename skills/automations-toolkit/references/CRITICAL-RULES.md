# LeanIX Run Script Automations

JavaScript (ECMAScript 2023) automation scripts for LeanIX.

- **Working code:** `examples/`

## Critical Rules

**IMPORTANT: These cause silent failures if violated:**

- **NO `console.log()`** - Scripts fail silently with any console statements
- **NO imports** - Only `fetch`, `data`, `context` are available globally
- **All scripts** → `export function main() { }` wrapper required
- **Scripts with fetch** → add `async`: `export async function main() { }`
- **Cancel subsequent actions** → `throw new Error("cancel automation flow");`

```javascript
// Simple script (no API calls)
export function main() {
  if (!data.factSheet.tags?.includes("TAG")) {
    return { tags: [...(data.factSheet.tags ?? []), "TAG"] };
  }
  return {};
}

// Script with API calls
export async function main() {
  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const res = await fetch("https://INSTANCE.leanix.net/services/pathfinder/v1/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return {};
}
```

## Quick Reference

| Pattern | Code |
|---------|------|
| Edge/node access | `(rel?.edges \|\| []).map(e => e?.node).filter(Boolean)` |
| Type-specific fields | `... on Application { relApplicationToITComponent { } }` |
| Clear a field | `return { fieldName: null }` |
| Revision type | `$rev: Long!` (number, not string) |
| Subscription filter | `type === "RESPONSIBLE"` then `roles.some(r => r.name === "...")` |

## Common Errors

| Error | Fix |
|-------|-----|
| Script fails silently | Remove all `console.log()` |
| `'main' is not defined` | Use `export function main()` (add `async` if using fetch) |
| `Field 'rel...' undefined` | Wrap in `... on Application { }` |
| Revision conflict | Track `currentRev` after each mutation |
| Subscriptions array empty | `data.factSheet.subscriptions` is always empty; fetch via GraphQL |
| Trigger info unavailable | `data.trigger` not available in Run Script; use `data.factSheet.{fieldName}` |
| Dynamic email recipients needed | SEND_EMAIL_V2 uses fixed recipients; use To-Do API for dynamic notifications |
| Dynamic webhook payload needed | SEND_USER_WEBHOOK only passes tag; use `fetch()` in script for custom webhooks |

## Key Patterns

**Multi-relation tie-breaker** (when fact sheet links to multiple related items):
```javascript
const statuses = (app.relApplicationToInitiative?.edges || [])
  .map(e => e?.node?.factSheet?.initiativeStatus)
  .filter(Boolean);

if (statuses.length === 0) return { permission: null };  // Clear if none
if (statuses.some(s => s === "blocked")) return { permission: "no" };  // Any blocked wins
if (statuses.every(s => s === "active")) return { permission: "yes" };  // All must be active
```

**Idempotency** (prevent duplicates on re-run):
```javascript
const existingKeys = new Set(existing.map(e => `${e.roleId}|${e.userId}`));
if (existingKeys.has(key)) continue;  // Skip if exists
```

## Working Examples

See `examples/` directory for production-tested scripts:

- `basic/hello-world.js` - Simple tag addition
- `tagging/energy-consumption-tagging.js` - Field-based tag assignment
- `tagging/relation-based-tagging.js` - Tag based on related fact sheet tags
- `data-processing/filter-applications.js` - Conditional return logic
- `utilities/data-validator.js` - Validation with abort
- `relation-management/obsolescence-risk-calculator.js` - Relation attributes
- `subscription-inheritance/app-owner-to-itc.js` - Subscription sync
- `initiative-management/initiative-status-permission-sync.js` - Multi-relation tie-breaker

## Triggers

Each automation needs ONE trigger type. Common ones:
- **Field value changed** - React to specific field (must select which field)
- **Subscription added/removed** - Select type + role
- **Relation added/removed** - Note: "removed" can't see the removed relation
- **Fact sheet created** - Initialize new items

## Return Object

**Can update via return object:** `description`, `name`, `tags`, `lifecycle`, custom fields

**Cannot update via return object (read-only):**
- `id`, `type`, `rev`, `level`, `completion`, `updatedAt`, `createdAt`
- Cannot delete: `name`

**Cannot update via return object (use GraphQL mutations instead):**
- Relations and fields on relations
- Subscriptions
- Location fields
- Other fact sheets

**Cancel subsequent actions in automation:**
```javascript
throw new Error("cancel automation flow");
```
