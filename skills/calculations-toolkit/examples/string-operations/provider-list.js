/**
 * Provider List
 *
 * Fact Sheet Type: Application
 * Target Field: providerList (String)
 * Logic: Creates comma-separated list of linked provider names
 *
 * Example output: "Microsoft, Oracle, SAP"
 */

export function main() {
  const relations = data.relApplicationToProvider ?? [];

  if (relations.length === 0) {
    return null;
  }

  const names = relations
    .map(r => r.factsheet?.name)
    .filter(Boolean)
    .sort();

  if (names.length === 0) {
    return null;
  }

  return names.join(", ");
}
