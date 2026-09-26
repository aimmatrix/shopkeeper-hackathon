import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { seed, transition } from './engine';
import { Action, ShopState } from './types';

const file = path.join(process.cwd(), '.data', 'shopkeeper.json');
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const db = process.env.SUPABASE_URL && dbKey
  ? createClient(process.env.SUPABASE_URL, dbKey, { auth: { persistSession: false }, global: { headers: { 'x-workspace-key': process.env.SHOPKEEPER_WORKSPACE_KEY || '' } } }) : null;
let queue: Promise<unknown> = Promise.resolve();

export async function readState(): Promise<ShopState> {
  if (db) {
    const { data, error } = await db.from('shopkeeper_demo').select('state').eq('id', 'north-and-form').single();
    if (error) throw new Error('Supabase workspace is unavailable. Run the setup migration and seed first.');
    return data.state as ShopState;
  }
  if (process.env.VERCEL) throw new Error('Connect Supabase before deploying. Local file storage is only supported in development.');
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return seed(); throw error; }
}

export function mutate(action: Action): Promise<ShopState> {
  const task = queue.then(async () => {
    const before = await readState();
    const after = transition(before, action);
    if (after === before) return after;
    // A monotonically increasing version also covers resetting the demo.
    after.version = before.version + 1;
    if (db) {
      const { data, error } = await db.from('shopkeeper_demo').update({ state: after, version: after.version }).eq('id', 'north-and-form').eq('version', before.version).select('id');
      if (error) throw new Error('Could not save the workspace. Please retry.');
      if (!data?.length) throw new Error('The workspace changed during this action. Refresh and retry.');
    } else {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(`${file}.tmp`, JSON.stringify(after));
      await fs.rename(`${file}.tmp`, file);
    }
    return after;
  });
  queue = task.catch(() => undefined);
  return task;
}

export function connections() {
  return { database: db ? 'supabase' : 'local', tavily: Boolean(process.env.TAVILY_API_KEY), grok: Boolean(process.env.SHOPKEEPER_AGENT_TOKEN), mode: 'demo' };
}
