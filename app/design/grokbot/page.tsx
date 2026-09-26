import { notFound } from 'next/navigation';
import { Story } from './story';

export const metadata = { title: 'GrokBot chat kit', robots: { index: false } };

/** Design preview for the GrokBot chat kit. Development only — Codex wires the real flow into the dashboard. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 16px 48px' }}><Story /></main>;
}
