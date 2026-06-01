/**
 * Worst Case Status (from Initiatives)
 *
 * Fact Sheet Type: Application
 * Target Field: initiativeRisk (Single Select)
 * Logic: Returns the worst status from all linked initiatives
 *
 * Target field options: "blocked", "at_risk", "on_track", "unknown"
 *
 * Priority (worst to best): blocked > at_risk > on_track
 */

export function main() {
  const relations = data.relApplicationToInitiative ?? [];

  if (relations.length === 0) {
    return null;
  }

  const statuses = relations
    .map(r => r.factsheet?.status)
    .filter(Boolean);

  if (statuses.length === 0) {
    return null;
  }

  // Check in priority order (worst first)
  const priority = ["blocked", "at_risk", "on_track"];

  for (const status of priority) {
    if (statuses.includes(status)) {
      return status;
    }
  }

  return "unknown";
}
