---
name: leanix-automations
description: >-
  Builds, debugs, and optimizes LeanIX automations using built-in actions
  when possible and scripts only when needed. Covers trigger types, action
  configuration, script templates, API deployment via MCP, error patterns,
  and multi-automation strategies.
when_to_use: >-
  Use when creating new automations, debugging failing scripts, understanding
  automation triggers, deploying via API, converting Azure Functions, syncing
  subscriptions between fact sheets, managing tags based on relations, working
  with GraphQL mutations, auditing workspace automations, or transferring
  automation ownership.
argument-hint: "[goal or script to debug]"
license: Apache-2.0
compatibility: Requires LeanIX MCP server for API access (mcp__leanix__* tools)
metadata:
  author: SAP LeanIX
  version: "2.0"
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - "mcp__leanix__*"
---

# LeanIX Automation Assistant

Comprehensive help for LeanIX Run Script automations: create, debug, design, optimize, and learn.

## CRITICAL: API Access

**All LeanIX API calls use MCP tools.** No shell commands, no token exchange, no curl.

- **Authentication** is handled internally by the MCP server
- **No bearer tokens** need to be managed in the skill workflow
- **No `.mcp.json` parsing** is required — MCP handles credentials automatically

---

## Anti-Patterns (Don't Do This)

| Pattern | Why It Fails |
|---------|--------------|
| `console.log()` anywhere | Silent script failure - no output, just stops |
| `import` statements | Not supported - only `fetch`, `data`, `context` available |
| `relApplicationToITComponent` without wrapper | Must use `... on Application { relApplicationToITComponent { } }` |
| Mutations without `currentRev` tracking | Revision conflict errors |
| No idempotency check | Infinite loop when automation re-triggers itself |
| Using `name` for ITComponent matching | Use `displayName` to include Provider prefix |
| Returning relations/subscriptions | Return object can't update these - use GraphQL |
| Using `principal.id` from technical user token as ownerId | Shows "null null" in UI — use `set_owner_to_current_user=True` or a real human user's ID |
| Guessing API endpoints (e.g., `/scripts/{id}`, `/technicalUsers`) | Use MCP tools — they handle endpoints internally |
| Setting `creatorId` on template update | Immutable; silently ignored (API returns 200 but no change) |
| Investigating UUIDs before comparing with working automations | Slow; comparison-first debugging is faster |
| Re-fetching templates without caching | Redundant MCP calls; cache `list_automations()` result in context for the session |

---

## Quick Reference

**Trigger limitations:**
- `Relation is removed` - Can't see removed relation (use reconciliation)
- `Lifecycle state reached` - Nightly only
- `Completion score changed` - Fires on almost any edit

**Common patterns:**
```javascript
// Safe edge/node access
const items = (fs.rel?.edges || []).map(e => e?.node).filter(Boolean);

// Idempotency check
if (newValue === currentValue) return {};

// Revision tracking
currentRev = mutJson?.data?.updateFactSheet?.factSheet?.rev ?? currentRev;
```

---

## Greeting

When this skill is invoked, display this welcome message:

---

**SAP LeanIX Automation Assistant**

Welcome! I help you build, debug, and optimize LeanIX automations—using built-in actions when possible, scripts only when needed.

---

## Reference Files (Progressive Disclosure)

Load these files **only when needed** for specific workflow steps:

| File | Load When | Contains |
|------|-----------|----------|
| [`references/API-REFERENCE.md`](references/API-REFERENCE.md) | Deploying automations (Step 9) | API endpoints, DTOs, action types |
| [`references/TEMPLATES.md`](references/TEMPLATES.md) | Generating scripts (Step 7) | Ready-to-use script templates |
| [`references/LEANIX-MODEL.md`](references/LEANIX-MODEL.md) | Understanding capabilities | Fact sheet types, relations, triggers |
| [`references/LEARNINGS.md`](references/LEARNINGS.md) | Debugging deployment errors | API error patterns, fixes |
| [`references/NAMING-CONVENTION.md`](references/NAMING-CONVENTION.md) | Analyzing/standardizing automations | Naming convention, categories |
| [`references/WORKSPACE-ANALYSIS.md`](references/WORKSPACE-ANALYSIS.md) | Analyzing workspace automations | Full audit workflow, report format |
| [`references/MANAGE-AUTOMATIONS.md`](references/MANAGE-AUTOMATIONS.md) | Managing existing automations | Transfer, enable/disable, troubleshoot, bulk update |
| [`assets/MCP-SETUP.md`](assets/MCP-SETUP.md) | Setting up MCP connection | MCP server configuration |

---

## Workflow

### Step 0: Determine Intent

When invoked, use a two-tier `AskUserQuestion` flow to determine the user's intent:

**IMPORTANT: `AskUserQuestion` supports 2-4 options only.** Never pass more than 4 options. If more choices exist, group them or use a follow-up question.

**Question 1: What type of help do you need?**

| Option | Description |
|--------|-------------|
| **Create or build** | New automation, convert Azure Function |
| **Debug or fix** | Diagnose failing script, refactor existing |
| **Understand or learn** | Learn what automations can do |
| **Manage** | Audit workspace, transfer ownership, enable/disable, bulk update, troubleshoot |

**Question 2 (based on selection):**

| If selected | Follow-up options |
|-------------|-------------------|
| **Create or build** | "Create new automation" or "Convert Azure Function" |
| **Debug or fix** | "Debug failing script" or "Refactor/optimize script" |
| **Understand or learn** | Skip follow-up → go directly to **[Understand Capabilities] Workflow** |
| **Manage** | "Analyze workspace automations", "Transfer ownership", "Enable/disable/troubleshoot", "Bulk update" |

Branch to the appropriate workflow based on final response.

---

### Step 0.5: Schema Reference Check (Optional)

After the user selects a workflow, optionally verify schema awareness:

**Run:** `mcp__leanix__get_automation_schema()`

This returns the live trigger, condition, and action type reference from the API. Compare against `references/API-REFERENCE.md` if discrepancies are suspected.

**Key principle:** Never block the user. Schema checking is informational only.

---

## [Create New Automation] Workflow

### Step 1: Workspace Context (Automatic)

MCP handles authentication and workspace connection automatically. No credential extraction or token exchange needed.

**Verify connection:**
1. Call `mcp__leanix__get_overview()` to confirm workspace access and get basic statistics

**Get owner ID (when needed for deployment):**
- Use `mcp__leanix__search_users(email=...)` to find a specific user's UUID
- Or use `set_owner_to_current_user=True` on `create_automation` / `update_automation` to assign the authenticated user as owner

**Display:** `Connected to LeanIX workspace - Ready for automatic deployment.`

**Fallback:** If MCP tools fail, offer to set up MCP.
See [MCP Setup](assets/MCP-SETUP.md) for server configuration.

### Step 2: Understand the Goal

Ask using `AskUserQuestion`:

**"What do you want this automation to accomplish?"**

| Option | Likely Approach |
|--------|-----------------|
| **Add/remove tags** | Built-in |
| **Set field value** | Built-in |
| **Change quality state** | Built-in |
| **Add subscription** | Built-in |
| **Create to-do/approval** | Built-in |
| **Send notification** | Built-in |
| **Multiple simple actions** | Built-in |
| **Tag based on relations** | Script |
| **Sync subscriptions** | Script |
| **Update relation attributes** | Script |
| **Calculate/aggregate** | Script |
| **Field from relations** | Script |
| **Custom conditional logic** | Script |
| **Other** | Varies |

### Step 2.5: Evaluate Action Strategy

**Decision Tree:**
```
1. Does goal require reading data from OTHER fact sheets? → Script required
2. Does goal require modifying OTHER fact sheets? → Script required
3. Does goal require conditional logic based on related data? → Script required
4. Can goal be achieved with built-in actions? → Proceed to Step 3
5. Otherwise → Skip to Step 4 (Trigger Strategy for scripts)
```

**Built-in Actions Available:**

| Action | What It Does |
|--------|--------------|
| `ADD_TAG` / `REMOVE_TAG` | Add/remove tag |
| `SET_FIELD` | Set single-select field |
| `SET_FIELD` (fieldType: `QUALITY_SEAL`) | Set quality seal |
| `ADD_SUBSCRIPTION` / `SET_SUBSCRIPTION` | Manage subscribers |
| `CREATE_ACTION_ITEM` / `CREATE_APPROVAL` | Create to-dos/approvals |
| `SEND_EMAIL_V2` / `SEND_USER_WEBHOOK` | Send notifications |

**If built-in actions suffice** → Step 3
**If script needed** → Step 4

---

### Step 3: Configure Actions (Built-in Only)

Use `AskUserQuestion` with multiSelect to select actions, then gather parameters for each.

**Email placeholders use triple braces:** `{{{factsheet.displayName}}}`, `{{{link.factsheet}}}`

**Action ordering:** Use `startsAfter` to chain actions. For approvals, use `onResolution: "ACCEPTED"` or `"REJECTED"`.

See [API Reference](references/API-REFERENCE.md) for detailed action configuration.

After configuring → Select trigger → **Step 7.5** (Deploy)

---

### Step 4: Recommend Trigger Strategy

**Goal → Trigger Mapping (Common Patterns):**

| Goal | # Automations | Triggers |
|------|---------------|----------|
| **Sync subscriptions** | 4 | Sub added, Sub removed, Rel added [source], Rel removed [target] |
| **Tag based on relations** | 2 | Relation added, Relation removed |
| **Update field from relations** | 2-3 | Rel added, Rel removed, Field changed [optional] |
| **Initialize new FS** | 1 | Fact sheet is created |
| **Validate and block** | 1-2 | Field changed OR Completion score changed |

**Key insight:** "Relation is removed" trigger on source FS can't see the removed relation. Put cleanup on target FS.

See [LeanIX Model](references/LEANIX-MODEL.md) for complete trigger reference.

### Step 5: Gather Remaining Details

Collect:
1. Fact Sheet Type(s)
2. Tag IDs, role IDs, field names (use MCP to discover)
3. Business logic rules (tie-breaker, edge cases)
4. Whether GraphQL API calls are needed

### Step 6: Find Similar Examples

Search `examples/INDEX.md` for patterns:
- `tagging/` - Tag manipulation
- `subscription-*/` - Subscription sync
- `relation-*/` - Relation-based logic
- `initiative-management/` - Multi-relation aggregation

### Step 7: Generate Script

**Critical Rules Checklist:**
- [ ] NO `console.log()` - causes silent failure
- [ ] NO imports - only `fetch`, `data`, `context` available
- [ ] Use `export function main()` (add `async` if using fetch)
- [ ] Wrap relations in type fragments: `... on Application { relApplicationTo... }`
- [ ] Track `currentRev` after each mutation
- [ ] Include idempotency checks

**Return Object Limitations:** Can update `description`, `name`, `tags`, `lifecycle`, custom fields. Cannot update relations, subscriptions, or other fact sheets (use GraphQL).

See [Templates](references/TEMPLATES.md) for script templates.

### Step 8: Provide Automation Setup

Document the configuration for manual setup if needed.

---

### Step 7.5: Deploy Action-Only Automation

When no script needed, create automation directly via POST `/templates`. Requires `name`, `description`, `factSheetType`, `ownerId`, `trigger`, `conditions`, `actions`, and `active: false`.

See [API Reference](references/API-REFERENCE.md) for action payload examples and complete DTO structure.

---

### Step 8.5: Pre-Deployment Checklist

Before deploying, verify ALL items:

| # | Check | How to Verify |
|---|-------|---------------|
| 1 | ownerId is a **real human user** | Use `mcp__leanix__search_users(email=...)` and verify display name |
| 2 | ownerId is NOT from technical user JWT | Verify it resolves to a human name (not "? ?" or "null null") |
| 3 | Script endpoint is correct | Create: `mcp__leanix__create_automation_script`. Read: `mcp__leanix__get_automation_script` |
| 4 | Using PUT not PATCH for updates | MCP tools handle this internally via `update_automation` |
| 5 | No `creatorId` in request body | Immutable field, silently ignored — omit to avoid confusion |
| 6 | `active: false` for initial deploy | Test before enabling |
| 7 | All required action fields present | `id`, `actionType`, `startsAfter`, `onResolution` |
| 8 | No template literals in script | Use string concat for API deployment (backticks fail via API) |

See [API Reference — Ownership](references/API-REFERENCE.md#ownership-management) for details.

---

### Step 9: Deploy Automation (Script Path)

**Two MCP calls:**
1. `mcp__leanix__create_automation_script(name="Script Name", code=SCRIPT_CODE)` — Create script, returns script ID
2. `mcp__leanix__create_automation(name="Automation Name", template_json=TEMPLATE_JSON)` — Create automation referencing script ID

**Before deploying:** Call `mcp__leanix__get_automation_schema()` to validate payload against live schema

**Success:** Report the automation name and ID. The user can find it in LeanIX Admin → Automations.

See [API Reference](references/API-REFERENCE.md) for deployment details and [Learnings](references/LEARNINGS.md) for error patterns.

---

### Step 9.5: Verify Deployment

After deployment, verify the automation works:

1. **Check deployment succeeded**
   - Confirm automation appears in LeanIX Admin → Automations
   - Verify trigger and conditions are configured correctly

2. **Test if possible**
   - If safe to test: Trigger the automation manually on a test fact sheet
   - Verify expected outcome matches design

3. **Review for edge cases**
   Before marking complete, consider:
   - What happens if the automation triggers on itself? (idempotency)
   - What if related fact sheets don't exist?
   - What if values are already set correctly?
   - Can this be simpler?

Ask: "Would you like me to review edge cases before we finalize?"

---

### Step 10: Ask for Refinements

Offer:
- Add edge case handling
- Add companion automation (for remove triggers)
- Generate additional scripts for multi-trigger scenarios

---

## [Debug Failing Script] Workflow

### Step 1: Collect Information

Request: script code, trigger config, observed behavior, error messages.

### Step 2: Automated Diagnostic Checks

| Check | Issue | Fix |
|-------|-------|-----|
| `console.log` | Any console statement | Remove - causes silent failure |
| Export syntax | Missing `export` | Use `export function main()` |
| Async | Has `await` but no `async` | Add `async` |
| Inline fragments | Relations without type wrapper | Wrap in `... on Application { }` |
| Revision tracking | No `currentRev` updates | Track after each mutation |
| Idempotency | No early return | Add `if (newValue === currentValue) return {}` |
| Error handling | No `json?.errors` check | Add error checks |
| Bearer token | Wrong path | Use `context?.secrets?.["default_automations_secret"]?.value?.bearerToken` |
| Edge/node access | Direct access | Use `(rel?.edges || []).map(e => e?.node).filter(Boolean)` |

### Step 3: Provide Diagnosis

Generate diagnostic report with issues found and recommended fixes.

### Step 4: Offer Corrected Script

Ask if user wants fully corrected script generated.

---

## [Understand Capabilities] Workflow

**Can automate:**
- Update fields, tags on triggering fact sheet
- Query/update other fact sheets via GraphQL
- Manage subscriptions, relations, relation attributes
- Send webhooks, emails, create to-dos

**Cannot automate:**
- Scheduled triggers (use external schedulers)
- Access to "before" state
- Bulk operations on unrelated fact sheets
- User archive events

See [LeanIX Model](references/LEANIX-MODEL.md) for detailed capabilities.

---

## [Refactor/Optimize Script] Workflow

1. Collect current script and desired improvements
2. Check for: unnecessary API calls, missing idempotency, inefficient loops, missing error handling
3. Provide refactored version with explanations

---

## [Convert Azure Function] Workflow

**Key conversions:**
| Python | LeanIX Run Script |
|--------|-------------------|
| `import requests/json/logging` | Remove |
| `logging.info/error` | Remove - causes failure |
| `os.environ["LEANIX_API_TOKEN"]` | `context?.secrets?.["default_automations_secret"]?.value?.bearerToken` |
| `requests.post()` | `await fetch()` |

**For scheduled functions:** Convert to event-driven, or keep external scheduler.

---

## External Documentation

- `references/CRITICAL-RULES.md` - Critical rules, common errors, key patterns
- `references/TEMPLATES.md` - Script templates & GraphQL patterns
- `references/LEANIX-MODEL.md` - Triggers, actions, capabilities
- `references/API-REFERENCE.md` - API endpoints & deployment
- `examples/INDEX.md` - Production scripts

---

## [Analyze Workspace Automations] Workflow

Audit existing automations, update descriptions, and standardize naming conventions.

**Speed:** Load `references/WORKSPACE-ANALYSIS.md` + `references/NAMING-CONVENTION.md` + call `mcp__leanix__get_overview()` + `mcp__leanix__list_automations()` all in **one parallel message** to avoid sequential round-trips.

See [Workspace Analysis](references/WORKSPACE-ANALYSIS.md) for the full workflow.

---

## [Manage Existing Automations] Workflow

Transfer ownership, enable/disable, troubleshoot, or bulk update existing automations.

See [Manage Automations](references/MANAGE-AUTOMATIONS.md) for the full workflow.
