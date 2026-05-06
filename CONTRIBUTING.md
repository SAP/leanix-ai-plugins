# Contributing

## Code of Conduct

All members of the project community must abide by the [SAP Open Source Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md).
Only by respecting each other we can develop a productive, collaborative community.
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting [a project maintainer](REUSE.toml).

## What Can You Contribute?

This repository hosts [Agent Skills](https://agentskills.io) — reusable, portable instructions that extend AI coding agents with LeanIX-specific workflows and domain knowledge. Skills work across a wide range of AI tools, including Claude Code, Cursor, GitHub Copilot, VS Code, OpenAI Codex, Gemini CLI, and others.

Contributions we welcome:

- **New skills** that help users work more effectively with the LeanIX MCP server or the LeanIX platform in general
- **Improvements to existing skills** — better descriptions, clearer instructions, additional examples, or bug fixes
- **Documentation improvements** — corrections, clarifications, or better setup instructions

## How to Contribute

Open a pull request. For bugs and improvements to existing skills, go ahead directly. For new skills, opening a GitHub issue first to discuss the idea is welcome but not required.

### Skill Structure

Skills follow the [Agent Skills](https://agentskills.io) open standard. Each skill is a directory containing a `SKILL.md` file:

```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
├── assets/           # Optional: templates, resources
└── ...               # Any additional files or directories
```

See [agentskills.io](https://agentskills.io) for the full format specification.

### Pull Requests

Include a title that describes what the skill does or what changed, and a brief description with an example showing the skill in action. Do not include sensitive or proprietary data in skill files or examples.

## Legal Requirements

**License.** All contributions must be licensed under the [Apache 2.0 License](./LICENSE).

**Developer Certificate of Origin (DCO).** When you create your first pull request, you will be asked to accept the DCO. This happens automatically during submission. SAP uses [the standard DCO text of the Linux Foundation](https://developercertificate.org/).

**AI-generated content.** Contributions that were created with AI assistance must follow the [SAP guidelines on AI-generated code](https://github.com/SAP/.github/blob/main/CONTRIBUTING_USING_GENAI.md).

## Issues and Bug Reports

Use GitHub issues to report bugs or request enhancements. Include enough context for someone unfamiliar with your setup to understand the problem — what you expected, what happened instead, and which agent and skill were involved.
