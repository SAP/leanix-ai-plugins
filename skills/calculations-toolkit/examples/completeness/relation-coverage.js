/**
 * Relation Coverage Status
 *
 * Fact Sheet Type: Application
 * Target Field: relationCoverage (Single Select)
 * Logic: Checks if required relations are established
 *
 * Target field options: "complete", "partial", "incomplete"
 *
 * Configuration:
 *   - REQUIRED_RELATIONS: Array of relation names to check
 */

export function main() {
  // Define required relations
  const REQUIRED_RELATIONS = [
    "relApplicationToBusinessCapability",
    "relApplicationToITComponent",
    "relApplicationToUserGroup",
  ];

  const checks = REQUIRED_RELATIONS.map(relName => {
    const relations = data[relName] ?? [];
    return relations.length > 0;
  });

  const covered = checks.filter(Boolean).length;
  const total = checks.length;

  if (covered === total) {
    return "complete";
  }

  if (covered > 0) {
    return "partial";
  }

  return "incomplete";
}
