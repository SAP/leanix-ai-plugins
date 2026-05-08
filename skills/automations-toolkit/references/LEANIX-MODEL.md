# LeanIX EAM Meta-Model Reference

Comprehensive reference for LeanIX Enterprise Architecture Management data model.

## Table of Contents

- [Live Workspace Discovery](#live-workspace-discovery)
- [Standard Fact Sheet Types](#standard-fact-sheet-types)
- [Standard Relations](#standard-relations)
- [Relation Attributes](#relation-attributes)
- [Subscription Types & Roles](#subscription-types--roles)
- [Lifecycle Phases](#lifecycle-phases)
- [Common Field Types](#common-field-types)
- [Trigger Selection Guide](#trigger-selection-guide)
- [Trigger Limitations & Gotchas](#trigger-limitations--gotchas)
- [Common Automation Scenarios](#common-automation-scenarios)
- [Automation Owner Role](#automation-owner-role)
- [Statistics & Quotas](#statistics--quotas)
- [Extensibility](#extensibility)
- [GraphQL Query Patterns by Type](#graphql-query-patterns-by-type)

---

## Live Workspace Discovery

This document provides a **static reference** for the standard LeanIX data model. For accurate, workspace-specific information:

| Method | How | Benefits |
|--------|-----|----------|
| **MCP Server** | Configure LeanIX MCP Server (see `../assets/MCP-SETUP.md`) | Real-time queries, interactive |
| **MCP Tools** | `mcp__leanix__get_fact_sheet_types()`, `mcp__leanix__get_overview()` | Live workspace data |

**Live discovery provides:**
- Actual tag IDs (UUIDs) for your workspace
- Custom fact sheet types and fields
- Subscription role IDs
- Workspace-specific relations
- User IDs for subscription scripts

> **Note:** When live workspace data is available, it supersedes this static reference.

---

## Standard Fact Sheet Types

LeanIX provides 12 standard fact sheet types out of the box. Workspaces can also define custom types.

| Type | Purpose | Key Fields | Common Use Cases |
|------|---------|------------|------------------|
| **Application** | Software applications used by the organization | lifecycle, functionalFit, technicalFit, businessCriticality, alias | Application portfolio management, rationalization |
| **ITComponent** | Infrastructure, platforms, services, tools | category (software/hardware/service), lifecycle, version | Technology portfolio, licensing, tech debt |
| **Provider** | External vendors and suppliers | quality, costPerYear, contractExpiry | Vendor management, contract tracking |
| **BusinessCapability** | What the business does (capability model) | lifecycle, level | Capability mapping, strategic alignment |
| **BusinessContext** | Organizational units, cost centers, locations | type (department/costCenter/location) | Org structure, cost allocation |
| **Initiative** | Transformation projects, programs | initiativeStatus, budget, startDate, endDate | Portfolio planning, project tracking |
| **Product** | Customer-facing products | lifecycle, revenue | Product portfolio, revenue attribution |
| **Project** | Internal projects | status, budget, startDate, endDate | Project management integration |
| **UserGroup** | User segments, personas | userCount | User impact analysis |
| **Interface** | Integration points, APIs | type, protocol, frequency | Integration mapping, API management |
| **DataObject** | Data entities, master data | type, classification, sensitivity | Data governance, privacy compliance |
| **TechnicalStack** | Technology standards, reference architectures | category, status (standard/phaseOut/restricted) | Standards management, technology radar |

---

## Standard Relations

Relations connect fact sheets to model dependencies, ownership, and impact.

### From Application

| Relation Name | Target Type | Purpose | Has Attributes? |
|---------------|-------------|---------|-----------------|
| `relApplicationToITComponent` | ITComponent | Technology stack, dependencies | Yes: obsolescenceRiskStatus, riskTargetDate, usageType |
| `relApplicationToBusinessCapability` | BusinessCapability | Business function support | No |
| `relApplicationToBusinessContext` | BusinessContext | Organizational ownership | No |
| `relApplicationToInitiative` | Initiative | Project involvement | No |
| `relApplicationToUserGroup` | UserGroup | User base, personas | No |
| `relApplicationToDataObject` | DataObject | Data ownership/usage | No |
| `relApplicationToInterface` | Interface | Integration points | Yes: dataFlowDirection |
| `relToParent` | Application | Parent application (hierarchy) | No |
| `relToChild` | Application | Child applications (hierarchy) | No |
| `relApplicationToProduct` | Product | Product implementation | No |
| `relApplicationToProject` | Project | Project association | No |

### From ITComponent

| Relation Name | Target Type | Purpose |
|---------------|-------------|---------|
| `relITComponentToProvider` | Provider | Vendor/supplier |
| `relITComponentToTechnicalStack` | TechnicalStack | Technology standards |
| `relToParent` | ITComponent | Parent component (hierarchy) |

### From BusinessCapability

| Relation Name | Target Type | Purpose |
|---------------|-------------|---------|
| `relBusinessCapabilityToBusinessContext` | BusinessContext | Organizational mapping |
| `relToParent` | BusinessCapability | Parent capability (hierarchy) |

### From Initiative

| Relation Name | Target Type | Purpose |
|---------------|-------------|---------|
| `relInitiativeToApplication` | Application | Applications in scope |

### From Interface

| Relation Name | Target Type | Purpose | Has Attributes? |
|---------------|-------------|---------|-----------------|
| `relInterfaceToProviderApplication` | Application | Source application | Yes: dataFlowDirection |
| `relInterfaceToConsumerApplication` | Application | Target application | Yes: dataFlowDirection |

### From DataObject

| Relation Name | Target Type | Purpose |
|---------------|-------------|---------|
| `relDataObjectToApplication` | Application | Applications using this data |

---

## Relation Attributes

Some relations have attributes that can be updated via scripts.

| Relation | Attribute | Type | Values |
|----------|-----------|------|--------|
| Application → ITComponent | `obsolescenceRiskStatus` | enum | notSet, noRisk, riskAccepted, riskReduction, riskIdentified |
| Application → ITComponent | `riskTargetDate` | date | YYYY-MM-DD |
| Application → ITComponent | `usageType` | enum | used, evaluated, rejected |
| Application/Interface → Application | `dataFlowDirection` | enum | inbound, outbound, bidirectional |

---

## Subscription Types & Roles

Subscriptions assign people to fact sheets with specific responsibilities.

### Subscription Types

| Type | Purpose | Use Case |
|------|---------|----------|
| `RESPONSIBLE` | Accountable owners who maintain the data | Application owners, IT owners |
| `ACCOUNTABLE` | Executive oversight, approval authority | Sponsors, budget holders |
| `OBSERVER` | Interested stakeholders, no edit rights | Architects, analysts |

### Common Roles (vary by workspace)

| Role Name | Typical Subscription Type | Purpose |
|-----------|--------------------------|---------|
| Application Owner | RESPONSIBLE | Business accountability |
| IT Owner | RESPONSIBLE | Technical accountability |
| Business Owner | RESPONSIBLE | Business unit ownership |
| Architect | OBSERVER | Architecture oversight |
| Data Steward | RESPONSIBLE | Data governance |
| Sponsor | ACCOUNTABLE | Executive sponsorship |

---

## Lifecycle Phases

Standard lifecycle phases for fact sheets (in order):

| # | Phase | API Value | Description |
|---|-------|-----------|-------------|
| 1 | Plan | `plan` | Planned, not yet started |
| 2 | Phase In | `phaseIn` | Being introduced |
| 3 | Active | `active` | In production use |
| 4 | Phase Out | `phaseOut` | Being retired |
| 5 | End of Life | `endOfLife` | Decommissioned |

### Lifecycle Structure in GraphQL

```javascript
// Query lifecycle phases
lifecycle {
  phases {
    phase        // "plan", "phaseIn", "active", "phaseOut", "endOfLife"
    startDate    // "YYYY-MM-DD" or null
  }
}

// Get current phase
const currentPhase = fs.lifecycle?.phases?.find(p => p.startDate && new Date(p.startDate) <= new Date());
```

---

## Common Field Types

### Built-in Fields (all fact sheet types)

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | UUID, immutable, read-only |
| `name` | String | Display name (cannot be deleted) |
| `displayName` | String | For ITComponents: includes Provider prefix |
| `description` | String | Rich text (HTML) |
| `type` | String | Fact sheet type, read-only |
| `rev` | Long | Revision number (for optimistic locking), read-only |
| `tags` | [String] | Array of tag IDs |
| `lifecycle` | Object | Lifecycle phases |
| `subscriptions` | Connection | People assigned |
| `lxState` | String | Quality seal state |
| `level` | Integer | Hierarchy level, read-only |
| `completion` | Object | Completion score, read-only |
| `updatedAt` | DateTime | Last update timestamp, read-only |
| `createdAt` | DateTime | Creation timestamp, read-only |

### Quality Seal Field (`lxState`)

The quality seal can be updated via GraphQL patches:

| Value | Description |
|-------|-------------|
| `APPROVED` | Quality seal approved |
| `BROKEN_QUALITY_SEAL` | Quality seal broken |
| `DRAFT` | Draft state |
| `REJECTED` | Quality seal rejected |

```javascript
// Break quality seal via GraphQL
patches: [{
  op: "replace",
  path: "/lxState",
  value: "BROKEN_QUALITY_SEAL",
}]
```

### Custom Fields

Custom fields are workspace-specific. Common patterns:

| Pattern | Field Type | Example |
|---------|-----------|---------|
| Single select | enum | `businessCriticality: "high"` |
| Multi select | [enum] | `riskCategories: ["security", "compliance"]` |
| Number | integer/double | `annualCost: 50000` |
| Date | string | `reviewDate: "2025-03-15"` |
| Text | string | `notes: "..."` |
| Checkbox | boolean | `isApproved: true` |

---

## Trigger Selection Guide

### All 12 Triggers

| # | Trigger | Configuration | Key Notes |
|---|---------|---------------|-----------|
| 1 | Fact sheet is created | None | Fires once per FS |
| 2 | Field value is changed | Select field | One field per automation |
| 3 | Lifecycle state is reached | Select phase | ⚠️ Nightly check only |
| 4 | Quality state is changed to | Select state | Approved/Broken/Draft/Rejected |
| 5 | Subscription is added | Select type + role | |
| 6 | Subscription is removed | Select type + role | |
| 7 | Relation is added | Select relation | Fires on source FS |
| 8 | Relation is changed | Select relation | For attribute updates |
| 9 | Relation is removed | Select relation | ⚠️ Cannot see removed relation |
| 10 | Tag is added | Select tag | |
| 11 | Tag is removed | Select tag | |
| 12 | Completion score is changed | None | ⚠️ Fires very frequently |

### Goal-Based Trigger Selection

Choose triggers based on your automation goal:

| Goal | # Automations | Triggers Needed | Notes |
|------|---------------|-----------------|-------|
| Initialize new fact sheets | 1 | Fact sheet is created | Simple, no config |
| React to specific field | 1 | Field value is changed | Must select field |
| React to any edit | 1 | Completion score is changed | ⚠️ Fires very frequently! |
| Sync subscriptions | 4 | Sub added + Sub removed + Rel added [source] + Rel removed [target] | #4 on target for cleanup |
| Tag based on relations | 2 | Relation added + Relation removed | Same reconciliation script |
| Update field from relations | 2-3 | Rel added + Rel removed + Field changed [optional] | Tie-breaker logic |
| Propagate to parent/child | 3 | Rel added [child] + Rel removed [child] + Rel removed [parent] | Parent needs own trigger |
| Calculate/aggregate values | 2-3 | Rel added + Rel removed + Field changed [optional] | Reconciliation pattern |
| Lifecycle-triggered actions | 1 | Lifecycle state is reached | ⚠️ Nightly only |
| Quality seal workflows | 1 | Quality state is changed to | Select target state |
| Validate and block | 1-2 | Field changed OR Completion score | Use `throw new Error("cancel automation flow")` |

---

## Trigger Limitations & Gotchas

| Trigger | Limitation | Workaround |
|---------|-----------|------------|
| **Relation is removed** | Cannot see the removed relation | Trigger on target FS, or use reconciliation pattern |
| **Completion score changed** | Fires on almost any change | Add strict idempotency checks |
| **Lifecycle state reached** | Checked nightly, not real-time | Use for non-urgent tasks |
| **Field value is changed** | Only one field per trigger | Create multiple automations for multiple fields |
| **All triggers** | No "before" state available | Query current state and reconcile |
| **Obsolescence risk fields** | Cannot trigger - calculated at runtime only | Use lifecycle triggers or manual field updates |

---

## Common Automation Scenarios

### By Business Goal

| Business Goal | Approach | Example Scripts |
|---------------|----------|-----------------|
| **Data quality** | Validation + abort | `data-validator.js` |
| **Subscription inheritance** | Reconciliation pattern | `app-owner-to-itc.js` |
| **Risk management** | Relation attribute calculation | `obsolescence-risk-calculator.js` |
| **Tag categorization** | Field-to-tag mapping | `energy-consumption-tagging.js` |
| **Tag from relations** | Reconciliation + relation query | `relation-based-tagging.js` |
| **Cross-FS field sync** | Tie-breaker logic | `initiative-status-permission-sync.js` |
| **Lifecycle governance** | Quality seal changes | `bc-eol-break-app-seal.js` |
| **Transitive relations** | Auto-create through intermediary | `app-bc-context-sync.js` |
| **Relation propagation** | Copy to parent | `bc-propagate-to-parent.js` |
| **Initialize defaults** | Set fields on creation | `hello-world.js` |

### Multi-Trigger Scenarios (Detailed)

Some use cases require multiple automations working together:

| Use Case | # | Trigger | Fact Sheet Type | Purpose |
|----------|---|---------|-----------------|---------|
| **Subscription sync** | 1 | Subscription is added | Source (e.g., App) | Push new owner to targets |
| | 2 | Subscription is removed | Source (e.g., App) | Remove owner from targets |
| | 3 | Relation is added | Source (e.g., App) | Add owners to newly linked target |
| | 4 | Relation is removed | Target (e.g., ITC) | Cleanup when source unlinked |
| **Tag propagation** | 1 | Relation is added | Source | Recalculate tags from relations |
| | 2 | Relation is removed | Source | Recalculate tags from relations |
| **Parent propagation** | 1 | Relation is added | Child | Copy data to parent |
| | 2 | Relation is removed | Child | Update parent on unlink |
| | 3 | Relation is removed | Parent | Cleanup when child unlinked |
| **Quality seal on EOL** | 1 | Lifecycle state reached | Initiative | Break seals on linked Apps |
| | 2 | Relation is added | Application | Check Initiative lifecycle |

**Key insight for subscription sync #4**: When "Relation is removed" fires on Application, the Application can no longer see the unlinked ITComponent. So the cleanup automation must be on ITComponent to detect it's been orphaned.

### Official SAP Example Patterns

These patterns are documented in official SAP documentation:

1. **Subscription Inheritance** (4 automations)
   - Syncs subscriptions from Application to related ITComponents
   - Uses reconciliation pattern for idempotency

2. **Relation Inheritance - Business Context to Parent** (4 automations)
   - Propagates BC relations from child to parent Applications
   - Marks inherited relations with `[Auto-inherited from: ...]` description

3. **Breaking Quality Seals on Initiative EOL** (2 automations)
   - Breaks Application quality seals when linked Initiative reaches End of Life
   - Uses `lxState` field with `BROKEN_QUALITY_SEAL` value

---

## Automation Owner Role

Every automation must have an owner who serves as:
- **Fallback assignee** for "orphaned" to-dos when the intended user is unavailable
- **Default subscriber** to a fact sheet when the intended user no longer exists

---

## Statistics & Quotas

| Metric | Value |
|--------|-------|
| **Monthly limit (demo/sandbox)** | 10,000 automations |
| **Monthly limit (production)** | Correlates with application limit |
| **Processing time (normal)** | 95% complete within 5 minutes |
| **Processing time (bulk/integrations)** | Up to 30 minutes |
| **Escalation threshold** | Delays exceeding 1 hour |
| **Admin notifications** | At 80% usage and when limit reached |

---

## Extensibility

### Custom Fact Sheet Types

Workspaces can define additional fact sheet types. When working with custom types:
- Ask user for the type name
- Relations will be named `rel{CustomType}To{TargetType}`
- Fields follow same patterns as standard types

### Custom Relations

Workspaces can add relations between types. When working with custom relations:
- Ask user for the relation name
- Check if relation has custom attributes
- Direction matters for query structure

### Custom Fields

Workspace admins can add fields to any fact sheet type:
- Single/multi-select fields have predefined values
- Custom fields appear in GraphQL schema
- Field names are case-sensitive

---

## GraphQL Query Patterns by Type

### Application with Full Relations

```graphql
query ($id: ID!) {
  factSheet(id: $id) {
    id name rev type
    ... on Application {
      lifecycle { phases { phase startDate } }
      functionalFit technicalFit businessCriticality
      relApplicationToITComponent {
        edges { node { id obsolescenceRiskStatus factSheet { id name } } }
      }
      relApplicationToBusinessCapability {
        edges { node { factSheet { id name } } }
      }
      relToParent { edges { node { factSheet { id name } } } }
      subscriptions {
        edges { node { id type user { id } roles { id name } } }
      }
    }
  }
}
```

### ITComponent with Provider

```graphql
query ($id: ID!) {
  factSheet(id: $id) {
    id name displayName rev
    ... on ITComponent {
      category lifecycle { phases { phase startDate } }
      relITComponentToProvider {
        edges { node { factSheet { id name } } }
      }
    }
  }
}
```

### BusinessCapability Hierarchy

```graphql
query ($id: ID!) {
  factSheet(id: $id) {
    id name
    ... on BusinessCapability {
      level
      relToParent { edges { node { factSheet { id name } } } }
      relToChild { edges { node { factSheet { id name } } } }
      relBusinessCapabilityToBusinessContext {
        edges { node { factSheet { id name } } }
      }
    }
  }
}
```
