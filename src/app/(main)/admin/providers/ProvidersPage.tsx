'use client';
import { Column } from '@umami/react-zen';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { useMessages } from '@/components/hooks';
import { ProviderAddButton } from './ProviderAddButton';
import { ProvidersDataTable } from './ProvidersDataTable';

export function ProvidersPage() {
  const { formatMessage, labels } = useMessages();

  return (
    <Column gap="6" margin="2">
      <PageHeader title={formatMessage(labels.providers)}>
        <ProviderAddButton />
      </PageHeader>
      <Panel>
        <ProvidersDataTable />
      </Panel>
    </Column>
  );
}
