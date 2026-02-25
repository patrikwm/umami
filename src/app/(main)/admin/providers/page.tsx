import type { Metadata } from 'next';
import { ProvidersPage } from './ProvidersPage';

export default function () {
  return <ProvidersPage />;
}

export const metadata: Metadata = {
  title: 'Providers',
};
