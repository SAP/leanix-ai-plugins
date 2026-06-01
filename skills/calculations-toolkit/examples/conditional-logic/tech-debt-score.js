/**
 * Technical Debt Score
 *
 * Fact Sheet Type: Application
 * Target Field: techDebtScore (Double)
 * Logic: Calculates weighted technical debt score (0-100)
 *
 * Weights:
 *   - Age factor: 30%
 *   - Complexity: 25%
 *   - Documentation: 25%
 *   - Obsolescence: 20%
 */

export function main() {
  const WEIGHTS = {
    age: 0.30,
    complexity: 0.25,
    documentation: 0.25,
    obsolescence: 0.20,
  };

  // Factor 1: Age score (0-100)
  let ageScore = 0;
  if (data.createdAt) {
    const years = (Date.now() - new Date(data.createdAt)) / (1000 * 60 * 60 * 24 * 365);
    ageScore = Math.min(years * 10, 100);  // 10+ years = max score
  }

  // Factor 2: Complexity score (0-100)
  const complexityMap = {
    low: 20,
    medium: 50,
    high: 80,
    critical: 100,
  };
  const complexityScore = complexityMap[data.complexity] ?? 50;

  // Factor 3: Documentation score (0-100, inverse)
  let docScore = 70;  // Default: assume minimal docs
  const descLength = (data.description ?? "").length;
  if (descLength > 500) docScore = 10;
  else if (descLength > 200) docScore = 30;
  else if (descLength > 50) docScore = 50;

  // Factor 4: Obsolescence score (0-100)
  const itcs = data.relApplicationToITComponent ?? [];
  let obsScore = 0;
  if (itcs.length > 0) {
    const phaseOutOrEol = itcs.filter(r => {
      const phase = r.factsheet?.lifecycle?.phaseName;
      return phase === "phaseOut" || phase === "endOfLife";
    }).length;
    obsScore = (phaseOutOrEol / itcs.length) * 100;
  }

  // Weighted total
  const total = (
    ageScore * WEIGHTS.age +
    complexityScore * WEIGHTS.complexity +
    docScore * WEIGHTS.documentation +
    obsScore * WEIGHTS.obsolescence
  );

  return Math.round(total * 10) / 10;  // 1 decimal place
}
