# Contributing

## Code of Conduct

All members of the project community must abide by the [SAP Open Source Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md).
Only by respecting each other we can develop a productive, collaborative community.
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting [a project maintainer](REUSE.toml).

## Contributions

Currently we only accept internal contributions from the SAP Leanix team.

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

`marketplace.json` declares plugins and maps them to skills:

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
      "name": "plugin-name",
      "description": "What this plugin does.",
      "source": "./",
      "strict": false,
      "skills": ["./skills/skill-name"]
    }
  ]
}
```

Each plugin entry in `plugins[]` groups related skills under a single installable unit.

## Adding a New Skill

1. **Create the skill directory:**

   ```
   mkdir -p skills/<skill-name>/{references,examples,assets}
   ```

2. **Write `SKILL.md`** with proper frontmatter (see the [spec](https://agentskills.io/specification)). Start with the core instructions, move detail to `references/`.

3. **Add examples** that demonstrate realistic usage. Organize into subdirectories by category if there are more than a handful.

4. **Register in `marketplace.json`** — either add to an existing plugin's `skills` array or create a new plugin entry.

5. **Update README.md** if the skill requires additional setup (MCP servers, credentials, etc.).

6. **Validate** — the plugin is successfully installed and tested with Claude Code

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
