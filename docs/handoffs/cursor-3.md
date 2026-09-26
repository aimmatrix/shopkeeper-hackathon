# Cursor 3 — accessibility and mobile QA

Audit only. No application files or demo records were changed. Primary Codex should apply these fixes in `components/workspace.tsx` and `app/globals.css`.

`npm run typecheck` passed (`tsc --noEmit`, exit 0). No generated `.next` type errors.

## What was tested

Live app at `http://localhost:3000/` in the Cursor browser.

| Viewport | What was exercised |
| --- | --- |
| 1920×1080 | Overview, Inventory, Connections. Help sheet opened from the workspace profile control and closed with Escape. |
| 390×844 CSS px (`deviceScaleFactor: 2`) | Overview, Inventory, Connections. `documentElement.clientWidth` was 390. |
| 320×720 CSS px (`deviceScaleFactor: 2`) | Overview and Inventory. `documentElement.clientWidth` was 320. |

Emulation was cleared afterward; the tab was back at 1920×1080.

Not clicked, because they write shared demo data or start the walkthrough: **Review restock plan**, the hoodie row action, **Approve**, **Reset demo**, **Run the demo**, **Take the walkthrough**. The proposal drawer was not opened. Its only UI path calls `openProposal()`, which POSTs `prepare_proposal` and appends an activity row. The drawer was reviewed from `components/workspace.tsx` (the dialog block) and `app/globals.css`, against the help sheet, which uses the same backdrop pattern and was opened live.

Keyboard: the accessibility tree tab order on Overview is the 17 named controls from “Shopkeeper home” through “View all activity”. Escape is handled by the `window` keydown listener in `components/workspace.tsx` (around the `setProposal(false); setHelp(false)` effect) and did close the help sheet. The browser Tab control used here dispatches a DOM key event and does not move focus, so this pass did not claim a live Tab walk.

`prefers-reduced-motion: reduce` was emulated. Computed `transition` and `animation` on a `.button.dark` became `none` / `0s`, matching `app/globals.css` `@media(prefers-reduced-motion:reduce)` (`animation:none!important;transition:none!important`). No motion fix needed.

Icon buttons that exist as buttons already have names: “View latest activity”, “Review Everyday Hoodie restock”, “Close help”, and in source “Close proposal”, “Decrease order quantity”, “Increase order quantity”, “Dismiss error”, “Dismiss notification”. Inventory search has `aria-label="Search products"`.

## Findings

### 1. High — at 320px the hero headline and supporting line are covered by the hoodie art

On Overview at 320×720, “Your bestseller. Almost sold out.” renders as “Almost sold o…” and the line under it (“14 units wanted…”) is covered. The “Review restock plan” button was still readable.

Cause is the `max-width:440px` block in `app/globals.css`: `.rescue-feature{grid-template-columns:1.6fr 1fr}` (measured `145px 91px` at 320), `.feature-art{margin-left:-35px}`, `.feature-art>svg{width:195%}`, and `.rescue-feature{overflow:hidden}`. The SVG box overlaps `.feature-copy h2` and `.feature-copy>p` (about 15,600px² and 6,000px²). At 390×844 the same rules apply and the SVG box still overlaps the text column, but the painted hoodie sat far enough right that the heading still read in full. `body.scrollWidth` matched the layout width at both sizes, so this is overlap inside the card, not a page-level scrollbar.

**Fix:** under `max-width:440px`, stack `.rescue-feature` to one column, drop the negative margin and `width:195%`, and clip inside `.feature-art` (`overflow:hidden`) so the illustration cannot paint over `.feature-copy`.

### 2. High — help and proposal dialogs do not keep keyboard focus inside the dialog

Help sheet, opened live from `.profile` (`components/workspace.tsx`, `setHelp(true)`):

- `role="dialog"` `aria-modal="true"` `aria-label="About the demo"` is present.
- Focus stayed on “Ammad’s workspace”. `.help-sheet` has no `tabIndex` and nothing moves focus in on open.
- `.app-shell` is not `inert`. Thirteen buttons outside the dialog stayed in the accessibility tree, including **Reset demo** on Connections.
- Close control is a 31×31 `.icon-button` named “Close help”. Escape closes it and focus remains on the profile button, which is correct only because focus never entered the dialog.

Proposal drawer, from source (`components/workspace.tsx` proposal block, `useEffect` that calls `drawerRef.current?.focus()`):

- Same backdrop, `aria-modal="true"`, label “Review restock proposal”.
- Initial focus is the `<section class="proposal-drawer" tabIndex={-1}>`. That section has `outline:0` in `app/globals.css`, and the global focus ring is only `button:focus-visible, a:focus-visible, input:focus-visible`, so the focused surface has no ring.
- No focus trap and no `inert` on the page behind it. Supplier choices are `<button class="quote-option">` with a selected class only: no `role="radiogroup"` / `aria-checked`. Quantity steppers are named. Do not change the approve copy or wire it differently; just keep it in the tab loop after the choices.

**Fix:** on open, move focus to the close button (or the heading with `tabIndex={-1}` and a visible `:focus-visible` ring). Set `inert` on `.app-shell` while a dialog is open. Cycle Tab inside the dialog. On close, return focus to the trigger. Remove `outline:0` from `.proposal-drawer`. Mark the selected quote with `aria-pressed="true"` or a real radio group.

### 3. High — status and supporting text sit around 2.6:1 to 3.4:1

Measured on the live Overview, Inventory, Connections, and help sheet (desktop). Normal text needs 4.5:1. These are the pairs that carry meaning:

| Selector (`app/globals.css`) | Sample | Approx. ratio | Size |
| --- | --- | --- | --- |
| `.product-table th` `#929a86` on `#f2f5ec` | “Product”, “Status” | 2.65:1 | 10px |
| `.status-pill.amber` `#a78c58` on `#f4edde` | “Out of stock” | 2.76:1 | 8px |
| `.page-heading p` `#929886` on `#f7f8f3` | Overview subtitle | 2.79:1 | 11px |
| `.activity-row p` `#9ba28e` on `#fbfcf7` | Activity detail | 2.56:1 | 8–10px |
| `.feature-copy>p` `#818c71` on `#e9eddc` | Hero supporting line | 2.97:1 | 11px |
| `.status-pill.green` `#7d8f64` on `#edf2e4` | “Healthy”, “Connected” | 3.08:1 | 8–9px |
| `.help-sheet p` `#869774` on `#fafbf5` | Help body | 3.02:1 | 12px |
| `.help-sheet ol` `#82966c` on `#fafbf5` | Walkthrough steps | 3.09:1 | 11px |
| `.stock-low` `#a8844c` | Available “0” | 3.36:1 | 12px |
| `.proposal-drawer .drawer-intro` `#8d9b79` on `#fafbf5` | Proposal intro (CSS) | 2.84:1 | 11px |

`.breadcrumb strong` (`#4d5941` on `#f7f8f3`, about 7:1) already passes. The global focus ring `#657946` on `#f7f8f3` is about 4.5:1, which is enough for a non-text indicator.

**Fix:** darken `.page-heading p`, `.feature-copy>p`, `.activity-row p`, `.product-table th`, `.table-sub`, `.status-pill.amber`, `.status-pill.green`, `.status-pill.neutral`, `.stock-low`, `.help-sheet p`, `.help-sheet ol`, and `.drawer-intro` toward `#4d5941` / `#526645` until each pair is at least 4.5:1. Keep status as text plus the pill, which you already do.

### 4. High — at 320px and 390px the inventory row action is off-screen

`.product-table{white-space:nowrap}` and `.table-scroll{overflow:auto}` (`app/globals.css`). The scroller has no `tabIndex`.

| Viewport | Visible table width | Table scroll width | “Review Everyday Hoodie restock” |
| --- | --- | --- | --- |
| 320 | 236px, right edge 305 | 443px | left edge 471, not visible |
| 390 | 306px, right edge 375 | 443px | left edge 471, not visible |

Screenshots match: “Out of stock” is cut to “Out of stoc…”, and Price plus the action button are past the card. Touch can swipe the region; nothing shows that it scrolls, and keyboard users never land on the scroller. Other product rows put an unlabelled Lucide `Check` SVG in that Actions cell (`components/workspace.tsx` product table). It is not a button and has no name.

Search at 320: `.search-field input` is 8px with `outline: none` (see finding 8).

**Fix:** below 760px, let the table wrap or stack each product (name, stock, status, action) so the hoodie action stays on screen. If horizontal scroll remains, give `.table-scroll` `tabIndex={0}` and an accessible name, and a visible scroll hint. Hide the decorative check from assistive tech (`aria-hidden`) or replace it with text such as “No action”.

### 5. Medium — several controls are under the 24px target-size minimum

WCAG 2.2 target size (2.5.8) minimum is 24×24 CSS px. Measured at 1920×1080 unless noted:

| Control | Size | Where |
| --- | --- | --- |
| `.text-button` “View inventory”, “View all activity”, “See the conversations” | 15px tall | Overview. `app/globals.css` `.text-button` has no min-height |
| `.phone-note button` “Connect GrokBot” | 14×102 | Sidebar, desktop |
| `.icon-button` | 31×31 | Bell, hoodie row action, help close. Above 24px, short of a 44px touch target |
| `.page-heading>.button` “Run the demo” | height 33px at 390 | `min-height:32px` in the 760px block |
| `.nav-item` in the icon sidebar | about 43×45 at 390 | Passes 24px. `min-height:40px` on `.nav-item[aria-label]` is already there |

**Fix:** give `.text-button` and `.phone-note button` at least 24px of block size (44px is the better touch size on the phone layout). Raise `.icon-button` to 44×44, especially `.close-help` and the proposal close button.

### 6. Medium — at 760px and below, help cannot be opened and the activity bell is gone

`@media(max-width:760px)` in `app/globals.css` sets `.store-selector, .profile, .phone-note {display:none}` and `.topbar-actions>.icon-button{display:none}`.

Confirmed in the accessibility tree at 390 and 320: those controls are absent. Both help triggers (store selector and profile) are in that list, so the help sheet cannot be opened. “Connect GrokBot” goes with `.phone-note`. “View latest activity” goes with the topbar icon button. Connections remains, and nav icons keep their `aria-label`s, which is right for the icon sidebar.

**Fix:** keep a 44px icon button for help and for the bell, with the labels you already have (“About the demo” / “View latest activity”), in the icon rail or the top bar. Do not `display:none` the only path to the dialog.

### 7. Medium — supporting type drops to 4.5–9px at 440px and below

`@media(max-width:440px)` in `app/globals.css`, measured live at both 320 and 390:

| Selector | Computed size |
| --- | --- |
| `.feature-kicker` | 4.5px |
| `.stock-sticker` | 4px |
| `.page-heading .eyebrow`, `.feature-footnote small` | 5.5px |
| `.metrics-strip small` | 7px |
| `.page-heading p`, `.feature-copy>p`, `.inventory-statement p` | 9px |
| `.search-field input` (760px block) | 8px |

The metric captions (“14 units wanted · unfulfilled interest”, “From completed demo checkouts”) are faint and tiny next to the £ figures. Headings themselves stay large (h1 29px, hero h2 31px).

**Fix:** floor supporting text at 12px and eyebrows/kickers at 11px inside the 760px and 440px blocks. Do not scale `.stock-sticker` or `.feature-kicker` down with the viewport.

### 8. Medium — two inputs cancel the focus ring, and the current nav item is only a colour

Global ring, `app/globals.css` line 4: `button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid #657946 }`.

These later rules share specificity `(0, 1, 1)` and set `outline:0`, so a keyboard focus ring never appears:

- `.search-field input` (Inventory; confirmed computed `outline: none`)
- `.chat-compose input` (inbox composer; same pattern, not opened in this pass)

`.proposal-drawer{outline:0}` is covered in finding 2.

Nav, `components/workspace.tsx`: each `.nav-item` sets `aria-label` to the section name, which replaces the contents. The inbox badge (`.nav-count`, it showed 1) is not part of the accessible name. The selected section uses `.nav-item.active` colour only. There is no `aria-current="page"`. `main#main-content` exists and there is no skip link, so keyboard users walk the whole sidebar before the heading.

**Fix:** delete `outline:0` on those inputs and show focus with `.search-field:focus-within` / `.chat-compose:focus-within` border instead. On the active nav button set `aria-current="page"`. Keep `aria-label` for the icon sidebar (the visible `<span>` is `display:none` under 760px) and append the count when it is greater than zero, for example “Customer inbox, 1 waiting”. Add a skip link to `#main-content` as the first focusable control.

## Completion handoff

Audit only. Fixes are not applied. Nothing was deployed. No feature was mounted.

### Changed files

| File | What changed |
| --- | --- |
| `docs/handoffs/cursor-3.md` | This report. |

No other files were edited. Shared demo data was not reset, approved, or ordered.

### Commands run and results

| Command | Result |
| --- | --- |
| Browser audit of `http://localhost:3000/` | Completed. Viewports 1920×1080, 390×844, and 320×720. Overview, Inventory, Connections, and the help sheet. Device emulation and reduced-motion emulation were cleared afterward. |
| `npm run typecheck` (`tsc --noEmit`) | Exit 0. No generated `.next` type errors. |

No test suite was run. This pass did not change application code.

### Remaining blockers

Primary Codex still owns the fixes. Until they land in `components/workspace.tsx` and `app/globals.css`:

1. At 320px the Overview hero illustration covers the headline and supporting line.
2. Help and proposal dialogs do not trap focus. Help does not move focus inside on open. The proposal section is focused with `outline: 0`.
3. Status and supporting text is about 2.6:1–3.4:1.
4. At 320px and 390px the inventory restock button is outside the visible table.
5. “View inventory”, “View all activity”, “See the conversations”, and “Connect GrokBot” are under 24px tall. Icon buttons are 31px.
6. At 760px and below, help cannot be opened and the activity bell is `display: none`.
7. Supporting type is 4.5–9px at 440px and below.
8. Search and chat inputs cancel the focus ring. The current nav item has no `aria-current`, and the inbox count is omitted from the accessible name.

The proposal drawer was not opened live. Opening it POSTs `prepare_proposal`. A live Tab walk was not completed: the browser Tab control dispatches a DOM key event and does not move focus. Escape on the help sheet was verified.

### Environment variables

None. This audit did not read or require any API key.

### Integration steps

Primary Codex applies the eight fixes above. Do not treat this document as already integrated.

1. In `app/globals.css`, under `max-width: 440px`, stack `.rescue-feature` to one column, remove `.feature-art { margin-left: -35px }` and `.feature-art > svg { width: 195% }`, and set `.feature-art { overflow: hidden }`.
2. In `components/workspace.tsx`, when `help` or `proposal` is open: focus the close button, set `inert` on `.app-shell`, keep Tab inside the dialog, and return focus to the trigger on close. Remove `outline: 0` from `.proposal-drawer`. Give `.quote-option` `aria-pressed` (or a radio group) for the selected supplier.
3. Darken the selectors in finding 3 toward `#4d5941` / `#526645` until each pair is at least 4.5:1.
4. Below 760px, stop using `white-space: nowrap` for `.product-table`, or stack each product so the hoodie action stays on screen. If the scroller remains, set `tabIndex={0}` and an accessible name on `.table-scroll`.
5. Give `.text-button`, `.phone-note button`, and `.icon-button` at least 44×44px on the phone layout (24px minimum everywhere).
6. At `max-width: 760px`, keep a labelled control for help and for “View latest activity”. Do not `display: none` the only path to either.
7. Floor supporting text at 12px and eyebrows/kickers at 11px in the 760px and 440px blocks.
8. Delete `outline: 0` on `.search-field input` and `.chat-compose input`. Use `:focus-within` on the field chrome. Set `aria-current="page"` on the active nav button, include the inbox count in its accessible name, and add a skip link to `#main-content`.
9. Re-check Overview, Inventory, Connections, help, and the proposal drawer at 1920, 390, and 320 without approving, resetting, or placing an order. Run `npm run typecheck` again after the CSS and component edits.
