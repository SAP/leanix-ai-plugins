# LeanIX MCP Server Setup

SAP LeanIX provides an official MCP server exposing enterprise architecture APIs as discoverable tools for AI clients.

> **Important:** Activate Base AI Capabilities in your workspace for full MCP precision. Without it, response quality is significantly reduced.

The MCP server is **enabled by default** for all SAP LeanIX APM customers. Available tools depend on the authenticated user's permissions.

---

## Table of Contents

- [Admin Configuration](#admin-configuration)
- [Authentication Methods](#authentication-methods)
- [Client Configuration](#client-configuration)
- [Progressive Tool Discovery](#progressive-tool-discovery)
- [Toolsets](#toolsets)
- [Discovering Available Tools](#discovering-available-tools)
- [Security Recommendations](#security-recommendations)
- [Troubleshooting](#troubleshooting)

---

## Admin Configuration

Enable/disable MCP access and manage technical users at **Administration > MCP Server**. Toggle **Progressive Tool Discovery** at **Administration > MCP Server > Progressive Tool Discovery**.

---

## Authentication Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| **OAuth (User-Based)** | `https://mcp.leanix.net/services/mcp-server/v1/mcp` | OAuth 2.0 via browser. Session expires in 24 hours. |
| **Technical User (API Token)** | `https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp` | For automated/non-interactive access. |

> **Note:** OAuth uses `mcp.leanix.net` (no subdomain); technical users use `{SUBDOMAIN}.leanix.net`.

### Technical User Token Formats

| Format | Header |
|--------|--------|
| **API Token** | `Authorization: Token {YOUR-API-TOKEN}` |
| **Bearer Token** (JWT) | `Authorization: Bearer {YOUR-JWT}` |

Create technical users at **Administration > Technical Users**.

---

## Client Configuration

Use the **clean URL** (no `?toolsets=`) as the primary form — PTD handles on-demand loading, and without PTD it loads all 12 default toolsets. Use `?toolsets=` only when PTD is unavailable or you need optional toolsets. See [Progressive Tool Discovery](#progressive-tool-discovery) and [Toolsets](#toolsets).

### Claude Code — OAuth (Recommended)

```bash
claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp"
```

Sign in via browser when prompted. Re-authenticate every 24 hours.

**Without PTD — explicit toolsets:**

```bash
claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations"
```

### Claude Code — Technical User (Dynamic Credentials)

Add to `.mcp.json`:

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

**Without PTD — explicit toolsets:**

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

Set environment variables before starting:

```bash
export LEANIX_SUBDOMAIN="your-instance"
export LEANIX_API_TOKEN="LXT_your_token_here"
claude
```

### Claude Desktop — Technical User

Requires `npx`. Config location:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

**Without PTD — explicit toolsets:**

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
      "url": "https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp",
      "headers": {
        "Authorization": "Token {YOUR-API-TOKEN}"
      }
    }
  }
}
```

**Without PTD — explicit toolsets:**

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
      "url": "https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp",
      "headers": {
        "Authorization": "Token {YOUR-API-TOKEN}"
      }
    }
  }
}
```

**Without PTD — explicit toolsets:**

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

## Progressive Tool Discovery

PTD is a workspace-level setting that changes how tools are delivered at connect time.

**PTD off (default):** full tool catalog sent at connect — all tools visible immediately, but consumes significant context window.

**PTD on:** only three meta-tools delivered at connect. The AI discovers and loads tools on demand. **Reduces initial token consumption by up to 97%.**

Enable at: **Administration > MCP Server > Progressive Tool Discovery**. Changes apply to new sessions only.

### The Three Discovery Meta-Tools

| Tool | Purpose |
|------|---------|
| `search_mcp_tools` | Search the full tool catalog by keyword |
| `get_mcp_tools_schema` | Retrieve parameter schema for a tool by name |
| `call_tool` | Invoke any catalog tool by name with arguments |

Optional toolsets (`automations`, `calculations`, etc.) are reachable via PTD without `?toolsets=`.

### PTD vs. Explicit Toolsets

| | PTD (clean URL) | Explicit `?toolsets=` |
|---|---|---|
| Context at connect | Minimal (~3 meta-tools) | Full catalog of requested toolsets |
| Optional toolsets accessible | Yes, via discovery | Only those listed |
| Per-prompt latency | Small discovery overhead | None |
| Requires admin enablement | Yes | No |
| `?toolsets=` present | PTD disabled for that session | Always explicit mode |

**Key rule:** `?toolsets=` in the URL disables PTD for that session regardless of workspace setting.

---

## Toolsets

Default toolsets are active when no `?toolsets=` is specified. Optional toolsets must be explicitly listed or discovered via PTD.

> When `?toolsets=` is specified, **only** listed toolsets are active — defaults are not included unless explicitly listed. Maximum 10 toolsets per request.

### Default Toolsets

| Toolset | Key | Description |
|---------|-----|-------------|
| Inventory | `inventory` | Get fact sheet information |
| Report Diagrams | `report_diagrams` | Get report and diagram information |
| Roadmap Planning | `roadmap_planning` | Get initiatives and transformation information |
| Collaboration | `collaboration` | Collaboration and To-Do management |
| Surveys | `surveys` | Create or get survey information |
| Architecture Decisions | `architecture_decisions` | Create or get architecture decision information |
| Self-Built Software | `self_built_software` | Tech stack management discovery |
| Skills | `skills` | LeanIX skill guidance (`activate_leanix_skill`, `load_leanix_skill_reference`) |
| Insights | `insights` | Workspace insights and analytics |
| Code Execution | `code_execution` | Run code against workspace data |
| LeanIX Agents | `leanix_agents` | LeanIX agent invocation (feature-flag gated) |
| Data Maintenance | `data_maintenance` | Data maintenance and cleanup operations |

### Optional Toolsets

| Toolset | Key | Description |
|---------|-----|-------------|
| Automations | `automations` | Create, read, update, delete automations and scripts |
| Calculations | `calculations` | Calculations and execution logs |
| Custom Reports | `custom_reports` | Custom report guide |
| Integrations | `integrations` | Sync log, Signavio configurations |
| RBA/RSA | `rba_rsa` | Reference business/solution architecture search |
| Discovery Inbox | `discovery_inbox` | Discovery inbox items, linking, rejection |
| Catalogs | `catalogs` | Catalog exploration |
| Product Information | `product_information` | SAP product information (SAP Help) |
| Diagrams | `diagrams` | Diagram tools (note: `report_diagrams` is default; `diagrams` is optional) |
| KPIs | `kpis` | KPI data |
| Custom Integrations | `custom_integrations` | Custom integration configuration |
| Metrics | `metrics` | Metrics data |

### Pinned Tools (always visible)

- `activate_leanix_skill`
- `load_leanix_skill_reference`
- `open_relations_explorer`
- `list_fact_sheets`
- `single_fact_sheet`
- `open_sbom_explorer`

### Common Combinations

| Use Case | Configuration |
|----------|--------------|
| Automations development | `?toolsets=inventory,automations` — or clean URL with PTD enabled |
| Calculations development | `?toolsets=inventory,calculations` |
| Automations + calculations | `?toolsets=inventory,automations,calculations` |
| Read-only EA work | Clean URL (omit `?toolsets=`) |

---

## Discovering Available Tools

### With PTD

Prompt the agent directly:

```
Search for LeanIX tools related to automations.
```

The agent calls `search_mcp_tools`, inspects results, and loads schemas before invoking tools. No `?toolsets=` required.

### Without PTD

Ask the AI:

```
What LeanIX MCP tools do you have available?
```

If a tool is missing, it likely belongs to an optional toolset not in your `?toolsets=` parameter.

### Skill-Based Connectivity Checks

Each skill performs a connectivity check on startup:
- `/automations-toolkit` calls `list_automations` — reports the missing toolset and fix command on failure.
- `/calculations-toolkit` calls `list_calculations` — same pattern.

**Quick verification:**

| If this call succeeds... | ...then this toolset is active |
|--------------------------|-------------------------------|
| `list_automations` | `automations` |
| `list_calculations` | `calculations` |
| `filter_inventory` | `inventory` |

**Re-add with updated toolsets (Claude Code OAuth):**

```bash
claude mcp remove leanix
claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations"
```

Restart Claude Code after updating.

---

## Security Recommendations

### API Token Handling

- Never commit API tokens to source control — use environment variables or a secrets manager.
- Prefer `${LEANIX_API_TOKEN}` in `.mcp.json` over hardcoded values.
- Add `.mcp.json` to `.gitignore` if it contains literal token values.
- Rotate tokens regularly via **Administration > Technical Users**.

### Least-Privilege Access

- Create dedicated technical users with only the permissions required for the task.
- Do not reuse personal API tokens for automated workflows.
- Use OAuth for interactive use — tokens expire in 24 hours and are not stored in config files.

### Workspace Isolation

- Use separate technical users per workspace when working across multiple environments.
- The `${LEANIX_SUBDOMAIN}` / `${LEANIX_API_TOKEN}` pattern avoids storing multiple credentials in config files.

### Scoping Toolsets

- Only include toolsets you actually use in `?toolsets=` — broader access increases blast radius on a compromised token.
- For read-only EA work, omit `?toolsets=` entirely — defaults exclude write-capable toolsets like `automations`.

---

## Troubleshooting

### MCP tools not appearing

- Verify the MCP server is enabled: **Administration > MCP Server**
- Claude Code (OAuth): run `claude mcp list` to confirm the server is registered
- Restart Claude Desktop after config changes
- Check config file syntax (valid JSON)
- Verify `mcp-remote`: `npx -y mcp-remote --version`
- Your role may lack permissions for the expected tools

### Automation tools missing

`automations` is optional — hidden unless explicitly requested or discovered via PTD.

- **PTD enabled:** use the clean URL. The AI discovers automation tools on demand.
- **PTD not enabled:** include `?toolsets=automations` (e.g. `?toolsets=inventory,automations`):

```bash
claude mcp remove leanix
claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,automations"
```

When `?toolsets=` is specified, only listed toolsets are active.

### Calculation tools missing

`calculations` is optional. Without PTD, use `?toolsets=inventory,calculations`.

### Agent cannot find tools after enabling PTD

PTD applies to new sessions only. Reconnect:

- **Claude Code:** `claude mcp remove leanix`, re-add, or restart
- **Claude Desktop:** quit and reopen

After reconnecting, `search_mcp_tools`, `get_mcp_tools_schema`, and `call_tool` replace the full catalog.

### Tools still visible after disabling PTD

Same cause — reconnect to pick up the change. Full default toolset catalog resumes at connect time.

### "Only authenticate / complete_authentication tools are visible"

OAuth session not yet established. In Claude Code, run `/mcp` — the browser opens for sign-in. Do not call `authenticate` directly; use `/mcp`.

### Switching between workspaces

```bash
export LEANIX_SUBDOMAIN="other-instance"
export LEANIX_API_TOKEN="LXT_other_token"
claude
```

---

*Reference: [SAP LeanIX MCP Server Documentation](https://help.sap.com/docs/leanix/ea/mcp-server)*
