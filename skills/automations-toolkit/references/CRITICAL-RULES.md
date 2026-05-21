# LeanIX Run Script Automations

JavaScript (ECMAScript 2023) automation scripts for LeanIX.

- **Working code:** `examples/`

## Critical Rules

**Save-time validation rejects scripts that violate these. Fix before deploying:**

- **Must export `main`** — one of `export function main()`, `export async function main()`, or `export const main = (...) => ...`. Re-export (`function main(){}; export { main }`) and default export forms fail.
- **`main()` takes zero parameters** — `data` and `context` are injected globals at runtime, not function parameters. `function main(data)` is rejected.
- **`async main()` requires at least one `await`** — drop `async` if there isn't one (`require-await` lint rule).
- **No `import` statements** — runner uses `--frozen --no-remote`. Only `fetch`, `data`, `context`, and standard JS built-ins are available.
- **No top-level `await`** — `await` only works inside the `async main()` body.
- **No TS-style type annotations** in `.js` files (e.g. `function f(x: string)`).

**Runtime behavior (script saves but fails when it runs):**

- **Globals deleted before execution:** `Deno`, `WebAssembly`, `setTimeout`, `setInterval`, `eval`, `Function` constructor — calling any throws `ReferenceError`.
- **`console.log` / `console.error` are captured**, not blocked. Output lands in the execution result's `stdout` / `stderr`, which is NOT shown prominently in the Automations UI. For visible failure, `throw new Error(...)`.
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
| Edge/node access | `(rel?.edges \|\| []).map(e => e?.node?.factSheet).filter(Boolean)` (or equivalent `for...of`) |
| Type-specific fields | `... on Application { relApplicationToITComponent { } }` |
| Clear a field | `return { fieldName: null }` |
| Revision type | `$rev: Long!` (number, not string) |
| Subscription filter | `type === "RESPONSIBLE" && roles.some(r => r?.name === "...")` (or equivalent `for...of`) |

## Common Errors

| Error | Fix |
|-------|-----|
| `Function 'main' must be exported` | Use `export function main()` or `export async function main()`; re-export and default export forms fail. |
| `Function 'main' takes no parameters` | Drop the parameter — `data` and `context` are injected globals, not parameters. |
| `Async function 'main' has no await expression` | Drop `async`, or add an `await` (e.g. `fetch`). `require-await` blocks save. |
| `TS2307: Cannot find module` | No `import` allowed — runner is `--frozen --no-remote`. |
| `ReferenceError: Deno is not defined` (and `setTimeout`, `setInterval`, `eval`, `Function`, `WebAssembly`) | These globals are deleted at runtime. Use `fetch` for I/O. |
| `Field 'rel...' undefined` | Wrap in `... on Application { }` |
| Revision conflict | Track `currentRev` after each mutation |
| Subscriptions array empty | `data.factSheet.subscriptions` is always empty; fetch via GraphQL |
| Trigger info unavailable | `data.trigger` not available in Run Script; use `data.factSheet.{fieldName}` |
| Dynamic email recipients needed | SEND_EMAIL_V2 uses fixed recipients; use To-Do API for dynamic notifications |
| Dynamic webhook payload needed | SEND_USER_WEBHOOK only passes tag; use `fetch()` in script for custom webhooks |

## Key Patterns

**Multi-relation tie-breaker** (when fact sheet links to multiple related items):
```javascript
const statuses = [];
for (const edge of (app.relApplicationToInitiative?.edges || [])) {
  const status = edge?.node?.factSheet?.initiativeStatus;
  if (status) statuses.push(status);
}

if (statuses.length === 0) return { permission: null };  // Clear if none

let hasBlocked = false;
let allActive = statuses.length > 0;
for (const s of statuses) {
  if (s === "blocked") hasBlocked = true;
  if (s !== "active") allActive = false;
}
if (hasBlocked) return { permission: "no" };   // Any blocked wins
if (allActive)  return { permission: "yes" };  // All must be active
```

**Idempotency** (prevent duplicates on re-run):
```javascript
const existingKeys = new Set();
for (const e of existing) {
  existingKeys.add(e.roleId + "|" + e.userId);
}
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
