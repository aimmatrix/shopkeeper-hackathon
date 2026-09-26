# Shopkeeper — three-minute pitch

**Track:** Merchant Tooling (secondary fit: Agentic Commerce)  
**Product:** Shopkeeper · sample merchant **North & Form**  
**Presenter:** Ammad  
**Target ready:** 16:00

## One-line submission description

Shopkeeper turns a customer hoodie request into a live stock reservation, an honest shortage, and a merchant-approved restock — connecting inbox, inventory and suppliers without pretending the purchase is real.

## Placeholders still owned by primary Codex

| Field | Status |
| --- | --- |
| Repository URL | `[PENDING — git remote / GitHub URL]` |
| Live demo URL | https://shopkeeper-hackathon.vercel.app |
| Demo recording | `[PENDING — Loom or YouTube]` |
| GrokBot stock manager | Verified browser handoff: saved a 20-unit North Thread recommendation at £452 to Supabase; merchant approval remains separate |

## What to say (timed)

**0:00 — Open.** Independent merchants lose sales in the gaps: the customer is in chat, the stock is in a spreadsheet, and the supplier decision lives in someone’s head. By the time those three meet, the unit is gone or the restock is a guess.

**0:20 — The store.** North & Form is a fictional premium clothing shop. Shopkeeper is the merchant workspace behind it. This is a guided demo with real persisted records, not a slideshow.

**0:35 — The story we will click.** A customer asks for two medium washed-black Everyday Hoodies. One unit can be sold, so it is reserved immediately. The second unit is unmet demand, not a fake sale. That shortage feeds a restock proposal. The merchant compares sample suppliers on the phone, approves a demo purchase order, and the order is recorded. Incoming stock still does not count as available.

**0:55 — Demo (see `docs/DEMO_SCRIPT.md`).** Speak over the clicks; do not narrate every label. Point at three facts as they appear: **available vs reserved**, **unmet demand**, **incoming ≠ on hand**.

**2:20 — What is actually live.** Catalogue, Alex Morgan, and the three supplier quotes are sample data. Inventory, reservations, purchase orders and activity are persisted — to Supabase when it is connected, otherwise a local demo file in development. Inbox replies are a deterministic parser for this hoodie workflow, labelled as a demo workflow. Checkout and supplier orders write records only; no card is charged and no factory is emailed. Instagram is **not connected**. Tavily supplier search is optional evidence and never overwrites the sample quotes. The real GrokBot Stock Manager used `/agent` to save its recommendation: 20 hoodies for £452. Wassist now reads this same store’s live catalogue; a tested query returned 1 hoodie at £68. WhatsApp reservation writes and automated recovery are not implemented.

**2:40 — Close.** Shopkeeper does not run the shop by itself. It puts the request, the shortage and the restock on the same record, so the only thing left is an explicit yes. That is how a small merchant stays in stock without pretending the software already spent the money.

## Honesty board (say this if asked)

| Piece | What it is |
| --- | --- |
| Everyday Hoodie, Heavyweight Tee, Market Tote, Studio Cap | Sample catalogue |
| North Thread, Atelier Porto, East London Supply | Sample quotes, labelled in the UI |
| Alex Morgan / “Web chat demo” | Sample customer; messages update live stock |
| Inbox replies | Deterministic, hoodie-only; not a live model |
| `/shop` assistant | Same guided parser; labelled **Guided demo** |
| Reservations, POs, activity | Real rows in the live store state |
| **Complete demo checkout** / **Confirm demo restock** | Simulated payment / simulated supplier order |
| Tavily **Research suppliers** | Live web search only if `TAVILY_API_KEY` is set; discovery, not an offer |
| GrokBot | Stock Manager browser handoff verified; Sales & Recovery Manager created/scoped only; no autonomous purchasing |
| Wassist | Live catalogue API tool verified in internal simulation; user phone test pending; read-only |
| Instagram | Status **Not connected** |

Supported purchase path today: **medium washed-black Everyday Hoodie**. Do not imply arbitrary-product checkout.

## Seven-criterion mapping

| Criterion | How this build answers it | Do not inflate |
| --- | --- | --- |
| **Problem** | Customer request, stock and supplier choice are separate tools, so merchants oversell or restock late. | No survey stats, no “£X recovered”. |
| **Experience** | Ivory / olive / ink workspace, editorial product art, desktop for the store, `/mobile` for the decision. | Not a generic AI chat skin. |
| **Execution** | Typed commerce engine, optimistic versions, same-origin API, working inbox → reserve → propose → approve path. | Other catalogue items are browse-only. |
| **AI / GrokBot** | GrokBot Stock Manager saved a real recommendation through `/agent`; Wassist answers from live catalogue facts. The web inbox remains a guided demo. | Do not imply purchases or recovery messages happen autonomously. |
| **Commerce depth** | Available = on hand − reserved; incoming excluded until received; MOQ, shipping and lead time on the approval; duplicate incoming orders blocked; cancellation needs a supplier confirm. | Demo money only; integer pence in the engine. |
| **Originality** | The product is the join: a conversation becomes a reservation and a shortage that can be purchased against, with an honest demo/live split. | Instagram is optional and unused. |
| **Impact** | A judge can watch one request become a held unit, a demand signal and a recorded PO in three minutes. | No claimed merchants, savings, or production GMV. |

## Fallback line (if an integration fails)

If **Research suppliers** or GrokBot is unavailable, keep going: the three sample quotes are the comparison, and **Confirm demo restock** still records the purchase order. Say: “Discovery and the agent are optional. The restock decision uses the verified sample quotes and the live stock ledger.”
