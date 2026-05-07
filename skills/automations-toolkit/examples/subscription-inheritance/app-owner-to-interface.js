/**
 * Application Owner to Interface - Add Only
 *
 * Triggers (on Application):
 *   1. Subscription is added (RESPONSIBLE + Application Owner)
 *   2. Relation is added (relApplicationToInterface)
 *
 * Logic: When an Application Owner is added to an Application, or when an
 *        Interface is linked to the Application, adds the Application Owner
 *        subscription to all related Interfaces (if not already present).
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 *
 * Configuration:
 *   - Update GRAPHQL_URL with your instance (line 19)
 */

export async function main() {
  const appId = data?.factSheet?.id;
  if (!appId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  // Query Application with its owners and related Interfaces
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      name
      subscriptions { edges { node { type user { id } roles { id name } } } }
      ... on Application {
        relApplicationToInterface { edges { node { factSheet {
          id rev subscriptions { edges { node { id type user { id } roles { id name } } } }
        } } } }
      }
    }
  }`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: appId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const app = json?.data?.factSheet;
  if (!app) throw new Error("ABORT AUTOMATION RUN - Application not found");

  // Extract Application Owners from the Application
  const owners = new Map();
  for (const sub of (app.subscriptions?.edges || []).map(e => e?.node).filter(Boolean)) {
    if (sub.type !== "RESPONSIBLE") continue;
    for (const role of sub.roles || []) {
      if (role.name === "Application Owner") {
        owners.set(`${role.id}|${sub.user.id}`, { userId: sub.user.id, roleId: role.id });
      }
    }
  }

  // If no Application Owners, nothing to sync
  if (owners.size === 0) return {};

  // Get related Interfaces
  const interfaces = (app.relApplicationToInterface?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(Boolean);

  if (!interfaces.length) return {};

  // Sync owners to each Interface
  for (const iface of interfaces) {
    let currentRev = iface.rev;
    const ifaceSubs = (iface.subscriptions?.edges || []).map(e => e?.node).filter(Boolean);

    // Find existing Application Owner subscriptions on this Interface
    const existingKeys = new Set();
    for (const sub of ifaceSubs) {
      if (sub.type !== "RESPONSIBLE") continue;
      for (const role of sub.roles || []) {
        if (role.name === "Application Owner") {
          existingKeys.add(`${role.id}|${sub.user.id}`);
        }
      }
    }

    // Add missing owners (idempotency: skip if already exists)
    for (const [key, owner] of owners) {
      if (existingKeys.has(key)) continue;

      const createRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($fsId: ID!, $fsRev: Long!, $user: UserInput!, $roles: [SubscriptionToSubscriptionRoleLinkInput]) {
            createSubscription(factSheetId: $fsId, factSheetRev: $fsRev, user: $user, type: RESPONSIBLE, roles: $roles) {
              factSheet { rev }
            }
          }`,
          variables: {
            fsId: iface.id,
            fsRev: currentRev,
            user: { id: owner.userId },
            roles: [{ id: owner.roleId, comment: `Inherited from ${app.name}` }]
          },
        }),
      });

      const createJson = await createRes.json();
      if (createJson?.errors) throw new Error(`Create subscription failed: ${JSON.stringify(createJson.errors)}`);
      currentRev = createJson?.data?.createSubscription?.factSheet?.rev ?? currentRev;
    }
  }

  return {};
}
