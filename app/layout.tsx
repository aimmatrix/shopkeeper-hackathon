import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Shopkeeper — Your store. A step ahead.', description: 'Connect customer demand, inventory and supplier decisions. A merchant workspace built for the Grok Bot Commerce Hackathon.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
