# LeanIX MCP Server Setup Guide

SAP LeanIX provides an official MCP (Model Context Protocol) server that exposes enterprise architecture APIs as discoverable tools for AI applications.

## Table of Contents

- [Overview](#overview)
- [Admin Configuration](#admin-configuration)
- [Authentication Methods](#authentication-methods)
- [Client Configuration](#client-configuration)
- [Toolsets](#toolsets)
- [Discovering Available Tools](#discovering-available-tools)
- [Troubleshooting](#troubleshooting)
- [Security Recommendations](#security-recommendations)

---

## Overview

The LeanIX MCP Server enables AI clients to securely access enterprise architecture data. It exposes selected LeanIX APIs as structured tools that AI applications can discover and invoke.

The MCP server is **enabled by default** for all SAP LeanIX Application Portfolio Management customers. Available tools depend on the authenticated user's permissions — the server returns only tools the user can access.

> **Important:** Activate Base AI Capabilities in your workspace for full MCP precision. Without it, response quality is significantly reduced.

---

## Admin Configuration

Administrators control MCP access at **Administration > Integrations > MCP Server**:

- Enable/disable the MCP server entirely (enabled by default)
- Choose allowed authentication methods (both enabled by default):
  - **User-Based Authentication** (OAuth)
  - **Technical Users** (API tokens)

When disabled, the system rejects all connections regardless of authentication method.

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

Three header formats are supported:

| Format | Header |
|--------|--------|
| **API Token** (simplest) | `Authorization: Token {YOUR-API-TOKEN}` |
| **Basic Auth** | `Authorization: Basic BASE64(apitoken:{YOUR-API-TOKEN})` |
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

The MCP server organizes tools into **toolsets**. Some are visible by default; others must be explicitly activated via the `?toolsets=` query parameter.

### Default Toolsets (always visible)

These tools appear automatically without any `?toolsets=` parameter:

| Toolset | Description |
|---------|-------------|
| `inventory` | Get fact sheet information |
| `report_diagrams` | Get report information |
| `roadmap_planning` | Get initiatives and transformation information |
| `surveys` | Create or get survey information |
| `architecture_decisions` | Create or get architecture decision information |
| `self_built_software` | Tech stack management discovery |
| `custom_reports` | Custom report guide |

### Optional Toolsets (must be explicitly activated)

These tools are **hidden by default** and only appear when requested via `?toolsets=`:

| Toolset | Description |
|---------|-------------|
| `automations` | Create, read, update, delete automations and scripts |
| `discovery_inbox` | Discovery inbox items, linking, rejection |
| `integrations` | Sync log, Signavio configurations |
| `rba_rsa` | Reference business/solution architecture search |

> **Important for automation development:** The `automations` toolset must be explicitly activated to access tools like `list_automations`, `create_automation`, `get_automation_script`, etc.

### Usage

Append `?toolsets=` to the MCP server URL:

```
https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations
```

**For automation development**, include at minimum:
```
?toolsets=inventory,automations
```

**Full access for the `/leanix-automations` skill:**
```
?toolsets=inventory,automations,surveys
```

When `?toolsets=` is specified, **only** the listed toolsets are returned (default toolsets are no longer included automatically unless listed).

**Limits:** Max 10 toolsets per query, max 50 characters per toolset name.

---

## Discovering Available Tools

Available tools are **dynamic** — they depend on the permissions of the authenticated user or the role associated with an API token. The MCP server returns only tools the user can access.

To discover what tools are available after connecting:

1. Run `/mcp` in Claude Code to verify the LeanIX server is connected
2. Use `ListMcpResourcesTool` with server `"leanix"` to see exact tool names
3. Ask Claude: "What LeanIX MCP tools are available?"

If a user's role changes, available tools update accordingly.

### Tool Categories

The MCP server exposes tools across these categories (83 tools total, availability depends on permissions):

| Category | Example Tools | Count |
|----------|--------------|-------|
| **Fact Sheets** | `get_overview`, `get_fact_sheet_details`, `list_fact_sheets`, `create_fact_sheet`, `update_fact_sheet`, `archive_fact_sheet` | 8 |
| **Search** | `search_fact_sheet_by_name`, `semantic_search_fact_sheets`, `semantic_search`, `search_orchestrator` | 4 |
| **Automations** | `list_automations`, `get_automation`, `create_automation`, `update_automation`, `delete_automation`, `create_automation_script`, `get_automation_script`, `update_automation_script`, `get_automation_schema` | 9 |
| **Surveys** | `create_survey`, `get_survey_templates`, `get_survey_results`, `search_survey_runs`, `change_survey_status`, `create_survey_reminder` | 8 |
| **Architecture Decisions** | `get_architecture_decisions`, `create_architecture_decision`, `update_architecture_decision`, `delete_architecture_decision`, `get_architecture_templates` | 7 |
| **Reports & Diagrams** | `get_reports`, `create_report`, `get_diagrams`, `get_diagram_by_id` | 4 |
| **Tech Stack / Discovery** | `get_all_tech_stacks`, `create_tech_stack`, `search_discovery_items`, `link_discovery_item`, `reject_discovery_items` | 13 |
| **Transformations** | `rollout_application_tool`, `discontinue_application_tool`, `search_transformations_tool`, `get_transformation_types_tool` | 4 |
| **Users & Subscriptions** | `search_users`, `get_user_subscriptions`, `get_fact_sheet_subscriptions` | 3 |
| **Initiatives** | `get_initiatives` | 1 |
| **Todos** | `create_todo`, `get_todos`, `search_explicit_todos` | 3 |
| **Data Model / GraphQL** | `get_fact_sheet_types`, `list_graphql_types`, `get_graphql_type_definitions` | 3 |
| **Component Search** | `search_components_by_purl`, `batch_search_components_by_purls`, `search_components_by_license`, `search_components_region_wide` | 4 |
| **Other** | `get_insights`, `get_synclog`, `call_leanix_agent`, `text_to_fact_sheets`, `get_custom_report_guide` | 8+ |

> **Tip:** When configuring API token permissions, use the minimum permissions required. Admin-level permissions can cause unintended actions (e.g., sending surveys or creating duplicate architecture decisions).

---

## Troubleshooting

### "Connection refused" or timeout

- Verify your instance subdomain is correct (for Technical User auth)
- Check if your network allows outbound HTTPS to `*.leanix.net`
- For OAuth: ensure `mcp.leanix.net` is reachable

### "401 Unauthorized"

- Verify your API token is correct and not expired
- Check that the token has appropriate permissions
- For OAuth: your 24-hour session may have expired — re-authenticate
- Try regenerating the API token

### "403 Forbidden"

- Your user/token may lack permissions for certain operations
- An administrator may have disabled your authentication method
- Contact your LeanIX administrator

### MCP server disabled

- An administrator may have turned off the MCP server toggle at **Administration > Integrations > MCP Server**
- The system rejects all connections when disabled

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

## Security Recommendations

1. **Use OAuth** for individual user access (no tokens to manage)
2. **Use minimum permissions** for API tokens — admin tokens can trigger unintended actions
3. **Create dedicated technical users** for automation development
4. **Rotate tokens regularly**
5. **Never commit tokens** to version control
6. **Use environment variables** for tokens in MCP configuration:
   ```bash
   export LEANIX_SUBDOMAIN="your-instance"
   export LEANIX_API_TOKEN="LXT_xxx..."
   ```

---

*Reference: [SAP LeanIX MCP Server Documentation](https://help.sap.com/docs/leanix/ea/mcp-server)*
