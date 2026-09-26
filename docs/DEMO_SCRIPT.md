# Shopkeeper — click-by-click demo script

Aligned to the three-minute pitch in `docs/PITCH.md`. Primary Codex owns `http://localhost:3000`; do not start another server.

**Default path:** customer request → reservation / shortage → sample supplier comparison → phone approval → recorded purchase order.

## Pre-flight (before the judges sit down)

1. Confirm the primary dev server is already on port 3000.
2. Desktop window: `[PENDING — production URL]` or `http://localhost:3000`.
3. Phone or 390px window: same origin + `/mobile` (not linked from the sidebar; type the path).
4. On desktop, open **Connections**.
   - If purchase orders already exist, click **Reset demo**, then **Reset sample store**. If you change your mind, **Keep current data**.
   - Read the pills out loud later if asked: Supabase **Connected** or **Local database**; GrokBot **Ready to connect** / **Agent endpoint ready** / **Report received**; Tavily **Configured** or **Key needed**; Customer chat **Working demo**; Instagram **Not connected**.
5. Leave **Activity** **Pause workflow** untouched. If the store is paused, click **Resume workflow** (desktop) or **Resume demo workflow** (`/mobile`).
6. Optional silent check: `/shop` loads and shows **Sample store**. Do not sell this as a full checkout site.

If the workspace shows **Could not load your store**, click **Retry**. On `/mobile`, **Try again**.

## Seed numbers (after a reset)

Speak them only if they match the screen. After other people have used the shared store, trust the UI.

| Field | Seed |
| --- | --- |
| Product | Everyday Hoodie · Washed black / M · EH-BLK-M · **£68** |
| On hand / reserved / available | 8 / 7 / **1** |
| Unmet demand | **12** wanted |
| Sample quotes | **North Thread** (Manchester, UK · £22 · MOQ 20 · £12 ship · 3 days) · **Atelier Porto** (Porto · £18.50 · MOQ 30 · £35 ship · 8 days) · **East London Supply** (London · £25 · MOQ 10 · £8 ship · 2 days) |

After the scripted customer request below, available should be **0**, one unit reserved on a new **NF-…** order, unmet demand **13**.

## Timed clicks (0:55–2:20 of the pitch)

### 0:55 — Start the walkthrough

On **Overview**, click **Run the demo**.  
Toast: *Step 1: send the suggested customer request. Each step writes real demo records.*  
Chips: **Customer request** · Stock signal · Your decision · Order recorded.  
You land on **Customer inbox**, conversation **Alex Morgan**, channel **Web chat demo**.

*(If you opened the North & Form help sheet by accident, click **Take the walkthrough** — same start — or close it.)*

### 1:05 — Customer request

Click **Try: “Can I get two medium black hoodies?”**  
Do not type a different product or size. The parser only reserves this medium washed-black hoodie.

Wait for **Sales manager · demo workflow**. Expected meaning, not a verbatim recitation: one unit reserved at £68; one unit short, recorded as interest; *this is a demo reservation; no payment has been taken.*

Point at the right rail: **available / reserved / incoming**, then the new **RESERVED · NF-…** card.  
Say: we held the unit that exists. We did not invent the second hoodie.

Optional, only if a judge asks about payment: **Complete demo checkout** on that card. Toast: *Demo payment recorded. Inventory updated.* Prefer to skip this so the restock remains the climax.

### 1:25 — Shortage on the same ledger

Click **Inventory**. Everyday Hoodie should read **0** available, **Running low** or **Out of stock**, demand chip **13 wanted**. Footer: *Available stock excludes reservations. Incoming stock is counted only when received.*

That is the stock signal: a chat message became a number purchasing can use.

### 1:35 — Sample supplier comparison (desktop, do not approve yet)

Click **Suppliers & orders**. Three cards; each says **Sample quote · not a live offer**. North Thread is tagged **Existing supplier**.

Click **Compare this supplier** on North Thread **or** **Prepare restock plan**. The drawer **Review restock proposal** opens: demand, incoming, sample pace, quote radio rows, quantity, **Total commitment**. The approve button reads **Approve £452 restock** at the drawer default (20 × North Thread + shipping) — **do not click it**. The story’s yes happens on the phone. Close with **Close proposal** (X) or Escape.

Optional extra, not on the critical path: the suppliers view now mounts **Research suppliers** (Tavily evidence cards; **UK** / **Europe**). Skip it in the timed demo. If it shows **Live research is switched off** or **Search didn’t complete**, click **Try again** once or ignore it. Discovery never overwrites the sample quotes.

### 1:50 — Phone approval

On the phone window, `…/mobile`. Header **Desktop** · **Shopkeeper.** · **Live · v…**.

You should see the Everyday Hoodie as the urgent item, **Why this restock**, and **Agent recommendation**. If GrokBot is not connected, the copy is that no model output is shown — that is correct. Do not ad-lib a recommendation.

**Supplier decision** steps: Prepare · Choose · Approve.

- If the dock says **Prepare restock proposal**, click it. Notice: *Proposal ready. Compare suppliers, then approve.*
- If it already says **Review demo restock · £…**, the desktop prepare already armed it.

Leave **North Thread** selected (**Store default**, or **Agent pick** only if a real `/agent` report exists). After the hoodie request, suggested quantity is typically **25**, dock **Review demo restock · £562**. If the figure differs, read the dock, not this script.

Click **Review demo restock · £…**. Confirm copy: demo only — no payment, no real order. Click **Confirm demo restock** (busy label **Approving…**).  
Notice similar to *PO-… recorded as a demo restock.* On-hand unchanged; **Incoming** rises. That is the point.

If the dock already says **Manage incoming order on desktop**, someone approved earlier — reset on Connections and restart from **Run the demo**.

### 2:10 — Order recorded

Back on desktop, click **Suppliers & orders** (wait up to five seconds if the row has not appeared). Purchase orders: **PO-… · North Thread**, status **ordered**, total including shipping. Incoming still separate from available.

If there are ~10 seconds left, say you could **Request cancellation** (still incoming until the demo supplier answers) or **Simulate delivery** (on-hand updates **once**). Do not click them unless a judge asks. **Simulate supplier confirmation** exists only after a cancel request.

Walkthrough chips on desktop may **not** jump to **Order recorded** after a phone approval — that counter is local to the desktop session. The live proof is the purchase-order row and `/mobile` showing incoming.

## Fallback (one path)

**If Tavily, GrokBot, or `/agent` fails or is unconfigured:** skip research and skip any recommendation banner. Compare the three sample quotes, approve on `/mobile` with **Confirm demo restock**. One sentence: “The agent and live search are switched off; the ledger and the sample quotes still complete the restock.”

**If `/mobile` errors:** stay on desktop, reopen **Prepare restock plan**, click **Approve £… restock**. Footer: *Creates a demo purchase order. No money is spent.* Same commerce outcome, weaker “in your pocket” beat.

**If the customer send fails:** check we are not paused; retry the same suggestion chip. Wrong variant (small / white / etc.) will refuse to reserve — good, do not “fix” it live.

## Optional 15-second coda (only if the main path is done)

`/shop`: **Sample store**, hero **Reserve 1 with the assistant**, assistant labelled **Guided demo**. Footer **Open the merchant workspace**. Do not browse-buy the tee, tote or cap.

## Button index (implemented labels only)

| Surface | Control |
| --- | --- |
| Desktop chrome | **Run the demo**, **Overview**, **Customer inbox**, **Inventory**, **Suppliers & orders**, **Activity**, **Connections**, **Connect GrokBot**, **Retry** |
| Inbox | **Try: “Can I get two medium black hoodies?”**, **Review restock**, **Complete demo checkout** |
| Overview | **Review restock plan** / **Track your order**, **See the conversations**, **Review recommendation** (only if a report exists) |
| Suppliers | **Prepare restock plan**, **Compare this supplier**, **Research suppliers**, **Request cancellation**, **Simulate delivery**, **Simulate supplier confirmation** |
| Proposal drawer | **Approve £… restock** (or **An order is already on the way**), **Close proposal** |
| Activity / Connections | **Pause workflow** / **Resume workflow**, **Reset demo**, **Keep current data**, **Reset sample store** |
| `/mobile` | **Desktop**, **Prepare restock proposal**, **Resume demo workflow**, **Review demo restock · £…**, **Back**, **Confirm demo restock**, **Manage incoming order on desktop**, **Try again** |
| `/shop` | **Reserve N with the assistant**, **Register restock interest**, **Demo checkout**, **Confirm demo checkout**, **Not now**, **Merchant view** |
| `/agent` | **Save recommendation for merchant** — inspect only; do not present as GrokBot unless primary has connected it |

## Lines not to say

- That Instagram is connected, or that arbitrary products can check out.
- That payments, supplier emails or factory orders are real.
- Customer interviews, conversion lifts, revenue recovered, or “fully autonomous”.
- Invented GrokBot or Tavily output. If the screen is empty, say it is empty.
