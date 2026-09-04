# Field Propagation Through a Hierarchy

Keeps a **Top → Bottom** relation in sync with the **Top → Middle → Bottom** paths, and
**propagates selected relation fields** from each Middle→Bottom relation onto the
derived Top→Bottom relation.

```
Top    --relTopToMiddle-----> Middle
Middle --relMiddleToBottom---> Bottom
Top    --relTopToBottom------> Bottom   (created/updated by the automation, + propagated fields)
```

The shipped example uses **Initiative → Platform → Application** as the concrete
hierarchy, but everything is **CONFIG-driven** — see [How To Adapt](#how-to-adapt).

## Use Case

In a 3-level hierarchy, a Top fact sheet reaches Bottom fact sheets only indirectly,
through Middle fact sheets. Analysts and reports, however, often need a **direct**
Top→Bottom relation — and they need the relation-level context (impact, prerequisite,
scope, …) captured on the Middle→Bottom link to travel with it.

This suite maintains that direct relation automatically:

- Whenever a Middle is linked to a Top, or a Bottom is linked to a Middle, the derived
  Top→Bottom relation is created (or refreshed).
- Selected relation fields from the Middle→Bottom relation are copied onto the derived
  Top→Bottom relation, with per-workspace enum mapping.
- When links are removed, the derived relation is decremented and eventually deleted —
  but only when no live path still justifies it.
- Manually created Top→Bottom relations are never touched.

Because the derived relation is fully machine-managed, the direct view stays consistent
without analysts hand-maintaining a second set of links.

## Scripts

| Script | Role |
|--------|------|
| [field-propagation-through-hierarchy.js](field-propagation-through-hierarchy.js) | Event-driven. Reacts to relation add/remove/change and maintains the derived Top→Bottom relations + propagated fields. |
| [field-propagation-reconciler.js](field-propagation-reconciler.js) | Catch-all, self-healing. Full-scans and recomputes desired relations from live paths, ignoring description text. Run on the Bottom-side removal trigger and/or on a schedule. |

## How It Works

1. **Provenance marker**: derived relations store `Auto-managed by LeanIX automation. Do not edit. [via:<middleId>,<middleId>]` in the relation `description`. The `[via:]` set records which Middles justify the relation.
2. **Manual relations preserved**: any Top→Bottom relation whose description does **not** contain the marker is treated as manual and is never overwritten or deleted.
3. **Ref-counting on removal**: removing one Middle decrements the `[via:]` set; the relation is deleted only when the last contributing Middle is gone. When other Middles survive, the relation's propagated field values are **re-derived from a surviving Middle**, never left sourced from the removed one.
4. **Attribute changes propagate**: editing a Middle→Bottom relation's fields (a "Relation is changed" event where the related fact sheet is unchanged) re-runs the add/refresh path so the new field values propagate.
5. **Rev-less writes**: uses `upsertRelation` / `deleteRelation` (keyed by `from`/`to`/`type`, no rev) — concurrency-safe against `REVISION_CLASH`.
6. **triggerData-based dispatch**: the event script does not trust an event-type
   discriminator. It reads `data.metadata.triggerData` and derives the event from which
   of `currentRelatedFactSheetId` / `previousRelatedFactSheetId` is present:
   - only **current** → addition
   - only **previous** → removal
   - both, **equal** → attribute-only change (re-run add/refresh so edited fields propagate)
   - both, **different** → target switch (remove previous + add current)

   It then routes on `data.factSheet.type` + `triggerData.relationType`: a Top firing on
   `relTopToMiddle` runs the Middle-add/remove handlers; a Middle firing on
   `relMiddleToBottom` runs the Bottom-add/remove handlers.

## Required Automations

Create **6 automations**, all pointing at `field-propagation-through-hierarchy.js`:

| # | Fact Sheet Type | Relation Type | Position | Trigger |
|---|-----------------|---------------|----------|---------|
| 1 | `Initiative` (topType) | `relInitiativeToPlatform` (relTopToMiddle) | FROM | Relation is added |
| 2 | `Initiative` (topType) | `relInitiativeToPlatform` (relTopToMiddle) | FROM | Relation is removed |
| 3 | `Initiative` (topType) | `relInitiativeToPlatform` (relTopToMiddle) | FROM | Relation is changed |
| 4 | `Platform` (middleType) | `relPlatformToApplication` (relMiddleToBottom) | FROM | Relation is added |
| 5 | `Platform` (middleType) | `relPlatformToApplication` (relMiddleToBottom) | FROM | Relation is removed |
| 6 | `Platform` (middleType) | `relPlatformToApplication` (relMiddleToBottom) | FROM | Relation is changed |

Plus a **7th** (recommended) pointing at `field-propagation-reconciler.js`:

| # | Fact Sheet Type | Trigger |
|---|-----------------|------|
| 7 | `Application` (bottomType) | Relation is removed (and/or a schedule) |

> The script derives the event (addition / removal / target-switch / attribute-only
> change) from which of `currentRelatedFactSheetId` / `previousRelatedFactSheetId` is
> present in `data.metadata.triggerData` — it does **not** rely on an event-type
> discriminator being echoed into `triggerData`.

> **IMPORTANT:** `relTopToBottom` (`relInitiativeToTargetApplication`) must **NOT** be
> one of the configured trigger relation types. The script writes that relation, so
> triggering on it would re-trigger the automation and risk an event storm.

## Configuration

Update **both** scripts before deploying:

1. Replace `INSTANCE` in `graphqlUrl` with your LeanIX instance name.
2. Confirm the CONFIG values match your workspace (types, relation names, fields).

## How To Adapt

To adapt this to a **different** hierarchy, edit **only the `CONFIG` block** in both
scripts:

- `topType` / `middleType` / `bottomType` — fact sheet type names.
- `relTopToMiddle` / `relMiddleToTop` / `relMiddleToBottom` / `relTopToBottom` —
  the **directional `RelationName` enums** (external names like `relXToY`, **not**
  internal model relation keys; these are the same names delivered in
  `triggerData.relationType` and used as the mutation `type`).
- `propagatedFields` — the relation fields to copy. Each entry declares:
  - `name` — the relation field's key (the derived relation must have the same field key).
  - `kind` — **`single`** (single-select / string; Patch value is a **plain string**) or
    **`multi`** (multi-select; Patch value is `JSON.stringify(array)`). Encoding is
    driven by this, so you don't have to remember pathfinder's Patch value rules.
  - `mapping` — source-workspace enum key → target-workspace enum key.

No other code needs to change.

## Behavior Matrix

| Event | Result |
|-------|--------|
| Middle added to Top | Every Bottom under that Middle gets a Top→Bottom relation with propagated fields; `[via:]` includes the Middle |
| Bottom added to Middle | Every Top above that Middle gets a Top→Bottom relation to that Bottom |
| Middle→Bottom relation fields edited | Propagated fields refreshed on the derived Top→Bottom relation(s) |
| Middle removed from Top (other Middles still reach the Bottom) | `[via:]` decremented; fields re-derived from a **surviving** Middle |
| Middle removed from Top (last Middle) | Derived Top→Bottom relation deleted |
| Bottom removed from Middle (other Middles still reach it) | `[via:]` decremented; fields re-derived from a surviving Middle |
| Bottom removed from Middle (last Middle) | Derived relation deleted |
| Manual Top→Bottom relation (no marker) | Preserved, never touched |

## Limitations

1. **`[via:]` ref-count lives in description text.** The event script infers how many
   Middles justify a derived relation from the `[via:...]` marker in the relation
   `description`. A manual edit to that text, a relation created outside the
   automation, or a single missed/failed event can corrupt the count — leading to a
   relation deleted too early (orphaned) or one that never deletes (stuck). The event
   script cannot recover prior state if the description was altered. **Mitigation:**
   run `field-propagation-reconciler.js`, which recomputes the desired state directly
   from live Top→Middle→Bottom paths and ignores description text for correctness.

2. **Non-exhaustive field mappings drop values silently.** Any source enum value not
   present in a field's `mapping` is dropped from the propagated relation. Keep each
   `mapping` exhaustive for your workspace.

3. **Encoding depends on `kind`.** A `single` field must be given a plain-string Patch
   value and a `multi` field a `JSON.stringify(array)` value. The scripts handle this
   from the `kind` you declare — set it correctly per field or pathfinder will reject
   the write (single-select given an array, or multi-select given a bare string).

4. **Batched writes are all-or-nothing per Top.** All ops for one Top go in a single
   aliased mutation; one failing op (e.g. a permission/constraint error) fails the
   whole mutation for that Top. The reconciler recovers such partial states on its
   next run.

5. **Relation-type triggers.** Configure the trigger relation types exactly as in the
   table above, and never trigger on `relTopToBottom` (the derived relation) — the
   script writes it, so triggering on it would self-retrigger.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Nothing propagates | Check bearer token, and that the automation's Relation Type matches `relTopToMiddle` / `relMiddleToBottom` in CONFIG |
| Fields not copied | Confirm the field `name` exists on both the source and derived relations, and that `kind` is correct |
| Relation deleted too early / stuck | The `[via:]` count drifted — run the reconciler to self-heal |
| Enum value missing on derived relation | Add it to that field's `mapping` (mappings must be exhaustive) |
| Manual relation got overwritten | Ensure its description does not contain the provenance marker text |
