/**
 * Business Context Reconcile All Parents (Catch-All)
 *
 * When a child Application removes its parent relationship (relToParent),
 * we can no longer see the former parent. This script reconciles ALL parent
 * Applications to ensure inherited BCs are correct.
 *
 * Trigger (on Application - the CHILD):
 *   - Relation is removed
 *
 * Logic:
 *   1. Check if this app still has a parent (if yes, normal script handles it)
 *   2. Query ALL Applications that have inherited BC relations
 *   3. For each parent, reconcile inherited BCs based on their current children
 *
 * Note: This is intentionally a "catch all" that doesn't rely on description
 * text matching. It's less efficient but guaranteed to work.
 */

const INHERITED_MARKER = "[Auto-inherited from:";
const INHERITED_MARKER_END = "]";

function buildInheritedDescription(childNames) {
  return `${INHERITED_MARKER} ${childNames.join(", ")}${INHERITED_MARKER_END}`;
}

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

  // Check if this app still has a parent - if so, the normal script handles it
  const checkQuery = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      ... on Application {
        relToParent { edges { node { factSheet { id type } } } }
      }
    }
  }`;

  const checkRes = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: checkQuery, variables: { id: appId } }),
  });

  const checkJson = await checkRes.json();
  if (checkJson?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(checkJson.errors)}`);

  const hasParent = (checkJson?.data?.factSheet?.relToParent?.edges || [])
    .some(e => e?.node?.factSheet?.type === "Application");

  // If still has a parent, the normal bc-propagate-to-parent.js handles it
  if (hasParent) return {};

  // This app no longer has a parent - reconcile ALL parent Applications
  // Query all Applications and find those with inherited BC relations
  const allAppsQuery = `query ($first: Int!, $after: String) {
    allFactSheets(
      first: $first
      after: $after
      filter: { facetFilters: [{ facetKey: "FactSheetTypes", keys: ["Application"] }] }
    ) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id name rev
          ... on Application {
            relToChild {
              edges { node { factSheet { id name type } } }
            }
            relApplicationToBusinessContext {
              edges {
                node {
                  id description
                  factSheet { id name }
                }
              }
            }
          }
        }
      }
    }
  }`;

  // Find all Applications that have inherited BC relations (potential parents)
  let potentialParents = [];
  let hasMore = true;
  let after = null;

  while (hasMore) {
    const res = await fetch(graphqlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: allAppsQuery,
        variables: { first: 100, after },
      }),
    });

    const json = await res.json();
    if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

    const page = json?.data?.allFactSheets;
    const apps = (page?.edges || []).map(e => e?.node).filter(Boolean);

    for (const app of apps) {
      // Check if this app has any inherited BC relations (is a parent)
      const bcRels = (app.relApplicationToBusinessContext?.edges || [])
        .map(e => e?.node)
        .filter(Boolean);

      const hasInheritedBCs = bcRels.some(rel => isInheritedRelation(rel.description));

      if (hasInheritedBCs) {
        potentialParents.push(app);
      }
    }

    hasMore = page?.pageInfo?.hasNextPage || false;
    after = page?.pageInfo?.endCursor || null;
  }

  if (potentialParents.length === 0) return {};

  // Reconcile each potential parent
  for (const parent of potentialParents) {
    // Query fresh data with children's BCs (need deeper nesting)
    const parentQuery = `query ($id: ID!) {
      factSheet(id: $id) {
        id name rev
        ... on Application {
          relApplicationToBusinessContext {
            edges {
              node {
                id description
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
    if (parentJson?.errors) continue;

    const parentFs = parentJson?.data?.factSheet;
    if (!parentFs) continue;

    // Collect all BCs from CURRENT children
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
          desiredBCs.get(bc.id).childNames.push(child.name);
        } else {
          desiredBCs.set(bc.id, { id: bc.id, name: bc.name, childNames: [child.name] });
        }
      }
    }

    // Check parent's inherited BCs
    const parentBCRelations = (parentFs.relApplicationToBusinessContext?.edges || [])
      .map(e => e?.node)
      .filter(Boolean);

    for (const rel of parentBCRelations) {
      const bcId = rel.factSheet?.id;
      if (!bcId) continue;
      if (!isInheritedRelation(rel.description)) continue;

      // If no child has this BC anymore, remove it with retry on REVISION_CLASH
      if (!desiredBCs.has(bcId)) {
        let retries = 3;
        while (retries > 0) {
          const currentRev = await getCurrentRev(parentFs.id, token, graphqlUrl);
          if (!currentRev) break;

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
                patches: [{ op: "remove", path: `/relApplicationToBusinessContext/${rel.id}` }],
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
            break; // Other error, skip
          }
          break; // Success
        }
        continue;
      }

      // Update description if child names changed with retry on REVISION_CLASH
      const bc = desiredBCs.get(bcId);
      const newDescription = buildInheritedDescription(bc.childNames);
      if (rel.description === newDescription) continue;

      let retries = 3;
      while (retries > 0) {
        const currentRev = await getCurrentRev(parentFs.id, token, graphqlUrl);
        if (!currentRev) break;

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
                path: `/relApplicationToBusinessContext/${rel.id}`,
                value: JSON.stringify({ factSheetId: bcId, description: newDescription }),
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
          break; // Other error, skip
        }
        break; // Success
      }
    }
  }

  return {};
}
