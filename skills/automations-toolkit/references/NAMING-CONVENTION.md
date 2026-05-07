# Automation Naming Convention

Standard naming convention for LeanIX automation templates.

## Table of Contents

- [Format](#format)
- [Categories](#categories)
- [Numbering for Multi-Automation Sets](#numbering-for-multi-automation-sets)
- [Description Format](#description-format)
- [Examples](#examples)
- [Trigger Context Shortcuts](#trigger-context-shortcuts)
- [Renaming Workflow](#renaming-workflow)

---

## Format

```
[Category] Use Case - Trigger Context (n/N)
```

**Components:**
- `[Category]` - Bracket-enclosed category prefix
- `Use Case` - Brief description of what the automation does
- `Trigger Context` - What event triggers this automation
- `(n/N)` - Position in multi-automation set (optional)

---

## Categories

| Category | Description | Example Use Cases |
|----------|-------------|-------------------|
| `[Sub-Sync]` | Subscription inheritance/synchronization | App Owner to ITC, BC Owner to App |
| `[Rel-Inherit]` | Relation-based inheritance | BC to Parent App, Provider to ITC |
| `[QS-Mgmt]` | Quality seal management | Break QS on EOL, Auto-approve on complete |
| `[Tagging]` | Tag-based automations | ITC Type to App Tag, Lifecycle tags |
| `[Lifecycle]` | Lifecycle phase management | Phase to Tag, EOL notifications |
| `[Auto-Link]` | Automatic relation creation | Link Microsoft ITCs, Auto-parent |
| `[Field-Sync]` | Field value synchronization | Initiative Status to Permission |
| `[Risk]` | Risk and obsolescence management | Obsolescence Calculator |
| `[Init]` | Initialization on creation | Default tags, Initial subscriptions |
| `[Notify]` | Notifications and emails | Owner notification, Webhook triggers |
| `[Template]` | Inactive/reference templates | ServiceNow Lifecycle Sync |

---

## Numbering for Multi-Automation Sets

When automations work together (e.g., add/remove trigger pairs):

| Pattern | Format |
|---------|--------|
| First of four | `(1/4)` |
| Second of four | `(2/4)` |
| Third of four | `(3/4)` |
| Fourth of four | `(4/4)` |

**Common multi-automation patterns:**

| Use Case | # Automations | Triggers |
|----------|---------------|----------|
| Subscription sync | 4 | Sub added, Sub removed, Rel added, Rel removed |
| Tag based on relations | 2 | Relation added, Relation removed |
| Field sync from relations | 2-3 | Rel added, Rel removed, Field changed |

---

## Description Format

Use a standardized description format:

```
Scenario: {Brief explanation of business use case - 1-2 sentences max}

Automation Toolkit Tip: {Guidance on issues, workarounds, or best practices}
```

**Example:**
```
Scenario: Propagates Application Owner subscriptions to linked IT Components, ensuring ITC visibility for app owners.

Automation Toolkit Tip: Part of a 4-automation set. All four are needed for complete sync: (1) sub added, (2) sub removed, (3) rel added, (4) rel removed on ITC.
```

---

## Examples

### Good Names

| Name | Why It Works |
|------|--------------|
| `[Sub-Sync] App Owner to ITC - On Sub Added (1/4)` | Clear category, use case, trigger, position |
| `[Rel-Inherit] BC to Parent App - On BC Added (1/4)` | Specific about direction and trigger |
| `[QS-Mgmt] Break App QS on Initiative EOL (1/4)` | Business outcome clear |
| `[Template] ServiceNow Lifecycle Sync` | Clearly marked as inactive template |
| `[Tagging] ITC Type Tag to App - On Rel Added (1/2)` | Shows relation-based tagging |
| `[Init] Set Default Tags on App Creation` | Single-automation, no numbering needed |

### Bad Names (Avoid)

| Bad Name | Problem | Better Name |
|----------|---------|-------------|
| `[Endpoint] [Subscription Inheritance - 1] Subscription Added to Application` | Too long, redundant prefix, unclear category | `[Sub-Sync] App Owner to ITC - On Sub Added (1/4)` |
| `[Script] Check Applications >120 days` | Category meaningless, unclear purpose | `[Lifecycle] Flag Stale Apps - On Completion Change` |
| `Transient Relations - 1` | No category, unclear purpose | `[Auto-Link] Link Transient ITCs - On Rel Added (1/2)` |
| `BC Owner Sync` | Missing category, trigger, position | `[Sub-Sync] BC Owner to Apps - On Sub Added (1/4)` |
| `Tag automation` | Too vague | `[Tagging] Add Review Tag - On Field Change` |

---

## Trigger Context Shortcuts

Standard abbreviations for trigger context:

| Trigger | Short Form |
|---------|------------|
| Subscription is added | `On Sub Added` |
| Subscription is removed | `On Sub Removed` |
| Relation is added | `On Rel Added` |
| Relation is removed | `On Rel Removed` |
| Field value is changed | `On Field Change` |
| Fact sheet is created | `On Creation` |
| Quality state is changed | `On QS Change` |
| Lifecycle state is reached | `On Lifecycle` |
| Completion score is changed | `On Completion Change` |
| Tag is added | `On Tag Added` |
| Tag is removed | `On Tag Removed` |

---

## Renaming Workflow

When standardizing existing automation names:

1. **Analyze current names** - Identify patterns and groupings
2. **Determine category** - Based on automation purpose
3. **Identify related automations** - Group by use case
4. **Apply numbering** - If part of multi-automation set
5. **Update via MCP** - `mcp__leanix__update_automation(template_id=ID, name="[Category] New Name (n/N)")`

**MCP call:**
```
mcp__leanix__update_automation(template_id=ID, name="[Category] New Name (n/N)")
```

The MCP tool handles GET-modify-PUT internally.
