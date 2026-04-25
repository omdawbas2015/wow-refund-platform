# Agent Reference Summary

This folder contains local copies of the external references requested for this project. They are reference material for future work, not production app dependencies.

## Installed Local References

- `gitagent/` from `open-gitagent/gitagent`
- `antigravity-skills/` from `guanyang/antigravity-skills`
- `vercel-labs-skills/` from `vercel-labs/skills`
- `ui-ux-pro-max-skill/` from `nextlevelbuilder/ui-ux-pro-max-skill`
- `awesome-design-md/` from `VoltAgent/awesome-design-md`
- `stitch-design-modes/` from `https://stitch.withgoogle.com/docs/learn/design-modes/`

## Actionable Guidance Extracted

### GitAgent

- Treat the repository as the agent's durable identity and memory.
- Keep instructions, rules, workflows, skills, tools, and knowledge in reviewable files.
- Prefer branch/diff-style accountability for meaningful behavior changes.
- Separate roles for risky flows: maker, checker, executor, auditor.
- Use local memory and docs for decisions that need to survive across sessions.

### Antigravity Skills

- Skills should be modular directories centered on `SKILL.md`.
- Optional scripts, examples, and resources should live beside the skill.
- Install only skills that are directly useful to the active project.
- Use skills as specialist playbooks, not as reasons to override the app's existing stack.

### Vercel Labs Skills

- Skills can be installed from GitHub, URLs, or local paths and scoped to a project or globally.
- Project-scoped skills are best when the whole team should share the workflow.
- Global skills are best for personal repeated workflows.
- Locking/update models matter when skills become operational dependencies.

### UI UX Pro Max

- Start with product/domain reasoning before styling.
- Choose pattern, style, color mood, typography mood, key effects, and anti-patterns as a coherent set.
- For serious operational apps, favor accessible, restrained, high-clarity design over decorative trends.
- Validate UI before delivery: contrast, focus states, hover states, responsive widths, and reduced motion.

### Awesome DESIGN.md

- `DESIGN.md` is a plain Markdown design system agents can read.
- Strong design docs include theme, colors, typography, component states, layout principles, depth, dos/don'ts, responsive behavior, and agent prompt guidance.
- Use page overrides for exceptions instead of weakening global rules.

### Google Stitch Design Modes

- Use text-to-UI style workflows for fast exploration when the idea is still verbal.
- Use image, screenshot, or sketch-guided workflows when structure matters more than verbal description.
- Treat generated UI as a starting point; manually validate accessibility, responsiveness, and product fit.

## How To Use These References

1. Check `AGENTS.md` for how to work in this repository.
2. Check `DESIGN.md` before UI changes.
3. Search this folder when a task needs a deeper pattern or examples.
4. Promote only the useful, durable rule back into `AGENTS.md`, `DESIGN.md`, or a task-specific doc.

## Preservation Rule

Do not delete these folders. They are intentionally checked into the project as local agent knowledge so a future agent can continue from the current learning state without re-downloading or re-reading the original sources from scratch.

Do not import code from these folders into the app directly. If a reference suggests a useful pattern, copy the idea into project code or docs intentionally.
