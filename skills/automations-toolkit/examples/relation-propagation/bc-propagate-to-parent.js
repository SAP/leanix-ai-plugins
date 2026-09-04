/**
 * Business Context Propagate to Parent - Full Reconciliation
 *
 * Propagates Business Context relations from child Applications to parent Applications.
 * When a BC is linked to a child, the parent should also have that BC.
 * When a BC is removed from all children, it should be removed from the parent.
 *
 * Triggers (on Application - create 2 automations):
 *   1. Relation is added
 *   2. Relation is removed
 *
 * Logic:
 *   1. Find this Application's parent (via relToParent)
 *   2. Query all children of that parent
 *   3. Collect union of all children's Business Contexts
 *   4. Add missing BCs to parent (marked as inherited)
 *   5. Remove inherited BCs from parent that no child has
 *
 * Note: Uses description field to mark inherited relations, so manually-added
 * BCs on the parent are preserved.
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";
const INHERITED_MARKER = "[Auto-inherited from:";
const INHERITED_MARKER_END = "]";

// Build description with child names
function buildInheritedDescription(childNames) {
  return `${INHERITED_MARKER} ${childNames.join(", ")}${INHERITED_MARKER_END}`;
}

// Check if description contains our marker
function isInheritedRelation(description) {
  return description && description.includes(INHERITED_MARKER);
}

// Single GraphQL call helper: throws on json.errors (same as the inline checks did)
async function gql(query, variables, token) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);
  return json;
}

// Apply a batch of relation writes to the parent in ONE mutation using
// relation-scoped upsertRelation / deleteRelation. These are keyed by
// (from, to, type) and carry NO rev, so they are concurrency-safe against
// REVISION_CLASH — no getCurrentRev + retry loop is needed.
// ops: Array of { op: "upsert" | "delete", bcId, description? }
async function applyRelationBatch(parentId, ops, token) {
  if (ops.length === 0) return;
  const varDefs = [];
  const fields = [];
  const variables = { type: "relApplicationToBusinessContext" };
  ops.forEach((o, i) => {
    variables[`from${i}`] = { id: parentId };
    variables[`to${i}`] = { id: o.bcId };
    varDefs.push(`$from${i}: FactSheetIdentifierType!, $to${i}: FactSheetIdentifierType!`);
    if (o.op === "upsert") {
      variables[`patches${i}`] = [{ op: "replace", path: "/description", value: o.description }];
      varDefs.push(`$patches${i}: [Patch!]`);
      fields.push(`r${i}: upsertRelation(from: $from${i}, to: $to${i}, type: $type, patches: $patches${i}) { relation { id } }`);
    } else {
      fields.push(`r${i}: deleteRelation(from: $from${i}, to: $to${i}, type: $type) { relation { id } }`);
    }
  });
  await gql(
    `mutation ($type: RelationName!, ${varDefs.join(", ")}) { ${fields.join(" ")} }`,
    variables,
    token,
  );
}

export async function main() {
  const appId = data?.factSheet?.id;
  if (!appId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Step 1: Query this Application and its parent
  const appQuery = `query ($id: ID!) {
    factSheet(id: $id) {
      id name type
      ... on Application {
        relToParent { edges { node { factSheet { id name rev type } } } }
        relApplicationToBusinessContext { edges { node { factSheet { id name } } } }
      }
    }
  }`;

  const appJson = await gql(appQuery, { id: appId }, token);
  const app = appJson?.data?.factSheet;
  if (!app) return {};

  // Get parent Application
  const parentEdges = (app.relToParent?.edges || []).map(e => e?.node?.factSheet).filter(Boolean);
  const parent = parentEdges.find(p => p.type === "Application");
  if (!parent) return {}; // No parent Application, nothing to do

  // Step 2: Query parent with all its children and their BCs
  const parentQuery = `query ($id: ID!) {
    factSheet(id: $id) {
      id name rev type
      ... on Application {
        relApplicationToBusinessContext {
          edges {
            node {
              id
              description
              factSheet { id name }
            }
          }
        }
        relToChild {
          edges {
            node {
              factSheet {
                id name type
                ... on Application {
                  relApplicationToBusinessContext {
                    edges { node { factSheet { id name } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const parentJson = await gql(parentQuery, { id: parent.id }, token);
  const parentFs = parentJson?.data?.factSheet;
  if (!parentFs) throw new Error("ABORT AUTOMATION RUN - Parent not found");

  // Step 3: Collect all BCs from all children (desired state)
  const desiredBCs = new Map(); // bcId -> { id, name, childNames: string[] }
  const children = (parentFs.relToChild?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(c => c && c.type === "Application");

  for (const child of children) {
    const childBCs = (child.relApplicationToBusinessContext?.edges || [])
      .map(e => e?.node?.factSheet)
      .filter(Boolean);
    for (const bc of childBCs) {
      if (desiredBCs.has(bc.id)) {
        // Add this child's name to existing entry
        desiredBCs.get(bc.id).childNames.push(child.name);
      } else {
        desiredBCs.set(bc.id, { id: bc.id, name: bc.name, childNames: [child.name] });
      }
    }
  }

  // Step 4: Get parent's current BC relations
  const parentBCRelations = (parentFs.relApplicationToBusinessContext?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  // Separate inherited vs manually-added relations
  const inheritedRelations = new Map(); // bcId -> { relationId, bcId, bcName, description }
  const manualRelations = new Set(); // bcIds that were manually added

  for (const rel of parentBCRelations) {
    const bcId = rel.factSheet?.id;
    if (!bcId) continue;

    if (isInheritedRelation(rel.description)) {
      inheritedRelations.set(bcId, {
        relationId: rel.id,
        bcId: bcId,
        bcName: rel.factSheet.name,
        description: rel.description,
      });
    } else {
      manualRelations.add(bcId);
    }
  }

  // Steps 5 & 6: Build all relation ops, then apply them in ONE mutation.
  // Uses relation-scoped upsertRelation / deleteRelation (keyed by from/to/type,
  // no rev) instead of updateFactSheet patches — concurrency-safe, no retry needed.
  const ops = [];

  // Step 5: Add missing BCs to parent (or update inherited description).
  // upsertRelation both creates (if absent) and updates (if present), so the
  // former "add new" and "replace existing" cases collapse into one upsert.
  for (const [bcId, bc] of desiredBCs) {
    // Skip if manually added
    if (manualRelations.has(bcId)) continue;

    const newDescription = buildInheritedDescription(bc.childNames);

    if (inheritedRelations.has(bcId)) {
      // Already inherited - only write if the description actually changed
      const existing = inheritedRelations.get(bcId);
      if (existing.description === newDescription) continue; // No change needed
    }

    // Create-or-update the inherited BC relation on the parent.
    ops.push({ op: "upsert", bcId, description: newDescription });
  }

  // Step 6: Remove inherited BCs that no child has anymore
  for (const [bcId] of inheritedRelations) {
    if (desiredBCs.has(bcId)) continue; // Still needed by a child

    // These are existing relations (from the parent query), so deleteRelation
    // by (parent, bcId, type) is guaranteed to find them.
    ops.push({ op: "delete", bcId });
  }

  // Apply all relation changes to the parent in a single mutation
  await applyRelationBatch(parentFs.id, ops, token);

  return {};
}
