/**
 * Simple Relation Count
 *
 * Fact Sheet Type: Application
 * Target Field: relationCount (Integer)
 * Logic: Counts the number of related fact sheets
 *
 * Configuration:
 *   - RELATION_NAME: Change to your relation name
 */

export function main() {
  const RELATION_NAME = "relApplicationToITComponent";

  const relations = data[RELATION_NAME] ?? [];
  return relations.length;
}
