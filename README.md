[![REUSE status](https://api.reuse.software/badge/github.com/SAP/leanix-ai-plugins)](https://api.reuse.software/info/github.com/SAP/leanix-ai-plugins)

# leanix-ai-plugins

## About this project

A collection of [Agent Skills](https://agentskills.io) for SAP LeanIX — reusable, portable instructions that extend AI coding agents with LeanIX-specific workflows and domain knowledge. Skills work across a wide range of AI tools, including Claude Code, Cursor, GitHub Copilot, VS Code, OpenAI Codex, Gemini CLI, and [many others](https://agentskills.io/clients).

The skills in this repository are designed to work with the [LeanIX MCP Server](https://help.sap.com/docs/leanix/ea/mcp-server), which exposes LeanIX capabilities as tools that AI agents can call.

## Available Skills

All skills below ship inside the `sap-leanix` plugin. Installing the plugin makes every listed skill available; new skills are added by appending to the plugin's `skills` array — no separate installs.

| Skill | Description |
|-------|-------------|
| [automations-toolkit](skills/automations-toolkit/) | Build, debug, and deploy LeanIX automation scripts |

## Requirements and Setup

This repository is also a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces#create-and-distribute-a-plugin-marketplace). A **plugin** is a collection of one or more skills; this marketplace ships the `sap-leanix` plugin that bundles every LeanIX skill in this repo, along with the LeanIX MCP server config. Install via Claude Code:

```shell
/plugin marketplace add SAP/leanix-ai-plugins
/plugin install sap-leanix@leanix-ai-plugins
```

Inside Claude Code, each skill is invoked as `sap-leanix:<skill-name>` (for example, `sap-leanix:automations-toolkit`). The LeanIX MCP server connects automatically on first use — Claude Code triggers the OAuth sign-in flow.

For other agents (Cursor, Gemini CLI, Codex, etc.) or for advanced configurations (technical user / API token authentication), see [`MCP-SETUP.md`](MCP-SETUP.md) for the full LeanIX MCP server setup walkthrough.

Skills follow the [Agent Skills](https://agentskills.io) open standard. Consult your agent's documentation for how to load them:

- [Claude Code](https://code.claude.com/docs/en/skills)
- [Cursor](https://cursor.com/docs/context/skills)
- [GitHub Copilot / VS Code](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [OpenAI Codex](https://developers.openai.com/codex/skills/)
- [Gemini CLI](https://geminicli.com/docs/cli/skills/)
- [Other supported agents](https://agentskills.io/clients)

## Support, Feedback, Contributing

This project is open to feature requests, bug reports, and feedback via [GitHub issues](https://github.com/SAP/leanix-ai-plugins/issues). See our [Contribution Guidelines](CONTRIBUTING.md) for ways to participate.

## Security / Disclosure

If you find any bug that may be a security problem, please follow our instructions in our [security policy](https://github.com/SAP/leanix-ai-plugins/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2026 SAP SE or an SAP affiliate company and leanix-ai-plugins contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP/leanix-ai-plugins).
