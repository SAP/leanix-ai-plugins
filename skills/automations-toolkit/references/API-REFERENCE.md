# LeanIX Automations API Reference

> **Schema Source**: Official OpenAPI spec at `https://{INSTANCE}.leanix.net/services/automations/v1/api-json`
>
> **Last Verified**: 2026-01-27 | **Spec Version**: v1 | **Status**: Current

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
> - `mcp__leanix__get_automation_schema()` — GET /api-json schema reference
> - `mcp__leanix__search_users(email=...)` — User lookup

---

## Discovering Service Specs

When working with any LeanIX service beyond `automations` (e.g., To-Do, Webhooks, MTM), fetch the OpenAPI spec directly instead of guessing endpoints or web-searching the docs site.

### URL Pattern

```
https://{INSTANCE}.leanix.net/services/{service-name}/v1/openapi.json
```

The `automations` service is the only known exception — its spec is at `/api-json` instead of `/openapi.json`. Most others (`mtm`, `todo`, `webhooks`) are served publicly with no auth required, so a plain `WebFetch` works.

### Verified Service Inventory

Last sweep: 2026-05-21 on `demo-us.leanix.net`.

| Service | Spec URL | Public? | Purpose |
|---|---|---|---|
| `mtm` | `/services/mtm/v1/openapi.json` | yes (200) | Multi-tenant: accounts, workspaces, users, IDPs |
| `todo` | `/services/todo/v1/openapi.json` | yes (200) | Action items, approvals, query by externalId/factSheet |
| `webhooks` | `/services/webhooks/v1/openapi.json` | yes (200) | Event subscriptions, deliveries |
| `automations` | `/services/automations/v1/api-json` | auth-gated (401) | Trigger/action/template DTOs (also covered by `mcp__leanix__get_automation_schema`) |
| `mcp-server` | `/services/mcp-server/v1/openapi.json` | auth-gated (401) | — |
| `sso` | `/services/sso/v1/openapi.json` | auth-gated (401) | — |
| `pathfinder` | n/a | n/a | GraphQL-only — use schema introspection or `LEANIX-MODEL.md` query patterns |

> Note: `todos` (plural) and `integration-api` are **not** valid services — both appeared in stale internal docs. Canonical name is `todo` (singular). `integration-api` returned 404 on every instance checked.

### Procedure

1. **Need an endpoint shape?** WebFetch the spec first.
2. **Need a request/response schema?** Read it from the OpenAPI components, don't infer from examples.
3. **Authoring a script that calls a service?** Confirm the URL exists in this table. If not, sweep the candidate path with WebFetch before pasting any URL into a script.

This pattern was added after a session burned multiple rounds web-searching for the To-Do API GET shape when the spec was a single WebFetch away.

---

## Table of Contents

- [Discovering Service Specs](#discovering-service-specs)
- [API Endpoints](#api-endpoints)
- [Extracting Credentials from MCP Configuration](#extracting-credentials-from-mcp-configuration)
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

#### OAuth Token Exchange

The `LXT_xxx` API token from MCP config must be exchanged for a bearer token. **MCP tools handle this automatically** — no manual exchange needed.

**Raw API endpoint (for reference only — do NOT use directly):**
```
POST https://{INSTANCE}.leanix.net/services/mtm/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
grant_type=client_credentials&client_id=apitoken&client_secret={LXT_TOKEN}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3599,
  "scope": "read write"
}
```

**The `access_token` is a JWT containing:**
- `principal.id` - Account ID of the token holder (see WARNING below)
- `principal.permission.workspaceName` - Workspace name (for UI URLs)
- `exp` - Expiration timestamp

> **WARNING: `principal.id` and ownerId**: If the token was issued from a **technical user / API token**, `principal.id` is the technical user's UUID — **NOT a valid ownerId**. Using it as `ownerId` causes the UI to show "null null" for the automation owner. Always use a real human user's account ID. See [Ownership Management](#ownership-management) below.

> **Important**: Always exchange the `LXT_` token before API calls. The Automations API requires a bearer token, not the raw API token.

---

## Extracting Credentials from MCP Configuration

When LeanIX MCP is configured, credentials can be extracted from `.mcp.json`:

```json
{
  "mcpServers": {
    "leanix": {
      "type": "http",
      "url": "https://your-instance.leanix.net/services/mcp-server/v1/mcp",
      "headers": {
        "Authorization": "Token LXT_xxx..."
      }
    }
  }
}
```

### Extraction Pattern

| Value | How to Extract |
|-------|----------------|
| **Instance** | Parse hostname from `url`: `https://(.+).leanix.net/...` → `your-instance` |
| **Token** | From `headers.Authorization`, strip "Token " prefix → `LXT_xxx...` |
| **Base URLs** | Construct from instance: `https://{INSTANCE}.leanix.net/services/...` |

### Constructed URLs

```javascript
const INSTANCE = "your-instance";  // extracted from MCP config
const GRAPHQL_URL = `https://${INSTANCE}.leanix.net/services/pathfinder/v1/graphql`;
const AUTOMATIONS_URL = `https://${INSTANCE}.leanix.net/services/automations/v1`;
```

### Getting Owner ID

The `ownerId` required for automation templates can be obtained via MCP:

1. Call `mcp__leanix__get_overview`
2. Look in the subscriptions facet for the current user's account ID
3. Or query GraphQL for the authenticated user's subscriptions

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
| PATCH | `/templates/{id}` | **NOT SUPPORTED** - use PUT with full body |
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

> **Automation edit URL format**: `https://{INSTANCE}.leanix.net/{WORKSPACE}/admin/automations/template/{TEMPLATE_ID}`. The `/admin/` path segment and `/template/` are required. `{WORKSPACE}` is the workspace name from the JWT payload at `principal.permission.workspaceName`.

### Step 3: Enable Automation (After Testing)

> **Note:** PATCH is NOT supported. Use PUT with the full template body.

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
4. Only investigate UUIDs / JWT payloads if the comparison doesn't reveal the issue.

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
- **`data.trigger` is not available.** Run scripts only receive `data.factSheet`. Scripts cannot determine *what changed* — design logic around current state. If you need to filter on a specific change, use automation conditions instead.

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

### Secret auto-detection

The service injects `{ secrets: [{ key: "default_automations_secret" }] }` into the MCE execution context **only if the script body contains the literal substring `"default_automations_secret"`**. It is a plain string-match on the source code.

```javascript
// WORKS — literal substring present, secret injected
const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;

// FAILS — string is built dynamically, no substring match, no secret injected
const k = "default_" + "automations_secret";
const token = context?.secrets?.[k]?.value?.bearerToken;  // context.secrets is empty
```

Always reference the secret key as a literal string in the source. The same applies to indirect references via variables, helper functions, or computed property names — if the literal substring is not present, no secret is injected.

### Hardcoded language and capability

Scripts created via `POST /scripts` are **always** stored as `language: "JAVASCRIPT"` and `capability: "AUTOMATIONS"`. Any other value in the request body is silently overridden.

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

### MCE call gateway timeout

The service forwards script execution requests to MCE with a **15,000 ms** gateway timeout. Long-running scripts that breach this fail at the gateway with `GATEWAY_TIMEOUT` even before MCE's own `EXECUTION_TIMEOUT` fires. Keep scripts short; paginate large work across multiple triggers if needed.

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
