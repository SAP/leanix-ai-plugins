/**
 * Count Active Relations
 *
 * Fact Sheet Type: Application
 * Target Field: activeItcCount (Integer)
 * Logic: Counts IT components in active lifecycle phase
 *
 * Configuration:
 *   - RELATION_NAME: Change to your relation
 *   - TARGET_PHASE: Change to desired lifecycle phase
 */

export function main() {
  const RELATION_NAME = "relApplicationToITComponent";
  const TARGET_PHASE = "active";

  const relations = data[RELATION_NAME] ?? [];

  const activeCount = relations.filter(
    r => r.factsheet?.lifecycle?.phaseName === TARGET_PHASE
  ).length;

  return activeCount;
}
