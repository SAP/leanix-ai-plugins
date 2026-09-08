# LeanIX Automations API Reference

> **Schema Source**: Use `mcp__leanix__get_automation_schema()` to retrieve the current Automations DTO schema.
>
> **Last Verified**: 2026-07-30 | **Spec Version**: v1 | **Status**: Current

> **IMPORTANT: Use MCP tools for all API interactions.** Do NOT use curl or shell commands.
> The curl examples below are for **documentation purposes only** — they show the raw REST API structure.
> In practice, always use the corresponding MCP tools:
> - `mcp__leanix__list_automations()` — GET /templates
> - `mcp__leanix__get_automation(template_id)` — GET /templates/{id}
> - `mcp__leanix__create_automation(name, template_json)` — POST /templates
> - `mcp__leanix__update_automation(template_id, ...)` — PUT /templates/{id}
> - `mcp__leanix__delete_automation(template_id)` — DELETE /templates/{id}
> - `mcp__leanix__create_automation_script(name, code)` — POST /scripts
> - `mcp__leanix__get_automation_script(script_id)` — GET script code
> - `mcp__leanix__update_automation_script(script_id, code)` — PUT /scripts/{id}
> - `mcp__leanix__get_automation_schema()` — get the Automations DTO schema reference
> - `mcp__leanix__trigger_automation(template_id, entity_ids)` — manually run an automation against 1-100 fact sheets (POST; returns 202 QUEUED, does NOT execute synchronously)
> - `mcp__leanix__list_automation_runs(...)` — execution log; filter by automation_ids, fact_sheet_ids, states, run_after/before; paginated (limit/offset)
> - `mcp__leanix__get_automation_run(run_id)` — one run's per-action outcomes (done/waiting/failed/skipped/queued) + timing
> - `mcp__leanix__search_users(email=...)` — User lookup

## Running Automations On Demand (`trigger_automation` → `list_automation_runs` → `get_automation_run`)

These three tools cover manual execution and run observability. **A 202 from `trigger_automation` means QUEUED/accepted — NOT executed.** Never report success off the 202; verify via `list_automation_runs`.

**Workflow:**
1. **Resolve names → ids.** `list_automations` for the automation, a fact-sheet search for entities. Never ask the user for a UUID.
2. **Confirm the automation is `active`.** An INACTIVE automation returns 202 but produces zero runs, no error.
3. **Confirm before triggering.** Side-effecting and NOT idempotent — re-running re-runs the actions. State what runs on how many fact sheets and get an OK. Never blind-retry on timeout; verify with `list_automation_runs` first.
4. **Trigger, then poll** `list_automation_runs(automation_ids=[id], fact_sheet_ids=[submitted], run_after=[just before trigger])` with backoff until the matched count is **stable across two consecutive polls**. Report per fact sheet by NAME.
5. **Explain missing runs** (see below).

**Why a submitted fact sheet may produce NO run** (silent — the backend records no skip reason):
- **Automation inactive** — rule this out first.
- **Condition not met** — e.g. `WITH_TAGS` unsatisfied. Manual runs bypass the trigger *event*, but conditions are still evaluated. Confirm via `get_automation` vs the fact sheet's state.

> A manual run **skips the trigger entirely** — you do NOT need to reproduce the triggering change (e.g. you can run a `FIELD_CHANGE`-on-`lifecycle` automation without actually changing the lifecycle). It jumps straight to conditions + actions.

> **Trigger-type sensitivity (empirically observed 2026-08-05, n=3 trigger types):** manual triggering ran automations with `TAG_ADDITION` and `QUALITY_STATE_CHANGE_TO` triggers (SUCCESS), but a `FIELD_CHANGE`-on-`lifecycle` automation produced **no run** across 3 fact sheets — including one with a prior SUCCESS run and satisfied `WITH_TAGS`, so neither fact sheet nor conditions explain it. Untested: RELATION_*, SUBSCRIPTION_*, COMPLETION_SCORE_CHANGE, LIFECYCLE_PHASE_CHANGE. Practical rule: `trigger_automation` is reliable for tag/state-driven automations; for a `FIELD_CHANGE` automation, if a manual trigger yields no run despite active status and met conditions, fall back to editing the fact sheet to fire it naturally.

> `(submitted − ran)` is only a candidate skip set AFTER the count is stable — before that it is processing lag. Nothing stuck shows as `IN_PROGRESS`; if you see zero rows in every state, it is not queued, it never ran.

---

## Public Endpoints Scripts Can Call

Scripts run with `fetch()` and can call these documented LeanIX product APIs directly (using the bearer token from the automations secret):

| Service | Endpoint | Purpose |
|---|---|---|
| Pathfinder GraphQL | `/services/pathfinder/v1/graphql` | Read/write fact sheet data, relations, subscriptions |
| To-Do API | `/services/todo/v1/to-do` | Create action items / approvals (auto-emails the assignee) |
| Webhooks | `/services/webhooks/v1/...` | Event subscriptions and deliveries |

For fact sheet query and mutation patterns, use GraphQL schema introspection or the query patterns in `LEANIX-MODEL.md`.

### Resolving a service's URL slug

The LeanIX display name of a service is **not** always the `{name}` segment used in its URL. Endpoints follow the pattern:

```
https://{INSTANCE}.leanix.net/services/{name}/v.../...
```

The `{name}` slug can differ from the display name (e.g. **Catalog** is served at `reference-data`, **Self-Built Software Discovery** at `technology-discovery`, **SAP Discovery** at `discovery-sap`).

To find the real slug for any service, open the **OpenAPI Explorer** in the product UI:

```
https://{INSTANCE}.leanix.net/openapi-explorer?urls.primaryName={DisplayName}
```

This is a user-accessible product page. Read the spec URL it loads — the `{name}` segment of that URL is the slug. The OpenAPI Explorer is the source of truth if a slug or version differs from the table below.

### Service slug reference

> Slugs and versions can change over time; the [OpenAPI Explorer](#resolving-a-services-url-slug) in your workspace is the authoritative source of truth. The mappings below were captured 2026-07-30.

Non-obvious mappings to note:
- **Catalog** → `reference-data` (shares the slug with **Reference Data**)
- **Self-Built Software Discovery** → `technology-discovery`
- **SAP Discovery** → `discovery-sap` (distinct from **Discovery SAP Extension** → `discovery-sap-extension`)
- **Discovery Linking V2** uses `/v2/` (slug `discovery-linking`)
- **Documents V1** and **V2** share the slug `documents` (different version segments)
- **Import Export** exposes 4 sub-APIs (Exports, Imports, OData, Onboarding) all under the single slug `import-export`

| Display name | URL slug (`{name}`) | Spec path |
|---|---|---|
| AI Inventory Builder | `ai-inventory-builder` | `/services/ai-inventory-builder/v1/docs` |
| Apptio Connector | `apptio-connector` | `/services/apptio-connector/v1/api-docs/swagger.json` |
| Automations | `automations` | `/services/automations/v1/api-json` |
| Calculations | `calculations` | `/services/calculations/v2/openapi.json` |
| Catalog | `reference-data` | `/services/reference-data/v1/openapi-catalog.json` |
| Data Products Discovery | `data-products-discovery` | `/services/data-products-discovery/v1/api-docs` |
| Discovery AI Agents | `discovery-ai-agents` | `/services/discovery-ai-agents/v1/openapi.json` |
| Discovery Linking V2 | `discovery-linking` | `/services/discovery-linking/v2/openapi.json` |
| Discovery SAP Extension | `discovery-sap-extension` | `/services/discovery-sap-extension/v1/assets/swagger.json` |
| Discovery SaaS | `discovery-saas` | `/services/discovery-saas/v1/openapi.json` |
| Documents V1 | `documents` | `/services/documents/v1/apiDocs/v1` |
| Documents V2 | `documents` | `/services/documents/v2/apiDocs/v2` |
| Impacts | `impacts` | `/services/impacts/v1/openapi.json` |
| Import Export — Exports | `import-export` | `/services/import-export/v1/exports/api-docs` |
| Import Export — Imports | `import-export` | `/services/import-export/v1/imports/api-docs` |
| Import Export — OData | `import-export` | `/services/import-export/v1/odata/api-docs` |
| Import Export — Onboarding | `import-export` | `/services/import-export/v1/onboarding/api-docs` |
| Integration API | `integration-api` | `/services/integration-api/v1/api-docs/swagger.json` |
| Integration Collibra | `integration-collibra` | `/services/integration-collibra/v1/openapi.json` |
| Integration ServiceNow | `integration-servicenow` | `/services/integration-servicenow/v2/api-docs/swagger.json` |
| Integration Signavio | `integration-signavio` | `/services/integration-signavio/v3/openapi.json` |
| Inventory Data Quality | `inventory-data-quality` | `/services/inventory-data-quality/v1/api-docs` |
| MTM | `mtm` | `/services/mtm/v1/openapi.json` |
| Managed Code Execution | `managed-code-execution` | `/services/managed-code-execution/v1/openapi` |
| Metrics | `metrics` | `/services/metrics/v2/openapi.json` |
| Navigation | `navigation` | `/services/navigation/v1/docs` |
| Notifications | `notifications` | `/services/notifications/v1/openapi.json` |
| Pathfinder | `pathfinder` | `/services/pathfinder/v1/api-docs/swagger.json` |
| Poll | `poll` | `/services/poll/v2/api-docs/swagger.json` |
| Recon | `recon` | `/services/recon/v1/openapi.json` |
| Reference Data | `reference-data` | `/services/reference-data/v1/openapi.json` |
| Reports | `reports` | `/services/reports/v1/docs/openapi.json` |
| SAP Discovery | `discovery-sap` | `/services/discovery-sap/v1/api-json` |
| Self-Built Software Discovery | `technology-discovery` | `/services/technology-discovery/v1/data-aggregator-bff/unified/openapi` |
| Storage | `storage` | `/services/storage/v1/swagger/swagger.json` |
| Survey | `survey` | `/services/survey/v1/openapi` |
| Synclog | `synclog` | `/services/synclog/v1/api-docs/swagger.json` |
| To-Do | `todo` | `/services/todo/v1/openapi.json` |
| Transformations | `transformations` | `/services/transformations/v1/docs` |
| Webhooks | `webhooks` | `/services/webhooks/v1/openapi.json` |

---

## Table of Contents

- [Public Endpoints Scripts Can Call](#public-endpoints-scripts-can-call)
  - [Resolving a service's URL slug](#resolving-a-services-url-slug)
  - [Service slug reference](#service-slug-reference)
- [API Endpoints](#api-endpoints)
- [Authentication & Permissions](#authentication--permissions)
- [Ownership Management](#ownership-management)
- [Scripts API](#scripts-api)
- [Managed Code Execution API (Read Script Code)](#managed-code-execution-api-read-script-code)
- [Workflow: Retrieving Script Code from Automations](#workflow-retrieving-script-code-from-automations)
- [Templates API (Automations)](#templates-api-automations)
- [Trigger Types (eventType enum)](#trigger-types-eventtype-enum)
- [Condition Types (conditionType enum)](#condition-types-conditiontype-enum)
- [Action Types (actionType enum)](#action-types-actiontype-enum)
- [Complete Deployment Example](#complete-deployment-example)
- [Error Handling](#error-handling)
- [Service-Layer Behaviors](#service-layer-behaviors)
- [Fact Sheet Types](#fact-sheet-types)
- [Relation Type Names](#relation-type-names)

API documentation for deploying automations programmatically.

---

## API Endpoints

### Base URL

```
https://{INSTANCE}.leanix.net/services/automations/v1
```

### Authentication

All endpoints require a bearer token:

```
Authorization: Bearer {BEARER_TOKEN}
```

**MCP tools handle authentication automatically** — token exchange and API calls are managed for you, so no manual token handling is needed when working through the MCP tools.

> **WARNING: ownerId**: When a token is issued from a **technical user / API token**, the token holder's ID is **NOT a valid ownerId**. Using it as `ownerId` causes the UI to show "null null" for the automation owner. Always use a real human user's account ID. See [Ownership Management](#ownership-management) below.

---

## Authentication & Permissions

### Token Types and Capabilities

| Token Type | Source | Templates API | Scripts API |
|------------|--------|---------------|-------------|
| **ADMIN** | Personal API Token / Technical User | Full access | Full access |
| **SUPERADMIN** | Personal API Token (SUPERADMIN user) | Full access | Full access |

### Required Field

**All automation templates require an `ownerId` field** — the account ID of the automation owner. This **MUST be a real human user's** account ID, not a technical user.

> **WARNING**: Technical user UUIDs are accepted by the API but display as "null null" in the LeanIX UI. If a user lookup returns "? ?" or a blank display name, it is likely a technical user — do NOT use that ID.

---

## Ownership Management

### How to Find a Valid ownerId

| Method | When to Use |
|--------|-------------|
| Copy from existing working automation | Best default — `GET /templates` → find one with a human owner |
| `search_users` MCP tool | Look up user by name or email |
| LeanIX admin | Ask for the correct account ID |
| `mcp__leanix__search_users(email=...)` | MCP tool lookup — check displayName is not blank/"? ?" |

### Field Mutability

| Field | Mutable | Notes |
|-------|---------|-------|
| `ownerId` | **Yes** | Can transfer ownership via GET → change ownerId → PUT |
| `creatorId` | **No** | Set at creation time. Updates are **silently ignored** (API returns 200 but value unchanged) |
| `id` | **No** | Server-generated UUID |
| `workspaceId` | **No** | Server-generated |

### Ownership Transfer Pattern

```javascript
// 1. GET current template
const template = await fetch(`/templates/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());

// 2. Change ONLY ownerId — never touch creatorId
template.ownerId = "new-human-user-uuid";

// 3. PUT back full template
await fetch(`/templates/${id}`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(template)
});
```

> **Never include `creatorId` in PUT requests.** It is immutable and silently ignored. Including it is harmless but misleading.

---

## Scripts API

Scripts are managed via the Automations service (create/update) and Managed Code Execution service (read code).

### Create Script

```
POST /scripts
```

**Request:**
```json
{
  "name": "My Automation Script",
  "description": "",
  "code": "export function main() { return {}; }"
}
```

**Response:**
```json
{
  "id": "script-uuid-here",
  "name": "My Automation Script",
  "description": "",
  "code": "export function main() { return {}; }",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

> **Note**: The `id` returned is the `scriptId` used in automation actions and for reading code from the Managed Code Execution service.

### Update Script

```
PUT /scripts/{id}
```

Updates an existing script's code. The script ID is the same as `scriptId` from automation actions.

**Request:**
```json
{
  "name": "My Updated Script",
  "description": "Updated description",
  "code": "export function main() { return { updated: true }; }"
}
```

**Response:**
```json
{
  "id": "script-uuid-here",
  "name": "My Updated Script",
  "description": "Updated description",
  "code": "export function main() { return { updated: true }; }",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T14:20:00Z"
}
```

> **Note**: Updating a script creates a new version. The automation using this script will automatically use the latest version.

---

## Managed Code Execution API (Read Script Code)

Script code is stored and versioned in the **Managed Code Execution** service, not the Automations service.

### Base URL

```
https://{INSTANCE}.leanix.net/services/managed-code-execution/v1
```

### Get Script Code

Retrieves the script code and version history.

```
GET /executionConfigurations/{scriptId}/code
```

**Response:**
```json
{
  "data": [
    {
      "id": "version-uuid-3",
      "executionConfigurationId": "script-uuid",
      "code": "export function main() {\n  // latest version\n  return {};\n}",
      "language": "JAVASCRIPT",
      "version": 3,
      "createdAt": "2026-01-09T19:52:09.404290Z"
    },
    {
      "id": "version-uuid-2",
      "executionConfigurationId": "script-uuid",
      "code": "export function main() {\n  // previous version\n  return {};\n}",
      "language": "JAVASCRIPT",
      "version": 2,
      "createdAt": "2026-01-08T10:30:00.000Z"
    },
    {
      "id": "version-uuid-1",
      "executionConfigurationId": "script-uuid",
      "code": "export function main() {\n  return {};\n}",
      "language": "JAVASCRIPT",
      "version": 1,
      "createdAt": "2026-01-07T10:30:00.000Z"
    }
  ]
}
```

**Fields:**
- `data` - Array of version objects, sorted newest first (highest version number)
- `data[0].code` - The latest/active script code
- `version` - Integer version number
- `executionConfigurationId` - The script UUID (matches scriptId from automation)
- `createdAt` - ISO 8601 timestamp of when the version was created

**Access pattern:** Use `data[0].code` to get the latest version's code.

### Example: Fetch Script Code (MCP)

```
mcp__leanix__get_automation_script(script_id="SCRIPT_UUID")
```

Returns versioned code array — `data[0].code` is the latest version.

---

## Workflow: Retrieving Script Code from Automations

To get the code for scripts used in automations, follow this two-step process:

### Step 1: Get Automation Templates

```
mcp__leanix__list_automations()
```

From the response, extract the `scriptId` from actions with `actionType: "SET_FACT_SHEET_FIELD_SCRIPT"`.

### Step 2: Get Script Code

```
mcp__leanix__get_automation_script(script_id="abc-123-def-456")
```

**Response:** Same versioned array as shown above — use `data[0].code` for latest.

---

## Templates API (Automations)

| Method | Path | Operation |
|--------|------|-----------|
| GET | `/templates` | Get all templates |
| POST | `/templates` | Create template |
| GET | `/templates/{id}` | Get single template |
| PUT | `/templates/{id}` | Update template |
| DELETE | `/templates/{id}` | Delete template (204) |
| PATCH | `/templates/{id}` | Toggles the `active` flag ONLY (body `{ "active": boolean }`); use PUT with the full body for all other changes |
| GET | `/instances` | Get all instances |
| GET | `/instances/quota` | Get quota usage |

### List All Automation Templates

```
GET /templates
```

**Response:**
```json
[
  {
    "id": "template-uuid-1",
    "name": "Tag Application on Creation",
    "description": "Adds NEW tag when Application is created",
    "factSheetType": "Application",
    "ownerId": "owner-account-id",
    "active": true,
    "trigger": {
      "eventType": "FACT_SHEET_CREATION"
    },
    "conditions": [],
    "actions": [...]
  },
  ...
]
```

**Use Cases:**
- Check for existing automations before creating new ones
- Find automations by name or fact sheet type
- Avoid duplicate automations

### Create Automation Template

```
POST /templates
```

**Request:**
```json
{
  "name": "Tag Application on Creation",
  "description": "Adds NEW tag when Application is created",
  "factSheetType": "Application",
  "ownerId": "owner-account-id-here",
  "trigger": {
    "eventType": "FACT_SHEET_CREATION"
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_SET_FACT_SHEET_FIELD_SCRIPT",
      "actionType": "SET_FACT_SHEET_FIELD_SCRIPT",
      "scriptId": "abc-123-def",
      "startsAfter": null,
      "onResolution": null
    }
  ],
  "active": false
}
```

> **Note:**
> - `ownerId` is **required** - the account ID of the automation owner
> - Use `active` (not `enabled`) to control automation state
> - Triggers use only `eventType` (not `type`)
> - Actions require `id`, `actionType`, `startsAfter`, and `onResolution` fields

### CreateAutomationTemplateDto (Complete Structure)

```typescript
{
  name: string;                    // required
  factSheetType: string;           // required
  description: string;             // required
  active: boolean;                 // required
  ownerId: string (uuid);          // required
  trigger: TriggerDto;             // required, oneOf trigger types
  conditions: ConditionDto[];      // required, 0-100 items
  actions: ActionDto[];            // required, 1-100 items
}
```

### AutomationTemplateResponse (Additional Fields)

```typescript
{
  id: string (uuid);               // server-generated
  workspaceId: string (uuid);      // server-generated
  creatorId: string (uuid);        // server-generated
  // ... plus all CreateAutomationTemplateDto fields
}
```

---

## Trigger Types (eventType enum)

| eventType | Required Fields |
|-----------|-----------------|
| `FACT_SHEET_CREATION` | none |
| `QUALITY_STATE_CHANGE_TO` | `qualityState` |
| `TAG_ADDITION` | `tagId` (uuid) |
| `TAG_REMOVAL` | `tagId` (uuid) |
| `SUBSCRIPTION_ADDITION` | `roleId` (uuid), `type` |
| `SUBSCRIPTION_REMOVAL` | `roleId` (uuid), `type` |
| `FIELD_CHANGE` | `fieldType`, `fieldName`, `from`, `to` |
| `LIFECYCLE_PHASE_CHANGE` | `fieldName`, `lifecyclePhase`, `dateOffset` |
| `COMPLETION_SCORE_CHANGE` | none |
| `RELATION_ADDITION` | `relationType` |
| `RELATION_CHANGED` | `relationType` |
| `RELATION_REMOVAL` | `relationType` |

### Trigger Enums

**qualityState**: `BROKEN_QUALITY_SEAL`, `APPROVED`, `DRAFT`, `REJECTED`

**fieldType** (for FIELD_CHANGE): `SINGLE_SELECT`, `STRING`, `LIFECYCLE`, `INTEGER`, `DOUBLE`

**type** (for SUBSCRIPTION_*): `RESPONSIBLE`, `ACCOUNTABLE`, `OBSERVER`

**lifecyclePhase**: `plan`, `phaseIn`, `active`, `phaseOut`, `endOfLife`

### FieldStateDto (for from/to in FIELD_CHANGE)

```json
{
  "type": "ANYTHING" | "EMPTY" | "VALUE",
  "value": "string"  // required only when type="VALUE"
}
```

### DateOffsetState (for LIFECYCLE_PHASE_CHANGE)

```json
{
  "active": true,           // boolean, required
  "quantity": 30,           // number 0-2000, required
  "unit": "DAYS",           // "DAYS" | "MONTHS" | "YEARS", required
  "timing": "BEFORE"        // "BEFORE" | "AFTER", required
}
```

### Trigger Configuration Examples

#### Fact Sheet Creation
```json
{
  "eventType": "FACT_SHEET_CREATION"
}
```

#### Field Value Changed (Schema-Accurate)
```json
{
  "eventType": "FIELD_CHANGE",
  "fieldName": "businessCriticality",
  "fieldType": "SINGLE_SELECT",
  "from": { "type": "ANYTHING" },
  "to": { "type": "VALUE", "value": "missionCritical" }
}
```

#### Field Changed to Empty
```json
{
  "eventType": "FIELD_CHANGE",
  "fieldName": "businessCriticality",
  "fieldType": "SINGLE_SELECT",
  "from": { "type": "VALUE", "value": "missionCritical" },
  "to": { "type": "EMPTY" }
}
```

#### Subscription Added/Removed
```json
{
  "eventType": "SUBSCRIPTION_ADDITION",
  "type": "RESPONSIBLE",
  "roleId": "role-uuid-here"
}
```

#### Relation Added/Changed/Removed
```json
{
  "eventType": "RELATION_ADDITION",
  "relationType": "relApplicationToITComponent"
}
```

#### Tag Added/Removed
```json
{
  "eventType": "TAG_ADDITION",
  "tagId": "tag-uuid-here"
}
```

#### Quality State Changed
```json
{
  "eventType": "QUALITY_STATE_CHANGE_TO",
  "qualityState": "APPROVED"
}
```

Valid states: `APPROVED`, `BROKEN_QUALITY_SEAL`, `DRAFT`, `REJECTED`

#### Lifecycle State Reached (Schema-Accurate)
```json
{
  "eventType": "LIFECYCLE_PHASE_CHANGE",
  "fieldName": "lifecycle",
  "lifecyclePhase": "endOfLife",
  "dateOffset": {
    "active": true,
    "quantity": 30,
    "unit": "DAYS",
    "timing": "BEFORE"
  }
}
```

#### Completion Score Changed
```json
{
  "eventType": "COMPLETION_SCORE_CHANGE"
}
```

---

## Condition Types (conditionType enum)

| conditionType | Required Fields |
|---------------|-----------------|
| `IGNORE_TECHNICAL_USERS` | `value` (boolean) |
| `WITH_TAGS` | `value` (array of tag UUIDs, minItems: 1) |
| `CATEGORY` | `value` (string) |
| `SINGLE_SELECT` | `fieldName`, `values` (array of FieldState) |
| `FACT_SHEET_STRING_FIELD` | `fieldName`, `operation`, `operand`* |
| `FACT_SHEET_LIFECYCLE_FIELD` | `fieldName`, `states`, `offsetType`, `offsetDays`* |
| `FACT_SHEET_COMPLETION_SCORE` | `operation`, `operand` (0-100) |
| `FACT_SHEET_INTEGER_FIELD` | `fieldName`, `operation`, `operand` |
| `FACT_SHEET_DOUBLE_FIELD` | `fieldName`, `operation`, `operand` |

### Condition Enums

**String operation**: `IS`, `IS_NOT`, `IS_BLANK`, `IS_NOT_BLANK`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`
- `operand` required for all except `IS_BLANK`, `IS_NOT_BLANK`

**Numeric operation** (completion/integer/double): `GREATER_THAN`, `LESS_THAN`, `EQUALS`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN_OR_EQUAL`

**offsetType** (lifecycle): `DAYS_AFTER_TRIGGER`, `DAYS_BEFORE_TRIGGER`, `AT_TRIGGER_TIME`
- `offsetDays`: 0-2000, required when not `AT_TRIGGER_TIME`

**FieldState.type** (for SINGLE_SELECT values): `EMPTY`, `VALUE`
- `value` required when type=`VALUE`

### Condition Configuration Examples

#### Ignore Technical Users
```json
{
  "conditionType": "IGNORE_TECHNICAL_USERS",
  "value": true
}
```

#### Has Tags (AND logic)
```json
{
  "conditionType": "WITH_TAGS",
  "value": ["tag-uuid-1", "tag-uuid-2"]
}
```

#### Single Select Field (Schema-Accurate)
```json
{
  "conditionType": "SINGLE_SELECT",
  "fieldName": "businessCriticality",
  "values": [
    { "type": "VALUE", "value": "businessCritical" },
    { "type": "VALUE", "value": "missionCritical" }
  ]
}
```

#### Lifecycle Phase (Schema-Accurate)
```json
{
  "conditionType": "FACT_SHEET_LIFECYCLE_FIELD",
  "fieldName": "lifecycle",
  "states": ["active", "phaseOut"],
  "offsetType": "AT_TRIGGER_TIME",
  "offsetDays": 0
}
```

#### Lifecycle Phase with Offset
```json
{
  "conditionType": "FACT_SHEET_LIFECYCLE_FIELD",
  "fieldName": "lifecycle",
  "states": ["endOfLife"],
  "offsetType": "DAYS_BEFORE_TRIGGER",
  "offsetDays": 30
}
```

#### String Field Condition
```json
{
  "conditionType": "FACT_SHEET_STRING_FIELD",
  "fieldName": "alias",
  "operation": "CONTAINS",
  "operand": "legacy"
}
```

#### Completion Score Condition
```json
{
  "conditionType": "FACT_SHEET_COMPLETION_SCORE",
  "operation": "LESS_THAN",
  "operand": 50
}
```

#### Integer Field Condition
```json
{
  "conditionType": "FACT_SHEET_INTEGER_FIELD",
  "fieldName": "customIntField",
  "operation": "GREATER_THAN",
  "operand": 100
}
```

#### Category
```json
{
  "conditionType": "CATEGORY",
  "value": "IT"
}
```

---

## Action Types (actionType enum)

| actionType | Required Fields |
|------------|-----------------|
| `CREATE_ACTION_ITEM` | `actionItemName`, `description`, `assignee`, `dueDateOffset`, `waitForClosed` |
| `CREATE_APPROVAL` | `name`, `description`, `assignee`, `dueDateOffset` |
| `ADD_SUBSCRIPTION` | `newSubscriber`, `subscription` |
| `SET_SUBSCRIPTION` | `newSubscriber`, `subscription` |
| `ADD_TAG` | `tagId` |
| `REMOVE_TAG` | `tagId` |
| `SET_FIELD` | `fieldType`, `fieldName`, `value` |
| `SEND_USER_WEBHOOK` | `tag` (2-256 chars) |
| `SEND_EMAIL` | *(deprecated — superseded by SEND_EMAIL_V2; still deployable)* |
| `SEND_EMAIL_V2` | `recipients`, `subject`, `body` |
| `SET_FACT_SHEET_FIELD_SCRIPT` | `scriptId` |

### Common Action Fields (all actions)

```json
{
  "id": "0_ACTION_TYPE",          // string, required - pattern: {index}_{actionType}
  "actionType": "ACTION_TYPE",    // string, required
  "startsAfter": null,            // string | null, required - for chaining
  "onResolution": null            // "ACCEPTED" | "REJECTED" | null, required
}
```

### AssigneeSelectionDto

For `CREATE_ACTION_ITEM` and `CREATE_APPROVAL` actions.

**type enum**: `FACT_SHEET_CREATOR`, `FACT_SHEET_SUBSCRIPTION`, `FIXED_FACT_SHEET_SUBSCRIPTION`, `MULTIPLE_ASSIGNEE_SELECT`

| type | Required Fields |
|------|-----------------|
| `FACT_SHEET_CREATOR` | none |
| `FACT_SHEET_SUBSCRIPTION` | `subscriptionTypes` |
| `FIXED_FACT_SHEET_SUBSCRIPTION` | `subscriptionTypes`, `factSheetId` |
| `MULTIPLE_ASSIGNEE_SELECT` | `userIds` |

### SubscriberSelectionDto

For `ADD_SUBSCRIPTION` and `SET_SUBSCRIPTION` actions.

**type enum**: `FACT_SHEET_CREATOR`, `USER_SELECT`
- When type=`USER_SELECT`, `userId` (uuid) is required

### SubscriptionCreationTypeDto

```json
{
  "roleIds": ["uuid1", "uuid2"],  // array of UUIDs, required
  "type": "RESPONSIBLE"           // string, required
}
```

### EmailRecipientsSelectionDto

For `SEND_EMAIL_V2` action.

**type enum**: `FACT_SHEET_CREATOR`, `FACT_SHEET_SUBSCRIPTION`, `FIXED_FACT_SHEET_SUBSCRIPTION`, `USERS_AND_EMAIL_ADDRESSES`

| type | Required Fields |
|------|-----------------|
| `FACT_SHEET_CREATOR` | none |
| `FACT_SHEET_SUBSCRIPTION` | `subscriptionTypes` |
| `FIXED_FACT_SHEET_SUBSCRIPTION` | `subscriptionTypes`, `factSheetId` |
| `USERS_AND_EMAIL_ADDRESSES` | `userEmails` |

### SetFieldDto

**fieldType enum**: `SINGLE_SELECT`, `QUALITY_SEAL` (default: `SINGLE_SELECT`)

### Action Configuration Examples

#### Run Script
```json
{
  "id": "0_SET_FACT_SHEET_FIELD_SCRIPT",
  "actionType": "SET_FACT_SHEET_FIELD_SCRIPT",
  "scriptId": "script-uuid-here",
  "startsAfter": null,
  "onResolution": null
}
```

#### Set Field
```json
{
  "id": "0_SET_FIELD",
  "actionType": "SET_FIELD",
  "fieldType": "SINGLE_SELECT",
  "fieldName": "businessCriticality",
  "value": "missionCritical",
  "startsAfter": null,
  "onResolution": null
}
```

#### Add/Remove Tag
```json
{
  "id": "0_ADD_TAG",
  "actionType": "ADD_TAG",
  "tagId": "tag-uuid-here",
  "startsAfter": null,
  "onResolution": null
}
```

#### Set Quality State (via SET_FIELD)

> **Note:** There is no separate `SET_QUALITY_STATE` action type. Use `SET_FIELD` with `fieldType: "QUALITY_SEAL"` and `fieldName: "lxState"`.

```json
{
  "id": "0_SET_FIELD",
  "actionType": "SET_FIELD",
  "fieldType": "QUALITY_SEAL",
  "fieldName": "lxState",
  "value": "APPROVED",
  "startsAfter": null,
  "onResolution": null
}
```

Valid states: `APPROVED`, `BROKEN_QUALITY_SEAL`, `DRAFT`, `REJECTED`

#### Add Subscription (User Select)
```json
{
  "id": "0_ADD_SUBSCRIPTION",
  "actionType": "ADD_SUBSCRIPTION",
  "newSubscriber": {
    "type": "USER_SELECT",
    "userId": "user-uuid-here"
  },
  "subscription": {
    "type": "RESPONSIBLE",
    "roleIds": ["role-uuid-1"]
  },
  "startsAfter": null,
  "onResolution": null
}
```

#### Add Subscription (Fact Sheet Creator)
```json
{
  "id": "0_ADD_SUBSCRIPTION",
  "actionType": "ADD_SUBSCRIPTION",
  "newSubscriber": {
    "type": "FACT_SHEET_CREATOR"
  },
  "subscription": {
    "type": "RESPONSIBLE",
    "roleIds": ["role-uuid-1"]
  },
  "startsAfter": null,
  "onResolution": null
}
```

#### Create Action Item
```json
{
  "id": "0_CREATE_ACTION_ITEM",
  "actionType": "CREATE_ACTION_ITEM",
  "actionItemName": "Review application",
  "description": "Please review this application",
  "assignee": {
    "type": "FACT_SHEET_SUBSCRIPTION",
    "subscriptionTypes": ["RESPONSIBLE"]
  },
  "dueDateOffset": 7,
  "waitForClosed": false,
  "startsAfter": null,
  "onResolution": null
}
```

#### Create Approval
```json
{
  "id": "0_CREATE_APPROVAL",
  "actionType": "CREATE_APPROVAL",
  "name": "Approve retirement",
  "description": "Please approve the retirement of this application",
  "assignee": {
    "type": "MULTIPLE_ASSIGNEE_SELECT",
    "userIds": ["user-uuid-1", "user-uuid-2"]
  },
  "dueDateOffset": 14,
  "startsAfter": null,
  "onResolution": null
}
```

#### Send Email
```json
{
  "id": "0_SEND_EMAIL_V2",
  "actionType": "SEND_EMAIL_V2",
  "recipients": {
    "type": "USERS_AND_EMAIL_ADDRESSES",
    "userEmails": ["user@example.com"]
  },
  "subject": "Application Created: {{{factsheet.displayName}}}",
  "body": "# New Application\n\nA new application has been created: **{{{factsheet.displayName}}}**\n\n[View Fact Sheet]({{{link.factsheet}}})",
  "startsAfter": null,
  "onResolution": null
}
```

### Email Placeholders (SEND_EMAIL_V2)

Use **triple braces** for placeholders in email subject and body:

| Placeholder | Description |
|-------------|-------------|
| `{{{factsheet.displayName}}}` | Fact sheet display name |
| `{{{link.factsheet}}}` | Link to the fact sheet in LeanIX |

> **Important**: Uses triple braces `{{{ }}}` and lowercase `factsheet` (not camelCase `factSheet`).

**Supported Markdown in body:**
- Headers: `# Title`, `## Subtitle`
- Formatting: `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``
- Lists: `- bullet` or `1. numbered`
- Links: `[text](url)`
- Quotes: `> quoted text`

#### Send Webhook
```json
{
  "id": "0_SEND_USER_WEBHOOK",
  "actionType": "SEND_USER_WEBHOOK",
  "tag": "my-webhook-tag",
  "startsAfter": null,
  "onResolution": null
}
```

#### Chaining Actions (startsAfter)
```json
{
  "actions": [
    {
      "id": "0_CREATE_APPROVAL",
      "actionType": "CREATE_APPROVAL",
      "name": "Approve change",
      "description": "Please approve",
      "assignee": { "type": "FACT_SHEET_CREATOR" },
      "dueDateOffset": 7,
      "startsAfter": null,
      "onResolution": null
    },
    {
      "id": "1_SET_FIELD",
      "actionType": "SET_FIELD",
      "fieldType": "SINGLE_SELECT",
      "fieldName": "status",
      "value": "approved",
      "startsAfter": "0_CREATE_APPROVAL",
      "onResolution": "ACCEPTED"
    },
    {
      "id": "2_SET_FIELD",
      "actionType": "SET_FIELD",
      "fieldType": "SINGLE_SELECT",
      "fieldName": "status",
      "value": "rejected",
      "startsAfter": "0_CREATE_APPROVAL",
      "onResolution": "REJECTED"
    }
  ]
}
```

---

## Complete Deployment Example

This is a two-step process: first create the script, then create the automation template referencing it.

### Step 1: Create Script

```javascript
const scriptResponse = await fetch(
  "https://INSTANCE.leanix.net/services/automations/v1/scripts",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Tag New Applications",
      description: "",
      code: `export function main() {
  const tags = data.factSheet.tags ?? [];
  if (tags.includes("NEW_TAG_ID")) return {};
  return { tags: [...tags, "NEW_TAG_ID"] };
}`
    })
  }
);

const script = await scriptResponse.json();
console.log("Script ID:", script.id);
```

### Step 2: Create Automation Template

```javascript
const templateResponse = await fetch(
  "https://INSTANCE.leanix.net/services/automations/v1/templates",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Tag Application on Creation",
      description: "Adds NEW tag when Application is created",
      factSheetType: "Application",
      ownerId: "your-owner-account-id",
      trigger: {
        eventType: "FACT_SHEET_CREATION"
      },
      conditions: [
        {
          conditionType: "IGNORE_TECHNICAL_USERS",
          value: true
        }
      ],
      actions: [
        {
          id: "0_SET_FACT_SHEET_FIELD_SCRIPT",
          actionType: "SET_FACT_SHEET_FIELD_SCRIPT",
          scriptId: script.id,
          startsAfter: null,
          onResolution: null
        }
      ],
      active: false
    })
  }
);

const template = await templateResponse.json();
console.log("Automation ID:", template.id);
console.log("Automation URL:", `https://INSTANCE.leanix.net/WORKSPACE/admin/automations/template/${template.id}`);
```

> **Automation edit URL format**: the canonical URL is `https://{INSTANCE}.leanix.net/{WORKSPACE}/admin/automations/template/{TEMPLATE_ID}`. The old `/edit/{TEMPLATE_ID}` still works but only as a legacy redirect alias. The `/admin/` path segment is required; `/edit/` is not canonical. `{WORKSPACE}` is your workspace name.

### Step 3: Enable Automation (After Testing)

> **Note:** PATCH toggles the `active` flag ONLY (body `{ "active": boolean }`). For all other changes, use PUT with the full template body.

```javascript
// First, GET the current template
const getRes = await fetch(
  `https://INSTANCE.leanix.net/services/automations/v1/templates/${template.id}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const currentTemplate = await getRes.json();

// Then PUT with active: true
await fetch(
  `https://INSTANCE.leanix.net/services/automations/v1/templates/${template.id}`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...currentTemplate,
      active: true
    })
  }
);
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid trigger type: INVALID_TYPE",
  "status": 400
}
```

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "status": 401
}
```

#### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions for this operation",
  "status": 403
}
```

#### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Script not found: invalid-uuid",
  "status": 404
}
```

#### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "Automation with name 'X' already exists",
  "status": 409
}
```

### Validation Errors

```json
{
  "error": "Validation Error",
  "message": "Missing required field: factSheetType",
  "status": 400,
  "details": [
    { "field": "factSheetType", "message": "Required field is missing" }
  ]
}
```

### Recovery Patterns

#### Template Literals Reject When Creating Scripts via API

`POST /scripts` with a `code` payload that uses template literals (backticks) fails with HTTP 422 *"Invalid JavaScript code provided"*. Template literals work fine when scripts are pasted into the LeanIX UI, but not over the API.

```javascript
// REJECTED via API
const query = `query ($id: ID!) { factSheet(id: $id) { id rev } }`;

// ACCEPTED via API
const query = "query ($id: ID!) { factSheet(id: $id) { id rev } }";
```

When generating script code for `mcp__leanix__create_automation_script`, use plain string concatenation throughout.

#### REVISION_CLASH Retry on Sequential Mutations

> **Prefer rev-less relation writes to avoid this entirely.** For creating, updating, or deleting **relations** (and relation attributes), use the relation-scoped `upsertRelation` / `deleteRelation` mutations. They are keyed by `(from, to, type)` and carry **no `rev`**, so `REVISION_CLASH` cannot occur and no `getCurrentRev` + retry loop is needed. `upsertRelation` both creates (if absent) and updates (if present); patches set relation attributes directly. Batch multiple writes into one aliased mutation (`r0:`, `r1:`, …). See TEMPLATES.md → Template 7 for the full pattern. **To-one caveat:** on a single-cardinality relation, only one relation of that type may exist, so upserting a different `to` target can replace/conflict with the existing one — delete the old relation first, or upsert the single intended target.
>
> The rev-based `updateFactSheet` retry below remains the correct approach for **non-relation field writes** (e.g. `description`, custom fields) on other fact sheets.

When a script performs multiple mutations on the same fact sheet (or concurrent automations / system updates change a fact sheet between mutations), GraphQL returns:

```
extensions.errorType === "REVISION_CLASH"
Message: "DB revision of Fact Sheet has changed: X instead of given Y"
```

Recovery: re-fetch the revision before each mutation, retry the mutation up to 3 times when the error type is `REVISION_CLASH`, and only throw if all retries fail.

```javascript
async function getCurrentRev(fsId, token) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query ($id: ID!) { factSheet(id: $id) { rev } }",
      variables: { id: fsId }
    })
  });
  return (await res.json())?.data?.factSheet?.rev;
}

for (const item of items) {
  let retries = 3;
  while (retries > 0) {
    const currentRev = await getCurrentRev(fsId, token);
    const mutJson = await doMutation(fsId, currentRev, item);
    if (mutJson?.errors) {
      const isRevClash = mutJson.errors.some(
        e => e.extensions?.errorType === "REVISION_CLASH"
      );
      if (isRevClash && retries > 1) { retries--; continue; }
      throw new Error("Mutation failed: " + JSON.stringify(mutJson.errors));
    }
    break;
  }
}
```

### Debugging Methodology

**Comparison-first.** When an automation isn't behaving as expected:

1. Fetch all templates with `mcp__leanix__list_automations()` and cache the result for the session.
2. Find a working automation with similar configuration (same fact sheet type, similar trigger).
3. Diff broken vs working — focus on `ownerId`, `active`, trigger config, conditions, actions.
4. Only investigate UUIDs if the comparison doesn't reveal the issue.

Most automation failures stem from configuration differences (wrong `ownerId`, inactive state, misconfigured trigger). Comparing against a working automation surfaces these in seconds.

### Built-in Action Limitations

These limitations affect automation design but are not visible in the OpenAPI schema.

#### SEND_EMAIL_V2: No Dynamic Recipients

Recipients are fixed at automation definition time. Available recipient types: `FACT_SHEET_SUBSCRIPTION`, `FACT_SHEET_CREATOR`, fixed `userEmails`. There is no mechanism to pass a list computed by a script.

**Workaround**: Use the To-Do API. LeanIX automatically emails the assignee when a To-Do is created.

#### SEND_USER_WEBHOOK: No Custom Payload

The action accepts only a `tag` string (2–256 chars) and emits a fixed payload structure. There is no way to pass arbitrary JSON.

**Workaround**: Call `fetch()` directly from the script with a custom payload.

#### Run Script `data` Object Constraints

- **`data.factSheet.subscriptions` is always empty.** The runtime does not populate this array. To read subscribers, query GraphQL: `factSheet(id: $id) { subscriptions { edges { node { id type user { id email displayName } roles { id name } } } } }`.
- **`data.trigger` is not available.** The trigger context lives under `data.metadata.triggerData`, not `data.trigger`. For relation triggers, the related fact sheet id IS delivered there (`previousRelatedFactSheetId` for the removed end, `currentRelatedFactSheetId` for the added end, plus `relationId`/`relationType`) — id only, best-effort/undocumented; GraphQL-fetch by that id to read its fields. For field-change triggers there is no delivered before/after value, so to filter on a specific field change use automation conditions and design logic around current state via `data.factSheet.{fieldName}`.

### Workspace Data Queries

#### Fetch All Tags

```graphql
{
  allTags {
    edges {
      node {
        id
        name
        tagGroup { id name }
      }
    }
  }
}
```

Use when a script needs to reference tag IDs or when the user needs to select a trigger tag.

---

## Service-Layer Behaviors

These rules are enforced by the Automations service when accepting POST/PUT/DELETE requests against `/scripts` and `/templates`. They are not visible in the OpenAPI schema and surface as 4xx responses if violated.

### DTO size limits

| Object | Field | Min | Max |
|---|---|---|---|
| Script | `name` | 1 | 255 |
| Template | `name` | 1 | 256 |
| Template | `factSheetType` | 1 | 256 |
| Template | `description` | 0 | 2048 |

Requests exceeding these limits are rejected with **HTTP 400** and a validation error.

### Secret reference

To use the automations bearer token in a script, reference the secret key as a **literal string** in the source:

```javascript
const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
```

Always reference the secret key literally. Do not build the key dynamically (e.g. via string concatenation, variables, helper functions, or computed property names) — reference the literal `"default_automations_secret"` string directly so the secret is available at runtime.

### Hardcoded language

Scripts created via `POST /scripts` are **always** stored as JavaScript. Any other language value in the request body is silently overridden.

### Trigger + condition rules

- **Per-template uniqueness:** at most 1 × `IGNORE_TECHNICAL_USERS`, 1 × `CATEGORY`, and 1 × `WITH_TAGS` condition. Duplicates are rejected.
- **`LIFECYCLE_PHASE_CHANGE` (job-type) trigger** combined with an `IGNORE_TECHNICAL_USERS` condition is rejected: *"Technical user condition is not allowed when the trigger is of JOB type."* Job-type triggers run on a schedule; the technical-user filter is meaningless in that context.
- Toggling `active` on an active template re-syncs the trigger registration; toggling on an inactive template does not. Practical consequence: if a trigger looks misregistered, a PUT round-trip with the active value flipped to true (and back) re-syncs it.

### Action graph rules

- **Exactly one first action.** The action with `startsAfter: null` is the entry point. Templates with multiple `startsAfter: null` actions, or zero, are rejected.
- All other actions must chain via `startsAfter` referencing another action's `id` in the same template.
- **Inline `script` field is auto-stripped.** If you POST an action with both `script: "..."` (full source) and `scriptId`, the service drops the `script` field and keeps the `scriptId`. Always create scripts separately via `POST /scripts` and reference by id.

### Script DELETE conflicts

`DELETE /scripts/{id}` returns **HTTP 409 Conflict** when the script is referenced by **more than one** template, unless `?force=true` is passed.

```json
{
  "error": "Conflict",
  "usedByTemplates": [
    { "id": "template-uuid-1", "name": "Tag App on Creation" },
    { "id": "template-uuid-2", "name": "Tag App on Update" }
  ]
}
```

Single-reference deletes succeed normally. With `force=true`, all referencing templates have the script removed (and may break if no replacement is provided in the same request).

### Keep scripts fast and lightweight

Script execution is bounded by an execution time limit, so long-running scripts fail before completing. Aim to have scripts finish quickly — roughly 45 seconds or less, and shorter is safer. Keep memory use and request/response payloads modest. If you have a large amount of work to do, paginate it across multiple triggers rather than doing it all in one run.

### Compensation rollback on creation failure

If a multi-step deploy creates one or more scripts and then fails to create the template, the service deletes the just-created scripts (best-effort, with retries). A partially-failed deploy leaves no orphaned scripts to clean up manually.

---

## Fact Sheet Types

Standard fact sheet types for the `factSheetType` field:

| Type | API Value |
|------|-----------|
| Application | `Application` |
| IT Component | `ITComponent` |
| Business Capability | `BusinessCapability` |
| Process | `Process` |
| Data Object | `DataObject` |
| Interface | `Interface` |
| User Group | `UserGroup` |
| Project | `Project` |
| Provider | `Provider` |
| Technical Stack | `TechnicalStack` |
| Initiative | `Initiative` |
| Objective | `Objective` |

Note: Custom fact sheet types use their configured type name.

---

## Relation Type Names

Common relation type names for triggers:

| From - To | Relation Type Name |
|-----------|-------------------|
| Application - IT Component | `relApplicationToITComponent` |
| Application - Business Capability | `relApplicationToBusinessCapability` |
| Application - Process | `relApplicationToProcess` |
| Application - Data Object | `relApplicationToDataObject` |
| Application - Interface | `relApplicationToInterface` |
| Application - User Group | `relApplicationToUserGroup` |
| Application - Project | `relApplicationToProject` |
| IT Component - Provider | `relITComponentToProvider` |
| IT Component - Technical Stack | `relITComponentToTechnicalStack` |
| Initiative - Application | `relInitiativeToApplication` |
| Project - Application | `relProjectToApplication` |

Note: Use the LeanIX data model or MCP to discover custom relations.
