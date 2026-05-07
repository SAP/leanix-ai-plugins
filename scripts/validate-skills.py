#!/usr/bin/env python3
"""Validate SKILL.md files against Claude Code best practices.

Sources:
- Official docs: https://code.claude.com/docs/en/skills
- Deep dive: https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/
"""

import sys
import re
from pathlib import Path

SKILL_MAX_LINES = 800
ABSOLUTE_PATH_PATTERNS = [
    r'/Users/[^/]+/',
    r'/home/[^/]+/',
    r'C:\\Users\\',
    r'/var/',
    r'/tmp/',
]

PLACEHOLDER_PATTERNS = [
    r'/path/to/',           # Common placeholder
    r'\{baseDir\}',         # Not a real Claude substitution
    r'<path>',              # XML-style placeholder
    r'\[path\]',            # Bracket placeholder
]

KNOWN_FRONTMATTER_FIELDS = {'name', 'description', 'allowed-tools'}


def find_skill_files(root: Path) -> list[Path]:
    """Find all SKILL.md files in skills/ and .claude/skills/ directories."""
    return sorted(
        set(root.glob('skills/*/SKILL.md'))
        | set(root.glob('**/.claude/skills/*/SKILL.md'))
    )


def parse_frontmatter(content: str) -> tuple[dict | None, str]:
    """Extract YAML frontmatter and body.

    Simple parser for key: value and key: "value" formats.
    Returns:
        (frontmatter_dict, body) - frontmatter_dict is None if parsing fails
    """
    if not content.startswith('---'):
        return {}, content

    # Find the closing ---
    end_idx = content.find('---', 3)
    if end_idx == -1:
        return {}, content

    fm_text = content[3:end_idx].strip()
    body = content[end_idx + 3:]

    # Parse simple YAML (key: value or key: "value")
    fm = {}
    try:
        for line in fm_text.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if ':' not in line:
                continue
            key, _, value = line.partition(':')
            key = key.strip()
            value = value.strip()
            # Remove quotes if present
            if (value.startswith('"') and value.endswith('"')) or \
               (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            fm[key] = value
        return fm, body
    except Exception:
        return None, content


def check_placeholder_paths(content: str) -> list[str]:
    """Detect placeholder paths that won't work at runtime."""
    errors = []
    for pattern in PLACEHOLDER_PATTERNS:
        if re.search(pattern, content):
            errors.append(f"Contains placeholder path: {pattern}")
    return errors


def check_script_paths(content: str, skill_dir: Path) -> list[str]:
    """Find script references that may not resolve from project root."""
    warnings = []
    # Match: python scripts/foo.py (without .claude/ prefix in skill context)
    for match in re.finditer(r'python\s+(scripts/[^\s]+)', content):
        path = match.group(1)
        if not path.startswith('.claude/'):
            warnings.append(f"Script path may not resolve from project root: {path}")
    return warnings


def check_references_exist(content: str, skill_dir: Path) -> list[str]:
    """Verify that referenced files in references/ and assets/ exist."""
    errors = []
    # Check references/ paths
    for match in re.finditer(r'`(references/[^`\s]+)`', content):
        ref_path = skill_dir / match.group(1)
        if not ref_path.exists():
            errors.append(f"Referenced file doesn't exist: {match.group(1)}")
    # Check assets/ paths
    for match in re.finditer(r'`(assets/[^`\s]+)`', content):
        asset_path = skill_dir / match.group(1)
        if not asset_path.exists():
            errors.append(f"Asset file doesn't exist: {match.group(1)}")
    return errors


def check_frontmatter_fields(fm: dict) -> list[str]:
    """Warn about non-standard frontmatter fields."""
    warnings = []
    for key in fm:
        if key not in KNOWN_FRONTMATTER_FIELDS:
            warnings.append(f"Non-standard frontmatter field: '{key}'")
    return warnings


def check_empty_description(fm: dict) -> list[str]:
    """Check for empty description field."""
    errors = []
    desc = fm.get('description', '')
    if 'description' in fm and not desc.strip():
        errors.append("Description field is empty")
    return errors


def validate_skill(path: Path) -> tuple[list[str], list[str]]:
    """Validate a single SKILL.md file.

    Returns:
        (errors, warnings) - errors fail the build, warnings are reported
    """
    errors: list[str] = []
    warnings: list[str] = []
    content = path.read_text()
    lines = content.split('\n')

    # Critical: Line count
    if len(lines) > SKILL_MAX_LINES:
        errors.append(f"SKILL.md has {len(lines)} lines (max {SKILL_MAX_LINES})")

    # Critical: Valid frontmatter
    fm, body = parse_frontmatter(content)
    if fm is None:
        errors.append("Invalid YAML frontmatter")
        return errors, warnings

    # Critical: description field
    if 'description' not in fm:
        errors.append("Missing required 'description' field in frontmatter")

    # Critical: No absolute paths
    for pattern in ABSOLUTE_PATH_PATTERNS:
        if re.search(pattern, content):
            errors.append(f"Contains hardcoded absolute path matching: {pattern}")

    # Warning: name field
    if 'name' not in fm:
        warnings.append("Missing 'name' field (recommended)")

    # Warning: description quality
    desc = fm.get('description', '')
    if desc and 'when' not in desc.lower() and 'use' not in desc.lower():
        warnings.append("Description should include 'when to use' scenarios")

    # Warning: imperative language
    if re.search(r'\bYou should\b', content, re.IGNORECASE):
        warnings.append("Use imperative language instead of 'You should...'")

    # Warning: allowed-tools scope
    tools = fm.get('allowed-tools', '')
    if 'Bash' in tools and 'Bash(' not in tools:
        warnings.append("Consider scoping Bash access: Bash(git:*) instead of Bash")

    # Warning: Check supporting file structure
    skill_dir = path.parent
    has_refs = (skill_dir / 'references').exists()
    has_assets = (skill_dir / 'assets').exists()
    has_scripts = (skill_dir / 'scripts').exists()

    if has_refs or has_assets or has_scripts:
        # Check if SKILL.md references them
        if has_refs and 'references/' not in content:
            warnings.append("Has references/ dir but SKILL.md doesn't reference it")
        if has_assets and 'assets/' not in content:
            warnings.append("Has assets/ dir but SKILL.md doesn't reference it")

    # Critical: Placeholder paths
    errors.extend(check_placeholder_paths(content))

    # Critical: Empty description
    errors.extend(check_empty_description(fm))

    # Critical: Broken references
    errors.extend(check_references_exist(content, skill_dir))

    # Warning: Script paths
    warnings.extend(check_script_paths(content, skill_dir))

    # Warning: Non-standard frontmatter
    warnings.extend(check_frontmatter_fields(fm))

    return errors, warnings


def main() -> int:
    """Run validation on all SKILL.md files."""
    root = Path.cwd()
    skills = find_skill_files(root)

    if not skills:
        print("No SKILL.md files found")
        return 0

    total_errors = 0
    total_warnings = 0

    for skill_path in skills:
        rel_path = skill_path.relative_to(root)
        errors, warnings = validate_skill(skill_path)

        if errors or warnings:
            print(f"\n{'='*60}")
            print(f"  {rel_path}")
            print('='*60)

            for err in errors:
                print(f"  ERROR: {err}")
                total_errors += 1

            for warn in warnings:
                print(f"  WARN:  {warn}")
                total_warnings += 1

    print(f"\n{'='*60}")
    print(f"Summary: {len(skills)} skill(s), {total_errors} error(s), {total_warnings} warning(s)")
    print('='*60)

    return 1 if total_errors > 0 else 0


if __name__ == '__main__':
    sys.exit(main())
