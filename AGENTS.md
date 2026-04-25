# Agent Operating Guide

This project should be handled as a git-native, skill-driven app workspace.
Use this file as the project-level instruction layer for coding agents.

Before starting any work, read `HANDOFF.md`. It preserves the latest implementation state, downloaded references, verification status, and recommended next steps.

## Working Model

- Treat repository files as the source of truth for product, design, and agent behavior.
- Treat `HANDOFF.md` and `docs/CURRENT_STATE.md` as persistent project memory.
- Keep changes small, reviewable, and traceable through git diffs.
- Prefer project-level instructions and reusable skills over one-off prompt decisions.
- Add or update explicit docs when behavior, workflows, or UI direction becomes durable.
- Do not store secrets in committed files. Use local env files and keep examples sanitized.
- Keep external agent references in `docs/agent-references/`; consult them as local knowledge, not as app runtime code.
- When changing durable agent behavior, update this file or a more specific project doc in the same change.

## Planning And Execution

- Read the relevant code before editing.
- Follow the existing stack and patterns: Vite, React, TypeScript, Express, Prisma, Tailwind, shadcn-style components, and lucide icons.
- For user-facing UI, consult `DESIGN.md` before changing layout, styling, copy density, or interaction patterns.
- For multi-step work, use deterministic checklists: inspect, implement, verify, then summarize.
- For risky work, separate maker and checker concerns: implement the change, then review it from a bug/regression perspective before closing.
- Use a file-backed plan for larger tasks: capture goals, constraints, decisions, verification, and open risks in a project doc when the work spans multiple sessions.
- Preserve clear handoffs: if a task touches product behavior, backend contracts, and UI, identify those boundaries before editing.

## Skill Use

- Use modular skills as task playbooks when the request matches a specific domain, such as frontend design, React optimization, deployments, data work, or GitHub workflows.
- Keep skill output grounded in this repository. Do not introduce new frameworks or large abstractions unless the existing code clearly calls for them.
- When a skill suggests generated artifacts, adapt them to the app's actual structure instead of pasting generic boilerplate.
- Prefer project-level or already available Codex skills first. Use downloaded reference skills as reading material unless the user asks to install them as active skills.
- If installing skills later, prefer a minimal selected set over copying entire libraries into active agent paths.

## Quality Bar

- Verify with the narrowest useful command first, such as typecheck, build, or targeted tests.
- If verification cannot run, state exactly why and what remains unverified.
- Keep accessibility, responsive layout, loading states, empty states, and error states in scope for user-facing changes.
- Prefer structured parsers and framework APIs over ad hoc string manipulation.
- Before calling work complete, provide concrete evidence: command output, local screenshot review, typecheck/build result, or a clear reason verification was blocked.
- For UI work, review at mobile, tablet, and desktop widths when feasible.

## Local Reference Library

- `docs/agent-references/gitagent/`: git-native agent structure, rules, duties, workflows, memory, auditability.
- `docs/agent-references/antigravity-skills/`: broad reusable `SKILL.md` library and skill installation conventions.
- `docs/agent-references/vercel-labs-skills/`: open skills CLI, lock/update model, and Codex-compatible skill format.
- `docs/agent-references/ui-ux-pro-max-skill/`: UI/UX design reasoning, design system generation, tokens, anti-patterns, and pre-delivery checks.
- `docs/agent-references/awesome-design-md/`: examples of `DESIGN.md` as agent-readable visual systems.
- `docs/agent-references/stitch-design-modes/`: saved Stitch design-modes page for text-to-UI and image-guided UI workflow reference.

## Reference Sources

- GitAgent Protocol: git-native agent structure, identity, rules, skills, tools, workflows, memory, and reviewable changes.
- Antigravity Skills: portable modular skill libraries for coding agents.
- Vercel Labs Skills: open skills ecosystem and CLI-oriented skill installation model.
- UI UX Pro Max: domain-aware design intelligence, persistent design-system guidance, and page overrides.
- Google Stitch design modes: text-to-UI for fast iteration, sketch/image-to-UI for visually guided exploration.
- Awesome DESIGN.md: plain Markdown design system files that coding agents can read to generate consistent UI.
