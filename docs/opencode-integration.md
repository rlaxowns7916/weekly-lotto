# OpenCode ECC Integration

This PR integrates the `everything-claude-code` skills and agents into the `weekly-lotto` project, configured to use GLM-4.7 models via `oh-my-opencode`.

## Changes
- Added `.opencode/` directory with:
  - **Agents**: Planner, Architect, Code Reviewer, etc. (configured for GLM-4.7)
  - **Skills**: 30+ skills including `api-design`, `django-patterns`, `security-scan`
  - **Commands**: Slash commands for easy invocation
  - **Config**: `oh-my-opencode.json` with GLM-4.7 base configuration
- This setup enables OpenCode agents to work directly within the project context.

## Notes
- All agents are set to use `zai-coding-plan/glm-4.7` (or `glm-4v` for vision).
- This integration is based on the `everything-claude-code` marketplace package.
