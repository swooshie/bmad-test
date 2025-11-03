# Repository Guidelines

## Project Structure & Module Organization
- `core/` holds the runtime bundle: `agents/` for orchestrator definitions, `tasks/` for XML checklists, `tools/` for executable hooks, and `workflows/` for higher-level orchestration. Update these in tandem so menu references in `core/agents/bmad-web-orchestrator.agent.xml` stay valid.
- `_cfg/` is the manifest layer. CSV manifests map ids to files; adjust these whenever you add or rename assets or the orchestrator will not surface them.
- `bmm/` mirrors the published BMad Method module: its `agents/`, `workflows/`, `tasks/`, and `testarch/` directories are reference implementations you can borrow from or extend.
- `docs/` contains contributor-facing help. Add new process notes or playbooks here so they can be rendered into the output bundle.

## Build, Test, and Development Commands
- `npx bmad-method@alpha install` installs or refreshes the CLI prompts into `$CODEX_HOME`.
- Inside Codex, trigger `*workflow-init` to bootstrap a fresh workspace; use `*document-project` first when onboarding a brownfield codebase.
- Use the orchestrator’s `/bmad-bmm-workflows-dev-story` menu entries to dry-run end-to-end flows after editing workflow XML; the CLI streams validation output back into the chat.

## Coding Style & Naming Conventions
- YAML and JSON config use two-space indentation; keep top-level keys alphabetized when practical to reduce merge conflicts.
- XML tasks and agents prefer attributes on the same line with wrapped text at 100 characters; step text should stay in the imperative mood.
- File names are kebab-case (`adv-elicit.xml`, `workflow-manifest.csv`) and ids match those names so the manifests remain predictable.

## Testing Guidelines
- Trigger the `validate-workflow` handler from the orchestrator whenever you touch `core/tasks/*.xml`; it runs the checklist defined in `core/tasks/validate-workflow.xml` against your updated artifact.
- Populate `bmm/testarch/knowledge/` with scenario guides before adding new QA workflows; agents pull examples from this folder during validation.
- When introducing new tasks, pair them with a minimal sample document under `docs/` that demonstrates expected output so reviewers can replay the flow quickly.

## Commit & Pull Request Guidelines
- Repository snapshots here ship without git history; follow the upstream BMAD conventional commit format: `type(scope): imperative summary` (e.g., `feat(workflows): add accessibility audit flow`).
- PRs should include: purpose, impacted agent/workflow ids, manual validation steps (with menu command or prompt id), and screenshots or transcript snippets showing a successful dry run.

## Security & Configuration Tips
- Never commit secrets; reference external credentials through `{project-root}/docs` outputs or environment variables consumed at runtime.
- Keep `core/config.yaml` synced with deployment expectations (language, output folder). When switching locales or destinations, update the config and note it in the PR to avoid silent regressions.
