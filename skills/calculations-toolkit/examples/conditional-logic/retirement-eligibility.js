/**
 * Retirement Eligibility
 *
 * Fact Sheet Type: Application
 * Target Field: retirementEligibility (Single Select)
 * Logic: Determines if application can be retired based on multiple factors
 *
 * Target field options: "eligible", "review", "not_eligible"
 *
 * Factors considered:
 *   - Lifecycle phase
 *   - User count
 *   - Business criticality
 *   - IT component dependencies
 */

export function main() {
  const lifecycle = data.lifecycle?.phaseName;
  const criticality = data.businessCriticality;
  const userGroups = data.relApplicationToUserGroup ?? [];
  const itcs = data.relApplicationToITComponent ?? [];

  const userCount = userGroups.length;
  const itcCount = itcs.length;

  // Already in end of life
  if (lifecycle === "endOfLife") {
    return "eligible";
  }

  // In phase out with no users and few ITCs
  if (lifecycle === "phaseOut" && userCount === 0 && itcCount <= 1) {
    return "eligible";
  }

  // Mission critical - never eligible
  if (criticality === "missionCritical") {
    return "not_eligible";
  }

  // Business critical with users - not eligible
  if (criticality === "businessCritical" && userCount > 0) {
    return "not_eligible";
  }

  // Administrative service with no users
  if (criticality === "administrativeService" && userCount === 0) {
    return "eligible";
  }

  // Low criticality, few users
  if (criticality === "administrativeService" && userCount <= 2) {
    return "review";
  }

  // Business operational - needs review
  if (criticality === "businessOperational") {
    return "review";
  }

  return "review";
}
