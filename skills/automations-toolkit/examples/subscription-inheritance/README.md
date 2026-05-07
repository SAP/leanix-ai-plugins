# Subscription Inheritance Examples

Scripts that propagate subscriptions from one fact sheet to related fact sheets.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [app-owner-to-itc.js](app-owner-to-itc.js) | Subscription added/removed, Relation added (Application) | Syncs Application Owner subscriptions to ITComponents |
| [itc-owner-cleanup.js](itc-owner-cleanup.js) | Relation removed (ITComponent) | Cleans up inherited subscriptions when Application unlinked |
| [app-owner-to-interface.js](app-owner-to-interface.js) | Subscription added, Relation added (Application) | Propagates Application Owner subscriptions to Interfaces (add-only) |

---

## Use Case

When a user is assigned as "Application Owner" on an Application, they should automatically become "Application Owner" on all related ITComponents. When they're removed, or when the relation is removed, the inherited subscription should be cleaned up.

---

## Required Automations (4 total)

These scripts work together. Create all 4 automations:

### Automation 1: Add Owner on Subscription Add

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Subscription is added |
| **Subscription Type** | RESPONSIBLE |
| **Role** | Application Owner |
| **Action** | Run Script |
| **Script** | `app-owner-to-itc.js` |

### Automation 2: Remove Owner on Subscription Remove

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Subscription is removed |
| **Subscription Type** | RESPONSIBLE |
| **Role** | Application Owner |
| **Action** | Run Script |
| **Script** | `app-owner-to-itc.js` |

### Automation 3: Add Owner on Relation Add

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Relation is added |
| **Action** | Run Script |
| **Script** | `app-owner-to-itc.js` |

### Automation 4: Cleanup on Relation Remove (ITComponent side)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Relation is removed |
| **Action** | Run Script |
| **Script** | `itc-owner-cleanup.js` |

**Why Automation 4?** When a relation is removed from an Application, the Application can no longer see which ITComponent was unlinked. But the ITComponent can still see its remaining Application relations and reconcile.

---

## Configuration

Update the GraphQL URL in both scripts:

```javascript
const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
```

---

## How It Works

### app-owner-to-itc.js

1. Queries the Application with all subscriptions and related ITComponents
2. Extracts all "Application Owner" role assignments from the Application
3. For each ITComponent:
   - Checks existing subscriptions
   - Creates missing subscriptions (with comment noting inheritance)
   - Removes subscriptions that are no longer on the Application

### itc-owner-cleanup.js

1. Queries the ITComponent with all subscriptions and remaining Applications
2. Calculates desired owners from ALL remaining Applications
3. Reconciles: adds missing, removes orphaned

---

## Key Patterns

### Idempotency

```javascript
const existingKeys = new Set(existing.map(e => `${e.roleId}|${e.userId}`));
if (existingKeys.has(key)) continue;  // Skip if exists
```

### Multi-role Subscriptions

The scripts handle users who have multiple roles:
- If removing "Application Owner" role but user has other roles → update subscription
- If removing only role → delete subscription

### Revision Tracking

```javascript
let currentRev = itc.rev;
// After each mutation:
currentRev = createJson?.data?.createSubscription?.factSheet?.rev ?? currentRev;
```

---

## Behavior Matrix

| Event | Result |
|-------|--------|
| Owner added to Application | Owner added to all linked ITComponents |
| Owner removed from Application | Owner removed from all linked ITComponents |
| New ITComponent linked to Application | Existing owners copied to new ITComponent |
| ITComponent unlinked from Application | Orphaned inherited owners removed |
| User has multiple roles on ITC | Only Application Owner role removed, other roles preserved |
