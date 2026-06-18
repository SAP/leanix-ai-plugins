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

5. **⚠️ Extend the LeanIX MCP toolsets in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) — REQUIRED if your skill calls a toolset not already in the URL.** If you skip this, plugin users will install the skill, invoke it, and silently get errors because the tools they need are not exposed by the MCP server.

   **What to do:**
   - Open the `sap-leanix` plugin entry in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) and look at the `?toolsets=` query parameter on the `mcpServers.leanix.url`. Today it lists `inventory,automations,calculations,custom_reports`.
   - Identify which LeanIX MCP toolsets your skill calls (see the authoritative list in [`MCP-SETUP.md`](MCP-SETUP.md) §Toolsets, or the [LeanIX MCP server source](https://github.com/leanix/mcp-server/blob/main/mcp_server/core/types/toolset_types.py)).
   - Append any missing toolsets to the URL. Example: a discovery-inbox skill changes `?toolsets=inventory,automations,calculations,custom_reports` → `?toolsets=inventory,automations,calculations,custom_reports,discovery_inbox`.

   **Why this is required, not optional:**
   - The LeanIX MCP server returns its 8 *default* toolsets when no `?toolsets=` param is set (e.g. `inventory`, `roadmap_planning`, `architecture_decisions`, …). The 7 *optional* toolsets (`automations`, `integrations`, `rba_rsa`, `discovery_inbox`, `structural_search`, `calculations`, `catalogs`) are hidden by default and must be opted in.
   - When ANY `?toolsets=` is specified, the server returns ONLY the listed toolsets — defaults are no longer auto-included. So once we set the param, we must list everything we want.
   - The server enforces a **max of 10 toolsets per request**. There are 15 total, so we cannot bundle everything up front — we expand as skills are added.
   - This applies whether the toolset is a default or optional one — once the URL declares any toolset list, the listed set is what users get.

   **Why inline (not a path)?** The marketplace spec accepts `mcpServers` as either a string path or an inline object, but the string-path form (`"mcpServers": "./.mcp.json"`) does not register the server at install time — verified empirically. The inline object form is the only working pattern under `strict: false`.

6. **⚠️ Include the auth-check line in `SKILL.md`** — REQUIRED if your skill calls any `mcp__leanix__*` tool. Copy this exact line into the SKILL body (in or near the API access section):

   > Before any LeanIX tool call: if only `mcp__leanix__authenticate` and `mcp__leanix__complete_authentication` are available, tell the user to run `/mcp` and authenticate the `leanix` server (browser opens automatically). Do NOT call `authenticate` yourself or suggest `claude mcp add` — the former returns a URL without triggering the browser flow (copy-paste UX), the latter would shadow the plugin's bundled server. If `/mcp` doesn't surface tools after auth, treat it as a plugin bug.

   **Why:** the LeanIX MCP server exposes `authenticate` / `complete_authentication` as agent-callable tools alongside the standard OAuth metadata. Without this guidance, the agent picks the tool path on the first call (when only those two tools are visible pre-auth), the tool returns an OAuth URL string, and the agent surfaces it as plain text — bypassing Claude Code's standard `/mcp` browser-popup flow. Functional but bad UX.

7. **Update README.md** — add a row to the Available Skills table; document any setup the skill requires beyond the bundled LeanIX MCP server (extra credentials, external services, etc.).

8. **Validate** — `claude plugin validate .` passes, and the plugin successfully installs and runs the skill in Claude Code.

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
