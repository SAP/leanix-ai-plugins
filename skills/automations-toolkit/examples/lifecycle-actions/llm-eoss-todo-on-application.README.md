# LLM End-of-Support → To-Do on related Application

## Use case

30 days before an IT Component (subtype "LLM") reaches vendor **End of (Standard) Support**, create a To-Do on each **related Application**, assigned to that Application's **Service Manager** (Responsible subscription), asking them to update the LLM.

## Why a Run Script (not built-in `CREATE_ACTION_ITEM`)

The built-in "Create To-Do" action only creates the To-Do on the **triggering fact sheet**. Here the trigger fires on the LLM IT Component but the To-Do has to live on the **related Application**, so the script calls the `/services/todo/v1/to-do` REST API directly.

## File

- Script: [`llm-eoss-todo-on-application.js`](./llm-eoss-todo-on-application.js)

## Manual setup in LeanIX (Admin → Automations → New)

1. **Name:** `LLM End of Support - Notify Application Service Manager (-30d)`
2. **Fact Sheet Type:** `IT Component`
3. **Trigger:** *Lifecycle phase reached*
   - Lifecycle field: `lifecycle`
   - Phase: `End of Life` *(or your custom "End of Standard Support" phase if defined)*
   - Date offset: **30 days BEFORE**
4. **Conditions:**
   - *Category* = `LLM`  *(adjust to whatever subtype field/value identifies LLMs in your workspace — could also be `WITH_TAGS` or a custom single-select)*
5. **Actions:**
   - Action type: **Run Script**
   - Paste the contents of `llm-eoss-todo-on-application.js`
6. Save with `Active = false` and test on a known LLM IT Component before enabling.

## Before you paste the script

The script is a **generic pattern** ("create idempotent To-Do on a related fact sheet for subscribed users") with a `CONFIG` block at the top. Defaults match the LLM EoSS use case described above; edit `CONFIG` to retarget for other scenarios.

### URL constants

Replace the literal `INSTANCE` in the three URL constants at the top of the file with your workspace subdomain (e.g. `app`, `us`, `demo-eu-1`). Find/replace works.

### `CONFIG` fields

| Field | What it controls | Default (LLM EoSS) |
|---|---|---|
| `sourceType` | GraphQL type of the triggering fact sheet | `"ITComponent"` |
| `relation` | Relation field on source pointing to targets | `"relITComponentToApplication"` |
| `subscriptionType` | `"RESPONSIBLE"` / `"ACCOUNTABLE"` / `"OBSERVER"` | `"RESPONSIBLE"` |
| `subscriptionRole` | Exact role label as configured in the workspace | `"Service Manager"` |
| `todoTitle` | Title template; `{sourceName}` / `{targetName}` substituted | LLM-specific copy |
| `todoDescription` | Description template; same placeholders. Plain text only — `<b>` tags render literally | LLM-specific copy |
| `externalIdPrefix` | Used to build `{prefix}:{sourceId}:{targetId}` for idempotency | `"llm-eoss"` |
| `todoDueDays` | Days from now to To-Do due date | `30` |

### Reuse examples

| Scenario | Edits |
|---|---|
| **Application EOL → notify Provider Account Managers** | `sourceType: "Application"`, `relation: "relApplicationToITComponent"` then chain... actually use a different pattern (Provider is two hops away) |
| **BC change → notify owning App's Architect** | `sourceType: "BusinessCapability"`, `relation: "relBusinessCapabilityToApplication"`, `subscriptionRole: "Architect"`, `subscriptionType: "OBSERVER"`, plus new title/description, plus new `externalIdPrefix` |
| **ITC EOL → notify owning Application's IT Owner** | Same as default but `subscriptionRole: "IT Owner"` and updated title/description |

> **Important:** when you change the use case, also change `externalIdPrefix` so the idempotency check doesn't collide with To-Dos from a different scenario sharing the same source/target IDs.

## Caveats to confirm with the customer

1. **Lifecycle triggers are nightly**, not real-time — the To-Do will appear on the next nightly run after the 30-day threshold is crossed.
2. **"End of (Standard) Support"** must map to a real **lifecycle phase** in their workspace. The 5 standard LeanIX phases are `plan / phaseIn / active / phaseOut / endOfLife`. If "End of Standard Support" is actually a **custom date field** rather than a lifecycle phase, this trigger won't fire and a different pattern (daily reconciliation) is needed.
3. **"LLM" subtype** must map to a filterable property — typically `category`, a custom single-select field, or a tag. Adjust the condition accordingly.

## Idempotency

The script is idempotent across nightly trigger re-fires. Each To-Do is created with a deterministic `externalId` of the form `llm-eoss:{itcId}:{appId}`. Before creating, the script calls `POST /services/todo/v1/to-do/query` filtered by those externalIds and states `OPEN` / `IN_PROGRESS`. If a matching open To-Do already exists, the new one is skipped. Once a To-Do is closed, a future trigger run *will* create a fresh one — that's the right behaviour if support has been extended or the date has shifted.

## Deployment

The MCP `automations` toolset wasn't enabled in this session, so this script was not auto-deployed. Either:

- Copy-paste the script into a new automation manually (steps above), **or**
- Re-enable the `automations` toolset and re-run `/automations-toolkit` to deploy via API:
  ```
  claude mcp remove leanix
  claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations"
  ```
