/**
 * Auto-Generated ID
 *
 * Fact Sheet Type: Application
 * Target Field: externalId (External ID)
 * Logic: Creates a prefixed ID from the fact sheet's UUID
 *
 * Example output: "APP-a1b2c3d4"
 *
 * Configuration:
 *   - PREFIX: Change to your desired prefix
 *   - ID_LENGTH: Number of characters from UUID to include
 */

export function main() {
  const PREFIX = "APP";
  const ID_LENGTH = 8;

  if (!data.id) {
    return null;
  }

  // Remove dashes and take first N characters
  const shortId = data.id.replace(/-/g, "").slice(0, ID_LENGTH);

  return `${PREFIX}-${shortId}`;
}
