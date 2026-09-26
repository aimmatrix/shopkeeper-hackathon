# Shopkeeper — demo script

One window, one story, three clicks. Everything happens on https://shopkeeper-hackathon.vercel.app (Today page).

**The story:** a customer asks for hoodies → the shop runs short → GrokBot has already picked the restock → you approve.

## Before you start (30 seconds)

1. Open the site. Click **North & Form** (top right) → **Reset demo store…** → **Reset**. GrokBot’s pick is kept.
2. Today should say **One thing needs you today**, with the yellow **GROKBOT’S PICK** card: **20 hoodies from North Thread · £452**.

## The demo

| # | Click | Say |
| --- | --- | --- |
| 1 | **Inbox** → **Try it: “Could I get two hoodies?”** | “A customer asks for two. We have one. Shopkeeper holds that one and logs the second as a waiting customer, not a fake sale.” Point at **What this changed**. |
| 2 | **Today** (top nav) | “That shortage lands here. GrokBot, our stock agent, already compared all three suppliers and picked this.” Click **Why GrokBot picked this** and read one line: lowest landed cost that fits the £500 budget. |
| 3 | **Approve restock** | “Nothing was ordered until I said yes. The 20 hoodies show as on the way, and they don’t count as sellable until they arrive.” |

To repeat step 3, click **Undo (demo)** on the same card. To repeat the whole story, reset again.

## How GrokBot is used (if asked)

- **Stock Manager GrokBot** opened our `/agent` page, read the live stock and the three supplier quotes, and saved a recommendation with its reasoning (20 × North Thread, £452). That is the yellow card on Today.
- **Sales & Recovery GrokBot** opened `/recovery`, read a stock request recorded by our Wassist WhatsApp concierge (so far from internal test chats, not a real customer), and saved a follow-up draft for the merchant to review. Drafts are never sent.
- GrokBot recommends and drafts. **Only the merchant approves.** It never spends money.
- It works through web pages, like a person would: it reads the page and fills in the form. It is not an API integration.

## Honest lines

- Sample shop, sample customer, sample supplier quotes. Stock, orders and GrokBot’s output are real saved records (Supabase).
- Inbox replies are a guided demo, not a live model. Checkout and supplier orders are simulated: no card is charged, no supplier is emailed.
- If the GrokBot card is missing, say so and approve from **Compare 3 suppliers**. The restock still works without it.

## Optional extra (only if there’s time)

WhatsApp → GrokBot follow-up: open `/recovery`, ask the Wassist WhatsApp concierge to “record my interest in two Everyday Hoodies in washed black, medium, for merchant review”. The request appears within five seconds (interest only, nothing reserved). Then ask the Sales & Recovery GrokBot to read `/recovery` and save a draft. **Add sample request** is the labelled rehearsal fallback.
