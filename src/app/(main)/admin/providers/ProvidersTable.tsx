'use client';
import { DataColumn, DataTable, Dialog, Icon, MenuItem, Modal, Row, Text } from '@umami/react-zen';
import { useState } from 'react';
import { DateDistance } from '@/components/common/DateDistance';
import { useMessages } from '@/components/hooks';
import { Edit, Trash } from '@/components/icons';
import { MenuButton } from '@/components/input/MenuButton';
import { ProviderDeleteForm } from './ProviderDeleteForm';
import { ProviderEditForm } from './ProviderEditForm';

export function ProvidersTable({ data = [] }: { data: any[] }) {
  const { formatMessage, labels } = useMessages();
  const [editProvider, setEditProvider] = useState(null);
  const [deleteProvider, setDeleteProvider] = useState(null);

  return (
    <>
      <DataTable data={data}>
        <DataColumn id="name" label={formatMessage(labels.name)} width="2fr">
          {(row: any) => row.name}
        </DataColumn>
        <DataColumn id="type" label={formatMessage(labels.type)}>
          {(row: any) => row.type}
        </DataColumn>
        <DataColumn id="issuer" label={formatMessage(labels.issuer)} width="2fr">
          {(row: any) => (
            <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.issuer}
            </Text>
          )}
        </DataColumn>
        <DataColumn id="enabled" label={formatMessage(labels.enabled)}>
          {(row: any) => <Text>{row.enabled ? '✓' : '✗'}</Text>}
        </DataColumn>
        <DataColumn id="created" label={formatMessage(labels.created)}>
          {(row: any) => <DateDistance date={new Date(row.createdAt)} />}
        </DataColumn>
        <DataColumn id="action" align="end" width="100px">
          {(row: any) => (
            <MenuButton>
              <MenuItem id="edit" onAction={() => setEditProvider(row)}>
                <Row alignItems="center" gap>
                  <Icon>
                    <Edit />
                  </Icon>
                  <Text>{formatMessage(labels.edit)}</Text>
                </Row>
              </MenuItem>
              <MenuItem id="delete" onAction={() => setDeleteProvider(row)}>
                <Row alignItems="center" gap>
                  <Icon>
                    <Trash />
                  </Icon>
                  <Text>{formatMessage(labels.delete)}</Text>
                </Row>
              </MenuItem>
            </MenuButton>
          )}
        </DataColumn>
      </DataTable>
      <Modal isOpen={!!editProvider}>
        <Dialog
          title={formatMessage(labels.editProvider || labels.edit)}
          style={{ width: 700, maxWidth: '90vw' }}
        >
          {() => <ProviderEditForm provider={editProvider} onClose={() => setEditProvider(null)} />}
        </Dialog>
      </Modal>
      <Modal isOpen={!!deleteProvider}>
        <ProviderDeleteForm
          providerId={deleteProvider?.id}
          providerName={deleteProvider?.name}
          onClose={() => setDeleteProvider(null)}
        />
      </Modal>
    </>
  );
}
