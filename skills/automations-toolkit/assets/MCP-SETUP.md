# LeanIX MCP Server Setup Guide

SAP LeanIX provides an official MCP (Model Context Protocol) server that exposes enterprise architecture APIs as discoverable tools for AI applications.

## Table of Contents

- [Overview](#overview)
- [Admin Configuration](#admin-configuration)
- [Authentication Methods](#authentication-methods)
- [Client Configuration](#client-configuration)
- [Toolsets](#toolsets)
- [Troubleshooting](#troubleshooting)

---

## Overview

The LeanIX MCP Server enables AI clients to securely access enterprise architecture data. It exposes selected LeanIX APIs as structured tools that AI applications can discover and invoke.

The MCP server is **enabled by default** for all SAP LeanIX Application Portfolio Management customers. Available tools depend on the authenticated user's permissions — the server returns only tools the user can access.

> **Important:** Activate Base AI Capabilities in your workspace for full MCP precision. Without it, response quality is significantly reduced.

---

## Admin Configuration

Administrators control MCP access in the SAP LeanIX Administration section.

---

## Authentication Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| **OAuth (User-Based)** | `https://mcp.leanix.net/services/mcp-server/v1/mcp` | Recommended for individual users. OAuth 2.0 flow via browser. Expires in 24 hours. |
| **Technical User (API Token)** | `https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp` | For automated workflows and non-interactive access. Uses API token. |

> **Note:** OAuth and Technical User auth use **different endpoints**. OAuth uses `mcp.leanix.net` (no subdomain). Technical users use `{SUBDOMAIN}.leanix.net`.

### OAuth (Recommended for Users)

Users authenticate through a standard OAuth 2.0 flow — prompted to sign in via browser. No credentials are passed directly in the request header.

Re-authenticate when your 24-hour session expires.

### Technical User (API Token)

Technical users authenticate using an API token. Create one at **Administration > Technical Users**.

Two header formats are supported:

| Format | Header |
|--------|--------|
| **API Token** (simplest) | `Authorization: Token {YOUR-API-TOKEN}` |
| **Bearer Token** (JWT) | `Authorization: Bearer {YOUR-JWT}` |

---

## Client Configuration

> **Note:** For automation development, append `?toolsets=inventory,automations` to the URL in all configurations below. Without this, automation tools won't be available.

### Claude Code — OAuth (Simplest)

One command, no tokens needed:

```bash
claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations"
```

You'll be prompted to sign in via your browser. Re-authenticate every 24 hours.

### Claude Code — Technical User (Dynamic Credentials)

For switching between workspaces using environment variables. Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "leanix": {
      "type": "http",
      "url": "https://${LEANIX_SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations",
      "headers": {
        "Authorization": "Token ${LEANIX_API_TOKEN}"
      }
    }
  }
}
```

Set environment variables before starting Claude Code:

```bash
export LEANIX_SUBDOMAIN="your-instance"
export LEANIX_API_TOKEN="LXT_your_token_here"
claude
```

Switch workspaces by changing the environment variables and restarting.

### Claude Desktop — Technical User

Requires `npx` installed. Add to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "leanix": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations",
        "--header",
        "Authorization: Token {YOUR-API-TOKEN}"
      ]
    }
  }
}
```

### Cline

```json
{
  "mcpServers": {
    "leanix": {
      "type": "streamableHttp",
      "url": "https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations",
      "headers": {
        "Authorization": "Token {YOUR-API-TOKEN}"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "leanix": {
      "transport": "streamableHttp",
      "url": "https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations",
      "headers": {
        "Authorization": "Token {YOUR-API-TOKEN}"
      }
    }
  }
}
```

---

## Toolsets

The `automations` toolset is **hidden by default** and must be explicitly activated via the `?toolsets=` query parameter.

> **Important for automation development:** Without `?toolsets=automations`, tools like `list_automations`, `create_automation`, `get_automation_script` won't be available.

Append `?toolsets=` to the MCP server URL:

```
?toolsets=inventory,automations
```

When `?toolsets=` is specified, **only** the listed toolsets are returned (default toolsets are no longer included automatically unless listed).

---

## Troubleshooting

### MCP tools not appearing

- Verify `?toolsets=inventory,automations` is included in the URL
- For Claude Code (OAuth): re-run `claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations"`
- Restart Claude Desktop after configuration changes
- Check the configuration file syntax (valid JSON)
- Verify `mcp-remote` is installed: `npx -y mcp-remote --version`
- Your role may not have permissions for the expected tools

### Automation tools specifically missing

- The `automations` toolset is **optional** — it's hidden unless explicitly requested
- Ensure the URL includes `?toolsets=automations` (or `?toolsets=inventory,automations`)
- When `?toolsets=` is specified, only listed toolsets are returned — add all toolsets you need

---

*Reference: [SAP LeanIX MCP Server Documentation](https://help.sap.com/docs/leanix/ea/mcp-server)*
