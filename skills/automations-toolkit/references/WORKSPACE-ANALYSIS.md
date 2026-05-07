# Analyze Workspace Automations Workflow

Audit existing automations with a summary-first, drill-down-on-demand approach.

## Table of Contents

- [Step 1: Connect & Fetch All Data (Parallel)](#step-1-connect--fetch-all-data-parallel)
- [Step 2: Fetch Details (On Demand Only)](#step-2-fetch-details-on-demand-only)
- [Step 3: Analyze Automations (LLM-Driven)](#step-3-analyze-automations-llm-driven)
- [Step 4: Present Health Summary](#step-4-present-health-summary)
- [Step 5: Interactive Drill-Down Hub](#step-5-interactive-drill-down-hub)
- [Step 5a: Issues Drill-Down](#step-5a-issues-drill-down)
- [Step 5b: Inventory by Use Case](#step-5b-inventory-by-use-case)
- [Step 5c: Fact Sheet Coverage](#step-5c-fact-sheet-coverage)
- [Step 5d: Action Menu](#step-5d-action-menu)
- [Step 6: Update Descriptions](#step-6-update-descriptions)
- [Step 7: Standardize Names](#step-7-standardize-names)
- [Step 8: Verify Updates](#step-8-verify-updates)
- [Formatting Principles](#formatting-principles)

---

## Step 1: Connect & Fetch All Data (Parallel)

MCP handles authentication automatically. No credential extraction or token exchange needed.

**Call both in parallel (single message, two tool calls):**
1. `mcp__leanix__get_overview()` — workspace stats and fact sheet counts
2. `mcp__leanix__list_automations()` — all automation summaries

**Also load reference files in parallel** with the MCP calls:
- `references/WORKSPACE-ANALYSIS.md` (this file)
- `references/NAMING-CONVENTION.md`

This avoids sequential round-trips — one message fetches everything needed for analysis.

**Cache all results in context** — do not re-fetch unless explicitly needed.

## Step 2: Fetch Details (On Demand Only)

For specific automations requiring deeper inspection:
- `mcp__leanix__get_automation(template_id=ID)` — full configuration
- `mcp__leanix__get_automation_script(script_id=ID)` — JavaScript source code

**Do not fetch details for all automations upfront.** Only fetch when the user drills into a specific automation or group.

## Step 3: Analyze Automations (LLM-Driven)

Perform analysis **once** on the fetched JSON. Reuse results across all subsequent drill-downs without re-analyzing.

### Analysis Checklist

| Check | Severity | What to Look For |
|-------|----------|------------------|
| **Incomplete sets** | ■ Critical | `(n/N)` patterns where not all N are present or active states differ |
| **Description mismatch** | ■ Critical | Description says "added" but trigger is REMOVAL (or vice versa) |
| **Shared tag trigger** | ■ Critical | Multiple automations using the same `tagId` as trigger — likely unintended |
| **Active test/debug automations** | ■ Critical | Names containing `[Bug Test]`, `[Test]`, `[POC]` that are `active: true` |
| **Stale status reference** | ▲ Warning | Description says "INACTIVE" but `active: true` |
| **Workaround trigger** | ▲ Warning | TAG_ADDITION used where LIFECYCLE_PHASE_REACHED or RELATION would be better |
| **Never-executed automations** | ▲ Warning | `lastExecutionTime: null` on active automations (may indicate unused or newly deployed) |
| **Missing description** | ○ Info | Empty or `null` description field |
| **Non-standard naming** | ○ Info | Missing `[Category]` prefix per naming convention |

### Keyword Mappings for Description Mismatch Detection

| Trigger Type | Should Contain | Should NOT Contain |
|--------------|----------------|-------------------|
| `SUBSCRIPTION_REMOVAL` | removed, cleanup, unsubscribed | added, assigned, propagate |
| `SUBSCRIPTION_ADDITION` | added, assigned, propagate | removed, cleanup |
| `RELATION_REMOVAL` | removed, unlinked, cleanup | added, linked, propagate |
| `RELATION_ADDITION` | added, linked, propagate | removed, unlinked, cleanup |

### Redundancy Analysis

When multiple automations appear to serve the same purpose:

**Signs of potential redundancy:**
- Same target fact sheet type
- Same or similar trigger types
- Scripts that produce similar outcomes
- Different implementation methods for same goal

**Preferred approaches (when choosing which to keep):**
- **Provider relation** > **displayName matching** (more reliable, handles renames)
- **FACT_SHEET_CREATION** > **TAG_ADDITION** for auto-init (more automatic)
- **Single automation** > **Multiple automations** when possible
- **Built-in actions** > **Scripts** for simple operations

### Health Verdict

After completing all checks, classify the workspace:

| Verdict | Condition |
|---------|-----------|
| **Healthy** | 0 critical, 0 warnings |
| **Needs attention** | 0 critical, 1+ warnings |
| **Critical** | 1+ critical issues |

### Grouping

Group automations by use case for the inventory drill-down:
- Subscription inheritance / sync
- Relation inheritance
- Quality seal management
- Tagging
- Field sync
- Lifecycle management
- Risk / obsolescence
- Auto-link
- POC / Test / Debug
- Templates / inactive

---

## Step 4: Present Health Summary

Show a **compact summary** followed by any critical issues. Do NOT dump the full inventory or all issues at this stage.

### Formatting Guidelines

Use markdown headers, bold stat lines, and horizontal rules. **No ASCII box-drawing characters.**

**IMPORTANT: `AskUserQuestion` supports 2-4 options max.** Always respect this limit when presenting drill-down choices. Group related actions into single options when needed.

**Structure:**

1. `## Workspace Health: {instance}.leanix.net` header
2. Single bold stat line for key metrics
3. Health verdict line with severity counts
4. Horizontal rule (`---`)
5. If critical issues exist: expand each one inline
6. If no critical issues: skip straight to the drill-down hub

**Example:**

```markdown
## Workspace Health: demo-eu-8.leanix.net

**47** automations | **40** active (85%) | **7** inactive | **45** with scripts

**Health:** ■ 2 critical | ▲ 3 warnings | ○ 2 info

---

## ■ Critical Issues

### 1. Active Bug Test Automations
**Affected:** 3 test automations running diagnostic scripts in production
- [Bug Test] App Owner - Completion Changed (Workaround)
- [Bug Test] App Owner - Sub Added (SUBSCRIPTION_ADDITION)
- [Bug Test] App Owner - Sub Removed (SUBSCRIPTION_REMOVAL)

**Risk:** Completion Changed fires on nearly every edit, causing unnecessary script runs.
**Fix:** Deactivate all 3. The [Sub-Sync] App Owner to ITC (1-4/4) set covers this.

---

### 2. Shared Tag Trigger Conflict
**Affected:** 2 automations fire on the same tag
- [QS-Mgmt] Approve Quality Seal - On Tag Added
- [Tagging] Resource Sensitivity Tag Sync

**Risk:** Adding this tag simultaneously approves QS and runs sensitivity sync.
**Fix:** Assign a dedicated trigger tag to one of these.
```

**Zero-issue path:** If no issues found, say "No issues found" and proceed directly to the drill-down hub.

---

## Step 5: Interactive Drill-Down Hub

After the health summary, present an `AskUserQuestion` with options based on the analysis results. **Dynamically generate options** — only include options that are relevant.

### Standard Options

**IMPORTANT: Max 4 options per `AskUserQuestion`.** Select the most relevant 4 based on analysis results. Combine related options when needed.

| Option | Show When | Description |
|--------|-----------|-------------|
| **View warnings & info** | Warnings or info issues exist | Expand non-critical issues with details |
| **Inventory by use case** | Always | Browse automation groups with completeness checks |
| **Fix issues & standardize** | Critical/naming issues exist | Deactivate problematic automations, apply naming convention |
| **No more changes needed** | Always | Exit the analysis |

**If no issues exist**, replace "View warnings & info" and "Fix issues & standardize" with:
| **Fact sheet coverage** | Always | Which FS types are covered/uncovered |
| **Fetch script code** | Always | Inspect specific automation scripts |

### Hub Behavior

- After each drill-down, return to the hub with an updated `AskUserQuestion`
- Track what the user has already viewed and adjust options accordingly
- Always include an exit option ("No more changes needed")

---

## Step 5a: Issues Drill-Down

Show issues grouped by severity. Use `###` headers per issue with **Affected / Risk / Fix** structure.

**For 4+ issues at a severity level, use a table:**

```markdown
## ▲ Warnings

| # | Automation | Issue | Recommended Action |
|---|------------|-------|--------------------|
| 1 | [Risk] Obsolescence Calculator | Workaround trigger (TAG_ADDITION) | Convert to RELATION + FIELD triggers |
| 2 | Resource Sensitivity Tag Sync | Workaround trigger (TAG_ADDITION) | No native trigger — keep workaround |
| 3 | [POC] Dynamic To-Do | Active POC in production | Promote (rename) or deactivate |
```

**For 1-3 issues, use individual blocks (more readable at low counts):**

```markdown
## ▲ Warnings

### 1. Workaround Trigger
**Automation:** [Risk] Obsolescence Status Calculator
**Risk:** Uses TAG_ADDITION — only runs on manual tag, not on data change.
**Fix:** Create 3 automations with proper triggers (RELATION, FIELD, LIFECYCLE).
```

---

## Step 5b: Inventory by Use Case

Group automations by category. Each group gets a `###` header with completeness indicator.

**Formatting:**

```markdown
## Automation Inventory

### Subscription Sync — App Owner to ITC (4/4) ✓

| # | Name | Trigger | Status |
|---|------|---------|--------|
| 1/4 | On Sub Added | SUBSCRIPTION_ADDITION | ✓ Active |
| 2/4 | On Sub Removed | SUBSCRIPTION_REMOVAL | ✓ Active |
| 3/4 | On Rel Added | RELATION_ADDITION | ✓ Active |
| 4/4 | On Rel Removed | RELATION_REMOVAL | ✓ Active |

---

### Tagging — Risk Currency Rollup (10/10) ✓ ▲

| # | Trigger | Last Executed |
|---|---------|---------------|
| 1/10 | Rel Added (App) | never |
| 2/10 | Rel Removed (App) | never |
| 3/10 | Tag Added Preferred (ITC) | never |
| 4/10 | Tag Added Limited Use (ITC) | never |
| 5/10 | Tag Added Sunset (ITC) | 2026-03-06 |
| 6/10 | Tag Added Retired (ITC) | never |
| 7/10 | Tag Removed Preferred (ITC) | never |
| 8/10 | Tag Removed Limited Use (ITC) | never |
| 9/10 | Tag Removed Sunset (ITC) | never |
| 10/10 | Tag Removed Retired (ITC) | never |

**▲ Note:** 9 of 10 never executed. Verify Risk Currency tags exist on ITComponents.

---

### Templates / Inactive (7)

| Name | Trigger | Last Executed |
|------|---------|---------------|
| [Template] Demo - Append Description | FIELD_CHANGE | 2026-01-08 |
| [Template] Lifecycle Phase to Tag | FIELD_CHANGE | 2025-10-03 |
| ... | | |
```

**Completeness indicators:**
- `✓` — Complete set, all active
- `⚠` — Incomplete set (missing automations) or mixed active/inactive
- `▲` — Has associated warning

---

## Step 5c: Fact Sheet Coverage

Simple markdown table showing which fact sheet types have automations.

```markdown
## Fact Sheet Coverage

| Type | Count | % of Total |
|------|-------|------------|
| Application | 32 | 68% |
| ITComponent | 9 | 19% |
| Initiative | 3 | 6% |
| BusinessCapability | 2 | 4% |
| BusinessContext | 1 | 2% |

**No coverage:** Process, TechnicalStack, DataObject, Domain, Interface, UserGroup, Provider
```

---

## Step 5d: Action Menu

Present available actions via `AskUserQuestion` (max 4 options). Combine related actions.

| Option | Description |
|--------|-------------|
| **Fix critical issues** | Deactivate/update automations flagged as critical |
| **Standardize names & descriptions** | Apply naming convention, update descriptions |
| **Transfer ownership** | Change owner of specific automations |
| **No changes needed** | Exit the analysis |

---

## Step 6: Update Descriptions

Use standardized format:
```
Scenario: {Brief explanation of business use case - 1-2 sentences max}

Automation Toolkit Tip: {Guidance on issues, workarounds, or best practices}
```

**Using MCP (recommended):**
```
mcp__leanix__update_automation(template_id=ID, description="NEW_DESCRIPTION")
```

The MCP tool handles the GET-modify-PUT pattern internally. No need to fetch the template first.

**IMPORTANT:** PATCH not supported — the MCP tool uses PUT with full body internally.

## Step 7: Standardize Names

Apply naming convention:
```
[Category] Use Case - Trigger Context (n/N)
```

See [Naming Convention](NAMING-CONVENTION.md) for details.

## Step 8: Verify Updates

After batch updates, fetch templates again and confirm changes applied.

**Note:** MCP tools handle authentication automatically. No token refresh needed.

---

## Formatting Principles

These apply to all output in this workflow:

1. **Use `##` and `###` headers** for visual breaks — no ASCII box-drawing characters
2. **Single bold stat lines** for small counts (4 or fewer items)
3. **Markdown tables** for list data (4+ items)
4. **`---` horizontal rules** between major sections
5. **Bold labels** (`**Affected:**`, `**Risk:**`, `**Fix:**`) for structured issue blocks
6. **Severity indicators:** `■` Critical, `▲` Warning, `○` Info
7. **Status indicators:** `✓` Active, `⏸` Inactive, `⚠` Has issue
8. **Example fragments, not rigid templates** — adapt formatting to the actual data
