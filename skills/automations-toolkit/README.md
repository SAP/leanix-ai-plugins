# automations-toolkit

An [Agent Skill](https://agentskills.io) that builds, debugs, and deploys LeanIX automation scripts. Covers trigger configuration, script templates, API deployment via MCP, error patterns, and multi-automation strategies.

## Prerequisites

This skill calls the [LeanIX MCP Server](https://help.sap.com/docs/leanix/ea/mcp-server).

- **Claude Code users:** the MCP server is bundled with the `sap-leanix` plugin. Install the plugin and Claude Code triggers the OAuth sign-in flow on first connection — no manual setup required.
- **Other agents or advanced setups (Cursor, Codex, Gemini CLI, technical user / API token, etc.):** see [`MCP-SETUP.md`](../../MCP-SETUP.md) at the repo root for the full setup walkthrough.

## Installation

Install via the Claude Code plugin marketplace (see [repo README](../../README.md#requirements-and-setup)), or point any [Agent Skills](https://agentskills.io/clients)-compatible agent at this directory.

## Contents

| Path | Purpose |
|------|---------|
| `SKILL.md` | Main skill file (entry point) |
| `references/` | API docs, templates, model info, naming conventions |
| `examples/` | 29 production-tested automation scripts by category |
