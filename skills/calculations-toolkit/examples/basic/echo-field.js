/**
 * Echo Field Value
 *
 * Fact Sheet Type: Application
 * Target Field: echoedValue (String)
 * Logic: Copies value from another field with formatting
 *
 * Configuration:
 *   - SOURCE_FIELD: Change to your source field name
 */

export function main() {
  const SOURCE_FIELD = "businessCriticality";

  const value = data[SOURCE_FIELD];

  if (!value) {
    return null;
  }

  return `Value: ${value}`;
}
