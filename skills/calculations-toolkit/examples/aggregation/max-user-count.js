/**
 * Maximum User Count
 *
 * Fact Sheet Type: Application
 * Target Field: maxUserGroupSize (Integer)
 * Logic: Returns the largest userCount from linked user groups
 *
 * Configuration:
 *   - USER_COUNT_FIELD: Field name containing user count
 */

export function main() {
  const USER_COUNT_FIELD = "userCount";

  const relations = data.relApplicationToUserGroup ?? [];

  if (relations.length === 0) {
    return null;
  }

  const counts = relations
    .map(r => r.factsheet?.[USER_COUNT_FIELD])
    .filter(c => typeof c === "number");

  if (counts.length === 0) {
    return null;
  }

  return Math.max(...counts);
}
