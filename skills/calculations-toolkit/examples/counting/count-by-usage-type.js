/**
 * Count by Usage Type
 *
 * Fact Sheet Type: Application
 * Target Field: usedItcCount (Integer)
 * Logic: Counts IT components where usageType is "used"
 *
 * Configuration:
 *   - TARGET_USAGE_TYPE: Change to desired usage type value
 */

export function main() {
  const TARGET_USAGE_TYPE = "used";

  const relations = data.relApplicationToITComponent ?? [];

  const count = relations.filter(
    r => r.usageType === TARGET_USAGE_TYPE
  ).length;

  return count;
}
