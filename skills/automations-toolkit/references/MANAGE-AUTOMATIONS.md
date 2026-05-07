# Manage Existing Automations

Transfer ownership, enable/disable, troubleshoot, or bulk update existing automations.

---

## Table of Contents

- [Step 1: Connect & Fetch All Templates](#step-1-connect--fetch-all-templates)
- [Step 2: Determine Sub-Task](#step-2-determine-sub-task)
- [Transfer Ownership](#sub-workflow-transfer-ownership)
- [Enable/Disable](#sub-workflow-enabledisable)
- [Troubleshoot](#sub-workflow-troubleshoot)
- [Bulk Update](#sub-workflow-bulk-update)

---

## Step 1: Connect & Fetch All Templates

Fetch all templates using MCP:

Call `mcp__leanix__list_automations()` to get all automation summaries (id, name, active status, trigger type).

For detailed information on specific automations, call `mcp__leanix__get_automation(template_id=ID)`.

**Cache these results in context.** Do not re-fetch unless explicitly needed.

## Step 2: Determine Sub-Task

Ask using `AskUserQuestion`:

**"What would you like to do with existing automations?"**

| Option | Description |
|--------|-------------|
| **Transfer ownership** | Change the owner of one or more automations |
| **Enable/disable** | Toggle automations on or off |
| **Troubleshoot** | Diagnose why an automation isn't working |
| **Bulk update** | Modify fields across multiple automations |

---

## Sub-Workflow: Transfer Ownership

1. **Identify target user** — Use `mcp__leanix__search_users(email=...)` to find the user
2. **Validate the user is real** — Confirm the lookup returns a human name (not "? ?" or empty)
3. **For each template to transfer:**
   - Call `mcp__leanix__update_automation(template_id=ID, owner_id=TARGET_UUID)`
   - The MCP tool handles GET-modify-PUT internally
4. **Verify** — Call `mcp__leanix__get_automation(template_id=ID)` and confirm `ownerId` changed

**MCP workflow:**
```
1. mcp__leanix__search_users(email="user@company.com")  → validate target
2. mcp__leanix__list_automations()  → get template IDs
3. For each: mcp__leanix__update_automation(template_id=ID, owner_id=TARGET_UUID)
```

**WARNING:** Never use a technical user UUID as ownerId — it shows "null null" in the UI.

---

## Sub-Workflow: Enable/Disable

1. **Select templates** from cached list
2. **For each template:**
   - Call `mcp__leanix__update_automation(template_id=ID, active=true)` or `active=false`
3. **Report** status changes

---

## Sub-Workflow: Troubleshoot

**Use comparison-first debugging protocol:**

1. **Fetch all templates** (use cached data)
2. **Find a WORKING automation** with a similar configuration (same trigger type, similar actions)
3. **Diff broken vs working** — Focus on these fields in order:
   - `ownerId` — Is it a real user? Does it resolve to a name?
   - `active` — Is the automation enabled?
   - `trigger` — Correct `eventType`? Correct `factSheetType`?
   - `conditions` — Any conditions blocking execution?
   - `actions` — Correct action types? Valid references (tagId, scriptId)?
4. **Only investigate deeper** (script code, trigger events, logs) AFTER comparison fails to reveal the issue

**Key signals:**
- Owner shows "null null" in UI → ownerId is a technical user; transfer to real user
- User lookup returns "? ?" → stop; this UUID doesn't resolve to a valid user
- Automation never fires → check trigger type and factSheetType match
- Automation fires but no effect → check script for `console.log()` (silent failure)

---

## Sub-Workflow: Bulk Update

1. **Select templates** — By name pattern, trigger type, factSheetType, or active status
2. **Select field to update** — `name`, `description`, `ownerId`, `active`, `factSheetType`
3. **Preview changes** — Show before/after for each template
4. **Confirm** with user before executing
5. **Execute** — For each template: `mcp__leanix__update_automation(template_id=ID, name=..., description=..., active=...)`
6. **Report** — Summary of successes and failures
