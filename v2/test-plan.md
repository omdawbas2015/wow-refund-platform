# Phase 2 — Refund case domain test plan

**PR:** https://github.com/omdawbas2015/wow-refund-platform/pull/2
**Branch:** `devin/1777094132-v2-phase-2-refund-cases`
**Environment:** local `next start` on http://localhost:3000, SQLite at `apps/web/dev.db` seeded with `SEED_DEMO_CASES=1`.

## Fixtures (already prepared)
- Admin user: `admin@wow.local` / `admin123` (role `ADMIN`)
- Secondary active user: `agent@wow.local` / `agent123` (role `AGENT`) — exists so `@mention` has a recipient
- Demo cases seeded:
  - `DRAFT` — Sara Al-Fahad · Chipotle KW · order `CHP-KW-89231`
  - `PENDING_APPROVAL` — Omar Khan · Starbucks KW · order `SBX-KW-44102`
  - `APPROVED` — Layla Hussain · Chipotle SA · order `CHP-SA-77345`
  - `PARTIALLY_REFUNDED` — Yousef Al-Mutairi · Chipotle KW · order `CHP-KW-92044`
  - `REFUNDED` — Reem Al-Saud · Starbucks SA · order `SBX-SA-22198`

Code references that grounded these assertions:
- `apps/web/src/app/[locale]/(dashboard)/cases/[caseId]/case-tabs.tsx:121-206` — action bar only renders buttons for valid transitions
- `packages/validators/src/case.ts` — `CASE_STATE_TRANSITIONS` + `canTransition()`
- `apps/web/src/app/actions/cases.ts::createCaseAction` — duplicate path at `apps/web/src/app/actions/cases.ts` (duplicate check on `(orderNumber, brandId)`)
- `apps/web/src/app/[locale]/(dashboard)/cases/new/new-case-form.tsx` — duplicate warning renders inline with "View existing" link
- `apps/web/src/app/actions/cases.ts::addCaseNoteAction` — creates `CaseNote` + `CaseNoteMention` + fans `Notification` rows with `href = /cases/{id}#note-{noteId}`
- `apps/web/src/components/layout/notifications-bell.tsx` — polls `/api/notifications`, shows unread badge, mark-read action

---

## Test 1 — State machine gates the action bar (PRIMARY)

**Why this test is adversarial:** Action bar buttons are derived client-side from `caseData.status`. A broken implementation that exposes every transition button at every status would fail these assertions. A broken `canTransition()` would either 404 the action or silently keep the old status.

### Steps
1. As `admin@wow.local`, open `/en/cases` and verify exactly **5 cases** render in the table.
2. Click the `DRAFT` case (Sara Al-Fahad). On the detail page, confirm:
   - **Visible action buttons:** `Submit for approval` and `Cancel case`
   - **NOT visible:** `Approve`, `Reject`, `Start execution`, `Mark refunded`
3. Click `Submit for approval`. After the page refreshes:
   - Status badge reads `PENDING_APPROVAL`
   - Visible buttons become: `Approve`, `Reject`, `Cancel case`
   - The **Activity** tab contains a row with `kind = case.submitted` (or whatever the server emits) and an author label of `Default Admin`
4. Click `Approve`. After refresh:
   - Status badge reads `APPROVED`
   - Visible buttons: `Start execution`, `Cancel case`
   - Overview tab **People** panel now shows `Approved by: Default Admin` with an approved-at timestamp
5. Click `Start execution`. After refresh: status = `IN_EXECUTION`; button `Mark refunded` is visible.
6. Click `Mark refunded`. After refresh: status = `REFUNDED`. The action bar disappears entirely (no further transitions available from a terminal state).

### Pass criteria (all must hold)
- At every step, exactly the listed buttons render (no more, no fewer).
- Status badge text matches expected status at each step.
- Activity tab accumulates at least **5 rows** by the end (creation + 4 transitions) with distinct `kind` values.
- `Approved by` displays the admin's name and is non-empty after step 4.
- No JS errors in console during transitions.

### Fail criteria (any of these)
- Any button visible at a state where it shouldn't be (e.g. `Approve` visible while status is `DRAFT`).
- Clicking a transition button produces an error toast/alert like `INVALID_TRANSITION`.
- Activity tab does not grow, or the page does not refresh the status after a click.

---

## Test 2 — Duplicate detection inline warning

**Why this test is adversarial:** A broken `createCaseAction` that skips the duplicate check would silently create a second case for the same `(orderNumber, brandId)`. A broken UI that ignores the `duplicate` action result would redirect to the new case without warning.

### Steps
1. Navigate to `/en/cases/new`.
2. Fill in the form using **deliberately duplicate** data from the existing `DRAFT` seed case:
   - Country: `Kuwait`
   - Brand: `Chipotle`
   - Customer name: `Test Duplicate`, email: `dup@example.com`, phone: `+96500000000`
   - **Order number:** `CHP-KW-89231` (same as the DRAFT seed case)
   - Order date: today, order amount: `10.000`
   - 1 component: Apple Pay, `10.000`, last 4: `1111`
3. Click `Create case`.

### Pass criteria
- Submit does NOT redirect. Instead, an **inline alert** appears containing the substring `already exists` (or the exact phrase from the implementation) and showing the existing case number `REF-KW-2026-000001` (or whatever the seeded number is).
- The alert offers a link/button labelled along the lines of "View existing case" pointing at `/en/cases/{existingId}` and a secondary action to "Create anyway".
- `/en/cases` continues to show exactly **5 cases** (no duplicate was written).

### Fail criteria
- Form redirects to a new case detail page (`/en/cases/{newId}`) without a warning.
- No alert renders and `/en/cases` jumps to 6 cases.

### Follow-up (still part of Test 2)
4. Click "Create anyway" / equivalent button on the warning.
5. Confirm it now redirects to the newly-created case and `/en/cases` shows **6 cases**, two of which share `orderNumber = CHP-KW-89231`.

---

## Test 3 — Note @mention → notification bell with deep link

**Why this test is adversarial:** A broken `addCaseNoteAction` that fails to create `Notification` rows would leave the bell dropdown empty for the mentioned user. A broken notifications bell that hard-codes `unread = 0` would pass a naive UI-only test — this test logs in as the recipient and checks the **actual unread count** + **deep-link**.

### Steps
1. As `admin@wow.local`, open the `PENDING_APPROVAL` case detail page.
2. Switch to the `Notes` tab.
3. Click the `@ Mention` button → select `Agent One` from the picker (verify the chip appears reading `@Agent One`).
4. Type in the textarea: `Please review this case, Agent One`
5. Click `Post note`. Confirm:
   - Textarea and mention chips clear.
   - A new note card appears at the top of the list authored by "Default Admin" with the text.
   - The note card shows `Mentioned: @Agent One` below its body.
6. Log out. Log in as `agent@wow.local` / `agent123`.
7. Observe the bell icon in the top bar: unread badge should read **`1`** (or `1+` if styled that way — the exact string the UI uses).
8. Click the bell. The dropdown shows a notification with:
   - Title containing the case number and/or `mentioned`
   - A blue unread dot on the left
9. Click the notification entry.
10. Verify the browser navigates to `/en/cases/{caseId}#note-{noteId}` and the Notes tab is NOT focused by default (confirms we lost tab state — acceptable; the important thing is the URL hash matches the note). After navigation, return to the bell: unread count should now read `0` and the bell's red badge is gone.

### Pass criteria
- Unread count flips from `0` → `1` → `0` as expected above.
- Dropdown entry has href matching `/en/cases/{caseId}` and contains the hash `#note-`.
- Notes tab on the target page shows the admin's note with the `@Agent One` mention rendered in the mentions line.

### Fail criteria
- Bell badge stays at `0` after the admin posts the mention (fan-out broken).
- Clicking the notification leaves the user on the bell dropdown or navigates to a non-existent case.
- `Mentioned:` line is missing on the note card rendering.

---

## Recording plan
- One continuous recording starting from the cases list, covering Test 1 in full, then Test 2 (duplicate flow only — stop before "Create anyway" to keep the seeded DB clean), then Test 3 with the user switch.
- Annotate at the start of each test with `test_start` and assert pass/fail with `assertion` annotations at the key moments.
