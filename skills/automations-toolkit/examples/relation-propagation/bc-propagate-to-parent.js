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

// Helper to get current revision (for retry on REVISION_CLASH)
async function getCurrentRev(fsId, token, graphqlUrl) {
  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query ($id: ID!) { factSheet(id: $id) { rev } }`,
      variables: { id: fsId }
    }),
  });
  return (await res.json())?.data?.factSheet?.rev;
}

export async function main() {
  const appId = data?.factSheet?.id;
  if (!appId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

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

  const appRes = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: appQuery, variables: { id: appId } }),
  });

  const appJson = await appRes.json();
  if (appJson?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(appJson.errors)}`);

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

  const parentRes = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: parentQuery, variables: { id: parent.id } }),
  });

  const parentJson = await parentRes.json();
  if (parentJson?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(parentJson.errors)}`);

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

  // Step 5: Add missing BCs to parent
  for (const [bcId, bc] of desiredBCs) {
    // Skip if manually added
    if (manualRelations.has(bcId)) continue;

    const newDescription = buildInheritedDescription(bc.childNames);

    // If already inherited, check if we need to update the description
    if (inheritedRelations.has(bcId)) {
      const existing = inheritedRelations.get(bcId);
      if (existing.description === newDescription) continue; // No change needed

      // Update the relation description with retry on REVISION_CLASH
      let retries = 3;
      while (retries > 0) {
        const currentRev = await getCurrentRev(parentFs.id, token, graphqlUrl);
        if (!currentRev) throw new Error("Could not get parent rev");

        const updateRes = await fetch(graphqlUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
              updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
                factSheet { id rev }
              }
            }`,
            variables: {
              id: parentFs.id,
              rev: currentRev,
              patches: [{
                op: "replace",
                path: `/relApplicationToBusinessContext/${existing.relationId}`,
                value: JSON.stringify({
                  factSheetId: bcId,
                  description: newDescription,
                }),
              }],
            },
          }),
        });

        const updateJson = await updateRes.json();
        if (updateJson?.errors) {
          const errorMsg = JSON.stringify(updateJson.errors);
          if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
            retries--;
            continue;
          }
          throw new Error(`Update BC failed: ${errorMsg}`);
        }
        break; // Success
      }
      continue;
    }

    // Add new BC relation to parent with retry on REVISION_CLASH
    let retries = 3;
    while (retries > 0) {
      const currentRev = await getCurrentRev(parentFs.id, token, graphqlUrl);
      if (!currentRev) throw new Error("Could not get parent rev");

      const addRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
            updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
              factSheet { id rev }
            }
          }`,
          variables: {
            id: parentFs.id,
            rev: currentRev,
            patches: [{
              op: "add",
              path: `/relApplicationToBusinessContext/new_${bcId}`,
              value: JSON.stringify({
                factSheetId: bcId,
                description: newDescription,
              }),
            }],
          },
        }),
      });

      const addJson = await addRes.json();
      if (addJson?.errors) {
        const errorMsg = JSON.stringify(addJson.errors);
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }
        throw new Error(`Add BC failed: ${errorMsg}`);
      }
      break; // Success
    }
  }

  // Step 6: Remove inherited BCs that no child has anymore
  for (const [bcId, rel] of inheritedRelations) {
    if (desiredBCs.has(bcId)) continue; // Still needed by a child

    // Remove this inherited relation with retry on REVISION_CLASH
    let retries = 3;
    while (retries > 0) {
      const currentRev = await getCurrentRev(parentFs.id, token, graphqlUrl);
      if (!currentRev) throw new Error("Could not get parent rev");

      const removeRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
            updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
              factSheet { id rev }
            }
          }`,
          variables: {
            id: parentFs.id,
            rev: currentRev,
            patches: [{
              op: "remove",
              path: `/relApplicationToBusinessContext/${rel.relationId}`,
            }],
          },
        }),
      });

      const removeJson = await removeRes.json();
      if (removeJson?.errors) {
        const errorMsg = JSON.stringify(removeJson.errors);
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }
        throw new Error(`Remove BC failed: ${errorMsg}`);
      }
      break; // Success
    }
  }

  return {};
}
