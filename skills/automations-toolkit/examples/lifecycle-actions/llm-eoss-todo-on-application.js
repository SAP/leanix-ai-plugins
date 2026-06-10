/**
 * Generic: Create idempotent To-Do on a Related Fact Sheet for Subscribed Users
 *
 * Pattern (use case-agnostic):
 *   Trigger fires on Source fact sheet -> find related Target fact sheets ->
 *   for each Target, find users with a given subscription type + role ->
 *   create a To-Do on the Target assigned to those users, idempotently.
 *
 * Default config below: LLM End-of-Support notification.
 *   Trigger:    Lifecycle phase reached on ITComponent, 30 days BEFORE endOfLife
 *   Condition:  ITComponent category / subtype = "LLM" (set in trigger config)
 *   Outcome:    Each related Application gets a To-Do for its "Service Manager"
 *               (RESPONSIBLE subscription) reminding them to update the LLM.
 *
 * To reuse for other scenarios (e.g. "Application EOL -> notify Provider's Account Manager",
 * "BC change -> notify owning App's Architect"), edit the CONFIG block below.
 *
 * Idempotency:
 *   To-Dos are created with a deterministic `externalId` of the form
 *   "{externalIdPrefix}:{sourceId}:{targetId}". Before creating, we POST
 *   /to-do/query filtered by those externalIds and states OPEN/IN_PROGRESS;
 *   matches are skipped. Closed To-Dos do not block creation - that's the
 *   right behaviour if the trigger fires again after the situation re-occurs.
 *
 * Why a Run Script (not built-in CREATE_ACTION_ITEM):
 *   The built-in action only creates To-Dos on the triggering fact sheet.
 *   This pattern requires the To-Do on a *related* fact sheet, so we call
 *   the To-Do REST API directly.
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

// ============================================================================
// CONFIG - edit these to adapt the script to a new use case
// ============================================================================

// Replace the literal "INSTANCE" with your workspace subdomain
// (e.g. "app", "us", "demo-eu-1"). Find/replace works.
const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";
const TODO_URL = "https://INSTANCE.leanix.net/services/todo/v1/to-do";
const TODO_QUERY_URL = "https://INSTANCE.leanix.net/services/todo/v1/to-do/query";

const CONFIG = {
  // -- Source: the fact sheet the trigger fires on -------------------------
  sourceType: "ITComponent",                  // GraphQL type, e.g. "Application", "ITComponent"

  // -- Target: how to find the fact sheets the To-Do should land on --------
  relation: "relITComponentToApplication",    // GraphQL relation field on the source
  // (target type is implicit in the relation; no separate field needed)

  // -- Who gets the To-Do --------------------------------------------------
  subscriptionType: "RESPONSIBLE",            // "RESPONSIBLE" | "ACCOUNTABLE" | "OBSERVER"
  subscriptionRole: "Service Manager",        // Role name as configured in the workspace

  // -- To-Do content -------------------------------------------------------
  // {sourceName} and {targetName} are substituted with the displayName of the
  // source / target fact sheet. Description renders as plain text in the UI.
  todoTitle:
    'Update LLM "{sourceName}" - vendor end of standard support in 30 days',
  todoDescription:
    'The LLM IT Component "{sourceName}" reaches its vendor ' +
    'End of (Standard) Support in 30 days. ' +
    'As Service Manager of the related Application "{targetName}", ' +
    'please review and update the LLM (e.g. plan migration, extend support, or replace).',

  // -- Idempotency ---------------------------------------------------------
  // ExternalId is built as "{externalIdPrefix}:{sourceId}:{targetId}"
  externalIdPrefix: "llm-eoss",

  // -- Due date ------------------------------------------------------------
  todoDueDays: 30,                            // Days from "now" to To-Do due date
};

// ============================================================================
// Script - generally no need to edit below this line
// ============================================================================

export async function main() {
  const fs = data?.factSheet;
  if (!fs?.id || fs?.type !== CONFIG.sourceType) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const authHeaders = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };

  // 1. Fetch the source + its related targets + each target's subscriptions
  const query =
    "query($id:ID!){factSheet(id:$id){id displayName ... on " + CONFIG.sourceType + " {" +
    CONFIG.relation + "{edges{node{factSheet{id displayName subscriptions{edges{node{" +
    "type user{id displayName} roles{id name}}}}}}}}}}}";

  const gqlRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ query: query, variables: { id: fs.id } }),
  });
  const gqlJson = await gqlRes.json();
  if (gqlJson?.errors) {
    throw new Error("GraphQL failed: " + JSON.stringify(gqlJson.errors));
  }

  const source = gqlJson?.data?.factSheet;
  if (!source) return {};

  // Collect related target fact sheets
  const targets = [];
  const targetEdges = source[CONFIG.relation]?.edges || [];
  for (const edge of targetEdges) {
    const target = edge?.node?.factSheet;
    if (target) targets.push(target);
  }
  if (targets.length === 0) return {};

  // 2. Build candidate To-Dos: one per target that has a matching subscriber
  const candidates = [];
  for (const target of targets) {
    const subEdges = target.subscriptions?.edges || [];
    const seenUserIds = new Set();
    const assignees = [];

    for (const subEdge of subEdges) {
      const sub = subEdge?.node;
      if (!sub) continue;
      if (sub.type !== CONFIG.subscriptionType) continue;
      if (!sub.user?.id) continue;

      let hasRole = false;
      const roles = sub.roles || [];
      for (const role of roles) {
        if (role?.name === CONFIG.subscriptionRole) {
          hasRole = true;
          break;
        }
      }
      if (!hasRole) continue;

      // Dedupe by user id (a user might hold the role on multiple subscriptions)
      if (seenUserIds.has(sub.user.id)) continue;
      seenUserIds.add(sub.user.id);
      assignees.push({ id: sub.user.id });
    }

    if (assignees.length === 0) continue;

    candidates.push({
      target: target,
      assignees: assignees,
      externalId: CONFIG.externalIdPrefix + ":" + source.id + ":" + target.id,
    });
  }

  if (candidates.length === 0) return {};

  // 3. Idempotency check: query existing OPEN / IN_PROGRESS To-Dos by externalId
  const candidateExternalIds = [];
  for (const cand of candidates) {
    candidateExternalIds.push(cand.externalId);
  }

  const queryBody = {
    query: {
      externalIds: candidateExternalIds,
      states: ["OPEN", "IN_PROGRESS"],
    },
  };

  const existingRes = await fetch(TODO_QUERY_URL, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(queryBody),
  });
  if (!existingRes.ok) {
    const errorText = await existingRes.text();
    throw new Error("To-Do query failed: " + existingRes.status + " - " + errorText);
  }
  const existingJson = await existingRes.json();
  const existingItems = existingJson?.data || existingJson?.content || [];
  const existingExternalIds = new Set();
  if (Array.isArray(existingItems)) {
    for (const todo of existingItems) {
      if (todo?.externalId) existingExternalIds.add(todo.externalId);
    }
  }

  // 4. Create only the missing To-Dos
  const dueDate = new Date(Date.now() + CONFIG.todoDueDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  for (const cand of candidates) {
    if (existingExternalIds.has(cand.externalId)) continue; // already exists - skip

    const title = CONFIG.todoTitle
      .split("{sourceName}").join(source.displayName)
      .split("{targetName}").join(cand.target.displayName);
    const description = CONFIG.todoDescription
      .split("{sourceName}").join(source.displayName)
      .split("{targetName}").join(cand.target.displayName);

    const todoPayload = {
      factSheet: { id: cand.target.id },
      title: title,
      category: "ACTION_ITEM",
      description: description,
      assignees: cand.assignees,
      dueDate: dueDate,
      externalId: cand.externalId,
    };

    const res = await fetch(TODO_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(todoPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        "To-Do creation failed for target " + cand.target.id + ": " +
        res.status + " - " + errorText
      );
    }
  }

  return {};
}
