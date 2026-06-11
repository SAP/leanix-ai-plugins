/**
 * Count with Threshold Category
 *
 * Fact Sheet Type: Application
 * Target Field: itcVolume (Single Select)
 * Logic: Returns category based on ITC count thresholds
 *
 * Target field options: "none", "low", "medium", "high"
 *
 * Configuration:
 *   - Adjust threshold values as needed
 */

export function main() {
  const LOW_THRESHOLD = 3;
  const MEDIUM_THRESHOLD = 10;
  const HIGH_THRESHOLD = 20;

  const relations = data.relApplicationToITComponent ?? [];
  const count = relations.length;

  if (count === 0) return "none";
  if (count < LOW_THRESHOLD) return "low";
  if (count < MEDIUM_THRESHOLD) return "medium";
  return "high";
}
