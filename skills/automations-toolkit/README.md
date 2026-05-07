# automations-toolkit

An [Agent Skill](https://agentskills.io) that builds, debugs, and deploys LeanIX automation scripts. Covers trigger configuration, script templates, API deployment via MCP, error patterns, and multi-automation strategies.

## Prerequisites

The [LeanIX MCP Server](https://github.com/SAP/leanix-mcp) must be configured so your agent can call LeanIX tools. See [`assets/MCP-SETUP.md`](assets/MCP-SETUP.md) for configuration details and [`assets/.mcp.json.example`](assets/.mcp.json.example) for a starter config.

## Installation

### Claude Code

```bash
claude skill add --from ./skills/automations-toolkit
```

Or add the directory directly:

```bash
claude --add-dir skills/automations-toolkit
```

Invoke with `/automations-toolkit` in the prompt.

### Cursor

Add to `.cursor/skills/` or reference via your project's AI configuration. The `SKILL.md` file is the entry point.

### GitHub Copilot / VS Code

Reference the skill directory in your `.github/copilot-instructions.md` or workspace settings.

### OpenAI Codex

Point Codex at the `SKILL.md` file as a context document.

### Gemini CLI

```bash
gemini --skill skills/automations-toolkit
```

### Other Agents

Any agent supporting the [Agent Skills standard](https://agentskills.io/clients) can load `SKILL.md` as its entry point. The `references/` directory contains supporting documentation loaded on demand.

## Contents

| Path | Purpose |
|------|---------|
| `SKILL.md` | Main skill file (entry point) |
| `references/` | API docs, templates, model info, naming conventions |
| `assets/` | MCP setup guide and example config |
| `examples/` | 29 production-tested automation scripts by category |
