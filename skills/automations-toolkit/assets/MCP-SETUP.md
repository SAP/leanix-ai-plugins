# LeanIX MCP Server Setup Guide

SAP LeanIX provides an official MCP (Model Context Protocol) server for AI-assisted development.

## Table of Contents

- [Overview](#overview)
- [MCP Server URL](#mcp-server-url)
- [Authentication Options](#authentication-options)
- [Claude Desktop Configuration](#claude-desktop-configuration)
- [Claude Code Configuration (Dynamic Credentials)](#claude-code-configuration-dynamic-credentials)
- [Claude Code Configuration (Static Credentials)](#claude-code-configuration-static-credentials)
- [Available MCP Tools](#available-mcp-tools)
- [Toolsets (Optional Filtering)](#toolsets-optional-filtering)
- [Troubleshooting](#troubleshooting)
- [Security Recommendations](#security-recommendations)

---

## Overview

The LeanIX MCP Server enables Claude to:
- Fetch your workspace's data model (fact sheet types, fields, relations)
- Retrieve tags with their IDs
- List subscription roles
- Search users
- Query fact sheets directly

When configured, the LeanIX skill can automatically discover your workspace configuration instead of requiring manual questions.

---

## MCP Server URL

```
https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp
```

Replace `{SUBDOMAIN}` with your LeanIX instance (e.g., `your-instance`, `my-company`).

---

## Authentication Options

The MCP Server supports three authentication methods:

| Method | Header Format | Use Case |
|--------|---------------|----------|
| **API Token** | `Authorization: Token YOUR-API-TOKEN` | Simplest for development |
| **Basic Auth** | `Authorization: Basic BASE64(apitoken:YOUR-API-TOKEN)` | Alternative format |
| **Bearer Token** | `Authorization: Bearer YOUR-JWT` | OAuth2 access token |

### Creating an API Token

1. Log in to LeanIX
2. Navigate to **Administration** > **API Tokens** (or **Technical Users**)
3. Create a new token with appropriate permissions
4. Copy the token (format: `LXT_xxxxxxxx...`)

---

## Claude Desktop Configuration

Add this to your Claude Desktop configuration file:

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
        "https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp",
        "--header",
        "Authorization: Token {YOUR-API-TOKEN}"
      ]
    }
  }
}
```

### Example Configuration

```json
{
  "mcpServers": {
    "leanix": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-instance.leanix.net/services/mcp-server/v1/mcp",
        "--header",
        "Authorization: Token LXT_abc123def456..."
      ]
    }
  }
}
```

---

## Claude Code Configuration (Dynamic Credentials)

For Claude Code CLI with **interchangeable credentials** (switch between workspaces), use environment variables in `.mcp.json`:

```json
{
  "mcpServers": {
    "leanix": {
      "type": "http",
      "url": "https://${LEANIX_SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp",
      "headers": {
        "Authorization": "Token ${LEANIX_API_TOKEN}"
      }
    }
  }
}
```

### Usage

Set environment variables before starting Claude Code:

```bash
# Set credentials
export LEANIX_SUBDOMAIN="your-instance"
export LEANIX_API_TOKEN="LXT_your_token_here"

# Start Claude Code
claude
```

Or inline:

```bash
LEANIX_SUBDOMAIN="your-instance" LEANIX_API_TOKEN="LXT_xxx" claude
```

### Verification

1. Run `/mcp` to verify the LeanIX server is connected
2. Test by calling `ListMcpResourcesTool` with server "leanix"

### Switching Workspaces

Simply set different environment variables and restart Claude Code:

```bash
export LEANIX_SUBDOMAIN="production-instance"
export LEANIX_API_TOKEN="LXT_different_token"
claude
```

---

## Claude Code Configuration (Static Credentials)

If you always use the same workspace, you can use the npx approach:

```json
{
  "mcpServers": {
    "leanix": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp",
        "--header",
        "Authorization: Token {YOUR-API-TOKEN}"
      ]
    }
  }
}
```

**Note:** This stores credentials in the config file - do not commit to version control.

---

## Available MCP Tools

When connected, these tools become available (exact names may vary):

| Tool | Purpose |
|------|---------|
| `get_data_model` | Fetch fact sheet types, fields, and relations |
| `list_tags` | Get all tags with IDs and tag groups |
| `list_subscription_roles` | Get role definitions |
| `search_users` | Find users by name or email |
| `get_fact_sheet` | Retrieve specific fact sheet data |
| `search_fact_sheets` | Query fact sheets with filters |

**Tip:** Use `ListMcpResourcesTool` with server `"leanix"` to discover exact tool names and capabilities.

---

## Toolsets (Optional Filtering)

The MCP server supports filtering which tools are available via the `toolsets` query parameter. This limits the LLM context window for improved efficiency.

### Available Toolsets

| Toolset | Description |
|---------|-------------|
| `inventory` | Get fact sheet information |
| `report_diagrams` | Get report information |
| `roadmap_planning` | Get initiatives and transformation information |
| `surveys` | Create or get survey information |
| `architecture_decisions` | Create or get architecture decision information |
| `self_built_software` | Tech stack management discovery |

### Using Toolsets

Append to the URL in `.mcp.json`:

```json
{
  "mcpServers": {
    "leanix": {
      "type": "http",
      "url": "https://${LEANIX_SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory",
      "headers": {
        "Authorization": "Token ${LEANIX_API_TOKEN}"
      }
    }
  }
}
```

Multiple toolsets (comma-separated):
```
?toolsets=inventory,surveys,architecture_decisions
```

**Limits:** Max 10 toolsets per query, max 50 chars per toolset name.

---

## Troubleshooting

### "Connection refused" or timeout

- Verify your instance subdomain is correct
- Check if your network allows outbound HTTPS to `*.leanix.net`
- Ensure the MCP Server service is available in your LeanIX edition

### "401 Unauthorized"

- Verify your API token is correct and not expired
- Check that the token has appropriate permissions
- Try regenerating the API token

### "403 Forbidden"

- Your user/token may lack permissions for certain operations
- Contact your LeanIX administrator

### MCP tools not appearing

- Restart Claude Desktop after configuration changes
- Check the configuration file syntax (valid JSON)
- Verify `mcp-remote` is installed: `npx -y mcp-remote --version`

---

## Security Recommendations

1. **Use read-only tokens** for development when possible
2. **Create dedicated technical users** for automation development
3. **Rotate tokens regularly**
4. **Never commit tokens** to version control
5. **Use environment variables** for tokens in MCP configuration:
   ```bash
   export LEANIX_SUBDOMAIN="your-instance"
   export LEANIX_API_TOKEN="LXT_xxx..."
   ```

---
