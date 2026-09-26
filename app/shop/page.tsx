import type { Metadata } from 'next';
import Storefront from '@/components/storefront/storefront';

export const metadata: Metadata = {
  title: 'Fleek 0.5 — Sample store',
  description: 'A sample customer storefront for Fleek 0.5, connected to the ShpKpr merchant workspace.',
};

export default function ShopPage() {
  return <Storefront />;
}
