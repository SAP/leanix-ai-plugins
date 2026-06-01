# automations-toolkit

An [Agent Skill](https://agentskills.io) that builds, debugs, and deploys LeanIX automation scripts. Covers trigger configuration, script templates, API deployment via MCP, error patterns, and multi-automation strategies.

## Prerequisites

The [LeanIX MCP Server](https://help.sap.com/docs/leanix/ea/mcp-server) must be configured so your agent can call LeanIX tools. See [`assets/MCP-SETUP.md`](assets/MCP-SETUP.md) for configuration details, or copy [`assets/.mcp.json`](assets/.mcp.json) into your project as a drop-in OAuth config (no secrets — Claude Code triggers the sign-in flow on first connection).

## Installation

Install via the Claude Code plugin marketplace (see [repo README](../../README.md#requirements-and-setup)), or point any [Agent Skills](https://agentskills.io/clients)-compatible agent at this directory.

## Contents

| Path | Purpose |
|------|---------|
| `SKILL.md` | Main skill file (entry point) |
| `references/` | API docs, templates, model info, naming conventions |
| `assets/` | MCP setup guide and example config |
| `examples/` | 29 production-tested automation scripts by category |
