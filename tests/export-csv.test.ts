import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/engine';
import {
  buildExport,
  csvField,
  exportFilename,
  parseExportType,
  penceToGbp,
  toCsv,
  UNSUPPORTED_EXPORT_TYPE,
} from '../lib/export-csv';
import type { ShopState } from '../lib/types';

const NOW = new Date('2026-09-26T11:00:00.000Z');

function csvBody(csv: string) {
  assert.equal(csv.startsWith('\uFEFF'), true, 'Excel-friendly UTF-8 BOM');
  return csv.slice(1);
}

function lines(csv: string) {
  return csvBody(csv).replace(/\r\n$/, '').split('\r\n');
}

function parseRow(line: string) {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { quoted = false; continue; }
      cur += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function sampleState(): ShopState {
  const state = seed();
  state.processedEvents = ['evt-secret-xyz', 'evt-internal-abc'];
  state.orders = [{
    id: 'NF-1001',
    productId: 'hoodie',
    quantity: 1,
    total: 6800,
    customer: 'Alex "A.", Morgan',
    status: 'reserved',
    eventId: 'evt-secret-xyz',
  }];
  state.purchases = [{
    id: 'PO-1001',
    productId: 'hoodie',
    quoteId: 'north',
    quantity: 20,
    total: 45200,
    status: 'ordered',
    createdAt: '2026-09-26T10:00:00.000Z',
  }];
  state.activities = [
    { id: 'a-hack', owner: 'system', title: '=HYPERLINK("http://evil.example")', detail: "+cmd|' /C calc'!A0", at: '2026-09-26T10:00:00.000Z' },
    { id: 'a-quote', owner: 'sales', title: 'Customer said "restock", please', detail: 'Line one\nLine two', at: '2026-09-26T09:00:00.000Z' },
    { id: 'a-tab', owner: 'stock', title: '\t=1+1', detail: '\r@SUM(A1)', at: '2026-09-26T08:00:00.000Z' },
  ];
  return state;
}

test('parseExportType accepts only the four documented values', () => {
  assert.equal(parseExportType('inventory'), 'inventory');
  assert.equal(parseExportType('orders'), 'orders');
  assert.equal(parseExportType('purchases'), 'purchases');
  assert.equal(parseExportType('activity'), 'activity');
  assert.equal(parseExportType(' activity '), 'activity');
  for (const bad of [null, undefined, '', 'INVENTORY', 'quotes', 'messages', 'processedEvents', 'connections', 'inventory,orders']) {
    assert.equal(parseExportType(bad), null, String(bad));
  }
  assert.match(UNSUPPORTED_EXPORT_TYPE, /inventory, orders, purchases or activity/);
});

test('pence is formatted as an explicit GBP decimal, never a bare integer count of pence', () => {
  assert.equal(penceToGbp(6800), '68.00');
  assert.equal(penceToGbp(1850), '18.50');
  assert.equal(penceToGbp(0), '0.00');
  assert.equal(penceToGbp(Number.NaN), '0.00');
});

test('csvField quotes commas, quotes and newlines', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('Manchester, UK'), '"Manchester, UK"');
  assert.equal(csvField('He said "hello"'), '"He said ""hello"""');
  assert.equal(csvField('line1\nline2'), '"line1\nline2"');
  assert.equal(csvField('line1\r\nline2'), '"line1\r\nline2"');
  assert.equal(toCsv(['A', 'B'], [['x', 'y,z']]), 'A,B\r\n' + 'x,"y,z"\r\n');
});

test('csvField neutralises spreadsheet formula injection', () => {
  assert.equal(csvField('=1+1'), '"\'=1+1"');
  assert.equal(csvField('+cmd'), '"\'+cmd"');
  assert.equal(csvField('-2+3'), '"\'-2+3"');
  assert.equal(csvField('@SUM(A1)'), '"\'@SUM(A1)"');
  assert.equal(csvField('\t=1+1'), '"\'\t=1+1"');
  assert.equal(csvField('\r=1+1'), '"\'\r=1+1"');
  assert.equal(csvField(`=1+1,"cmd"`), `"'=1+1,""cmd"""`);
  assert.equal(csvField(68), '68', 'numeric cells we control are not prefixed');
});

test('inventory export uses selected catalogue fields and GBP amounts', () => {
  const { csv, filename, contentType } = buildExport(sampleState(), 'inventory', NOW);
  assert.equal(filename, 'north-and-form-inventory-2026-09-26.csv');
  assert.equal(contentType, 'text/csv; charset=utf-8');
  assert.equal(exportFilename('inventory', NOW), filename);
  const [header, hoodie] = lines(csv).map(parseRow);
  assert.deepEqual(header, ['Product ID', 'Name', 'Variant', 'SKU', 'Price (GBP)', 'Cost (GBP)', 'On hand', 'Reserved', 'Available', 'Demand', 'Daily sales', 'Lead days', 'Kind']);
  assert.equal(hoodie[0], 'hoodie');
  assert.equal(hoodie[3], 'EH-BLK-M');
  assert.equal(hoodie[4], '68.00');
  assert.equal(hoodie[5], '22.00');
  assert.equal(hoodie[6], '8');
  assert.equal(hoodie[7], '7');
  assert.equal(hoodie[8], '1');
  assert.equal(hoodie[12], 'hoodie');
  assert.equal(hoodie.includes('6800'), false);
  assert.equal(hoodie.includes('2200'), false);
  assert.equal(csv.includes('6800'), false);
  assert.equal(header.includes('Tone'), false);
  assert.equal(csv.toLowerCase().includes('processeden'), false);
});

test('orders export omits event identifiers and formats totals in GBP', () => {
  const { csv, filename } = buildExport(sampleState(), 'orders', NOW);
  assert.equal(filename, 'north-and-form-orders-2026-09-26.csv');
  const [header, order] = lines(csv).map(parseRow);
  assert.deepEqual(header, ['Order ID', 'Product ID', 'SKU', 'Product', 'Quantity', 'Total (GBP)', 'Customer', 'Status']);
  assert.equal(order[0], 'NF-1001');
  assert.equal(order[2], 'EH-BLK-M');
  assert.equal(order[3], 'Everyday Hoodie');
  assert.equal(order[5], '68.00');
  assert.equal(order[6], 'Alex "A.", Morgan');
  assert.equal(order[7], 'reserved');
  assert.equal(csv.includes('evt-secret-xyz'), false);
  assert.equal(csv.includes('eventId'), false);
  assert.equal(header.includes('Event ID'), false);
});

test('purchases export joins supplier fields and quotes commas in country', () => {
  const { csv } = buildExport(sampleState(), 'purchases', NOW);
  const [header, purchase] = lines(csv).map(parseRow);
  assert.deepEqual(header, ['Purchase ID', 'Product ID', 'SKU', 'Product', 'Quote ID', 'Supplier', 'Country', 'Quantity', 'Total (GBP)', 'Status', 'Created at']);
  assert.equal(purchase[0], 'PO-1001');
  assert.equal(purchase[5], 'North Thread');
  assert.equal(purchase[6], 'Manchester, UK');
  assert.equal(purchase[8], '452.00');
  assert.equal(purchase[9], 'ordered');
  assert.equal(csv.includes('45200'), false);
  assert.match(csvBody(csv), /"Manchester, UK"/);
});

test('activity export guards formulas, quotes, and newlines in selected fields', () => {
  const { csv } = buildExport(sampleState(), 'activity', NOW);
  const rows = lines(csv).map(parseRow);
  assert.deepEqual(rows[0], ['Activity ID', 'Owner', 'Title', 'Detail', 'Recorded at']);
  assert.equal(rows[1][2], `'=HYPERLINK("http://evil.example")`);
  assert.equal(rows[1][3], `'+cmd|' /C calc'!A0`);
  assert.equal(rows[2][2], 'Customer said "restock", please');
  assert.equal(rows[2][3], 'Line one\nLine two');
  assert.equal(rows[3][2], `'\t=1+1`);
  assert.equal(rows[3][3], `'\r@SUM(A1)`);
  assert.match(csvField('=HYPERLINK("http://evil.example")'), /^"\'=HYPERLINK\(""http:\/\/evil\.example""\)"$/);
});

test('exports never dump processed events, connections, or environment-shaped secrets', () => {
  const state = sampleState();
  const combined = EXPORT_TYPES_COMBINED(state);
  assert.equal(combined.includes('evt-secret-xyz'), false);
  assert.equal(combined.includes('evt-internal-abc'), false);
  assert.equal(combined.includes('processedEvents'), false);
  assert.equal(combined.includes('SUPABASE'), false);
  assert.equal(combined.includes('SERVICE_ROLE'), false);
  assert.equal(combined.includes('TAVILY'), false);
  assert.equal(combined.includes('XAI_API_KEY'), false);
  assert.equal(combined.includes('SHOPKEEPER_AGENT_TOKEN'), false);
  assert.equal(combined.toLowerCase().includes('connection'), false);
});

function EXPORT_TYPES_COMBINED(state: ShopState) {
  return ['inventory', 'orders', 'purchases', 'activity']
    .map((type) => buildExport(state, type as 'inventory').csv)
    .join('\n');
}
