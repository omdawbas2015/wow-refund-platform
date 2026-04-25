<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Enterprise Refund Management App

Start with [HANDOFF.md](HANDOFF.md) before making changes. It preserves the current implementation state, downloaded reference repos, architecture decisions, verification status, and next recommended tasks.

Core project memory:

- [AGENTS.md](AGENTS.md) - coding agent operating guide.
- [DESIGN.md](DESIGN.md) - durable UI/UX design system guide.
- [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) - current app state and run commands.
- [docs/enterprise-refund-platform.md](docs/enterprise-refund-platform.md) - target enterprise architecture.
- [docs/enterprise-schema.sql](docs/enterprise-schema.sql) - normalized PostgreSQL target schema.
- [docs/agent-references](docs/agent-references) - local copies of external references used to guide the system.

## Original AI Studio Notes

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/238a409c-730e-4146-a7aa-ae2a8c01ee42

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
