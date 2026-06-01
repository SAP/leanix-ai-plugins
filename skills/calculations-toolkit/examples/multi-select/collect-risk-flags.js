/**
 * Collect Risk Flags
 *
 * Fact Sheet Type: Application
 * Target Field: riskFlags (Multiple Select)
 * Logic: Adds flags based on various risk conditions
 *
 * Target field options: "eol_risk", "no_owner", "no_itc", "high_cost", "deprecated_tech"
 */

export function main() {
  const flags = [];

  // Check EOL risk
  const phases = data.lifecycle?.phases ?? [];
  const eolPhase = phases.find(p => p.phase === "endOfLife");
  if (eolPhase?.startDate) {
    const today = new Date();
    const eolDate = new Date(eolPhase.startDate);
    const daysToEol = (eolDate - today) / (1000 * 60 * 60 * 24);
    if (daysToEol < 180) {  // Less than 6 months
      flags.push("eol_risk");
    }
  }

  // Check for missing owner (no user groups)
  const userGroups = data.relApplicationToUserGroup ?? [];
  if (userGroups.length === 0) {
    flags.push("no_owner");
  }

  // Check for no IT components
  const itcs = data.relApplicationToITComponent ?? [];
  if (itcs.length === 0) {
    flags.push("no_itc");
  }

  // Check for high cost
  const totalCost = itcs
    .map(r => r.factsheet?.annualCost ?? 0)
    .reduce((sum, cost) => sum + cost, 0);
  if (totalCost > 100000) {
    flags.push("high_cost");
  }

  // Check for deprecated tech
  const hasDeprecated = itcs.some(
    r => r.factsheet?.lifecycle?.phaseName === "endOfLife"
  );
  if (hasDeprecated) {
    flags.push("deprecated_tech");
  }

  return flags.length > 0 ? flags : null;
}
