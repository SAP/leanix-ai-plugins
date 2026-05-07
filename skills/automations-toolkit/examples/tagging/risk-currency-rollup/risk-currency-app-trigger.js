/**
 * Risk Currency Tag Rollup - Application Trigger (Script A)
 *
 * Rolls up the "worst" Risk Currency tag from linked IT Components to the Application.
 * Uses reconciliation pattern - works for both relation add and remove triggers.
 *
 * Triggers (create 2 automations using this same script):
 * - Relation is added (Application)
 * - Relation is removed (Application)
 *
 * Priority (worst wins):
 * 1. Retired/Not Allowed (worst)
 * 2. Sunset
 * 3. Limited Use
 * 4. Preferred (best)
 *
 * If no ITCs have Risk Currency tags -> clear all Risk Currency tags from App.
 * Returns {} if tags are already correct (idempotent).
 *
 * Part of a 10-automation set. Automations 1-2 use this script (App relation triggers).
 * Automations 3-10 use risk-currency-itc-trigger.js (ITC tag triggers).
 *
 * CONFIGURATION REQUIRED:
 * 1. Replace INSTANCE with your LeanIX instance name (e.g., "your-instance")
 * 2. Verify tag IDs match your workspace (see RISK_CURRENCY_TAGS below)
 */

// Risk Currency tags ordered by priority (index 0 = worst)
// Replace with your workspace IDs
var RISK_CURRENCY_TAGS = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Retired/Not Allowed" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Sunset" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Limited Use" },
  { id: "00000000-0000-0000-0000-000000000004", name: "Preferred" }
];

var ALL_RISK_CURRENCY_IDS = RISK_CURRENCY_TAGS.map(function (t) { return t.id; });

// GraphQL endpoint - update for your LeanIX instance
var GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  var fsId = data && data.factSheet && data.factSheet.id;
  if (!fsId) return {};

  var token = context && context.secrets && context.secrets["default_automations_secret"]
    && context.secrets["default_automations_secret"].value
    && context.secrets["default_automations_secret"].value.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query all linked ITComponents and their tags
  var linkedITCs = await queryLinkedITComponents(fsId, token);

  // Collect all Risk Currency tag IDs from linked ITCs
  var riskTagIds = new Set();
  for (var i = 0; i < linkedITCs.length; i++) {
    var itc = linkedITCs[i];
    var tags = (itc.tags || []);
    for (var j = 0; j < tags.length; j++) {
      var tagId = tags[j] && tags[j].id;
      if (tagId && ALL_RISK_CURRENCY_IDS.indexOf(tagId) !== -1) {
        riskTagIds.add(tagId);
      }
    }
  }

  // Determine the worst Risk Currency tag
  var worstTagId = null;
  if (riskTagIds.size > 0) {
    for (var k = 0; k < RISK_CURRENCY_TAGS.length; k++) {
      if (riskTagIds.has(RISK_CURRENCY_TAGS[k].id)) {
        worstTagId = RISK_CURRENCY_TAGS[k].id;
        break;
      }
    }
  }

  // Get current tags on the Application
  var currentTags = (data.factSheet.tags) || [];

  // Separate Risk Currency tags from other tags
  var otherTags = currentTags.filter(function (id) {
    return ALL_RISK_CURRENCY_IDS.indexOf(id) === -1;
  });
  var currentRiskTags = currentTags.filter(function (id) {
    return ALL_RISK_CURRENCY_IDS.indexOf(id) !== -1;
  });

  // Build desired Risk Currency tags
  var desiredRiskTags = worstTagId ? [worstTagId] : [];

  // Check if already correct (idempotency)
  var alreadyCorrect =
    currentRiskTags.length === desiredRiskTags.length &&
    desiredRiskTags.every(function (id) { return currentRiskTags.indexOf(id) !== -1; });

  if (alreadyCorrect) {
    return {};
  }

  // Return updated tag list: preserve other tags + set worst Risk Currency tag
  return { tags: otherTags.concat(desiredRiskTags) };
}

async function queryLinkedITComponents(fsId, token) {
  var query = "query ($id: ID!) { factSheet(id: $id) { ... on Application { relApplicationToITComponent { edges { node { factSheet { ... on ITComponent { id tags { id name } } } } } } } } }";

  var res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: query, variables: { id: fsId } })
  });

  var json = await res.json();
  if (json && json.errors) {
    throw new Error("GraphQL query failed: " + JSON.stringify(json.errors));
  }

  var edges = (json && json.data && json.data.factSheet
    && json.data.factSheet.relApplicationToITComponent
    && json.data.factSheet.relApplicationToITComponent.edges) || [];
  return edges.map(function (e) { return e && e.node && e.node.factSheet; }).filter(Boolean);
}
