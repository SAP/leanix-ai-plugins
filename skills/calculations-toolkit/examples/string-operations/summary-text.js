/**
 * Summary Text
 *
 * Fact Sheet Type: Application
 * Target Field: summary (String)
 * Logic: Generates a summary from multiple fields
 *
 * Example output: "Business Critical application in Active phase with 5 IT components"
 */

export function main() {
  const criticality = data.businessCriticality ?? "Unknown criticality";
  const phase = data.lifecycle?.phaseName ?? "unknown";
  const itcCount = (data.relApplicationToITComponent ?? []).length;

  // Format criticality for display
  const criticalityMap = {
    missionCritical: "Mission Critical",
    businessCritical: "Business Critical",
    businessOperational: "Business Operational",
    administrativeService: "Administrative Service",
  };
  const displayCriticality = criticalityMap[criticality] ?? criticality;

  // Format phase for display
  const phaseMap = {
    plan: "Plan",
    phaseIn: "Phase In",
    active: "Active",
    phaseOut: "Phase Out",
    endOfLife: "End of Life",
  };
  const displayPhase = phaseMap[phase] ?? phase;

  return `${displayCriticality} application in ${displayPhase} phase with ${itcCount} IT component${itcCount !== 1 ? 's' : ''}`;
}
