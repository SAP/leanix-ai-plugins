/**
 * Data Validation with Abort Logic
 *
 * Trigger: Fact Sheet Created/Updated
 * Logic: Validates critical data, aborts if missing required fields, adds validation tag if passed
 */

export function main() {
  const fs = data.factSheet;
  const VALIDATED_TAG = "DATA_VALIDATED";

  if (!fs.name?.trim()) {
    throw new Error("ABORT AUTOMATION RUN - Missing fact sheet name");
  }

  if (fs.type === "Application") {
    if (!fs.lifecycle) throw new Error("ABORT AUTOMATION RUN - Missing lifecycle for Application");
    if (!fs.businessCriticality) throw new Error("ABORT AUTOMATION RUN - Missing businessCriticality for Application");
  }

  const prohibited = ["DEPRECATED", "DO_NOT_USE", "BLOCKED"];
  if (fs.tags?.some(tag => prohibited.includes(tag))) {
    throw new Error("ABORT AUTOMATION RUN - Fact sheet has prohibited tags");
  }

  // Idempotency: Check if already validated
  if (fs.tags?.includes(VALIDATED_TAG)) {
    return {};
  }

  // Use marker blocks for description updates (idempotent)
  const startMarker = "<!-- AUTO:VALIDATION:START -->";
  const endMarker = "<!-- AUTO:VALIDATION:END -->";
  const newBlock = `${startMarker}\nValidated: ${new Date().toISOString()}\n${endMarker}`;

  let description = fs.description || "";
  const startIdx = description.indexOf(startMarker);
  const endIdx = description.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing block
    description = description.slice(0, startIdx) + newBlock + description.slice(endIdx + endMarker.length);
  } else {
    // Append new block
    description = description + (description ? "\n\n" : "") + newBlock;
  }

  return {
    tags: [...(fs.tags ?? []), VALIDATED_TAG],
    description,
  };
}
