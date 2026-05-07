# LeanIX Automations API - Learnings Log

Accumulated knowledge from real API interactions. Use this to improve documentation accuracy.

## Table of Contents

- [Verification Log](#verification-log)
- [MCP Configuration Extraction](#mcp-configuration-extraction)
- [OAuth Token Exchange](#oauth-token-exchange)
- [Email Placeholder Format](#email-placeholder-format)
- [Pre-Deployment Validation](#pre-deployment-validation)
- [Error Patterns Discovered](#error-patterns-discovered)
- [Field Mappings Verified Against API](#field-mappings-verified-against-api)
- [API Behaviors Not in OpenAPI Spec](#api-behaviors-not-in-openapi-spec)
- [Constraint Discoveries](#constraint-discoveries)
- [Suggested Documentation Updates](#suggested-documentation-updates)
- [Automatic Deployment Learnings](#automatic-deployment-learnings)
- [Managed Code Execution API Learnings](#managed-code-execution-api-learnings)
- [URL Format Discovery](#url-format-discovery)
- [Action-First Pattern Discovery](#action-first-pattern-discovery)
- [Curl Best Practices (Historical)](#curl-best-practices-historical)
- [Run Script Data Object Constraints](#run-script-data-object-constraints)
- [Built-in Action Limitations](#built-in-action-limitations)
- [Workspace Data Queries](#workspace-data-queries)
- [Ownership & User Discovery Learnings](#ownership--user-discovery-learnings)
- [Debugging Methodology Learnings](#debugging-methodology-learnings)
- [How to Use This File](#how-to-use-this-file)

---

## Verification Log

| Date | What Verified | Result | Action |
|------|---------------|--------|--------|
| 2026-01-27 | Full OpenAPI spec comparison | Aligned | Updated API-REFERENCE.md |
| 2026-01-27 | MCP config extraction pattern | Working | Added to SKILL.md Step 1 |
| 2026-01-27 | Action-first workflow pattern | Implemented | Major SKILL.md rewrite |
| 2026-01-27 | OAuth token exchange required | Confirmed | Added Step 1.1a to SKILL.md |
| 2026-01-27 | Email placeholder format | Triple braces required | Fixed in SKILL.md and API-REFERENCE.md |
| 2026-01-28 | Curl bearer token handling | Issues with quotes | Added "Curl Best Practices" section |
| 2026-01-28 | Analyze workflow gaps | Missing checks | Added Step 4.5 redundancy analysis |
| 2026-01-28 | Description mismatch detection | Not covered | Expanded Step 4 with issue patterns |
| 2026-01-28 | JWT token shell handling | Resolved | Eliminated by migration to MCP tools (no shell token handling needed) |
| 2026-03-06 | Ownership management patterns | Technical user pitfall confirmed | Updated API-REFERENCE.md |
| 2026-03-06 | creatorId mutability | Confirmed immutable (silently ignored) | Added to field mutability docs |
| 2026-03-06 | Comparison-first debugging | Validated as fastest approach | Added to SKILL.md |

---

## MCP Configuration Extraction

### Pattern: Extract Instance and Token from .mcp.json

When LeanIX MCP is configured, the `.mcp.json` file contains all credentials needed for API deployment:

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

**Extraction:**
- **Instance**: Parse from URL hostname (e.g., `your-instance` from `https://your-instance.leanix.net/...`)
- **Token**: From `headers.Authorization`, strip "Token " prefix

**Status**: ✅ Documented in SKILL.md and API-REFERENCE.md

### Pattern: Get Owner ID from MCP get_overview

The `ownerId` required for automation templates can be obtained via the MCP `get_overview` tool:

1. Call `mcp__leanix__get_overview`
2. Response includes `filterOptions.facets` with subscription data
3. The current user appears in the Subscriptions facet

**Alternative**: Query GraphQL for the authenticated user's account ID.

**Status**: ✅ Documented in SKILL.md Step 1.2

---

## OAuth Token Exchange

### Pattern: Exchange LXT_ Token for Bearer Token

The LeanIX API token (`LXT_xxx`) from `.mcp.json` must be exchanged for a bearer token before calling the Automations API.

**Request:**
```
POST https://{INSTANCE}.leanix.net/services/mtm/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=apitoken&client_secret={LXT_TOKEN}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3599
}
```

**The bearer token JWT payload contains:**
- `principal.id` - Account ID of the token holder (**WARNING**: if from a technical user/API token, this is NOT a valid `ownerId` — see Ownership learnings below)
- `principal.permission.workspaceName` - Workspace name (for URLs)
- `exp` - Token expiration timestamp

**How to decode JWT payload:**
```javascript
const payload = JSON.parse(atob(accessToken.split('.')[1]));
// WARNING: Do NOT blindly use principal.id as ownerId — it may be a technical user
const tokenHolderId = payload.principal.id;
const workspaceName = payload.principal.permission.workspaceName;
```

**Key insight**: The skill must perform this exchange automatically whenever it needs to call the Automations API. The user should never be asked to do this manually.

**Status**: ✅ Documented in SKILL.md Step 1.1a and API-REFERENCE.md

---

## Email Placeholder Format

### Pattern: Email Placeholders Use Triple Braces

**Discovery**: 2026-01-27
**Issue**: Documentation showed `{{factSheet.displayName}}` but API requires `{{{factsheet.displayName}}}`

**Differences from common template syntax:**
| Aspect | Common (Wrong) | LeanIX (Correct) |
|--------|----------------|------------------|
| Braces | Double `{{ }}` | Triple `{{{ }}}` |
| Casing | camelCase `factSheet` | lowercase `factsheet` |

**Available placeholders:**
| Placeholder | Description |
|-------------|-------------|
| `{{{factsheet.displayName}}}` | Fact sheet display name |
| `{{{link.factsheet}}}` | Link to the fact sheet |

**Example:**
```json
{
  "subject": "Review needed: {{{factsheet.displayName}}}",
  "body": "# Review Request\n\nPlease review **{{{factsheet.displayName}}}**.\n\n[Open Fact Sheet]({{{link.factsheet}}})"
}
```

**Status**: ✅ Fixed in SKILL.md and API-REFERENCE.md

---

## Pre-Deployment Validation

### Pattern: Validate Against OpenAPI Spec Before Deployment

**Discovery**: 2026-01-27
**Issue**: Deployments failed with 400 errors because payloads weren't validated against the actual API schema.

**Solution**: Fetch the live OpenAPI spec and validate payloads before API calls:

**Fetch spec:**
```
GET https://{INSTANCE}.leanix.net/services/automations/v1/api-json
```

**Key validations:**

| Category | Check |
|----------|-------|
| Required fields | `startsAfter`, `onResolution`, `id`, `actionType` on all actions |
| Enum values | `eventType`, `actionType`, `conditionType` must match schema |
| Constraints | `subject` max 200 chars, `operand` ranges, `tag` 2-256 chars |
| Action ID format | Pattern `{index}_{actionType}` (e.g., `0_ADD_TAG`, `1_SET_FIELD`) |
| `startsAfter` refs | Must reference valid action IDs in the array |
| `onResolution` | Only valid when `startsAfter` points to approval/action-item |

**Benefit**: Catches errors before API call, provides specific fix instructions, prevents wasted deployment attempts.

**Status**: ✅ Documented in SKILL.md Step 9.1a

---

## Error Patterns Discovered

### Pattern: Missing Required Field
```
Error: 400 Bad Request
Message: "'onResolution' is required for action"
```
**Learning**: All action objects require `onResolution` field (can be `null`)
**Status**: ✅ Documented in API-REFERENCE.md

### Pattern: Wrong Field Name
```
Error: 400 Bad Request
Message: "Unknown field 'subscriptionType' in trigger"
```
**Learning**: Subscription triggers use `type` not `subscriptionType`
**Status**: ✅ Fixed in API-REFERENCE.md

### Pattern: Missing startsAfter
```
Error: 400 Bad Request
Message: "Required field 'startsAfter' is missing"
```
**Learning**: All actions require `startsAfter` field (can be `null`)
**Status**: ✅ Documented in API-REFERENCE.md

### Pattern: Template Literals Cause Script API Validation Failure
```
Error: 422 Unprocessable Entity
Message: "Invalid JavaScript code provided"
```
**Discovery**: 2026-02-11
**Root Cause**: When creating scripts via the Automations API (`POST /scripts`), using template literals (backticks) for GraphQL queries causes the API to reject the script as invalid JavaScript.

**Problem code:**
```javascript
const query = `query ($id: ID!) { factSheet(id: $id) { id rev } }`;  // ❌ FAILS
```

**Solution - use regular strings:**
```javascript
const query = "query ($id: ID!) { factSheet(id: $id) { id rev } }";  // ✅ WORKS
```

**Note**: Template literals work fine when scripts are created manually in the LeanIX UI. The issue only occurs when deploying scripts via the Automations API.

**Status**: ✅ Documented

### Pattern: Revision Clash on Sequential Mutations
```
Error: REVISION_CLASH
Message: "DB revision of Fact Sheet has changed: X instead of given Y"
```
**Root Cause**: Multiple mutations on the same fact sheet in a loop; concurrent automations or system updates change the revision between mutations.

**Learning**:
1. Re-fetch revision **before each mutation** (not just once at start)
2. Implement retry logic (3 attempts) for `REVISION_CLASH` errors
3. Check `extensions.errorType === "REVISION_CLASH"` to identify retryable errors

**Pattern**:
```javascript
async function getCurrentRev(fsId, token) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query ($id: ID!) { factSheet(id: $id) { rev } }`,
      variables: { id: fsId }
    }),
  });
  return (await res.json())?.data?.factSheet?.rev;
}

// In mutation loop - retry on revision clash
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
      throw new Error(`Mutation failed: ${JSON.stringify(mutJson.errors)}`);
    }
    break; // Success
  }
}
```
**Status**: ✅ Documented 2026-02-04

---

## Field Mappings Verified Against API

| Documentation | Actual API | Verified |
|---------------|------------|----------|
| `trigger.eventType` | `eventType` (correct) | 2026-01-27 |
| `from`/`to` with FieldStateDto | Correct structure | 2026-01-27 |
| `BROKEN_QUALITY_SEAL` | Correct enum value | 2026-01-27 |
| `SINGLE_SELECT` condition | Correct (not SINGLE_SELECT_FIELD) | 2026-01-27 |
| `qualityState` values | `APPROVED`, `BROKEN_QUALITY_SEAL`, `DRAFT`, `REJECTED` | 2026-01-27 |
| `dateOffset` structure | `active`, `quantity`, `unit`, `timing` all required | 2026-01-27 |
| `lifecyclePhase` values | `plan`, `phaseIn`, `active`, `phaseOut`, `endOfLife` | 2026-01-27 |

---

## API Behaviors Not in OpenAPI Spec

Sometimes API behavior differs from schema. Document here:

| Behavior | Discovery Date | Notes |
|----------|----------------|-------|
| `creatorId` updates silently ignored | 2026-03-06 | Field is immutable; API returns 200 but value unchanged |
| `ownerId` accepts technical user UUIDs | 2026-03-06 | API accepts but UI shows "null null" for the owner |
| `GET /scripts/{id}` endpoint behavior varies | 2026-03-06 | Use MCP tools; backend code has route but production returned 404 at time of testing |
| No `/workspaces/{ws}/technicalUsers` endpoint | 2026-03-06 | Endpoint does not exist; use `search_users` MCP tool instead |

---

## Constraint Discoveries

Constraints discovered through usage that may not be obvious from the schema:

| Field | Constraint | Discovered |
|-------|------------|------------|
| `dateOffset.quantity` | 0-2000 range | 2026-01-27 |
| `conditions` array | 0-100 items max | 2026-01-27 |
| `actions` array | 1-100 items required | 2026-01-27 |
| `SEND_USER_WEBHOOK.tag` | 2-256 characters | 2026-01-27 |
| `FACT_SHEET_COMPLETION_SCORE.operand` | 0-100 range | 2026-01-27 |
| `offsetDays` (lifecycle condition) | 0-2000 range | 2026-01-27 |

---

## Suggested Documentation Updates

When API errors reveal undocumented behavior, add here for review:

| Date | Discovery | Suggested Update | Status |
|------|-----------|------------------|--------|
| (None pending) | | | |

---

## Automatic Deployment Learnings

### When to Use Automatic Deployment

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| MCP configured in `.mcp.json` | Automatic | All credentials available |
| Creating new automation | Automatic | Faster, fewer manual steps |
| Updating existing automation | Manual | Need to review existing config |
| MCP not configured | Manual | No credentials available |

### Deployment Prerequisites

For automatic deployment to work, the skill needs:

1. **Instance URL** - Extracted from `.mcp.json` URL field
2. **API Token** - Extracted from `.mcp.json` Authorization header
3. **Owner ID** - Obtained via `mcp__leanix__get_overview` or GraphQL query

If any of these are missing, fall back to manual deployment.

### Key Insight

The skill was originally written defensively for "MCP might not be configured" scenarios. But the PRIMARY use case is "MCP IS configured" - so the workflow now:
- **Assumes MCP works** and extracts everything automatically
- **Falls back to manual** only when something fails
- **Never asks for info that's already available** in MCP config

**Status**: ✅ Updated in SKILL.md Step 1 and Step 9

---

## Managed Code Execution API Learnings

### Pattern: Script Response Structure

**Discovery**: 2026-01-28
**Issue**: API-REFERENCE.md documented wrong response structure for script code endpoint

**Wrong assumption:**
```javascript
const code = codeData.data?.currentVersion?.code;  // ❌ WRONG
```

**Correct pattern:**
```javascript
const code = codeData.data?.[0]?.code;  // ✅ CORRECT - array of versions
```

**Response structure:**
- `data` is an ARRAY of version objects, not an object with `currentVersion`
- Versions sorted newest first (highest version number)
- Each version has: `id`, `executionConfigurationId`, `code`, `language`, `version`, `createdAt`

**Status**: ✅ Fixed in API-REFERENCE.md

### Pattern: Templates API - No PATCH Support

**Discovery**: 2026-01-28
**Issue**: Tried `PATCH /templates/{id}` - got 404

**Learning**: Templates API does NOT support PATCH. Only PUT works.
- PUT requires the FULL template body
- To update just `name` or `description`, use MCP: `mcp__leanix__update_automation(template_id=ID, name=..., description=...)`
- The MCP tool handles GET-modify-PUT internally

**Status**: ✅ Fixed in API-REFERENCE.md

### Pattern: Token Refresh for Batch Operations (Historical)

> **Note:** As of the MCP migration, token management is handled automatically by MCP tools. No manual token refresh needed.

**Status**: ✅ Resolved by MCP migration

---

## URL Format Discovery

### Pattern: Automation Edit URL Format

**Discovery**: 2026-01-27
**Issue**: Skill displayed incorrect URL after deployment

**Wrong URL format:**
```
https://{INSTANCE}.leanix.net/{workspace}/automations/{id}
```

**Correct URL format:**
```
https://{INSTANCE}.leanix.net/{workspace}/admin/automations/edit/{id}
```

**Components:**
- `{INSTANCE}` - LeanIX instance subdomain (e.g., `your-instance`)
- `{workspace}` - Workspace name from JWT payload `principal.permission.workspaceName`
- `/admin/` - Required path segment for admin UI
- `/automations/edit/` - Edit automation path
- `{id}` - Automation template UUID

**Example:**
```
https://{INSTANCE}.leanix.net/{WORKSPACE}/admin/automations/edit/{AUTOMATION_ID}
```

**Status**: ✅ Fixed in SKILL.md

---

## Action-First Pattern Discovery

### The Problem

The original skill workflow was **script-centric**:
- Step 0 offered "Create new script"
- All goal options in Step 2 led to script generation
- Deployment always created a script + automation

This caused unnecessary complexity for simple goals. Example:
- User wants: "Add a tag when an Application is created"
- Original workflow: Generated JavaScript script
- Better approach: Use `ADD_TAG` built-in action (no script needed)

### The Solution

Implemented **action-first decision logic** (2026-01-27):

1. **Step 2**: Goals now show "Likely Approach" (Built-in vs Script)
2. **Step 2.5**: Decision tree evaluates if scripts are actually needed
3. **Step 3**: New step to configure built-in actions without scripts
4. **Step 7.5**: New deployment path for action-only automations

### When Built-in Actions Suffice

| Goal | Built-in Action | Script Not Needed |
|------|-----------------|-------------------|
| Add/remove tag | `ADD_TAG`, `REMOVE_TAG` | ✅ |
| Set single-select field | `SET_FIELD` | ✅ |
| Set quality state | `SET_FIELD` (fieldType: `QUALITY_SEAL`, fieldName: `lxState`) | ✅ |
| Add creator as subscriber | `ADD_SUBSCRIPTION` | ✅ |
| Create to-do/approval | `CREATE_ACTION_ITEM`, `CREATE_APPROVAL` | ✅ |
| Send email/webhook | `SEND_EMAIL_V2`, `SEND_USER_WEBHOOK` | ✅ |

### When Scripts Are Required

Scripts are needed when:
1. Goal requires reading data from **other** fact sheets (GraphQL query)
2. Goal requires modifying **other** fact sheets (GraphQL mutation)
3. Goal requires conditional logic based on **related** fact sheet data
4. Conditions can't access relation data (only triggering fact sheet)

Examples requiring scripts:
- Tag based on related ITComponent lifecycle
- Sync subscriptions to related fact sheets
- Update relation attributes
- Roll up values from multiple relations

### Key Insight

LeanIX built-in actions are **powerful but underused**. Many automations deployed as scripts could be action-only:

- Action-only: Simpler, faster, no code maintenance
- Script: More flexible, but adds complexity

**Rule**: Start with actions. Only use scripts when actions can't handle the requirement.

**Status**: ✅ Implemented in SKILL.md (Steps 2, 2.5, 3, 7.5)

---

## Curl Best Practices (Historical)

> **Note:** This section is historical. As of the MCP migration (2026-04), all API calls use MCP tools natively. No shell commands, curl, or token handling is needed. The original problem (long JWT tokens breaking shell parsing, shell state not persisting between Bash tool calls) is fully eliminated because MCP handles authentication internally.

---

## Run Script Data Object Constraints

### Pattern: `data.factSheet.subscriptions` is Always Empty

**Discovery**: 2026-02-17
**Issue**: When developing a notification script, assumed `data.factSheet.subscriptions` would contain the fact sheet's subscribers. The array is always empty.

**Wrong assumption:**
```javascript
// ❌ FAILS - subscriptions array is always empty
const responsibleSubs = (data.factSheet.subscriptions || [])
  .filter(s => s.type === "RESPONSIBLE");
```

**Root cause**: The automation runtime's `data` object does NOT populate the subscriptions array. This is a limitation of the Run Script action's data model.

**Solution - fetch via GraphQL:**
```javascript
// ✅ WORKS - fetch subscriptions via GraphQL
const query = "query ($id: ID!) { factSheet(id: $id) { subscriptions { edges { node { id type user { id email displayName } roles { id name } } } } } }";
const res = await fetch(GRAPHQL_URL, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { id: data.factSheet.id } }),
});
const result = await res.json();
const subscriptions = (result?.data?.factSheet?.subscriptions?.edges || []).map(e => e.node);
```

**Status**: ✅ Documented 2026-02-17

---

### Pattern: `data.trigger` is NOT Available in Run Script

**Discovery**: 2026-02-17
**Issue**: Attempted to access `data.trigger.fieldName`, `data.trigger.to.value`, and `data.trigger.from.value` to determine what triggered the automation. These fields don't exist.

**Wrong assumption:**
```javascript
// ❌ FAILS - data.trigger is not populated in Run Script actions
const changedField = data.trigger.fieldName;
const newValue = data.trigger.to.value;
const oldValue = data.trigger.from.value;
```

**Root cause**: The `data.trigger` object is NOT passed to Run Script actions. Only `data.factSheet` contains current fact sheet data.

**Solution - use actual field values:**
```javascript
// ✅ WORKS - read the current field value directly
const currentStatus = data.factSheet.lifecycleStatus;  // The actual field value

// If you need to know "what changed", you cannot determine this in the script.
// Design your automation trigger conditions to filter appropriately,
// or base logic on current state only.
```

**Design implication**: Scripts should be designed to work with **current state** rather than **change detection**. If you need conditional logic based on what changed:
1. Use automation conditions (not script logic) to filter triggers
2. Store previous values in a custom field if change tracking is required
3. Accept that the script sees only current state

**Status**: ✅ Documented 2026-02-17

---

## Built-in Action Limitations

### Pattern: SEND_EMAIL_V2 Cannot Use Dynamic Recipients

**Discovery**: 2026-02-17
**Issue**: Attempted to compute recipients dynamically in a Run Script and pass them to a SEND_EMAIL_V2 action. This is not possible.

**Wrong assumption:**
```javascript
// ❌ FAILS - cannot pass computed recipients to email action
export async function main() {
  const responsibleUsers = await fetchResponsibleSubscribers();
  return { emailRecipients: responsibleUsers.map(u => u.email) };  // No such mechanism
}
```

**Root cause**: SEND_EMAIL_V2 recipients must be configured at automation **definition time**, not computed at runtime. The available recipient types are:
- `FACT_SHEET_SUBSCRIPTION` - Subscribers by type/role (fixed at definition)
- `FACT_SHEET_CREATOR` - The user who created the fact sheet
- Fixed email addresses (hardcoded in automation config)

**There is no way to:**
- Pass a list of emails computed by a script
- Dynamically select recipients based on script logic
- Use script output to determine who receives the email

**Workaround**: Use the **To-Do API** to send notifications with dynamic recipients. LeanIX automatically emails users when a To-Do is assigned to them.

**Status**: ✅ Documented 2026-02-17

---

### Pattern: SEND_USER_WEBHOOK Cannot Pass Custom Payload

**Discovery**: 2026-02-17
**Issue**: Attempted to use SEND_USER_WEBHOOK to send custom data computed by a script. The action only sends a fixed tag string.

**Wrong assumption:**
```javascript
// ❌ FAILS - cannot pass custom payload to webhook action
export async function main() {
  const customData = { computed: "values", from: "script" };
  return { webhookPayload: customData };  // No such mechanism
}
```

**Root cause**: SEND_USER_WEBHOOK only accepts a `tag` parameter (2-256 characters) which is sent as part of a fixed payload structure. You cannot:
- Pass arbitrary JSON computed by a script
- Customize the webhook payload structure
- Include dynamic data beyond the fact sheet's standard fields

**Workaround**: Use `fetch()` directly in your script to call external webhooks with custom payloads:

```javascript
export async function main() {
  const customPayload = {
    factSheetId: data.factSheet.id,
    computedValue: "dynamic data from script logic",
    timestamp: new Date().toISOString()
  };

  await fetch("https://your-webhook-endpoint.com/hook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customPayload)
  });

  return {};
}
```

**Status**: ✅ Documented 2026-02-17

---

### Pattern: To-Do API as Dynamic Notification Workaround

**Discovery**: 2026-02-17
**Issue**: Need to send notifications with dynamic recipients and custom content, but built-in actions don't support this.

**Solution**: Use the LeanIX To-Do REST API. When a To-Do is assigned to a user, LeanIX automatically sends them an email notification.

**API Endpoint:**
```
POST https://{INSTANCE}.leanix.net/services/todos/v1/todos
```

**Request Body:**
```javascript
{
  "status": "OPEN",
  "description": "Custom notification message with dynamic content",
  "assignee": "user-uuid-here",       // Dynamic recipient
  "factSheetId": "fact-sheet-uuid",   // Links to-do to fact sheet
  "factSheetType": "Application"      // Fact sheet type
}
```

**Usage in Run Script:**
```javascript
export async function main() {
  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT - Missing token");

  // Compute recipients dynamically
  const recipients = await fetchResponsibleSubscribers(data.factSheet.id, token);

  // Create a to-do for each recipient
  for (const user of recipients) {
    await fetch(`https://${INSTANCE}.leanix.net/services/todos/v1/todos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "OPEN",
        description: `Review needed for ${data.factSheet.displayName}`,
        assignee: user.id,
        factSheetId: data.factSheet.id,
        factSheetType: data.factSheet.type
      })
    });
  }

  return {};
}
```

**Benefits:**
- Dynamic recipients (any user ID computed at runtime)
- Custom message content (computed from script logic)
- Automatic email notification (LeanIX handles this)
- Trackable (to-dos appear in user's task list)

**Status**: ✅ Documented 2026-02-17

---

## Workspace Data Queries

### Pattern: Fetch All Tags from Workspace

To get available tags for automation triggers or script logic:

```graphql
{
  allTags {
    edges {
      node {
        id
        name
        tagGroup {
          id
          name
        }
      }
    }
  }
}
```

**Usage in skill workflow**: Fetch tags when user needs to select a trigger tag or when script needs to reference tag IDs.

**Status**: ✅ Documented 2026-02-11

---

## Ownership & User Discovery Learnings

### Pattern: Technical User ownerId Shows "null null" in UI

**Discovery**: 2026-03-06
**Issue**: Set `ownerId` on an automation template using the `principal.id` from a technical user's JWT token. The API accepted it (200 OK), but the UI displayed the owner as "null null".

**Root cause**: Technical users (API tokens) have valid UUIDs but no display name in the LeanIX UI. When used as `ownerId`, the automation works but the owner field shows "null null", which is confusing and indicates a misconfiguration.

**Solution**: Always use a **real human user's** account ID as `ownerId`. To find one:
1. Copy from an existing working automation (`GET /templates` → find one with a human owner)
2. Use the `search_users` MCP tool to look up a user by name/email
3. Ask the LeanIX workspace admin for the correct user ID

**Stop signal**: If a user lookup returns "? ?" or blank display name, it's likely a technical user. Do NOT use that ID as `ownerId`.

**Status**: ✅ Documented 2026-03-06

### Pattern: creatorId is Immutable

**Discovery**: 2026-03-06
**Issue**: Attempted to change `creatorId` on an existing automation template via PUT. API returned 200 but the value was unchanged.

**Root cause**: `creatorId` is set at creation time and is immutable. The API silently ignores any attempt to change it — no error, no warning, just no effect.

**Field mutability:**
| Field | Mutable | Notes |
|-------|---------|-------|
| `ownerId` | Yes | Can be changed via PUT |
| `creatorId` | **No** | Set at creation, silently ignored in updates |
| `id` | **No** | Server-generated UUID |
| `workspaceId` | **No** | Server-generated |

**Status**: ✅ Documented 2026-03-06

### Pattern: `GET /scripts/{id}` Endpoint — Backend vs Deployed

**Discovery**: 2026-03-06
**Issue**: Attempted `GET /scripts/{scriptId}` and received 404 in production.

**Note (2026-04-23)**: The backend codebase (`scripts.controller.ts`) defines `GET /scripts/{scriptId}` alongside POST and PUT. The 404 may have been a deployment-specific issue. The MCE fallback still works:
```
GET /executionConfigurations/{scriptId}/code  (service: managed-code-execution/v1)
```

**MCP tools handle this internally** — use `mcp__leanix__get_automation_script()` rather than calling endpoints directly.

**Status**: ⚠️ Use MCP tools; direct endpoint behavior may vary by deployment

### Pattern: No `/workspaces/{ws}/technicalUsers` Endpoint

**Discovery**: 2026-03-06
**Issue**: Guessed that a `technicalUsers` endpoint exists to list technical users. It doesn't.

**Correct approach**: Use the `search_users` MCP tool or the LeanIX admin API to discover users.

**Status**: ✅ Documented 2026-03-06

---

## Debugging Methodology Learnings

### Pattern: Comparison-First Debugging

**Discovery**: 2026-03-06
**Issue**: Spent an entire session chasing opaque UUIDs and guessing API endpoints before comparing the broken automation with a working one.

**Methodology**: When an automation isn't working as expected:
1. **Fetch ALL templates** in one call (`GET /templates`) and cache the result
2. **Find a working automation** with a similar configuration
3. **Diff broken vs working** — focus on: `ownerId`, `active`, trigger config, conditions, actions
4. **Only investigate deeper** if the comparison doesn't reveal the issue

**Why this works**: Most automation failures stem from configuration differences (wrong ownerId, inactive state, misconfigured trigger). Comparing with a working automation surfaces these in seconds, while investigating UUIDs or JWT payloads can waste hours.

**Status**: ✅ Added to SKILL.md as workflow step

### Pattern: Cache Template Fetches

**Discovery**: 2026-03-06
**Issue**: Fetched the same list of templates 5+ times in one session, each requiring a token exchange + API call.

**Solution**: Fetch templates once via `mcp__leanix__list_automations()` and retain the results in conversation context for subsequent operations.

**Status**: ✅ Documented 2026-03-06

---

## How to Use This File

### When Deploying Automations

1. If deployment fails, check **Error Patterns Discovered** for known issues
2. If error is new, add to this file for future reference
3. Update API-REFERENCE.md if the pattern reveals undocumented behavior

### When Validating Documentation

1. Run validation workflow (see SKILL.md)
2. Update **Verification Log** with results
3. Add any discrepancies to **Suggested Documentation Updates**

### When Adding New Learnings

1. Add error patterns with exact error message format
2. Document the learning and fix applied
3. Update status when fixed in documentation
