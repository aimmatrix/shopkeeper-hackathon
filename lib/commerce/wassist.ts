import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Action } from '../types';

export class WassistRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function authenticateWassist(request: Request, token: string | undefined) {
  if (!token) throw new WassistRequestError('WhatsApp request intake is not configured.', 503);
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new WassistRequestError('Unauthorized tool request.', 401);
  // Wassist injects these headers; never accept an identity supplied by the language model.
  const contact = request.headers.get('x-wassist-contact-id');
  const conversation = request.headers.get('x-wassist-conversation-id');
  if (!contact || !conversation || contact.length > 200 || conversation.length > 200 || !/^[\w-]+$/.test(contact) || !/^[\w-]+$/.test(conversation)) throw new WassistRequestError('A verified Wassist conversation and contact are required.');
  return createHmac('sha256', token).update(`wassist:${contact}`).digest('hex');
}

export function stockRequestAction(body: unknown, contactRef: string): Extract<Action, { type: 'record_stock_request' }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new WassistRequestError('Send a product request.');
  const data = body as Record<string, unknown>;
  if (data.consent !== true) throw new WassistRequestError('Ask the customer for permission to record their product interest first.');
  if (typeof data.productId !== 'string' || !['hoodie', 'tee', 'bag', 'cap'].includes(data.productId) || !Number.isInteger(data.quantity) || Number(data.quantity) < 1 || Number(data.quantity) > 10) throw new WassistRequestError('Choose an exact catalogue product and between 1 and 10 units.');
  return { type: 'record_stock_request', channel: 'whatsapp', contactRef, productId: data.productId, quantity: Number(data.quantity) };
}
