# Cursor 2 — completion handoff

Pitch and demo materials only. No application code, slides, secrets, migrations, commits, or deployment.

## Changed files

- `docs/PITCH.md` — three-minute spoken pitch, one-line submission description, seven-criterion mapping, honesty board, pending URL table
- `docs/DEMO_SCRIPT.md` — timed click-by-click path with currently implemented button names, seed numbers, one integration fallback
- `docs/handoffs/cursor-2.md` — this summary

Not claimed: GrokBot live, Instagram, production URL, recording, CSV export UI, or `/api/assist` in the inbox (workspace still posts `customer_message`).

## Commands run and results

- Read build brief, coordination file, engine/types/store, workspace, `/mobile`, `/shop`, `/agent`, research component, `.env.example`. Did not read `.env.local`.
- `npm run typecheck` → exit 0 (`tsc --noEmit`). No `.next` type errors in that run.
- No targeted test file for this stream. Did not start a second dev server, run `next build`, migrate, reset the live store, or deploy.

## Remaining blockers

1. **Submission URLs** — `[PENDING]` in `docs/PITCH.md`: GitHub remote, production URL, Loom/YouTube. Branch `codex/shopkeeper` still has no commits and no `git remote`.
2. **GrokBot stock manager** — still being completed by primary. Pitch treats it as incomplete. Quote the Connections pill only if it actually reads **Agent endpoint ready** or **Report received**. `/agent` records a recommendation; it does not approve a purchase.
3. **Tavily** — optional. `SupplierResearch` is now mounted on **Suppliers & orders**. If the panel is unavailable or errors, skip it; sample quotes are the comparison.
4. **Walkthrough chips** — desktop **Order recorded** only advances when the desktop drawer approves. Phone **Confirm demo restock** writes live state (poll ~5s) but does not move those chips. Presenter should point at the PO row.
5. **Shared demo state** — seed figures (1 available → reserve 1 of 2; typical phone North Thread 25 / **£562**) assume **Reset sample store**. An existing incoming PO blocks a second approve.

No deployment or feature integration was completed by this agent.

## Required environment-variable names (never values)

This stream adds none. Status lines in the pitch depend on keys primary already owns:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY`
- `SHOPKEEPER_WORKSPACE_KEY`
- `TAVILY_API_KEY` (live research; missing → explicit unavailable; sample quotes still valid)
- `SHOPKEEPER_AGENT_TOKEN` (authorized agent / Connections GrokBot pill; not the same as a finished stock-manager job)

Do not paste values into pitch, script, recording, or this handoff.

## Exact integration steps

1. Use `docs/PITCH.md` as spoken copy and the form one-liner; use `docs/DEMO_SCRIPT.md` for the recording. Track: **Merchant Tooling**.
2. Before recording: existing server on port 3000 only; reset the sample store if a PO is already incoming; desktop on `/`; second window on `/mobile` (not in the sidebar).
3. Fill the three `[PENDING]` URL rows when the repo, production host, and Loom/YouTube exist.
4. If GrokBot is connected by then, say only what the UI shows. If not, use the written fallback: sample quotes + **Confirm demo restock**.
5. Do not invent Instagram, savings, revenue recovered, autonomous purchasing, or checkout for products other than the medium washed-black Everyday Hoodie.
6. Optional niceties for primary (not required to pitch): sidebar or Overview link to `/mobile`; advance walkthrough chips when a PO appears from another client.
