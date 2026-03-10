# Contributing

## Commit Messages

Use **lowercase imperative** style — describe what the commit does, not what you did.

```
add color picker for levers
fix websocket reconnect on timeout
refactor components for better reactivity
```

Keep the first line short (under 72 characters). Add a blank line and more detail in the body if needed.

## Versioning

This project follows [Semantic Versioning](https://semver.org/) (semver): **MAJOR.MINOR.PATCH**.

### When to Bump

**Patch (e.g. 1.0.0 → 1.0.1)** — backwards-compatible fixes

- Bug fixes
- Typo corrections
- Dependency updates (non-breaking)
- CSS/styling tweaks
- Internal refactors that don't change behavior

**Minor (e.g. 1.0.1 → 1.1.0)** — backwards-compatible new functionality

- New surface components or UI features
- New API endpoints consumed from Timberborn
- New CLI commands or options (additive)
- New configuration options with sensible defaults

**Major (e.g. 1.1.0 → 2.0.0)** — breaking changes

- Renaming or removing environment variables (e.g. `TB_PORT`, `TB_GAME_API`)
- Changing CLI command names or removing commands
- Removing features or UI components
- Changes that require users to update their `.env` or workflow

### Rule of Thumb

If a user can update without changing anything on their end, it's **patch** or **minor**. If they need to change config, commands, or workflow, it's **major**.

## Releasing

Releases are driven by git tags. The GitHub Actions workflow builds a Windows installer and publishes it to the GitHub release.

1. Update `version` in `package.json`
2. Commit the version bump: `update version to 1.1.0`
3. Tag the commit: `git tag v1.1.0`
4. Push the commit and tag: `git push && git push --tags`

The workflow (`.github/workflows/release.yml`) triggers on any `v*` tag, passes the tag name to the Inno Setup compiler as `TIMBERBORN_TOOL_VERSION`, and uploads the resulting installer to the GitHub release.
