/**
 * Document Sensitivity Tagging
 *
 * Trigger: Tag is added (for testing) / Completion score is changed (for production)
 * Logic:
 *   - Scans all attached documents and their documentType
 *   - Adds sensitivity tags based on document types found
 *   - If no sensitive documents found → adds "No Sensitive Content" tag
 *   - Removes sensitivity tags that no longer apply
 *   - Idempotent: Safe to run multiple times
 *
 * CONFIGURATION:
 *   - Update TAG_IDS with your actual tag IDs
 *   - Update DOCUMENT_TYPE_TO_TAG_KEY to map document types to tag keys
 */

// =============================================================================
// CONFIGURATION - Update these values for your environment
// =============================================================================

/**
 * Tag IDs for the "Sensitive Content (Uploaded Resources)" tag group
 * Find tag IDs by querying: { allTags { edges { node { id name } } } }
 */
// Replace with your workspace IDs
const TAG_IDS = {
  architecture: "00000000-0000-0000-0000-000000000001",  // Sensitive Content: Architecture
  business: "00000000-0000-0000-0000-000000000002",      // Sensitive Content: Business
  security: "00000000-0000-0000-0000-000000000003",      // Sensitive Content: Security
  noSensitiveContent: "00000000-0000-0000-0000-000000000004"  // Sensitive Content: No Sensitive Content
};

/**
 * Maps documentType values to tag keys from TAG_IDS
 * Adjust this mapping based on your organization's classification needs
 *
 * Document types not listed here will not trigger any sensitivity tag
 */
const DOCUMENT_TYPE_TO_TAG_KEY = {
  // Architecture-related documents
  "documentation": "architecture",
  "roadmap": "architecture",
  "image": "architecture",

  // Business-related documents
  "policy": "business",
  "decision": "business",
  "request": "business",
  "ordering_form": "business",
  "information": "business",
  "faq": "business",

  // Security-related documents
  "security": "security",
  "certificate": "security",

  // Document types that don't trigger sensitivity tags (mapped to null)
  // These are considered non-sensitive and will result in "No Sensitive Content" if only these exist
  "jira": null,
  "task": null,
  "website": null,
  "phone_contact": null,
  "miscellaneous": null,
  "support_ticket": null,
  "additional_help": null
};

// GraphQL endpoint - update for your LeanIX instance
const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

// =============================================================================
// MAIN SCRIPT - No changes needed below unless customizing behavior
// =============================================================================

// Collect all sensitivity tag IDs for filtering
const ALL_SENSITIVITY_TAG_IDS = Object.values(TAG_IDS);

export async function main() {
  const fsId = data?.factSheet?.id;
  const fsType = data?.factSheet?.type;

  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query current documents attached to the fact sheet
  const { documents, currentTags } = await queryFactSheetData(fsId, token);

  // Determine which sensitivity tags should be applied based on documents
  const requiredTagKeys = new Set();

  for (const doc of documents) {
    const docType = doc.documentType;
    if (docType && DOCUMENT_TYPE_TO_TAG_KEY.hasOwnProperty(docType)) {
      const tagKey = DOCUMENT_TYPE_TO_TAG_KEY[docType];
      if (tagKey !== null) {
        requiredTagKeys.add(tagKey);
      }
    }
  }

  // If no sensitive documents found, apply "No Sensitive Content" tag
  if (requiredTagKeys.size === 0) {
    requiredTagKeys.add("noSensitiveContent");
  }

  // Convert required tag keys to tag IDs
  const requiredTagIds = new Set(
    Array.from(requiredTagKeys).map(key => TAG_IDS[key]).filter(Boolean)
  );

  // Get current tag IDs
  const currentTagIds = currentTags.map(t => t.id);

  // Separate current tags into sensitivity tags and other tags
  const currentSensitivityTagIds = currentTagIds.filter(id => ALL_SENSITIVITY_TAG_IDS.includes(id));
  const otherTagIds = currentTagIds.filter(id => !ALL_SENSITIVITY_TAG_IDS.includes(id));

  // Check if any changes are needed
  const currentSensitivitySet = new Set(currentSensitivityTagIds);
  const hasCorrectTags =
    requiredTagIds.size === currentSensitivitySet.size &&
    Array.from(requiredTagIds).every(id => currentSensitivitySet.has(id));

  if (hasCorrectTags) {
    // No changes needed
    return {};
  }

  // Build new tag list: keep other tags, replace sensitivity tags with required ones
  const newTagIds = [...otherTagIds, ...Array.from(requiredTagIds)];

  return { tags: newTagIds };
}

/**
 * Queries the fact sheet for its documents and current tags
 */
async function queryFactSheetData(fsId, token) {
  const query = `
    query ($id: ID!) {
      factSheet(id: $id) {
        id
        tags { id name }
        documents(first: 1000) {
          edges {
            node {
              id
              documentType
              name
            }
          }
        }
      }
    }
  `;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) {
    throw new Error(`GraphQL query failed: ${JSON.stringify(json.errors)}`);
  }

  const fs = json?.data?.factSheet;
  if (!fs) {
    throw new Error("ABORT AUTOMATION RUN - Fact sheet not found");
  }

  const documents = (fs.documents?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  return {
    documents,
    currentTags: fs.tags || []
  };
}
