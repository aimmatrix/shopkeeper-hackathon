# Shopkeeper — build brief

Audience: independent online merchants managing sales conversations, inventory and suppliers from their phone.
Pain: stockouts lose sales, and a merchant must manually join customer demand to purchasing decisions.
Promise: turn a stockout into a fulfilment plan, with an explicit merchant decision and evidence of execution.

Primary track: Merchant Tooling. Secondary fit: Agentic Commerce.

## Demonstration
Customer requests two medium black hoodies. One is available. A real inventory reservation prevents overselling. Unmet demand feeds a restock proposal. Supplier quotes show minimum quantity, shipping and lead time. Merchant approves; a purchase order is recorded. Cancellation is requested and only confirmed by a supplier response. Receiving stock changes inventory once.

## Design direction
Confident, tactile, clear. Ivory surfaces, ink typography, acid-lime decision accents, quiet green statuses and editorial product illustrations. Desktop is a merchant workspace; mobile puts decisions first. Reduced-motion support and keyboard interaction are required.

## Data integrity
- Available = on hand minus reserved.
- Incoming supplier orders do not count as on hand.
- Monetary values use integer pence.
- Proposed purchases include MOQ and shipping.
- Repeated event identifiers do not duplicate writes.
- No fake live integration labels or invented supplier research.
- Seed quotes and customer history are explicitly demo data.

## Submission
Repository, demo recording (Loom/YouTube), one-line description, team member and Merchant Tooling track. Target ready by 16:00.
