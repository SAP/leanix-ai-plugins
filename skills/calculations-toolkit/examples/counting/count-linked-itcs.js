/**
 * Count Linked IT Components
 *
 * Fact Sheet Type: Application
 * Target Field: itcCount (Integer)
 * Logic: Returns the total count of linked IT components
 */

export function main() {
  const relations = data.relApplicationToITComponent ?? [];
  return relations.length;
}
