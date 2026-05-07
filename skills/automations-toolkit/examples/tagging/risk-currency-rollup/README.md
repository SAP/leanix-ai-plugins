# Risk Currency Tag Rollup

Rolls up the **worst** Risk Currency tag from linked IT Components to Applications, ensuring each Application always reflects the worst risk posture in its technology stack.

## Use Case

Applications in LeanIX are linked to IT Components, each of which may carry a "Risk Currency" tag indicating its technology lifecycle status. Today, there is no way to see at-a-glance whether an Application has risky technology in its stack.

This automation suite solves that by:
- Automatically tagging each Application with the worst Risk Currency from its linked ITCs
- Updating when ITC tags change or when ITC relations are added/removed
- Clearing the tag when no ITCs have Risk Currency tags

## How It Works

### Priority Ranking (worst wins)

| Rank | Tag | Meaning |
|------|-----|---------|
| 0 (worst) | Retired/Not Allowed | Must not be used |
| 1 | Sunset | Being phased out |
| 2 | Limited Use | Restricted usage |
| 3 (best) | Preferred | Recommended |

### Logic

- If **any** linked ITC has "Retired/Not Allowed", the Application gets "Retired/Not Allowed"
- If none are Retired but **any** has "Sunset", the Application gets "Sunset"
- If none are Retired/Sunset but **any** has "Limited Use", the Application gets "Limited Use"
- Only if **all** ITCs with Risk Currency tags are "Preferred" does the Application get "Preferred"
- If **no** ITCs have Risk Currency tags, all Risk Currency tags are cleared from the Application

### Two Scripts, Two Directions

| Script | Triggers on | Updates via | When |
|--------|-------------|-------------|------|
| `risk-currency-app-trigger.js` | Application | Return object | ITC relation added/removed from App |
| `risk-currency-itc-trigger.js` | ITComponent | GraphQL mutation | Risk Currency tag added/removed on ITC |

## Why 10 Automations?

LeanIX automation triggers have two limitations that require multiple automations:

1. **Separate add/remove triggers**: "Relation is added" and "Relation is removed" are separate trigger types, so Script A needs 2 automations.

2. **One tag per trigger**: "Tag is added" and "Tag is removed" triggers require selecting a specific tag. With 4 Risk Currency tags and 2 trigger types (add/remove), Script B needs 8 automations.

**Total: 2 + 8 = 10 automations.**

### Trigger Wish-List

Features that would reduce the automation count:

| Feature | Reduction | Description |
|---------|-----------|-------------|
| Tag group trigger | 10 → 4 | "Any tag in group X added/removed" |
| Combined add/remove trigger | 10 → 5 | "Relation is added OR removed" |
| Both combined | 10 → 2 | Tag group trigger + combined add/remove |
| Wildcard tag trigger | 10 → 2 | "Any tag matching pattern added/removed" |

## Required Automations

### On Application (Script A)

#### Automation 1: Risk Currency Rollup - On Rel Added (1/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Relation is added |
| **Action** | Run Script |
| **Script** | `risk-currency-app-trigger.js` |
| **Description** | Rolls up the "worst" Risk Currency tag from linked IT Components to Applications. Retired > Sunset > Limited Use > Preferred. Part of a 10-automation set (2 scripts). Automations 1-2 trigger on App relation changes. Automations 3-10 trigger on ITC tag changes. |

#### Automation 2: Risk Currency Rollup - On Rel Removed (2/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Relation is removed |
| **Action** | Run Script |
| **Script** | `risk-currency-app-trigger.js` |
| **Description** | *(same as Automation 1)* |

### On ITComponent (Script B)

#### Automation 3: Risk Currency Rollup - On Tag Added Preferred (3/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is added |
| **Tag** | Preferred |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

#### Automation 4: Risk Currency Rollup - On Tag Added Limited Use (4/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is added |
| **Tag** | Limited Use |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

#### Automation 5: Risk Currency Rollup - On Tag Added Sunset (5/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is added |
| **Tag** | Sunset |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

#### Automation 6: Risk Currency Rollup - On Tag Added Retired (6/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is added |
| **Tag** | Retired/Not Allowed |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

#### Automation 7: Risk Currency Rollup - On Tag Removed Preferred (7/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is removed |
| **Tag** | Preferred |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

#### Automation 8: Risk Currency Rollup - On Tag Removed Limited Use (8/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is removed |
| **Tag** | Limited Use |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

#### Automation 9: Risk Currency Rollup - On Tag Removed Sunset (9/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is removed |
| **Tag** | Sunset |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

#### Automation 10: Risk Currency Rollup - On Tag Removed Retired (10/10)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Tag is removed |
| **Tag** | Retired/Not Allowed |
| **Action** | Run Script |
| **Script** | `risk-currency-itc-trigger.js` |
| **Description** | *(same as Automation 1)* |

## Configuration

Before deploying, update both scripts:

1. Replace `INSTANCE` with your LeanIX instance name:
   ```javascript
   var GRAPHQL_URL = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
   ```

2. Verify tag IDs match your workspace:
   ```javascript
   // Replace with your workspace IDs
   var RISK_CURRENCY_TAGS = [
     { id: "00000000-0000-0000-0000-000000000001", name: "Retired/Not Allowed" },
     { id: "00000000-0000-0000-0000-000000000002", name: "Sunset" },
     { id: "00000000-0000-0000-0000-000000000003", name: "Limited Use" },
     { id: "00000000-0000-0000-0000-000000000004", name: "Preferred" }
   ];
   ```

   Find your tag IDs using GraphQL Explorer:
   ```graphql
   {
     allTags {
       edges {
         node {
           id
           name
           tagGroup { name }
         }
       }
     }
   }
   ```

### Upstream Data Source

The Risk Currency tags on IT Components are populated by an upstream process (e.g., a SQL stored procedure `[snow].[CalculateRiskScores]`) that maps lifecycle risk scores to the 4 tags. This automation does not create the ITC tags — it only rolls them up to Applications.

## Behavior Matrix

| Event | Result |
|-------|--------|
| Link ITC with no Risk Currency tag to App | App unchanged |
| Link ITC with "Preferred" to App (no existing risk tags) | App gets "Preferred" |
| Link second ITC with "Sunset" to App with "Preferred" | App changes to "Sunset" (worst wins) |
| Remove "Sunset" ITC from App (other ITC has "Preferred") | App reverts to "Preferred" |
| Remove all ITCs from App | Risk Currency tag cleared from App |
| Add "Preferred" tag to ITC | All linked Apps recalculate |
| Change ITC from "Preferred" to "Retired" | All linked Apps change to "Retired" (or worse if other ITCs) |
| Remove Risk Currency tag from ITC entirely | All linked Apps recalculate from remaining ITCs |
| App already has correct worst tag | No update (idempotent) |
| Multiple ITCs with same Risk Currency tag | Only one tag applied to App (deduplicated) |

### No Infinite Loops

Script A triggers on **relation** changes, Script B triggers on **tag** changes. Neither creates the other's trigger event, so there is no risk of infinite loops.

## Limitations

1. **Relation triggers fire on ANY relation**: LeanIX does not allow filtering relation triggers by relation type. Script A fires on any relation add/remove (not just ITC relations), but safely queries only `relApplicationToITComponent`. This means unnecessary script executions on non-ITC relation changes, with no harmful side effects.

2. **Race conditions on bulk operations**: If many ITC tags change simultaneously, multiple instances of Script B may try to update the same Application. The retry-on-REVISION_CLASH pattern (3 attempts with re-query) handles this, but extreme bulk changes may still fail. Re-triggering reconciles.

3. **Tag patch format (Script B)**: The mutation uses `{ op: "replace", path: "/tags", value: "<JSON string>" }` format. Verify this works in your workspace before deploying high-impact automations.

4. **One Risk Currency tag per Application**: The rollup always applies exactly one tag (the worst) or none. If your business logic requires showing multiple risk levels, this script would need modification.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Script fails silently | Remove any `console.log()` statements; check bearer token |
| App tag not updating (Script A) | Verify `relApplicationToITComponent` relation exists; check tag IDs |
| App tag not updating (Script B) | Check `relITComponentToApplication` reverse relation; verify mutation format |
| REVISION_CLASH errors | Normal under concurrent updates; script retries 3 times automatically |
| Wrong tag applied | Verify RISK_CURRENCY_TAGS order matches priority (index 0 = worst) |
| Tags cleared unexpectedly | Check that ITC tags use the exact tag IDs in the configuration |
| Tag not cleared when ITC removed | Ensure Automation 2 (relation removed) is active |
| Extra script executions | Expected — relation triggers fire on ALL relation types, not just ITC |

## Deployment Order

1. **Phase 1 (lower risk):** Deploy Script A + Automations 1-2 (relation triggers use return object)
2. **Phase 2 (test):** Deploy Script B + Automations 3-4 (Preferred tag add/remove — lowest impact)
3. **Phase 3 (full):** Deploy remaining Automations 5-10 after validating Phase 2
