# Contributing

## Code of Conduct

All members of the project community must abide by the [SAP Open Source Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md).
Only by respecting each other we can develop a productive, collaborative community.
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting [a project maintainer](REUSE.toml).

## Contributions

Currently we only accept internal contributions from the SAP LeanIX team.

## How to Participate

- **Report issues** — found a bug, unclear instruction, or missing edge case in a skill? Open a GitHub issue.
- **Fork and extend** — you're welcome to fork this repository and build your own skills on top of it.

## Repository Structure

```
leanix-ai-plugins/
├── .claude-plugin/
│   └── marketplace.json      # Plugin registry — lists all plugins and their skills
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md           # Skill definition (frontmatter + instructions)
│       ├── references/        # Detailed reference docs loaded on demand
│       ├── assets/            # Static assets (setup guides, images)
│       └── examples/          # Categorized example scripts/configs
├── CONTRIBUTING.md            # Public-facing contribution guide
├── README.md                  # Installation and usage
├── LICENSE                    # Apache 2.0
└── REUSE.toml                 # License metadata
```

## Agent Skills Standard

We follow the [Agent Skills specification](https://agentskills.io/specification). For guidance on writing effective skill instructions, see the [best practices guide](https://agentskills.io/skill-creation/best-practices). Key points:

- A **skill** is a single `SKILL.md` file with YAML frontmatter and Markdown body.
- A **plugin** bundles one or more skills and is declared in `marketplace.json`.
- Skills are portable across agents (Claude Code, Cursor, Windsurf, etc.).

The spec covers all `SKILL.md` frontmatter fields and requirements; the best practices guide covers writing effective instructions.

## How Plugins Bundle Skills

This marketplace ships **one plugin (`sap-leanix`)** that bundles every skill in this repo. New skills are added to the same plugin's `skills` array — we do not create a new plugin per skill.

`marketplace.json` looks like this:

```json
{
  "name": "leanix-ai-plugins",
  "owner": { "name": "SAP LeanIX" },
  "metadata": {
    "description": "Agent Skills for SAP LeanIX...",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "sap-leanix",
      "description": "Agent Skills for SAP LeanIX...",
      "source": "./",
      "strict": false,
      "skills": [
        "./skills/automations-toolkit"
        // additional skills go here
      ]
    }
  ]
}
```

Inside Claude Code, each skill is invoked as `sap-leanix:<skill-name>`.

## Adding a New Skill

1. **Create the skill directory:**

   ```
   mkdir -p skills/<skill-name>/{references,examples,assets}
   ```

2. **Write `SKILL.md`** with proper frontmatter (see the [spec](https://agentskills.io/specification)). Start with the core instructions, move detail to `references/`.

3. **Add examples** that demonstrate realistic usage. Organize into subdirectories by category if there are more than a handful.

4. **Register in `marketplace.json`** — append `"./skills/<skill-name>"` to the `sap-leanix` plugin's `skills` array. Do not create a separate plugin entry.

5. **Update README.md** — add a row to the Available Skills table; document any setup the skill requires (MCP servers, credentials, etc.).

6. **Validate** — `claude plugin validate .` passes, and the plugin successfully installs and runs the skill in Claude Code.

## Releases and Versioning

This marketplace intentionally **does not pin a `version`** on plugin entries in [`marketplace.json`](.claude-plugin/marketplace.json). With no pinned version, Claude Code falls back to the git commit SHA, which means **every commit to `main` is treated as a new version** and reaches users on the next `/plugin marketplace update` (or auto-update). No manual bumping required.

If you ever add a `version` field (either to a plugin entry in `marketplace.json` or to a `plugin.json`), you **must bump it on every release** — otherwise users keep their cached copy and never see your changes. See the [version resolution rules](https://code.claude.com/docs/en/plugin-marketplaces#version-resolution-and-release-channels). The top-level `metadata.version` is the marketplace manifest version (informational) and is separate from per-plugin versions.

## Branching and Pull Requests

- Branch from `main`. Use descriptive branch names: `add-skill-<name>`, `fix-<skill>-<issue>`, `improve-<skill>-<what>`.
- Keep PRs focused — one skill or one logical change per PR.
- PR title should describe the change concisely (e.g., "Add inventory-sync skill", "Fix template error in automations-toolkit").
- PR description should include:
  - What the skill/change does
  - Example invocation showing it in action
  - Any setup requirements or breaking changes

## Legal

**License.** All content in this repository is licensed under the [Apache 2.0 License](./LICENSE).

**Developer Certificate of Origin (DCO).** Contributors are asked to accept the DCO. SAP uses [the standard DCO text of the Linux Foundation](https://developercertificate.org/).

**AI-generated content.** Contributions that were created with AI assistance must follow the [SAP guidelines on AI-generated code](https://github.com/SAP/.github/blob/main/CONTRIBUTING_USING_GENAI.md).
