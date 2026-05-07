/**
 * Basic Tag Addition
 *
 * Trigger: Fact Sheet Created/Updated
 * Logic: Adds "HELLO_WORLD" tag if not present
 */

export function main() {
  const TAG = "HELLO_WORLD";
  if (!data.factSheet.tags?.includes(TAG)) {
    return { tags: [...(data.factSheet.tags ?? []), TAG] };
  }
  return {};
}
