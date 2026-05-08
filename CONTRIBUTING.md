# Contributing

## Code of Conduct

All members of the project community must abide by the [SAP Open Source Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md).
Only by respecting each other we can develop a productive, collaborative community.
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting [a project maintainer](REUSE.toml).

## What Can You Contribute?

This repository hosts [Agent Skills](https://agentskills.io) — reusable, portable instructions that extend AI coding agents with LeanIX-specific workflows and domain knowledge.

Contributions we welcome:

- **New skills** that help users work more effectively with the LeanIX MCP server or the LeanIX platform in general
- **Improvements to existing skills** — better descriptions, clearer instructions, additional examples, or bug fixes
- **Documentation improvements** — corrections, clarifications, or better setup instructions

## How to Contribute

All skills live under `skills/` at the repository root. Each skill is a directory with a `SKILL.md` file containing YAML frontmatter (`name` and `description` required) and Markdown instructions. Keep `SKILL.md` under 500 lines and move detailed content to `references/` files.

See the [Agent Skills specification](https://agentskills.io/specification) for the full format, naming rules, and content guidelines.

When adding a new skill, also register it in `.claude-plugin/marketplace.json` — see the [README](README.md#requirements-and-setup) for how the marketplace works.

### Pull Requests

Include a title that describes what the skill does or what changed, and a brief description with an example showing the skill in action. Do not include sensitive or proprietary data in skill files or examples.

## Legal Requirements

**License.** All contributions must be licensed under the [Apache 2.0 License](./LICENSE).

**Developer Certificate of Origin (DCO).** When you create your first pull request, you will be asked to accept the DCO. This happens automatically during submission. SAP uses [the standard DCO text of the Linux Foundation](https://developercertificate.org/).

**AI-generated content.** Contributions that were created with AI assistance must follow the [SAP guidelines on AI-generated code](https://github.com/SAP/.github/blob/main/CONTRIBUTING_USING_GENAI.md).

## Issues and Bug Reports

Use GitHub issues to report bugs. Include enough context for someone unfamiliar with your setup to understand the problem — what you expected, what happened instead, and which agent and skill were involved.
