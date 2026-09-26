import { available, type ShopState } from './types';

export const EXPORT_TYPES = ['inventory', 'orders', 'purchases', 'activity'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const UNSUPPORTED_EXPORT_TYPE =
  'Unsupported export type. Use inventory, orders, purchases or activity.';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const BOM = '\uFEFF';

export function parseExportType(value: string | null | undefined): ExportType | null {
  const type = value?.trim();
  return type && (EXPORT_TYPES as readonly string[]).includes(type) ? (type as ExportType) : null;
}

/** Integer pence → explicit pounds with two decimal places, e.g. 6800 → "68.00". */
export function penceToGbp(pence: number): string {
  const n = Number.isFinite(pence) ? pence : 0;
  return (n / 100).toFixed(2);
}

export function csvField(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  const guarded = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (guarded !== value || /[",\r\n]/.test(guarded)) return `"${guarded.replaceAll('"', '""')}"`;
  return guarded;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [headers.map(csvField), ...rows.map((row) => row.map(csvField))].map((cols) => cols.join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function exportFilename(type: ExportType, now = new Date()): string {
  return `north-and-form-${type}-${now.toISOString().slice(0, 10)}.csv`;
}

export function buildExport(state: ShopState, type: ExportType, now = new Date()) {
  const products = new Map(state.products.map((product) => [product.id, product]));
  const quotes = new Map(state.quotes.map((quote) => [quote.id, quote]));
  let headers: string[];
  let rows: Array<Array<string | number>>;

  switch (type) {
    case 'inventory':
      headers = ['Product ID', 'Name', 'Variant', 'SKU', 'Price (GBP)', 'Cost (GBP)', 'On hand', 'Reserved', 'Available', 'Demand', 'Daily sales', 'Lead days', 'Kind'];
      rows = state.products.map((product) => [
        product.id,
        product.name,
        product.variant,
        product.sku,
        penceToGbp(product.price),
        penceToGbp(product.cost),
        product.onHand,
        product.reserved,
        available(product),
        product.demand,
        product.dailySales,
        product.leadDays,
        product.kind,
      ]);
      break;
    case 'orders':
      headers = ['Order ID', 'Product ID', 'SKU', 'Product', 'Quantity', 'Total (GBP)', 'Customer', 'Status'];
      rows = state.orders.map((order) => {
        const product = products.get(order.productId);
        return [order.id, order.productId, product?.sku ?? '', product?.name ?? '', order.quantity, penceToGbp(order.total), order.customer, order.status];
      });
      break;
    case 'purchases':
      headers = ['Purchase ID', 'Product ID', 'SKU', 'Product', 'Quote ID', 'Supplier', 'Country', 'Quantity', 'Total (GBP)', 'Status', 'Created at'];
      rows = state.purchases.map((purchase) => {
        const product = products.get(purchase.productId);
        const quote = quotes.get(purchase.quoteId);
        return [
          purchase.id,
          purchase.productId,
          product?.sku ?? '',
          product?.name ?? '',
          purchase.quoteId,
          quote?.supplier ?? '',
          quote?.country ?? '',
          purchase.quantity,
          penceToGbp(purchase.total),
          purchase.status,
          purchase.createdAt,
        ];
      });
      break;
    case 'activity':
      headers = ['Activity ID', 'Owner', 'Title', 'Detail', 'Recorded at'];
      rows = state.activities.map((activity) => [activity.id, activity.owner, activity.title, activity.detail, activity.at]);
      break;
  }

  return {
    csv: `${BOM}${toCsv(headers, rows)}`,
    filename: exportFilename(type, now),
    contentType: 'text/csv; charset=utf-8',
  };
}
