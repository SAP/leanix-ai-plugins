/**
 * Business Context Cleanup on Child Unlink
 *
 * When a child Application is unlinked from its parent, this script
 * reconciles the parent's inherited Business Contexts based on remaining children.
 *
 * Trigger (on Application - the PARENT):
 *   - Relation is removed (relToChild)
 *
 * Why trigger on parent?
 *   When "Relation is removed" fires on the child (for relToParent), the child
 *   can no longer see its former parent. By triggering on the parent, we can
 *   still query remaining children and reconcile.
 *
 * Logic:
 *   1. Query parent's remaining children and their BCs
 *   2. Remove any inherited BCs that no remaining child has
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
  const parentId = data?.factSheet?.id;
  if (!parentId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  // Query parent with remaining children and their BCs
  const query = `query ($id: ID!) {
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

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: parentId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const parent = json?.data?.factSheet;
  if (!parent) return {};

  // Collect all BCs from remaining children (with child names)
  const desiredBCs = new Map(); // bcId -> { id, name, childNames: string[] }
  const children = (parent.relToChild?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(c => c && c.type === "Application");

  for (const child of children) {
    const childBCs = (child.relApplicationToBusinessContext?.edges || [])
      .map(e => e?.node?.factSheet)
      .filter(Boolean);
    for (const bc of childBCs) {
      if (desiredBCs.has(bc.id)) {
        desiredBCs.get(bc.id).childNames.push(child.name);
      } else {
        desiredBCs.set(bc.id, { id: bc.id, name: bc.name, childNames: [child.name] });
      }
    }
  }

  // Find inherited BC relations to update or remove
  const parentBCRelations = (parent.relApplicationToBusinessContext?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  for (const rel of parentBCRelations) {
    const bcId = rel.factSheet?.id;
    if (!bcId) continue;

    // Only process inherited relations
    if (!isInheritedRelation(rel.description)) continue;

    // If no remaining child has this BC, remove it with retry on REVISION_CLASH
    if (!desiredBCs.has(bcId)) {
      let retries = 3;
      while (retries > 0) {
        const currentRev = await getCurrentRev(parent.id, token, graphqlUrl);
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
              id: parent.id,
              rev: currentRev,
              patches: [{
                op: "remove",
                path: `/relApplicationToBusinessContext/${rel.id}`,
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
      continue;
    }

    // Update description if child names have changed
    const bc = desiredBCs.get(bcId);
    const newDescription = buildInheritedDescription(bc.childNames);
    if (rel.description === newDescription) continue;

    let retries = 3;
    while (retries > 0) {
      const currentRev = await getCurrentRev(parent.id, token, graphqlUrl);
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
            id: parent.id,
            rev: currentRev,
            patches: [{
              op: "replace",
              path: `/relApplicationToBusinessContext/${rel.id}`,
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
  }

  return {};
}
