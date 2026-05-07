/**
 * Risk Currency Tag Rollup - ITComponent Trigger (Script B)
 *
 * When a Risk Currency tag is added/removed on an ITComponent, updates all
 * linked Applications with the worst Risk Currency tag from their ITC stack.
 *
 * Triggers (create 8 automations using this same script):
 * - Tag is added: Preferred, Limited Use, Sunset, Retired/Not Allowed
 * - Tag is removed: Preferred, Limited Use, Sunset, Retired/Not Allowed
 *
 * Uses GraphQL mutations to update Applications (cannot use return object
 * because the triggering fact sheet is an ITComponent, not an Application).
 * Includes retry-on-REVISION_CLASH pattern.
 *
 * Part of a 10-automation set. Automations 1-2 use risk-currency-app-trigger.js.
 * Automations 3-10 use this script (ITC tag triggers).
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

var MAX_RETRIES = 3;

async function getCurrentRevAndTags(fsId, token) {
  var query = "query ($id: ID!) { factSheet(id: $id) { id rev tags { id name } ... on Application { relApplicationToITComponent { edges { node { factSheet { ... on ITComponent { id tags { id name } } } } } } } } }";

  var res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query: query, variables: { id: fsId } })
  });

  var json = await res.json();
  if (json && json.errors) {
    throw new Error("GraphQL query failed: " + JSON.stringify(json.errors));
  }

  return json && json.data && json.data.factSheet;
}

function determineWorstTag(linkedITCs) {
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

  if (riskTagIds.size === 0) return null;

  for (var k = 0; k < RISK_CURRENCY_TAGS.length; k++) {
    if (riskTagIds.has(RISK_CURRENCY_TAGS[k].id)) {
      return RISK_CURRENCY_TAGS[k].id;
    }
  }

  return null;
}

export async function main() {
  var itcId = data && data.factSheet && data.factSheet.id;
  if (!itcId) return {};

  var token = context && context.secrets && context.secrets["default_automations_secret"]
    && context.secrets["default_automations_secret"].value
    && context.secrets["default_automations_secret"].value.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Get all Applications linked to this ITComponent
  var itcQuery = "query ($id: ID!) { factSheet(id: $id) { ... on ITComponent { relITComponentToApplication { edges { node { factSheet { id } } } } } } }";

  var itcRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query: itcQuery, variables: { id: itcId } })
  });

  var itcJson = await itcRes.json();
  if (itcJson && itcJson.errors) {
    throw new Error("GraphQL failed: " + JSON.stringify(itcJson.errors));
  }

  var appEdges = (itcJson && itcJson.data && itcJson.data.factSheet
    && itcJson.data.factSheet.relITComponentToApplication
    && itcJson.data.factSheet.relITComponentToApplication.edges) || [];
  var appIds = appEdges
    .map(function (e) { return e && e.node && e.node.factSheet && e.node.factSheet.id; })
    .filter(Boolean);

  if (!appIds.length) return {};

  // For each Application, recalculate and update Risk Currency tag
  for (var a = 0; a < appIds.length; a++) {
    var appId = appIds[a];

    var retries = MAX_RETRIES;
    while (retries > 0) {
      // Fetch fresh Application data (tags, rev, linked ITCs)
      var app = await getCurrentRevAndTags(appId, token);
      if (!app || !app.rev) break;

      // Get all linked ITCs for this Application
      var itcEdges = (app.relApplicationToITComponent
        && app.relApplicationToITComponent.edges) || [];
      var linkedITCs = itcEdges
        .map(function (e) { return e && e.node && e.node.factSheet; })
        .filter(Boolean);

      // Determine worst Risk Currency tag across all linked ITCs
      var worstTagId = determineWorstTag(linkedITCs);

      // Get current tags on the Application
      var currentTagObjects = app.tags || [];
      var currentTagIds = currentTagObjects.map(function (t) { return t && t.id; }).filter(Boolean);

      // Separate Risk Currency tags from other tags
      var otherTagIds = currentTagIds.filter(function (id) {
        return ALL_RISK_CURRENCY_IDS.indexOf(id) === -1;
      });
      var currentRiskTagIds = currentTagIds.filter(function (id) {
        return ALL_RISK_CURRENCY_IDS.indexOf(id) !== -1;
      });

      // Build desired Risk Currency tags
      var desiredRiskTags = worstTagId ? [worstTagId] : [];

      // Check if already correct (idempotency)
      var alreadyCorrect =
        currentRiskTagIds.length === desiredRiskTags.length &&
        desiredRiskTags.every(function (id) { return currentRiskTagIds.indexOf(id) !== -1; });

      if (alreadyCorrect) break;

      // Build new tag array for the patch
      var newTagIds = otherTagIds.concat(desiredRiskTags);
      var tagValue = JSON.stringify(newTagIds.map(function (id) {
        return { tagId: id };
      }));

      // Update Application tags via mutation
      var mutQuery = "mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) { updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) { factSheet { id rev } } }";

      var mutRes = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: mutQuery,
          variables: {
            id: appId,
            rev: app.rev,
            patches: [{ op: "replace", path: "/tags", value: tagValue }]
          }
        })
      });

      var mutJson = await mutRes.json();
      if (mutJson && mutJson.errors) {
        var errorMsg = JSON.stringify(mutJson.errors);
        if (errorMsg.indexOf("REVISION_CLASH") !== -1 && retries > 1) {
          retries--;
          continue;
        }
        throw new Error("Mutation failed for App " + appId + ": " + errorMsg);
      }
      break; // Success
    }
  }

  return {};
}
