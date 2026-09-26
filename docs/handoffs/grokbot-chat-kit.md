# GrokBot chat kit: handoff to Codex

**Preview:** `http://localhost:3000/design/grokbot` (development only; it returns 404 in production). It plays the whole story on sample data: customer chat → Shopkeeper Ltd group chat → waitlist email, with every click wired up. **Replay story** restarts it.

Claude owns the look; Codex wires the real flow into `components/dashboard/demo-inbox.tsx`. Claude hasn't edited `demo-inbox.tsx` or `workspace.tsx` for this.

## Files

- `components/grok/grok-chat.tsx`: the kit. It only renders things and holds no flow state.
- `components/grok/grok-chat.module.css`: all the kit's styles. The colours were sampled from the GrokBot desktop app.
- `components/dashboard/bot-presence.tsx`: `BotAvatar` takes a new `shape` prop: `blob | circle | pill | hexagon | triangle | cloud`. That's the bot's resting face. Any mood other than `idle` morphs it (thinking cloud, typing pill, waiting squircle, done flower, paused puddle, error triangle).
- `app/design/grokbot/story.tsx`: the reference wiring. Copy its copy, gates and timings.

## Pieces

| Piece | Use it for |
|---|---|
| `GrokWindow sidebar={…}` | The dark window. Put a `GrokChat` inside it. |
| `GrokSidebar title sections activeId onSelect footer` | GrokBot's chat list. An item has `{ id, name, face, preview, tag, unread, locked }`. Set `unread` on the next chat about a second before the story moves there, so it pulses. Use `locked` for chats the story hasn't reached yet. |
| `GrokChat id title face tag footer` | The open chat. Changing `id` slides the new chat in. The log stays pinned to the newest message. |
| `Msg side author face tag type onTyped attachment` | `in` goes on the left (customer, supplier, agents); `out` goes on the right (you, or the sales agent answering a customer). `type` makes a string type itself out. `attachment` sits under the bubble. |
| `Typing side face author` | Show it about 0.9s before a message lands. A bot face switches to its thinking shape automatically. |
| `Note` | A centred system line, like "Sales agent passed this to Shopkeeper Ltd". |
| `ChoiceList choices selected onSelect disabled label` | The supplier picker. Once picked, pass `disabled`: the chosen supplier stays bright and the others fade. |
| `EmailCard to subject body state onSend sendLabel sentLabel` | Both the supplier order email and the waitlist email. `state: 'draft' → 'sent'`. |
| `InvoiceCard number from lines total due state onPay` | The supplier invoice. `state: 'due' → 'paid'`. |
| `Recipients people sent` and `ReactionBar people` | The waitlist. Once `sent`, rows tick to Delivered and reactions pop in one after another. It's pure CSS, with no timers. |
| `PrimaryButton`, `StatusBar action` | GrokBot's white pill button, and the bar where the message box would be: it shows what's happening now and your next action. |
| `AGENTS` | The agents' faces (sales, stock, sourcing, outreach, purchasing, care). Use the same face for an agent in every chat. |

## Rules that make it feel real

- **Type once.** Only type a message the first time it appears. If the user leaves a chat while a message is still typing, show it in full when they come back (see `seen` in `story.tsx`).
- **Leave room for typing.** A typed message takes about 1.3s. Leave at least 1.4s before the next message in the same chat.
- **Moods follow the story.** Use `thinking` while an agent is about to speak in that chat, `waiting` while a gate waits on the merchant, and `done` at the end. Everything else is `idle`, which shows the agent's resting shape.
- **Keep it labelled.** Keep the "Simulated demo" sidebar footer. Nothing is sent or charged.
