# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build locally
npm run push       # Bump minor version, update release notes, commit & push to main
```

No test suite exists in this project.

## Environment Variables

Create a `.env` file at the project root:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
VITE_VAPID_PUBLIC_KEY=
```

`__APP_VERSION__` is injected automatically from `package.json` at build time via `vite.config.js`.

## Architecture

Tasky is a **React 19 + Vite** SPA with **Supabase** as the full backend and **Google Gemini** for AI photo verification. No state management library — React Context for auth, local state for UI, Supabase Realtime for live data sync.

### Role-Based Routing

`App.jsx` checks auth state and `profile.role` to route users into one of two completely separate app shells:
- `pages/ParentApp.jsx` — sidebar nav, manages tasks/rewards/family
- `pages/KidApp.jsx` — sidebar nav, completes tasks, redeems rewards

`contexts/AuthContext.jsx` handles session, profile fetch, push notification registration, and audit logging on login/logout.

### Data Flow

**Task lifecycle**: Parent creates a template in `task_templates` → schedules it as a `task_assignments` record (with `kid_id`, `due_date`, status `pending`) → Kid submits via `SubmitModal` which uploads photo to Supabase Storage (`task-photos` bucket), calls Gemini, and sets status to `submitted` (or `approved` if AI high-confidence) → Parent reviews and approves/rejects → Approval writes to `credit_ledger`.

**Credits**: `credit_ledger` is an immutable append-only table. `kid_balances` is a Postgres VIEW that sums it. Parents can also manually adjust via direct ledger inserts.

**Real-time**: `ParentDashboard` and `KidDashboard` subscribe to `postgres_changes` on `task_assignments`, `task_submissions`, and `credit_ledger`. Always clean up subscriptions in `useEffect` return.

### Supabase Edge Functions

Two Deno functions in `supabase/functions/`:

- **`send-push`** — Called client-side via `lib/notifications.js` to fan out Web Push notifications to a list of `userIds`.
- **`morning-agent`** — Scheduled daily: generates recurring task assignments for today (handles `daily`/`weekly`/`weekdays` recurrence types) and sends push summaries to both kids and parents.

Deploy with `supabase functions deploy <name>`. Requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` set as Supabase secrets.

### Gemini Integration

`lib/gemini.js` exports `analyzeTaskPhoto(photoBase64, mimeType, taskTitle, taskDescription)`. Returns `{ approved, confidence: 'high'|'medium'|'low', reasoning }`. Auto-approval in `SubmitModal` only fires when `approved === true && confidence === 'high'`. Fails gracefully if the API key is missing.

### Task Scheduler (Drag & Drop)

`components/parent/TaskScheduler.jsx` uses `@dnd-kit/core`. Drop zone IDs follow the pattern `${kidId}__${timeSlot}` (daily view) or `${kidId}__${dateString}` (weekly view). The task bank sidebar is the drag source; time/date cells are drop targets. `PointerSensor` (6px threshold) + `TouchSensor` (250ms delay) are both registered.

### Recurring Tasks

Recurrence is stored on `task_assignments` (`is_recurring: true`, `recurrence_type: 'daily'|'weekly'|'weekdays'`). The `morning-agent` edge function is the only thing that generates future occurrences — it reads past recurring assignments and inserts new ones for today, deduplicating by `template_id + kid_id`.

### Release Process

`npm run push` (via `scripts/push.cjs`) bumps the minor version in `package.json`, prepends a new entry to `src/data/releases.js` using commits since the last version bump, commits both files as `chore: bump version to X.Y.0`, and pushes to `main`. Vercel auto-deploys on push.

### Database Schema

Full schema is in `supabase/schema.sql`. Key notes:
- RLS is enabled on all tables. Kids can only read their own assignments/ledger; parents can read everything.
- `kid_balances` is a view, not a table — don't try to insert into it.
- `task_submissions.ai_approved` and `parent_override` are both nullable booleans — null means not yet reviewed.
- `due_time` on `task_assignments` is a plain `TEXT` column (stored as `"HH:MM"`), not a time type.
