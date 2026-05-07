/**
 * Conditional Lifecycle Update
 *
 * Trigger: Application Created/Updated
 * Logic: Sets default lifecycle if missing, adds review tag if EOL within 1 year
 */

export function main() {
  const fs = data.factSheet;
  if (fs.type !== "Application") return {};

  if (!fs.lifecycle) {
    return {
      lifecycle: {
        plan: "2024-01-01",
        phaseIn: "2024-04-01",
        active: "2024-07-01",
        phaseOut: "2026-01-01",
        endOfLife: "2026-12-31",
      },
    };
  }

  const eol = new Date(fs.lifecycle.endOfLife);
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (eol <= oneYearFromNow && !fs.tags?.includes("LIFECYCLE_REVIEW_NEEDED")) {
    return { tags: [...(fs.tags ?? []), "LIFECYCLE_REVIEW_NEEDED"] };
  }

  return {};
}
