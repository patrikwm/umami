'use client';
import type { ReactNode } from 'react';
import { DataGrid } from '@/components/common/DataGrid';
import { useOidcProvidersQuery } from '@/components/hooks';
import { ProvidersTable } from './ProvidersTable';

export function ProvidersDataTable({ children }: { children?: ReactNode }) {
  const queryResult = useOidcProvidersQuery();

  return (
    <DataGrid query={queryResult} allowSearch={true}>
      {({ data }) => <ProvidersTable data={data} />}
    </DataGrid>
  );
}
