/**
 * Field Completeness Percentage
 *
 * Fact Sheet Type: Application
 * Target Field: completenessScore (Double)
 * Logic: Calculates percentage of required fields that are filled
 *
 * Returns 0-100 representing percentage complete.
 *
 * Configuration:
 *   - REQUIRED_FIELDS: Array of field paths to check
 */

export function main() {
  // Define required fields with weights (optional)
  const REQUIRED_FIELDS = [
    { path: "description", weight: 1 },
    { path: "businessCriticality", weight: 2 },
    { path: "technicalFit", weight: 1 },
    { path: "functionalFit", weight: 1 },
    { path: "lifecycle.phaseName", weight: 2 },
  ];

  let totalWeight = 0;
  let filledWeight = 0;

  for (const field of REQUIRED_FIELDS) {
    totalWeight += field.weight;

    // Navigate path (supports nested like "lifecycle.phaseName")
    const parts = field.path.split(".");
    let value = data;
    for (const part of parts) {
      value = value?.[part];
    }

    // Check if filled
    if (value != null && value !== "") {
      filledWeight += field.weight;
    }
  }

  if (totalWeight === 0) {
    return 100;  // No required fields defined
  }

  return Math.round((filledWeight / totalWeight) * 100);
}
