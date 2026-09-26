export type NegotiatedTerms = { quantity: number; unitCost: number };

export function recommendedOffer(unitCost: number, quantity: number): NegotiatedTerms {
  const units = Math.min(500, Math.ceil(quantity * 1.5));
  const discount = units >= quantity * 1.5 ? 0.08 : 0.04;
  const floor = Math.ceil(unitCost * (units >= quantity * 1.5 ? 0.90 : 0.95));
  return { unitCost: Math.max(floor, Math.floor(unitCost * (1 - discount) / 50) * 50), quantity: units };
}

export function offerError(unitCost: number, quantity: number, originalCost: number, minimum: number): string {
  if (!Number.isInteger(quantity) || quantity < minimum || quantity > 500) return `Choose a whole quantity between ${minimum} and 500.`;
  if (!Number.isInteger(unitCost) || unitCost < 1 || unitCost >= originalCost) return 'Choose a positive price below the original quote, with at most two decimal places.';
  return '';
}

/** Deterministic supplier policy for the simulated negotiation. Empty means accepted. */
export function rejectionReason(offer: NegotiatedTerms, originalCost: number, originalQuantity: number): string {
  const capacity = Math.min(500, originalQuantity * 3);
  if (offer.quantity > capacity) return `We cannot supply ${offer.quantity} units in the quoted delivery window.`;
  if (offer.quantity < originalQuantity) return 'We cannot discount a smaller order.';
  const discount = offer.quantity >= originalQuantity * 2 ? 15 : offer.quantity >= originalQuantity * 1.5 ? 10 : 5;
  const minimumPrice = Math.ceil(originalCost * (100 - discount) / 100);
  if (offer.unitCost < minimumPrice) return `That price is below what we can accept for ${offer.quantity} units. Our maximum discount at this volume is ${discount}%.`;
  return '';
}
