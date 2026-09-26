import type { Metadata, Viewport } from 'next';
import MobileDecision from '@/components/mobile/mobile-decision';

export const metadata: Metadata = { title: 'ShpKpr — Today’s decision', description: 'The most urgent stock decision for Fleek 0.5, sized for one hand.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0F0F0F' };

export default function MobilePage() { return <MobileDecision />; }
