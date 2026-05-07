# Script Templates

Ready-to-use templates for common automation patterns.

**JavaScript Version:** ECMAScript 2023 (ES2023)

> **Return Object vs GraphQL API:** The return object can update `description`, `name`, `tags`, `lifecycle`, and custom fields on the triggering fact sheet. For relations, subscriptions, relation attributes, location fields, or modifying other fact sheets, use the GraphQL API within async scripts.

## Table of Contents

- [Template 1: Simple Sync Script (No API)](#template-1-simple-sync-script-no-api)
- [Template 2: Async Script with GraphQL Query](#template-2-async-script-with-graphql-query)
- [Template 3: Async Script with Mutations](#template-3-async-script-with-mutations)
- [Template 4: Subscription Management](#template-4-subscription-management)
- [Template 5: Tag Reconciliation](#template-5-tag-reconciliation)
- [Template 6: Multi-Relation Tie-Breaker](#template-6-multi-relation-tie-breaker)
- [Template 7: Relation Attribute Update](#template-7-relation-attribute-update)
- [Template 7b: Cancel Automation Flow](#template-7b-cancel-automation-flow)
- [Choosing the Right Template](#choosing-the-right-template)
- [Template 8: Debug Diagnostic Report](#template-8-debug-diagnostic-report)
- [Diagnostic Report: \[Script Name\]](#diagnostic-report-script-name)
- [Template 9: Multi-Automation Strategy](#template-9-multi-automation-strategy)
- [Automation Strategy: \[Strategy Name\]](#automation-strategy-strategy-name)
- [Template 10: Automation Deployment Helper](#template-10-automation-deployment-helper)
- [Action-Only Templates (No Script Required)](#action-only-templates-no-script-required)

---

## Template 1: Simple Sync Script (No API)

Use when: Updating fields on the triggering fact sheet only.

```javascript
/**
 * [SCRIPT NAME]
 *
 * Trigger: [TRIGGER TYPE] on [FACT SHEET TYPE]
 * Logic: [BRIEF DESCRIPTION]
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

export function main() {
  const fs = data.factSheet;

  // Skip if condition not met
  if (fs.type !== "Application") return {};

  // Your logic here
  const currentTags = fs.tags ?? [];
  const newTag = "YOUR_TAG_ID";

  // Idempotency: check if already applied
  if (currentTags.includes(newTag)) return {};

  // Return updates
  return {
    tags: [...currentTags, newTag],
  };
}
```

---

## Template 2: Async Script with GraphQL Query

Use when: Need to read data from related fact sheets.

```javascript
/**
 * [SCRIPT NAME]
 *
 * Trigger: [TRIGGER TYPE] on [FACT SHEET TYPE]
 * Logic: [BRIEF DESCRIPTION]
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query the fact sheet with relations
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id name rev
      ... on Application {
        relApplicationToITComponent {
          edges {
            node {
              factSheet {
                id name
                ... on ITComponent {
                  lifecycle { phases { phase startDate } }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const fs = json?.data?.factSheet;
  if (!fs) return {};

  // Extract related items safely
  const relatedItems = (fs.relApplicationToITComponent?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(Boolean);

  // Your logic here
  // ...

  return {};
}
```

---

## Template 3: Async Script with Mutations

Use when: Need to modify other fact sheets or create/delete subscriptions/relations.

**Important**: Use the retry pattern below to handle `REVISION_CLASH` errors that occur when concurrent automations modify the same fact sheet.

```javascript
/**
 * [SCRIPT NAME]
 *
 * Trigger: [TRIGGER TYPE] on [FACT SHEET TYPE]
 * Logic: [BRIEF DESCRIPTION]
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

// Helper to get current revision (for retry on REVISION_CLASH)
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

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query current state
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id name rev
      ... on Application {
        relApplicationToITComponent {
          edges {
            node {
              factSheet { id name }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const fs = json?.data?.factSheet;
  if (!fs) return {};

  // Get related fact sheets
  const relatedItems = (fs.relApplicationToITComponent?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(Boolean);

  // Update each related fact sheet with retry on REVISION_CLASH
  for (const item of relatedItems) {
    let retries = 3;

    while (retries > 0) {
      // Re-fetch revision before each mutation attempt
      const currentRev = await getCurrentRev(item.id, token);
      if (!currentRev) throw new Error(`Could not get revision for ${item.id}`);

      const mutRes = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
            updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
              factSheet { rev }
            }
          }`,
          variables: {
            id: item.id,
            rev: currentRev,
            patches: [
              { op: "replace", path: "/description", value: "Updated by automation" }
            ],
          },
        }),
      });

      const mutJson = await mutRes.json();

      if (mutJson?.errors) {
        const errorMsg = JSON.stringify(mutJson.errors);
        // Retry on revision clash
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }
        throw new Error(`Mutation failed: ${errorMsg}`);
      }
      break; // Success
    }
  }

  return {};
}
```

---

## Template 4: Subscription Management

Use when: Creating, updating, or deleting subscriptions.

**Note**: For multiple sequential mutations, use the retry pattern from Template 3 to handle revision clashes.

```javascript
/**
 * [SCRIPT NAME]
 *
 * Trigger: [TRIGGER TYPE] on [FACT SHEET TYPE]
 * Logic: [BRIEF DESCRIPTION]
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";
const TARGET_ROLE_NAME = "Application Owner";

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query with subscriptions
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id name rev
      subscriptions {
        edges {
          node {
            id type
            user { id displayName }
            roles { id name }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const fs = json?.data?.factSheet;
  if (!fs) return {};

  let currentRev = fs.rev;

  // Find target subscriptions
  const subscriptions = (fs.subscriptions?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  const targetSubs = subscriptions.filter(sub =>
    sub.type === "RESPONSIBLE" &&
    sub.roles?.some(r => r.name === TARGET_ROLE_NAME)
  );

  // Create subscription
  const createRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation ($fsId: ID!, $fsRev: Long!, $user: UserInput!, $roles: [SubscriptionToSubscriptionRoleLinkInput]) {
        createSubscription(factSheetId: $fsId, factSheetRev: $fsRev, user: $user, type: RESPONSIBLE, roles: $roles) {
          id
          factSheet { rev }
        }
      }`,
      variables: {
        fsId: fsId,
        fsRev: currentRev,
        user: { id: "USER_ID" },
        roles: [{ id: "ROLE_ID" }],
      },
    }),
  });

  const createJson = await createRes.json();
  if (createJson?.errors) throw new Error(`Create failed: ${JSON.stringify(createJson.errors)}`);
  currentRev = createJson?.data?.createSubscription?.factSheet?.rev ?? currentRev;

  // Delete subscription
  await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation ($id: ID!) { deleteSubscription(id: $id) { id } }`,
      variables: { id: "SUBSCRIPTION_ID" },
    }),
  });

  return {};
}
```

---

## Template 5: Tag Reconciliation

Use when: Managing tags based on related fact sheets (add/remove triggers).

```javascript
/**
 * [SCRIPT NAME]
 *
 * Triggers: Relation added, Relation removed (on [FACT SHEET TYPE])
 * Logic: Tags fact sheet based on related items
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

// Tags to manage
const TAG_IDS = {
  CONDITION_A: "tag-id-for-condition-a",
  CONDITION_B: "tag-id-for-condition-b",
};
const ALL_MANAGED_TAGS = Object.values(TAG_IDS);

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query related items
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      ... on Application {
        relApplicationToITComponent {
          edges {
            node {
              factSheet {
                ... on ITComponent {
                  id
                  tags { id name }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const fs = json?.data?.factSheet;
  if (!fs) return {};

  // Calculate required tags based on related items
  const relatedItems = (fs.relApplicationToITComponent?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(Boolean);

  const requiredTagIds = new Set();
  for (const item of relatedItems) {
    const itemTags = (item.tags || []).map(t => t.id);
    if (itemTags.includes("SOME_CONDITION_TAG")) {
      requiredTagIds.add(TAG_IDS.CONDITION_A);
    }
  }

  // Reconcile tags
  const currentTags = data.factSheet.tags ?? [];
  const otherTags = currentTags.filter(id => !ALL_MANAGED_TAGS.includes(id));
  const currentManagedTags = currentTags.filter(id => ALL_MANAGED_TAGS.includes(id));

  // Idempotency check
  const requiredArray = Array.from(requiredTagIds);
  if (
    currentManagedTags.length === requiredArray.length &&
    requiredArray.every(id => currentManagedTags.includes(id))
  ) {
    return {};
  }

  return { tags: [...otherTags, ...requiredArray] };
}
```

---

## Template 6: Multi-Relation Tie-Breaker

Use when: A fact sheet links to multiple items and you need to aggregate their values.

**Note**: For multiple sequential mutations, use the retry pattern from Template 3 to handle revision clashes.

```javascript
/**
 * [SCRIPT NAME]
 *
 * Trigger: Field value changed ([FIELD] on [RELATED TYPE])
 * Logic: Sets field based on ALL linked items using tie-breaker logic
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const triggerId = data?.factSheet?.id;
  if (!triggerId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query related target fact sheets
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      ... on Initiative {
        relInitiativeToApplication {
          edges { node { factSheet { id } } }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: triggerId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const triggerFs = json?.data?.factSheet;
  if (!triggerFs) return {};

  const targetIds = (triggerFs.relInitiativeToApplication?.edges || [])
    .map(e => e?.node?.factSheet?.id)
    .filter(Boolean);

  // For each target, query ALL its relations and apply tie-breaker
  for (const targetId of targetIds) {
    const targetQuery = `query ($id: ID!) {
      factSheet(id: $id) {
        id rev
        ... on Application {
          targetField
          relApplicationToInitiative {
            edges { node { factSheet { ... on Initiative { statusField } } } }
          }
        }
      }
    }`;

    const targetRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: targetQuery, variables: { id: targetId } }),
    });

    const targetJson = await targetRes.json();
    if (targetJson?.errors) continue;

    const target = targetJson?.data?.factSheet;
    if (!target) continue;

    // Get ALL statuses from ALL related items
    const statuses = (target.relApplicationToInitiative?.edges || [])
      .map(e => e?.node?.factSheet?.statusField)
      .filter(Boolean);

    // Tie-breaker logic
    let newValue;
    if (statuses.length === 0) {
      newValue = null;  // No linked items → clear
    } else if (statuses.some(s => s === "blocked" || s === "frozen")) {
      newValue = "no";  // Any blocking status wins
    } else if (statuses.every(s => s === "active")) {
      newValue = "yes"; // All must be active
    } else {
      continue; // Mixed/unknown → no change
    }

    // Skip if unchanged
    if (target.targetField === newValue) continue;

    // Update target
    await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
          updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
            factSheet { id }
          }
        }`,
        variables: {
          id: target.id,
          rev: target.rev,
          patches: [{ op: "replace", path: "/targetField", value: newValue }],
        },
      }),
    });
  }

  return {};
}
```

---

## Template 7: Relation Attribute Update

Use when: Updating attributes on relations (not the related fact sheet).

**Note**: For multiple sequential mutations, use the retry pattern from Template 3 to handle revision clashes.

```javascript
/**
 * [SCRIPT NAME]
 *
 * Trigger: [TRIGGER TYPE] on [FACT SHEET TYPE]
 * Logic: Updates relation attribute based on [CONDITION]
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query with relation attributes
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id rev
      ... on Application {
        relApplicationToITComponent {
          edges {
            node {
              id                          # Relation ID (for patching)
              obsolescenceRiskStatus      # Relation attribute
              factSheet {
                id                        # Related fact sheet ID
                ... on ITComponent {
                  lifecycle { phases { phase startDate } }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const fs = json?.data?.factSheet;
  if (!fs) return {};

  let currentRev = fs.rev;

  const relations = (fs.relApplicationToITComponent?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  for (const rel of relations) {
    const newStatus = calculateStatus(rel);  // Your logic
    if (newStatus === rel.obsolescenceRiskStatus) continue;

    // Patch relation on PARENT fact sheet using RELATION ID
    const mutRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
          updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
            factSheet { rev }
          }
        }`,
        variables: {
          id: fsId,             // Parent fact sheet ID
          rev: currentRev,
          patches: [{
            op: "replace",
            path: `/relApplicationToITComponent/${rel.id}`,  // Relation ID
            value: JSON.stringify({
              factSheetId: rel.factSheet.id,  // Related fact sheet ID
              obsolescenceRiskStatus: newStatus,
            }),
          }],
        },
      }),
    });

    const mutJson = await mutRes.json();
    if (mutJson?.errors) throw new Error(`Patch failed: ${JSON.stringify(mutJson.errors)}`);
    currentRev = mutJson?.data?.updateFactSheet?.factSheet?.rev ?? currentRev;
  }

  return {};
}

function calculateStatus(rel) {
  // Your logic here
  return "riskAccepted";
}
```

---

## Template 7b: Cancel Automation Flow

Use when: You need to stop subsequent actions in an automation based on a condition.

When a script throws an error containing "cancel automation flow", LeanIX stops executing
any remaining actions in the automation sequence. This is useful for validation scripts
that run before other actions.

```javascript
/**
 * [SCRIPT NAME] - Validation Guard
 *
 * Trigger: [TRIGGER TYPE] on [FACT SHEET TYPE]
 * Logic: Validates condition and cancels automation if not met
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

export function main() {
  const fs = data.factSheet;

  // Example: Cancel if mandatory field is missing
  if (!fs.businessCriticality) {
    throw new Error("cancel automation flow");
  }

  // Example: Cancel if already processed
  if (fs.tags?.includes("ALREADY_PROCESSED_TAG")) {
    throw new Error("cancel automation flow");
  }

  // Example: Cancel if wrong lifecycle phase
  const currentPhase = fs.lifecycle?.phases?.find(p => p.startDate)?.phase;
  if (currentPhase === "endOfLife") {
    throw new Error("cancel automation flow");
  }

  // Condition passed - return empty to continue to next action
  return {};
}
```

**Async version with validation query:**

```javascript
const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) throw new Error("cancel automation flow");

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query for validation data
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      ... on Application {
        relApplicationToBusinessCapability {
          edges { node { factSheet { id } } }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error("cancel automation flow");

  const fs = json?.data?.factSheet;

  // Cancel if no business capabilities linked
  const bcRelations = fs?.relApplicationToBusinessCapability?.edges || [];
  if (bcRelations.length === 0) {
    throw new Error("cancel automation flow");
  }

  return {};
}
```

---

## Choosing the Right Template

### Script Templates (For Complex Logic)

| Your Use Case | Template |
|---------------|----------|
| Update tags/fields on triggering fact sheet only | Template 1: Simple Sync |
| Read data from related fact sheets | Template 2: GraphQL Query |
| Update other fact sheets | Template 3: Mutations |
| Create/delete subscriptions | Template 4: Subscription Management |
| Manage tags based on relations (add + remove) | Template 5: Tag Reconciliation |
| Aggregate values from multiple relations | Template 6: Multi-Relation Tie-Breaker |
| Update relation attributes | Template 7: Relation Attribute Update |
| Stop automation based on condition | Template 7b: Cancel Automation Flow |
| Debug a failing script | Template 8: Debug Diagnostic Report |
| Plan multiple coordinated automations | Template 9: Multi-Automation Strategy |
| Archive a fact sheet | Template 19: Archive Fact Sheet |

### Action-Only Templates (No Script Needed)

| Your Use Case | Template |
|---------------|----------|
| Add tag on fact sheet creation | Template 11: Add Tag on Creation |
| Set default field value on creation | Template 12: Set Field on Creation |
| Multiple actions in sequence | Template 13: Multi-Action Chain |
| Approval workflow with accept/reject branches | Template 14: Approval Workflow |
| Add creator as subscriber | Template 15: Add Creator as Subscriber |
| Send webhook on tag addition | Template 16: Send Webhook on Tag |
| Remove tag when field changes | Template 17: Remove Tag on Field Change |
| Auto-approve fact sheet on creation | Template 18: Auto-Approve on Creation |

---

## Template 8: Debug Diagnostic Report

Use when: Diagnosing and fixing a failing LeanIX automation script.

### Diagnostic Report Format

```markdown
## Diagnostic Report: [Script Name]

### Summary
- **Reported Issue**: [Silent failure / Error message / Wrong behavior]
- **Trigger Type**: [Trigger configured]
- **Fact Sheet Type**: [Type]

---

### Automated Checks

| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | console.log detection | [PASS/FAIL] | [Found N occurrences / None found] |
| 2 | Export syntax | [PASS/FAIL] | [export function main() / Missing export] |
| 3 | Async declaration | [PASS/FAIL] | [async present / Missing for await usage] |
| 4 | Inline fragments | [PASS/FAIL] | [Properly wrapped / Line N missing wrapper] |
| 5 | Revision tracking | [PASS/FAIL] | [currentRev tracked / Missing after mutations] |
| 6 | Idempotency checks | [PASS/FAIL] | [Early returns present / No idempotency] |
| 7 | Error handling | [PASS/FAIL] | [json?.errors checked / Missing checks] |
| 8 | Bearer token path | [PASS/FAIL] | [Correct path / Wrong path] |
| 9 | Edge/node access | [PASS/FAIL] | [Safe access / Direct access without null checks] |
| 10 | displayName usage | [PASS/WARN] | [Used correctly / Consider using displayName] |
| 11 | Revision type | [PASS/FAIL] | [Number / Passed as string] |
| 12 | Relation ID usage | [PASS/FAIL] | [Correct ID / Using factSheet.id for relation patch] |

---

### Issues Found

| # | Issue | Severity | Location | Fix |
|---|-------|----------|----------|-----|
| 1 | [Description] | Critical | Line [N] | [Specific fix] |
| 2 | [Description] | Warning | Line [N] | [Specific fix] |
| ... | ... | ... | ... | ... |

---

### Recommended Fixes

#### Issue 1: [Issue Title]

**Problem:**
[Explain what's wrong and why it causes the observed behavior]

**Before:**
\`\`\`javascript
[Problematic code]
\`\`\`

**After:**
\`\`\`javascript
[Fixed code]
\`\`\`

[Repeat for each issue]

---

### Test Strategy

1. **Verify script execution**: Add temporary description marker
   \`\`\`javascript
   return { description: data.factSheet.description + "\\n\\n[DEBUG] Script ran at " + new Date().toISOString() };
   \`\`\`

2. **Test specific condition**: Add conditional early return
   \`\`\`javascript
   if (data.factSheet.name === "Test Application") {
     return { tags: ["DEBUG_TAG"] };
   }
   \`\`\`

3. **Check automation logs**: Review run history in LeanIX Automations UI

---

### Corrected Script

[Full corrected script with all fixes applied]
```

---

## Template 9: Multi-Automation Strategy

Use when: Planning multiple automations that work together for complex scenarios.

### Strategy Document Format

```markdown
## Automation Strategy: [Strategy Name]

### Business Goal
[What outcome does this automation strategy achieve?]

### Fact Sheets Involved

| Fact Sheet Type | Role in Strategy |
|-----------------|-----------------|
| [Type 1] | Primary - where logic originates |
| [Type 2] | Target - receives propagated data |
| [Type 3] | Intermediary - links primary to target |

### Relationship Map

\`\`\`
[Primary Type] ----[relation name]----> [Target Type]
      |
      +----[relation name]----> [Other Type]
\`\`\`

---

### Trigger Matrix

| # | Automation Name | Fact Sheet Type | Trigger | Script File | Purpose |
|---|-----------------|-----------------|---------|-------------|---------|
| 1 | [name]-add | [Type] | [Trigger details] | [name]-add.js | [What it does] |
| 2 | [name]-remove | [Type] | [Trigger details] | [name]-remove.js | [What it does] |
| 3 | [name]-cleanup | [Type] | [Trigger details] | [name]-cleanup.js | [What it does] |
| ... | ... | ... | ... | ... | ... |

---

### Data Flow

1. **Trigger Event**: [What starts the chain]
2. **Script #1 executes**: [What it does]
3. **Result**: [What changes]
4. **If [condition]**: Script #2 executes...
5. ...

### Edge Cases

| Edge Case | Handled By | Behavior |
|-----------|-----------|----------|
| [Related item deleted] | Script #[N] | [What happens] |
| [Relation removed] | Script #[N] | [What happens] |
| [No related items] | Script #[N] | [Field cleared / No action] |
| [Multiple related items with conflict] | Script #[N] | [Tie-breaker logic] |

---

### Scripts

#### Script 1: [name]-add.js

**Trigger**: [Trigger type] on [Fact Sheet Type]
**Purpose**: [What it accomplishes]

\`\`\`javascript
/**
 * [Script Name] - Part 1 of [N]
 *
 * Strategy: [Strategy Name]
 * Related scripts: [list other scripts]
 *
 * Trigger: [Trigger] on [Type]
 * Purpose: [Purpose]
 */

// [Script code]
\`\`\`

#### Script 2: [name]-remove.js

[Repeat pattern for each script]

---

### Setup Instructions

1. **Create Script Files**:
   - Create each script file in your automations folder
   - Update GRAPHQL_URL with your instance name

2. **Create Automations**:
   | # | Go to Automations > Create | Settings |
   |---|---------------------------|----------|
   | 1 | Name: [name]-add | Type: [Type], Trigger: [Trigger], Action: Run Script |
   | 2 | ... | ... |

3. **Configure Scripts**:
   - Replace placeholder tag IDs
   - Replace placeholder role IDs
   - Verify field names match your workspace

4. **Test Sequence**:
   - [ ] Create test fact sheet
   - [ ] Trigger scenario 1: [action] → verify [expected result]
   - [ ] Trigger scenario 2: [action] → verify [expected result]
   - [ ] Trigger edge case: [action] → verify [expected result]

---

### Maintenance Notes

- **Adding new [Type]**: [What to update]
- **Changing [field]**: [What to update]
- **Disabling**: Deactivate automations #[N], #[N], and #[N] together
```

---

## Template 10: Automation Deployment Helper

Use when: Deploying automations programmatically via the LeanIX Automations API.

### Helper Functions

```javascript
/**
 * LeanIX Automations Deployment Helper
 *
 * Use these functions to deploy automations via API.
 * Run in Node.js or browser console (not in LeanIX Run Scripts).
 *
 * Two-step process:
 * 1. Create script via /scripts endpoint
 * 2. Create automation template via /templates/ endpoint
 */

const AUTOMATIONS_URL = "https://INSTANCE.leanix.net/services/automations/v1";

/**
 * Create a script in LeanIX
 *
 * @param {string} token - Bearer token
 * @param {string} name - Script name
 * @param {string} code - Script code
 * @param {string} description - Script description (optional)
 * @returns {Promise<{id: string, name: string}>} - Created script
 */
async function createScript(token, name, code, description = "") {
  const response = await fetch(`${AUTOMATIONS_URL}/scripts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, description, code })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Script creation failed: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Create an automation template
 * @param {string} token - Bearer token
 * @param {object} config - Automation configuration
 * @param {string} ownerId - Required: automation owner's account ID
 * @returns {Promise<{id: string, name: string}>} - Created automation
 */
async function createAutomation(token, config, ownerId) {
  // Trigger uses only eventType
  const trigger = {
    eventType: config.trigger.eventType || config.trigger.type,
    ...config.trigger
  };
  delete trigger.type;  // Remove deprecated type field

  // Format conditions with conditionType
  const conditions = (config.conditions || []).map(cond => ({
    conditionType: cond.conditionType || cond.type,
    ...cond,
    // Convert ignore: true to value: true for boolean conditions
    value: cond.value ?? cond.ignore
  }));
  conditions.forEach(c => { delete c.type; delete c.ignore; });

  // Format actions with required id and actionType fields
  const actions = config.actions.map((action, index) => ({
    id: action.id || `${index}_${action.actionType || action.type}`,
    actionType: action.actionType || action.type,
    scriptId: action.scriptId,
    startsAfter: action.startsAfter || null,
    ...action
  }));

  const response = await fetch(`${AUTOMATIONS_URL}/templates/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: config.name,
      description: config.description || "",
      factSheetType: config.factSheetType,
      ownerId: ownerId,  // Required field
      trigger,
      conditions,
      actions,
      active: config.active ?? false  // Default to disabled
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Automation creation failed: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Create an automation using an existing script ID
 *
 * Use this when you've already created the script.
 *
 * @param {string} token - Bearer token
 * @param {object} config - Automation configuration
 * @param {string} scriptId - Existing script ID
 * @param {string} ownerId - Required: automation owner's account ID
 * @returns {Promise<{id: string, name: string}>} - Created automation
 */
async function createAutomationWithExistingScript(token, config, scriptId, ownerId) {
  return createAutomation(token, {
    ...config,
    actions: [{
      id: "0_SET_FACT_SHEET_FIELD_SCRIPT",
      actionType: "SET_FACT_SHEET_FIELD_SCRIPT",
      scriptId: scriptId,
      startsAfter: null
    }]
  }, ownerId);
}

/**
 * Deploy a complete automation (script + template)
 *
 * Two-step process:
 * 1. Create script via /scripts
 * 2. Create automation template via /templates/
 *
 * @param {string} token - Bearer token
 * @param {object} config - Full deployment configuration
 * @param {string} ownerId - Required: automation owner's account ID
 * @returns {Promise<{script: object, automation: object}>}
 */
async function deployAutomation(token, config, ownerId) {
  // Step 1: Create the script
  const script = await createScript(token, config.scriptName, config.scriptCode);

  // Step 2: Create automation with script reference
  const automation = await createAutomation(token, {
    name: config.automationName,
    description: config.description,
    factSheetType: config.factSheetType,
    trigger: config.trigger,
    conditions: config.conditions,
    actions: [
      {
        id: "0_SET_FACT_SHEET_FIELD_SCRIPT",
        actionType: "SET_FACT_SHEET_FIELD_SCRIPT",
        scriptId: script.id,
        startsAfter: null
      }
    ],
    active: false  // Always start disabled for safety
  }, ownerId);

  return { script, automation };
}

/**
 * Enable or disable an automation
 * @param {string} token - Bearer token
 * @param {string} automationId - Automation template ID
 * @param {boolean} active - Enable state
 */
async function setAutomationActive(token, automationId, active) {
  const response = await fetch(`${AUTOMATIONS_URL}/templates/${automationId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ active })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Enable/disable failed: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * List all scripts
 * @param {string} token - Bearer token
 * @returns {Promise<Array>} - List of scripts
 */
async function listScripts(token) {
  const response = await fetch(`${AUTOMATIONS_URL}/scripts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`List scripts failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * List all automation templates
 * @param {string} token - Bearer token
 * @returns {Promise<Array>} - List of automations
 */
async function listAutomations(token) {
  const response = await fetch(`${AUTOMATIONS_URL}/templates`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
}

/**
 * Delete a script
 * @param {string} token - Bearer token
 * @param {string} scriptId - Script ID
 */
async function deleteScript(token, scriptId) {
  const response = await fetch(`${AUTOMATIONS_URL}/scripts/${scriptId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Delete failed: ${response.statusText}`);
  }
}

/**
 * Delete an automation template
 * @param {string} token - Bearer token
 * @param {string} automationId - Automation ID
 */
async function deleteAutomation(token, automationId) {
  const response = await fetch(`${AUTOMATIONS_URL}/templates/${automationId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Delete failed: ${response.statusText}`);
  }
}
```

### Usage Example: Deploy with Existing Script

Use this when you've already created a script and want to create the automation:

```javascript
// Configuration
const TOKEN = "your-api-token";
const INSTANCE = "your-instance";
const OWNER_ID = "your-account-id";  // Required: get from user profile

// Update base URL
const AUTOMATIONS_URL = `https://${INSTANCE}.leanix.net/services/automations/v1`;

// Existing script ID
const EXISTING_SCRIPT_ID = "your-script-uuid";

// Deploy automation only (script already exists)
async function deployWithExistingScript() {
  try {
    const automation = await createAutomationWithExistingScript(TOKEN, {
      name: "Tag Application on Creation",
      description: "Adds NEW tag when Application is created",
      factSheetType: "Application",
      trigger: {
        eventType: "FACT_SHEET_CREATION"
      },
      conditions: [
        {
          conditionType: "IGNORE_TECHNICAL_USERS",
          value: true
        }
      ]
    }, EXISTING_SCRIPT_ID, OWNER_ID);

    console.log("Deployment successful!");
    console.log("Automation ID:", automation.id);
    console.log("Automation URL:", `https://${INSTANCE}.leanix.net/WORKSPACE/automations/${automation.id}`);
    console.log("\nNote: Automation is INACTIVE. Enable after testing.");

  } catch (error) {
    console.error("Deployment failed:", error.message);
  }
}

deployWithExistingScript();
```

### Usage Example: Full Deployment (Script + Automation)

This creates both the script and automation via API in two steps:

```javascript
// Configuration
const TOKEN = "your-api-token";
const INSTANCE = "your-instance";
const OWNER_ID = "your-account-id";  // Required: get from user profile

// Update base URL
const AUTOMATIONS_URL = `https://${INSTANCE}.leanix.net/services/automations/v1`;

// Define the script
const scriptCode = `/**
 * Tag New Applications
 * Adds 'NEW' tag when Application is created
 */
export function main() {
  const tags = data.factSheet.tags ?? [];
  const NEW_TAG_ID = "your-new-tag-id";

  if (tags.includes(NEW_TAG_ID)) return {};

  return { tags: [...tags, NEW_TAG_ID] };
}`;

// Deploy script + automation
async function deploy() {
  try {
    const result = await deployAutomation(TOKEN, {
      scriptName: "Tag New Applications",
      scriptCode: scriptCode,
      automationName: "Tag Application on Creation",
      description: "Adds NEW tag when Application is created",
      factSheetType: "Application",
      trigger: {
        eventType: "FACT_SHEET_CREATION"
      },
      conditions: [
        {
          conditionType: "IGNORE_TECHNICAL_USERS",
          value: true
        }
      ]
    }, OWNER_ID);

    console.log("Deployment successful!");
    console.log("Script ID:", result.script.id);
    console.log("Automation ID:", result.automation.id);
    console.log("Automation URL:", `https://${INSTANCE}.leanix.net/WORKSPACE/automations/${result.automation.id}`);
    console.log("\nNote: Automation is INACTIVE. Enable after testing.");

  } catch (error) {
    console.error("Deployment failed:", error.message);
  }
}

deploy();
```

### Usage Example: Deploy with Multiple Triggers

For scenarios requiring multiple automations (e.g., subscription sync):

```javascript
async function deployMultiTriggerAutomation(token, scriptId, ownerId) {
  // Create automation for "Subscription Added"
  const addAutomation = await createAutomation(token, {
    name: "Sync Owners - On Add",
    description: "Propagates Application Owner when subscription added",
    factSheetType: "Application",
    trigger: {
      eventType: "SUBSCRIPTION_ADDITION",
      subscriptionType: "RESPONSIBLE",
      roleId: "application-owner-role-id"
    },
    conditions: [],
    actions: [{
      id: "0_SET_FACT_SHEET_FIELD_SCRIPT",
      actionType: "SET_FACT_SHEET_FIELD_SCRIPT",
      scriptId: scriptId,
      startsAfter: null
    }],
    active: false
  }, ownerId);

  // Create automation for "Subscription Removed"
  const removeAutomation = await createAutomation(token, {
    name: "Sync Owners - On Remove",
    description: "Removes Application Owner when subscription removed",
    factSheetType: "Application",
    trigger: {
      eventType: "SUBSCRIPTION_REMOVAL",
      subscriptionType: "RESPONSIBLE",
      roleId: "application-owner-role-id"
    },
    conditions: [],
    actions: [{
      id: "0_SET_FACT_SHEET_FIELD_SCRIPT",
      actionType: "SET_FACT_SHEET_FIELD_SCRIPT",
      scriptId: scriptId,
      startsAfter: null
    }],
    active: false
  }, ownerId);

  // Create automation for "Relation Added"
  const relationAutomation = await createAutomation(token, {
    name: "Sync Owners - On Relation Add",
    description: "Propagates owners to newly linked IT Components",
    factSheetType: "Application",
    trigger: {
      eventType: "RELATION_ADDITION",
      relationType: "relApplicationToITComponent"
    },
    conditions: [],
    actions: [{
      id: "0_SET_FACT_SHEET_FIELD_SCRIPT",
      actionType: "SET_FACT_SHEET_FIELD_SCRIPT",
      scriptId: scriptId,
      startsAfter: null
    }],
    active: false
  }, ownerId);

  return {
    automations: [addAutomation, removeAutomation, relationAutomation]
  };
}

// Usage:
// const scriptId = "your-script-id";
// const ownerId = "your-account-id";
// deployMultiTriggerAutomation(token, scriptId, ownerId);
```

### Trigger Type Quick Reference

> **Important:** Triggers use only `eventType` (not `type`).

```javascript
// Fact Sheet Created
{ eventType: "FACT_SHEET_CREATION" }

// Field Changed
{
  eventType: "FIELD_CHANGE",
  fieldName: "businessCriticality",
  fieldType: "SINGLE_SELECT",
  fromValue: null,      // optional: "Empty"
  toValue: "missionCritical"  // optional: specific value
}

// Subscription Added/Removed
{
  eventType: "SUBSCRIPTION_ADDITION",  // or "SUBSCRIPTION_REMOVAL"
  subscriptionType: "RESPONSIBLE",  // or "ACCOUNTABLE", "OBSERVER"
  roleId: "role-uuid"  // optional
}

// Relation Added/Changed/Removed
{
  eventType: "RELATION_ADDITION",  // or "RELATION_CHANGE", "RELATION_REMOVAL"
  relationType: "relApplicationToITComponent"
}

// Tag Added/Removed
{
  eventType: "TAG_ADDITION",  // or "TAG_REMOVAL"
  tagId: "tag-uuid"
}

// Quality State Changed
{
  eventType: "QUALITY_STATE_CHANGE_TO",
  qualityState: "APPROVED"  // or "BROKEN", "DRAFT", "REJECTED"
}

// Lifecycle State Reached (checked nightly)
{
  eventType: "LIFECYCLE_PHASE_CHANGE",
  phase: "endOfLife",  // or "plan", "phaseIn", "active", "phaseOut"
  daysOffset: -30  // optional: negative = before, positive = after
}

// Completion Score Changed
{ eventType: "COMPLETION_SCORE_CHANGE" }
```

### Action Type Quick Reference

> **Important:** All actions require `id`, `actionType`, and `startsAfter` fields.

```javascript
// Run Script
{
  id: "0_SET_FACT_SHEET_FIELD_SCRIPT",
  actionType: "SET_FACT_SHEET_FIELD_SCRIPT",
  scriptId: "script-uuid",
  startsAfter: null
}

// Multiple actions (sequential)
{
  id: "1_ADD_TAG",
  actionType: "ADD_TAG",
  tagId: "tag-uuid",
  startsAfter: "0_SET_FACT_SHEET_FIELD_SCRIPT"  // Runs after action 0
}
```

---

## Action-Only Templates (No Script Required)

These templates deploy automations using only built-in actions, without creating a script.

### Template 11: Add Tag on Creation (Action-Only)

Use when: You want to add a default tag to newly created fact sheets.

**Why action-only?** Simple tag addition doesn't require scripts.

```json
{
  "name": "Tag New Applications",
  "description": "Adds 'NEW' tag when Application is created",
  "factSheetType": "Application",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FACT_SHEET_CREATION"
  },
  "conditions": [
    {
      "conditionType": "IGNORE_TECHNICAL_USERS",
      "value": true
    }
  ],
  "actions": [
    {
      "id": "0_ADD_TAG",
      "actionType": "ADD_TAG",
      "tagId": "{TAG_UUID}",
      "startsAfter": null,
      "onResolution": null
    }
  ],
  "active": false
}
```

**Configuration:**
- Replace `{OWNER_ID}` with your account UUID
- Replace `{TAG_UUID}` with the tag ID from MCP (`mcp__leanix__get_overview`)

---

### Template 12: Set Field on Creation (Action-Only)

Use when: You want to set a default field value on newly created fact sheets.

```json
{
  "name": "Set Default Business Criticality",
  "description": "Sets businessCriticality to 'administrativeService' on creation",
  "factSheetType": "Application",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FACT_SHEET_CREATION"
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_SET_FIELD",
      "actionType": "SET_FIELD",
      "fieldType": "SINGLE_SELECT",
      "fieldName": "businessCriticality",
      "value": "administrativeService",
      "startsAfter": null,
      "onResolution": null
    }
  ],
  "active": false
}
```

---

### Template 13: Multi-Action Chain (Action-Only)

Use when: You want multiple actions to execute in sequence on a trigger.

**Example**: Tag + Set Field + Send Email on creation

```json
{
  "name": "Initialize New Application",
  "description": "Tags, sets field, and notifies on Application creation",
  "factSheetType": "Application",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FACT_SHEET_CREATION"
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_ADD_TAG",
      "actionType": "ADD_TAG",
      "tagId": "{NEW_TAG_UUID}",
      "startsAfter": null,
      "onResolution": null
    },
    {
      "id": "1_SET_FIELD",
      "actionType": "SET_FIELD",
      "fieldType": "SINGLE_SELECT",
      "fieldName": "businessCriticality",
      "value": "administrativeService",
      "startsAfter": "0_ADD_TAG",
      "onResolution": null
    },
    {
      "id": "2_SEND_EMAIL_V2",
      "actionType": "SEND_EMAIL_V2",
      "recipients": {
        "type": "FACT_SHEET_CREATOR"
      },
      "subject": "Application Created",
      "body": "Your application **{{factSheet.displayName}}** has been created and initialized.\n\n[View Application]({{factSheet.link}})",
      "startsAfter": "1_SET_FIELD",
      "onResolution": null
    }
  ],
  "active": false
}
```

**Key pattern:** Each action's `startsAfter` references the previous action's `id`.

---

### Template 14: Approval Workflow with Branching (Action-Only)

Use when: You need approval before setting a field value, with different outcomes for accept/reject.

```json
{
  "name": "Retirement Approval Workflow",
  "description": "Requires approval before setting lifecycle phase",
  "factSheetType": "Application",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FIELD_CHANGE",
    "fieldName": "proposedRetirement",
    "fieldType": "SINGLE_SELECT",
    "from": { "type": "ANYTHING" },
    "to": { "type": "VALUE", "value": "requested" }
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_CREATE_APPROVAL",
      "actionType": "CREATE_APPROVAL",
      "name": "Approve Application Retirement",
      "description": "Please review and approve the retirement of this application.",
      "assignee": {
        "type": "FACT_SHEET_SUBSCRIPTION",
        "subscriptionTypes": ["ACCOUNTABLE"]
      },
      "dueDateOffset": 14,
      "startsAfter": null,
      "onResolution": null
    },
    {
      "id": "1_SET_FIELD_APPROVED",
      "actionType": "SET_FIELD",
      "fieldType": "SINGLE_SELECT",
      "fieldName": "retirementStatus",
      "value": "approved",
      "startsAfter": "0_CREATE_APPROVAL",
      "onResolution": "ACCEPTED"
    },
    {
      "id": "2_ADD_TAG_APPROVED",
      "actionType": "ADD_TAG",
      "tagId": "{RETIREMENT_APPROVED_TAG}",
      "startsAfter": "1_SET_FIELD_APPROVED",
      "onResolution": null
    },
    {
      "id": "3_SET_FIELD_REJECTED",
      "actionType": "SET_FIELD",
      "fieldType": "SINGLE_SELECT",
      "fieldName": "retirementStatus",
      "value": "rejected",
      "startsAfter": "0_CREATE_APPROVAL",
      "onResolution": "REJECTED"
    },
    {
      "id": "4_SEND_EMAIL_REJECTED",
      "actionType": "SEND_EMAIL_V2",
      "recipients": {
        "type": "FACT_SHEET_CREATOR"
      },
      "subject": "Retirement Request Rejected",
      "body": "Your retirement request for **{{factSheet.displayName}}** was not approved.",
      "startsAfter": "3_SET_FIELD_REJECTED",
      "onResolution": null
    }
  ],
  "active": false
}
```

**Branching pattern:**
- Actions 1-2 run only when approval is `ACCEPTED`
- Actions 3-4 run only when approval is `REJECTED`
- Use `onResolution` on the action that immediately follows the approval
- Subsequent actions in the same branch don't need `onResolution`

---

### Template 15: Add Creator as Subscriber (Action-Only)

Use when: You want to automatically add the fact sheet creator as a responsible subscriber.

```json
{
  "name": "Add Creator as Owner",
  "description": "Adds fact sheet creator as Application Owner",
  "factSheetType": "Application",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FACT_SHEET_CREATION"
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_ADD_SUBSCRIPTION",
      "actionType": "ADD_SUBSCRIPTION",
      "newSubscriber": {
        "type": "FACT_SHEET_CREATOR"
      },
      "subscription": {
        "type": "RESPONSIBLE",
        "roleIds": ["{APPLICATION_OWNER_ROLE_ID}"]
      },
      "startsAfter": null,
      "onResolution": null
    }
  ],
  "active": false
}
```

---

### Template 16: Send Webhook on Tag (Action-Only)

Use when: You want to trigger an external system when a specific tag is added.

```json
{
  "name": "Notify External System on High Priority",
  "description": "Sends webhook when 'High Priority' tag is added",
  "factSheetType": "Application",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "TAG_ADDITION",
    "tagId": "{HIGH_PRIORITY_TAG_ID}"
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_SEND_USER_WEBHOOK",
      "actionType": "SEND_USER_WEBHOOK",
      "tag": "high-priority-notification",
      "startsAfter": null,
      "onResolution": null
    }
  ],
  "active": false
}
```

---

### Template 17: Remove Tag on Field Change (Action-Only)

Use when: You want to remove a tag when a field is set to a specific value (e.g., remove "NEW" tag when status is set).

```json
{
  "name": "Remove NEW Tag on Status Change",
  "description": "Removes 'NEW' tag when status is set to 'reviewed'",
  "factSheetType": "Application",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FIELD_CHANGE",
    "fieldName": "status",
    "fieldType": "SINGLE_SELECT",
    "from": { "type": "ANYTHING" },
    "to": { "type": "VALUE", "value": "reviewed" }
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_REMOVE_TAG",
      "actionType": "REMOVE_TAG",
      "tagId": "{NEW_TAG_UUID}",
      "startsAfter": null,
      "onResolution": null
    }
  ],
  "active": false
}
```

**Configuration:**
- Replace `{OWNER_ID}` with your account UUID
- Replace `{NEW_TAG_UUID}` with the tag ID to remove
- Adjust `fieldName` and `to.value` for your specific field/value

---

### Template 18: Auto-Approve on Creation (Action-Only)

Use when: You want to automatically set quality state to "Approved" when a fact sheet is created.

**Note:** Quality state can only be set to `APPROVED` when all mandatory attributes are filled. For newly created fact sheets, this may require chaining with a `SET_FIELD` action to set required fields first.

```json
{
  "name": "Auto-Approve New Interfaces",
  "description": "Sets quality state to Approved when Interface is created",
  "factSheetType": "Interface",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FACT_SHEET_CREATION"
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_SET_FIELD_QS",
      "actionType": "SET_FIELD",
      "fieldType": "QUALITY_SEAL",
      "fieldName": "lxState",
      "value": {"type": "VALUE", "value": "APPROVED"},
      "startsAfter": null,
      "onResolution": null
    }
  ],
  "active": false
}
```

**With prerequisite field setting:**

```json
{
  "name": "Initialize and Approve New Interfaces",
  "description": "Sets required fields then approves Interface on creation",
  "factSheetType": "Interface",
  "ownerId": "{OWNER_ID}",
  "trigger": {
    "eventType": "FACT_SHEET_CREATION"
  },
  "conditions": [],
  "actions": [
    {
      "id": "0_SET_FIELD",
      "actionType": "SET_FIELD",
      "fieldType": "SINGLE_SELECT",
      "fieldName": "interfaceType",
      "value": "internal",
      "startsAfter": null,
      "onResolution": null
    },
    {
      "id": "1_SET_FIELD_QS",
      "actionType": "SET_FIELD",
      "fieldType": "QUALITY_SEAL",
      "fieldName": "lxState",
      "value": {"type": "VALUE", "value": "APPROVED"},
      "startsAfter": "0_SET_FIELD",
      "onResolution": null
    }
  ],
  "active": false
}
```

---

### Template 19: Archive Fact Sheet

Use when: You want to archive a fact sheet based on a trigger (e.g., specific tag added, field value changed).

**Important**: This is a script template because archiving requires a GraphQL mutation - it cannot be done via built-in actions.

**Note on GraphQL queries**: When deploying via API, use regular strings (not template literals) for GraphQL queries to avoid "Invalid JavaScript code" errors.

```javascript
/**
 * Archive Fact Sheet on Tag
 *
 * Trigger: Tag Added on [FACT SHEET TYPE]
 * Logic: Archives the fact sheet with a comment
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Get current revision and status
  const queryRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query ($id: ID!) { factSheet(id: $id) { id rev status } }",
      variables: { id: fsId }
    }),
  });

  const queryJson = await queryRes.json();
  if (queryJson?.errors) throw new Error("Query failed: " + JSON.stringify(queryJson.errors));

  const fs = queryJson?.data?.factSheet;
  if (!fs) return {};

  // Idempotency: Skip if already archived
  if (fs.status === "ARCHIVED") return {};

  // Archive the fact sheet with comment
  const mutRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "mutation ($id: ID!, $rev: Long!, $comment: String!, $patches: [Patch]!) { updateFactSheet(id: $id, rev: $rev, comment: $comment, patches: $patches, validateOnly: false) { factSheet { id rev status } } }",
      variables: {
        id: fsId,
        rev: fs.rev,
        comment: "Archived via automation",
        patches: [{ op: "add", path: "/status", value: "ARCHIVED" }]
      },
    }),
  });

  const mutJson = await mutRes.json();
  if (mutJson?.errors) throw new Error("Archive failed: " + JSON.stringify(mutJson.errors));

  return {};
}
```

**Configuration:**
- Replace `INSTANCE` with your LeanIX instance (e.g., `your-instance`)
- Customize the `comment` value for your use case
- To unarchive, change `"ARCHIVED"` to `"ACTIVE"`

**Common triggers for archiving:**
- Tag Added (e.g., "Sunset" or "Archive" tag)
- Lifecycle state reached (End of Life)
- Field value changed (e.g., status = "deprecated")

---

### Choosing Between Script and Action-Only

| Scenario | Use Action-Only | Use Script |
|----------|-----------------|------------|
| Add/remove static tag | ✅ | ❌ |
| Set field to static value | ✅ | ❌ |
| Add creator as subscriber | ✅ | ❌ |
| Send email to creator/subscribers | ✅ | ❌ |
| Create approval workflow | ✅ | ❌ |
| Set quality state | ✅ | ❌ |
| Archive a fact sheet | ❌ | ✅ Template 19 |
| Tag based on related FS data | ❌ | ✅ |
| Set field from related FS data | ❌ | ✅ |
| Sync subscriptions to related FS | ❌ | ✅ |
| Update relation attributes | ❌ | ✅ |
| Complex conditional logic | ❌ | ✅ |

**Rule of thumb:** If you don't need to read or write to other fact sheets, use action-only.

---

### See Also

For complete API documentation including conditions, actions, and error handling:
- `API-REFERENCE.md` - Full API documentation
