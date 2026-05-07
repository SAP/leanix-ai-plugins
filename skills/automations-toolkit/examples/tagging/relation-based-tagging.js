/**
 * Relation-Based Tagging
 * Tags Applications based on linked ITComponent types (Server/Database).
 * Uses reconciliation pattern - works for both add and remove triggers.
 *
 * Triggers (create 2 automations using this same script):
 * - Relation is added (Application)
 * - Relation is removed (Application)
 *
 * Logic:
 * 1. Query all linked ITComponents and their tags
 * 2. Check each ITC's tags (Server or Database)
 * 3. Apply corresponding tags to Application (Linked_to_Server, Linked_to_Database)
 *
 * CONFIGURATION REQUIRED:
 * 1. Replace INSTANCE with your LeanIX instance name (e.g., "your-instance")
 * 2. Find your tag IDs using the allTags GraphQL query or tag management UI
 * 3. Update the four tag ID constants below:
 *    - ITC_TAG_IDS: Tags that exist ON the ITComponents
 *    - APP_TAG_IDS: Tags that will be ADDED to the Applications
 */

// ITC tag IDs - these are the tags ON the ITComponents
const ITC_TAG_IDS = {
  SERVER: "YOUR_ITC_SERVER_TAG_ID",
  DATABASE: "YOUR_ITC_DATABASE_TAG_ID"
};

// Application tag IDs - these will be added to the Application
const APP_TAG_IDS = {
  LINKED_TO_SERVER: "YOUR_APP_LINKED_TO_SERVER_TAG_ID",
  LINKED_TO_DATABASE: "YOUR_APP_LINKED_TO_DATABASE_TAG_ID"
};

const ALL_APP_TAG_IDS = Object.values(APP_TAG_IDS);

// GraphQL endpoint - update for your LeanIX instance
const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query all linked ITComponents and their tags
  const linkedITCs = await queryLinkedITComponents(fsId, token);

  // If no ITCs linked, remove all relation tags
  if (linkedITCs.length === 0) {
    const currentTags = data.factSheet.tags ?? [];
    const otherTags = currentTags.filter(id => !ALL_APP_TAG_IDS.includes(id));

    if (currentTags.length !== otherTags.length) {
      return { tags: otherTags };
    }
    return {};
  }

  // Determine which tags are needed based on ITC types
  const requiredTagIds = new Set();

  for (const itc of linkedITCs) {
    const itcTags = itc.tags || [];
    const itcTagIds = itcTags.map(t => t?.id).filter(Boolean);

    if (itcTagIds.includes(ITC_TAG_IDS.SERVER)) {
      requiredTagIds.add(APP_TAG_IDS.LINKED_TO_SERVER);
    }
    if (itcTagIds.includes(ITC_TAG_IDS.DATABASE)) {
      requiredTagIds.add(APP_TAG_IDS.LINKED_TO_DATABASE);
    }
  }

  // Get current tags
  const currentTags = data.factSheet.tags ?? [];

  // Separate relation-based tags from other tags
  const otherTags = currentTags.filter(id => !ALL_APP_TAG_IDS.includes(id));
  const currentRelationTags = currentTags.filter(id => ALL_APP_TAG_IDS.includes(id));

  // Check if already correct (idempotency)
  const requiredArray = Array.from(requiredTagIds);
  const alreadyCorrect =
    currentRelationTags.length === requiredArray.length &&
    requiredArray.every(id => currentRelationTags.includes(id));

  if (alreadyCorrect) {
    return {};
  }

  // Build new tag list: preserve other tags + add required tags
  return { tags: [...otherTags, ...requiredArray] };
}

async function queryLinkedITComponents(fsId, token) {
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      ... on Application {
        relApplicationToITComponent {
          edges {
            node {
              factSheet {
                ... on ITComponent {
                  id
                  tags {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables: { id: fsId } })
  });

  const json = await res.json();
  if (json?.errors) {
    throw new Error(`GraphQL query failed: ${JSON.stringify(json.errors)}`);
  }

  const edges = json?.data?.factSheet?.relApplicationToITComponent?.edges || [];
  return edges.map(e => e?.node?.factSheet).filter(Boolean);
}
