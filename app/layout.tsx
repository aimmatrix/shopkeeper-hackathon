import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--sk-font', display: 'swap' });
export const metadata: Metadata = { title: 'Shopkeeper — Your store. A step ahead.', description: 'Connect customer demand, inventory and supplier decisions. A merchant workspace built for the Grok Bot Commerce Hackathon.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className={montserrat.variable}><body>{children}</body></html>; }
