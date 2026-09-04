/**
 * Field Propagation Reconciler (Catch-All / Self-Healing) — INSTANCE.leanix.net
 *
 * Companion to field-propagation-through-hierarchy.js. The event script tracks which
 * Middles justify each derived Top->Bottom relation inside the relation `description`
 * ("[via:...]"). That ref-count lives ONLY in text, so a manual edit, a missed event,
 * or a failed run can corrupt it -> orphaned or stuck relations.
 *
 * This reconciler ignores the [via:] text for CORRECTNESS: it recomputes the desired
 * Top->Bottom relations (and their propagated field values) directly from the live
 * Top->Middle->Bottom paths, then makes the workspace match. It is full-scan and
 * therefore slower, but guaranteed to converge. Relations WITHOUT the provenance
 * marker are treated as MANUAL and never touched.
 *
 * WHEN TO RUN:
 *   - On the Bottom-side "Relation is removed" trigger (when a Bottom drops its
 *     Middle, the event script may not be able to see the former parent), and/or
 *   - On a schedule, as a safety net.
 *
 * RETARGETING: same as the event script — edit only the CONFIG block below.
 *
 * CONCURRENCY: relation-scoped upsertRelation / deleteRelation carry no rev and are
 * keyed by (from, to, type) — concurrency-safe.
 */

// ─── CONFIGURATION (keep in sync with field-propagation-through-hierarchy.js) ───
const CONFIG = {
  topType: 'Initiative',
  middleType: 'Platform',
  bottomType: 'Application',

  relTopToMiddle: 'relInitiativeToPlatform',          // on Top    -> Middle
  relMiddleToBottom: 'relPlatformToApplication',      // on Middle -> Bottom
  relTopToBottom: 'relInitiativeToTargetApplication', // on Top    -> Bottom (derived/sync target)

  // Same declarations as the event script: kind 'single' (plain string) / 'multi'
  // (JSON.stringify(array)); mapping must be exhaustive (unmapped values dropped).
  propagatedFields: [
    { name: 'impactTemporality', kind: 'single', mapping: { before: 'before', along: 'along', notBlocker: 'notBlocker' } },
    { name: 'prerequisite', kind: 'single', mapping: { yes: 'yes', no: 'no', conditional: 'conditional' } },
    {
      name: 'prerequisiteScope',
      kind: 'multi',
      mapping: { OptionA: 'OptionA', OptionB: 'OptionB', OptionC: 'OptionC', OptionD: 'OptionD', OptionE: 'OptionE', Global: 'Global' }
    }
  ],

  graphqlUrl: 'https://INSTANCE.leanix.net/services/pathfinder/v1/graphql'
};

const PROVENANCE_MARKER = 'Auto-managed by LeanIX automation. Do not edit.';

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

function propagatedFieldSelection() {
  return CONFIG.propagatedFields.map((f) => f.name).join(' ');
}

function mapValue(field, rawValue) {
  if (field.kind === 'multi') {
    const arr = Array.isArray(rawValue) ? rawValue : [];
    return [...new Set(arr.map((v) => field.mapping[v]).filter(Boolean))];
  }
  return (rawValue && field.mapping[rawValue]) || null;
}

function buildDescription(middleIds) {
  return `${PROVENANCE_MARKER} [via:${middleIds.join(',')}]`;
}

function isAutomationManaged(description) {
  return !!description && description.includes(PROVENANCE_MARKER);
}

// Stable serialization of a desired relation's field values, so we only write when
// something actually changed.
function fieldSignature(sourceNode) {
  const parts = [];
  for (const field of CONFIG.propagatedFields) {
    const mapped = mapValue(field, sourceNode?.[field.name]);
    parts.push(`${field.name}=${field.kind === 'multi' ? JSON.stringify(mapped) : mapped}`);
  }
  return parts.join('|');
}

function buildUpsertPatches(middleIds, sourceNode) {
  const patches = [{ op: 'replace', path: '/description', value: buildDescription(middleIds) }];
  for (const field of CONFIG.propagatedFields) {
    const mapped = mapValue(field, sourceNode?.[field.name]);
    const value = field.kind === 'multi' ? JSON.stringify(mapped) : mapped;
    patches.push({ op: 'replace', path: `/${field.name}`, value });
  }
  return patches;
}

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
  await gql(
    token,
    `mutation ($type: RelationName!, ${varDefs.join(', ')}) { ${fields.join(' ')} }`,
    variables
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export async function main() {
  const token = context?.secrets?.['default_automations_secret']?.value?.bearerToken;
  if (!token) throw new Error('ABORT - Missing bearerToken');

  // Full-scan every Top with its Middle->Bottom paths and its existing Top->Bottom
  // relations, in one paged query. Correctness comes from the live paths, not text.
  const query = `query ($first: Int!, $after: String) {
    allFactSheets(
      first: $first
      after: $after
      filter: { facetFilters: [{ facetKey: "FactSheetTypes", keys: ["${CONFIG.topType}"] }] }
    ) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          ... on ${CONFIG.topType} {
            ${CONFIG.relTopToMiddle} {
              edges {
                node {
                  factSheet {
                    id
                    ... on ${CONFIG.middleType} {
                      ${CONFIG.relMiddleToBottom} {
                        edges { node { ${propagatedFieldSelection()} factSheet { id } } }
                      }
                    }
                  }
                }
              }
            }
            ${CONFIG.relTopToBottom} {
              edges { node { id description ${propagatedFieldSelection()} factSheet { id } } }
            }
          }
        }
      }
    }
  }`;

  let hasMore = true;
  let after = null;
  while (hasMore) {
    const d = await gql(token, query, { first: 50, after });
    const page = d?.allFactSheets;
    const tops = edges(page).filter((t) => t?.id);

    for (const top of tops) {
      // Desired state: bottomId -> { middleIds:Set, sourceNode } from live paths.
      const desired = new Map();
      const middles = edges(top[CONFIG.relTopToMiddle])
        .map((n) => n?.factSheet)
        .filter((m) => m?.id);
      for (const middle of middles) {
        const bottomNodes = edges(middle[CONFIG.relMiddleToBottom]).filter((n) => n?.factSheet?.id);
        for (const node of bottomNodes) {
          const bottomId = node.factSheet.id;
          if (!desired.has(bottomId)) {
            desired.set(bottomId, { middleIds: new Set(), sourceNode: node });
          }
          // First surviving middle wins as the field source (deterministic order).
          desired.get(bottomId).middleIds.add(middle.id);
        }
      }

      // Existing managed relations on this Top (manual ones are left untouched).
      const existingByBottom = new Map();
      for (const rel of edges(top[CONFIG.relTopToBottom])) {
        const bId = rel?.factSheet?.id;
        if (bId) existingByBottom.set(bId, rel);
      }

      const ops = [];

      // Upsert desired relations that are missing or drifted.
      for (const [bottomId, want] of desired) {
        const existing = existingByBottom.get(bottomId);
        if (existing && !isAutomationManaged(existing.description)) continue; // manual, skip
        const middleIds = [...want.middleIds];
        const wantDesc = buildDescription(middleIds);
        if (existing &&
            existing.description === wantDesc &&
            fieldSignature(existing) === fieldSignature(want.sourceNode)) {
          continue; // already correct
        }
        ops.push({ op: 'upsert', bottomId, middleIds, sourceNode: want.sourceNode });
      }

      // Delete managed relations no longer justified by any live path.
      for (const [bottomId, rel] of existingByBottom) {
        if (desired.has(bottomId)) continue;
        if (!isAutomationManaged(rel.description)) continue; // manual, skip
        ops.push({ op: 'delete', bottomId });
      }

      await applyBatchForTop(token, top.id, ops);
    }

    hasMore = page?.pageInfo?.hasNextPage || false;
    after = page?.pageInfo?.endCursor || null;
  }

  return {};
}
