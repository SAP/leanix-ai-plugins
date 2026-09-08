/**
 * Field Propagation Through a 3-Level Hierarchy — Event-Driven Script (INSTANCE.leanix.net)
 *
 * Keeps a Top->Bottom relation in sync with the Top->Middle->Bottom paths, AND
 * copies (propagates) selected relation fields from each Middle->Bottom relation
 * onto the derived Top->Bottom relation.
 *
 *   Top    --relTopToMiddle-----> Middle
 *   Middle --relMiddleToBottom---> Bottom
 * Keeps in sync (created/updated by this script):
 *   Top    --relTopToBottom------> Bottom   (+ propagated relation fields)
 *
 * ─── ILLUSTRATIVE HIERARCHY ────────────────────────────────────────────────────
 * This example is shipped with Initiative / Platform / Application as the concrete
 * hierarchy, but it is FULLY CONFIG-DRIVEN. To retarget to a different hierarchy
 * you only edit the CONFIG block below:
 *   - topType / middleType / bottomType         (fact sheet type names)
 *   - relTopToMiddle / relMiddleToTop /
 *     relMiddleToBottom / relTopToBottom          (directional RelationName enums)
 *   - propagatedFields                            (which relation fields to copy + how to encode them)
 * No other code should need to change.
 *
 * ─── FIELD PROPAGATION MODEL ───────────────────────────────────────────────────
 * Each propagated field is declared with a `kind` so encoding is data-driven and
 * you don't have to know pathfinder's Patch value rules by heart:
 *   - kind: 'single'  -> single-select / string field. Patch value = plain string (or null).
 *   - kind: 'multi'   -> multi-select field.            Patch value = JSON.stringify(array).
 * `mapping` translates source-workspace enum keys to target-workspace enum keys.
 * IMPORTANT: mappings must be EXHAUSTIVE for your workspace — any source value not
 * present in the mapping is silently dropped (documented limitation; see README).
 *
 * ─── PROVENANCE & REF-COUNTING (and its limits) ─────────────────────────────────
 * A derived Top->Bottom relation records which Middles justify it inside the
 * relation `description` field as "[via:<middleId>,<middleId>]". This lets removals
 * decrement the set and delete only when the last Middle is gone. Relations WITHOUT
 * the marker are treated as MANUAL and are never overwritten or deleted.
 *
 * The [via:] set lives ONLY in description text, so a manual edit, a missed event,
 * or a failed run can corrupt the count. This event script is therefore paired with
 * a companion catch-all reconciler that recomputes desired Top->Bottom relations
 * directly from live paths (ignoring description text for correctness):
 *   -> field-propagation-reconciler.js  (run it on the Bottom-side removal trigger
 *      and/or on a schedule). See README.md "Limitations".
 *
 * ─── CONCURRENCY DESIGN ────────────────────────────────────────────────────────
 * Uses relation-scoped mutations (upsertRelation / deleteRelation) which carry no
 * rev and are keyed by (from, to, type) — concurrency-safe against REVISION_CLASH.
 *
 * ─── AUTOMATION SETUP (6 automations, all pointing at THIS script) ──────────────
 *   Automations 1-3: Fact Sheet Type = topType (Initiative), Position = FROM,
 *                     Relation Type = relTopToMiddle (relInitiativeToPlatform),
 *                     Trigger = Relation added / removed / changed
 *   Automations 4-6: Fact Sheet Type = middleType (Platform), Position = FROM,
 *                     Relation Type = relMiddleToBottom (relPlatformToApplication),
 *                     Trigger = Relation added / removed / changed
 *
 * IMPORTANT: relTopToBottom (relInitiativeToTargetApplication) must NOT be one of
 * the configured triggers, or the script's own writes would re-trigger it and could
 * cause an event storm. (Idempotency via the [via:] set limits the damage, but do
 * not rely on it — just don't trigger on the derived relation.)
 */

// ─── CONFIGURATION (single point of adaptation) ─────────────────────────────────
const CONFIG = {
  // Fact sheet types in the hierarchy (Top -> Middle -> Bottom).
  topType: 'Initiative',
  middleType: 'Platform',
  bottomType: 'Application',

  // Directional RelationName enums (the EXTERNAL names, e.g. relXToY — NOT internal
  // model relation keys). These are the SAME names delivered in
  // data.metadata.triggerData.relationType and used as the mutation `type`.
  relTopToMiddle: 'relInitiativeToPlatform',          // on Top    -> Middle
  relMiddleToTop: 'relPlatformToInitiative',          // on Middle -> Top (reverse of the above)
  relMiddleToBottom: 'relPlatformToApplication',      // on Middle -> Bottom
  relTopToBottom: 'relInitiativeToTargetApplication', // on Top    -> Bottom (the derived/sync target)

  // Relation fields copied from Middle->Bottom onto the derived Top->Bottom relation.
  // kind: 'single' -> plain-string Patch value; 'multi' -> JSON.stringify(array) Patch value.
  // mapping: source enum key -> target enum key (must be exhaustive; unmapped values dropped).
  propagatedFields: [
    {
      name: 'impactTemporality',
      kind: 'single',
      mapping: { before: 'before', along: 'along', notBlocker: 'notBlocker' }
    },
    {
      name: 'prerequisite',
      kind: 'single',
      mapping: { yes: 'yes', no: 'no', conditional: 'conditional' }
    },
    {
      name: 'prerequisiteScope',
      kind: 'multi',
      mapping: {
        OptionA: 'OptionA',
        OptionB: 'OptionB',
        OptionC: 'OptionC',
        OptionD: 'OptionD',
        OptionE: 'OptionE',
        Global: 'Global'
      }
    }
  ],

  graphqlUrl: 'https://INSTANCE.leanix.net/services/pathfinder/v1/graphql'
};

// ─── HELPERS ────────────────────────────────────────────────────────────────────
async function gql(token, query, variables = {}) {
  const res = await fetch(CONFIG.graphqlUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

function edges(connection) {
  return (connection?.edges || []).map((e) => e?.node).filter(Boolean);
}

// GraphQL selection for the propagated fields (built from CONFIG so it stays in sync).
function propagatedFieldSelection() {
  return CONFIG.propagatedFields.map((f) => f.name).join(' ');
}

// Fetch Bottom relation nodes (with propagated fields) linked to a Middle.
async function fetchBottomNodesFromMiddle(token, middleId) {
  const d = await gql(
    token,
    `query ($id: ID!) {
      factSheet(id: $id) {
        id
        ... on ${CONFIG.middleType} {
          ${CONFIG.relMiddleToBottom} {
            edges {
              node {
                ${propagatedFieldSelection()}
                factSheet { id }
              }
            }
          }
        }
      }
    }`,
    { id: middleId }
  );
  const fs = d?.factSheet;
  if (!fs) return [];
  return edges(fs[CONFIG.relMiddleToBottom]).filter((n) => n?.factSheet?.id);
}

// Fetch Top IDs linked to a Middle.
async function fetchTopIdsFromMiddle(token, middleId) {
  const d = await gql(
    token,
    `query ($id: ID!) {
      factSheet(id: $id) {
        id
        ... on ${CONFIG.middleType} {
          ${CONFIG.relMiddleToTop} { edges { node { factSheet { id } } } }
        }
      }
    }`,
    { id: middleId }
  );
  const fs = d?.factSheet;
  if (!fs) return [];
  return edges(fs[CONFIG.relMiddleToTop]).map((n) => n?.factSheet?.id).filter(Boolean);
}

// Fetch existing Top->Bottom relation nodes keyed by Bottom ID. No rev needed.
async function fetchTopRelationsByBottomId(token, topId) {
  const d = await gql(
    token,
    `query ($id: ID!) {
      factSheet(id: $id) {
        id
        ... on ${CONFIG.topType} {
          ${CONFIG.relTopToBottom} {
            edges {
              node {
                id description
                ${propagatedFieldSelection()}
                factSheet { id }
              }
            }
          }
        }
      }
    }`,
    { id: topId }
  );
  const fs = d?.factSheet;
  if (!fs) return new Map();
  return new Map(
    edges(fs[CONFIG.relTopToBottom])
      .filter((n) => n?.factSheet?.id)
      .map((n) => [n.factSheet.id, n])
  );
}

// Find the propagated-field source node for a bottom from any SURVIVING middle.
// Returns the first surviving Middle->Bottom node that still links the bottom, or
// null if none of the surviving middles actually link it. Used so that when one
// middle is unlinked, the remaining Top->Bottom relation is re-derived from a
// SURVIVING middle's field values (not the stale/removed middle's values).
async function findSurvivingSourceNode(token, middleIds, bottomId) {
  for (const mid of middleIds) {
    const nodes = await fetchBottomNodesFromMiddle(token, mid);
    const node = nodes.find((n) => n.factSheet.id === bottomId);
    if (node) return node;
  }
  return null;
}

// ─── FIELD ENCODING ───────────────────────────────────────────────────────────
// Map a raw source value through a field's mapping, honoring its kind.
function mapValue(field, rawValue) {
  if (field.kind === 'multi') {
    const arr = Array.isArray(rawValue) ? rawValue : [];
    return [...new Set(arr.map((v) => field.mapping[v]).filter(Boolean))];
  }
  return (rawValue && field.mapping[rawValue]) || null;
}

// ─── PROVENANCE ─────────────────────────────────────────────────────────────────
// Marker stored in the derived relation's `description`. A "contains" check (not an
// exact-string match) is used so stray whitespace doesn't flip ownership detection.
const PROVENANCE_MARKER = 'Auto-managed by LeanIX automation. Do not edit.';

function buildDescription(middleIds) {
  return `${PROVENANCE_MARKER} [via:${middleIds.join(',')}]`;
}

function isAutomationManaged(description) {
  return !!description && description.includes(PROVENANCE_MARKER);
}

function parseMiddleIds(description) {
  if (!description) return [];
  const match = description.match(/\[via:([^\]]*)\]/);
  if (!match || !match[1]) return [];
  return match[1].split(',').filter(Boolean);
}

// ─── RELATION-SCOPED WRITES ─────────────────────────────────────────────────────
// upsertRelation / deleteRelation carry no rev — concurrency-safe against
// REVISION_CLASH. Only DB-level DEADLOCK_DETECTED can occur, so that is the only
// retryable error class; anything else is rethrown as-is (no masking).
const MAX_RETRIES = 3;

function isRetryable(err) {
  return !!err?.message?.includes('DEADLOCK_DETECTED');
}

async function withRetry(contextInfo, fn) {
  let lastErr = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) throw err;
    }
  }
  throw lastErr; // unreachable (loop always returns or throws)
}

// Build the Patch list for a derived Top->Bottom relation: description marker plus
// every propagated field, encoded per its kind.
function buildUpsertPatches(middleIds, sourceNode) {
  const patches = [{ op: 'replace', path: '/description', value: buildDescription(middleIds) }];
  for (const field of CONFIG.propagatedFields) {
    const mapped = mapValue(field, sourceNode?.[field.name]);
    const value = field.kind === 'multi' ? JSON.stringify(mapped) : mapped;
    patches.push({ op: 'replace', path: `/${field.name}`, value });
  }
  return patches;
}

// Execute a batch of upsert/delete operations against a single Top in one mutation.
// ops: Array of { op: 'upsert'|'delete', bottomId, middleIds?, sourceNode? }
async function applyBatchForTop(token, topId, ops) {
  if (ops.length === 0) return;
  const varDefs = [];
  const fields = [];
  const variables = { type: CONFIG.relTopToBottom };
  ops.forEach((o, i) => {
    variables[`from${i}`] = { id: topId };
    variables[`to${i}`] = { id: o.bottomId };
    varDefs.push(`$from${i}: FactSheetIdentifierType!, $to${i}: FactSheetIdentifierType!`);
    if (o.op === 'upsert') {
      variables[`patches${i}`] = buildUpsertPatches(o.middleIds, o.sourceNode);
      varDefs.push(`$patches${i}: [Patch!]`);
      fields.push(`r${i}: upsertRelation(from: $from${i}, to: $to${i}, type: $type, patches: $patches${i}) { relation { id } }`);
    } else {
      fields.push(`r${i}: deleteRelation(from: $from${i}, to: $to${i}, type: $type) { relation { id } }`);
    }
  });
  return await gql(
    token,
    `mutation ($type: RelationName!, ${varDefs.join(', ')}) { ${fields.join(' ')} }`,
    variables
  );
}

// ─── SCRIPT HANDLERS ──────────────────────────────────────────────────────────
// A Middle was added to a Top (or a Top->Middle relation attribute changed) — add
// or refresh every Top->Bottom relation reachable through that Middle.
async function onMiddleAddedToTop(token, topId, middleId) {
  const bottomNodes = await fetchBottomNodesFromMiddle(token, middleId);
  const existingRelsByBottomId = await fetchTopRelationsByBottomId(token, topId);
  const ops = [];
  for (const sourceNode of bottomNodes) {
    const bottomId = sourceNode.factSheet.id;
    const existing = existingRelsByBottomId.get(bottomId);
    // Preserve manually authored Top->Bottom relations: never overwrite them.
    if (existing && !isAutomationManaged(existing.description)) continue;
    const middleIds = existing ? parseMiddleIds(existing.description) : [];
    if (!middleIds.includes(middleId)) middleIds.push(middleId);
    ops.push({ op: 'upsert', bottomId, middleIds, sourceNode });
  }
  await withRetry({ handler: 'onMiddleAddedToTop', topId, middleId }, () =>
    applyBatchForTop(token, topId, ops)
  );
}

// A Middle was removed from a Top — decrement the [via:] set on each Top->Bottom
// relation contributed by that Middle; delete when the last Middle is gone,
// otherwise re-derive the surviving relation from a SURVIVING middle's fields.
async function onMiddleRemovedFromTop(token, topId, removedMiddleId) {
  // Bottoms the removed middle contributed (used only to know WHICH relations to touch).
  const bottomNodes = await fetchBottomNodesFromMiddle(token, removedMiddleId);
  const existingRelsByBottomId = await fetchTopRelationsByBottomId(token, topId);
  const ops = [];
  for (const removedNode of bottomNodes) {
    const bottomId = removedNode.factSheet.id;
    const existing = existingRelsByBottomId.get(bottomId);
    if (!existing) continue;
    if (!isAutomationManaged(existing.description)) continue; // leave manual relations alone
    const middleIds = parseMiddleIds(existing.description).filter((id) => id !== removedMiddleId);
    if (middleIds.length === 0) {
      ops.push({ op: 'delete', bottomId });
      continue;
    }
    // Re-read propagated field values from a SURVIVING middle, not the removed one.
    const sourceNode = await findSurvivingSourceNode(token, middleIds, bottomId);
    if (sourceNode) {
      ops.push({ op: 'upsert', bottomId, middleIds, sourceNode });
    } else {
      // No surviving middle still links this bottom -> nothing valid to keep.
      ops.push({ op: 'delete', bottomId });
    }
  }
  await withRetry({ handler: 'onMiddleRemovedFromTop', topId, removedMiddleId }, () =>
    applyBatchForTop(token, topId, ops)
  );
}

// A Bottom was added to a Middle (or a Middle->Bottom relation attribute changed) —
// push/refresh the derived Top->Bottom relation on every Top above that Middle.
async function onBottomAddedToMiddle(token, middleId, bottomId) {
  const bottomNodes = await fetchBottomNodesFromMiddle(token, middleId);
  const sourceNode = bottomNodes.find((n) => n.factSheet.id === bottomId);
  if (!sourceNode) return;
  const topIds = await fetchTopIdsFromMiddle(token, middleId);
  for (const topId of topIds) {
    const existingRelsByBottomId = await fetchTopRelationsByBottomId(token, topId);
    const existing = existingRelsByBottomId.get(bottomId);
    // Preserve manually authored Top->Bottom relations: never overwrite them.
    if (existing && !isAutomationManaged(existing.description)) continue;
    const middleIds = existing ? parseMiddleIds(existing.description) : [];
    if (!middleIds.includes(middleId)) middleIds.push(middleId);
    await withRetry({ handler: 'onBottomAddedToMiddle', topId, middleId, bottomId }, () =>
      applyBatchForTop(token, topId, [{ op: 'upsert', bottomId, middleIds, sourceNode }])
    );
  }
}

// A Bottom was removed from a Middle — decrement the [via:] set; delete when the
// last Middle is gone, otherwise re-derive from a SURVIVING middle's fields.
async function onBottomRemovedFromMiddle(token, middleId, removedBottomId) {
  const topIds = await fetchTopIdsFromMiddle(token, middleId);
  for (const topId of topIds) {
    const existingRelsByBottomId = await fetchTopRelationsByBottomId(token, topId);
    const existing = existingRelsByBottomId.get(removedBottomId);
    if (!existing) continue;
    if (!isAutomationManaged(existing.description)) continue; // leave manual relations alone
    const middleIds = parseMiddleIds(existing.description).filter((id) => id !== middleId);
    let op;
    if (middleIds.length === 0) {
      op = { op: 'delete', bottomId: removedBottomId };
    } else {
      // Re-read propagated field values from a SURVIVING middle, not the removed one.
      const sourceNode = await findSurvivingSourceNode(token, middleIds, removedBottomId);
      op = sourceNode
        ? { op: 'upsert', bottomId: removedBottomId, middleIds, sourceNode }
        : { op: 'delete', bottomId: removedBottomId };
    }
    await withRetry({ handler: 'onBottomRemovedFromMiddle', topId, middleId, removedBottomId }, () =>
      applyBatchForTop(token, topId, [op])
    );
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export async function main() {
  const token = context?.secrets?.['default_automations_secret']?.value?.bearerToken;
  if (!token) throw new Error('ABORT - Missing bearerToken');

  const selfId = data?.factSheet?.id;
  const selfType = data?.factSheet?.type;
  if (!selfId || !selfType) throw new Error('ABORT - Missing factSheet.id or type');

  const triggerData = data?.metadata?.triggerData;
  if (!triggerData) throw new Error('ABORT - Missing triggerData');

  // triggerData delivers the directional relationType plus the ids of the related
  // fact sheet(s). We DO NOT rely on an event-type discriminator (it is a trigger
  // CONFIG field, not verified to be echoed here); instead we derive the event from
  // which ids are present:
  //   only current  -> addition
  //   only previous -> removal
  //   both, equal    -> attribute-only change (re-add/refresh current)
  //   both, differ   -> target switch (remove previous + add current)
  const { relationType, currentRelatedFactSheetId, previousRelatedFactSheetId } = triggerData;
  const cur = currentRelatedFactSheetId;
  const prev = previousRelatedFactSheetId;
  if (!cur && !prev) {
    throw new Error('ABORT - triggerData carries neither currentRelatedFactSheetId nor previousRelatedFactSheetId');
  }

  const isTopFiring = selfType === CONFIG.topType && relationType === CONFIG.relTopToMiddle;
  const isMiddleFiring = selfType === CONFIG.middleType && relationType === CONFIG.relMiddleToBottom;
  if (!isTopFiring && !isMiddleFiring) {
    throw new Error(`Unhandled trigger: factSheetType=${selfType} relationType=${relationType}`);
  }

  if (isTopFiring) {
    if (prev && prev !== cur) await onMiddleRemovedFromTop(token, selfId, prev);
    if (cur) await onMiddleAddedToTop(token, selfId, cur);
  } else {
    if (prev && prev !== cur) await onBottomRemovedFromMiddle(token, selfId, prev);
    if (cur) await onBottomAddedToMiddle(token, selfId, cur);
  }

  return {};
}
