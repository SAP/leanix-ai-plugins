/**
 * Risk Level Calculation
 *
 * Fact Sheet Type: Application
 * Target Field: riskLevel (Single Select)
 * Logic: Calculates risk level based on multiple factors
 *
 * Target field options: "critical", "high", "medium", "low", "minimal"
 */

export function main() {
  let riskScore = 0;

  // Factor 1: Criticality (0-30 points)
  const criticality = data.businessCriticality;
  const criticalityScore = {
    missionCritical: 30,
    businessCritical: 20,
    businessOperational: 10,
    administrativeService: 5,
  };
  riskScore += criticalityScore[criticality] ?? 15;

  // Factor 2: Lifecycle phase (0-25 points)
  const phase = data.lifecycle?.phaseName;
  const phaseScore = {
    plan: 10,
    phaseIn: 5,
    active: 0,
    phaseOut: 15,
    endOfLife: 25,
  };
  riskScore += phaseScore[phase] ?? 10;

  // Factor 3: ITC obsolescence (0-25 points)
  const itcs = data.relApplicationToITComponent ?? [];
  const eolItcs = itcs.filter(
    r => r.factsheet?.lifecycle?.phaseName === "endOfLife"
  ).length;
  if (itcs.length > 0) {
    const eolRatio = eolItcs / itcs.length;
    riskScore += Math.round(eolRatio * 25);
  }

  // Factor 4: Documentation (0-20 points)
  const hasDescription = data.description && data.description.length > 50;
  if (!hasDescription) {
    riskScore += 20;
  }

  // Convert score to level
  if (riskScore >= 80) return "critical";
  if (riskScore >= 60) return "high";
  if (riskScore >= 40) return "medium";
  if (riskScore >= 20) return "low";
  return "minimal";
}
