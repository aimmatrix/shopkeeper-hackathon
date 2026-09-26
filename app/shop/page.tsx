import type { Metadata } from 'next';
import Storefront from '@/components/storefront/storefront';

export const metadata: Metadata = {
  title: 'North & Form — Sample store',
  description: 'A sample customer storefront for North & Form, connected to the Shopkeeper merchant workspace.',
};

export default function ShopPage() {
  return <Storefront />;
}
