# Phase 2 test report — refund case domain

**PR:** https://github.com/omdawbas2015/wow-refund-platform/pull/2
**Branch:** `devin/1777094132-v2-phase-2-refund-cases`
**Run target:** local `next start` on http://127.0.0.1:3000, SQLite at `packages/db/prisma/dev.db` seeded with `SEED_DEMO_CASES=1`.
**Fixtures:** `admin@wow.local` / `admin123` (ADMIN) and `agent@wow.local` / `agent123` (AGENT — added to exercise @mention fan-out).

---

## TL;DR

| Test | Result |
| --- | --- |
| 1 — State machine gates the action bar | passed |
| 2 — Duplicate detection inline warning | passed |
| 3 — Note @mention → notification bell w/ deep-link | passed |

---

## Test 1 — State machine gates the action bar · passed

Walked the seeded DRAFT case (`REF-KW-2026-000001`, Sara Al-Fahad · Chipotle Kuwait) through every legal transition and observed only the buttons permitted by `CASE_STATE_TRANSITIONS`. Source of truth: `packages/validators/src/case.ts`.

**Transitions captured (from running app, `innerText` of visible buttons):**

| Status | Action-bar buttons observed |
| --- | --- |
| `DRAFT` | `Submit for approval`, `Cancel case` |
| `PENDING_APPROVAL` | `Approve`, `Reject`, `Cancel case` |
| `APPROVED` | `Start execution`, `Cancel case` |
| `IN_EXECUTION` | `Mark refunded`, `Cancel case` |
| `REFUNDED` | *(no action bar rendered — terminal state)* |

No `Approve` button ever appeared on `DRAFT`. No `Start execution` appeared on `PENDING_APPROVAL`. No action bar at all on `REFUNDED`.

### Evidence

**Cases list (seeded demo data)**
![cases list](https://app.devin.ai/attachments/5f9b9673-cfea-454b-bd09-c76ed33589b4/03-cases-list.png)

**DRAFT — Submit / Cancel only**
![draft detail](https://app.devin.ai/attachments/32c62874-89ea-4c46-a5ff-2e8788d0dfd5/04-draft-detail.png)

**PENDING_APPROVAL — Approve / Reject / Cancel**
![pending approval](https://app.devin.ai/attachments/6548dece-de72-4902-90d8-90ddfed4c5ba/05-pending-approval.png)

**APPROVED — Start execution / Cancel**
![approved](https://app.devin.ai/attachments/ae817fc0-f199-4f3b-bcc3-3fd3b74544f7/06-approved.png)

**IN_EXECUTION — Mark refunded / Cancel**
![in execution](https://app.devin.ai/attachments/ad67e58a-767a-4c75-8f25-26915ada4371/07-in-execution.png)

**REFUNDED — terminal, no action bar**
![refunded](https://app.devin.ai/attachments/e2e811e7-5ffd-4ead-8bfe-08508a0279ec/08-refunded.png)

---

## Test 2 — Duplicate detection inline warning · passed

Filled `/en/cases/new` with Kuwait + Chipotle + order number `CHP-KW-89231` (which the DRAFT seed case already uses) and submitted.

**Result:**
- Submit did NOT redirect; URL stayed at `/cases/new`.
- Inline warning rendered with exact text:
  > *"A case already exists for this order — Order `CHP-KW-89231` is already covered by case `REF-KW-2026-000001`."*
- Buttons present on the alert: `View existing case` + `Create anyway`.
- `/en/cases` row count stayed at **5** (no duplicate inserted).

![duplicate warning](https://app.devin.ai/attachments/da29f767-c329-4bb5-b7c9-dd42ebb01243/11-after-submit-duplicate.png)

---

## Test 3 — @mention → notification bell deep-link · passed

### As admin (author)

1. Opened `REF-KW-2026-000002` (PENDING_APPROVAL), switched to Notes tab.
2. Picked `Agent One` from the mention picker (shown email: `agent@wow.local`).
3. Posted the note body `"Please review this case, Agent One"`.
4. Note card rendered with author "Default Admin" and the mention line contained `@Agent One`.

![note posted with mention](https://app.devin.ai/attachments/13c34bc0-abc0-4539-8a22-a04fe821724d/15-note-posted.png)

### As agent (recipient)

5. Logged out, logged in as `agent@wow.local`.
6. Bell in the top bar rendered an unread badge with text **`1`**.

![agent bell unread = 1](https://app.devin.ai/attachments/45e08495-1bee-4b61-ab00-e9eb6f0c6ed3/16-agent-sees-bell.png)

7. `/api/notifications` response (verified via `fetch` in the agent's session):

```json
{
  "unread": 1,
  "items": [{
    "id": "cmoebi1vn000lqhmynm703jz5",
    "type": "CASE_NOTE_MENTION",
    "title": "Default Admin mentioned you on REF-KW-2026-000002",
    "body": "Please review this case, Agent One",
    "href": "/cases/cmoeb18ie002tqh0m6ym5usd5#note-cmoebi1vl000hqhmyg7n9ek5n",
    "readAt": null
  }]
}
```

8. Opened the bell dropdown and clicked the entry.

![bell dropdown open](https://app.devin.ai/attachments/ebdaaacc-73eb-4179-a1ea-176948e7821b/17-bell-dropdown-open.png)

9. Browser navigated to the target case page; URL contained the deep-link hash `#note-cmoebi1vl000hqhmyg7n9ek5n`.

![after notification click](https://app.devin.ai/attachments/ece8d374-38d0-462e-8176-2bf50467e910/18-after-click-notification.png)

10. Re-hitting `/api/notifications` showed `"unread": 0` and `"readAt": "2026-04-25T12:30:54.454Z"` — mark-read wired correctly.

---

## Environmental notes for the record

- SQLite DB path: Prisma Client resolves `file:./dev.db` relative to the schema file, so the web process reads `packages/db/prisma/dev.db`. When running seed from `packages/db/`, `tsx` resolves the url relative to CWD — easy to accidentally create a second DB file. Fix: seed with an absolute `DATABASE_URL` or run seed from `packages/db/prisma/`. Captured this in the local dev skill.
- Playwright 1.x via CDP at `http://localhost:29229` was used to drive the pre-existing Chrome browser so the user could watch in real time.
- Browser was already authenticated to GitHub etc. Nothing modified in the repo during testing beyond temporary Prisma symlinks and the test scripts under `/tmp/`.

## Test scripts (kept for reproducibility)

- `/tmp/test-phase2.mjs` — Test 1 (state machine)
- `/tmp/test-phase2-b.mjs` — Test 2 (duplicate detection)
- `/tmp/test-phase2-c.mjs` — Test 3 (@mention + notification)
