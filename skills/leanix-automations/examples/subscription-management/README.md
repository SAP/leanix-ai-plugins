# Subscription Management Examples

Scripts that modify subscriptions based on events (without propagating to other fact sheets).

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [eol-subscriber-downgrade.js](eol-subscriber-downgrade.js) | Lifecycle state reached (End of Life) | Downgrades RESPONSIBLE to OBSERVER |
| [subscription-role-counter.js](subscription-role-counter.js) | Subscription added/removed | Counts total subscriptions, updates field |

---

## eol-subscriber-downgrade.js

Automatically downgrades all RESPONSIBLE subscribers to OBSERVER when a fact sheet reaches End of Life.

### Use Case

When a fact sheet is deprecated (End of Life), responsible parties should no longer be accountable. Converting them to observers preserves their access for reference while removing ownership.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Any (or specific type) |
| **Trigger** | Lifecycle state is reached |
| **Lifecycle Phase** | End of Life |
| **Action** | Run Script |

**Note**: The "Lifecycle state is reached" trigger is checked **nightly**, not in real-time.

### Configuration

```javascript
const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
```

### Behavior

| Before | After |
|--------|-------|
| RESPONSIBLE with roles | OBSERVER (roles cleared) |
| OBSERVER | No change |
| ACCOUNTABLE | No change |

---

## subscription-role-counter.js

Counts total subscriptions on an Application and stores the count in a custom field.

### Use Case

Business rule enforcement: "Applications should have at least 5 subscriptions." This script maintains a counter that can be used in reports or conditions.

### Automation Setup (2 automations recommended)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger 1** | Subscription is added |
| **Trigger 2** | Subscription is removed |
| **Action** | Run Script |

Alternative: Use "Completion score is changed" as a single trigger (fires more frequently).

### Configuration

1. Update GraphQL URL:

```javascript
const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
```

2. Update the field name to match your custom field:

```javascript
// Change this to your custom field's API name
... on Application {
  serviceNow_Subscriptions  // Your field name here
  ...
}
```

### Key Patterns

**Idempotency check** (prevents infinite loops):

```javascript
if (currentValue === newValue) {
  return {};  // No update = no new trigger
}
```

---

## Finding Subscription Information

### Query Subscription Types

```graphql
{
  allSubscriptionRoles {
    edges {
      node {
        id
        name
        subscriptionType  # RESPONSIBLE, OBSERVER, ACCOUNTABLE
      }
    }
  }
}
```

### Query Fact Sheet Subscriptions

```graphql
{
  factSheet(id: "YOUR_FS_ID") {
    subscriptions {
      edges {
        node {
          id
          type
          user { id displayName email }
          roles { id name }
        }
      }
    }
  }
}
```
